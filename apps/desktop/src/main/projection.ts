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

const PHASE_ORDER: Record<string, number> = { shopping: 0, combat: 1, end: 2 };

/** Pipeline telemetry — enabled with HAVOC_DEBUG_PIPELINE=1 (no secrets). */
function pipelineLog(event: string, data: Record<string, unknown>): void {
  if (process.env.HAVOC_DEBUG_PIPELINE === "1") {
    console.log("[pipeline:projection]", event, JSON.stringify(data));
  }
}

interface WorkingState {
  revision: number;
  sessionPhase: "idle" | "loading" | "live" | "pregame";
  matchId: string | null;
  mapKey: string | null;
  mapName: string | null;
  roundNumber: number;
  roundPhase: "shopping" | "combat" | "end" | "unknown";
  phaseStartedAt: number | null;
  pendingPhase: string | null;
  publishedNumber: number;
  publishedPhase: string | null;
  blue: number;
  red: number;
  spike: HudRelayState["spike"];
  killfeed: KillfeedEntry[];
  viewerRole: "player" | "spectator" | "unknown";
  roster: HudRelayState["roster"];
  // --- Round-settlement classification (ported from upstream val-round-settlement) ---
  gameEvent: string | null;
  roundKills: Map<string, number>;
  roundDeaths: Set<string>;
  clutchMax: Map<string, number>;
  roundStartScore: { blue: number; red: number } | null;
  matchWinner: "blue" | "red" | null;
  matchMvp: { name: string; teamId: string; kills: number; deaths: number; assists: number } | null;
  roundEnd: { winner: "blue" | "red"; reason: "elimination" | "detonation" | "defusion" | "time" } | null;
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
    matchWinner: null,
    matchMvp: null,
    roundEnd: null,
  };
}

