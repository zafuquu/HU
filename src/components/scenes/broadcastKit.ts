/**
 * Broadcast kit (?screen=broadcast) — shared asset + data helpers for the
 * redesigned overlay scenes. Everything derives from the SAME snapshot fields
 * the classic scenes consume; unknown telemetry renders as unknown (never faked).
 */
import type { CSSProperties } from 'react'
import { resolveAgent, agentByCodename } from '../../data/valAgentMeta'

const BLANK =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAALSURBVBhXY2AAAgAABQABqtXIUQAAAABJRU5ErkJggg=='
export const BLANK_IMG = BLANK

/** GEP codename (agentKey) wins, then the display-name meta, then a name guess. */
export const agentCodename = (p: any): string | null => {
  const key = p?.agentKey ? String(p.agentKey).replace(/_pc(_c)?$/i, '') : null
  return (
    (key && agentByCodename(key)?.codename) ||
    resolveAgent(p)?.codename ||
    (p?.agentName ? String(p.agentName).toLowerCase().replace(/[^a-z0-9]/g, '') : null)
  )
}
const agentAsset = (p: any, file: string): string => {
  const k = agentCodename(p)
  return k ? `/game/val/agents/${k}/${file}` : BLANK
}
export const agentIcon = (p: any) => agentAsset(p, 'icon.png')
export const agentPortrait = (p: any) => agentAsset(p, 'portrait.png')
export const agentBust = (p: any) => {
  const k = agentCodename(p)
  return k ? `/game/val/agents/${k}/bust.png` : null
}

const ABILITY_FILE = { C: 'grenade', Q: 'ability1', E: 'ability2', X: 'ultimate' } as const
export type AbilitySlot = keyof typeof ABILITY_FILE
export const abilityImg = (p: any, slot: AbilitySlot): string => {
  const k = agentCodename(p)
  return k ? `/game/val/agents/${k}/abilities/${ABILITY_FILE[slot]}.png` : BLANK
}

export type ChargeState = 'ready' | 'spent' | 'unknown'
/** GEP ability charges: local-player-only {C,Q,E,X} (0/1 coerced). */
export const chargeState = (st: any, slot: AbilitySlot): ChargeState => {
  if (!st || typeof st !== 'object') return 'unknown'
  const v = st[slot]
  if (v === true || v === 1 || v === '1') return 'ready'
  if (v === false || v === 0 || v === '0') return 'spent'
  return 'unknown'
}
/** Charge bar: lit = solid white, spent = dim fill, unknown = hollow outline. */
export const chargeBarStyle = (s: ChargeState): CSSProperties =>
  s === 'ready'
    ? { background: '#FFFFFF' }
    : s === 'spent'
      ? { background: 'rgba(255,255,255,0.18)' }
      : { background: 'transparent', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.30)' }

export const hexRgba = (hex: string | undefined, a: number): string => {
  let h = String(hex || '#28D091').replace('#', '')
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return `rgba(40,208,145,${a})`
  return `rgba(${r},${g},${b},${a})`
}

/** Positive HP is definitive alive evidence (the GEP flag can trail damage). */
export const hpOf = (p: any): number => {
  const n = p?.health == null ? null : Number(p.health)
  return n == null ? 100 : Math.max(0, Math.min(100, n))
}
export const aliveOf = (p: any): boolean => {
  const n = p?.health == null ? null : Number(p.health)
  if (n != null) return n > 0
  return p?.isAlive !== false
}
export const armorOf = (p: any): number => Number(p?.armor ?? p?.shield ?? 0) || 0
export const ultPointsOf = (p: any): number => Number(p?.currUltPoints ?? p?.ultPoints ?? p?.ultimate ?? 0) || 0
export const ultMaxOf = (p: any): number => Number(p?.maxUltPoints ?? p?.ultMax ?? p?.ultimateMax ?? 8) || 0
export const ultReadyOf = (p: any): boolean => {
  const m = ultMaxOf(p)
  return m > 0 && ultPointsOf(p) >= m
}
export const creditsOf = (p: any): number | null => {
  const v = Number(p?.credits ?? p?.money)
  return Number.isFinite(v) ? v : null
}
export const spentOf = (p: any): number | null => {
  const v = Number(p?.spentCredits ?? p?.spent ?? p?.loadoutValue)
  return Number.isFinite(v) ? v : null
}
export const kdaOf = (p: any) => ({
  k: Number(p?.kills ?? 0) || 0,
  d: Number(p?.deaths ?? 0) || 0,
  a: Number(p?.assists ?? 0) || 0,
})

export type RoundRow = { round: number; winner: 'blue' | 'red'; reason: string }
/**
 * Broadcast income ESTIMATE for the buy-round strip: a win pays 3000, a loss
 * pays the VAL loss-bonus tier for the trailing streak. GEP never publishes
 * forward-looking economy, so NEXT columns are projections by design.
 */
export const incomeEstimate = (roundHistory: RoundRow[] | undefined, side: 'blue' | 'red'): number => {
  const hist = roundHistory || []
  if (hist.length === 0) return 0
  if (hist[hist.length - 1]?.winner === side) return 3000
  let streak = 0
  for (let i = hist.length - 1; i >= 0; i--) {
    if (hist[i].winner !== side) streak++
    else break
  }
  const tiers = [1400, 1900, 2300, 2400, 2500]
  return tiers[Math.min(streak, tiers.length) - 1] ?? 0
}

export const REASON_ICON: Record<string, string> = {
  elimination: 'kills',
  detonation: 'detonated',
  defusion: 'defused',
  time: 'timeout',
}
