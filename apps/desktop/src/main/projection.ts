/**
 * Valorant projection session — normalizes provider facts into HUD relay
 * state, with the audited round-number/phase pairing rules (hold a backwards
 * phase until its matching number lands; drop stale end-phases).
 */
import {
  hudRelayStateSchema,
  type HudRelayState,
  type KillfeedEntry,
  type ValorantSessionSnapshot,
} from "@havoc-unleash/contracts";

import { agentDisplayName, agentIconUrl, weaponDisplayName } from "./valorant-identity";

const PHASE_ORDER: Record<string, number> = { shopping: 0, combat: 1, end: 2 };

/**
 * GEP facts frequently arrive as JSON-encoded STRINGS (scoreboard, kill_feed,
 * match_score, ...). Decode once so every case works with real objects.
 */
function parseFactValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const t = value.trim();
  if (t.startsWith("{") || t.startsWith("[")) {
    try {
      return JSON.parse(t) as unknown;
    } catch {
      return value;
    }
  }
  return value;
}

/** Pipeline telemetry — enabled with HAVOC_DEBUG_PIPELINE=1 (no secrets). */
function pipelineLog(event: string, data: Record<string, unknown>): void {
  if (process.env.HAVOC_DEBUG_PIPELINE === "1") {
    console.log("[pipeline:projection]", event, JSON.stringify(data));
  }
}

interface WorkingState {
  revision: number;
  // Includes all upstream phases (unknown/pregame/ending) + fork (loading).
  sessionPhase: "unknown" | "idle" | "loading" | "pregame" | "live" | "ending";
  matchId: string | null;
  mapKey: string | null;
  mapName: string | null;
  roundNumber: number;
  roundPhase: "shopping" | "combat" | "end" | "unknown";
  phaseStartedAt: number | null;
  spikePlantedAt: number | null;
  viewerGepTeam: number | null;
  viewerName: string | null;
  pendingPhase: string | null;
  publishedNumber: number;
  publishedPhase: string | null;
  blue: number;
  red: number;
  spike: HudRelayState["spike"];
  killfeed: KillfeedEntry[];
  viewerRole: "player" | "observer" | "coach" | "spectator" | "unknown";
  roster: HudRelayState["roster"];
  // --- Round-settlement classification (ported from upstream val-round-settlement) ---
  gameEvent: string | null;
  roundKills: Map<string, number>;
  roundDeaths: Set<string>;
  clutchMax: Map<string, number>;
  roundStartScore: { blue: number; red: number } | null;
  /** Epoch ms of the last round settlement — drives the endround hold. */
  roundEndedAt: number | null;
  matchWinner: "blue" | "red" | null;
  matchMvp: { name: string; teamId: string; kills: number; deaths: number; assists: number } | null;
  roundEnd: { winner: "blue" | "red"; reason: "elimination" | "detonation" | "defusion" | "time" } | null;
  roundHistory: Array<{
    round: number;
    winner: "blue" | "red";
    reason: "elimination" | "detonation" | "defusion" | "time";
  }>;
}

function initial(): WorkingState {
  return {
    revision: 0,
    sessionPhase: "idle",
    matchId: null,
    mapKey: null,
    mapName: null,
    roundNumber: 0,
    roundPhase: "unknown",
    phaseStartedAt: null,
    spikePlantedAt: null,
    viewerGepTeam: null,
    viewerName: null,
    pendingPhase: null,
    publishedNumber: 0,
    publishedPhase: null,
    blue: 0,
    red: 0,
    spike: null,
    killfeed: [],
    viewerRole: "unknown",
    roster: [],
    gameEvent: null,
    roundKills: new Map(),
    roundDeaths: new Set(),
    clutchMax: new Map(),
    roundStartScore: null,
    roundEndedAt: null,
    matchWinner: null,
    matchMvp: null,
    roundEnd: null,
    roundHistory: [],
  };
}

export class ValProjectionSession {
  private s = initial();
  private killSeq = 1;
  /** Stable per-player creation order — keeps roster positions fixed across publishes. */
  private rosterSeq = new Map<string, number>();
  /** Last GEP team number seen per player — the team-side source of truth. */
  private lastGepTeam = new Map<string, number>();
  private readonly listeners = new Set<(state: HudRelayState) => void>();

  public reset(): void {
    this.s = initial();
    this.emitChange();
  }

