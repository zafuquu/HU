/** HUD relay state (delivered by /api/state and the /ws push channel). */
import { z } from "zod";

export const roundPhaseSchema = z.enum(["shopping", "combat", "end", "unknown"]);
export type RoundPhase = z.infer<typeof roundPhaseSchema>;

export const killfeedEntrySchema = z.object({
  seq: z.number().int().positive(),
  attacker: z.string(),
  victim: z.string(),
  weapon: z.string(),
  modifier: z.string().nullable(),
  at: z.number(),
});
export type KillfeedEntry = z.infer<typeof killfeedEntrySchema>;

export const spikeStatusSchema = z.enum(["carried", "dropped", "planted", "defused", "detonated"]);

export const hudRelayStateSchema = z.object({
  revision: z.number().int().nonnegative(),
  connectedToRuntime: z.boolean(),
  game: z.string().nullable(),
  // Upstream phases (pregame/ending/unknown) pass through after normalization
  // in the desktop projection; the HUD renders non-live as "menu / <phase>".
  sessionPhase: z.enum(["unknown", "idle", "loading", "pregame", "live", "ending"]),
  matchId: z.string().nullable(),
  mapKey: z.string().nullable(),
  /** Friendly map name (e.g. "Ascent") resolved from the map identity. */
  mapName: z.string().nullable().default(null),
  viewerRole: z.enum(["player", "observer", "coach", "spectator", "unknown"]).default("unknown"),
  /** Post-game result when a match settles (winner + MVP). */
  match: z
    .object({
      winner: z.enum(["blue", "red"]).nullable(),
      mvp: z
        .object({
          name: z.string(),
          teamId: z.string(),
          kills: z.number().int(),
          deaths: z.number().int(),
          assists: z.number().int(),
        })
        .nullable(),
    })
    .default({ winner: null, mvp: null }),
  roster: z
    .array(
      z.object({
        displayName: z.string(),
        agentName: z.string().nullable(),
        teamId: z.string().nullish(),
        teamIndex: z.number().int().nullish(),
        slot: z.number().int().nullish(),
        // Per-player detail evidence (weapon/credits/ults/scoreline) when the
        // provider supplies scoreboard observations.
        agentIcon: z.string().nullish(),
        agentKey: z.string().nullish(),
        abilityState: z
          .object({
            C: z.boolean().nullish(),
            Q: z.boolean().nullish(),
            E: z.boolean().nullish(),
            X: z.boolean().nullish(),
          })
          .nullish(),
        kills: z.number().int().nullish(),
        deaths: z.number().int().nullish(),
        assists: z.number().int().nullish(),
        weapon: z.string().nullish(),
        credits: z.number().nullish(),
        spentCredits: z.number().nullish(),
        shield: z.number().nullish(),
        /** GEP shield TIER enum (0 none / 1 light / 2 heavy / 3 enemy-unknown / 4 regen). */
        shieldType: z.number().int().nullish(),
        health: z.number().nullish(),
        isAlive: z.boolean().nullish(),
        ultPoints: z.number().int().nullish(),
        ultMax: z.number().int().nullish(),
        abilities: z.array(z.string()).nullish(),
        hasSpike: z.boolean().nullish(),
      }),
    )
    .max(10)
    .nullish(),
  round: z.object({
    number: z.number().int().nonnegative(),
    phase: roundPhaseSchema,
    phaseStartedAt: z.number().nullable(),
    spikePlantedAt: z.number().nullable().default(null),
  }),
  score: z.object({ blue: z.number(), red: z.number() }),
  spike: z.union([spikeStatusSchema, z.null()]),
  killfeed: z.array(killfeedEntrySchema).max(25),
  /** Round-settlement banner: "Ace" | "Clutch" | "Flawless" | "Team Ace" | "Thrifty" | "Round Win" | null. */
  gameEvent: z.string().nullable().default(null),
  /** Overlay scene the current game data implies (drives auto scene switching). */
  scene: z.enum(["agent-select", "buy-round", "ingame-hud", "post-game"]).nullable().default(null),
  /** How the most recent round ended (winner side + reason), cleared next round. */
  roundEnd: z
    .object({
      winner: z.enum(["blue", "red"]).nullable(),
      reason: z.enum(["elimination", "detonation", "defusion", "time"]).nullable(),
      winnerSide: z.enum(["attacker", "defender"]).nullable().optional(),
    })
    .nullable()
    .default(null),
  /** Viewer's side this round (snapshot team startingSide ground truth). */
  viewerSide: z.enum(["attack", "defense"]).nullable().optional(),
  /** The viewer's START side (session-snapshot ground truth) — drives the side-label fallback. */
  viewerStartSide: z.enum(["attack", "defense"]).nullable().optional(),
  /** Per-round win history (ValoSpectra app-roundreasons parity, max 24). */
  roundHistory: z
    .array(
      z.object({
        round: z.number().int().positive(),
        winner: z.enum(["blue", "red"]),
        reason: z.enum(["elimination", "detonation", "defusion", "time"]),
      }),
    )
    .max(24)
    .default([]),
  restorePending: z.boolean().nullish(),
  updatedAt: z.number(),
  /** Authoritative observation epoch (ms) — monotonic staleness gate for consumers. */
  observedAt: z.number().default(0),
});
export type HudRelayState = z.infer<typeof hudRelayStateSchema>;

