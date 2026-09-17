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

import * as nodeFs from "fs";
import * as nodeOs from "os";
import * as nodePath from "path";

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
  /** Epoch ms when the session first went live — drives the round-1 buy grace. */
  liveSince: number | null;
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
  roundEnd: { winner: "blue" | "red"; reason: "elimination" | "detonation" | "defusion" | "time"; winnerSide?: "attacker" | "defender" | null } | null;
  /** The viewer's START side from the snapshot (defense/attack) — side label ground truth. */
  viewerStartSide: "attack" | "defense" | null;
  /** The viewer's side THIS round — GEP `game_info/team` ground truth ("attack"/"defense"). */
  viewerSide: "attack" | "defense" | null;
  /** Last seen GEP round_outcome {won,lost} — viewer-perspective round result. */
  roundOutcome: { won: number; lost: number } | null;
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
    liveSince: null,
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
    viewerStartSide: null,
    viewerSide: null,
    roundOutcome: null,
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

  constructor() {
    // Crash/reconnect recovery: restore the last known board so a desktop-app
    // crash or Valorant restart never blanks the overlay — restored data holds
    // until GEP's live stream refreshes it.
    this.restoreCache();
  }

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
    if (sessionPhase !== s.sessionPhase && sessionPhase === "live") s.liveSince = Date.now();
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
      s.viewerStartSide = null;
      s.viewerSide = null;
      s.roundOutcome = null;
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
    // SIDE GROUND TRUTH: the upstream snapshot carries each team's starting
    // side (defense/attack). Find the viewer's team by player name and record
    // their START side — this replaces the inverted parity heuristic for the
    // ATTACKER WIN/DEFENDER WIN label (the user's matches start on defense,
    // so the assumption "team_0 attacks rounds 1-12" was inverted 100% of
    // the time for them).
    if (teams && teams.length > 0 && s.viewerName) {
      const vName = s.viewerName.split("#")[0].trim().toLowerCase();
      for (const team of teams) {
        const players = Array.isArray(team.players) ? team.players : [];
        const isViewersTeam = players.some((p: any) => {
          const pn = p?.player?.identity?.displayName ?? p?.player?.name?.gameName ?? p?.player?.name?.displayName ?? p?.player?.puuid ?? "";
          return String(pn).split("#")[0].trim().toLowerCase() === vName;
        });
        if (isViewersTeam && team.startingSide != null) {
          s.viewerStartSide = team.startingSide;
          break;
        }
      }
    }
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
        // Agent-select cache gate: suppress stale agent evidence while it is
        // active (see agentGateUntil).
        const agentGate = this.agentGateUntil > Date.now();
        return team.players.map((p) => ({
          displayName:
            p.player.name?.displayName ??
            p.player.identity?.displayName ??
            p.player.identity?.gameName ??
            p.player.puuid ??
            "?",
          agentName: agentGate ? null : (p.agent?.name ?? null),
          agentIcon: agentGate ? null : (p.agent?.riotId ? agentIconUrl(p.agent.riotId) ?? null : undefined),
          agentKey: agentGate ? undefined : (p.agent?.key ?? undefined),
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
          shield: p.player.shield ?? undefined,
          shieldType: p.player.shieldType ?? undefined,
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
          const t0 = Number(rec?.team_0);
          const t1 = Number(rec?.team_1);
          if (Number.isFinite(t0) && Number.isFinite(t1)) {
            // GEP score contract (verified against the user's own provider log:
            // won r1 -> {team_0:0, team_1:1}; lost r2 -> {1,1}; won r3 -> {1,2}
            // with round_outcome {won,lost} as the viewer's cumulative W/L):
            // team_1 = LOCAL PLAYER'S score, team_0 = enemy. The roster is
            // anchored with the viewer on blue/left, so blue = team_1 ALWAYS.
            // (The previous anchor remap AND a direct blue=t0 both flipped —
            // randomly, per emission form.)
            s.blue = t1;
            s.red = t0;
          } else return;
        } else if (rec?.won !== undefined || rec?.lost !== undefined) {
          viewerScore = Number(rec?.won);
          enemyScore = Number(rec?.lost);
          if (!Number.isFinite(viewerScore) || !Number.isFinite(enemyScore)) return;
          // {won,lost} is the VIEWER's cumulative round record and the engine
          // anchors the viewer to blue/left — no team-index lookup needed.
          // (The old viewerTeamIndex() call could return the GEP-absolute
          // team number and misattribute the score.)
          s.blue = viewerScore;
          s.red = enemyScore;
        } else return;
        // Match won: first to 13 WITH a 2-round lead — the bare >=13 check
        // fired post-game mid-OVERTIME (13-12 is not a finished match).
        if (s.blue >= 13 && s.blue - s.red >= 2) s.matchWinner = "blue";
        else if (s.red >= 13 && s.red - s.blue >= 2) s.matchWinner = "red";
        // The engine delivers match_score AFTER round_phase:end - settle now
        // so the round winner/reason is never lost to the shopping wipe.
        if (s.roundPhase === "end" && s.gameEvent === null) this.settle();
        break;
      }
      case "round_outcome": {
        // GEP's AUTHORITATIVE round result: {won, lost} is the VIEWER's
        // cumulative round record (verified against the provider log:
        // match_score {team_0:0,team_1:1} ↔ round_outcome {won:1}). An
        // increment is the ground-truth winner — no score-delta or
        // alive-count guessing. The viewer is ALWAYS blue (engine anchors
        // the roster viewer-left), so the result maps straight through.
        const rec = value as { won?: unknown; lost?: unknown };
        const won = Number(rec?.won);
        const lost = Number(rec?.lost);
        if (!Number.isFinite(won) || !Number.isFinite(lost)) return;
        const prev = s.roundOutcome;
        if (prev && (won > prev.won || lost > prev.lost)) {
          this.recordRoundWinner(won > prev.won ? "blue" : "red", null);
        }
        s.roundOutcome = { won, lost };
        break;
      }
      case "round_number": {
        const n = Number(value);
        if (!Number.isFinite(n)) return;
        // Fresh-match detection: GEP frequently keeps the SAME match_id across
        // games, so the match_id-change wipe never fired and the previous
        // game's score/KD/round history bled into the next one. Round 1
        // arriving while a previous match was already tracked means a new
        // game started — clear its state now (roster identities + team
        // anchoring are kept; stats repopulate from the next scoreboard).
        if (
          n === 1 &&
          (s.publishedNumber > 1 || s.roundNumber > 1 || s.matchWinner !== null || s.roundHistory.length > 0)
        ) {
          s.blue = 0;
          s.red = 0;
          s.roundNumber = 0;
          s.roundPhase = "unknown";
          s.publishedNumber = 0;
          s.publishedPhase = null;
          s.pendingPhase = null;
          s.roundHistory = [];
          s.roundEnd = null;
          s.gameEvent = null;
          s.matchWinner = null;
          s.matchMvp = null;
          s.roundEndedAt = null;
          s.spike = null;
          s.spikePlantedAt = null;
          s.killfeed = [];
          s.roundKills.clear();
          s.roundDeaths.clear();
          s.clutchMax.clear();
          s.roundStartScore = null;
          for (const p of s.roster ?? []) {
            p.kills = null;
            p.deaths = null;
            p.assists = null;
            p.credits = null;
            p.spentCredits = null;
            p.shield = null;
            p.shieldType = null;
            p.weapon = null;
            p.health = 100;
            p.isAlive = true;
            p.ultPoints = null;
            p.ultMax = null;
            p.hasSpike = null;
            // Agent evidence is per-match too — stale agentKey/agentIcon from
            // the previous game made the buy-round cards show wrong/duplicated
            // agent icons until GEP re-reports the roster.
            p.agentKey = undefined;
            p.agentIcon = null;
            p.agentName = null;
            // Ability charges are per-round too — stale {C,Q,E,X} from the
            // previous game made every skill icon render as bought/available.
            p.abilityState = undefined;
            p.abilities = undefined;
          }
          this.diedLastRound.clear();
          this.clearCache();
        }
        s.roundNumber = n;
        if (s.pendingPhase !== null && n > s.publishedNumber) this.publishRound();
        break;
      }
      case "round_settled": {
        // GROUND TRUTH from the runtime's ValRoundEngine (round_settled event):
        // the winner's GEP start team + the winning SIDE (attacker/defender).
        // This replaces every heuristic — score deltas, alive counts, parity.
        const rec = value as {
          roundNumber?: unknown;
          winnerStartTeam?: unknown;
          winningSide?: unknown;
          winningReason?: unknown;
          winType?: unknown;
          winTypeLabel?: unknown;
        };
        const winnerStart = Number(rec?.winnerStartTeam);
        const rn = Number(rec?.roundNumber);
        const reasonRaw = String(rec?.winningReason ?? "").toLowerCase();
        const reason: "elimination" | "detonation" | "defusion" | "time" =
          reasonRaw.includes("defus") ? "defusion"
          : reasonRaw.includes("detonat") ? "detonation"
          : reasonRaw.includes("eliminat") ? "elimination"
          : reasonRaw.includes("time") ? "time"
          : "elimination";
        // Winner → blue iff its start team matches the viewer's GEP team
        // (fallback: GEP team 1 = the viewer, proven by the provider log's
        // match_score↔round_outcome correlation).
        const winner: "blue" | "red" | null =
          !Number.isFinite(winnerStart) ? null
          : winnerStart === (s.viewerGepTeam ?? 1) ? "blue" : "red";
        const sideRaw = String(rec?.winningSide ?? "").toLowerCase();
        const winnerSide: "attacker" | "defender" | null =
          sideRaw.includes("attack") ? "attacker"
          : sideRaw.includes("defen") ? "defender"
          : null;
        if (winner) {
          this.recordRoundWinner(winner, reason, winnerSide, Number.isFinite(rn) && rn > 0 ? rn : undefined);
          // Special ceremony labels only from the engine's winType — never
          // invent one (winType: Eliminated/Defuse/Detonate/... from ValRoundEngine).
          const wt = String(rec?.winType ?? "").toLowerCase();
          const label =
            wt.includes("clutch") ? "Clutch"
            : wt.includes("ace") && wt.includes("team") ? "Team Ace"
            : wt === "ace" || wt.includes("ace") ? "Ace"
            : wt.includes("flawless") ? "Flawless"
            : wt.includes("thrifty") ? "Thrifty"
            : null;
          if (label) s.gameEvent = label;
        }
        s.revision += 1;
        this.emitChange();
        return; // fully handled
      }
      case "round_phase": {
        if (typeof value !== "string") return;
        // GEP signals the END OF THE MATCH with phase "game_end" (VS parity).
        // It must never enter the round-phase state machine — settle the
        // match, flip to post-game and stop.
        if (value === "game_end") {
          s.sessionPhase = "ending";
          if (s.matchWinner === null && (s.blue > 0 || s.red > 0)) {
            s.matchWinner = s.blue >= s.red ? "blue" : "red";
          }
          this.settle();
          s.revision += 1;
          this.emitChange();
          return;
        }
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
          const roster = s.roster ?? [];
          // Exact normalized match FIRST; containment fuzzy matching only
          // when it is UNIQUE — ambiguous partial names killed the wrong
          // player, which corrupted alive counts and then the winner
          // fallback ("sometimes correct, sometimes wrong").
          const exact = roster.filter(
            (p) => this.normalizeName(p.displayName) === vKey,
          );
          const fuzzy =
            exact.length > 0
              ? []
              : roster.filter((p) => {
                  const pn = this.normalizeName(p.displayName);
                  return pn.length > 3 && vKey.length > 3 && (pn.includes(vKey) || vKey.includes(pn));
                });
          const matches = exact.length > 0 ? exact : fuzzy.length === 1 ? fuzzy : [];
          for (const p of matches) {
            p.isAlive = false;
            p.health = 0;
            p.deaths = (p.deaths ?? 0) + 1;
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
        // winner from the score if the end-phase classification has not yet —
        // custom games end below 13 rounds, so the leader wins on evidence.
        if (s.matchWinner === null && (s.blue >= 13 || s.red >= 13)) {
          s.matchWinner = s.blue >= s.red ? "blue" : "red";
        }
        if (s.matchWinner === null && (s.blue > 0 || s.red > 0 || s.roundNumber > 0)) {
          s.matchWinner = s.blue >= s.red ? "blue" : "red";
        }
        s.sessionPhase = "ending";
        if (s.roundPhase === "end" || s.sessionPhase === "ending") this.settle();
        s.revision += 1;
        this.emitChange();
        return; // already emitted
      }
      case "scene": {
        const sc = String(value ?? "").toLowerCase().replace(/_/g, "-");
        if (sc === "agent-select" || sc === "character-select" || sc === "lobby" || sc === "pregame") {
          if (s.sessionPhase !== "pregame") {
            this.agentGateUntil = Date.now() + 3000;
            for (const p of s.roster ?? []) {
              p.agentKey = undefined;
              p.agentIcon = null;
              p.agentName = null;
            }
          }
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
            // side flip or squad re-index). Hysteresis: only commit the
            // re-anchor once the new team has been reported consistently for
            // 1.5s — alternating team facts used to re-side the whole board
            // on every cycle ("score switches to the other team and back").
            if (this.pendingAnchorTeam === gepTeam && Date.now() - this.pendingAnchorSince > 1500) {
              this.pendingAnchorTeam = null;
              s.viewerGepTeam = gepTeam;
              this.reSideRoster();
            } else if (this.pendingAnchorTeam !== gepTeam) {
              this.pendingAnchorTeam = gepTeam;
              this.pendingAnchorSince = Date.now();
            }
          } else {
            this.pendingAnchorTeam = null;
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
            // Tier-aware shield: GEP armor is the tier enum 0-4, never points.
            shield:
              (() => {
                const v = num(rec.shield ?? rec.armor ?? rec.initialArmor);
                if (v === undefined) return null;
                if (v === 25 || v === 50) return v;
                if (Number.isInteger(v) && v >= 0 && v <= 4) return [0, 25, 50, 50, 25][v];
                return null;
              })(),
            shieldType:
              (() => {
                const t = num(rec.shieldType ?? rec.armor ?? rec.initialArmor);
                return t !== undefined && Number.isInteger(t) && t >= 0 && t <= 4 ? t : null;
              })(),
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
        if (Date.now() >= this.agentGateUntil) {
          entry.agentName = agentDisplayName(agentInternal) ?? entry.agentName ?? null;
          entry.agentKey =
            typeof agentInternal === "string" && agentInternal.length > 0
              ? agentInternal.toLowerCase().replace(/_pc(_c)?$/i, "")
              : (entry.agentKey ?? undefined);
          entry.agentIcon =
            agentIconUrl(agentInternal) ?? agentIconUrl(rec.agentUuid) ?? entry.agentIcon ?? null;
        }
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
        // Shield: GEP's armor field is the TIER enum (0 none / 1 light / 2
        // heavy / 3 enemy-unknown / 4 regen) — the VS-family dialect sends it
        // as initialArmor, the fork engine as shield+shieldType. Treating a
        // raw tier as POINTS made every shield render light (tiers are 0-4).
        const shieldPointsFromTier = (v: number | undefined): number | undefined => {
          if (v === undefined || v === null || !Number.isFinite(v)) return undefined;
          if (v === 25 || v === 50) return v; // already points
          if (Number.isInteger(v) && v >= 0 && v <= 4) return [0, 25, 50, 50, 25][v];
          return undefined;
        };
        const tierFrom = (v: unknown): number | undefined => {
          const n = num(v);
          return n !== undefined && Number.isInteger(n) && n >= 0 && n <= 4 ? n : undefined;
        };
        const shieldTier =
          tierFrom(rec.shieldType) ??
          tierFrom(rec.armor) ??
          tierFrom(rec.initialArmor) ??
          (entry.shieldType ?? undefined);
        const shieldPts =
          shieldPointsFromTier(num(rec.shield)) ??
          shieldPointsFromTier(shieldTier) ??
          shieldPointsFromTier(num(rec.armor)) ??
          shieldPointsFromTier(num(rec.initialArmor));
        entry.shield = shieldPts ?? entry.shield ?? null;
        entry.shieldType = shieldTier ?? (entry.shield != null ? (entry.shield >= 50 ? 2 : entry.shield > 0 ? 1 : 0) : null);
        entry.kills = num(rec.kills) ?? entry.kills ?? null;
        entry.deaths = num(rec.deaths) ?? entry.deaths ?? null;
        entry.assists = num(rec.assists) ?? entry.assists ?? null;
        // Buy phase: everyone is alive by definition. Ignore stale death
        // evidence that can trail the round reset (greyed-out card bug).
        const shopping = s.roundPhase === "shopping";
        const aliveEvidence =
          typeof rec.alive === "boolean" ? rec.alive : typeof rec.isAlive === "boolean" ? rec.isAlive : undefined;
        if (aliveEvidence !== undefined) {
          if (shopping) {
            entry.isAlive = true;
            entry.health = 100;
          } else {
            entry.isAlive = aliveEvidence;
            if (!aliveEvidence) {
              entry.health = 0;
              this.diedLastRound.add(this.normalizeName(name));
            }
          }
        }
        // Health is applied AFTER the alive flag: a positive health reading is
        // definitive alive evidence and rescues a wounded player whose GEP
        // alive flag trailed the damage packet (the "damage -> death state"
        // bug). Only explicit dead evidence may mark a death.
        const hRaw = num(rec.health);
        if (hRaw !== undefined) {
          entry.health = shopping ? Math.max(100, hRaw) : hRaw;
          if (hRaw > 0) entry.isAlive = true;
          else if (!shopping && aliveEvidence === false) entry.isAlive = false;
        }
        entry.ultPoints =
          num(rec.ultPoints ?? rec.ult_points ?? rec.currUltPoints) ?? entry.ultPoints ?? null;
        entry.ultMax = num(rec.ultMax ?? rec.ult_max ?? rec.maxUltPoints) ?? entry.ultMax ?? null;
        if (typeof rec.hasSpike === "boolean") entry.hasSpike = rec.hasSpike;
        else if (typeof rec.spike === "boolean") entry.hasSpike = rec.spike;
        if (Array.isArray(rec.abilities)) {
          entry.abilities = rec.abilities.filter((a): a is string => typeof a === "string");
        }
        break;
      }
      case "abilities": {
        // GEP emits the LOCAL player's ability charges. Values arrive as 0/1
        // NUMBERS (provider log: {C:0,Q:0,E:1,X:0}), real booleans, or "0"/"1"
        // strings depending on the dialect — normalize all of them safely.
        const asBool = (v: unknown): boolean =>
          v === true || v === 1 || v === "1" || v === "true";
        const rec = value as Record<string, unknown>;
        const local = (s.roster ?? []).find(
          (p) =>
            s.viewerName != null &&
            this.normalizeName(p.displayName) === this.normalizeName(s.viewerName),
        );
        if (local) {
          local.abilityState = {
            C: asBool(rec?.C),
            Q: asBool(rec?.Q),
            E: asBool(rec?.E),
            X: asBool(rec?.X),
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
    // Win-by-2: a bare >=13 fired post-game mid-OVERTIME (13-12 is not over).
    if (blue >= 13 && blue - red >= 2) s.matchWinner = "blue";
    else if (red >= 13 && red - blue >= 2) s.matchWinner = "red";
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
        // Per-round buy hygiene: players who DIED last round respawn WITHOUT
        // gun+shield (Valorant rules) — without this the buy-round cards kept
        // showing a dead player's old Vandal ("gun doesn't update"). Spent
        // credits and ability charges ALWAYS reset — stale values made every
        // fresh-game round-1 card render in the already-bought state.
        if (this.diedLastRound.has(this.normalizeName(p.displayName))) {
          p.weapon = null;
          p.shield = null;
          p.shieldType = 0;
        }
        p.spentCredits = null;
        p.abilityState = undefined;
        p.abilities = undefined;
      }
      this.diedLastRound.clear();
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

  // Agent-select cache gate: when the session enters pregame (agent select),
  // the GEP scoreboard cache still re-reports the PREVIOUS game's agents for
  // players who haven't locked in — portraits would render as if already
  // selected. Stored agents are cleared and character evidence is ignored for
  // a short cache-flush window; locked-in players re-report after it.
  private agentGateUntil = 0;
  // Players observed dead this round — they respawn at the next buy phase
  // WITHOUT their gun+shield (Valorant rules); tracked so the buy-round cards
  // stop showing a dead player's old Vandal ("gun doesn't update").
  private diedLastRound = new Set<string>();
  // Anchor hysteresis: GEP's team field can alternate between facts; only a
  // team value that persists commits a re-anchor (stops scoreline side swaps).
  private pendingAnchorTeam: number | null = null;
  private pendingAnchorSince = 0;

  private reSideRoster(): void {
    const s = this.s;
    for (const p of s.roster ?? []) {
      const gt = this.lastGepTeam.get(this.normalizeName(p.displayName));
      if (gt != null) {
        p.teamIndex = gt === s.viewerGepTeam ? 0 : 1;
        p.teamId = p.teamIndex === 0 ? "Blue" : "Red";
      }
    }
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
        this.diedLastRound.add(pName);
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

  /** The viewer's side for a given round, derived from the snapshot's start side. */
  /** Side of the WINNING team for the round — from the snapshot's start side. */
  private winnerSideFor(winner: 0 | 1, round: number): "attacker" | "defender" | null {
    // TEAM INDEX IS NOT A SIDE. The engine anchors the viewer to blue/left
    // for the whole match, so "viewer won" is simply winner === 0 — deriving
    // it from viewerStartSide (the old viewerTeamIsTeam0 conflation) inverted
    // the win side for every match where the viewer started on defense.
    const viewerWon = winner === 0;
    const viewerSide = this.viewerSideForRound(round);
    if (!viewerSide) return null;
    const side = viewerWon ? viewerSide : viewerSide === "attack" ? "defense" : "attack";
    return side === "attack" ? "attacker" : "defender";
  }

  private viewerSideForRound(round: number): "attack" | "defense" | null {
    const s = this.s;
    if (!s.viewerStartSide) return null;
    // The viewer's side for a round: their START side for rounds 1-12, the
    // opposite side for rounds 13-24, alternating per OT round after that.
    if (round > 24) {
      const half2: "attack" | "defense" = s.viewerStartSide === "attack" ? "defense" : "attack";
      return (round - 25) % 2 === 0 ? half2 : half2 === "attack" ? "defense" : "attack";
    }
    if (round > 12) return s.viewerStartSide === "attack" ? "defense" : "attack";
    return s.viewerStartSide;
  }

  private settle(): void {
    const s = this.s;
    if (s.gameEvent !== null && s.roundEnd !== null) return;
    const winner = this.resolveWinnerTeam();
    if (winner !== null && s.roundEnd === null) {
      // LAST-resort path: the authoritative round_outcome transition and the
      // runtime's round_settled event both funnel through the same recorder.
      this.recordRoundWinner(winner === 0 ? "blue" : "red", null);
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
    // Ceremony classification needs a FULL board — with GEP rosters partially
    // populated, alive counts were garbage and CLUTCH/FLAWLESS fired randomly
    // on incomplete teams ("game event roundwinreason are complete random").
    const fullBoard = winners.length === 5 && losers.length === 5;

    // 1) Clutch: single survivor who was last alive vs >= 2 enemies.
    if (fullBoard && aliveWinners.length === 1) {
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
    // 4) Flawless: no winner died (full board only — same garbage-alive guard).
    if (fullBoard && winners.length > 0 && winners.every((p) => aliveWinners.includes(p))) {
      s.gameEvent = "Flawless";
      return;
    }
    // 5) Thrifty: needs loadout-credit evidence; providers without credits skip it.
    void losers;
    s.gameEvent = "Round Win";
  }

  private losersWiped(winner: 0 | 1): boolean {
    const roster = this.s.roster ?? [];
    if (roster.length === 0) return false;
    // The roster's isAlive persists through the buy-phase wipe (roundDeaths is
    // cleared there) — late score-fact settlements still see the real wipe.
    return !roster.some(
      (p) => p.teamIndex === (1 - winner) && p.isAlive !== false,
    );
  }

  /**
   * THE authoritative round-settlement stamp. Every winner source funnels
   * through here — the GEP round_outcome transition, the runtime's
   * round_settled event, then the settle() heuristic — so the engine emits
   * exactly ONE roundEnd result per round (single source of truth).
   */
  private recordRoundWinner(
    winner: "blue" | "red",
    explicitReason: "elimination" | "detonation" | "defusion" | "time" | null,
    winnerSide?: "attacker" | "defender" | null,
    roundOverride?: number,
  ): void {
    const s = this.s;
    if (s.roundEnd !== null && s.roundEnd.winner === winner) return; // already settled this round
    const round = roundOverride ?? s.roundNumber;
    // Reason priority: explicit (runtime ground truth) → spike outcome →
    // elimination (the neutral default — timeout.webp is NEVER guessed).
    const reason =
      explicitReason ??
      (s.spike === "detonated"
        ? "detonation"
        : s.spike === "defused"
          ? "defusion"
          : "elimination");
    s.roundEnd = {
      winner,
      reason,
      winnerSide: winnerSide ?? this.winnerSideFor(winner === "blue" ? 0 : 1, round),
    };
    // Stamp the settlement time — deriveScene holds the HUD (and the
    // endround banner) on screen for a grace period after this.
    s.roundEndedAt = Date.now();
    // ValoSpectra app-roundreasons parity: per-round win history for the
    // timeline strip (kills/detonated/defused/timeout icons per round).
    if (round > 0 && !s.roundHistory.some((h) => h.round === round)) {
      s.roundHistory.push({ round, winner, reason });
      if (s.roundHistory.length > 24) s.roundHistory.shift();
    }
  }

  private resolveWinnerTeam(): 0 | 1 | null {
    const s = this.s;
    if (s.roundStartScore) {
      if (s.blue > s.roundStartScore.blue) return 0;
      if (s.red > s.roundStartScore.red) return 1;
    }
    if ((s.roster ?? []).length > 0) {
      const alive = this.aliveByTeam();
      // Only trust alive counts on a FULL 5v5 board — partial GEP rosters
      // made garbage alive counts decide winners randomly.
      const t0 = (s.roster ?? []).filter((p) => p.teamIndex === 0).length;
      const t1 = (s.roster ?? []).filter((p) => p.teamIndex === 1).length;
      if (t0 === 5 && t1 === 5) {
        if (alive[0].size > alive[1].size) return 0;
        if (alive[1].size > alive[0].size) return 1;
      }
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
    if (s.roundPhase === "combat") {
      // Match-start grace: some GEP cycles skip the round-1 shopping phase and
      // jump straight to combat right after agent select. Hold the buy scene
      // briefly after the match loads so the buy phase still plays before the
      // HUD (ValoSpectra parity).
      if (
        s.liveSince !== null &&
        Date.now() - s.liveSince < 8000 &&
        s.roundNumber <= 1 &&
        s.blue === 0 &&
        s.red === 0
      ) {
        return "buy-round";
      }
      return "ingame-hud";
    }
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

  // --- Crash/reconnect cache (disk mirror of the live board) ---------------
  private static readonly CACHE_FILE = nodePath.join(nodeOs.tmpdir(), "havoc-unleash-last-state.json");
  private lastCacheWrite = 0;

  private saveCache(): void {
    const now = Date.now();
    if (now - this.lastCacheWrite < 4000) return; // throttle
    this.lastCacheWrite = now;
    try {
      const s = this.s;
      const payload = {
        savedAt: now,
        matchId: s.matchId,
        mapKey: s.mapKey,
        mapName: s.mapName,
        viewerName: s.viewerName,
        viewerGepTeam: s.viewerGepTeam,
        blue: s.blue,
        red: s.red,
        roundNumber: s.roundNumber,
        roundPhase: s.roundPhase,
        gameEvent: s.gameEvent,
        roundEnd: s.roundEnd,
        matchWinner: s.matchWinner,
        roundHistory: s.roundHistory,
        roundStartScore: s.roundStartScore,
        roster: (s.roster ?? []).map((p) => ({
          displayName: p.displayName,
          teamIndex: p.teamIndex,
          teamId: p.teamId,
          agentKey: p.agentKey,
          agentName: p.agentName,
          kills: p.kills,
          deaths: p.deaths,
          assists: p.assists,
          credits: p.credits,
          weapon: p.weapon,
          shield: p.shield,
          shieldType: p.shieldType,
        })),
      };
      nodeFs.writeFileSync(ValProjectionSession.CACHE_FILE, JSON.stringify(payload), "utf8");
    } catch {
      // best-effort — a cache failure must never affect the live projection
    }
  }

  private restoreCache(): void {
    try {
      if (!nodeFs.existsSync(ValProjectionSession.CACHE_FILE)) return;
      const raw = JSON.parse(nodeFs.readFileSync(ValProjectionSession.CACHE_FILE, "utf8"));
      const age = Date.now() - Number(raw?.savedAt ?? 0);
      if (!Number.isFinite(age) || age > 2 * 60 * 60 * 1000) return; // stale — discard
      const s = this.s;
      if (typeof raw.viewerName === "string") s.viewerName = raw.viewerName;
      if (typeof raw.viewerGepTeam === "number") s.viewerGepTeam = raw.viewerGepTeam;
      if (typeof raw.blue === "number") s.blue = raw.blue;
      if (typeof raw.red === "number") s.red = raw.red;
      if (typeof raw.roundNumber === "number") {
        s.roundNumber = raw.roundNumber;
        s.publishedNumber = raw.roundNumber;
      }
      if (typeof raw.roundPhase === "string") {
        s.roundPhase = raw.roundPhase;
        s.publishedPhase = raw.roundPhase;
      }
      if (typeof raw.gameEvent === "string") s.gameEvent = raw.gameEvent;
      if (raw.roundEnd) s.roundEnd = raw.roundEnd;
      if (raw.matchWinner) s.matchWinner = raw.matchWinner;
      if (Array.isArray(raw.roundHistory)) s.roundHistory = raw.roundHistory;
      if (raw.roundStartScore) s.roundStartScore = raw.roundStartScore;
      if (typeof raw.mapName === "string") s.mapName = raw.mapName;
      if (typeof raw.mapKey === "string") s.mapKey = raw.mapKey;
      if (Array.isArray(raw.roster)) {
        s.roster = raw.roster.map(
          (p: Record<string, unknown>, idx: number) =>
            ({
              displayName: String(p?.displayName ?? `Player ${idx + 1}`),
              teamId: (p?.teamId as string) ?? (p?.teamIndex === 1 ? "Red" : "Blue"),
              teamIndex: (p?.teamIndex as number) ?? (idx < 5 ? 0 : 1),
              agentKey: (p?.agentKey as string) ?? undefined,
              agentName: (p?.agentName as string) ?? null,
              kills: (p?.kills as number) ?? null,
              deaths: (p?.deaths as number) ?? null,
              assists: (p?.assists as number) ?? null,
              credits: (p?.credits as number) ?? null,
              weapon: (p?.weapon as string) ?? null,
              shield: (p?.shield as number) ?? null,
              shieldType: (p?.shieldType as number) ?? null,
              health: 100,
              isAlive: true,
            }),
        ) as HudRelayState["roster"];
      }
      s.sessionPhase = "live";
      s.liveSince = Date.now();
      s.revision += 1;
    } catch {
      // corrupted cache — start clean
    }
  }

  private clearCache(): void {
    try {
      nodeFs.unlinkSync(ValProjectionSession.CACHE_FILE);
    } catch {
      // already gone
    }
  }

  private emitChange(): void {
    this.saveCache();
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
