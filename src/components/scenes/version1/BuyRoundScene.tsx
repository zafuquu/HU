import React from 'react'
import { getShieldImg, getWeaponImg } from '../classic/IngameHudScene'
import { Scorebug } from './IngameHudScene'
import { EconomyTracker } from '../EconomyTracker'
import {
  BLANK_IMG,
  abilityImg,
  agentCodename,
  agentIcon,
  creditsOf,
  getMaxAbilityCharges,
  getAbilityCurrentCharges,
  incomeEstimate,
  kdaOf,
  spentOf,
  ultReadyOf,
  ultPointsOf,
  ultMaxOf,
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
  leftTeamLogo?: string | null
  rightTeamLogo?: string | null
  scoreLeft?: number
  scoreRight?: number
  seriesScoreLeft?: number
  seriesScoreRight?: number
  roundText?: string
  roundHistory?: RoundRow[]
  mapHistoryItems?: { slot: string; mapId: string; mapName: string; kind: 'pick' | 'ban' | 'decider' | 'pool'; score?: string }[]
  isToggled?: (id: string) => boolean
  seriesTitleText?: string
  gameSeriesText?: string
  eventTitleText?: string
  timerText?: string
  timerColor?: string
  bestOf?: number
  showSeries?: boolean
  showLogos?: boolean
  showSponsors?: boolean
  smallVariant?: boolean
  activeComponentId?: string | null
  onSelectComponent?: (id: string) => void
}

const KIT_BUY_CSS = `
@keyframes kitBuyIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes kitBuyScoreIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes v1InwardLeft {
  0% { transform: translateX(-80px); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
}
@keyframes v1InwardRight {
  0% { transform: translateX(80px); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
}
`

export const TEAM_INCOME_SIDE = { left: 'blue', right: 'red' } as const

