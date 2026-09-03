/**
 * Structured JSONL session logger mirroring the audited layout:
 *   %LOCALAPPDATA%\blob-fork\desktop\logs\app\session_<ts>.jsonl
 */
import fs from "node:fs";
import path from "node:path";

type Level = "debug" | "info" | "warn" | "error";

interface LogRecord {
  component: string;
  event: string;
  level: Level;
  context?: Record<string, unknown>;
  service: "blob-fork-desktop";
  timestamp: string;
}

class JsonlLogger {
  private stream: fs.WriteStream | null = null;

  private ensureStream(): fs.WriteStream | null {
    if (this.stream) return this.stream;
    try {
      const base = path.join(process.env.LOCALAPPDATA ?? process.cwd(), "blob-fork", "desktop", "logs", "app");
      fs.mkdirSync(base, { recursive: true });
      const stamp = new Date()
        .toISOString()
        .replace(/[:T]/g, "-")
        .replace(/\..*/, "");
      this.stream = fs.createWriteStream(path.join(base, `session_${stamp}.jsonl`), { flags: "a" });
      return this.stream;
    } catch {
      return null;
    }
  }

  public log(level: Level, component: string, event: string, context?: Record<string, unknown>): void {
    const record: LogRecord = {
      component,
      event,
      level,
      ...(context ? { context } : {}),
      service: "blob-fork-desktop",
      timestamp: new Date().toISOString(),
    };
    const line = JSON.stringify(record);
    // Mirror into stdout for headless runs.
    process.stdout.write(line + "\n");
    const stream = this.ensureStream();
    if (stream) stream.write(line + "\n");
  }

  public info(component: string, event: string, context?: Record<string, unknown>): void {
    this.log("info", component, event, context);
  }
  public warn(component: string, event: string, context?: Record<string, unknown>): void {
    this.log("warn", component, event, context);
  }
  public error(component: string, event: string, context?: Record<string, unknown>): void {
    this.log("error", component, event, context);
  }
  public debug(component: string, event: string, context?: Record<string, unknown>): void {
    this.log("debug", component, event, context);
  }
}

export const logger = new JsonlLogger();
