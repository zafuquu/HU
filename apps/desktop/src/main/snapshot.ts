/**
 * Map projected game state -> the bridge's `game` snapshot shape.
 * The bridge (server/game-bridge.mjs) reads:
 *   state.leftTeam / state.rightTeam  -> {gameScore, seriesScore, name}
 *   state.currentRound.roundNumber
 * The overlay popout reads snapshot.state.players[].{playerId,name,tagline,agentName,...}
 */
import type { HudRelayState } from "@havoc-unleash/contracts";

export interface GameTeamState {
  name: string | null;
  tag?: string | null;
  score?: number;
  gameScore?: number;
  seriesScore?: number;
  matches_won_this_series?: number;
  color?: string | null;
}

export interface GamePlayerState {
  playerId?: string;
  name?: string;
  tagline?: string;
  agentName?: string | null;
  teamId?: string | null;
  team?: string | null;
  /** 0 = blue/left, 1 = red/right — the site popout's team filter key. */
  startTeam?: number;
  teamIndex?: number | null;
  isAlive?: boolean;
  health?: number;
  armor?: number;
  abilities?: unknown[];
  // Live scoreboard detail (passed through when the provider supplies it).
  weapon?: string | null;
  credits?: number | null;
  spentCredits?: number | null;
  kills?: number | null;
  deaths?: number | null;
  assists?: number | null;
  ultPoints?: number | null;
  ultMax?: number | null;
  hasSpike?: boolean | null;
}

export interface GameSnapshot {
  gameId?: number;
  state: {
    leftTeam: GameTeamState | null;
    rightTeam: GameTeamState | null;
    currentRound: { roundNumber: number | null; roundPhase?: string | null };
    players: GamePlayerState[];
    gameScore: { left: number; right: number };
    gameEvent?: string | null;
    /** Overlay scene implied by live game data (drives auto scene switching). */
    scene?: string | null;
    /** Friendly map name (e.g. "Ascent"). */
    mapName?: string | null;
    /**
     * Round phase the site popout's gamePhase derivation reads
     * ("shopping" | "combat" | "end" | "unknown"). Without it the popout can
     * never leave the InGameHud scene.
     */
    roundPhase?: string | null;
    /** Agent-select signal — the popout maps this to gamePhase "game_start". */
    isAgentSelectPhase?: boolean;
    /** Phase start epoch (ms) so overlays can derive a round timer. */
    phaseStartedAt?: number | null;
    /** Round timer in seconds remaining */
    roundTimer?: number | null;
    /** Spectator role for overlays that show a spectator badge. */
    viewerRole?: string | null;
    /** Spike planted flag for the site's SpikeIndicator. */
    bombPlanted?: boolean;
    /** Post-game result (winner + MVP) when a match settles. */
    match?: {
      winner: "blue" | "red" | null;
      mvp: { name: string; teamId: string; kills: number; deaths: number; assists: number } | null;
    };
    /** How the last round ended (winner + reason), cleared at next round start. */
    roundEnd?: { winner: "blue" | "red" | null; reason: string | null } | null;
  };
}

const TEAM_NAMES: Record<string, string> = {
  blue: "Team A",
  red: "Team B",
};

/** Build a bridge-compatible snapshot from the projected relay state. */
export function toGameSnapshot(state: HudRelayState): GameSnapshot {
  const roundNumber = state.round?.number ?? 0;
  const leftScore = state.score.blue ?? 0;
  const rightScore = state.score.red ?? 0;

  const leftTeamBase: GameTeamState = {
    name: TEAM_NAMES.blue,
    tag: "B",
    gameScore: leftScore,
    seriesScore: 0,
    score: leftScore,
    color: "#28D091",
  };
  const rightTeamBase: GameTeamState = {
    name: TEAM_NAMES.red,
    tag: "A",
    gameScore: rightScore,
    seriesScore: 0,
    score: rightScore,
    color: "#FF3549",
  };

  const players: GamePlayerState[] = (state.roster ?? []).map((p) => {
    const [name, tagline] = p.displayName.split("#");
    return {
      playerId: p.displayName,
      name: name || p.displayName,
      tagline: tagline ?? "",
      agentName: p.agentName ?? null,
      teamId: p.teamId ?? null,
      team: p.teamId ?? null,
      startTeam: p.teamIndex === 1 ? 1 : 0,
      teamIndex: p.teamIndex ?? null,
      isAlive: p.isAlive ?? true,
      health: p.health ?? 100,
      // Real shield from GEP (0/25/50); shieldType drives the site's armor bar.
      armor: p.shield ?? 0,
      shield: p.shield ?? null,
      shieldType: p.shield != null ? (p.shield >= 50 ? 2 : p.shield > 0 ? 1 : 0) : undefined,
      abilities: p.abilities ?? [],
      weapon: p.weapon ?? null,
      credits: p.credits ?? null,
      spentCredits: p.spentCredits ?? null,
      kills: p.kills ?? null,
      deaths: p.deaths ?? null,
      assists: p.assists ?? null,
      ultPoints: p.ultPoints ?? null,
      ultMax: p.ultMax ?? null,
      hasSpike: p.hasSpike ?? null,
    };
  });

  // Only publish team blocks when real players exist for that side.
  const hasLeftPlayers = players.some((p) => (p.teamIndex ?? p.startTeam ?? 0) === 0);
  const hasRightPlayers = players.some((p) => (p.teamIndex ?? p.startTeam) === 1);
  const leftTeam = hasLeftPlayers || players.length > 0 ? { ...leftTeamBase } : null;
  const rightTeam = hasRightPlayers ? { ...rightTeamBase } : null;

  // Compute live round timer in seconds remaining
  let roundTimer: number | null = null;
  if (state.round?.phaseStartedAt && typeof state.round.phaseStartedAt === "number") {
    const elapsed = Math.max(0, Math.floor((Date.now() - state.round.phaseStartedAt) / 1000));
    const total = state.spike === "planted" ? 45 : state.round.phase === "shopping" ? 30 : 100;
    roundTimer = Math.max(0, total - elapsed);
  }

  return {
    gameId: 21640,
    state: {
      leftTeam,
      rightTeam,
      currentRound: {
        roundNumber: players.length > 0 && roundNumber > 0 ? roundNumber : null,
        roundPhase: state.round?.phase ?? null,
      },
      players,
      gameScore: { left: leftScore, right: rightScore },
      gameEvent: state.gameEvent ?? null,
      scene: state.scene ?? null,
      mapName: state.mapName ?? null,
      roundPhase: state.round?.phase ?? null,
      isAgentSelectPhase:
        state.sessionPhase === "loading" ||
        (state.sessionPhase === "live" &&
          (state.round?.number ?? 0) === 0 &&
          (state.round?.phase ?? "unknown") === "unknown" &&
          !!state.matchId),
      phaseStartedAt: state.round?.phaseStartedAt ?? null,
      roundTimer,
      viewerRole: state.viewerRole ?? null,
      bombPlanted: state.spike === "planted",
      match: {
        winner: state.match?.winner ?? null,
        mvp: state.match?.mvp ?? null,
      },
      roundEnd: state.roundEnd ?? null,
    },
  };
}