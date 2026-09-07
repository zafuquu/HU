/**
 * Wire protocol shared with the audited havoc-game-data-runtime service.
 * Every SSE `data:` line carries {at, id, kind, protocolVersion, ...payload}.
 */
import { z } from "zod";

export const GAME_DATA_PROTOCOL_VERSION = 1;

export const GAME_DATA_RUNTIME_PATHS = {
  health: "/health",
  events: "/events",
} as const;

/* --------------------------- Health document --------------------------- */

const capabilityStateSchema = z
  .object({
    lastError: z.string().nullable(),
    state: z.enum(["ready", "starting", "error", "unavailable"]).catch("unavailable"),
  })
  .nullish();

/** Accepts BOTH upstream (service/runtime/ok/supportedGames) and fork-minimal. */
export const gameDataRuntimeHealthSchema = z.object({
  ok: z.boolean().optional(),
  service: z.string().nullish(),
  supportedGames: z.array(z.string()).nullish(),
  capabilities: z
    .object({ overwolf: capabilityStateSchema, valorantApi: capabilityStateSchema })
    .nullish(),
  runtimeVersion: z.string().min(1),
  uptimeMs: z.number().nonnegative().nullish(),
  runtime: z.object({
    state: z.enum(["starting", "ready", "error"]),
    detail: z.string().nullish(),
    lastError: z.string().nullish(),
  }),
});
export type GameDataRuntimeHealth = z.infer<typeof gameDataRuntimeHealthSchema>;

/* ------------------------------ Stream frames -------------------------- */

export const valorantPlayerIdentitySchema = z.object({
  displayName: z.string(),
  gameName: z.string().nullish(),
  tagLine: z.string().nullish(),
});
export type ValorantPlayerIdentity = z.infer<typeof valorantPlayerIdentitySchema>;

const rosterPlayerSchema = z.object({
  agent: z.object({ key: z.string(), name: z.string(), riotId: z.string().nullish() }).nullish(),
  observerSlot: z.number().int().nullish(),
  player: z.object({
    identity: valorantPlayerIdentitySchema.nullish(),
    // Upstream dialect
    name: valorantPlayerIdentitySchema.nullish(),
    puuid: z.string().nullish(),
  }),
  teamIndex: z.number().int().nullish(),
});

/** Tolerant snapshot shape accepting BOTH observed upstream nesting and fork dialect. */
export const valorantSessionSnapshotSchema = z.object({
  revision: z.number().int().nonnegative(),
  // Fork dialect uses sessionPhase; upstream uses phase.
  sessionPhase: z.enum(["idle", "loading", "live"]).optional(),
  phase: z.enum(["idle", "loading", "live"]).optional(),
  // Fork dialect puts ids top-level; upstream nests them under session.
  matchId: z.string().nullish(),
  mapKey: z.string().nullish(),
  score: z.object({ blue: z.number(), red: z.number() }).nullable().nullish(),
  session: z
    .object({
      matchId: z.string().nullish(),
      map: z.object({ key: z.string().nullish(), name: z.string().nullish() }).nullish(),
      teams: z
        .array(
          z.object({
            teamId: z.enum(["Blue", "Red", "Draw"]),
            startingSide: z.enum(["defense", "attack"]).nullish(),
            players: z.array(rosterPlayerSchema),
          }),
        )
        .nullish(),
      viewer: z
        .object({
          role: z.enum(["player", "spectator", "unknown"]),
          player: valorantPlayerIdentitySchema.nullish(),
        })
        .nullish(),
    })
    .nullish(),
  teams: z
    .array(
      z.object({
        teamId: z.enum(["Blue", "Red", "Draw"]),
        startingSide: z.enum(["defense", "attack"]).nullish(),
        players: z.array(rosterPlayerSchema),
      }),
    )
    .nullish(),
  viewer: z
    .object({ role: z.enum(["player", "spectator", "unknown"]), player: valorantPlayerIdentitySchema.nullish() })
    .nullish(),
  observedAt: z.string().datetime().nullish(),
});
export type ValorantSessionSnapshot = z.infer<typeof valorantSessionSnapshotSchema>;

export const valorantScoreSnapshotSchema = z.object({
  matchId: z.string(),
  blue: z.number().int().nonnegative(),
  red: z.number().int().nonnegative(),
  observedAt: z.string().datetime().nullish(),
});
export type ValorantScoreSnapshot = z.infer<typeof valorantScoreSnapshotSchema>;

export const valorantMatchDetailsSchema = z.object({ matchId: z.string() }).passthrough();
export type ValorantMatchDetails = z.infer<typeof valorantMatchDetailsSchema>;

export const valorantTimeoutStartedSchema = z.object({
  matchId: z.string(),
  observedAt: z.string().datetime().nullish(),
});
export type ValorantTimeoutStarted = z.infer<typeof valorantTimeoutStartedSchema>;

/** Raw provider fact routed by the runtime. */
export const rawPayloadSchema = z.object({
  gameId: z.number().int().nullish(),
  key: z.string().min(1),
  value: z.unknown(),
});

/** Upstream-exact frame union. The mock emits the same set. */
export const streamFrameSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("valorant_session_snapshot"), snapshot: valorantSessionSnapshotSchema }),
  z.object({ kind: z.literal("valorant_score_snapshot"), score: valorantScoreSnapshotSchema }),
  z.object({ kind: z.literal("valorant_match_details"), details: valorantMatchDetailsSchema }),
  z.object({ kind: z.literal("valorant_timeout_started"), timeout: valorantTimeoutStartedSchema }),
  z.object({ kind: z.literal("new_info_update"), data: rawPayloadSchema }),
  z.object({ kind: z.literal("new_game_event"), data: rawPayloadSchema }),
  z.object({ kind: z.literal("game_detected"), args: z.array(z.unknown()).nullish() }),
  z.object({ kind: z.literal("game_exit"), args: z.array(z.unknown()).nullish() }),
  z.object({
    kind: z.literal("provider_error"),
    classification: z.string().nullish(),
    code: z.string().nullish(),
  }),
]);
export type StreamFrame = z.infer<typeof streamFrameSchema>;

export const runtimeGameIdentities = ["VAL"] as const;

export * from "./hud-state";

