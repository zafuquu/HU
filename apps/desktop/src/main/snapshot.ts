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
}

export interface GamePlayerState {
  playerId?: string;
  name?: string;
  tagline?: string;
  agentName?: string | null;
  teamId?: string | null;
  team?: string | null;
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
  };
  const rightTeamBase: GameTeamState = {
    name: TEAM_NAMES.red,
    tag: "A",
    gameScore: rightScore,
    seriesScore: 0,
    score: rightScore,
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
      isAlive: p.isAlive ?? true,
      health: p.health ?? 100,
      armor: 50,
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

  // Only publish team blocks when a real match reported players. When idle the
  // bridge then has nothing to mirror into `live:<room>` and the overlay
  // renders no fallback teams/scores.
  const hasRealPlayers = players.length > 0;
  const leftTeam = hasRealPlayers ? { ...leftTeamBase } : null;
  const rightTeam = hasRealPlayers ? { ...rightTeamBase } : null;

  return {
    gameId: 21640,
    state: {
      leftTeam,
      rightTeam,
      currentRound: {
        roundNumber: hasRealPlayers && roundNumber > 0 ? roundNumber : null,
        roundPhase: state.round?.phase ?? null,
      },
      players,
      // The score comes from Riot presence and is real even before a roster
      // exists (GEP/GLZ may be unavailable). Zeroing it here made the bridge
      // mirror 0-0 for the whole match, so the overlay never saw live scores.
      gameScore: { left: leftScore, right: rightScore },
      gameEvent: state.gameEvent ?? null,
      scene: state.scene ?? null,
      mapName: state.mapName ?? null,
      // Phase fields the site popout's gamePhase derivation consumes
      // (OverlayPopout.tsx) — without them the overlay stays on InGameHud.
      roundPhase: state.round?.phase ?? null,
      // HudRelayState's sessionPhase enum is idle|loading|live — "loading"
      // covers pregame. A LIVE session with no round facts yet is real
      // Valorant's agent select (match_id arrives before round facts).
      isAgentSelectPhase:
        state.sessionPhase === "loading" ||
        (state.sessionPhase === "live" &&
          (state.round?.number ?? 0) === 0 &&
          (state.round?.phase ?? "unknown") === "unknown" &&
          !!state.matchId),
      phaseStartedAt: state.round?.phaseStartedAt ?? null,
      bombPlanted: state.spike === "planted",
      match: {
        winner: state.match?.winner ?? null,
        mvp: state.match?.mvp ?? null,
      },
      roundEnd: state.roundEnd ?? null,
    },
  };
}