import React from 'react'
import { resolveAgent } from '../../data/valAgentMeta'

interface IngameHudSceneProps {
  leftTeamName?: string
  rightTeamName?: string
  leftTeamSeed?: number | string
  rightTeamSeed?: number | string
  leftTeamColor?: string
  rightTeamColor?: string
  scoreLeft?: number
  scoreRight?: number
  timerText?: string
  roundText?: string
  timerColor?: string
  eventsBg?: string
  // --- Score Line fields (wired to HUD editor popover) ---
  showBombTimer?: boolean
  showLogos?: boolean
  showSeries?: boolean
  scoreLineSmall?: boolean
  scoreLineSize?: number
  scoreLineBackgroundImage?: string
  scoreLineLeftColor?: { title?: string; score?: string }
  scoreLineRightColor?: { title?: string; score?: string }
  seriesScoreLeft?: number
  seriesScoreRight?: number
  bestOf?: number
  watermarkText?: string
  seriesTitleText?: string
  eventTitleText?: string
  gameSeriesText?: string
  leftTeamLogo?: string | null
  rightTeamLogo?: string | null
  // --- Team Stats fields (wired to HUD editor popover) ---
  showKills?: boolean
  showDeaths?: boolean
  showAssists?: boolean
  showEco?: boolean
  showUlts?: boolean
  teamStatsLeftColor?: string
  teamStatsRightColor?: string
  // --- Team rosters (in-game HUD team stats player names) ---
  leftTeamPlayers?: any[]
  rightTeamPlayers?: any[]
  // --- Map History (map veto results wired from the Map Veto page) ---
  mapHistoryItems?: { slot: string; mapId: string; mapName: string; kind: 'pick' | 'ban' | 'decider' | 'pool'; score?: string }[]
  // --- Webcam (from Camera Feed player setup) ---
  webcamPlayerName?: string
  webcamPlayerPhoto?: string | null
  webcamActive?: boolean
  webcamStream?: MediaStream | null
  liveOnly?: boolean
  roundEnd?: { winner: 'blue' | 'red' | null; reason: string | null } | null
  roundNumber?: number | null
  gameEvent?: string | null
  activeComponentId?: string | null
  onSelectComponent?: (id: string) => void
  isToggled?: (componentId: string) => boolean
  currentlyObserving?: string | null
  spectating?: boolean
  spikeSite?: string | null
  spikeState?: 'none' | 'planted' | 'defusing' | null
}

// ===== Scoreline helper pieces (mirroring the original VAL classic renderer) =====
function ScoreSeriesBar({ color, score, scoreToWin }: { color: string; score: number; scoreToWin: number }) {
  const total = Math.max(0, Math.ceil((scoreToWin || 3) / 2))
  const empty = Math.max(0, total - score)
  return (
    <div className="flex h-full flex-col justify-center gap-1">
      {Array.from({ length: score }, (_, i) => (
        <div key={'f' + i} className="w-2.5 flex-1 min-h-1.25" style={{ background: color }} />
      ))}
      {Array.from({ length: empty }, (_, i) => (
        <div key={'e' + i} className="w-2.5 flex-1 min-h-1.25 border border-[#C2C2C2]" />
      ))}
    </div>
  )
}

function ScoreTeamBlock({
  teamName,
  teamColor,
  score,
  colors,
  isFlipped,
  variant,
  teamLogo,
  seed,
}: {
  teamName: string
  teamColor: string
  score: number
  colors?: { title?: string; score?: string }
  isFlipped?: boolean
  variant: 'default' | 'no-logo' | 'small'
  teamLogo?: string | null
  seed?: number | string | null
}) {
  return (
    <div
      className={`flex h-full justify-between bg-black/90 ${variant === 'default' ? 'w-95' : variant === 'no-logo' ? 'w-80' : 'w-75'}`}
    >
      <div className={`h-full w-1.25 ${isFlipped ? 'rounded-r-xs' : 'rounded-l-xs'}`} style={{ backgroundColor: teamColor }} />
      <div className={`flex w-[86%] items-center justify-center gap-3.75 ${isFlipped ? 'flex-row-reverse' : ''}`}>
        {variant === 'default' && (
          <div className="flex size-13 shrink-0 items-center justify-center overflow-hidden">
            {teamLogo ? (
              <img src={teamLogo} alt="" className="size-full object-contain" />
            ) : (
              <div className="size-8.5 rounded-full" style={{ background: teamColor }} />
            )}
          </div>
        )}
        <div className={`h-full min-w-0 ${variant === 'no-logo' ? (isFlipped ? 'mr-3' : 'ml-3') : 'flex-1'} flex items-center justify-center gap-1.5`}>
          {seed != null && seed !== '' && (
            <span className="text-[12px] font-bold px-1.5 py-0.5 rounded bg-white/15 text-white/80 font-mono">
              #{seed}
            </span>
          )}
          <h1
            className="translate-y-1 whitespace-nowrap px-1 text-[40px] uppercase"
            style={{ color: colors?.title || '#DADBE3' }}
          >
            {teamName || (isFlipped ? 'TEAM B' : 'TEAM A')}
          </h1>
        </div>
        <div className="flex h-full w-8.75 shrink-0 items-center justify-center">
          <h1 className="translate-y-1 text-[48px] uppercase" style={{ color: colors?.score || '#DADBE3' }}>
            {score}
          </h1>
        </div>
      </div>
      <div className={`h-full w-1.25 ${isFlipped ? 'rounded-l-xs' : 'rounded-r-xs'}`} style={{ backgroundColor: teamColor }} />
    </div>
  )
}

function ScoreSmallBlock({ teamColor }: { teamColor: string }) {
  return (
    <div className="flex aspect-square h-full items-center justify-center" style={{ backgroundColor: teamColor }} />
  )
}

/**
 * ValoSpectra app-roundreasons parity: per-round win strip. Top cell = left
 * team win (icon by reason), bottom cell = right team win. Winner-tinted.
 */
