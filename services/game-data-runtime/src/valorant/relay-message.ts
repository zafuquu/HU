/**
 * Relay-message shim — the subset of @blob-platform/common-lib/game-data/relay-message
 * the ported Valorant modules consume.
 */

/** Source tag on every relayed observation (OW = Overwolf GEP, OCR = screen reading). */
export type BlobDataSource = "OW" | "OCR" | string;

/** One relayed game-data packet (the runtime's wire unit). */
export interface BlobGameDataPacket {
  blob_data_source?: BlobDataSource;
  data: unknown;
  event: string;
}
