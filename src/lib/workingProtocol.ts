/**
 * workingProtocol.ts — P1 sync-protocol primitives for the broadcast workspace.
 *
 * Fits BLOB's working/patch envelope concepts onto this app's existing
 * full-blob Supabase sync (`site_settings.broadcast:*` rows):
 *
 *  - `_rev`  monotonic write stamp (this app already used a timestamp-ordered
 *            revision via bumpRev(); every writer — room AND tournament keys,
 *            dashboard AND server API — now stamps it through here).
 *  - `_sub`  submissionId: unique per flush (crypto.randomUUID). Lets readers
 *            deduplicate echoes of their own writes and distinguish two
 *            writers that landed on the same `_rev`.
 *  - `_epoch` per-tab/session writer id (attribution + tie-break debugging).
 *  - `_ts`   wall-clock write time (human/debug; ordering is `_rev`'s job).
 *
 * Readers call classifyRemote() instead of ad-hoc `remoteRev <= local` checks:
 *
 *    'same'    echo of the write we already applied (same _sub)  → ignore
 *    'stale'   older revision (or legacy row with no _rev)        → ignore
 *    'apply'   strictly newer revision                            → adopt
 *    'conflict' equal _rev but different _sub (two writers tied)  → refetch
 *                (or surface as pending when local edits are dirty)
 *
 * NOTE: sync is full-snapshot (every write carries the whole workspace), so a
 * missed intermediate event does not lose data — the newest snapshot wins.
 * True patch-gap bookkeeping (`revision-gap → resync-required`) becomes
 * necessary only when we move to partial patches.
 */

export type WorkingEnvelope = {
  _rev: number
  _sub: string
  _epoch: string
  _ts: number
}

/** Stable id for this tab/session — stamped on every outgoing write. */
export const WORKSPACE_EPOCH: string = (() => {
  try {
    return crypto.randomUUID()
  } catch {
    return 'ep_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
  }
})()

/** Fresh submissionId (idempotency key) — one per save flush. */
export function newSubmission(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return 'sub_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
  }
}

/** Stamp a workspace snapshot with the full envelope before persisting. */
export function stampEnvelope<T extends object>(state: T, rev: number, sub?: string): T & WorkingEnvelope {
  return {
    ...state,
    _rev: rev,
    _sub: sub ?? newSubmission(),
    _epoch: WORKSPACE_EPOCH,
    _ts: Date.now(),
  }
}

export type LocalTracker = { rev: number; sub: string }
export type RemoteVerdict = 'apply' | 'stale' | 'same' | 'conflict'

export function classifyRemote(remote: unknown, local: LocalTracker): RemoteVerdict {
  if (!remote || typeof remote !== 'object') return 'stale'
  const r = remote as Partial<WorkingEnvelope>
  const rev = Number(r._rev || 0)
  const sub = typeof r._sub === 'string' ? r._sub : ''
  // Legacy rows written before the envelope existed: never clobber local
  // state that already has revisions (preserves the old mount-time rule).
  if (!rev) return 'stale'
  if (sub && sub === local.sub) return 'same'
  if (rev < local.rev) return 'stale'
  if (rev === local.rev) return sub ? 'conflict' : 'stale'
  return 'apply'
}

/** Score model: displayed = override ?? derived ?? fallback (BLOB semantics). */
export function displayScore(
  override: number | null | undefined,
  derived: number | null | undefined,
  fallback: number,
): number {
  if (override !== null && override !== undefined) return override
  if (derived !== null && derived !== undefined) return derived
  return fallback
}
