/**
 * Game-data runtime consumer.
 * Contract: first SSE data frame MUST be valorant_session_snapshot; later
 * snapshots gated by strictly increasing revision; facts as new_* envelopes;
 * exponential backoff reconnects (1s->30s, 6 tries/generation).
 */
import {
  GAME_DATA_RUNTIME_PATHS,
  gameDataRuntimeHealthSchema,
  type StreamFrame,
  type ValorantSessionSnapshot,
  streamFrameSchema,
} from "@blob-fork/contracts";
import { logger } from "./logger";

export interface RuntimeClientCallbacks {
  onBootstrapRequired?: () => void;
  onFact: (fact: { kind: "new_info_update" | "new_game_event"; key: string; value: unknown }) => void;
  onGameState: (frame: Extract<StreamFrame, { kind: "game_detected" | "game_exit" }>) => void;
  onScore: (score: { matchId: string; blue: number; red: number }) => void;
  onSnapshot: (snapshot: ValorantSessionSnapshot) => void;
  onStatus: (status: { connected: boolean; reason?: string }) => void;
}

const INITIAL_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;
const MAX_ATTEMPTS = 6;
const STABLE_RESET_MS = 30_000;

export class GameDataRuntimeClient {
  private abort: AbortController | null = null;
  private generation = 0;

  public constructor(private readonly origin: string, private readonly cb: RuntimeClientCallbacks) {}

  public async start(): Promise<void> {
    this.generation += 1;
    const gen = this.generation;
    this.abort = new AbortController();
    let attempts = 0;

    while (!this.abort.signal.aborted && gen === this.generation) {
      let connectedAt = 0;
      try {
        await this.assertHealthy();
        const startedAt = Date.now();
        await this.streamOnce((ok) => {
          if (ok) connectedAt = Date.now() - startedAt;
        });
        if (Date.now() - startedAt >= STABLE_RESET_MS) attempts = 0;
      } catch (error) {
        if (this.abort?.signal.aborted || gen !== this.generation) return;
        const message = error instanceof Error ? error.message : String(error);
        logger.warn("runtime-client", "stream_reconnecting", { attempt: attempts + 1, message });
        void connectedAt;
      }
      if (++attempts > MAX_ATTEMPTS) {
        logger.error("runtime-client", "retries_exhausted");
        this.cb.onStatus({ connected: false, reason: "runtime_unavailable" });
        await sleep(60_000, this.abort.signal);
        attempts = 0;
        continue;
      }
      const delay = Math.min(INITIAL_DELAY_MS * 2 ** (attempts - 1), MAX_DELAY_MS);
      this.cb.onStatus({ connected: false });
      await sleep(delay, this.abort.signal);
    }
  }

  public stop(): void {
    this.generation += 1;
    this.abort?.abort();
    this.abort = null;
  }

  private async assertHealthy(): Promise<void> {
    const res = await fetch(`${this.origin}${GAME_DATA_RUNTIME_PATHS.health}`, {
      signal: AbortSignal.timeout(750),
    });
    if (!res.ok) throw new Error(`health HTTP ${res.status}`);
    const parsed = gameDataRuntimeHealthSchema.safeParse(await res.json());
    if (!parsed.success) throw new Error("malformed_health");
    if (parsed.data.runtime.state !== "ready") throw new Error(`state=${parsed.data.runtime.state}`);
  }

  private async streamOnce(markConnected: (ok: boolean) => void): Promise<void> {
    let bootstrapped = false;
    let acceptedRevision = -1;

    const res = await fetch(`${this.origin}${GAME_DATA_RUNTIME_PATHS.events}`, {
      headers: { Accept: "text/event-stream" },
      signal: this.abort!.signal,
    });
    if (!res.ok || !res.body) throw new Error(`stream HTTP ${res.status}`);

    markConnected(true);
    logger.info("runtime-client", "stream_connected");
    const decoder = new TextDecoder();
    let buffer = "";

    for await (const chunk of res.body as AsyncIterable<Uint8Array>) {
      if (this.abort?.signal.aborted) return;
      buffer += decoder.decode(chunk, { stream: true });

      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) >= 0) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);

        const jsonLines = block
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trim());
        if (jsonLines.length === 0) continue; // comment/ping

        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(jsonLines.join("\n"));
        } catch {
          continue;
        }
        const frame = streamFrameSchema.safeParse(parsedJson);
        if (!frame.success) continue; // tolerate future kinds

        const msg = frame.data;
        if (!bootstrapped) {
          if (msg.kind !== "valorant_session_snapshot") continue;
          bootstrapped = true;
          acceptedRevision = msg.snapshot.revision;
          this.cb.onSnapshot(msg.snapshot);
          continue;
        }

        switch (msg.kind) {
          case "valorant_session_snapshot": {
            if (msg.snapshot.revision <= acceptedRevision) break;
            acceptedRevision = msg.snapshot.revision;
            this.cb.onSnapshot(msg.snapshot);
            break;
          }
          case "valorant_score_snapshot":
            this.cb.onScore(msg.score);
            break;
          case "new_info_update":
            this.cb.onFact({ kind: "new_info_update", key: msg.data.key, value: msg.data.value });
            break;
          case "new_game_event":
            this.cb.onFact({ kind: "new_game_event", key: msg.data.key, value: msg.data.value });
            break;
          case "game_detected":
          case "game_exit":
            this.cb.onGameState(msg);
            break;
          default:
            break;
        }
      }
    }
    if (!bootstrapped) throw new Error("invalid_bootstrap");
  }
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return;
  await new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true },
    );
  });
}
