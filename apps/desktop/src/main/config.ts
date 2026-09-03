import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const envSchema = z.object({
  BLOB_FORK_RUNTIME_PORT: z.coerce.number().int().min(1).max(65535).default(7423),
  BLOB_FORK_BRIDGE_ORIGIN: z.string().default(""),
  BLOB_FORK_APP_BASE: z.string().default(""),
  // The exact deep-link protocol the replica website fires on login.
  BLOB_FORK_DESKTOP_PROTOCOL: z.string().default("havoc-desktop"),
  BLOB_FORK_ROOM_ID: z.string().default(""),
  BLOB_FORK_GAME_WINDOW_TITLE: z.string().min(1).default("VALORANT"),
  BLOB_FORK_GATEWAY_PORT: z.coerce.number().default(7155),
  BLOB_FORK_HUD_PORT: z.coerce.number().default(7103),
  BLOB_FORK_ANCHOR_OVERLAY: z.string().default("0"),
  BLOB_FORK_CONFIG: z.string().default(""),
  BLOB_FORK_DEV_SESSION: z.string().default(""),
  /** Run the Overwolf GEP provider elevated (UAC), like the original app. */
  BLOB_FORK_ELEVATE_GEP: z.string().default("1"),
  // ---- Havoc/old-fork environment names (take precedence, like the original app) ----
  BLOB_DESKTOP_API_ORIGIN: z.string().default(""),
  BLOB_DESKTOP_REALTIME_ORIGIN: z.string().default(""),
  BLOB_DESKTOP_LOGIN_ORIGIN: z.string().default(""),
  BLOB_DESKTOP_OVERLAY_ORIGIN: z.string().default(""),
  BLOB_DESKTOP_SKIP_LOGIN: z.string().default(""),
});

/** Defaults mirror the old fork's launch-vercel.bat targeting the deployed stack. */
const HAVOC_DEFAULTS = {
  bridge: "https://havoc-game-bridge.onrender.com",
  app: "https://havocunleashs.vercel.app",
} as const;

export interface AppConfig {
  readonly runtimeOrigin: string;
  readonly bridgeOrigin: string;
  readonly appBase: string;
  readonly overlayOrigin: string;
  readonly desktopProtocol: string;
  /** Every scheme this app accepts deep links on (the website fires havoc-desktop:// first). */
  readonly desktopProtocols: readonly string[];
  readonly roomId: string;
  readonly gameWindowTitle: string;
  readonly gatewayPort: number;
  readonly hudPort: number;
  readonly hudOrigin: string;
  readonly anchorOverlay: boolean;
  readonly skipLogin: boolean;
  /** Launch the GEP provider elevated (original-style UAC). Default: on. */
  readonly elevateGep: boolean;
}

type Overrides = { appBase?: string; bridgeOrigin?: string; roomId?: string };

function firstTruthy(...values: (string | undefined)[]): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const p = envSchema.parse(env);
  const over = readConfigFile(p.BLOB_FORK_CONFIG);
  const bridgeOrigin = firstTruthy(
    p.BLOB_DESKTOP_API_ORIGIN,
    p.BLOB_DESKTOP_REALTIME_ORIGIN,
    p.BLOB_FORK_BRIDGE_ORIGIN,
    over.bridgeOrigin,
    HAVOC_DEFAULTS.bridge,
  )!.replace(/\/+$/, "");
  const appBase = firstTruthy(
    p.BLOB_DESKTOP_LOGIN_ORIGIN,
    p.BLOB_FORK_APP_BASE,
    over.appBase,
    HAVOC_DEFAULTS.app,
  )!.replace(/\/+$/, "");
  const overlayOrigin = firstTruthy(p.BLOB_DESKTOP_OVERLAY_ORIGIN, appBase)!.replace(/\/+$/, "");
  const roomId = p.BLOB_FORK_ROOM_ID?.trim() || over.roomId?.trim() || "";
  return {
    runtimeOrigin: `http://127.0.0.1:${p.BLOB_FORK_RUNTIME_PORT}`,
    bridgeOrigin,
    appBase,
    overlayOrigin,
    desktopProtocol: p.BLOB_FORK_DESKTOP_PROTOCOL,
    desktopProtocols: [
      ...new Set([p.BLOB_FORK_DESKTOP_PROTOCOL, "havoc-desktop", "blob-desktop"]),
    ],
    roomId,
    gameWindowTitle: p.BLOB_FORK_GAME_WINDOW_TITLE,
    gatewayPort: p.BLOB_FORK_GATEWAY_PORT,
    hudPort: p.BLOB_FORK_HUD_PORT,
    hudOrigin: `http://127.0.0.1:${p.BLOB_FORK_HUD_PORT}`,
    anchorOverlay: p.BLOB_FORK_ANCHOR_OVERLAY === "1",
    skipLogin: p.BLOB_DESKTOP_SKIP_LOGIN === "1" || p.BLOB_FORK_DEV_SESSION === "1",
    elevateGep: p.BLOB_FORK_ELEVATE_GEP !== "0",
  };
}

function readConfigFile(explicitPath: string): Overrides {
  if (explicitPath) {
    const o = tryRead(explicitPath);
    if (o) return o;
    return {};
  }
  const localData = process.env.LOCALAPPDATA ?? process.cwd();
  const candidates = [
    path.join(process.cwd(), "blob-fork.config.json"),
    path.join(localData, "blob-fork", "config.json"),
    path.join(localData, "BlobFork", "config.json"),
  ];
  for (const file of candidates) {
    const o = tryRead(file);
    if (o) return o;
  }
  return {};
}

function tryRead(file: string): Overrides | null {
  try {
    if (!fs.existsSync(file)) return null;
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
    return {
      appBase: str(raw["BLOB_FORK_APP_BASE"] ?? raw.appBase),
      bridgeOrigin: str(raw["BLOB_FORK_BRIDGE_ORIGIN"] ?? raw.bridgeOrigin),
      roomId: str(raw["BLOB_FORK_ROOM_ID"] ?? raw.roomId),
    };
  } catch {
    return null;
  }
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}