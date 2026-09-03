/**
 * Socket.IO producer — parity with the replica bridge control plane.
 *
 *   path:  /api/socket/io
 *   auth:  { ticket }   (from realtime.desktopProducerTicket)
 *   claim: game-data:producer:claim { protocolVersion:3, metadata:{roomId} }
 *          -> ack { broadcastSessionId, producerSessionId, disposition, ... }
 *   data:  game-data:fallback { kind:'game-snapshot'|'game-event', ... }
 *
 * The bridge's fallback path writes snapshots into Supabase itself, and its
 * internal WebRTC viewer feeds the same tables over the `blob-overlay-v3-reliable`
 * channel. We send via fallback to stay robust across NAT without a native
 * WebRTC dependency in Electron.
 */
import { randomUUID } from "node:crypto";
import { io, type Socket } from "socket.io-client";

import { logger } from "./logger";

export const GAME_DATA_PROTOCOL_VERSION = 3;
export const SOCKET_IO_PATH = "/api/socket/io";

export interface ClaimAck {
  ok: boolean;
  message?: string;
  reason?: string;
  broadcastSessionId?: string;
  producerSessionId?: string;
  protocolVersion?: number;
  resumeGrant?: string;
  dashboard?: unknown;
}

export interface RealtimeRoomSummary {
  roomId: string;
  roomName: string;
  roomGame: string;
  overlayId?: string | null;
}

export class ProducerClient {
  private socket: Socket | null = null;
  private producerSessionId: string | null = null;
  private broadcastSessionId: string | null = null;
  private disposed = false;
  private reauthorizing = false;
  private currentRoom: ProducerRoom | null = null;
  private ticketRefresher: (() => Promise<string>) | null = null;

  public constructor(private readonly bridgeOrigin: string) {}

  /**
   * Called when the bridge rejects the ticket (e.g. the bridge restarted and
   * lost its in-memory sessions): refetch a fresh ticket and reconnect.
   */
  public setTicketRefresher(refresh: () => Promise<string>): void {
    this.ticketRefresher = refresh;
  }

  public get sessionId(): string | null {
    return this.producerSessionId;
  }

  /** Connect, authenticate with the ticket, and claim the room as producer. */
  public async connect(ticket: string, room: ProducerRoom): Promise<ClaimAck> {
    this.currentRoom = room;
    return new Promise((resolve, reject) => {
      const socket = io(this.bridgeOrigin, {
        path: SOCKET_IO_PATH,
        auth: { ticket },
        transports: ["websocket"],
        reconnection: true,
        // Never give up: Socket.IO's default giveup behavior killed the producer
        // and presence heartbeat after a handful of failed reconnects.
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1_000,
        reconnectionDelayMax: 15_000,
      });
      this.socket = socket;
      socket.on("connect", () => {
        logger.info("producer", "socket_connected", { id: socket.id });
        socket.emit("game-data:producer:claim", { protocolVersion: 3, metadata: { roomId: room.roomId } }, (ack: unknown) => {
          const result = (ack ?? {}) as ClaimAck;
          if (result.ok) {
            this.producerSessionId = result.producerSessionId ?? randomUUID();
            this.broadcastSessionId = result.broadcastSessionId ?? null;
            logger.info("producer", "claimed", { producerSessionId: this.producerSessionId });
            resolve(result);
          } else {
            reject(new Error(result.reason || result.message || "claim rejected"));
          }
        });
      });
      socket.on("connect_error", (err) => {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("producer", "connect_error", { error: message });
        // The bridge lost our session (restart/crash): refetch the ticket and
        // reconnect with it instead of retrying the dead one forever.
        if (/unauthorized|invalid ticket/i.test(message)) {
          void this.refreshTicketAndReconnect();
        }
      });
      socket.on("disconnect", (reason) => {
        logger.info("producer", "disconnected", { reason });
      });
    });
  }

  private async refreshTicketAndReconnect(): Promise<void> {
    if (this.reauthorizing || this.disposed || !this.ticketRefresher || !this.currentRoom) return;
    this.reauthorizing = true;
    try {
      logger.info("producer", "ticket_refresh_started");
      this.socket?.close();
      this.socket = null;
      const ticket = await this.ticketRefresher();
      await this.connect(ticket, this.currentRoom).catch((error) =>
        logger.error("producer", "ticket_reconnect_failed", { error: String(error) }),
      );
      logger.info("producer", "ticket_refreshed_reconnected");
    } catch (error) {
      logger.error("producer", "ticket_refresh_failed", { error: String(error) });
      // Retry later — the bridge may still be starting.
      setTimeout(() => {
        this.reauthorizing = false;
        void this.refreshTicketAndReconnect();
      }, 15_000);
      return;
    }
    this.reauthorizing = false;
  }

  /** Publish the current game snapshot through the bridge fallback path. */
  public publishSnapshot(game: unknown): void {
    this.socket?.emit("game-data:fallback", { kind: "game-snapshot", game });
  }

  public publishEvent(event: unknown): void {
    this.socket?.emit("game-data:fallback", { kind: "game-event", event });
  }

  public async stop(): Promise<void> {
    this.disposed = true;
    if (this.socket && this.producerSessionId) {
      this.socket.emit("game-data:producer:stop", { producerSessionId: this.producerSessionId }, () => {});
    }
    this.socket?.close();
    this.socket = null;
  }
}

export interface ProducerRoom {
  roomId: string;
  roomName: string;
  roomGame: string;
  overlayId?: string | null;
}