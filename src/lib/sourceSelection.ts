/**
 * Broadcast source selection — pure, deterministic failover logic (Phase 12).
 *
 * Priority: LOCAL authoritative WS > BRIDGE WS > MIRROR (Supabase).
 *
 * Rules implemented (mirrors the Phase 12 spec):
 *  - A source is FRESH when connected and its last frame arrived within
 *    `staleMs` (receipt-time health; one clock for health decisions).
 *  - Snapshot CONTENT ordering uses the engine's monotonic `observedAt` —
 *    the same epoch for the same snapshot across all sources, so a source
 *    can never regress the display.
 *  - A candidate may take the display only if its observedAt is >= the
 *    currently displayed observedAt (old local revisions cannot reclaim).
 *  - Failover DOWN (current source stale) is immediate.
 *  - Recovery UP (a higher-priority source returns) requires the candidate
 *    to have been continuously fresh for `reclaimMs` (anti-oscillation
 *    hysteresis, default 1500ms).
 *  - The current source is kept while it stays fresh and valid (stability).
 */

export type SourceId = 'local' | 'bridge' | 'mirror'

export interface SourceSlot {
  /** Transport-level liveness. */
  connected: boolean
  /** Engine epoch (ms) of the last accepted frame — content version. */
  observedAt: number
  /** Receipt time (ms, Date.now-based) of the last frame — health clock. */
  lastAt: number
  /** When the slot last became fresh (ms) — used for reclaim hysteresis. */
  freshSince?: number
}

export interface SelectionInput {
  now: number
  current: SourceId | null
  /** Epoch currently displayed — candidates must not regress it. */
  displayedObservedAt: number
  staleMs?: number
  reclaimMs?: number
}

export interface SelectionResult {
  source: SourceId | null
  reason:
    | 'keep-current'
    | 'failover-down'
    | 'reclaim-up'
    | 'initial'
    | 'none'
}

const PRIORITY: SourceId[] = ['local', 'bridge', 'mirror']

export function isFresh(slot: SourceSlot | undefined, now: number, staleMs: number): boolean {
  return !!slot && slot.connected && now - slot.lastAt <= staleMs
}

export function pickSource(
  slots: Partial<Record<SourceId, SourceSlot>>,
  input: SelectionInput,
): SelectionResult {
  const staleMs = input.staleMs ?? 10_000
  const reclaimMs = input.reclaimMs ?? 1_500

  const fresh = (id: SourceId): boolean => isFresh(slots[id], input.now, staleMs)

  // STRICT eligibility — for RECOVERY to a higher-priority source. The
  // candidate must not regress the currently displayed content (observedAt
  // gate: an old local revision can never reclaim the display).
  const strictEligible = (id: SourceId): boolean => {
    if (!fresh(id)) return false
    const obs = slots[id]!.observedAt
    if (!obs) return !input.displayedObservedAt // bootstrap: nothing displayed yet
    return obs >= input.displayedObservedAt
  }

  // Best STRICT candidate by priority (recovery path).
  let strictBest: SourceId | null = null
  for (const id of PRIORITY) {
    if (strictEligible(id)) { strictBest = id; break }
  }

  // FALLBACK candidate — for immediate FAILOVER when the current source is
  // stale. The content gate is intentionally relaxed here: showing the next
  // priority source's slightly older COMPLETE snapshot beats a stale display
  // (whole-snapshot switch, never a field merge).
  let fallBack: SourceId | null = null
  for (const id of PRIORITY) {
    if (fresh(id)) { fallBack = id; break }
  }

  const current = input.current

  // Recovery decision first, so a healthy higher-priority source can reclaim
  // (with hysteresis) even while the lower-priority source is still fresh.
  if (strictBest && strictBest !== current) {
    const slot = slots[strictBest]!
    const freshSince = slot.freshSince ?? slot.lastAt
    const stable = input.now - freshSince >= reclaimMs
    const currentFresh = current ? fresh(current) : false
    if (stable || !currentFresh) {
      return { source: strictBest, reason: !current ? 'initial' : stable ? 'reclaim-up' : 'failover-down' }
    }
    // Hysteresis window — hold the current source while it is still fresh.
    if (current && currentFresh) return { source: current, reason: 'keep-current' }
  }

  if (current && strictEligible(current)) {
    return { source: current, reason: 'keep-current' }
  }

  // Current is stale/unusable — immediate failover to the best fresh source.
  if (fallBack) {
    return { source: fallBack, reason: current ? 'failover-down' : 'initial' }
  }

  return { source: null, reason: 'none' }
}