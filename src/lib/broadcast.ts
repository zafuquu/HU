/**
 * Broadcast presentation helpers — the single explicit mapping layer between
 * canonical game-state values and what the overlay displays (Phase 13).
 */

/** The winning team's side, derived from the viewer's live side.
 *  The viewer is ALWAYS the blue/left team, so the viewer's live side is the
 *  winner's side only when blue won — otherwise it is the opposite side.
 *  (Using the raw viewer side as the winner's side inverted the
 *  ATTACKER/DEFENDER label whenever the enemy won.) */
export function winnerSideFromViewer(
  winner: 'blue' | 'red' | null | undefined,
  viewerSide: 'attack' | 'defense' | null | undefined,
): 'attacker' | 'defender' | null {
  if (!winner || !viewerSide) return null
  const viewerSideLabel: 'attacker' | 'defender' = viewerSide === 'attack' ? 'attacker' : 'defender'
  return winner === 'blue' ? viewerSideLabel : viewerSideLabel === 'attacker' ? 'defender' : 'attacker'
}

/** Canonical round-win reason → presentation (label + icon asset stem).
 *  One explicit mapping; unknown reasons MUST NOT collapse into elimination. */
export const ROUND_WIN_REASON_PRESENTATION: Record<string, { label: string; icon: string }> = {
  elimination: { label: 'Wipeout', icon: 'kills' },
  detonation: { label: 'Spike Detonated', icon: 'detonated' },
  defusion: { label: 'Spike Defused', icon: 'defused' },
  time: { label: 'Timeout', icon: 'timeout' },
}