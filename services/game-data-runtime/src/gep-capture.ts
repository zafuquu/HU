/**
 * Overwolf GEP capture — parent side.
 *
 * Spawns @overwolf/ow-electron's electron.exe running the gep-provider child
 * app (../gep-provider), which uses Overwolf's PackageManager to load the GEP
 * package (the same Game Events Provider data path the original BLOB runtime
 * uses — confirmed by dissecting blob-game-data-runtime.exe).
 *
 * The child speaks NDJSON protocol v1 on stdout; this module parses it and
 * translates gep.InfoUpdate / gep.GameEvent payloads into the same ProviderFact
 * stream the runtime + desktop pipeline already consume.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server, type Socket } from "node:net";
import { randomBytes, randomUUID } from "node:crypto";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  writeFileSync,
  type WriteStream as FsWriteStream,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

import { formatKill, formatMap, formatPlayer, formatRoster } from "./gep-format";
import { deriveAppUid, ensureGepPackage, resolveGameDataDir } from "./gep-download";
import type { ProviderFact } from "./mock-source";

const ELEVATED_CONNECTION_TIMEOUT_MS = 45_000;


export type ProviderEmit = (fact: ProviderFact) => void;

export type ProviderState = "unavailable" | "starting" | "ready" | "error";

export interface ProviderHealth {
  state: ProviderState;
  lastError: string | null;
  providerVersion: string | null;
}

interface ProtocolMessage {
  type?: string;
  protocolVersion?: number;
  kind?: string;
  payload?: unknown;
  reason?: string;
}

interface GepItem {
  gameId?: number;
  feature?: string;
  category?: string;
  key?: string;
  value?: unknown;
}

/** Rewrite an asar path to its unpacked sibling so spawn() can execute it. */
function asarReal(path: string): string {
  return path.includes(".asar") ? path.replace(".asar", ".asar.unpacked") : path;
}

