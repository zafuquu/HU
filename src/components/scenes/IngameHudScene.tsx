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
  gameEvent?: string | null
  activeComponentId?: string | null
  onSelectComponent?: (id: string) => void
  isToggled?: (componentId: string) => boolean
  currentlyObserving?: string | null
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
  if (type === 2 || type === 3 || armor >= 50) return '/game/val/shields/Heavy_Armor.png'
  if (type === 1 || type === 4 || armor > 0) return '/game/val/shields/Light_Armor.png'
  return null
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
            {/* Health Bar progress row */}
            <div
              className={`over font-semibold relative flex h-6 w-full items-center font-barlowCond overflow-hidden ${
                isRight ? 'flex-row-reverse' : ''
              }`}
              style={{ color: isAlive ? textColor : '#737373' }}
            >
              {/* Dynamic Health Fill Bar */}
              <div
                className="absolute top-0 size-full rounded-[3px] transition-all duration-300 ease-out"
                style={{
                  backgroundColor: isAlive ? teamColor : 'rgba(0, 0, 0, 0.41)',
                  width: `${isAlive ? Math.max(0, Math.min(100, health)) : 0}%`,
                  [isRight ? 'right' : 'left']: 0,
                }}
              />

              {/* Agent Icon */}
              <div className="relative h-full w-12.5 shrink-0">
                <div className="absolute bottom-0 left-0 h-12.5 w-12.5 flex items-center justify-center">
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
              <div className={`h-full flex-1 min-w-0 px-1.5 flex items-center relative z-1 ${isRight ? 'justify-end text-right' : 'justify-start text-left'}`}>
                <span className={`font-semibold text-lg truncate uppercase leading-none ${isAlive ? '' : 'line-through text-white/40'}`}>
                  {alias}
                </span>
              </div>

              {/* Economy (Credits) */}
              {showEco && (
                <div className={`relative z-1 flex h-full items-center px-1.5 ${isRight ? 'flex-row-reverse mr-auto' : 'ml-auto'}`}>
                  <div className="flex h-full items-center justify-center">
                    <span className="font-semibold font-barlowSemiCond text-[15px]">{credits}</span>
                  </div>
                  <div className={isRight ? 'pr-1' : 'pl-1'}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 190 190" className="h-2.5 rotate-45 text-[#F9E4AB]">
                      <circle cx="94.566" cy="94.574" r="54.425" stroke="currentColor" strokeWidth="22.41" />
                      <path fill="currentColor" d="M80.164.12h28.813v32.015H80.164zM80.162 156.996h28.813v32.015H80.162zM32.135 76.965v28.813H.12V76.965zM189.01 76.964v28.813h-32.014V76.964z" />
                    </svg>
                  </div>
                </div>
              )}

              {/* Shield Icon */}
              {shieldSrc && (
                <div className="relative z-1 flex h-full w-6.75 items-center justify-center px-1">
                  <img src={shieldSrc} alt="shield" className="h-3.5 w-auto object-contain drop-shadow" />
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
                    <svg height="28" viewBox="0 0 30 30" width="28">
                      <circle cx="15" cy="15" r="13" fill="none" stroke={teamColor} strokeWidth="1.5" strokeOpacity={isAlive ? "0.4" : "0.1"} />
                    </svg>
                  </div>
                </div>
              )}

              {/* K/D/A */}
              <div className={`font-semibold flex items-center gap-2 font-barlowCond text-sm text-white/90 ${isRight ? 'flex-row-reverse' : ''}`}>
                {showKills && (
                  <span className="flex items-center gap-0.5">
                    <span className="text-[11px] text-white/40">K</span>
                    <span>{kills}</span>
                  </span>
                )}
                {showDeaths && (
                  <span className="flex items-center gap-0.5">
                    <span className="text-[11px] text-white/40">D</span>
                    <span>{deaths}</span>
                  </span>
                )}
                {showAssists && (
                  <span className="flex items-center gap-0.5">
                    <span className="text-[11px] text-white/40">A</span>
                    <span>{assists}</span>
                  </span>
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
    gameEvent = null,
    activeComponentId,
    onSelectComponent,
    isToggled = () => true,
    currentlyObserving = null,
    spikeSite = null,
    spikeState = null,
  } = props

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
    if (!currentlyObserving) return Boolean(side === 'left' && index === 0 && !liveOnly)
    const obs = String(currentlyObserving).toLowerCase().trim()
    const pName = String(p.name || p.alias || p.riotId || p.id || '').toLowerCase().trim()
    const pRiot = String(p.riotId || '').toLowerCase().trim()
    return Boolean(obs === pName || (pRiot && obs === pRiot) || (pName && obs.includes(pName)) || (pName && pName.includes(obs)))
  }

  const ROUND_END_TEXT: Record<string, string> = { elimination: 'ELIMINATED', detonation: 'SPIKE DETONATED', defusion: 'SPIKE DEFUSED', time: 'TIME RAN OUT' }
  const roundEndText = roundEnd ? ((ROUND_END_TEXT[roundEnd.reason || ''] || 'ROUND OVER') + (roundEnd.winner ? ' - ' + roundEnd.winner.toUpperCase() : '')) : null
  const isSpikeActive = spikeState === 'planted' || spikeState === 'defusing'
  const displayTimerText = roundEndText
    ? roundEndText
    : isSpikeActive
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
                      <h1 className="translate-y-1 text-[40px]" style={{ color: displayTimerColor }}>{displayTimerText}</h1>
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
                src="https://huds.blob.productions/common/default-sponsors/sponsor-1.png"
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
