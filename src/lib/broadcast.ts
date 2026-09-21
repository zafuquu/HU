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

/** The winning team's side from the STARTING side (real ground truth) + the
 *  round window — Valorant sides: start side for rounds 1-12, opposite for
 *  13-24, alternating per OT round after. This replaces the old
 *  "team_0 attacked first" parity guess, which was inverted for every
 *  defense-start player. */
export function winnerSideFromStart(
  winner: 'blue' | 'red' | null | undefined,
  viewerStartSide: 'attack' | 'defense' | null | undefined,
  round: number | null | undefined,
): 'attacker' | 'defender' | null {
  if (!winner || !viewerStartSide || !round || round < 1) return null
  const viewersSide: 'attacker' | 'defender' =
    round <= 12 ? (viewerStartSide === 'attack' ? 'attacker' : 'defender')
    : round <= 24 ? (viewerStartSide === 'attack' ? 'defender' : 'attacker')
    : ((round - 25) % 2 === 0
        ? (viewerStartSide === 'attack' ? 'defender' : 'attacker')
        : (viewerStartSide === 'attack' ? 'attacker' : 'defender'))
  return winner === 'blue' ? viewersSide : viewersSide === 'attacker' ? 'defender' : 'attacker'
}

/** Canonical round-win reason → presentation (label + icon asset stem).
 *  One explicit mapping; unknown reasons MUST NOT collapse into elimination. */
export const ROUND_WIN_REASON_PRESENTATION: Record<string, { label: string; icon: string }> = {
  elimination: { label: 'Wipeout', icon: 'kills' },
  detonation: { label: 'Spike Detonated', icon: 'detonated' },
  defusion: { label: 'Spike Defused', icon: 'defused' },
  time: { label: 'Timeout', icon: 'timeout' },
}