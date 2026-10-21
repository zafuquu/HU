import React from 'react'
import { getShieldImg, getWeaponImg } from '../classic/IngameHudScene'
import {
  BLANK_IMG,
  abilityImg,
  agentCodename,
  agentIcon,
  chargeBarStyle,
  chargeState,
  creditsOf,
  hexRgba,
  incomeEstimate,
  kdaOf,
  spentOf,
  ultReadyOf,
  REASON_ICON,
  type RoundRow,
} from '../broadcastKit'

/**
 * Broadcast kit — buy-round scene (VCT economy strip): team econ summary,
 * round-win timeline, and per-player cards with ability charge bars.
 */

interface BroadcastBuyRoundProps {
  leftTeamName?: string
  rightTeamName?: string
  leftTeamSeed?: number | string
  rightTeamSeed?: number | string
  leftTeamColor?: string
  rightTeamColor?: string
  leftTeamPlayers?: any[]
  rightTeamPlayers?: any[]
  economy?: {
    left: { total: number; avgCredits: number; ecoType: string; playerCount: number }
    right: { total: number; avgCredits: number; ecoType: string; playerCount: number }
  } | null
  sponsorImageUrl?: string | null
  roundHistory?: RoundRow[]
  mapHistoryItems?: { slot: string; mapId: string; mapName: string; kind: 'pick' | 'ban' | 'decider' | 'pool'; score?: string }[]
  isToggled?: (id: string) => boolean
}

const KIT_BUY_CSS = `
@keyframes kitBuyIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
`

const TEAM_INCOME_SIDE = { left: 'blue', right: 'red' } as const

function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col items-start leading-none">
      <span className="font-baijam text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">{label}</span>
      <span className="mt-1 font-barlowCond text-[21px] font-extrabold tabular-nums" style={{ color: color || '#E8EAF0' }}>
        {value}
      </span>
    </div>
  )
}