  public subscribe(fn: (state: HudRelayState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  public snapshotValue(): HudRelayState {
    return this.build();
  }

  /* ------------------------- inputs ------------------------- */

  public applySnapshot(snap: ValorantSessionSnapshot): void {
    const s = this.s;
    // Dialect normalization: upstream nests identity under session.*
    const sessionPhase =
      snap.sessionPhase ?? snap.phase ?? s.sessionPhase;
    const matchId = snap.matchId ?? snap.session?.matchId ?? null;
    const mapKey = snap.mapKey ?? snap.session?.map?.key ?? null;

    s.revision += 1;
    s.sessionPhase = sessionPhase;
    // Remember the viewer's display name so GEP scoreboard facts can anchor
    // the local player (is_local/team) to their roster entry.
    if (!s.viewerName) {
      const vp = snap.session?.viewer?.player ?? snap.viewer?.player ?? null;
      const vn = vp?.displayName ?? vp?.gameName ?? null;
      if (vn) s.viewerName = vn;
    }
    if ((s.matchId ?? null) !== matchId) {
      // New match => clear the previous match's post-game result AND the whole
      // team/roster anchoring, so sides re-anchor fresh for the new match.
      s.matchId = matchId;
      s.matchWinner = null;
      s.matchMvp = null;
      s.roster = [];
      s.roundHistory = [];
      s.roundEnd = null;
      s.gameEvent = null;
      s.viewerGepTeam = null;
      s.viewerName = null;
      this.rosterSeq.clear();
      this.lastGepTeam.clear();
    }
    const MAP_NAMES: Record<string, string> = {
      // Canonical keys (formatMapKey output) -> display names. Codename
      // aliases included so a stale codename key still resolves.
      ascent: "Ascent", bind: "Bind", haven: "Haven", split: "Split", breeze: "Breeze",
      icebox: "Icebox", pearl: "Pearl", fracture: "Fracture", lotus: "Lotus", sunset: "Sunset",
      abyss: "Abyss", drift: "Drift", piazza: "Piazza", kasbah: "Kasbah", sunset2: "Sunset",
      "ascent-2": "Ascent", glaze: "Glitch", district: "District", summit: "Summit",
      infinity: "Abyss", bonsai: "Split", corrode: "Corrode", range: "The Range",
      // Riot internal codenames the engine actually sends:
      jam: "Lotus", duality: "Bind", foxtrot: "Breeze", canyon: "Fracture",
      pitt: "Pearl", triad: "Haven", port: "Icebox", rook: "Corrode", plummet: "Summit",
      infinity_: "Abyss", hurm_alley: "District", hurm_bowl: "Kasbah", hurm_helix: "Drift",
      hurm_hightide: "Glitch", hurm_yard: "Piazza", skirmish_a: "Skirmish A", skirmish_b: "Skirmish B",
      skirmish_c: "Skirmish C", skirmish_d: "Skirmish D", skirmish_e: "Skirmish E",
      juliett: "Sunset", drome: "Drome", riviera: "Riviera",
    };
    if (mapKey) {
      s.mapKey = mapKey;
      s.mapName = MAP_NAMES[mapKey] ?? mapKey;
    }
    if (snap.viewer?.role) s.viewerRole = snap.viewer.role;
    if (mapKey && s.mapKey !== mapKey) {
      // New map => fresh round bookkeeping.
      s.mapKey = mapKey;
      s.killfeed = [];
      s.spike = null;
      s.roundNumber = 0;
      s.publishedNumber = 0;
      s.publishedPhase = null;
      s.pendingPhase = null;
      s.roundPhase = "unknown";
      s.roundEndedAt = null;
    }
    if (snap.viewer?.role) s.viewerRole = snap.viewer.role;
    else if (snap.session?.viewer?.role) s.viewerRole = snap.session.viewer.role;
    const teams = snap.teams ?? snap.session?.teams;
    // Capture the pre-refresh roster first: snapshot refreshes must not wipe
    // stats merged from scoreboard facts between heartbeats.
    const previousRoster = s.roster;
    if (teams && teams.length > 0) {
      s.roster = teams.flatMap((team) => {
        // Normalize team naming: Riot pregame uses "Team One"/"Team Two", the
        // live game uses "Blue"/"Red", and unknown teams may say anything.
        const lower = team.teamId.toLowerCase();
        const isBlue = lower === "blue" || lower === "team one";
        const isRed = lower === "red" || lower === "team two";
        const fallbackIndex = isBlue ? 0 : isRed ? 1 : undefined;
        // HUD color/split logic keys on "Blue"/"Red" strings.
        const normalizedTeamId = isBlue ? "Blue" : isRed ? "Red" : team.teamId;
        return team.players.map((p) => ({
          displayName:
            p.player.name?.displayName ??
            p.player.identity?.displayName ??
            p.player.identity?.gameName ??
            p.player.puuid ??
            "?",
          agentName: p.agent?.name ?? null,
          agentIcon: p.agent?.riotId ? agentIconUrl(p.agent.riotId) ?? null : undefined,
          agentKey: p.agent?.key ?? undefined,
          teamId: normalizedTeamId,
          teamIndex: p.teamIndex ?? fallbackIndex,
          slot: p.observerSlot ?? undefined,
          // Live scoreboard detail (fork runtime dialect nests these under
          // player; upstream "scoreboard" facts merge in via applyFact).
          kills: p.player.kills ?? undefined,
          deaths: p.player.deaths ?? undefined,
          assists: p.player.assists ?? undefined,
          weapon: p.player.weapon ?? undefined,
          credits: p.player.credits ?? undefined,
          spentCredits: p.player.spentCredits ?? undefined,
          health: p.player.health ?? undefined,
          isAlive: p.player.isAlive ?? undefined,
          ultPoints: p.player.ultPoints ?? undefined,
          ultMax: p.player.ultMax ?? undefined,
          hasSpike: p.player.hasSpike ?? undefined,
        }));
      });
      // Upstream snapshots carry no per-player stats; the scoreboard facts
      // merged between heartbeats must survive snapshot refreshes. Carry
      // previous stats over when the snapshot itself supplies none.
      // ALSO dedupe: some engine snapshots list the viewer under BOTH squads —
      // keep the first entry per normalized display name.
      const previous = new Map(
        (previousRoster ?? []).map((p) => [this.normalizeName(p.displayName), p]),
      );
      const seenNames = new Set<string>();
      s.roster = s.roster.filter((entry) => {
        const n = this.normalizeName(entry.displayName);
        if (seenNames.has(n)) return false;
        seenNames.add(n);
        return true;
      });
      for (const entry of s.roster) {
        const hasSnapshotStats =
          entry.kills !== undefined ||
          entry.deaths !== undefined ||
          entry.credits !== undefined ||
          entry.isAlive !== undefined;
        if (hasSnapshotStats) continue;
        const prior = previous.get(this.normalizeName(entry.displayName));
        if (!prior) continue;
        // Team side is anchored by GEP scoreboard facts (viewerGepTeam). The
        // engine snapshot's squad labels oscillate between heartbeats — keep
        // the anchored side so rows never flip teams or reorder.
        if (s.viewerGepTeam !== null) {
          const gt = this.lastGepTeam.get(this.normalizeName(entry.displayName));
          if (gt != null) {
            entry.teamIndex = gt === s.viewerGepTeam ? 0 : 1;
            entry.teamId = entry.teamIndex === 0 ? "Blue" : "Red";
          } else if (prior.teamIndex != null) {
            entry.teamIndex = prior.teamIndex;
            entry.teamId = prior.teamId ?? entry.teamId;
          }
        } else if (prior.teamIndex != null) {
          entry.teamIndex = prior.teamIndex;
          entry.teamId = prior.teamId ?? entry.teamId;
        }
        entry.kills = prior.kills ?? undefined;
        entry.deaths = prior.deaths ?? undefined;
        entry.assists = prior.assists ?? undefined;
        entry.weapon = prior.weapon ?? undefined;
        entry.credits = prior.credits ?? undefined;
        entry.spentCredits = prior.spentCredits ?? undefined;
        entry.health = prior.health ?? undefined;
        entry.isAlive = prior.isAlive ?? undefined;
        entry.ultPoints = prior.ultPoints ?? undefined;
        entry.ultMax = prior.ultMax ?? undefined;
        entry.hasSpike = prior.hasSpike ?? undefined;
      }
    } else if (s.sessionPhase === "idle") s.roster = [];
    this.emitChange();
  }

  public applyFact(key: string, rawValue: unknown): void {
    const s = this.s;
    const value = parseFactValue(rawValue);
    // The engine emits prefixed scoreboard variants (scoreboard_ally,
    // scoreboard_enemy, scoreboard_N, ...). Normalize to the base case.
    const normalizedKey = key.startsWith("scoreboard") ? "scoreboard" : key;
    switch (normalizedKey) {
      case "match_score":
      case "score": {
        const rec = value as { team_0?: unknown; team_1?: unknown; won?: unknown; lost?: unknown };
        // Fork dialect: {team_0, team_1} are absolute sides (blue/red).
        // Engine dialect: {won, lost} is the LOCAL PLAYER's perspective - the
        // viewer's side is anchored by their GEP team number (is_local
        // scoreboard entries), NOT assumed to be blue.
        let viewerScore: number | null = null;
        let enemyScore: number | null = null;
        if (rec?.team_0 !== undefined || rec?.team_1 !== undefined) {
          const b = Number(rec?.team_0);
          const r = Number(rec?.team_1);
          if (Number.isFinite(b) && Number.isFinite(r)) {
            s.blue = b;
            s.red = r;
          } else return;
        } else if (rec?.won !== undefined || rec?.lost !== undefined) {
          viewerScore = Number(rec?.won);
          enemyScore = Number(rec?.lost);
          if (!Number.isFinite(viewerScore) || !Number.isFinite(enemyScore)) return;
          const vi = this.viewerTeamIndex();
          if (vi === 1) {
            s.red = viewerScore;
            s.blue = enemyScore;
          } else {
            s.blue = viewerScore;
            s.red = enemyScore;
          }
        } else return;
        // Match point reached -> the side with more rounds is the winner.
        if (s.blue >= 13 || s.red >= 13) {
          s.matchWinner = s.blue >= s.red ? "blue" : "red";
        }
        // The engine delivers match_score AFTER round_phase:end - settle now
        // so the round winner/reason is never lost to the shopping wipe.
        if (s.roundPhase === "end" && s.gameEvent === null) this.settle();
        break;
      }
      case "round_number": {
        const n = Number(value);
        if (!Number.isFinite(n)) return;
        s.roundNumber = n;
        if (s.pendingPhase !== null && n > s.publishedNumber) this.publishRound();
        break;
      }
      case "round_phase": {
        if (typeof value !== "string") return;
        if (!(value in PHASE_ORDER)) return;
        if (value === "end" && s.roundNumber <= 0) {
          s.pendingPhase = null;
          break;
        }
        s.pendingPhase = value;
        if (!this.shouldWaitForNumber(value)) this.publishRound();
        else break;
        break;
      }
      case "kill_feed": {
        const rec = value as Record<string, unknown>;
        if (
          !rec ||
          typeof rec.attacker !== "string" ||
          typeof rec.victim !== "string" ||
          rec.attacker.length === 0
        ) {
          return;
        }
        const weaponName = weaponDisplayName(rec.weapon ?? rec.weaponName) ?? "";
        s.killfeed.unshift({
          seq: this.killSeq++,
          attacker: rec.attacker,
          victim: rec.victim,
          weapon: weaponName,
          modifier: rec.headshot === true ? "headshot" : typeof rec.modifier === "string" ? rec.modifier : null,
          at: Date.now(),
        });
        s.killfeed = s.killfeed.slice(0, 25);
        this.trackRoundKill(rec.attacker, rec.victim, weaponName, rec.assists);
        break;
      }
      case "kill": {
        const rec = value as Record<string, unknown>;
        if (rec && typeof rec.attacker === "string" && typeof rec.victim === "string") {
          const weaponName = weaponDisplayName(rec.weapon ?? rec.weaponName) ?? "";
          this.trackRoundKill(rec.attacker, rec.victim, weaponName, rec.assists);
        }
        break;
      }
      case "death": {
        const rec = value as Record<string, unknown>;
        const victim = typeof rec?.victim === "string" ? rec.victim : typeof rec?.name === "string" ? rec.name : null;
        if (victim) {
          const vKey = this.normalizeName(victim);
          for (const p of s.roster ?? []) {
            const pName = this.normalizeName(p.displayName);
            if (pName === vKey || pName.includes(vKey) || vKey.includes(pName)) {
              p.isAlive = false;
              p.health = 0;
              p.deaths = (p.deaths ?? 0) + 1;
            }
          }
        }
        break;
      }
      case "spike_planted":
        s.spike = "planted";
        s.spikePlantedAt = Date.now();
        break;
      case "spike_defused":
        s.spike = "defused";
        s.spikePlantedAt = null;
        break;
      case "spike_detonated":
        s.spike = "detonated";
        s.spikePlantedAt = null;
        break;
      case "match_end": {
        // Upstream engine emits match_end when the match settles. Resolve the
        // winner from the score if the end-phase classification has not yet.
        if (s.blue >= 13 || s.red >= 13) {
          s.matchWinner = s.blue >= s.red ? "blue" : "red";
        }
        if (s.roundPhase === "end" || s.sessionPhase === "ending") this.settle();
        s.revision += 1;
        this.emitChange();
        return; // already emitted
      }
      case "scene": {
        const sc = String(value ?? "").toLowerCase().replace(/_/g, "-");
        if (sc === "agent-select" || sc === "character-select" || sc === "lobby" || sc === "pregame") {
          s.sessionPhase = "pregame";
        } else if (sc === "in-game" || sc === "combat" || sc === "live") {
          s.sessionPhase = "live";
        } else if (sc === "post-game" || sc === "game-end" || sc === "match-end") {
          s.sessionPhase = "ending";
        }
        break;
      }
      case "scoreboard": {
        // Per-player detail observation (weapon/credits/ults/shield/scoreline)
        // from the provider; merged into the matching roster entry by name.
        const rec = value as Record<string, unknown>;
        const name = typeof rec?.name === "string" ? rec.name : null;
        if (!name) return;
        let entry = (s.roster ?? []).find(
          (p) => this.normalizeName(p.displayName) === this.normalizeName(name),
        );
        const num = (v: unknown): number | undefined =>
          typeof v === "number" && Number.isFinite(v) ? v : undefined;
        const str = (v: unknown): string | undefined =>
          typeof v === "string" && v.length > 0 ? v : undefined;
        // Dialect union: the GEP-raw dialect sends {team, weapon, credits,
        // alive, ult_points}; the VS-family engine dialect sends {startTeam,
        // scoreboardWeaponInternal, money, isAlive, currUltPoints, initialArmor,
        // agentInternal}. Accept every alias so the anchor and all per-player
        // detail land regardless of which engine dialect is live.
        const gepTeam =
          typeof rec.team === "number"
            ? rec.team
            : typeof rec.startTeam === "number"
              ? rec.startTeam
              : null;
        // Anchor the viewer's GEP team from their scoreboard row — is_local
        // when the provider sends it, otherwise the snapshot's viewer name.
        // (Without this, a cold start piles every player onto one team.)
        const normName = this.normalizeName(name);
        if (gepTeam !== null) this.lastGepTeam.set(normName, gepTeam);
        const isViewerRow =
          rec.is_local === true ||
          (s.viewerName != null && normName === this.normalizeName(s.viewerName));
        if (isViewerRow && gepTeam !== null) {
          if (s.viewerGepTeam === null) {
            s.viewerGepTeam = gepTeam;
            if (!s.viewerName) s.viewerName = name;
            // First anchor: re-side every already-known player from their own
            // last GEP team (self-heals the pre-anchor cold start).
            for (const p of s.roster ?? []) {
              const gt = this.lastGepTeam.get(this.normalizeName(p.displayName));
              if (gt != null) {
                p.teamIndex = gt === s.viewerGepTeam ? 0 : 1;
                p.teamId = p.teamIndex === 0 ? "Blue" : "Red";
              }
            }
          } else if (gepTeam !== s.viewerGepTeam) {
            // The viewer's own GEP team number changed mid-match (halftime
            // side flip or squad re-index). Re-anchor to the viewer so the
            // viewer stays LEFT and everyone re-sides from their own team.
            s.viewerGepTeam = gepTeam;
            for (const p of s.roster ?? []) {
              const gt = this.lastGepTeam.get(this.normalizeName(p.displayName));
              if (gt != null) {
                p.teamIndex = gt === s.viewerGepTeam ? 0 : 1;
                p.teamId = p.teamIndex === 0 ? "Blue" : "Red";
              }
            }
          }
        }
        if (!entry) {
          // ValoSpectra-style: GEP scoreboard is authoritative - create the
          // player on the fly instead of dropping the fact (cold-start safe).
          const viewerIdx = this.viewerTeamIndex();
          const teamIdx =
            gepTeam === null
              ? undefined
              : s.viewerGepTeam !== null && gepTeam !== s.viewerGepTeam
                ? 1 - viewerIdx
                : viewerIdx;
          entry = {
            displayName: name,
            agentName: agentDisplayName(rec.character) ?? null,
            agentKey:
              typeof rec.character === "string" && rec.character.length > 0
                ? rec.character.toLowerCase()
                : undefined,
            agentIcon: agentIconUrl(rec.character) ?? null,
            teamId: teamIdx === 0 ? "Blue" : teamIdx === 1 ? "Red" : undefined,
            teamIndex: teamIdx ?? undefined,
            kills: num(rec.kills) ?? null,
            deaths: num(rec.deaths) ?? null,
            assists: num(rec.assists) ?? null,
            credits: num(rec.credits ?? rec.money) ?? null,
            shield: num(rec.shield ?? rec.armor ?? rec.initialArmor) ?? null,
            weapon:
              weaponDisplayName(rec.weapon ?? rec.weaponName ?? rec.scoreboardWeaponInternal) ??
              null,
            isAlive: typeof rec.alive === "boolean" ? rec.alive : typeof rec.isAlive === "boolean" ? rec.isAlive : undefined,
            ultPoints: num(rec.ultPoints ?? rec.ult_points ?? rec.currUltPoints) ?? null,
            ultMax: num(rec.ultMax ?? rec.ult_max ?? rec.maxUltPoints) ?? null,
            hasSpike: typeof rec.spike === "boolean" ? rec.spike : null,
          };
          (s.roster ?? []).push(entry);
          // Lock the player's stable position (first-seen order). Fixes players
          // swapping rows/teams between publishes when fact order varies.
          const posKey = this.normalizeName(entry.displayName);
          if (!this.rosterSeq.has(posKey)) this.rosterSeq.set(posKey, this.rosterSeq.size + 1);
          break;
        }
        // Team side from the player's own last GEP team vs the viewer's
        // anchored team. Recompute is idempotent (GEP team ids are stable per
        // match), so rows never oscillate — and a pre-anchor cold start
        // self-heals on the next scoreboard cycle.
        if (s.viewerGepTeam !== null) {
          const gt = this.lastGepTeam.get(this.normalizeName(name));
          if (gt != null) {
            const wantIdx = gt === s.viewerGepTeam ? 0 : 1;
            entry.teamIndex = wantIdx;
            entry.teamId = wantIdx === 0 ? "Blue" : "Red";
          }
        }
        // GEP internal codenames -> human display + icon. The VS-family engine
        // dialect names the agent `agentInternal` ("Clay_PC_C") instead of
        // `character` ("Clay") — accept both.
        const agentInternal = str(rec.character) ?? str(rec.agentInternal) ?? null;
        entry.agentName = agentDisplayName(agentInternal) ?? entry.agentName ?? null;
        entry.agentKey =
          typeof agentInternal === "string" && agentInternal.length > 0
            ? agentInternal.toLowerCase().replace(/_pc(_c)?$/i, "")
            : (entry.agentKey ?? undefined);
        entry.agentIcon =
          agentIconUrl(agentInternal) ?? agentIconUrl(rec.agentUuid) ?? entry.agentIcon ?? null;
        const wNew =
          weaponDisplayName(rec.weapon ?? rec.weaponName ?? rec.scoreboardWeaponInternal) ?? null;
        // Knife equipped while a primary is still owned: keep the gun visible
        // (ValoSpectra highestWeapon semantics — GEP reports the HELD weapon).
        entry.weapon =
          wNew && !/knife|melee/i.test(wNew)
            ? wNew
            : (entry.weapon ?? wNew);
        entry.credits = num(rec.credits ?? rec.money) ?? entry.credits ?? null;
        entry.spentCredits = num(rec.spentCredits ?? rec.spent) ?? entry.spentCredits ?? null;
        entry.shield = num(rec.shield ?? rec.armor ?? rec.initialArmor) ?? entry.shield ?? null;
        entry.kills = num(rec.kills) ?? entry.kills ?? null;
        entry.deaths = num(rec.deaths) ?? entry.deaths ?? null;
        entry.assists = num(rec.assists) ?? entry.assists ?? null;
        // Buy phase: everyone is alive by definition. Ignore stale death
        // evidence that can trail the round reset (greyed-out card bug).
        const shopping = s.roundPhase === "shopping";
        if (num(rec.health) !== undefined) {
          entry.health = shopping ? Math.max(100, num(rec.health) ?? 0) : num(rec.health);
          if (!shopping && (entry.health ?? 1) <= 0) entry.isAlive = false;
        }
        entry.ultPoints =
          num(rec.ultPoints ?? rec.ult_points ?? rec.currUltPoints) ?? entry.ultPoints ?? null;
        entry.ultMax = num(rec.ultMax ?? rec.ult_max ?? rec.maxUltPoints) ?? entry.ultMax ?? null;
        const aliveEvidence =
          typeof rec.alive === "boolean" ? rec.alive : typeof rec.isAlive === "boolean" ? rec.isAlive : undefined;
        if (aliveEvidence !== undefined) {
          if (shopping) {
            entry.isAlive = true;
            entry.health = 100;
          } else {
            entry.isAlive = aliveEvidence;
            if (!aliveEvidence) entry.health = 0;
          }
        }
        if (typeof rec.hasSpike === "boolean") entry.hasSpike = rec.hasSpike;
        else if (typeof rec.spike === "boolean") entry.hasSpike = rec.spike;
        if (Array.isArray(rec.abilities)) {
          entry.abilities = rec.abilities.filter((a): a is string => typeof a === "string");
        }
        break;
      }
      case "abilities": {
        // GEP emits the LOCAL player's ability charges: {C,Q,E,X} booleans.
        const rec = value as Record<string, unknown>;
        const local = (s.roster ?? []).find(
          (p) =>
            s.viewerName != null &&
            this.normalizeName(p.displayName) === this.normalizeName(s.viewerName),
        );
        if (local) {
          local.abilityState = {
            C: rec?.C === true,
            Q: rec?.Q === true,
            E: rec?.E === true,
            X: rec?.X === true,
          };
        }
        break;
      }
      default:
        return; // unhandled keys never mutate -> no emit
    }
    s.revision += 1;
    this.emitChange();
  }

  public applyScore(blue: number, red: number): void {
    const s = this.s;
    s.blue = blue;
    s.red = red;
    // Provider publishes the score AFTER the end phase; resolve winner now.
    if (blue >= 13 || red >= 13) {
      s.matchWinner = blue >= 13 ? "blue" : "red";
    }
    // If the end-phase classification could not pick a winner yet (equal alive
    // counts), resolve now.
    if (s.roundPhase === "end" && s.gameEvent === null) this.settle();
    s.revision += 1;
    this.emitChange();
  }

  /* ------------------------ internals ------------------------ */

  private shouldWaitForNumber(nextPhase: string): boolean {
    const s = this.s;
    if (s.roundNumber <= 0) {
      // Round 1: the engine starts emitting shopping/combat before any
      // round_number fact - NEVER block (ValoSpectra parity). publishRound
      // promotes the round number to 1.
      return false;
    }
    if (s.publishedPhase === null) return false;
    if (s.roundNumber > s.publishedNumber) return false;
    const prevOrder = PHASE_ORDER[s.publishedPhase];
    const nextOrder = PHASE_ORDER[nextPhase];
    return prevOrder !== undefined && nextOrder !== undefined && nextOrder < prevOrder;
  }

  private publishRound(): void {
    const s = this.s;
    if (s.pendingPhase === null) return;
    const phase = s.pendingPhase;
    s.roundPhase = phase as HudRelayState["round"]["phase"];
    s.phaseStartedAt = Date.now();
    if (s.roundNumber <= 0) s.roundNumber = 1;
    s.publishedNumber = s.roundNumber;
    s.publishedPhase = phase;
    s.pendingPhase = null;

    if (phase === "shopping") {
      // New round: reset alive status and health to 100 for all players
      for (const p of s.roster ?? []) {
        p.isAlive = true;
        p.health = 100;
      }
      // wipe per-round evidence (the round-end banner survives into the buy
      // phase so the endround animation is never cut off — it is cleared when
      // the next round's combat phase publishes below).
      s.spike = null;
      s.spikePlantedAt = null;
      s.roundKills.clear();
      s.roundDeaths.clear();
      s.clutchMax.clear();
      s.roundStartScore = { blue: s.blue, red: s.red };
    } else if (phase === "end") {
      this.settle();
    } else if (phase === "combat") {
      // The previous round's banner/evidence is only stale once the next
      // round is actually being fought.
      s.gameEvent = null;
      s.roundEnd = null;
    }
  }

  /* --------------------- round-settlement classification --------------------- */
  /* Ported from upstream `val-round-settlement.ts` attribution(): priority
   * Clutch -> Ace (>=5 round kills) -> Team Ace (every winner >=1 kill) ->
   * Flawless (no winner died) -> Thrifty (loadout avg +2000; needs credit
   * evidence, otherwise skipped) -> Normal ("Round Win"). */

  private viewerTeamIndex(): number {
    const s = this.s;
    if (s.viewerName) {
      const hit = (s.roster ?? []).find(
        (p) => this.normalizeName(p.displayName) === this.normalizeName(s.viewerName!),
      );
      if (hit?.teamIndex != null) return hit.teamIndex;
    }
    // Fall back to the viewer's GEP team number (0 = Blue, 1 = Red in the
    // engine snapshot's team normalization). Without this the {won,lost}
    // score fact attributes rounds to the wrong side when the engine
    // snapshot hasn't populated the viewer's roster entry yet.
    if (s.viewerGepTeam !== null) return s.viewerGepTeam;
    return 0;
  }

  private normalizeName(name: string): string {
    return name.split("#")[0]!.trim().toLowerCase();
  }

  private trackRoundKill(attacker: string, victim: string, weapon?: string, assists?: unknown): void {
    const s = this.s;
    if (s.roundPhase !== "combat" && s.roundPhase !== "unknown") return;
    const aKey = this.normalizeName(attacker);
    const vKey = this.normalizeName(victim);
    s.roundKills.set(aKey, (s.roundKills.get(aKey) ?? 0) + 1);
    s.roundDeaths.add(vKey);
    this.refreshClutchSituations();

    // Mutate s.roster to immediately update deathstate, kills, deaths, weapon
    for (const p of s.roster ?? []) {
      const pName = this.normalizeName(p.displayName);
      const isVictim = pName === vKey || pName.includes(vKey) || vKey.includes(pName);
      const isAttacker = pName === aKey || pName.includes(aKey) || aKey.includes(pName);

      if (isVictim) {
        p.isAlive = false;
        p.health = 0;
        p.deaths = (p.deaths ?? 0) + 1;
      }
      if (isAttacker) {
        p.kills = (p.kills ?? 0) + 1;
        if (weapon) {
          p.weapon = weapon;
        }
      }
    }

    // Update assists if present
    if (Array.isArray(assists)) {
      for (const ast of assists) {
        if (typeof ast === "string" && ast.trim()) {
          const astKey = this.normalizeName(ast);
          for (const p of s.roster ?? []) {
            const pName = this.normalizeName(p.displayName);
            if (pName === astKey || pName.includes(astKey) || astKey.includes(pName)) {
              p.assists = (p.assists ?? 0) + 1;
            }
          }
        }
      }
    }
  }

  private aliveByTeam(): [Set<string>, Set<string>] {
    const s = this.s;
    const alive: [Set<string>, Set<string>] = [new Set(), new Set()];
    for (const p of s.roster ?? []) {
      if (p.teamIndex !== 0 && p.teamIndex !== 1) continue;
      const name = this.normalizeName(p.displayName);
      if (!s.roundDeaths.has(name)) alive[p.teamIndex].add(name);
    }
    return alive;
  }

  private refreshClutchSituations(): void {
    const s = this.s;
    if ((s.roster ?? []).length === 0) return;
    const alive = this.aliveByTeam();
    for (const team of [0, 1] as const) {
      const enemies = alive[team === 0 ? 1 : 0];
      if (alive[team].size !== 1 || enemies.size <= 1) continue;
      const playerId = [...alive[team]][0]!;
      s.clutchMax.set(playerId, Math.max(s.clutchMax.get(playerId) ?? 0, enemies.size));
    }
  }

  private roundKillsFor(name: string): number {
    return this.s.roundKills.get(this.normalizeName(name)) ?? 0;
  }

  private settle(): void {
    const s = this.s;
    if (s.gameEvent !== null && s.roundEnd !== null) return;
    const winner = this.resolveWinnerTeam();
    if (winner !== null && s.roundEnd === null) {
      // Round-end reason: spike outcome wins, then team wipe, then time expiry
      // (GEP exposes no round timer; OCR would be required for precision).
      const reason: "elimination" | "detonation" | "defusion" | "time" =
        s.spike === "detonated"
          ? "detonation"
          : s.spike === "defused"
            ? "defusion"
            : this.losersWiped(winner)
              ? "elimination"
              : "time";
      s.roundEnd = { winner: winner === 0 ? "blue" : "red", reason };
      // Stamp the settlement time — deriveScene holds the HUD (and the
      // endround banner) on screen for a grace period after this.
      s.roundEndedAt = Date.now();
      // ValoSpectra app-roundreasons parity: per-round win history for the
      // timeline strip (kills/detonated/defused/timeout icons per round).
      if (
        s.roundNumber > 0 &&
        !s.roundHistory.some((h) => h.round === s.roundNumber)
      ) {
        s.roundHistory.push({ round: s.roundNumber, winner: s.roundEnd.winner, reason });
        if (s.roundHistory.length > 24) s.roundHistory.shift();
      }
    }
    if (s.gameEvent !== null) return;
    if (winner === null) return; // keep null; a later score update retries

    const roster = s.roster ?? [];
    if (roster.length === 0) return;
    const winners = roster.filter((p) => p.teamIndex === winner);
    if (winners.length === 0) {
      s.gameEvent = "Round Win";
      return;
    }
    const aliveWinners = winners.filter(
      (p) => !s.roundDeaths.has(this.normalizeName(p.displayName)),
    );
    const losers = roster.filter((p) => p.teamIndex === (winner === 0 ? 1 : 0));

    // 1) Clutch: single survivor who was last alive vs >= 2 enemies.
    if (aliveWinners.length === 1) {
      const size = s.clutchMax.get(this.normalizeName(aliveWinners[0]!.displayName)) ?? 0;
      if (size > 1) {
        s.gameEvent = "Clutch";
        return;
      }
    }
    // 2) Ace: one winner with >= 5 round kills.
    if (winners.some((p) => this.roundKillsFor(p.displayName) >= 5)) {
      s.gameEvent = "Ace";
      return;
    }
    // 3) Team Ace: every winner got at least one kill.
    if (winners.length >= 5 && winners.every((p) => this.roundKillsFor(p.displayName) >= 1)) {
      s.gameEvent = "Team Ace";
      return;
    }
    // 4) Flawless: no winner died.
    if (winners.length > 0 && winners.every((p) => aliveWinners.includes(p))) {
      s.gameEvent = "Flawless";
      return;
    }
    // 5) Thrifty: needs loadout-credit evidence; providers without credits skip it.
    void losers;
    s.gameEvent = "Round Win";
  }

  private losersWiped(winner: 0 | 1): boolean {
    if ((this.s.roster ?? []).length === 0) return false;
    const alive = this.aliveByTeam();
    return alive[1 - winner].size === 0;
  }

  private resolveWinnerTeam(): 0 | 1 | null {
    const s = this.s;
    if (s.roundStartScore) {
      if (s.blue > s.roundStartScore.blue) return 0;
      if (s.red > s.roundStartScore.red) return 1;
    }
    if ((s.roster ?? []).length > 0) {
      const alive = this.aliveByTeam();
      if (alive[0].size > alive[1].size) return 0;
      if (alive[1].size > alive[0].size) return 1;
    }
    return null;
  }

  private build(): HudRelayState {
    const s = this.s;
    return hudRelayStateSchema.parse({
      revision: s.revision,
      connectedToRuntime: true,
      game: "VAL",
      sessionPhase: s.sessionPhase,
      matchId: s.matchId,
      mapKey: s.mapKey,
      mapName: s.mapName,
      match: { winner: s.matchWinner, mvp: this.computeMvp() },
      viewerRole: s.viewerRole,
      roster: [...(s.roster ?? [])].sort((a, b) => {
        const ta = a.teamIndex ?? 9;
        const tb = b.teamIndex ?? 9;
        if (ta !== tb) return ta - tb;
        const sa = this.rosterSeq.get(this.normalizeName(a.displayName)) ?? 999;
        const sb = this.rosterSeq.get(this.normalizeName(b.displayName)) ?? 999;
        return sa - sb;
      }),
      round: {
        number: s.roundNumber,
        phase: s.roundPhase,
        phaseStartedAt: s.phaseStartedAt,
        spikePlantedAt: s.spikePlantedAt,
      },
      score: { blue: s.blue, red: s.red },
      spike: s.spike,
      killfeed: s.killfeed,
      gameEvent: s.gameEvent,
      scene: this.deriveScene(),
      roundEnd: s.roundEnd,
      roundHistory: s.roundHistory,
      updatedAt: Date.now(),
    });
  }

  /**
   * MVP = the player (either team) with the most broadcast-round kills at match
   * end. Ties broken by fewer deaths, then assists. Only meaningful after the
   * match settles (winner known), so the site's post-game scene reads it.
   */
  private computeMvp(): { name: string; teamId: string; kills: number; deaths: number; assists: number } | null {
    const s = this.s;
    if (s.matchWinner === null) return null;
    let best: { name: string; teamId: string; kills: number; deaths: number; assists: number } | null = null;
    for (const p of s.roster ?? []) {
      const kills = p.kills ?? 0;
      if (kills <= 0) continue;
      const deaths = p.deaths ?? 0;
      const assists = p.assists ?? 0;
      if (!best || kills > best.kills || (kills === best.kills && deaths < best.deaths)) {
        best = { name: p.displayName.split("#")[0] || p.displayName, teamId: p.teamId ?? "", kills, deaths, assists };
      }
    }
    return best;
  }

  /**
   * The overlay scene the current game data implies. The website popout uses
   * this to switch scenes automatically; null keeps the URL-picked scene.
   */
  private deriveScene(): "agent-select" | "buy-round" | "ingame-hud" | "post-game" | null {
    const s = this.s;
    if (s.sessionPhase === "idle") return null;
    if (s.sessionPhase === "unknown") return null;
    // GEP round facts are the real-time truth for the current phase — they
    // override the engine snapshot's session-level phase which can be stale
    // during match transitions (pregame → live).
    if (s.roundPhase === "shopping") {
      // Round-end hold: the endround banner just played — keep the HUD scene
      // (and the banner) on screen for a grace period before switching to the
      // buy scene, matching the roundwin-box timing of VS-class overlays.
      if (s.roundEndedAt && Date.now() - s.roundEndedAt < 5500) return "ingame-hud";
      return "buy-round";
    }
    // A settled match always wins — never sit on the HUD after match point.
    if (s.matchWinner) return "post-game";
    if (s.roundPhase === "combat") return "ingame-hud";
    if (s.roundPhase === "end") return "ingame-hud";
    // No concrete round phase — use sessionPhase for match-level scenes.
    if (s.sessionPhase === "loading" || s.sessionPhase === "pregame") return "agent-select";
    if (s.sessionPhase === "ending") return "post-game";
    if (s.blue >= 13 || s.red >= 13) return "post-game";
    // Pre-round-1 of a real match: the provider emits match_id during agent
    // select while round facts have not started yet (roundPhase stays
    // "unknown"). Once the session goes LIVE the match has loaded — show the
    // buy scene immediately instead of freezing on agent-select. A nonzero
    // score/round means a mid-round reconnect: show the HUD.
    if (!s.roundPhase || s.roundPhase === "unknown") {
      if (s.blue > 0 || s.red > 0) return "ingame-hud";
      if (s.roundNumber > 0) return "ingame-hud";
      if (s.matchId || s.mapKey) return "buy-round";
      return null;
    }
    return null;
  }

  private lastLoggedScene: string | null = null;

  private emitChange(): void {
    const state = this.build();
    // Boundary telemetry: the scene-switch decision (deriveScene output).
    if (state.scene !== this.lastLoggedScene) {
      pipelineLog("scene_decision", {
        scene: state.scene,
        sessionPhase: state.sessionPhase,
        round: `${state.round.number}/${state.round.phase}`,
        score: `${state.score.blue}-${state.score.red}`,
        roster: state.roster?.length ?? 0,
      });
      this.lastLoggedScene = state.scene;
    }
    for (const fn of this.listeners) {
      try {
        fn(state);
      } catch {
        // Listener failures must never break projection bookkeeping.
      }
    }
  }
}