/** Match history grid in the middle above player panels with round reason win icons */
export function MatchHistoryGrid({
  roundHistory = [],
  leftTeamName = 'LEFT',
  rightTeamName = 'RIGHT',
  leftTeamColor = '#28D091',
  rightTeamColor = '#FF3549',
}: {
  roundHistory: RoundRow[]
  leftTeamName: string
  rightTeamName: string
  leftTeamColor: string
  rightTeamColor: string
}) {
  const maxRound = Math.max(0, ...(roundHistory || []).map((h: any) => Number(h?.round) || 0))
  const isSecondHalf = maxRound >= 12

  const otMax = Math.max(24, ...(roundHistory || []).map((h: any) => Number(h?.round) || 0))
  const otGroups: number[][] = []
  for (let s = 25; s <= otMax; s += 24) {
    otGroups.push(Array.from({ length: Math.min(24, otMax - s + 1) }, (_, i) => s + i))
  }
  const tint = (hex: string | undefined, on: boolean) => {
    if (!on) return 'rgb(26, 26, 26)'
    let h = String(hex || '#1DCD9B').replace('#', '')
    if (h.length === 3) h = h.split('').map(c => c + c).join('')
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const b = parseInt(h.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, 0.55)`
  }

  return (
    <div className="flex w-[1065px] flex-col mx-auto">
      {/* Overtime section stacked ABOVE the original grid when maxRound >= 25 */}
      {otGroups.length > 0 && (
        <div className="mb-1 flex w-full flex-col gap-1">
          {otGroups.map((g: number[], gi: number) => (
            <div key={'ot' + gi} className="flex h-[28px] w-full items-center gap-1 rounded-sm border border-white/20 bg-[#151515] p-1 shadow-md">
              <div className="w-[119px] shrink-0 text-center font-baijam text-[11px] font-bold uppercase text-[#FFD166]">
                OT {gi + 1}
              </div>
              <div className="flex h-full flex-1 flex-row gap-1 overflow-x-auto">
                {g.map((n: number) => {
                  const rec = (roundHistory || []).find((h: any) => h.round === n)
                  const wonLeft = !!rec && rec.winner === 'blue'
                  const wonRight = !!rec && rec.winner === 'red'
                  const icon = rec ? REASON_ICON[rec.reason] || 'kills' : null
                  return (
                    <div key={n} className="flex h-full w-[34.6px] shrink-0 flex-col items-center justify-center gap-[2px]">
                      <div className="flex w-full flex-1 items-center justify-center" style={{ backgroundColor: tint(leftTeamColor, wonLeft) }}>
                        {wonLeft && icon && <img className="size-[80%] object-contain" src={`/game/val/roundWinReason/${icon}.webp`} alt={rec.reason} />}
                      </div>
                      <div className="flex w-full flex-1 items-center justify-center" style={{ backgroundColor: tint(rightTeamColor, wonRight) }}>
                        {wonRight && icon && <img className="size-[80%] object-contain" src={`/game/val/roundWinReason/${icon}.webp`} alt={rec.reason} />}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 1st Half / 2nd Half header */}
      <div className="font-semibold flex h-[27px] w-full items-center gap-1 rounded-[3.37px] bg-[#0000007A] p-1 font-mussels text-[12px] tracking-wider uppercase">
        <div className={`w-[119px] text-center ${!isSecondHalf ? 'text-white' : 'text-[#737373]'}`}>
          <h1>{!isSecondHalf ? '1st Half' : '2nd Half'}</h1>
        </div>
        <div className="flex h-full flex-1 justify-between">
          <div className={`mr-3 flex h-full flex-row justify-end gap-1 overflow-hidden transition-opacity duration-300 ${isSecondHalf ? 'opacity-40' : 'opacity-100'}`}>
            {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(n => (
              <div key={n} className={`w-[34.6px] text-center font-baijam text-[12px] ${!isSecondHalf ? 'text-[#D2D2D2]' : 'text-[#737373]'}`}>
                <h1>{n}</h1>
              </div>
            ))}
          </div>
          <div className={`flex h-full flex-row justify-end gap-1 overflow-hidden transition-opacity duration-300 ${isSecondHalf ? 'opacity-100' : 'opacity-40'}`}>
            {['13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24'].map(n => (
              <div key={n} className={`w-[34.6px] text-center font-baijam text-[12px] ${isSecondHalf ? 'text-[#D2D2D2]' : 'text-[#737373]'}`}>
                <h1>{n}</h1>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grid rows */}
      <div className="mt-1 flex w-full flex-row items-center gap-1 rounded-sm border border-white/20 bg-[#151515] p-1 shadow-lg">
        {/* Team names column */}
        <div className="font-semibold flex h-[50px] w-[119px] shrink-0 flex-col items-center gap-1 font-barlowCond uppercase">
          <div className="font-unbounded flex size-full flex-1 items-center bg-[#1A1A1A] font-extrabold text-white overflow-hidden">
            <div className="h-full w-[6px] shrink-0" style={{ backgroundColor: leftTeamColor }} />
            <span className="truncate px-2 text-[12px]">{leftTeamName}</span>
          </div>
          <div className="font-unbounded flex size-full flex-1 items-center bg-[#1A1A1A] font-extrabold text-white overflow-hidden">
            <div className="h-full w-[6px] shrink-0" style={{ backgroundColor: rightTeamColor }} />
            <span className="truncate px-2 text-[12px]">{rightTeamName}</span>
          </div>
        </div>

        {/* Round boxes */}
        <div className="flex h-[50px] flex-1 justify-between">
          {/* Half 1 */}
          <div className={`flex h-full flex-row justify-end gap-1 overflow-hidden transition-opacity duration-300 ${isSecondHalf ? 'opacity-40' : 'opacity-100'}`}>
            {Array.from({ length: 12 }, (_, i) => {
              const n = i + 1
              const rec = (roundHistory || []).find((h: any) => h.round === n)
              const wonLeft = !!rec && rec.winner === 'blue'
              const wonRight = !!rec && rec.winner === 'red'
              const icon = rec ? REASON_ICON[rec.reason] || 'kills' : null
              return (
                <div key={n} className="flex h-full w-[34.6px] flex-col items-center justify-center gap-1">
                  <div className="flex w-full flex-1 items-center justify-center" style={{ backgroundColor: tint(leftTeamColor, wonLeft) }}>
                    {wonLeft && icon && <img className="size-[80%] object-contain" src={`/game/val/roundWinReason/${icon}.webp`} alt={rec.reason} />}
                  </div>
                  <div className="flex w-full flex-1 items-center justify-center" style={{ backgroundColor: tint(rightTeamColor, wonRight) }}>
                    {wonRight && icon && <img className="size-[80%] object-contain" src={`/game/val/roundWinReason/${icon}.webp`} alt={rec.reason} />}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Half 2 */}
          <div className={`flex h-full flex-row justify-end gap-1 overflow-hidden transition-opacity duration-300 ${isSecondHalf ? 'opacity-100' : 'opacity-40'}`}>
            {Array.from({ length: 12 }, (_, i) => {
              const n = 12 + i + 1
              const rec = (roundHistory || []).find((h: any) => h.round === n)
              const wonLeft = !!rec && rec.winner === 'blue'
              const wonRight = !!rec && rec.winner === 'red'
              const icon = rec ? REASON_ICON[rec.reason] || 'kills' : null
              return (
                <div key={n} className="flex h-full w-[34.6px] flex-col items-center justify-center gap-1">
                  <div className="flex w-full flex-1 items-center justify-center" style={{ backgroundColor: tint(leftTeamColor, wonLeft) }}>
                    {wonLeft && icon && <img className="size-[80%] object-contain" src={`/game/val/roundWinReason/${icon}.webp`} alt={rec.reason} />}
                  </div>
                  <div className="flex w-full flex-1 items-center justify-center" style={{ backgroundColor: tint(rightTeamColor, wonRight) }}>
                    {wonRight && icon && <img className="size-[80%] object-contain" src={`/game/val/roundWinReason/${icon}.webp`} alt={rec.reason} />}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Buy-card ability cell: icon + charge stack rectangle boxes (1, 2, or 3 stacks that light up if bought). */
function BuyAbility({ player, slot, st }: { player: any; slot: 'C' | 'Q' | 'E'; st: any }) {
  const maxCharges = getMaxAbilityCharges(player, slot)
  const currentCharges = getAbilityCurrentCharges(player, slot, st, maxCharges)
  const isAvailable = currentCharges > 0

  return (
    <div className="flex flex-col items-center">
      <img
        src={abilityImg(player, slot)}
        alt=""
        className="size-[19px] object-contain"
        style={{ opacity: isAvailable ? 1 : 0.38 }}
        onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
      />
      {/* Rectangle charge box(es) below the ability icon */}
      <div className="mt-1 flex h-[3.5px] w-[20px] items-center gap-[2px]">
        {Array.from({ length: maxCharges }, (_, i) => {
          const isLit = i < currentCharges
          return (
            <span
              key={i}
              className="h-full flex-1 rounded-[1px] transition-all duration-200"
              style={
                isLit
                  ? {
                      background: '#FFFFFF',
                      boxShadow: '0 0 5px rgba(255,255,255,0.9)',
                    }
                  : {
                      background: 'rgba(255,255,255,0.14)',
                      border: '1px solid rgba(255,255,255,0.22)',
                    }
              }
            />
          )
        })}
      </div>
    </div>
  )
}

function BuyUlt({ player, teamColor }: { player: any; teamColor: string }) {
  const ready = ultReadyOf(player)
  const ultPts = ultPointsOf(player)
  const ultMax = Math.max(1, ultMaxOf(player))

  const size = 26
  const center = size / 2
  const radius = 10.5
  const step = 360 / ultMax
  const gap = Math.max(18, Math.min(26, (360 / ultMax) * 0.44))

  const describeArc = (startAngle: number, endAngle: number) => {
    const rad = (deg: number) => ((deg - 90) * Math.PI) / 180.0
    const x1 = center + radius * Math.cos(rad(startAngle))
    const y1 = center + radius * Math.sin(rad(startAngle))
    const x2 = center + radius * Math.cos(rad(endAngle))
    const y2 = center + radius * Math.sin(rad(endAngle))
    const largeArc = endAngle - startAngle > 180 ? 1 : 0
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
  }

  return (
    <div className="relative flex size-[26px] shrink-0 items-center justify-center select-none" title={`Ult: ${ultPts}/${ultMax}`}>
      <svg width={size} height={size} className="absolute inset-0 pointer-events-none">
        {Array.from({ length: ultMax }, (_, i) => {
          const isLit = ready || i < ultPts
          const startAngle = i * step + gap / 2
          const endAngle = (i + 1) * step - gap / 2
          return (
            <path
              key={i}
              d={describeArc(startAngle, endAngle)}
              fill="none"
              stroke={ready ? teamColor : isLit ? '#FFFFFF' : 'rgba(255,255,255,0.22)'}
              strokeWidth={isLit ? 2.4 : 1.5}
              strokeLinecap="butt"
              style={
                ready
                  ? { filter: `drop-shadow(0 0 2px ${teamColor})` }
                  : isLit
                    ? { filter: 'drop-shadow(0 0 1.5px rgba(255,255,255,0.7))' }
                    : undefined
              }
            />
          )
        })}
      </svg>
      <div
        className="relative grid size-[19px] place-items-center rounded-full bg-black/85"
        style={ready ? { boxShadow: `0 0 8px 1px ${teamColor}` } : undefined}
      >
        <img
          src={abilityImg(player, 'X')}
          alt=""
          className="size-[12px] object-contain"
          style={{ opacity: ready ? 1 : 0.7 }}
          onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
        />
      </div>
    </div>
  )
}

export const ValCredIcon = ({ color = '#F9E4AB', className = 'relative inline size-3.5 -translate-y-0.5 rotate-45 shrink-0' }: { color?: string; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 190 190" className={className}>
    <circle cx="94.566" cy="94.574" r="54.425" stroke={color} strokeWidth="22.41" />
    <path fill={color} d="M80.164.12h28.813v32.015H80.164zM80.162 156.996h28.813v32.015H80.162zM32.135 76.965v28.813H.12V76.965zM189.01 76.964v28.813h-32.014V76.964z" />
  </svg>
)

/** One buy-round player card: portrait, name, KDA, abilities, gun+shield, econ. */
export function KitBuyCard({
  player,
  teamColor,
}: {
  player: any
  teamColor: string
  income?: number
}) {
  const alias = player.alias || player.name || player.riotId || 'Player'
  const { k, d, a } = kdaOf(player)
  const credits = creditsOf(player) ?? 0
  const spent = spentOf(player) ?? 0
  const st = player.abilityState
  const iconFallback = agentCodename(player) ? `/game/val/agents/${agentCodename(player)}/icon.png` : BLANK_IMG
  return (
    <div className="relative flex-1 min-h-[238px] min-w-0 overflow-hidden rounded-[3px] bg-[#0B0E13]/95 flex flex-col items-center py-1">
      {/* top accent */}
      <div className="h-[3px] w-full" style={{ background: teamColor }} />
      {/* Agent icon - centered horizontally */}
      <div className="relative mx-auto mt-2 flex h-[52px] w-full items-center justify-center">
        <img
          src={agentIcon(player) || iconFallback}
          alt=""
          className="size-[52px] object-contain mx-auto"
          onError={e => { (e.currentTarget as HTMLImageElement).src = iconFallback }}
        />
      </div>
      <p
        className="mt-1 w-full truncate px-2 text-center font-schabo text-[22px] uppercase leading-none"
        style={{ color: teamColor }}
      >
        {alias}
      </p>
      <p className="mt-1 text-center font-barlowCond text-[14px] font-semibold tabular-nums text-white/80">
        {k}/{d}/{a}
      </p>
      {/* Abilities + charge bars */}
      <div className="mt-2.5 flex items-start justify-center gap-2.5">
        <BuyAbility player={player} slot="C" st={st} />
        <BuyAbility player={player} slot="Q" st={st} />
        <BuyAbility player={player} slot="E" st={st} />
        <BuyUlt player={player} teamColor={teamColor} />
      </div>
      {/* Weapon + shield */}
      <div className="mt-2.5 flex h-[26px] items-center justify-center gap-2">
        <img
          src={getWeaponImg(player.weapon || player.weaponName)}
          alt=""
          className="max-h-[24px] max-w-[100px] object-contain"
          onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
        />
        <img src={getShieldImg(player)} alt="" className="h-[21px] object-contain" onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }} />
      </div>
      {/* Creds display: same as classic, horizontal side-by-side (spent and current credits) */}
      <div className="mt-2.5 flex w-full items-center justify-center gap-3 px-2 pb-1 leading-none">
        <p className="flex items-center text-center font-barlowSemiCond text-[17px] font-bold text-[#F9E4AB] tabular-nums whitespace-nowrap opacity-90">
          <span className="mr-0.5 text-[#F9E4AB] font-black">-</span>
          <ValCredIcon color="#F9E4AB" />
          <span className="ml-0.5 text-[#F9E4AB]">{spent}</span>
        </p>
        <p className="flex items-center text-center font-barlowSemiCond text-[17px] font-bold text-white tabular-nums whitespace-nowrap opacity-90">
          <ValCredIcon color="#EFF1FF" />
          <span className="ml-0.5 text-white">{credits}</span>
        </p>
      </div>
    </div>
  )
}

export function BroadcastBuyRoundScene(props: BroadcastBuyRoundProps) {
  const {
    leftTeamName = 'LEFT',
    rightTeamName = 'RIGHT',
    leftTeamSeed,
    rightTeamSeed,
    leftTeamColor = '#28D091',
    rightTeamColor = '#FF3549',
    leftTeamPlayers = [],
    rightTeamPlayers = [],
    economy = null,
    roundHistory = [],
    mapHistoryItems = [],
    sponsorImageUrl = null,
    leftTeamLogo = null,
    rightTeamLogo = null,
    scoreLeft = 0,
    scoreRight = 0,
    seriesScoreLeft = 0,
    seriesScoreRight = 0,
    roundText = '',
    seriesTitleText = '',
    gameSeriesText = '',
    eventTitleText = '',
    timerText = '',
    timerColor = '#DADBE3',
    bestOf = 3,
    showSeries = true,
    showLogos = true,
    showSponsors = true,
    isToggled = () => true,
  } = props
  if (!isToggled('buy-round')) return null

  const incomeLeft = incomeEstimate(roundHistory, TEAM_INCOME_SIDE.left)
  const incomeRight = incomeEstimate(roundHistory, TEAM_INCOME_SIDE.right)

  // Compute live economy fallback for EconomyTracker
  const calcEco = (players: any[]) => {
    const creds = players.map(p => Number(p.credits ?? p.money)).filter(v => Number.isFinite(v) && v > 0)
    const total = creds.reduce((a, b) => a + b, 0)
    const avg = creds.length ? Math.round(total / creds.length) : 0
    const ecoType = avg >= 4000 ? 'full-buy' : avg >= 2600 ? 'half-buy' : avg >= 1500 ? 'force-buy' : 'eco'
    return { total, avgCredits: avg, ecoType, playerCount: creds.length || 5 }
  }
  const effectiveEconomy = economy || {
    left: calcEco(leftTeamPlayers),
    right: calcEco(rightTeamPlayers),
  }

  // Match IngameHUD Main: retain map picks and decider; omit pool entries and bans.
  const activeMapHistory = (mapHistoryItems || []).filter((i: any) => i.kind !== 'pool' && i.kind !== 'ban')
  const labeledMapHistory = (() => {
    let n = 0
    return activeMapHistory.map((item: any) => {
      if (item.kind === 'decider') return { ...item, label: 'DECIDER:' }
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

      {/* Map history strip (top left), matching IngameHUD Main. */}
      {isToggled('map-history') && labeledMapHistory.length > 0 && (
        <div className="absolute top-3 left-4 z-30 flex h-8 items-center gap-2 rounded-sm border border-white/20 bg-black/90 px-3 shadow-xl backdrop-blur-sm">
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

      {/* Sponsor (top right), matching IngameHUD Main fallback and visibility. */}
      {isToggled('sponsors') && (
        <div className="absolute right-1.5 top-1.5 z-30 flex h-[74px] w-[245px] justify-center">
          <div className="relative size-full overflow-hidden rounded-sm p-1">
            <div className="absolute inset-0 bg-[#000000BD]" />
            <img src={sponsorImageUrl || '/sponsor/Sponsor-1.png'} alt="sponsor" className="relative z-10 size-full object-contain"
              onError={e => { const el = e.currentTarget; if (!el.dataset.fb) { el.dataset.fb = '1'; el.src = '/sponsor/Sponsor-1.png' } }} />
          </div>
        </div>
      )}

      {/* ===== Top Scorebug: exact same size and centered as Ingame HUD Main ===== */}
      {isToggled('score-line') && (
        <Scorebug
          leftName={leftTeamName}
          rightName={rightTeamName}
          leftSeed={leftTeamSeed}
          rightSeed={rightTeamSeed}
          leftColor={leftTeamColor}
          rightColor={rightTeamColor}
          scoreLeft={scoreLeft}
          scoreRight={scoreRight}
          seriesLeft={seriesScoreLeft}
          seriesRight={seriesScoreRight}
          bestOf={bestOf}
          showSeries={showSeries}
          showLogos={showLogos}
          leftLogo={leftTeamLogo}
          rightLogo={rightTeamLogo}
          roundLabel={roundText || ''}
          timerText={timerText}
          timerColor={timerColor}
          seriesTitleText={seriesTitleText}
          gameSeriesText={gameSeriesText}
          eventTitleText={eventTitleText}
          roundText={roundText || ''}
        />
      )}

      {/* ===== Bottom HUD stack: Match History Grid -> Economy Tracker -> Player Cards ===== */}
      <div
        className="absolute inset-x-0 bottom-2 z-20 flex flex-col items-center gap-1.5 px-0"
        style={{ animation: 'kitBuyIn 360ms ease-out' }}
      >
        {/* Row 1: Left Sponsor Card  |  Match History Grid  |  Right Sponsor Card */}
        <div className="flex w-full items-center justify-between px-2 gap-3">
          <div
            className="h-[84px] w-[385px] rounded-[4px] bg-[#1A1A1AE0] overflow-hidden"
            style={!showSponsors ? { visibility: 'hidden' } : undefined}
          >
            <div className="sponsors-card relative overflow-hidden p-1 size-full rounded-sm">
              <div className="absolute top-0 left-0 size-full bg-[#292929] opacity-[0.5]" />
              <img
                alt="sponsor"
                className="absolute inset-0 z-1 size-full object-contain p-2"
                src={sponsorImageUrl || '/sponsor/Sponsor-1.png'}
              />
            </div>
          </div>

          <MatchHistoryGrid
            roundHistory={roundHistory}
            leftTeamName={leftTeamName}
            rightTeamName={rightTeamName}
            leftTeamColor={leftTeamColor}
            rightTeamColor={rightTeamColor}
          />

          <div
            className="h-[84px] w-[385px] rounded-[4px] bg-[#1A1A1AE0] overflow-hidden"
            style={!showSponsors ? { visibility: 'hidden' } : undefined}
          >
            <div className="sponsors-card relative overflow-hidden p-1 size-full rounded-sm">
              <div className="absolute top-0 left-0 size-full bg-[#292929] opacity-[0.5]" />
              <img
                alt="sponsor"
                className="absolute inset-0 z-1 size-full object-contain p-2"
                src={sponsorImageUrl || '/sponsor/Sponsor-1.png'}
              />
            </div>
          </div>
        </div>

        {/* Economy tracker replacing old SPENT/REM/NEXT(MIN) cells */}
        <div className="w-full flex justify-center py-1">
          <EconomyTracker
            economy={effectiveEconomy}
            leftTeamName={leftTeamName}
            rightTeamName={rightTeamName}
            leftTeamColor={leftTeamColor}
            rightTeamColor={rightTeamColor}
          />
        </div>

        {/* Player cards: outward to inward entrance, flush on both sides without outer gaps (px-0), centered agent icons */}
        <div className="flex w-full items-stretch justify-between px-0 gap-3">
          <div
            className="flex min-w-0 flex-1 justify-between gap-1.5"
            style={{ animation: 'v1InwardLeft 460ms cubic-bezier(0.16, 1, 0.3, 1) both' }}
          >
            {leftTeamPlayers.slice(0, 5).map((p: any, i: number) => (
              <KitBuyCard key={p.id || i} player={p} teamColor={leftTeamColor} income={incomeLeft} />
            ))}
          </div>
          <div
            className="flex min-w-0 flex-1 flex-row-reverse justify-between gap-1.5"
            style={{ animation: 'v1InwardRight 460ms cubic-bezier(0.16, 1, 0.3, 1) both' }}
          >
            {rightTeamPlayers.slice(0, 5).map((p: any, i: number) => (
              <KitBuyCard key={p.id || i} player={p} teamColor={rightTeamColor} income={incomeRight} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default BroadcastBuyRoundScene