export class ValProjectionSession {
  private s = initial();
  private killSeq = 1;
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
    if ((s.matchId ?? null) !== matchId) {
      // New match => clear the previous match's post-game result.
      s.matchId = matchId;
      s.matchWinner = null;
      s.matchMvp = null;
    }
    const MAP_NAMES: Record<string, string> = {
      // Canonical keys (formatMapKey output) -> display names. Codename
      // aliases included so a stale codename key still resolves.
      ascent: "Ascent", bind: "Bind", haven: "Haven", split: "Split", breeze: "Breeze",
      icebox: "Icebox", pearl: "Pearl", fracture: "Fracture", lotus: "Lotus", sunset: "Sunset",
      abyss: "Abyss", drift: "Drift", piazza: "Piazza", kasbah: "Kasbah", sunset2: "Sunset",
      "ascent-2": "Ascent", glaze: "Glitch", district: "District", summit: "Summit",
      infinity: "Abyss", bonsai: "Split", corrode: "Corrode", range: "The Range",
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
    }
    if (snap.viewer?.role) s.viewerRole = snap.viewer.role;
    else if (snap.session?.viewer?.role) s.viewerRole = snap.session.viewer.role;
    const teams = snap.teams ?? snap.session?.teams;
    if (teams) {
      s.roster = teams.flatMap((team) =>
        team.players.map((p) => ({
          displayName:
            p.player.name?.displayName ??
            p.player.identity?.displayName ??
            p.player.identity?.gameName ??
            p.player.puuid ??
            "?",
          agentName: p.agent?.name ?? null,
          teamId: team.teamId as string,
          teamIndex: p.teamIndex ?? undefined,
          slot: p.observerSlot ?? undefined,
        })),
      );
    } else if (s.sessionPhase === "idle") s.roster = [];
    this.emitChange();
  }

  public applyFact(key: string, value: unknown): void {
    const s = this.s;
    switch (key) {
      case "match_score": {
        const rec = value as { team_0?: unknown; team_1?: unknown };
        if (typeof rec?.team_0 === "number" && typeof rec?.team_1 === "number") {
          s.blue = rec.team_0;
          s.red = rec.team_1;
        } else return;
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
        s.killfeed.unshift({
          seq: this.killSeq++,
          attacker: rec.attacker,
          victim: rec.victim,
          weapon: typeof rec.weapon === "string" ? rec.weapon : "",
          modifier: typeof rec.modifier === "string" ? rec.modifier : null,
          at: Date.now(),
        });
        s.killfeed = s.killfeed.slice(0, 25);
        this.trackRoundKill(rec.attacker, rec.victim);
        break;
      }
      case "spike_planted":
        s.spike = "planted";
        break;
      case "spike_defused":
        s.spike = "defused";
        break;
      case "spike_detonated":
        s.spike = "detonated";
        break;
      case "scoreboard": {
        // Per-player detail observation (weapon/credits/ults/scoreline) from
        // the provider; merged into the matching roster entry by name.
        const rec = value as Record<string, unknown>;
        const name = typeof rec?.name === "string" ? rec.name : null;
        if (!name) return;
        const entry = (s.roster ?? []).find(
          (p) => this.normalizeName(p.displayName) === this.normalizeName(name),
        );
        if (!entry) return;
        const num = (v: unknown): number | undefined =>
          typeof v === "number" && Number.isFinite(v) ? v : undefined;
        const str = (v: unknown): string | undefined =>
          typeof v === "string" && v.length > 0 ? v : undefined;
        entry.weapon = str(rec.weapon ?? rec.weaponName) ?? entry.weapon ?? null;
        entry.credits = num(rec.credits ?? rec.money) ?? entry.credits ?? null;
        entry.spentCredits = num(rec.spentCredits ?? rec.spent) ?? entry.spentCredits ?? null;
        entry.kills = num(rec.kills) ?? entry.kills ?? null;
        entry.deaths = num(rec.deaths) ?? entry.deaths ?? null;
        entry.assists = num(rec.assists) ?? entry.assists ?? null;
        entry.health = num(rec.health) ?? entry.health ?? null;
        entry.ultPoints = num(rec.ultPoints) ?? entry.ultPoints ?? null;
        entry.ultMax = num(rec.ultMax) ?? entry.ultMax ?? null;
        if (typeof rec.alive === "boolean") entry.isAlive = rec.alive;
        else if (typeof rec.isAlive === "boolean") entry.isAlive = rec.isAlive;
        if (typeof rec.hasSpike === "boolean") entry.hasSpike = rec.hasSpike;
        if (Array.isArray(rec.abilities)) {
          entry.abilities = rec.abilities.filter((a): a is string => typeof a === "string");
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
    if (s.roundNumber <= 0) return true;
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
    s.publishedNumber = s.roundNumber;
    s.publishedPhase = phase;
    s.pendingPhase = null;

    if (phase === "shopping") {
      // New round: wipe per-round evidence, the banner and the round-end marker.
      s.gameEvent = null;
      s.roundEnd = null;
      s.spike = null;
      s.roundKills.clear();
      s.roundDeaths.clear();
      s.clutchMax.clear();
      s.roundStartScore = { blue: s.blue, red: s.red };
    } else if (phase === "end") {
      this.settle();
    }
  }

  /* --------------------- round-settlement classification --------------------- */
  /* Ported from upstream `val-round-settlement.ts` attribution(): priority
   * Clutch -> Ace (>=5 round kills) -> Team Ace (every winner >=1 kill) ->
   * Flawless (no winner died) -> Thrifty (loadout avg +2000; needs credit
   * evidence, otherwise skipped) -> Normal ("Round Win"). */

  private normalizeName(name: string): string {
    return name.split("#")[0]!.trim().toLowerCase();
  }

  private trackRoundKill(attacker: string, victim: string): void {
    const s = this.s;
    if (s.roundPhase !== "combat" && s.roundPhase !== "unknown") return;
    const aKey = this.normalizeName(attacker);
    s.roundKills.set(aKey, (s.roundKills.get(aKey) ?? 0) + 1);
    s.roundDeaths.add(this.normalizeName(victim));
    this.refreshClutchSituations();
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
      roster: s.roster ?? [],
      round: { number: s.roundNumber, phase: s.roundPhase, phaseStartedAt: s.phaseStartedAt },
      score: { blue: s.blue, red: s.red },
      spike: s.spike,
      killfeed: s.killfeed,
      gameEvent: s.gameEvent,
      scene: this.deriveScene(),
      roundEnd: s.roundEnd,
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
    if (s.sessionPhase === "loading" || s.sessionPhase === "pregame") return "agent-select";
    if (s.blue >= 13 || s.red >= 13) return "post-game";
    if (s.roundPhase === "shopping") return "buy-round";
    if (s.roundPhase === "combat" || s.roundPhase === "end") return "ingame-hud";
    // Pre-round-1 of a real match: the provider emits match_id during agent
    // select while round facts have not started yet (roundPhase stays
    // "unknown") — map that to the agent-select scene so the HUD/site stop
    // showing "-" and the popout renders AgentSelectScene.
    if (!s.roundPhase || s.roundPhase === "unknown") {
      if (s.matchId) return "agent-select";
      // Presence-only mode (GEP starved / GLZ unreachable): the Riot client
      // reports a live session with a map and score but no match id or round
      // facts. That is unambiguously an in-progress match, so show the HUD
      // instead of leaving the scene null (which froze the overlay).
      if (s.mapKey || s.blue > 0 || s.red > 0) return "ingame-hud";
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