export function RoundReasonsStrip({
  roundHistory = [],
  leftTeamColor = '#28D091',
  rightTeamColor = '#FF3549',
  leftName = 'INT',
  rightName = 'ZOO',
}: {
  roundHistory?: Array<{ round: number; winner: 'blue' | 'red'; reason: string }>
  leftTeamColor?: string
  rightTeamColor?: string
  leftName?: string
  rightName?: string
}) {
  if (!roundHistory || roundHistory.length === 0) return null
  const REASON_ICON: Record<string, string> = {
    elimination: 'kills', detonation: 'detonated', defusion: 'defused', time: 'timeout',
  }
  const tint = (hex: string | undefined, on: boolean) => {
    if (!on) return 'rgba(26, 26, 26, 1)'
    let h = String(hex || '#28D091').replace('#', '')
    if (h.length === 3) h = h.split('').map((c) => c + c).join('')
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const b = parseInt(h.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, 0.6)`
  }
  return (
    <div className="pointer-events-none flex items-center rounded-xs border border-white/25 bg-black/85 py-0.5 shadow-md">
      <div className="flex h-full shrink-0 flex-col items-center justify-around px-1.5">
        <p className="font-unbounded text-[10px] font-extrabold text-white uppercase">{leftName}</p>
        <p className="font-unbounded text-[10px] font-extrabold text-white uppercase">{rightName}</p>
      </div>
      <div className="flex flex-row gap-0.5 px-1">
        {roundHistory.map((h) => {
          const icon = REASON_ICON[h.reason] || 'kills'
          return (
            <div key={h.round} className="flex w-[26px] flex-col">
              <div className="flex h-[22px] items-center justify-center" style={{ background: tint(leftTeamColor, h.winner === 'blue') }}>
                {h.winner === 'blue' && (
                  <img className="size-[18px] object-contain" src={`/game/val/roundWinReason/${icon}.webp`} alt={h.reason} />
                )}
              </div>
              <div className="flex h-[22px] items-center justify-center" style={{ background: tint(rightTeamColor, h.winner === 'red') }}>
                {h.winner === 'red' && (
                  <img className="size-[18px] object-contain" src={`/game/val/roundWinReason/${icon}.webp`} alt={h.reason} />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function getWeaponImg(weapon: any) {
  if (!weapon || typeof weapon !== 'string') return '/game/val/weapons/classic.png'
  let w = weapon.toLowerCase().replace(/tx_hud_weapon_|tx_hud_pistol_|tx_hud_|weapon_/g, '').trim()
  if (w === 'knife' || w === 'tactical knife') w = 'melee'
  if (w === 'auto shotgun' || w === 'autoshotgun') w = 'judge'
  if (w === 'heavy sniper') w = 'operator'
  if (w === 'lever sniper') w = 'marshal'
  if (w === 'double barrel') w = 'outlaw'
  return `/game/val/weapons/${w}.png`
}

function getShieldImg(p: any) {
  const armor = Number(p?.armor ?? p?.shield ?? 0)
  const type = p?.shieldType ?? (armor >= 50 ? 2 : armor > 0 ? 1 : 0)
  if (type === 4) return '/game/val/shields/Regen_Shield.png'
  if (type === 2 || type === 3 || armor >= 50) return '/game/val/shields/Heavy_Armor.png'
  if (type === 1 || armor > 0) return '/game/val/shields/Light_Armor.png'
  return '/game/val/shields/None.webp'
}

const DEMO_LEFT = [
  { alias: 'Player 1', agentName: 'Fade', kills: 3, deaths: 10, assists: 1, health: 100, isAlive: true, credits: 650, armor: 25, weapon: 'Phantom' },
  { alias: 'Player 2', agentName: 'Cypher', kills: 4, deaths: 12, assists: 0, health: 72, isAlive: true, credits: 0, armor: 50, weapon: 'Spectre' },
  { alias: 'Player 3', agentName: 'Deadlock', kills: 4, deaths: 11, assists: 2, health: 0, isAlive: false, credits: 550, armor: 0, weapon: 'Classic' },
  { alias: 'Player 4', agentName: 'Chamber', kills: 1, deaths: 7, assists: 1, health: 34, isAlive: true, credits: 50, armor: 25, weapon: 'Sheriff' },
  { alias: 'Player 5', agentName: 'Breach', kills: 2, deaths: 9, assists: 3, health: 0, isAlive: false, credits: 200, armor: 0, weapon: 'Classic' },
]

const DEMO_RIGHT = [
  { alias: 'Player 1', agentName: 'Raze', kills: 12, deaths: 6, assists: 2, health: 61, isAlive: true, credits: 1900, armor: 50, weapon: 'Vandal' },
  { alias: 'Player 2', agentName: 'Skye', kills: 6, deaths: 4, assists: 8, health: 18, isAlive: true, credits: 2500, armor: 25, weapon: 'Phantom' },
  { alias: 'Player 3', agentName: 'KAY/O', kills: 12, deaths: 1, assists: 3, health: 100, isAlive: true, credits: 7900, armor: 50, weapon: 'Odin' },
  { alias: 'Player 4', agentName: 'Gekko', kills: 5, deaths: 8, assists: 4, health: 0, isAlive: false, credits: 1200, armor: 0, weapon: 'Ghost' },
  { alias: 'Player 5', agentName: 'Tejo', kills: 8, deaths: 4, assists: 2, health: 85, isAlive: true, credits: 3700, armor: 50, weapon: 'Vandal' },
]


const ENDROUND_CSS = '@keyframes endroundIn { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } } @keyframes endroundOutR { to { transform: translateX(100%); opacity: 0; } } @keyframes endroundOutL { to { transform: translateX(-100%); opacity: 0; } } .endround-in { animation: endroundIn 300ms ease-out; } .endround-out-right { animation: endroundOutR 300ms ease-in forwards; } .endround-out-left { animation: endroundOutL 300ms ease-in forwards; }'
function EndroundBanner({ roundEnd, roundNumber, winType, leftName, rightName, leftLogo, rightLogo, leftColor, rightColor }: {
  roundEnd: { winner: 'blue' | 'red' | null; reason: string | null } | null
  roundNumber: number | null
  winType: string | null
  leftName: string
  rightName: string
  leftLogo: string | null
  rightLogo: string | null
  leftColor: string
  rightColor: string
}) {
  const key = roundEnd?.winner ? (roundNumber ?? 0) + ':' + roundEnd.winner : null
  const [phase, setPhase] = React.useState<'hidden' | 'in' | 'shown' | 'out'>('hidden')
  const seen = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (!key || key === seen.current) return
    seen.current = key
    const t1 = setTimeout(() => setPhase('in'), 200)
    const t2 = setTimeout(() => setPhase('shown'), 2800)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [key])
  React.useEffect(() => {
    if (phase !== 'shown' && phase !== 'in') return
    if (roundEnd) return
    setPhase('out')
    const t = setTimeout(() => setPhase('hidden'), 320)
    return () => clearTimeout(t)
  }, [roundEnd, phase])
  if (phase === 'hidden' || !roundEnd?.winner) return null
  const leftWon = roundEnd.winner === 'blue'
  const win = leftWon
    ? { name: (leftName || 'TEAM A').toUpperCase(), color: leftColor, logo: leftLogo }
    : { name: (rightName || 'TEAM B').toUpperCase(), color: rightColor, logo: rightLogo }
  const slide = phase === 'in' ? 'endround-in' : phase === 'out' ? (leftWon ? 'endround-out-right' : 'endround-out-left') : ''
  const winText = (winType || 'Round Win').toUpperCase()
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 60, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{ENDROUND_CSS}</style>
      <div className={slide} style={{ width: 875, height: 170, position: 'relative', overflow: 'hidden', borderRadius: 4, boxShadow: '0 12px 40px rgba(0,0,0,0.55)' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(90deg, ' + leftColor + '55 0%, rgba(10,14,22,0.92) 30%, rgba(10,14,22,0.92) 70%, ' + rightColor + '55 100%)' }}>
          <img src={leftLogo ?? undefined} alt="" style={{ position: 'absolute', left: 32, maxHeight: '50%', opacity: 0.2, filter: 'grayscale(1)' }} />
          <img alt="" src="/sponsor/Sponsor-2.png" style={{ maxHeight: '56%', objectFit: 'contain' }} />
          <p style={{ fontSize: 30, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 2, margin: '10px 0 0' }}>{winText}</p>
          <img src={rightLogo ?? undefined} alt="" style={{ position: 'absolute', right: 32, maxHeight: '50%', opacity: 0.2, filter: 'grayscale(1)' }} />
        </div>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', background: 'linear-gradient(90deg, ' + win.color + 'dd 0%, rgba(10,14,22,0.92) 55%)', transition: 'transform 300ms ease, opacity 300ms ease', transform: phase === 'shown' ? 'translateX(0)' : leftWon ? 'translateX(-100%)' : 'translateX(100%)', opacity: phase === 'shown' ? 1 : 0 }}>
          <img src={win.logo ?? undefined} alt="" style={{ maxHeight: '55%', maxWidth: 160, objectFit: 'contain' }} />
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 26, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 2, margin: 0 }}>{win.name}</p>
            <p style={{ fontSize: 24, fontWeight: 800, color: '#fff', textTransform: 'uppercase', margin: '6px 0 0' }}>ROUND {roundNumber ?? ''}</p>
          </div>
          <img alt="" src="/sponsor/Sponsor-2.png" style={{ maxHeight: '50%', objectFit: 'contain', opacity: 0.9 }} />
        </div>
      </div>
    </div>
  )
}

function IngamePlayerCard({
  player,
  side,
  index,
  teamColor,
  textColor,
  showEco,
  showUlts,
  showKills,
  showDeaths,
  showAssists,
  isObserved,
}: {
  player: any
  side: 'left' | 'right'
  index: number
  teamColor: string
  textColor: string
  showEco: boolean
  showUlts: boolean
  showKills: boolean
  showDeaths: boolean
  showAssists: boolean
  isObserved: boolean
}) {
  const isRight = side === 'right'
  const meta = resolveAgent(player)
  // agentKey (normalized GEP codename) wins; then meta; then name fallback.
  const codename =
    (player?.agentKey && String(player.agentKey).replace(/_pc(_c)?$/i, '')) ||
    meta?.codename ||
    (player?.agentName ? String(player.agentName).toLowerCase() : (isRight ? 'clay' : 'wushu'))
  const agentIcon = `/game/val/agents/${codename}/icon.png`
  const alias = player.alias || player.name || player.riotId || `Player ${index + 1}`
  const isAlive = player.isAlive !== false && (player.health == null || player.health > 0)
  const health = isAlive ? Number(player.health ?? 100) : 0
  const kills = player.kills ?? 0
  const deaths = player.deaths ?? 0
  const assists = player.assists ?? 0
  const credits = player.credits ?? player.money ?? 800
  const shieldSrc = isAlive ? getShieldImg(player) : null
  const weaponSrc = getWeaponImg(player.weapon || player.weaponName)
  // Ult points: the desktop publishes ultPoints/ultMax (GEP scoreboard).
  const ultPoints = player.currUltPoints ?? player.ultPoints ?? player.ultimate ?? 0
  const ultMax = player.maxUltPoints ?? player.ultMax ?? player.ultimateMax ?? 0
  const ultReady = ultMax > 0 && ultPoints >= ultMax

  const hiddenX = !isRight ? 'translateX(-100%)' : 'translateX(100%)'
  const eyeContainerStyle: React.CSSProperties = {
    opacity: isObserved ? '0.9' : '0',
    transform: isObserved ? 'translateX(0px)' : hiddenX,
    transitionDuration: '0.3s',
  }

  return (
    <div className={`w-full ${isRight ? 'team-stats-val-classic-flip' : 'team-stats-val-classic'}`}>
      <div className={`flex w-full transition-all ease-in-out ${isRight ? 'justify-end' : 'justify-start'} max-h-75 opacity-100 mb-2`}>
        <div className={`relative flex h-15.25 w-full items-end duration-300 ${isRight ? 'flex-row-reverse' : ''}`}>
          {/* Card Body */}
          <div
            className={`relative z-1 flex h-full flex-1 flex-col items-center justify-center duration-300 ease-in-out p-0.5 ${
              isRight ? 'rounded-r-[3px]' : 'rounded-l-[3px]'
            }`}
            style={{
              background: isAlive
                ? `linear-gradient(${isRight ? '270deg' : '90deg'}, rgba(0,0,0,0) 0%, ${teamColor}33 100%), rgba(0, 0, 0, 0.75)`
                : 'rgba(10, 12, 16, 0.88)',
              opacity: isAlive ? 1 : 0.65,
            }}
          >
            {/* Health Bar progress row (VS parity: no overflow-hidden — the
                50px agent pokes above the row and is never cropped) */}
            <div
              className={`over font-semibold relative flex h-6 w-full items-center font-barlowCond ${
                isRight ? 'flex-row-reverse' : ''
              }`}
              style={{ color: isAlive ? textColor : '#737373' }}
            >
              {/* Dynamic Health Fill — full row height, behind content */}
              <div
                className="absolute top-0 size-full rounded-[3px] duration-300"
                style={{
                  backgroundColor: isAlive
                    ? health > 60
                      ? '#28D091'
                      : health > 30
                        ? '#F5A623'
                        : '#FF3549'
                    : 'rgba(0, 0, 0, 0.41)',
                  width: `${isAlive ? Math.max(0, Math.min(100, health)) : 0}%`,
                  [isRight ? 'right' : 'left']: 0,
                }}
              />
              {/* HP number */}
              <span className="relative z-1 ml-1 min-w-7 text-center font-barlowSemiCond text-[11px] font-bold leading-none text-white/80">
                {health}
              </span>


              {/* Agent — bottom-anchored 50px, pokes above the row (VS parity) */}
              <div className="relative h-full w-[50px] shrink-0">
                <div className="absolute bottom-0 left-0 h-[50px] w-[50px]">
                  <img
                    className={`size-full object-contain duration-200 ${isAlive ? '' : 'grayscale opacity-40 brightness-75'}`}
                    style={isRight ? { transform: 'scaleX(-1)' } : undefined}
                    src={agentIcon}
                    alt=""
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).src = '/game/val/agents/wushu/icon.png'
                    }}
                  />
                  {!isAlive && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <svg viewBox="0 0 24 24" className="size-5 text-[#FF3549] drop-shadow-md opacity-95" fill="currentColor">
                        <path d="M12 2a9 9 0 0 0-9 9c0 3.2 1.6 6 4 7.6V20a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1.4c2.4-1.6 4-4.4 4-7.6a9 9 0 0 0-9-9zm-3 10a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>

              {/* Player Name */}
              <div className={`h-full flex-1 min-w-0 pr-1 ${isRight ? 'pl-1 text-right' : ''}`}>
                <h1 className="font-semibold -translate-y-0.5 truncate pl-1.5 text-xl leading-none">{alias}</h1>
              </div>

              {/* Economy + Shield (VS parity: credits + credit icon + 27px shield) */}
              {showEco && (
                <div className={`relative z-1 flex h-full items-center ${isRight ? 'mr-auto flex-row-reverse pl-1' : 'ml-auto pl-1'}`}>
                  <div className="flex h-full items-center justify-center overflow-hidden">
                    <h1 className="font-semibold font-barlowSemiCond text-[16px] leading-none">{credits}</h1>
                  </div>
                  <div className="pl-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 190 190" className="h-[11px] rotate-45">
                      <circle cx="94.566" cy="94.574" r="54.425" stroke="currentColor" strokeWidth="22.41" />
                      <path fill="currentColor" d="M80.164.12h28.813v32.015H80.164zM80.162 156.996h28.813v32.015H80.162zM32.135 76.965v28.813H.12V76.965zM189.01 76.964v28.813h-32.014V76.964z" />
                    </svg>
                  </div>
                  <div className="flex h-full w-[27px] items-center justify-center">
                    <img src={shieldSrc ?? '/game/val/shields/None.webp'} alt="shield" className="h-[17px] w-[18px] object-contain" />
                  </div>
                </div>
              )}
            </div>

              
            {/* Bottom Row: Ult + K/D/A + Weapon */}
            <div className={`item relative flex w-full flex-1 items-center px-1 ${isRight ? 'flex-row-reverse justify-between' : 'justify-between'}`}>
              {/* Ult Icon */}
              {showUlts && (
                <div className="relative aspect-square size-7 duration-300 ease-in-out flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-black/60" />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                    <img
                      alt="ult"
                      className={`size-4 object-contain drop-shadow ${isAlive ? '' : 'opacity-30'}`}
                      src={`/game/val/agents/${codename}/abilities/ultimate.png`}
                      onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden' }}
                    />
                    {/* Ult points badge — live count from GEP scoreboard */}
                    <span
                      className={`absolute -bottom-1 -right-1 z-30 rounded-full px-1 font-barlowCond text-[10px] font-bold leading-tight ${
                        ultReady ? 'bg-[#FFD166] text-black' : 'bg-black/80 text-white'
                      }`}
                    >
                      {ultPoints}
                    </span>
                  </div>
                  <div className="absolute inset-0 size-full flex items-center justify-center pointer-events-none z-20">
                    <svg height="30" viewBox="0 0 30 30" width="30">
                      {/* Track */}
                      <circle cx="15" cy="15" r="13" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
                      {/* Progress — same dash ring as the buy-round scene */}
                      <circle
                        cx="15"
                        cy="15"
                        r="13"
                        fill="none"
                        stroke={ultReady ? '#FFD166' : teamColor}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeDasharray={ultMax > 0 ? `${Math.max(0, Math.min(1, ultPoints / ultMax)) * 81.68} 81.68` : '0 81.68'}
                        transform="rotate(-90 15 15)"
                      />
                    </svg>
                  </div>
                </div>
              )}

              {/* K/D/A — VS icon parity (icon paths from the val-classic card) */}
              <div className={`font-semibold flex translate-y-0.5 items-center gap-3 font-barlowCond text-lg text-white [&_h1]:-translate-y-px ${isRight ? 'flex-row-reverse' : ''}`}>
                {showKills && (
                  <div className="flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 384 249" height="12px" style={{ color: teamColor }}>
                      <path fill="currentColor" fillRule="evenodd" d="m17.677 69.216.001-.002.002-.002C29.39 48.811 41.1 28.413 52.9 8.014c4.5-7.8 13.6-10.2 21.4-5.9 6 3.2 11.9 6.7 17.8 10.3 7.6 4.6 10.2 13.8 5.7 21.5-16.8 29.4-33.7 58.7-50.8 87.9-4.6 7.9-13.6 10.2-21.7 5.7-3.352-1.818-6.64-3.734-9.937-5.654-2.506-1.459-5.016-2.921-7.563-4.346-4-2.3-6-6.1-7.8-10.2v-7.5h.1c5.865-10.197 11.719-20.394 17.572-30.59zM66.8 119.415c9.3-16.2 18.6-32.3 28-48.5 2.7-4.65 5.375-9.275 8.05-13.9s5.35-9.25 8.05-13.9c2.7-4.7 4.6-9.7 4.6-15.2 0-2 .7-2.7 2.7-3.1 8-1.2 15.9-1 23.8 0 7.067.933 14.133 1.778 21.2 2.622 3.533.422 7.067.845 10.6 1.278-.153 1.223-.949 1.628-1.717 2.02-.237.12-.471.239-.683.38-3.741 2.367-7.498 4.705-11.252 7.042l-.002.001c-6.078 3.783-12.15 7.563-18.146 11.457-11.6 7.5-16.7 18.5-14.6 32 1.9 12.4 9.4 20.9 21.4 25.1 7.5 2.6 14.9 2 22.3-.9q8.79-3.488 17.576-6.96h.001l.002-.001h.001l.005-.002c14.031-5.55 28.048-11.094 42.015-16.737 2.2-.9 3.7-.8 5.6.8 14.528 12.606 29.12 25.148 43.722 37.699l.002.001a16333 16333 0 0 1 33.676 29c7.9 6.9 9 17.2 2.8 25.1-5.9 7.5-16.3 8.7-24.8 2.9-.193-.097-.363-.217-.566-.36-.217-.153-.472-.333-.834-.54 3.4 10.9 1.9 18.2-4.9 23.2-4.7 3.5-9.9 4.4-15.6 2.8-3.834-1.065-6.61-3.643-9.472-6.301-1.169-1.085-2.352-2.184-3.628-3.199 3 12.9 1.2 19.4-6.3 24.1-7.3 4.6-14.3 3.6-23.4-3.6 1.9 4.5 2.8 8.5 2.1 12.9-1.2 6.5-6.7 12.4-13.2 13.8-6.7 1.4-14.8-1.5-18.5-6.6-.8-1.1-.4-1.8.2-2.6 10.7-15.9 5.5-38.1-13.7-47.8-1.8-.9-2.2-2.1-2.5-3.8-1.6-11.5-8.2-19.5-18-25.1-1.7-1-2.9-1.8-3.2-4.1-2-16-16.9-29-33.1-28.9-2.8 0-4.6-.7-6.5-3.1-13.6-16.7-36.9-17.1-51.2-1.1-.36.412-.748.825-1.149 1.251-.376.401-.763.813-1.15 1.249l-.5-.5zm95.8 54.8c-6-7.9-14-9.8-23.5-5.4v-.2c7.5-12.3 7.4-19.5-.1-26.4-3.3-2.9-7-4.8-11.4-5-6.6-.3-11.4 3.3-16 8.9.2-1.6.3-2.2.4-2.8 1.8-8.3-2-16.2-9.9-20.1-7.2-3.6-15.2-1.7-20.8 4.9q-2.477 2.923-4.962 5.837c-4.969 5.831-9.938 11.663-14.738 17.663-8.4 10.4-3.4 24.7 9.6 28.3 5.1 1.4 9.6-.2 14.7-2.7-3.3 8.8-1.8 15.8 5 21.4s14 5.7 21.9.7c-3.3 8.6-2.2 15.8 4.5 21.5 6.8 5.9 14.2 6 22.2 1.1a59 59 0 0 1-.675 2.125v.001c-.2.6-.375 1.124-.525 1.674-2.1 7.6 1.3 15.3 8.6 19.8 6.5 4 15.1 3.4 20.3-2.3 6.1-6.5 11.9-13.4 17.3-20.6 4.6-6.2 3.6-15-1.8-20.6-6.3-6.6-13.7-8.2-22.3-4.2 6.2-7.6 8.3-15.5 2.2-23.6M316.9.115c6.6.1 11.2 3.4 14.4 9 9 15.7 18 31.3 27.1 46.9 2.828 4.92 5.672 9.84 8.518 14.767l.012.02.005.01c4.495 7.778 8.999 15.572 13.465 23.403 5.6 9.7 3.3 18.5-6.3 24.1q-2.093 1.209-4.171 2.415c-3.775 2.189-7.525 4.364-11.329 6.485-8.6 4.8-17.5 2.5-22.5-6.1-16.8-28.9-33.6-57.9-50.2-87-4.7-8.1-2.2-17.2 5.7-22 4.826-2.963 9.795-5.783 14.726-8.581h.001l.02-.012L309 2.015c2.4-1.4 5.1-2.1 7.9-1.9M238.342 30.3q-1.919.014-3.842.015c-1.563 0-3.137-.011-4.715-.022-3.166-.022-6.348-.045-9.485.022-9.6.2-18.9 2-27.3 6.7-12.578 6.913-24.6 14.729-36.588 22.522q-3.605 2.346-7.212 4.678c-5.4 3.4-7.2 9.1-6.1 15.4 1.1 6.1 4.7 10.1 10.4 12.2 4.2 1.5 8.3.9 12.4-.7q8.4-3.336 16.8-6.663c16.8-6.656 33.6-13.312 50.4-20.137 2.8-1.1 4.6-.9 6.9 1.1 15.267 13.133 30.623 26.267 45.979 39.401 7.677 6.566 15.355 13.132 23.021 19.699l.263.22c1.677 1.409 3.05 2.562 5.237.28.256-.269.512-.521.758-.762 1.581-1.553 2.759-2.709.942-5.738-12.826-21.787-25.42-43.728-37.987-65.62L273 43.816c-1.3-2.3-2.6-4.6-3.3-7.1-.7-2.3-1.9-3.2-4-3.8-9.042-2.722-18.162-2.668-27.358-2.615" clipRule="evenodd"></path>
                    </svg>
                    <h1>{kills}</h1>
                  </div>
                )}
                {showDeaths && (
                  <div className="flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 16 15" height="14px" style={{ color: teamColor }}>
                      <path fill="currentColor" d="M7.952.374C3.972.374.732 2.77.732 6.75v3.308a.74.74 0 0 0 .466.687l2.008.803a.74.74 0 0 1 .451.543l.389 1.94a.74.74 0 0 0 .726.594h.959v-2.221h1.11v2.221h.555v-2.221h1.11v2.221h.556v-2.221h1.11v2.221h.96a.74.74 0 0 0 .726-.595l.388-1.94a.74.74 0 0 1 .45-.541l2.01-.804a.74.74 0 0 0 .464-.687V6.75c0-3.98-3.238-6.377-7.218-6.377m-3.054 8.7a1.943 1.943 0 1 1 0-3.887 1.943 1.943 0 0 1 0 3.886m1.787 2.22.85-2.776h.833l.85 2.776zm4.32-2.22a1.943 1.943 0 1 1 0-3.887 1.943 1.943 0 0 1 0 3.886"></path>
                    </svg>
                    <h1>{deaths}</h1>
                  </div>
                )}
                {showAssists && (
                  <div className="flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 17 17" height="16px" style={{ color: teamColor }}>
                      <path fill="currentColor" d="M1.483 7.938h.586a6.76 6.76 0 0 1 6.164-6.164v-.586a.563.563 0 1 1 1.125 0v.586a6.76 6.76 0 0 1 6.163 6.164h.587a.563.563 0 1 1 0 1.125h-.587a6.76 6.76 0 0 1-6.163 6.163v.586a.562.562 0 1 1-1.125 0v-.586a6.76 6.76 0 0 1-6.164-6.164h-.586a.563.563 0 1 1 0-1.124m2.25 1.125h-.534a5.636 5.636 0 0 0 5.034 5.034v-.534a.562.562 0 1 1 1.125 0v.534a5.636 5.636 0 0 0 5.034-5.034h-.534a.562.562 0 1 1 0-1.126h.534a5.636 5.636 0 0 0-5.034-5.034v.535a.563.563 0 1 1-1.125 0v-.535a5.636 5.636 0 0 0-5.034 5.034h.534a.563.563 0 1 1 0 1.125m2.25-.563a2.812 2.812 0 1 0 5.624 0 2.812 2.812 0 0 0-5.624 0"></path>
                    </svg>
                    <h1>{assists}</h1>
                  </div>
                )}
              </div>

              {/* Weapon Silhouette */}
              <div className={`relative flex items-center overflow-hidden duration-200 ${isRight ? '' : '-scale-x-100'} ${isAlive ? 'opacity-100' : 'opacity-20'}`}>
                <img
                  src={weaponSrc}
                  alt=""
                  className="max-h-4 max-w-16 object-contain drop-shadow"
                  onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden' }}
                />
              </div>
            </div>
          </div>

          {/* Spectator Eye Slot */}
          <div className={`h-full overflow-hidden ${isRight ? 'rounded-l-md' : 'rounded-r-md'}`} style={{ width: 20 }}>
            <div className="size-full" style={eyeContainerStyle}>
              <div className="flex size-full items-center justify-center bg-[#00000073]">
                <svg fill="none" height="8" viewBox="0 0 10 8" width="10" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M9.97125 3.42679C9.95667 3.39152 9.60375 2.55268 8.81917 1.71205C7.77375 0.591964 6.45333 0 5 0C3.54667 0 2.22625 0.591964 1.18083 1.71205C0.396246 2.55268 0.0416627 3.39286 0.028746 3.42679C0.00979317 3.47246 0 3.52189 0 3.57187C0 3.62186 0.00979317 3.67129 0.028746 3.71696C0.0433294 3.75223 0.396246 4.59063 1.18083 5.43125C2.22625 6.55089 3.54667 7.14286 5 7.14286C6.45333 7.14286 7.77375 6.55089 8.81917 5.43125C9.60375 4.59063 9.95667 3.75223 9.97125 3.71696C9.99021 3.67129 10 3.62186 10 3.57187C10 3.52189 9.99021 3.47246 9.97125 3.42679ZM5 5.35714C4.67036 5.35714 4.34813 5.25241 4.07405 5.0562C3.79997 4.85998 3.58635 4.58109 3.4602 4.25479C3.33405 3.9285 3.30105 3.56945 3.36536 3.22305C3.42967 2.87666 3.5884 2.55847 3.82149 2.30874C4.05458 2.059 4.35155 1.88893 4.67485 1.82003C4.99815 1.75112 5.33326 1.78649 5.63781 1.92164C5.94235 2.0568 6.20265 2.28568 6.38578 2.57934C6.56892 2.873 6.66667 3.21825 6.66667 3.57143C6.66667 4.04503 6.49107 4.49923 6.17851 4.83412C5.86595 5.16901 5.44203 5.35714 5 5.35714Z"
                    fill="white"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function IngameHudScene(props: IngameHudSceneProps) {
  const {
    leftTeamName = 'Left Team',
    rightTeamName = 'Right Team',
    leftTeamSeed,
    rightTeamSeed,
    leftTeamColor = '#28D091',
    rightTeamColor = '#FF3549',
    scoreLeft = 0,
    scoreRight = 0,
    timerText = '1:40',
    roundText = 'Round 12/24',
    timerColor = '#DADBE3',
    showBombTimer = true,
    showLogos = true,
    showSeries = true,
    scoreLineSmall = false,
    scoreLineSize = 3,
    scoreLineBackgroundImage,
    scoreLineLeftColor = { title: '#DADBE3', score: '#DADBE3' },
    scoreLineRightColor = { title: '#DADBE3', score: '#DADBE3' },
    seriesScoreLeft = 0,
    seriesScoreRight = 0,
    bestOf = 3,
    watermarkText = 'HAVOC UNLEASHED',
    seriesTitleText = '',
    eventTitleText = '',
    gameSeriesText = '',
    leftTeamLogo = null,
    rightTeamLogo = null,
    showKills = true,
    showDeaths = true,
    showAssists = true,
    showEco = true,
    showUlts = true,
    teamStatsLeftColor = '#EFF1FF',
    teamStatsRightColor = '#EFF1FF',
    leftTeamPlayers = [],
    rightTeamPlayers = [],
    mapHistoryItems,
    webcamPlayerName = 'No camera',
    webcamPlayerPhoto = null,
    webcamActive = false,
    webcamStream = null,
    liveOnly = false,
    roundEnd = null,
    roundNumber = null,
    gameEvent = null,
    leftTeamName: leftTeamNameProp,
    rightTeamName: rightTeamNameProp,
    activeComponentId,
    onSelectComponent,
    isToggled = () => true,
    currentlyObserving = null,
    spectating = false,
    spikeSite = null,
    spikeState = null,
  } = props

  // ===== Endround banner names (ValoSpectra endround-banner parity) =====
  const bannerLeftName = (leftTeamNameProp || leftTeamName || '').toUpperCase()
  const bannerRightName = (rightTeamNameProp || rightTeamName || '').toUpperCase()

  const hasLiveMatch = (leftTeamPlayers && leftTeamPlayers.length > 0) || (rightTeamPlayers && rightTeamPlayers.length > 0)
  const leftRoster = leftTeamPlayers && leftTeamPlayers.length > 0 ? leftTeamPlayers : (hasLiveMatch || liveOnly ? [] : DEMO_LEFT)
  const rightRoster = rightTeamPlayers && rightTeamPlayers.length > 0 ? rightTeamPlayers : (hasLiveMatch || liveOnly ? [] : DEMO_RIGHT)

  const activeMapHistory = (mapHistoryItems || []).filter(i => i.kind !== 'pool' && i.kind !== 'ban')
  const labeledMapHistory = (() => {
    let n = 0
    return activeMapHistory.map(item => {
      if (item.kind === 'decider') return { ...item, label: 'DECIDER:' }
      if (item.kind === 'ban') return { ...item, label: 'BAN:' }
      n += 1
      return { ...item, label: `MAP ${n}:` }
    })
  })()

  const isObservedPlayer = (p: any, side: 'left' | 'right', index: number): boolean => {
    if (spectating && !currentlyObserving) return Boolean(side === 'left' && index === 0)
    if (!currentlyObserving) return Boolean(side === 'left' && index === 0)
    const obs = String(currentlyObserving).toLowerCase().trim()
    const pName = String(p.name || p.alias || p.riotId || p.id || '').toLowerCase().trim()
    const pRiot = String(p.riotId || '').toLowerCase().trim()
    return Boolean(obs === pName || (pRiot && obs === pRiot) || (pName && obs.includes(pName)) || (pName && pName.includes(obs)))
  }

  const isSpikeActive = spikeState === 'planted' || spikeState === 'defusing'
  // Endround: keep the plain clock in the timer slot (the banner tells the
  // story — no ELIMINATED/SPIKE DETONATED words crowding the scoreline).
  const displayTimerText = isSpikeActive
    ? (spikeState === 'defusing' ? 'DEFUSING' : (spikeSite ? `SITE ${spikeSite}` : 'SPIKE'))
    : timerText
  const displayTimerColor = isSpikeActive ? '#FF3549' : timerColor

  const showScoreLine = isToggled('score-line')
  const showTeamStats = isToggled('team-stats') || isToggled('alive')
  const showMapHistory = isToggled('map-history')
  const showGameEvents = isToggled('game-events')
  const showSponsors = isToggled('sponsors')
  const showWebcam = isToggled('webcam')

  // Webcam auto-hide: only show if stream/photo is active, unless in editor
  const shouldRenderWebcam = showWebcam && (!liveOnly || (webcamActive && (webcamStream || webcamPlayerPhoto)))

  // Scoreline Team B guard: don't show phantom Team B when testing solo
  const hasRightTeam = !liveOnly ? true : (rightRoster.length > 0 || (!!rightTeamName && rightTeamName.trim() !== '' && rightTeamName !== 'Right Team' && rightTeamName !== 'Team B' && !hasLiveMatch))

  const webcamVideoRef = React.useRef<HTMLVideoElement | null>(null)
  React.useEffect(() => {
    if (webcamVideoRef.current && webcamStream) {
      webcamVideoRef.current.srcObject = webcamStream
      webcamVideoRef.current.play?.().catch(() => {})
    }
  }, [webcamStream])

  return (
    <div
      className="relative size-full min-h-full bg-[#1B1D1F] overflow-hidden select-none font-schabo text-[#DADBE3]"
      style={{
        width: 1920,
        height: 1080,
        '--left-team-color': leftTeamColor,
        '--right-team-color': rightTeamColor,
        '--main-left-color-change': leftTeamColor,
        '--main-right-color-change': rightTeamColor,
      } as React.CSSProperties}
    >
            {/* ===== ENDROUND BANNER (ValoSpectra endround-banner parity) ===== */}
      <EndroundBanner
        roundEnd={roundEnd}
        roundNumber={roundNumber}
        winType={gameEvent}
        leftName={bannerLeftName}
        rightName={bannerRightName}
        leftLogo={leftTeamLogo ?? null}
        rightLogo={rightTeamLogo ?? null}
        leftColor={leftTeamColor}
        rightColor={rightTeamColor}
      />
      {/* Top Map History */}
      {showMapHistory && activeMapHistory.length > 0 && (
        <div
          className={`clickable-component absolute top-3 left-4 z-30 flex items-center gap-2 cursor-pointer${activeComponentId === 'map-history' ? ' selected' : ''}`}
          data-component-id="map-history"
          onClick={(e) => {
            e.stopPropagation()
            onSelectComponent?.('map-history')
          }}
        >
          <div className="flex h-8 items-center gap-2 rounded-sm border border-white/20 bg-black/90 px-3 backdrop-blur-sm shadow-xl">
            {labeledMapHistory.map((item, i) => (
              <React.Fragment key={item.slot + item.mapId + i}>
                {i > 0 && <span className="text-white/30">|</span>}
                <span className="font-baijam text-[11px] font-bold text-white/70 uppercase">
                  {item.label}
                </span>
                <span className={'font-baijam text-[11px] font-extrabold uppercase ' + (item.kind === 'ban' ? 'text-[#FF4848]' : item.kind === 'decider' ? 'text-white' : 'text-[#1DCD9B]')}>
                  {item.mapName}
                </span>
                {item.score ? <span className="font-baijam text-[11px] font-bold text-white/80 px-1">{item.score}</span> : null}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Top Scoreline */}
      {showScoreLine && (
        <div
          className={'clickable-component border-0 border-none absolute top-0 z-2 flex' + (activeComponentId === 'score-line' ? ' selected' : '')}
          style={{ left: '50%', transform: 'translateX(-50%)' }}
          data-component-id="score-line"
          onClick={(e) => {
            e.stopPropagation()
            onSelectComponent?.('score-line')
          }}
          data-make-transparent="true"
        >
          <div className="relative flex flex-col items-center">
            <div
              className="relative h-18 w-full overflow-hidden rounded-sm p-0.5"
              style={{
                background: scoreLineBackgroundImage || (showBombTimer ? 'rgba(0, 0, 0, 0.9)' : undefined),
                border: '0.8px solid rgb(194, 194, 194)',
              }}
            >
              {scoreLineBackgroundImage && (
                <img className="absolute top-0 left-0 z-0 size-full object-cover" src={scoreLineBackgroundImage} alt="" />
              )}
              <div className="relative z-1 flex size-full items-center justify-between overflow-hidden rounded-xs">
                {scoreLineSmall ? (
                  <ScoreSmallBlock teamColor={leftTeamColor} />
                ) : (
                  <ScoreTeamBlock
                    teamName={leftTeamName}
                    teamColor={leftTeamColor}
                    score={scoreLeft}
                    colors={scoreLineLeftColor}
                    variant={showLogos ? 'default' : 'no-logo'}
                    teamLogo={leftTeamLogo}
                    seed={leftTeamSeed}
                  />
                )}

                {/* Center Timer and Series */}
                <div className={'flex h-full items-center justify-between ' + (scoreLineSmall ? 'px-0.5' : 'w-30 px-[2.5px]')}>
                  {showSeries && <ScoreSeriesBar color={leftTeamColor} score={seriesScoreLeft} scoreToWin={bestOf || 3} />}
                  <div className={'flex h-full flex-1 items-center justify-center ' + (scoreLineBackgroundImage || !showBombTimer ? 'bg-transparent' : 'bg-black')}>
                    {scoreLineSmall && (
                      <div className="mx-6.75 flex h-full w-10 items-center justify-center">
                        <h1 className="translate-y-1 text-[48px]" style={{ color: (scoreLineLeftColor?.score || '#DADBE3') }}>{scoreLeft}</h1>
                      </div>
                    )}
                    {showBombTimer && (
                      <h1 className="translate-y-1 flex items-center gap-2 text-[40px]" style={{ color: displayTimerColor }}>
                        {spikeState === 'planted' && (
                          <img src="/game/val/misc/Spike_Icon.svg" alt="" className="h-[30px] w-auto object-contain" />
                        )}
                        {displayTimerText}
                      </h1>
                    )}
                    {scoreLineSmall && (
                      <div className="mx-6.75 flex h-full w-10 items-center justify-center">
                        <h1 className="translate-y-1 text-[48px]" style={{ color: (scoreLineRightColor?.score || '#DADBE3') }}>{scoreRight}</h1>
                      </div>
                    )}
                  </div>
                  {showSeries && hasRightTeam && <ScoreSeriesBar color={rightTeamColor} score={seriesScoreRight} scoreToWin={bestOf || 3} />}
                </div>

                {/* Right Team Block (conditionally rendered if opponents exist) */}
                {hasRightTeam && (
                  scoreLineSmall ? (
                    <ScoreSmallBlock teamColor={rightTeamColor} />
                  ) : (
                    <ScoreTeamBlock
                      teamName={rightTeamName}
                      teamColor={rightTeamColor}
                      score={scoreRight}
                      colors={scoreLineRightColor}
                      isFlipped
                      variant={showLogos ? 'default' : 'no-logo'}
                      teamLogo={rightTeamLogo}
                      seed={rightTeamSeed}
                    />
                  )
                )}
              </div>
            </div>

            {/* Bottom watermarked info bar */}
            <div
              className="relative grid h-full w-full grid-cols-3 items-center rounded-[3.37px] bg-[#000000AA] text-[22px] whitespace-nowrap uppercase"
              style={{ height: (19 * (scoreLineSize > 1 ? 1 + scoreLineSize * 0.1 : 1)).toFixed(1) + 'px' }}
            >
              <div className="font-semibold flex min-w-0 items-center justify-center px-1 font-mussels">
                {[seriesTitleText, gameSeriesText].filter(Boolean).map((t, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span className="text-white/40">|</span>}
                    <span className="truncate">{t}</span>
                  </React.Fragment>
                ))}
              </div>
              <div className="font-semibold flex min-w-0 items-center justify-center px-1 font-insatiable">
                <span className="truncate text-[20px] leading-none">{roundText}</span>
              </div>
              <div className="font-semibold flex min-w-0 items-center justify-center px-1 font-mussels">
                {[eventTitleText, watermarkText].filter(Boolean).map((t, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span className="text-white/40">|</span>}
                    <span className="truncate">{t}</span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Right Sponsors */}
      {showSponsors && (
        <div
          className={`clickable-component border-0 border-none absolute top-1.5 right-1.5 z-1 flex h-18.5 w-61.25 justify-center${activeComponentId === 'sponsors' ? ' selected' : ''}`}
          data-component-id="sponsors"
          onClick={(e) => {
            e.stopPropagation()
            onSelectComponent?.('sponsors')
          }}
          data-make-transparent="true"
        >
          <div className="size-full">
            <div className="sponsors-card relative overflow-hidden p-1 size-full rounded-sm">
              <div className="absolute top-0 left-0 size-full bg-[#000000BD]" />
              <img
                alt="sponsor"
                decoding="sync"
                loading="eager"
                className="relative z-1 size-full object-contain"
                src="/sponsor/Sponsor-1.png"
              />
            </div>
          </div>
        </div>
      )}

      {/* Bottom Left & Right Alive Player Stats */}
      {showTeamStats && (
        <div
          className={`clickable-component border-0 border-none absolute bottom-0 left-0 z-1 flex w-full justify-between p-2.5${activeComponentId === 'team-stats' ? ' selected' : ''}`}
          data-component-id="team-stats"
          onClick={(e) => {
            e.stopPropagation()
            onSelectComponent?.('team-stats')
          }}
          data-make-transparent="true"
        >
          <div className="relative flex w-full justify-between duration-500 translate-y-0 opacity-100 items-end">
            {/* Left Team Roster Column */}
            <div className="w-67.5 duration-700 origin-bottom-left flex flex-col justify-end">
              {leftRoster.map((player, idx) => (
                <IngamePlayerCard
                  key={player.id || idx}
                  player={player}
                  side="left"
                  index={idx}
                  teamColor={leftTeamColor}
                  textColor={teamStatsLeftColor}
                  showEco={showEco}
                  showUlts={showUlts}
                  showKills={showKills}
                  showDeaths={showDeaths}
                  showAssists={showAssists}
                  isObserved={isObservedPlayer(player, 'left', idx)}
                />
              ))}
            </div>

            {/* Right Team Roster Column (Hidden when empty in solo testing) */}
            {rightRoster.length > 0 && (
              <div className="w-67.5 duration-700 origin-bottom-right flex flex-col justify-end">
                {rightRoster.map((player, idx) => (
                  <IngamePlayerCard
                    key={player.id || idx}
                    player={player}
                    side="right"
                    index={idx}
                    teamColor={rightTeamColor}
                    textColor={teamStatsRightColor}
                    showEco={showEco}
                    showUlts={showUlts}
                    showKills={showKills}
                    showDeaths={showDeaths}
                    showAssists={showAssists}
                    isObserved={isObservedPlayer(player, 'right', idx)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ceremony Banner / Game Event (Ace, Clutch, Defused, Detonated, etc.) */}
      {(showGameEvents || liveOnly) && gameEvent && (
        <div
          className={`clickable-component absolute top-48 left-1/2 -translate-x-1/2 z-40 flex items-center justify-center px-12 py-4 rounded-md border border-white/20 bg-black/90 backdrop-blur-md shadow-2xl transition-all duration-300 animate-in fade-in zoom-in-95${
            activeComponentId === 'game-events' ? ' selected' : ''
          }`}
          data-component-id="game-events"
          onClick={(e) => {
            e.stopPropagation()
            onSelectComponent?.('game-events')
          }}
        >
          <div
            className="absolute inset-0 opacity-20 pointer-events-none rounded-md"
            style={{ background: `radial-gradient(circle, ${leftTeamColor} 0%, transparent 70%)` }}
          />
          <h1 className="font-schabo text-[72px] text-white uppercase drop-shadow-lg tracking-wider">
            {gameEvent}
          </h1>
        </div>
      )}

      {/* Facecam / Webcam (Auto-hides when inactive in live overlay) */}
      {shouldRenderWebcam && (
        <div
          className={`clickable-component val-classic-facecam absolute z-30 flex flex-col cursor-pointer overflow-hidden rounded-sm border border-white/20 bg-black/95 shadow-2xl${
            activeComponentId === 'webcam' ? ' selected' : ''
          }`}
          data-component-id="webcam"
          style={{
            left: 476,
            bottom: 145,
            width: 310,
            height: 174,
          }}
          onClick={(e) => {
            e.stopPropagation()
            onSelectComponent?.('webcam')
          }}
        >
          <div className="relative flex-1 bg-[#121417] flex items-center justify-center overflow-hidden">
            {webcamStream ? (
              <video ref={webcamVideoRef} autoPlay playsInline muted className="size-full object-cover" />
            ) : webcamActive && webcamPlayerPhoto ? (
              <img src={webcamPlayerPhoto} alt="" className="size-full object-cover" />
            ) : (
              <div className="text-center">
                <svg className="w-8 h-8 text-white/30 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span className="text-[11px] font-bold uppercase tracking-widest text-white/40 font-baijam">{webcamActive ? 'CAMERA FEED' : 'CAMERA OFFLINE'}</span>
              </div>
            )}
          </div>
          <div className="h-7 bg-black/90 px-3 flex items-center justify-between border-t border-white/10">
            <span className="font-baijam text-xs font-bold text-white uppercase">{webcamActive ? webcamPlayerName : 'No camera'}</span>
            <span className={'flex items-center gap-1.5 text-[10px] font-bold font-baijam ' + (webcamActive ? 'text-emerald-400' : 'text-white/40')}>
              <span className={'size-1.5 rounded-full ' + (webcamActive ? 'bg-emerald-400 animate-pulse' : 'bg-white/30')} />
              {webcamActive ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default IngameHudScene