/** Round-win timeline: numbers row + two icon rows (left team top, right bottom). */
function RoundTimeline({
  roundHistory,
  leftTeamColor,
  rightTeamColor,
  leftName,
  rightName,
  currentRound,
}: {
  roundHistory: RoundRow[]
  leftTeamColor: string
  rightTeamColor: string
  leftName: string
  rightName: string
  currentRound: number | null
}) {
  if (roundHistory.length === 0) return null
  const maxRound = Math.max(24, ...roundHistory.map(h => Number(h.round) || 0))
  const groups: number[][] = []
  for (let s = 1; s <= maxRound; s += 24) {
    groups.push(Array.from({ length: Math.min(24, maxRound - s + 1) }, (_, i) => s + i))
  }
  const wonRounds = new Set(roundHistory.map(h => h.round))
  const cellTint = (hex: string, on: boolean): React.CSSProperties =>
    on
      ? { background: hexRgba(hex, 0.28), boxShadow: `inset 0 0 0 1px ${hexRgba(hex, 0.55)}` }
      : { background: 'rgba(255,255,255,0.03)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.10)' }
  return (
    <div className="flex flex-col items-center gap-[3px]">
      {groups.map((group, gi) => (
        <div key={gi} className="flex items-start gap-6">
          {group.map(r => {
            const row = roundHistory.find(h => h.round === r)
            return (
              <div key={r} className="flex w-[24px] flex-col items-center gap-[3px]">
                <span
                  className="font-baijam text-[10px] font-bold tabular-nums"
                  style={{
                    color: currentRound === r ? '#FFD166' : 'rgba(255,255,255,0.55)',
                    borderBottom: currentRound === r ? '2px solid #FFD166' : '2px solid transparent',
                  }}
                >
                  {r}
                </span>
                <div className="grid h-[19px] w-[24px] place-items-center" style={cellTint(leftTeamColor, !!row && row.winner === 'blue')}>
                  {row && row.winner === 'blue' && wonRounds.has(r) && (
                    <img src={`/game/val/roundWinReason/${REASON_ICON[row.reason] || 'kills'}.webp`} alt="" className="size-[13px] object-contain" />
                  )}
                </div>
                <div className="grid h-[19px] w-[24px] place-items-center" style={cellTint(rightTeamColor, !!row && row.winner === 'red')}>
                  {row && row.winner === 'red' && wonRounds.has(r) && (
                    <img src={`/game/val/roundWinReason/${REASON_ICON[row.reason] || 'kills'}.webp`} alt="" className="size-[13px] object-contain" />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ))}
      <div className="mt-0.5 flex w-full justify-between px-1">
        <span className="font-unbounded text-[10px] font-extrabold uppercase text-white/80">{leftName}</span>
        <span className="font-unbounded text-[10px] font-extrabold uppercase text-white/80">{rightName}</span>
      </div>
    </div>
  )
}

/** Buy-card ability cell: icon + charge bar (X = ult progress bar). */
function BuyAbility({ player, slot, st }: { player: any; slot: 'C' | 'Q' | 'E'; st: any }) {
  const state = chargeState(st, slot)
  return (
    <div className="flex flex-col items-center">
      <img
        src={abilityImg(player, slot)}
        alt=""
        className="size-[19px] object-contain"
        style={{ opacity: state === 'ready' ? 1 : state === 'spent' ? 0.4 : 0.55 }}
        onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
      />
      <span className="mt-1 block h-[3px] w-[18px] rounded-full" style={chargeBarStyle(state)} />
    </div>
  )
}

function BuyUlt({ player, teamColor }: { player: any; teamColor: string }) {
  const ready = ultReadyOf(player)
  return (
    <div className="relative grid size-[20px] shrink-0 place-items-center">
      {ready && (
        <span
          className="absolute -inset-[2px] rounded-full border-2 border-dashed"
          style={{ borderColor: teamColor }}
        />
      )}
      <span
        className="absolute inset-0 rounded-full border border-white/35 bg-black/80"
        style={ready ? { boxShadow: `0 0 10px 3px ${hexRgba(teamColor, 0.9)}` } : undefined}
      />
      <img
        src={abilityImg(player, 'X')}
        alt=""
        className="relative size-[12px] object-contain"
        style={{ opacity: ready ? 1 : 0.7 }}
        onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
      />
    </div>
  )
}

function EconCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center leading-none">
      <span className="font-baijam text-[8px] font-bold uppercase tracking-[0.14em] text-white/40">{label}</span>
      <span className="mt-[3px] font-barlowCond text-[15px] font-extrabold tabular-nums" style={{ color }}>
        {value}
      </span>
    </div>
  )
}

/** One buy-round player card (portrait, name, KDA, abilities, gun+shield, econ). */
function KitBuyCard({
  player,
  teamColor,
  income,
}: {
  player: any
  teamColor: string
  income: number
}) {
  const alias = player.alias || player.name || player.riotId || 'Player'
  const { k, d, a } = kdaOf(player)
  const credits = creditsOf(player) ?? 0
  const spent = spentOf(player) ?? 0
  const next = Math.max(0, credits + income)
  const st = player.abilityState
  const iconFallback = agentCodename(player) ? `/game/val/agents/${agentCodename(player)}/icon.png` : BLANK_IMG
  return (
    <div className="relative w-[152px] overflow-hidden rounded-[3px] bg-[#0B0E13]/95">
      {/* top accent */}
      <div className="h-[3px] w-full" style={{ background: teamColor }} />
      {/* Agent icon */}
      <div className="relative mt-2 grid h-[48px] w-[48px] place-items-center">
        <img
          src={agentIcon(player) || iconFallback}
          alt=""
          className="size-[48px] object-contain"
          onError={e => { (e.currentTarget as HTMLImageElement).src = iconFallback }}
        />
      </div>
      <p
        className="mt-1 truncate px-2 text-center font-schabo text-[21px] uppercase leading-none"
        style={{ color: teamColor }}
      >
        {alias}
      </p>
      <p className="mt-1 text-center font-barlowCond text-[14px] font-semibold tabular-nums text-white/80">
        {k}/{d}/{a}
      </p>
      {/* Abilities + charge bars */}
      <div className="mt-2 flex items-start justify-center gap-3">
        <BuyAbility player={player} slot="C" st={st} />
        <BuyAbility player={player} slot="Q" st={st} />
        <BuyAbility player={player} slot="E" st={st} />
        <BuyUlt player={player} teamColor={teamColor} />
      </div>
      {/* Weapon + shield */}
      <div className="mt-2 flex h-[26px] items-center justify-center gap-2">
        <img
          src={getWeaponImg(player.weapon || player.weaponName)}
          alt=""
          className="max-h-[22px] max-w-[92px] object-contain"
          onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
        />
        <img src={getShieldImg(player)} alt="" className="h-[20px] object-contain" onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }} />
      </div>
      {/* Econ */}
      <div className="mt-2 grid grid-cols-3 gap-0.5 px-1.5 pb-2">
        <EconCell label="SPENT" value={`-${spent}`} color="#FF4D4D" />
        <EconCell label="REM" value={String(credits)} color="#FFD166" />
        <EconCell label="NEXT" value={String(next)} color="rgba(255,255,255,0.62)" />
      </div>
    </div>
  )
}

export function BroadcastBuyRoundScene(props: BroadcastBuyRoundProps) {
  const {
    leftTeamName = 'LEFT',
    rightTeamName = 'RIGHT',
    leftTeamColor = '#28D091',
    rightTeamColor = '#FF3549',
    leftTeamPlayers = [],
    rightTeamPlayers = [],
    economy = null,
    roundHistory = [],
    mapHistoryItems = [],
    sponsorImageUrl = null,
    isToggled = () => true,
  } = props
  if (!isToggled('buy-round')) return null
  const currentRound = roundHistory.length > 0 ? (Number(roundHistory[roundHistory.length - 1]?.round) || 0) + 1 : null
  const incomeLeft = incomeEstimate(roundHistory, TEAM_INCOME_SIDE.left)
  const incomeRight = incomeEstimate(roundHistory, TEAM_INCOME_SIDE.right)
  const sum = (arr: any[], f: (p: any) => number | null) => arr.reduce((acc, p) => acc + (f(p) ?? 0), 0)
  const leftSpent = sum(leftTeamPlayers, spentOf)
  const rightSpent = sum(rightTeamPlayers, spentOf)
  const leftRem = sum(leftTeamPlayers, creditsOf)
  const rightRem = sum(rightTeamPlayers, creditsOf)
  const nextMin = (arr: any[], income: number) =>
    arr.length > 0 ? Math.min(...arr.map(p => (creditsOf(p) ?? 0) + income)) : 0
  // The engine's economy totals (when present) back the REM summary line.
  const remLeft = economy?.left?.total != null ? economy.left.total : leftRem
  const remRight = economy?.right?.total != null ? economy.right.total : rightRem

  // Map history (non-pool, non-ban entries, labeled)
  const activeMapHistory = (mapHistoryItems || []).filter((i: any) => i.kind !== 'pool' && i.kind !== 'ban')
  const labeledMapHistory = (() => {
    let n = 0
    return activeMapHistory.map((item: any) => {
      if (item.kind === 'decider') return { ...item, label: 'DECIDER:' }
      if (item.kind === 'ban') return { ...item, label: 'BAN:' }
      n += 1
      return { ...item, label: `MAP ${n}:` }
    })
  })()
  return (
    <div
      className="relative size-full select-none overflow-hidden"
      style={{
        width: 1920,
        height: 1080,
        background:
          'linear-gradient(90deg, rgba(29,205,155,0.10) 0%, rgba(6,8,12,0) 26%), linear-gradient(270deg, rgba(255,56,73,0.10) 0%, rgba(6,8,12,0) 26%), #05070B',
      }}
    >
      <style>{KIT_BUY_CSS}</style>
      {/* Map history strip (top left) */}
      {labeledMapHistory.length > 0 && (
        <div className="absolute top-[44px] left-[44px] flex items-center gap-2 rounded-sm border border-white/20 bg-black/80 px-3 py-1 shadow-xl z-20">
          {labeledMapHistory.map((item: any, i: number) => (
            <React.Fragment key={item.slot + item.mapId + i}>
              {i > 0 && <span className="text-white/30">|</span>}
              <span className="font-baijam text-[10px] font-bold text-white/70 uppercase">{item.label}</span>
              <span className={'font-baijam text-[10px] font-extrabold uppercase ' + (item.kind === 'ban' ? 'text-[#FF4848]' : item.kind === 'decider' ? 'text-white' : 'text-[#1DCD9B]')}>
                {item.mapName}
              </span>
              {item.score ? <span className="font-baijam text-[10px] font-bold text-white/80 px-1">{item.score}</span> : null}
            </React.Fragment>
          ))}
        </div>
      )}
      {/* Sponsor (top right) */}
      {sponsorImageUrl && (
        <div className="absolute top-[44px] right-[44px] z-20">
          <img src={sponsorImageUrl} alt="sponsor" className="h-[64px] object-contain drop-shadow-lg z-20" />
        </div>
      )}
      {/* ===== Top bar: team econ + round timeline ===== */}
      <div
        className="absolute inset-x-0 top-0 flex items-center justify-between bg-black/45 px-8 py-3"
        style={{ animation: 'kitBuyIn 320ms ease-out' }}
      >
        <div className="flex items-center gap-7">
          <span className="font-schabo text-[34px] uppercase leading-none" style={{ color: leftTeamColor }}>
            {leftTeamName}
          </span>
          <StatCell label="SPENT" value={`-${leftSpent}`} color="#FF4D4D" />
          <StatCell label="REM" value={String(remLeft)} color="#FFD166" />
          <StatCell label="NEXT(MIN)" value={String(nextMin(leftTeamPlayers, incomeLeft))} />
        </div>
        <RoundTimeline
          roundHistory={roundHistory}
          leftTeamColor={leftTeamColor}
          rightTeamColor={rightTeamColor}
          leftName={leftTeamName}
          rightName={rightTeamName}
          currentRound={currentRound}
        />
        <div className="flex items-center gap-7">
          <StatCell label="NEXT(MIN)" value={String(nextMin(rightTeamPlayers, incomeRight))} />
          <StatCell label="REM" value={String(remRight)} color="#FFD166" />
          <StatCell label="SPENT" value={`-${rightSpent}`} color="#FF4D4D" />
          <span className="font-schabo text-[34px] uppercase leading-none" style={{ color: rightTeamColor }}>
            {rightTeamName}
          </span>
        </div>
      </div>
      {/* ===== Scoreline ===== */}
      <div
        className="absolute inset-x-0 bottom-[210px] flex items-center justify-center px-8"
        style={{ animation: 'kitBuyIn 520ms ease-out' }}
      >
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <span className="font-baijam text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">SPENT</span>
            <span className="font-schabo text-[20px] font-extrabold tabular-nums text-[#FF4D4D]">-{leftSpent}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-baijam text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">REM</span>
            <span className="font-schabo text-[20px] font-extrabold tabular-nums text-[#FFD166]">{remLeft}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-baijam text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">NEXT</span>
            <span className="font-schabo text-[20px] font-extrabold tabular-nums text-white">{nextMin(leftTeamPlayers, incomeLeft)}</span>
          </div>
          <div className="w-px h-[24px] bg-white/20 mx-4" />
          <div className="flex items-center gap-2">
            <span className="font-baijam text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">NEXT</span>
            <span className="font-schabo text-[20px] font-extrabold tabular-nums text-white">{nextMin(rightTeamPlayers, incomeRight)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-baijam text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">REM</span>
            <span className="font-schabo text-[20px] font-extrabold tabular-nums text-[#FFD166]">{remRight}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-baijam text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">SPENT</span>
            <span className="font-schabo text-[20px] font-extrabold tabular-nums text-[#FF4D4D]">-{rightSpent}</span>
          </div>
        </div>
      </div>
      {/* ===== Player cards ===== */}
      <div
        className="absolute inset-x-0 bottom-[16px] flex items-center px-6"
        style={{ animation: 'kitBuyIn 420ms ease-out' }}
      >
        <div className="flex gap-2.5">
          {leftTeamPlayers.map((p: any, i: number) => (
            <KitBuyCard key={p.id || i} player={p} teamColor={leftTeamColor} income={incomeLeft} />
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex gap-2.5">
          {rightTeamPlayers.map((p: any, i: number) => (
            <KitBuyCard key={p.id || i} player={p} teamColor={rightTeamColor} income={incomeRight} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default BroadcastBuyRoundScene
