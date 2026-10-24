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

/** Resolved agent meta wins, then GEP codename (agentKey), then name guess. */
export const agentCodename = (p: any): string | null => {
  const resolved = resolveAgent(p)
  if (resolved?.codename) return resolved.codename

  const key = p?.agentKey ? String(p.agentKey).replace(/_pc(_c)?$/i, '') : null
  return (
    (key && agentByCodename(key)?.codename) ||
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
export const agentMasteryPortrait = (p: any) => {
  const k = agentCodename(p)
  return k ? `/game/val/agents/${k}/mastery.png` : null
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

/** Max ability charges / stacks per agent slot in Valorant (1, 2, or 3). */
export const getMaxAbilityCharges = (player: any, slot: AbilitySlot): number => {
  if (slot === 'X') return 1
  const k = (agentCodename(player) || '').toLowerCase()
  const name = String(player?.agentName || player?.agent || '').toLowerCase()
  if ((k === 'sarge' || k === 'brimstone' || name === 'brimstone') && slot === 'E') return 3

  const twoCharges: Record<string, AbilitySlot[]> = {
    hunter: ['Q'],
    sova: ['Q'],
    gumshoe: ['C', 'Q'],
    cypher: ['C', 'Q'],
    killjoy: ['C'],
    phoenix: ['Q'],
    wushu: ['C'],
    jett: ['C'],
    breach: ['Q'],
    wraith: ['C', 'E'],
    omen: ['C', 'E'],
    clay: ['Q'],
    raze: ['Q'],
    vampire: ['C', 'Q', 'E'],
    reyna: ['C', 'Q', 'E'],
    thorne: ['Q'],
    sage: ['Q'],
    stealth: ['Q'],
    yoru: ['Q'],
    grenadier: ['Q'],
    kayo: ['Q'],
    'kay/o': ['Q'],
    bountyhunter: ['C'],
    fade: ['C'],
    mage: ['C'],
    harbor: ['C'],
    cable: ['Q'],
    deadlock: ['Q'],
    sequoia: ['Q'],
    iso: ['Q'],
    smonk: ['E'],
    clove: ['E'],
    sprinter: ['Q'],
    neon: ['Q'],
    nox: ['Q'],
    vyse: ['Q'],
    cashew: ['E'],
    tejo: ['E'],
  }

  if (twoCharges[k]?.includes(slot) || twoCharges[name]?.includes(slot)) return 2
  return 1
}

/** Agents whose ultimate has an active channel / duration / transformed state. */
export const isDurationUltAgent = (player: any): boolean => {
  const k = (agentCodename(player) || '').toLowerCase()
  const name = String(player?.agentName || player?.agent || '').toLowerCase()
  const match = (n: string) => k === n || name === n || k.includes(n) || name.includes(n)
  return (
    match('viper') || match('pandemic') ||
    match('reyna') || match('vampire') ||
    match('phoenix') ||
    match('iso') || match('sequoia') ||
    match('yoru') || match('stealth') ||
    match('neon') || match('sprinter') ||
    match('chamber') || match('deadeye') ||
    match('jett') || match('wushu')
  )
}

/** Get number of bought / available charges for an ability slot. */
export const getAbilityCurrentCharges = (
  player: any,
  slot: AbilitySlot,
  st: any,
  max: number,
): number => {
  const altKey = slot.toLowerCase()
  const legacyName = slot === 'C' ? 'grenade' : slot === 'Q' ? 'ability1' : slot === 'E' ? 'ability2' : 'ultimate'

  // 1. Direct abilityState from local player GEP telemetry
  if (st && typeof st === 'object') {
    const val = st[slot] ?? st[altKey] ?? st[legacyName]
    if (typeof val === 'number') return Math.min(max, Math.max(0, val))
    if (val === true || val === 'ready' || val === 'active' || val === '1') return max
    if (val === false || val === 'spent' || val === 0 || val === '0' || val === 'disabled') return 0
  }

  // 2. Bought ability list array from engine (e.g. ['E'] or ['C', 'E'])
  if (Array.isArray(player?.abilities)) {
    if (player.abilities.length > 0) {
      const bought = player.abilities.includes(slot) || player.abilities.includes(altKey) || player.abilities.includes(legacyName)
      return bought ? max : 0
    }
  }

  // 3. Object-structured ability record
  const objVal = player?.abilities?.[slot]?.charges ?? player?.abilities?.[slot]?.count ?? player?.abilities?.[slot] ?? player?.abilities?.[altKey]
  if (typeof objVal === 'number') return Math.min(max, Math.max(0, objVal))
  if (objVal === false || objVal === 0 || objVal === 'spent') return 0
  if (objVal === true || objVal === 'ready') return max

  // 4. Default rules:
  // Signature ability 'E' is free & granted every round at round start in Valorant.
  // Purchasable abilities ('C' & 'Q') require purchase evidence — never light up when unbought.
  if (slot === 'E' && aliveOf(player)) {
    return max
  }
  return 0
}

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
/** Canonical maximum ultimate points per agent in Valorant (7, 8, or 9). */
export const AGENT_ULT_MAX: Record<string, number> = {
  // 7 points
  sarge: 7,
  brimstone: 7,
  smonk: 7,
  clove: 7,
  gumshoe: 7,
  cypher: 7,
  mage: 7,
  harbor: 7,
  wraith: 7,
  omen: 7,
  phoenix: 7,
  vampire: 7,
  reyna: 7,
  guide: 7,
  skye: 7,
  stealth: 7,
  yoru: 7,

  // 9 points
  breach: 9,
  killjoy: 9,
  pandemic: 9,
  viper: 9,

  // 8 points
  rift: 8,
  astra: 8,
  deadeye: 8,
  chamber: 8,
  cable: 8,
  deadlock: 8,
  bountyhunter: 8,
  fade: 8,
  aggrobot: 8,
  gekko: 8,
  sequoia: 8,
  iso: 8,
  wushu: 8,
  jett: 8,
  grenadier: 8,
  kayo: 8,
  'kay/o': 8,
  sprinter: 8,
  neon: 8,
  clay: 8,
  raze: 8,
  thorne: 8,
  sage: 8,
  hunter: 8,
  sova: 8,
  cashew: 8,
  tejo: 8,
  nox: 8,
  vyse: 8,
}

export const getAgentUltMax = (p: any): number => {
  const k = (agentCodename(p) || '').toLowerCase()
  const name = String(p?.agentName || p?.agent || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  return AGENT_ULT_MAX[k] ?? AGENT_ULT_MAX[name] ?? 8
}

export const ultMaxOf = (p: any): number => {
  const v = Number(p?.maxUltPoints ?? p?.ultMax ?? p?.ultimateMax)
  if (Number.isFinite(v) && v >= 6 && v <= 12) return v
  return getAgentUltMax(p)
}
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

/** Broadcast-kit identity. The redesigned overlay kit ships as "Version 1";
 *  the classic overlay remains the default theme for every scene. */
export type KitKind = 'classic' | 'version1'

export const KIT_VERSION_LABEL = 'Version 1'
export const KIT_CLASSIC_LABEL = 'Classic'
export const KIT_DEFAULT: KitKind = 'classic'

/** Tokens that opt into the Version 1 kit. */
const V1_TOKENS = new Set(['version1', 'version 1', 'v1', 'broadcast'])
/** Tokens that opt into the classic kit. */
const CLASSIC_TOKENS = new Set(['classic'])

function pickKit(token: string | null): KitKind | null {
  if (!token) return null
  const t = token.toLowerCase()
  if (CLASSIC_TOKENS.has(t)) return 'classic'
  if (V1_TOKENS.has(t)) return 'version1'
  return null
}

/**
 * Resolve which kit an overlay should render.
 * Priority: explicit ?kit= param → ?screen= param → persisted workspace
 * setting (state.broadcastKit, synced to localStorage + Supabase from the HUD
 * editor / live game page) → default classic unless overridden.
 */
export function resolveKitKind(
  kitParam: string | null,
  screenParam: string | null,
  overlayId: string | null,
  persistedKit: string | null,
): KitKind {
  return (
    pickKit(kitParam) ??
    pickKit(screenParam) ??
    pickKit(overlayId) ??
    pickKit(persistedKit) ??
    KIT_DEFAULT
  )
}