/** Locate ow-electron's electron.exe (dev workspace or packaged resources). */
export function resolveOwElectronPath(): string | null {
  const candidates: string[] = [];
  const envPath = process.env.BLOB_OW_ELECTRON_PATH?.trim();
  if (envPath) candidates.push(envPath);

  // Dev: walk up from the bundle location to the workspace root's node_modules.
  let dir = __dirname;
  for (let i = 0; i < 8; i += 1) {
    candidates.push(join(dir, "node_modules", "@overwolf", "ow-electron", "dist", "electron.exe"));
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // Packaged: electron-builder extraResources put it under <resources>/ow-electron.
  const exeDir = dirname(process.execPath);
  candidates.push(join(exeDir, "resources", "ow-electron", "dist", "electron.exe"));
  candidates.push(join(exeDir, "ow-electron", "dist", "electron.exe"));

  for (const candidate of candidates) {
    const real = asarReal(candidate);
    if (existsSync(real)) return real;
  }
  return null;
}

/** Locate the gep-provider child app directory. */
export function resolveProviderDir(): string | null {
  const candidates: string[] = [];
  const envDir = process.env.BLOB_GEP_PROVIDER_DIR?.trim();
  if (envDir) candidates.push(envDir);
  candidates.push(join(__dirname, "gep-provider")); // bundled next to runtime-server.cjs
  candidates.push(join(__dirname, "..", "gep-provider")); // dev: dist/../gep-provider
  const exeDir = dirname(process.execPath);
  candidates.push(join(exeDir, "resources", "gep-provider"));
  candidates.push(join(exeDir, "gep-provider"));

  for (const candidate of candidates) {
    const real = asarReal(candidate);
    if (existsSync(join(real, "package.json")) && existsSync(join(real, "index.js"))) return real;
  }
  return null;
}

/** Normalize a GEP score value ({team_0,team_1} | {blue,red} | "a-b") to team_0/team_1. */
function normalizeScore(value: unknown): { team_0: number; team_1: number } | null {
  if (typeof value === "string") {
    const m = value.match(/(\d+)\D+(\d+)/);
    return m ? { team_0: Number(m[1]), team_1: Number(m[2]) } : null;
  }
  if (value != null && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    const t0 = Number(rec.team_0 ?? rec.blue);
    const t1 = Number(rec.team_1 ?? rec.red);
    if (Number.isFinite(t0) && Number.isFinite(t1)) return { team_0: t0, team_1: t1 };
  }
  return null;
}

/** One flat gep.InfoUpdate -> 0..n ProviderFacts. */
function factFromInfoUpdate(item: GepItem, emit: ProviderEmit): void {
  const key = String(item.key ?? "").trim();
  const category = String(item.category ?? item.feature ?? "").toLowerCase();
  const value = item.value;
  if (!key) return;
  const low = key.toLowerCase();

  const pushInfo = (k: string, v: unknown): void => emit({ kind: "new_info_update", key: k, value: v });

  if (low === "map") {
    const formatted = formatMap(value);
    if (formatted) pushInfo("map", formatted);
    return;
  }
  if (low === "scene") {
    if (typeof value === "string") pushInfo("scene", value);
    return;
  }
  if (low === "match_id") {
    pushInfo("match_id", typeof value === "string" ? value : String(value ?? ""));
    return;
  }
  if (low === "round_phase" || low === "round_report") {
    pushInfo("round_phase", value);
    return;
  }
  if (low === "round_number") {
    pushInfo("round_number", value);
    return;
  }
  if (low === "score" || low === "match_score") {
    const score = normalizeScore(value);
    if (score) pushInfo("match_score", score);
    return;
  }
  if (low === "player_id" || low === "game_mode") {
    pushInfo(low, value);
    return;
  }
  if (category.includes("roster") || low.startsWith("roster")) {
    const items = Array.isArray(value) ? value : [value];
    for (const item2 of items) {
      if (item2 != null && typeof item2 === "object") {
        pushInfo("roster", formatRoster(item2 as Record<string, unknown>).value);
      }
    }
    return;
  }
  if (category.includes("scoreboard") || low.startsWith("scoreboard") || category.includes("player")) {
    const items = Array.isArray(value) ? value : [value];
    for (const item2 of items) {
      if (item2 != null && typeof item2 === "object") {
        pushInfo("scoreboard", formatPlayer(item2 as Record<string, unknown>).value);
      }
    }
    return;
  }
  if (low === "spike") {
    const v = String(value ?? "").toLowerCase();
    if (v.includes("plant")) emit({ kind: "new_game_event", key: "spike_planted", value: true });
    else if (v.includes("defuse")) emit({ kind: "new_game_event", key: "spike_defused", value: true });
    return;
  }
  // Pass through other structured info so nothing is lost.
  if (value != null && typeof value === "object") pushInfo(low, value);
}

/** One gep.GameEvent -> ProviderFact. */
function factFromGameEvent(item: GepItem, emit: ProviderEmit): void {
  const key = String(item.key ?? "").trim().toLowerCase();
  const value = item.value;
  if (!key) return;

  if (key === "kill" || key === "kill_feed") {
    if (value != null && typeof value === "object") {
      emit({ kind: "new_game_event", key: "kill_feed", value: formatKill(value as Record<string, unknown>).value });
    }
    return;
  }
  if (key === "spike_planted" || key === "spike_defused" || key === "spike_detonated" || key === "spike_exploded") {
    const normalized = key === "spike_exploded" ? "spike_detonated" : key;
    emit({ kind: "new_game_event", key: normalized, value: true });
    return;
  }
  emit({ kind: "new_game_event", key, value });
}

/**
 * Normalize a nested getInfo() dump: {category: {key: value}} or {category: [items]}.
 */
function factFromInfoDump(dump: unknown, emit: ProviderEmit): void {
  if (dump == null || typeof dump !== "object" || Array.isArray(dump)) return;
  for (const [category, content] of Object.entries(dump as Record<string, unknown>)) {
    const entries: Array<[string, unknown]> =
      content != null && typeof content === "object" && !Array.isArray(content)
        ? Object.entries(content as Record<string, unknown>)
        : Array.isArray(content)
          ? content.map((v, i) => [`${category}_${i}`, v])
          : [];
    for (const [key, value] of entries) {
      factFromInfoUpdate({ category, key, value }, emit);
    }
  }
}

/** Extract a GEP item ({key, value, ...}) from a raw callback-args payload. */
function findInfoItem(payload: unknown): GepItem | null {
  const args = Array.isArray(payload) ? payload : [payload];
  for (const arg of args) {
    if (arg != null && typeof arg === "object" && !Array.isArray(arg)) {
      const rec = arg as Record<string, unknown>;
      if (typeof rec.key === "string" || typeof rec.category === "string" || typeof rec.feature === "string") {
        return rec as GepItem;
      }
    }
  }
  return null;
}

export class GepProviderSource {
  private emitFn: ProviderEmit | null = null;
  private child: ChildProcess | null = null;
  private stopped = false;
  private state: ProviderState = "unavailable";
  private lastError: string | null = null;
  private restartAttempt = 0;
  private restartTimer: NodeJS.Timeout | null = null;
  private stdoutBuffer = "";
  private providerVersion: string | null = null;
  // Elevation (mirrors the original's windows-native-host design): the GEP
  // child is launched via PowerShell `Start-Process -Verb RunAs` and connects
  // BACK to a named pipe here, because an elevated process cannot share stdio
  // with a medium-integrity parent. If UAC is declined we fall back to the
  // direct (non-elevated) launch instead of nagging the user every retry.
  private elevate: boolean;
  private pipeServer: Server | null = null;
  private hostSocket: Socket | null = null;
  private connectionTimer: NodeJS.Timeout | null = null;
  private elevationToken: string | null = null;

  public constructor() {
    this.elevate = process.env.BLOB_FORK_ELEVATE_GEP === "1";
  }

  public start(emit: ProviderEmit): boolean {
    this.emitFn = emit;
    const exe = resolveOwElectronPath();
    const providerDir = resolveProviderDir();
    if (!exe) {
      this.state = "unavailable";
      this.lastError = "ow-electron electron.exe not found (install @overwolf/ow-electron)";
      return false;
    }
    if (!providerDir) {
      this.state = "unavailable";
      this.lastError = "gep-provider directory not found next to the runtime";
      return false;
    }
    this.state = "starting";
    void this.prepareAndLaunch(exe, providerDir);
    return true;
  }

  /** Download/verify the GEP module (original flow), then launch the child. */
  private async prepareAndLaunch(exe: string, providerDir: string): Promise<void> {
    let gepDir: string;
    try {
      const info = await ensureGepPackage();
      gepDir = info.directory;
      this.providerVersion = info.version;
    } catch (error) {
      this.state = "error";
      this.lastError = `GEP package preparation failed: ${error instanceof Error ? error.message : String(error)}`;
      this.emitProviderStatus("provider_error", this.lastError);
      this.scheduleRestart(exe, providerDir);
      return;
    }
    this.launch(exe, providerDir, gepDir);
  }

  public health(): ProviderHealth {
    return { state: this.state, lastError: this.lastError, providerVersion: this.providerVersion };
  }

  /**
   * Ask the elevated provider to reset VALORANT's UDP sockets (original's
   * `valorant-socket-reset-attempt` command). Only available while the
   * elevated host is connected over the pipe. Resolves with the recovered
   * result schema; rejects on timeout or when no elevated host exists.
   */
  public executeValorantSocketReset(targetProcessId: number | null, timeoutMs = 20_000): Promise<unknown> {
    if (!this.hostSocket || !this.elevationToken) {
      return Promise.reject(new Error("elevated provider not connected"));
    }
    const requestId = randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCommand = null;
        reject(new Error("socket reset timed out"));
      }, timeoutMs);
      timer.unref();
      this.pendingCommand = { requestId, resolve, reject, timer };
      this.writeToHost({
        type: "command",
        requestId,
        name: "socket-reset",
        payload: { targetProcessId, koffiPath: this.resolveKoffiPath() },
      });
    });
  }

  private pendingCommand: {
    reject: (error: Error) => void;
    requestId: string;
    resolve: (value: unknown) => void;
    timer: NodeJS.Timeout;
  } | null = null;

  private writeToHost(msg: unknown): void {
    if (!this.hostSocket || this.hostSocket.destroyed) return;
    this.hostSocket.write(JSON.stringify(msg) + "\n");
  }

  public stop(): void {
    this.stopped = true;
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.clearConnectionTimer();
    this.pendingCommand?.reject(new Error("provider stopped"));
    this.pendingCommand = null;
    this.hostSocket?.destroy();
    this.hostSocket = null;
    this.closePipeServer();
    this.child?.kill();
    this.child = null;
  }

  private launch(exe: string, providerDir: string, gepDir?: string): void {
    if (this.elevate) {
      this.launchElevated(exe, providerDir, gepDir);
      return;
    }
    this.launchDirect(exe, providerDir, gepDir);
  }

  private launchDirect(exe: string, providerDir: string, gepDir?: string): void {
    // The addon's async callbacks ONLY fire on a plain Node loop — they never
    // fire in an Electron main process (verified live). So the provider child
    // MUST run in RUN_AS_NODE mode (same ABI, plain node behavior — exactly
    // how the original runs the same addon inside its Bun runtime).
    const env: NodeJS.ProcessEnv = { ...process.env };
    env.ELECTRON_RUN_AS_NODE = "1";
    env.ELECTRON_NO_ATTACH_CONSOLE = "1";
    // Original flow: fixed app uid + GEP module directory for the provider child.
    // The GEP backend validates this uid (Overwolf extension id) before letting
    // the game monitor attach — it MUST be the original's registered id.
    env.OVERWOLF_APP_UID = env.OVERWOLF_APP_UID?.trim() || "mkcfiniehcpkhplpahgeepbdpjophjei";
    if (gepDir) env.BLOB_GAME_DATA_OVERWOLF_GEP_DIRECTORY = gepDir;

    const entry = require("node:path").join(providerDir, "index.js");
    const args = [entry];

    let child: ChildProcess;
    try {
      child = spawn(exe, args, {
        cwd: providerDir,
        env,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (error) {
      this.state = "error";
      this.lastError = `spawn failed: ${String(error)}`;
      this.scheduleRestart(exe, providerDir, gepDir);
      return;
    }
    this.child = child;

    child.stdout?.on("data", (chunk: Buffer) => this.consumeStream(String(chunk)));
    child.stderr?.on("data", (chunk: Buffer) => {
      const text = String(chunk).trim();
      if (text) this.lastError = text.slice(0, 400);
    });
    child.on("error", (error) => {
      this.state = "error";
      this.lastError = `provider process error: ${String(error)}`;
      this.emitProviderStatus("provider_error", this.lastError);
    });
    child.on("exit", (code) => {
      this.child = null;
      if (this.stopped) return;
      this.state = "starting";
      this.lastError = `provider exited (code ${code ?? "signal"})`;
      this.emitProviderStatus("provider_exit", { code });
      this.scheduleRestart(exe, providerDir, gepDir);
    });
  }

  /** Locate the koffi package dir so the elevated child can load FFI bindings. */
  public resolveKoffiPath(): string | null {
    const candidates = [
      // packaged: asar.unpacked/dist -> asar.unpacked/node_modules
      resolve(__dirname, "../../node_modules/koffi"),
      // dev: services/game-data-runtime/dist -> repo node_modules
      resolve(__dirname, "../../../node_modules/koffi"),
    ];
    for (const candidate of candidates) {
      if (existsSync(join(candidate, "index.js"))) return candidate;
    }
    return null;
  }

  /**
   * Elevated launch — the original's windows-native-host design:
   *   1. create a named-pipe server + one-time token
   *   2. write a session file (pipeName + token)
   *   3. spawn via PowerShell `Start-Process -Verb RunAs` (UAC prompt)
   *   4. the elevated child connects back, authenticates, streams the protocol
   * An elevated process cannot share stdio with a medium-integrity parent,
   * which is exactly why the original uses this pipe+session pattern.
   */
  private launchElevated(exe: string, providerDir: string, gepDir?: string): void {
    const pipeName = `\\\\.\\pipe\\havoc-gep-provider-${randomUUID()}`;
    this.elevationToken = randomBytes(24).toString("hex");

    let sessionPath: string;
    try {
      const runDir = join(resolveGameDataDir(), "run");
      mkdirSync(runDir, { recursive: true });
      sessionPath = join(runDir, "gep-provider-session.json");
      writeFileSync(
        sessionPath,
        JSON.stringify(
          { pipeName, token: this.elevationToken, gepDirectory: gepDir ?? null, koffiPath: this.resolveKoffiPath() },
          null,
          2,
        ),
      );
    } catch (error) {
      this.state = "error";
      this.lastError = `session file write failed: ${String(error)}`;
      this.emitProviderStatus("provider_error", this.lastError);
      this.scheduleRestart(exe, providerDir, gepDir);
      return;
    }

    this.closePipeServer();
    const server = createServer((socket) =>
      this.handleElevatedConnection(socket, exe, providerDir, gepDir),
    );
    this.pipeServer = server;
    server.on("error", (error) => {
      this.state = "error";
      this.lastError = `pipe server error: ${String(error)}`;
      this.emitProviderStatus("provider_error", this.lastError);
    });
    server.listen(pipeName, () => {
      // The PowerShell launcher's env must NOT carry ELECTRON_RUN_AS_NODE, or
      // the elevated electron.exe would start in node mode (Start-Process
      // inherits the environment from this process).
      const psEnv: NodeJS.ProcessEnv = { ...process.env };
      delete psEnv.ELECTRON_RUN_AS_NODE;
      psEnv.OVERWOLF_APP_UID = psEnv.OVERWOLF_APP_UID?.trim() || "mkcfiniehcpkhplpahgeepbdpjophjei";
      if (gepDir) psEnv.BLOB_GAME_DATA_OVERWOLF_GEP_DIRECTORY = gepDir;
      psEnv.BLOB_GAME_DATA_DIR = psEnv.BLOB_GAME_DATA_DIR?.trim() || resolveGameDataDir();

      const ps = (value: string): string => value.replace(/'/g, "''");
      // Elevated launcher script: stale elevated providers cannot be killed
      // from the non-elevated parent, and GEP is a machine-wide singleton —
      // a leftover provider freezes every new one at init. The elevated
      // script cleans them up before booting the fresh provider.
      const launcherScript = [
        "try { Get-Process electron -ErrorAction SilentlyContinue |",
        "  Where-Object { $_.Path -like '*ow-electron*' } | Stop-Process -Force } catch {}",
        "Start-Sleep -Milliseconds 800",
        "$env:ELECTRON_RUN_AS_NODE = '1'",
        `& '${ps(exe)}' '${ps(providerDir + "\\index.js")}' --session '${ps(sessionPath)}'`,
      ].join("\r\n");
      const launcherPath = sessionPath.replace(/[^/\\]+$/, "launch-elevated-provider.ps1");
      writeFileSync(launcherPath, launcherScript, "utf8");
      const launcher = spawn(
        "powershell.exe",
        [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-Command",
          `Start-Process powershell -Verb RunAs -WindowStyle Hidden -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','${ps(launcherPath)}'`,
        ],
        { env: psEnv, stdio: "ignore", windowsHide: true },
      );
      launcher.on("error", (error) => {
        this.state = "error";
        this.lastError = `elevation launcher failed: ${String(error)}`;
        this.emitProviderStatus("provider_error", this.lastError);
      });
      launcher.once("exit", (code) => {
        if (code !== 0 && code !== null) {
          this.state = "error";
          this.lastError = "UAC elevation declined — running GEP provider unelevated";
          this.emitProviderStatus("elevation_fallback", { exit: code });
          // One polite attempt only: continue unelevated instead of retrying UAC.
          this.elevate = false;
          this.closePipeServer();
          this.clearConnectionTimer();
          this.launch(exe, providerDir, gepDir);
        }
      });
      this.emitProviderStatus("elevation_requested", {});
    });

    // Elevated processes have no child handle to watch; the pipe connection is
    // the liveness signal (45s budget, same as the original's host timeout).
    this.clearConnectionTimer();
    this.connectionTimer = setTimeout(() => {
      this.connectionTimer = null;
      if (this.stopped || this.hostSocket) return;
      this.state = "error";
      this.lastError = "elevated provider did not connect (UAC declined?) — falling back to unelevated";
      this.emitProviderStatus("elevation_fallback", { reason: "connection_timeout" });
      // One polite attempt only: continue unelevated instead of retrying UAC.
      this.elevate = false;
      this.closePipeServer();
      this.launch(exe, providerDir, gepDir);
    }, ELEVATED_CONNECTION_TIMEOUT_MS);
    this.connectionTimer.unref();
  }

  private clearConnectionTimer(): void {
    if (!this.connectionTimer) return;
    clearTimeout(this.connectionTimer);
    this.connectionTimer = null;
  }

  private closePipeServer(): void {
    this.pipeServer?.close();
    this.pipeServer = null;
  }

  private handleElevatedConnection(
    socket: Socket,
    exe: string,
    providerDir: string,
    gepDir?: string,
  ): void {
    if (this.hostSocket) {
      socket.destroy();
      return;
    }
    this.clearConnectionTimer();
    let pending = "";
    let authenticated = false;
    socket.setEncoding("utf8");
    socket.on("data", (chunk: string) => {
      if (!authenticated) {
        pending += chunk;
        const newline = pending.indexOf("\n");
        if (newline === -1) return;
        const line = pending.slice(0, newline).trim();
        pending = pending.slice(newline + 1);
        try {
          const hello = JSON.parse(line) as { type?: string; token?: string };
          if (hello?.type !== "hello" || hello.token !== this.elevationToken) {
            socket.destroy();
            return;
          }
        } catch {
          socket.destroy();
          return;
        }
        authenticated = true;
        this.hostSocket = socket;
        this.state = "starting";
        if (pending) this.consumeStream(pending);
        return;
      }
      this.consumeStream(chunk);
    });
    socket.on("error", () => socket.destroy());
    socket.on("close", () => {
      if (this.hostSocket !== socket) return;
      this.hostSocket = null;
      if (this.stopped) return;
      this.state = "starting";
      this.lastError = "elevated provider pipe disconnected";
      this.emitProviderStatus("provider_exit", { reason: "pipe_closed" });
      this.scheduleRestart(exe, providerDir, gepDir);
    });
  }

  private consumeStream(chunk: string): void {
    if (process.env.BLOB_FORK_PROVIDER_DEBUG === "1") {
      process.stdout.write(`[provider-parent] recv: ${chunk.slice(0, 300).trim()}\n`);
    }
    this.stdoutBuffer += chunk;
    let newline = this.stdoutBuffer.indexOf("\n");
    while (newline !== -1) {
      const line = this.stdoutBuffer.slice(0, newline).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newline + 1);
      if (line.startsWith("{")) this.handleMessage(line);
      newline = this.stdoutBuffer.indexOf("\n");
    }
  }

  private providerLogStream: FsWriteStream | null = null;

  /**
   * File log of every provider message — the fork's equivalent of the
   * original's runtime.jsonl, so live issues are diagnosable after the fact.
   */
  private logProviderMessage(msg: ProtocolMessage): void {
    try {
      if (!this.providerLogStream) {
        const dataDir = process.env.BLOB_GAME_DATA_DIR?.trim() ||
          join(process.env.LOCALAPPDATA ?? "", "Havoc", "game-data-runtime");
        const logsDir = join(dataDir, "logs");
        mkdirSync(logsDir, { recursive: true });
        const stream = createWriteStream(join(logsDir, "provider-messages.jsonl"), { flags: "a" });
        stream.on("error", () => {});
        this.providerLogStream = stream;
      }
      const payloadPreview = JSON.stringify(msg.payload ?? null);
      this.providerLogStream.write(`${JSON.stringify({
        at: new Date().toISOString(),
        kind: msg.kind ?? msg.type,
        payload: payloadPreview && payloadPreview.length > 600
          ? payloadPreview.slice(0, 600) + "..."
          : payloadPreview,
      })}\n`);
    } catch { /* never break the pipeline on logging */ }
  }

  /**
   * VALORANT was already running when the provider started: the Overwolf
   * process monitor only fires for games that launch afterwards, so locate
   * the game process and tell the provider to gep.connect explicitly.
   */
  private attachAlreadyRunningGame(): void {
    const exec = (file: string, args: string[]): Promise<string> =>
      new Promise((resolve, reject) => {
        const child = spawn(file, args, { windowsHide: true });
        let out = "";
        child.stdout?.on("data", (d: Buffer) => { out += d.toString(); });
        child.on("error", reject);
        child.on("close", (code) => code === 0 ? resolve(out) : reject(new Error(`exit ${code}`)));
      });
    void exec("tasklist", [
      "/FI", "IMAGENAME eq VALORANT-Win64-Shipping.exe", "/FO", "CSV", "/NH",
    ]).then((out) => {
      const match = /"VALORANT-Win64-Shipping\.exe","(\d+)"/.exec(out);
      if (!match) return; // not running — monitor will handle it when it launches
      const pid = Number(match[1]);
      const msg = {
        type: "command",
        requestId: randomUUID(),
        name: "connect-game",
        payload: { gameId: 21640, pid, name: "VALORANT" },
      };
      this.emitProviderStatus("preopened_game_attach", { pid });
      if (this.hostSocket && !this.hostSocket.destroyed) {
        this.hostSocket.write(JSON.stringify(msg) + "\n");
      } else {
        this.child?.stdin?.write(JSON.stringify(msg) + "\n");
      }
    }).catch(() => { /* process scan failed — monitor path still active */ });
  }

  private scheduleRestart(exe: string, providerDir: string, gepDir?: string): void {
    if (this.stopped || this.restartTimer) return;
    this.restartAttempt += 1;
    const delay = Math.min(2_000 * this.restartAttempt, 30_000);
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      this.state = "starting";
      this.launch(exe, providerDir, gepDir);
    }, delay);
  }

  private handleMessage(line: string): void {
    let msg: ProtocolMessage;
    try {
      msg = JSON.parse(line) as ProtocolMessage;
    } catch {
      return;
    }
    this.logProviderMessage(msg);
    if (msg.type === "ready") {
      // Child is alive; PackageManager may still be downloading GEP.
      if (this.state !== "ready") this.state = "starting";
      return;
    }
    if (msg.type === "failure") {
      this.state = "error";
      this.lastError = msg.reason ?? "unknown provider failure";
      this.emitProviderStatus("provider_error", this.lastError);
      // A failed provider child (e.g. PM fallback timeout) stays alive in retry
      // loops that will never succeed — stop it and let the backoff restart.
      this.child?.kill();
      this.child = null;
      this.hostSocket?.destroy();
      this.hostSocket = null;
      return;
    }
    if (msg.type !== "event") return;

    // Command responses (pipe mode): correlate by requestId.
    if ((msg.kind ?? "").startsWith("command-result")) {
      const payload = msg.payload as { requestId?: string; result?: unknown; error?: string } | null;
      const pending = this.pendingCommand;
      if (pending && payload?.requestId === pending.requestId) {
        this.pendingCommand = null;
        clearTimeout(pending.timer);
        if (payload.error) pending.reject(new Error(payload.error));
        else pending.resolve(payload.result ?? null);
      }
      return;
    }

    switch (msg.kind ?? "") {
      case "provider-ready": {
        this.state = "ready";
        this.lastError = null;
        this.restartAttempt = 0;
        const rec = msg.payload as { version?: string } | null;
        if (typeof rec?.version === "string" && rec.version) this.providerVersion = rec.version;
        this.emitProviderStatus("provider_ready", msg.payload);
        // The Overwolf process monitor only reports games that LAUNCH after it
        // starts. If VALORANT is already running, attach explicitly.
        setTimeout(() => void this.attachAlreadyRunningGame(), 3_000).unref();
        return;
      }
      case "game-detected":
        this.emitProviderStatus("game_detected", msg.payload);
        return;
      case "game-exit":
        this.emitProviderStatus("game_exit", msg.payload);
        return;
      case "elevated-privileges-required":
        this.state = "error";
        this.lastError = "VALORANT is running elevated; run the desktop as administrator to capture events";
        this.emitProviderStatus("provider_error", this.lastError);
        return;
      case "gep-error":
        this.lastError = typeof msg.payload === "string" ? msg.payload : JSON.stringify(msg.payload);
        this.emitProviderStatus("provider_error", this.lastError);
        return;
      case "features-set":
        this.emitProviderStatus("features_set", msg.payload);
        return;
      case "info-update":
        if (msg.payload != null && typeof msg.payload === "object") {
          factFromInfoUpdate(msg.payload as GepItem, this.emit);
        }
        return;
      case "game-event":
        if (msg.payload != null && typeof msg.payload === "object") {
          factFromGameEvent(msg.payload as GepItem, this.emit);
        }
        return;
      case "info-dump":
        factFromInfoDump(msg.payload, this.emit);
        return;
      // Direct-addon stream: payload is an array of raw callback args.
      case "new_info_update":
      case "info_update": {
        const item = findInfoItem(msg.payload);
        if (item) factFromInfoUpdate(item, this.emit);
        return;
      }
      case "new_game_event":
      case "game_event": {
        const item = findInfoItem(msg.payload);
        if (item) factFromGameEvent(item, this.emit);
        return;
      }
      case "monitor":
      case "connect-attempted":
      case "log":
      case "gep-log":
      case "unknown":
        this.emitProviderStatus(msg.kind === "unknown" ? "provider_raw" : (msg.kind ?? "provider_log"), msg.payload);
        return;
      default:
        return;
    }
  }

  private get emit(): ProviderEmit {
    return (fact) => this.emitFn?.(fact);
  }

  private emitProviderStatus(key: string, value: unknown): void {
    this.emitFn?.({ kind: "new_game_event", key: "provider_status", value: { key, value, at: Date.now() } });
  }
}
