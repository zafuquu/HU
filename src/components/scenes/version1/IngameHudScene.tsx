import React from 'react'
import {
  RoundCeremony,
  getWeaponImg,
  useSpikeBlink,
  type IngameHudSceneProps,
} from '../classic/IngameHudScene'
import {
  BLANK_IMG,
  abilityImg,
  agentIcon,
  agentPortrait,
  aliveOf,
  armorOf,
  chargeBarStyle,
  chargeState,
  creditsOf,
  hexRgba,
  hpOf,
  kdaOf,
  ultReadyOf,
} from '../broadcastKit'
import { resolveAgent } from '../../../data/valAgentMeta'

/** Broadcast kit — VCT-style ingame HUD (player panels, scorebug, 1v1 duel mode). */

const KIT_CSS = `
@keyframes kitFlame {
  0% { box-shadow: 0 0 8px 2px rgba(255,110,40,0.55); }
  100% { box-shadow: 0 0 16px 5px rgba(255,150,60,0.92); }
}
@keyframes kitBlink { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
@keyframes kitGeIn { from { opacity: 0; } to { opacity: 1; } }
`

const SKULL_SVG = (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2a9 9 0 0 0-9 9c0 3.2 1.6 6 4 7.6V20a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1.4c2.4-1.6 4-4.4 4-7.6a9 9 0 0 0-9-9zm-3 10a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
  </svg>
)

const EYE_SVG = (
  <svg fill="none" height="9" viewBox="0 0 10 8" width="11">
    <path
      d="M9.97125 3.42679C9.95667 3.39152 9.60375 2.55268 8.81917 1.71205C7.77375 0.591964 6.45333 0 5 0C3.54667 0 2.22625 0.591964 1.18083 1.71205C0.396246 2.55268 0.0416627 3.39286 0.028746 3.42679C0.00979317 3.47246 0 3.52189 0 3.57187C0 3.62186 0.00979317 3.67129 0.028746 3.71696C0.0433294 3.75223 0.396246 4.59063 1.18083 5.43125C2.22625 6.55089 3.54667 7.14286 5 7.14286C6.45333 7.14286 7.77375 6.55089 8.81917 5.43125C9.60375 4.59063 9.95667 3.75223 9.97125 3.71696C9.99021 3.67129 10 3.62186 10 3.57187C10 3.52189 9.99021 3.47246 9.97125 3.42679ZM5 5.35714C4.67036 5.35714 4.34813 5.25241 4.07405 5.0562C3.79997 4.85998 3.58635 4.58109 3.4602 4.25479C3.33405 3.9285 3.30105 3.56945 3.36536 3.22305C3.42967 2.87666 3.5884 2.55847 3.82149 2.30874C4.05458 2.059 4.35155 1.88893 4.67485 1.82003C4.99815 1.75112 5.33326 1.78649 5.63781 1.92164C5.94235 2.0568 6.20265 2.28568 6.38578 2.57934C6.56892 2.873 6.66667 3.21825 6.66667 3.57143C6.66667 4.04503 6.49107 4.49923 6.17851 4.83412C5.86595 5.16901 5.44203 5.35714 5 5.35714Z"
      fill="white"
    />
  </svg>
)

/** Ultimate orb — static ring + team-color glow when fully charged. */
function UltOrb({ player, teamColor }: { player: any; teamColor: string }) {
  const ready = ultReadyOf(player)
  return (
    <div className="relative grid size-[27px] shrink-0 place-items-center">
      {ready && (
        <span
          className="absolute -inset-[3px] rounded-full border-2 border-dashed"
          style={{ borderColor: teamColor }}
        />
      )}
      <span
        className="absolute inset-0 rounded-full border border-white/35 bg-black/80"
        style={ready ? { boxShadow: `0 0 14px 4px ${hexRgba(teamColor, 0.9)}` } : undefined}
      />
      <img
        src={abilityImg(player, 'X')}
        alt=""
        className="relative size-[17px] object-contain"
        style={{ opacity: ready ? 1 : 0.72 }}
        onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
      />
    </div>
  )
}

/** Ability icon + charge bar under it (lit / spent-dim / hollow-unknown). */
function AbilityCharge({ player, slot, st }: { player: any; slot: 'C' | 'Q' | 'E'; st: any }) {
  const state = chargeState(st, slot)
  return (
    <div className="flex flex-col items-center">
      <img
        src={abilityImg(player, slot)}
        alt=""
        className="size-[17px] object-contain"
        style={{ opacity: state === 'ready' ? 1 : state === 'spent' ? 0.4 : 0.55 }}
        onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
      />
      <span className="mt-[3px] block h-[3px] w-[17px] rounded-full" style={chargeBarStyle(state)} />
    </div>
  )
}

/** One player panel: portrait, name/KDA, HP strip, ult orb, ability bars, weapon, credits/shield. */
function KitPanel({
  player,
  side,
  teamColor,
  isObserved,
}: {
  player: any
  side: 'left' | 'right'
  teamColor: string
  isObserved: boolean
}) {
  const isRight = side === 'right'
  const alive = aliveOf(player)
  const hp = hpOf(player)
  const armor = armorOf(player)
  const { k, d, a } = kdaOf(player)
  const credits = creditsOf(player)
  const alias = player.alias || player.name || player.riotId || 'Player'
  const weaponSrc = getWeaponImg(player.weapon || player.weaponName)
  const st = player.abilityState
  return (
    <div className="relative" style={{ width: alive ? 300 : 200, opacity: alive ? 1 : 0.6 }}>
      {/* Spike carrier badge — small white circle on the panel's outer edge (image 1) */}
      {player.hasSpike && (
        <div
          className={`absolute top-[6px] z-10 grid size-[26px] place-items-center rounded-full bg-white shadow-lg ${isRight ? '-right-[10px]' : '-left-[10px]'}`}
        >
          <img src="/game/val/misc/Spike_Icon.svg" alt="spike" className="size-[13px] object-contain" />
        </div>
      )}
      {/* Spectated-row eye badge */}
      {isObserved && (
        <div
          className={`absolute bottom-[36px] z-10 grid size-[22px] place-items-center rounded-full border border-white/40 bg-black/85 ${isRight ? '-right-[8px]' : '-left-[8px]'}`}
        >
          {EYE_SVG}
        </div>
      )}
      <div
        className="relative overflow-hidden rounded-[4px]"
        style={{
          background: alive
            ? `linear-gradient(${isRight ? '270deg' : '90deg'}, ${hexRgba(teamColor, 0.16)} 0%, rgba(8,10,14,0) 58%), rgba(8,10,14,0.92)`
            : 'rgba(8,10,14,0.92)',
        }}
      >
        {/* Row 1 — portrait, name + KDA, shield hex, HP */}
        <div className={`flex h-[42px] items-center gap-2 px-1.5 ${isRight ? 'flex-row-reverse' : ''}`}>
          <div className="relative size-[38px] shrink-0 overflow-hidden rounded-[3px]">
            <img
              src={agentIcon(player)}
              alt=""
              className={`size-full object-contain ${alive ? '' : 'grayscale opacity-45'}`}
              style={isRight ? { transform: 'scaleX(-1)' } : undefined}
              onError={e => { (e.currentTarget as HTMLImageElement).src = BLANK_IMG }}
            />
            {!alive && (
              <div className="absolute inset-0 grid place-items-center text-[#FF3549] [&>svg]:size-[15px]">
                {SKULL_SVG}
              </div>
            )}
          </div>
          <h1 className="w-full truncate font-barlowCond text-[16px] font-semibold leading-tight text-white">
            {alias}
          </h1>
          <span className="font-barlowCond text-[11px] font-semibold leading-none tabular-nums text-white/55">
            {k}/{d}/{a}
          </span>
          <div className={`flex shrink-0 items-center gap-1.5 ${isRight ? 'flex-row-reverse' : ''}`}>
            <div
              className="grid size-[21px] place-items-center"
              style={{
                clipPath: 'polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)',
                background: armor > 0 ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.14)',
              }}
            >
              <span
                className="font-barlowCond text-[10px] font-extrabold leading-none"
                style={{ color: armor > 0 ? '#0A0C11' : 'rgba(255,255,255,0.65)' }}
              >
                {armor}
              </span>
            </div>
            <span
              className="font-barlowCond text-[17px] font-bold leading-none tabular-nums"
              style={{ color: alive ? '#fff' : '#8a8f98' }}
            >
              {hp}
            </span>
          </div>
        </div>
        {/* Health strip — team-color fill */}
        <div className="h-[5px] w-full bg-black/70">
          <div
            className={`h-full ${isRight ? 'float-right' : ''}`}
            style={{ width: `${alive ? hp : 0}%`, background: alive ? teamColor : 'transparent' }}
          />
        </div>
        {/* Row 2 — ult orb, ability charge bars, weapon, credits */}
        <div className={`flex h-[32px] items-center gap-2 bg-[#0A0C11] px-2 ${isRight ? 'flex-row-reverse' : ''}`}>
          <UltOrb player={player} teamColor={teamColor} />
          <span className="h-[18px] w-px bg-white/10" />
          <div className={`flex items-center gap-2 ${isRight ? 'flex-row-reverse' : ''}`}>
            <AbilityCharge player={player} slot="C" st={st} />
            <AbilityCharge player={player} slot="Q" st={st} />
            <AbilityCharge player={player} slot="E" st={st} />
          </div>
          <div className="flex-1" />
          {alive && (
            <img
              src={weaponSrc}
              alt=""
              className={`max-h-[17px] max-w-[74px] object-contain ${isRight ? '' : '-scale-x-100'}`}
              style={{ opacity: 0.92 }}
              onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
            />
          )}
          {credits != null && (
            <span
              className="flex items-center gap-1 font-barlowCond text-[13px] font-bold tabular-nums"
              style={{ color: alive ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)' }}
            >
              <svg viewBox="0 0 190 190" fill="none" className="size-[11px] rotate-45">
                <circle cx="95" cy="95" r="54" stroke="currentColor" strokeWidth="26" />
                <path d="M95 52v86" stroke="currentColor" strokeWidth="22" />
              </svg>
              {credits}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

/** Top-center scorebug: names, seeds, scores, series diamonds, round clock / spike timer. */
function Scorebug(props: {
  leftName: string
  rightName: string
  leftSeed?: number | string
  rightSeed?: number | string
  leftColor: string
  rightColor: string
  scoreLeft: number
  scoreRight: number
  seriesLeft: number
  seriesRight: number
  bestOf: number
  showSeries: boolean
  showLogos: boolean
  leftLogo?: string | null
  rightLogo?: string | null
  roundLabel: string
  timerText: string
  timerColor: string
  spikeActive: boolean
  spikeBlinkOn: boolean
  seriesTitleText: string
  gameSeriesText: string
  eventTitleText: string
  roundText: string
}) {
  const {
    leftName, rightName, leftSeed, rightSeed, leftColor, rightColor,
    scoreLeft, scoreRight, seriesLeft, seriesRight, bestOf,
    showSeries,
    showLogos, leftLogo, rightLogo,
    roundLabel, timerText, timerColor,
    spikeActive, spikeBlinkOn,
    seriesTitleText, gameSeriesText, eventTitleText, roundText,
  } = props
  const toWin = Math.max(1, Math.ceil((bestOf || 3) / 2))
  const diamonds = (won: number, color: string, flip: boolean) => (
    <div className={`flex gap-[5px] ${flip ? 'flex-row-reverse' : ''}`}>
      {Array.from({ length: toWin }, (_, i) => (
        <span
          key={i}
          className="size-[7px] rotate-45 border"
          style={i < won ? { background: color, borderColor: color } : { borderColor: 'rgba(255,255,255,0.45)' }}
        />
      ))}
    </div>
  )
  const teamCell = (side: 'left' | 'right') => {
    const isRight = side === 'right'
    const name = isRight ? rightName : leftName
    const seed = isRight ? rightSeed : leftSeed
    const color = isRight ? rightColor : leftColor
    const score = isRight ? scoreRight : scoreLeft
    const series = isRight ? seriesRight : seriesLeft
    const logo = isRight ? rightLogo : leftLogo
    const logoEl = showLogos && logo ? (
      <img
        src={logo}
        alt=""
        className="size-[36px] shrink-0 object-contain"
        onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
      />
    ) : (
      <div className="grid size-[32px] shrink-0 place-items-center rounded-full" style={{ background: color }}>
        <span className="font-schabo text-[15px] leading-none text-black/80">{name.slice(0, 1)}</span>
      </div>
    )
    const nameCol = (
      <div className={`flex min-w-0 flex-1 flex-col gap-0.5 ${isRight ? 'items-end' : 'items-start'}`}>
        {seed != null && seed !== '' && (
          <span className="font-baijam text-[9px] font-bold tracking-[0.14em] text-white/50">#{seed}</span>
        )}
        <span className="w-full truncate font-schabo text-[25px] uppercase leading-none text-white">{name}</span>
        {showSeries && diamonds(series, color, isRight)}
      </div>
    )
    const scoreEl = <span className="shrink-0 font-schabo text-[38px] leading-none tabular-nums text-white">{score}</span>
    return (
      <div
        className={`flex flex-1 items-center gap-2.5 px-3 ${isRight ? 'flex-row-reverse' : ''}`}
        style={{ borderBottom: `3px solid ${color}` }}
      >
        {isRight ? (
          <>
            {scoreEl}
            {logoEl}
            {nameCol}
          </>
        ) : (
          <>
            {logoEl}
            {nameCol}
            {scoreEl}
          </>
        )}
      </div>
    )
  }
  return (
    <div className="absolute left-1/2 top-0 z-20 -translate-x-1/2" style={{ width: 812 }}>
      <div className="flex h-[64px] items-stretch overflow-hidden rounded-b-[6px] border border-t-0 border-white/25 bg-black/90">
        {teamCell('left')}
        <div className="relative flex w-[150px] shrink-0 flex-col items-center justify-center gap-1">
          <span className="font-baijam text-[9px] font-bold uppercase tracking-[0.22em] text-white/60">{roundLabel}</span>
          <div className="flex items-center gap-1">
            {spikeActive && (
              <img
                src="/game/val/misc/Spike_Icon.svg"
                alt=""
                className="size-[15px]"
                style={{ filter: 'invert(31%) sepia(89%) saturate(4348%) hue-rotate(336deg) brightness(101%) contrast(96%)', opacity: spikeBlinkOn ? 1 : 0.15 }}
              />
            )}
            <span className="font-schabo text-[34px] leading-none tabular-nums" style={{ color: timerColor }}>{timerText}</span>
          </div>
        </div>
        {teamCell('right')}
      </div>
      {/* Bottom info bar — series / round / event titles (classic parity) */}
      <div className="relative flex h-[22px] items-center justify-between rounded-b-[3px] bg-black/65 px-4 font-mussels text-[13px] uppercase">
        <div className="flex min-w-0 max-w-[300px] items-center gap-1.5">
          {[seriesTitleText, gameSeriesText].filter(Boolean).map((t, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-white/35">|</span>}
              <span className="truncate text-white/80">{t}</span>
            </React.Fragment>
          ))}
        </div>
        <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-insatiable text-[15px] text-white/90">{roundText}</span>
        <div className="flex min-w-0 max-w-[300px] items-center justify-end gap-1.5">
          {eventTitleText ? <span className="truncate text-white/80">{eventTitleText}</span> : null}
        </div>
      </div>
    </div>
  )
}

/** Duel-mode camera card — video when the feed belongs to this side, else fallback art. */
function DuelCamCard(props: {
  survivor: any
  teamColor: string
  teamLogo?: string | null
  showVideo: boolean
  videoStream: MediaStream | null
  videoRef: React.RefObject<HTMLVideoElement | null>
  photo?: string | null
}) {
  const { survivor, teamLogo, showVideo, videoStream, videoRef, photo } = props
  const name = survivor ? String(survivor.alias || survivor.name || survivor.riotId || 'Player') : ''
  const { k, d, a } = kdaOf(survivor || {})
  const fallbackPortrait = agentPortrait(survivor || {})
  return (
    <div className="w-[310px] overflow-hidden rounded-sm border border-white/20 bg-black/95 shadow-2xl">
      <div className="relative h-[164px] bg-[#121417]">
        {showVideo && videoStream ? (
          <video ref={videoRef} autoPlay playsInline muted className="size-full object-cover" />
        ) : photo ? (
          <img src={photo} alt="" className="size-full object-cover" />
        ) : teamLogo ? (
          <img
            src={teamLogo}
            alt=""
            className="size-full object-contain p-5"
            style={{ background: 'radial-gradient(circle at 50% 35%, rgba(255,255,255,0.07), transparent 72%)' }}
          />
        ) : survivor ? (
          <img src={fallbackPortrait} alt="" className="size-full object-cover object-top" />
        ) : (
          <div className="grid size-full place-items-center">
            <div className="text-center">
              <svg className="mx-auto mb-1 w-8 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="font-baijam text-[11px] font-bold uppercase tracking-widest text-white/40">CAMERA OFFLINE</span>
            </div>
          </div>
        )}
      </div>
      <div className="flex h-7 items-center justify-between border-t border-white/10 bg-black/90 px-3">
        <span className="font-baijam text-xs font-bold uppercase text-white">{name || 'No camera'}</span>
        {survivor && (
          <span className="font-baijam text-[11px] font-bold tabular-nums text-white/70">{k} / {d} / {a}</span>
        )}
      </div>
    </div>
  )
}

/** Duel-mode death strip: grayed portraits of the fallen, lined up at the corner. */
function DeathStrip({ players, side }: { players: any[]; side: 'left' | 'right' }) {
  if (players.length === 0) return null
  return (
    <div className={`flex gap-1.5 ${side === 'right' ? 'flex-row-reverse' : ''}`}>
      {players.map((p, i) => (
        <div key={p.id || i} className="relative size-[54px] overflow-hidden rounded-[3px] border border-white/10 bg-black/60">
          <img
            src={agentPortrait(p)}
            alt=""
            className="size-full object-cover object-top opacity-65 grayscale"
            onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
          />
          <div className="absolute inset-0 grid place-items-center text-[#FF3549] opacity-90 [&>svg]:size-[18px]">
            {SKULL_SVG}
          </div>
        </div>
      ))}
    </div>
  )
}

export function BroadcastIngameHudScene(props: IngameHudSceneProps) {
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
    roundText = 'Round 1',
    timerColor = '#DADBE3',
    showLogos = true,
    showSeries = true,
    seriesScoreLeft = 0,
    seriesScoreRight = 0,
    bestOf = 3,
    seriesTitleText = '',
    eventTitleText = '',
    gameSeriesText = '',
    leftTeamLogo = null,
    rightTeamLogo = null,
    leftTeamPlayers = [],
    rightTeamPlayers = [],
    mapHistoryItems,
    webcamPlayerName = '',
    webcamPlayerPhoto = null,
    webcamActive = false,
    webcamPlayerStats = null,
    webcamStream = null,
    liveOnly = false,
    roundEnd = null,
    roundNumber = null,
    gameEvent = null,
    winSide = null,
    tournamentLogo = null,
    sponsorImageUrl = null,
    ceremonyText = null,
    ceremonyTrigger = null,
    ceremonyWinner = null,
    activeComponentId,
    onSelectComponent,
    isToggled = () => true,
    currentlyObserving = null,
    localPlayerName = null,
    spectating = false,
    spikeSite = null,
    spikeState = null,
    spikePlantedAt = null,
    eventsBg,
    gameEventsIndividual = false,
    gameEventsUploads,
    ceremonyPersistent = false,
  } = props

  // Game-events / ceremony wiring (classic parity — copied)
  const bannerLeftName = (leftTeamName || '').toUpperCase()
  const bannerRightName = (rightTeamName || '').toUpperCase()
  const roundEndReasonText =
    roundEnd?.reason === 'detonation' ? 'SPIKE DETONATED'
    : roundEnd?.reason === 'defusion' ? 'SPIKE DEFUSED'
    : 'ROUND WIN'
  const ceremonyReasonText = (ceremonyText || roundEndReasonText || '').trim().toUpperCase()
  const GE_REASON_FIELDS: Record<string, string> = {
    'ROUND WIN': 'game-events-bg-round-winner',
    ACE: 'game-events-bg-ace',
    CLUTCH: 'game-events-bg-clutch',
    FLAWLESS: 'game-events-bg-flawless',
    'TEAM ACE': 'game-events-bg-team-ace',
    THRIFTY: 'game-events-bg-thrifty',
  }
  const ceremonyEventImage =
    (gameEventsIndividual && GE_REASON_FIELDS[ceremonyReasonText]
      ? (gameEventsUploads?.[GE_REASON_FIELDS[ceremonyReasonText]] ?? null)
      : null) ||
    gameEventsUploads?.['game-events-bg-round-winner'] ||
    null
  const isCeremonyActive = !!(ceremonyTrigger || roundEnd?.winner)

  // Kit never substitutes demo players on live sources.
  const leftRoster = leftTeamPlayers || []
  const rightRoster = rightTeamPlayers || []

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

  // Spike clock (classic parity)
  const isSpikeActive = spikeState === 'planted' || spikeState === 'defusing'
  const spikeBlinkOn = useSpikeBlink(spikeState === 'planted')
  const [spikeNow, setSpikeNow] = React.useState(Date.now())
  React.useEffect(() => {
    if (spikeState !== 'planted' || !spikePlantedAt) return
    setSpikeNow(Date.now())
    const t = setInterval(() => setSpikeNow(Date.now()), 200)
    return () => clearInterval(t)
  }, [spikeState, spikePlantedAt])
  const spikeRemainingSec = (() => {
    if (spikeState !== 'planted' || !spikePlantedAt) return null
    return Math.max(0, 45 - Math.floor((spikeNow - Number(spikePlantedAt)) / 1000))
  })()
  const displayTimerText = isSpikeActive
    ? (spikeState === 'defusing'
        ? 'DEFUSING'
        : spikeRemainingSec != null
          ? `${Math.floor(spikeRemainingSec / 60)}:${String(spikeRemainingSec % 60).padStart(2, '0')}`
          : (spikeSite ? `SITE ${spikeSite}` : 'SPIKE'))
    : timerText
  const displayTimerColor = isSpikeActive ? '#FF3549' : timerColor

  const showScoreLine = isToggled('score-line')
  const showTeamStats = isToggled('team-stats') || isToggled('alive')
  const showMapHistory = isToggled('map-history')
  const showGameEvents = isToggled('game-events')
  const showSponsors = isToggled('sponsors')
  const showWebcam = isToggled('webcam')

  // Facecam identity chain (classic parity): observed → camera player → local
  const facecamIdentity = (() => {
    const sides = [
      { rows: leftTeamPlayers || [], side: 'left' as const },
      { rows: rightTeamPlayers || [], side: 'right' as const },
    ]
    const norm = (v: any) => String(v ?? '').toLowerCase().split('#')[0].trim()
    const keys = (
      webcamActive
        ? [webcamPlayerName, currentlyObserving]
        : [currentlyObserving, webcamPlayerName, localPlayerName]
    ).filter((k): k is string => !!k && k !== 'No camera' && k.trim() !== '')
    for (const k of keys) {
      for (const { rows, side } of sides) {
        const row = rows.find(
          (r: any) =>
            r &&
            (String(r.playerId ?? '') === String(k) ||
              String(r.name ?? '') === String(k) ||
              norm(r.alias) === norm(k) ||
              norm(r.name) === norm(k)),
        )
        if (row) return { row, side, key: k }
      }
    }
    return keys.length > 0 ? { row: null, side: null, key: keys[0] } : null
  })()
  const facecamName = (() => {
    if (!facecamIdentity) return null
    const r = facecamIdentity.row as any
    const raw = (r && (r.alias || r.name)) || facecamIdentity.key
    return String(raw || '').split('#')[0].trim() || null
  })()
  const facecamFallbackLogo =
    facecamIdentity?.row && facecamIdentity.side
      ? facecamIdentity.side === 'left' ? leftTeamLogo : rightTeamLogo
      : null
  const facecamFallbackPortrait = resolveAgent(facecamIdentity?.row)?.portrait ?? null
  const shouldRenderWebcam =
    showWebcam && (!liveOnly || (webcamActive && (webcamStream || webcamPlayerPhoto)) || !!facecamName)
  const webcamStats =
    webcamPlayerStats ??
    (facecamIdentity?.row
      ? {
          kills: (facecamIdentity.row as any).kills ?? 0,
          deaths: (facecamIdentity.row as any).deaths ?? 0,
          assists: (facecamIdentity.row as any).assists ?? 0,
        }
      : null)
  const webcamVideoRef = React.useRef<HTMLVideoElement | null>(null)
  React.useEffect(() => {
    if (webcamVideoRef.current && webcamStream) {
      webcamVideoRef.current.srcObject = webcamStream
      webcamVideoRef.current.play?.().catch(() => {})
    }
  }, [webcamStream])

  // Duel (1v1) mode: at most one survivor per side, at least one alive
  const leftAlive = leftRoster.filter(aliveOf)
  const rightAlive = rightRoster.filter(aliveOf)
  const duelSurvivorLeft = leftAlive[0] ?? null
  const duelSurvivorRight = rightAlive[0] ?? null
  const duelMode =
    leftRoster.length > 0 &&
    rightRoster.length > 0 &&
    leftAlive.length <= 1 &&
    rightAlive.length <= 1 &&
    leftAlive.length + rightAlive.length >= 1
  const duelVideoSide: 'left' | 'right' | null = (() => {
    const norm = (v: any) => String(v ?? '').toLowerCase().split('#')[0].trim()
    if (facecamIdentity?.side === 'left' && duelSurvivorLeft) return 'left'
    if (facecamIdentity?.side === 'right' && duelSurvivorRight) return 'right'
    const wname = norm(webcamPlayerName)
    if (wname) {
      if (duelSurvivorLeft && norm((duelSurvivorLeft as any).alias || (duelSurvivorLeft as any).name) === wname) return 'left'
      if (duelSurvivorRight && norm((duelSurvivorRight as any).alias || (duelSurvivorRight as any).name) === wname) return 'right'
    }
    if (currentlyObserving) {
      if (duelSurvivorLeft && norm((duelSurvivorLeft as any).name || (duelSurvivorLeft as any).alias) === norm(currentlyObserving)) return 'left'
      if (duelSurvivorRight && norm((duelSurvivorRight as any).name || (duelSurvivorRight as any).alias) === norm(currentlyObserving)) return 'right'
    }
    return null
  })()
  const duelVideoRef = React.useRef<HTMLVideoElement | null>(null)
  React.useEffect(() => {
    if (duelVideoRef.current && webcamStream) {
      duelVideoRef.current.srcObject = webcamStream
      duelVideoRef.current.play?.().catch(() => {})
    }
  }, [webcamStream, duelVideoSide])

  return (
    <div
      className="scene-root relative size-full select-none overflow-hidden bg-transparent font-schabo text-[#DADBE3] animate-[fadeIn_300ms_ease-out]"
      style={
        {
          width: 1920,
          height: 1080,
          '--left-team-color': leftTeamColor,
          '--right-team-color': rightTeamColor,
        } as React.CSSProperties
      }
    >
      <style>{KIT_CSS}</style>

      {/* Round ceremony (game events) — classic RoundCeremony, copied wiring */}
      {showTeamStats && (
        <RoundCeremony
          trigger={ceremonyTrigger || (roundEnd?.winner ? 'rd:' + (roundNumber ?? 0) + ':' + roundEnd.winner : null)}
          reasonText={ceremonyText || roundEndReasonText}
          roundNumber={roundNumber}
          winSide={winSide}
          winnerName={(ceremonyWinner || roundEnd?.winner) === 'blue' ? bannerLeftName : bannerRightName}
          winnerLogo={((ceremonyWinner || roundEnd?.winner) === 'blue' ? leftTeamLogo : rightTeamLogo) ?? null}
          winnerColor={(ceremonyWinner || roundEnd?.winner) === 'blue' ? leftTeamColor : rightTeamColor}
          winnerFromLeft={(ceremonyWinner || roundEnd?.winner) === 'blue'}
          leftColor={leftTeamColor}
          rightColor={rightTeamColor}
          gameEventLogo={tournamentLogo}
          tournamentLogo={tournamentLogo}
          clutchHighlight={roundEnd?.highlightPlayer ?? null}
          baseColor={eventsBg}
          accentColor={undefined}
          eventImage={ceremonyEventImage}
          persistent={ceremonyPersistent}
          activeComponentId={activeComponentId}
          onSelectComponent={onSelectComponent}
        />
      )}

      {/* Top Map History (classic parity) */}
      {showMapHistory && labeledMapHistory.length > 0 && (
        <div
          className="clickable-component absolute left-4 top-3 z-30 flex cursor-pointer items-center gap-2"
          data-component-id="map-history"
          onClick={e => {
            e.stopPropagation()
            onSelectComponent?.('map-history')
          }}
        >
          <div className="flex h-8 items-center gap-2 rounded-sm border border-white/20 bg-black/90 px-3 shadow-xl backdrop-blur-sm">
            {labeledMapHistory.map((item, i) => (
              <React.Fragment key={item.slot + item.mapId + i}>
                {i > 0 && <span className="text-white/30">|</span>}
                <span className="font-baijam text-[11px] font-bold uppercase text-white/70">{item.label}</span>
                <span
                  className={
                    'font-baijam text-[11px] font-extrabold uppercase ' +
                    (item.kind === 'ban' ? 'text-[#FF4848]' : item.kind === 'decider' ? 'text-white' : 'text-[#1DCD9B]')
                  }
                >
                  {item.mapName}
                </span>
                {item.score ? <span className="px-1 font-baijam text-[11px] font-bold text-white/80">{item.score}</span> : null}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Top Scorebug */}
      {showScoreLine && (
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
          timerText={displayTimerText}
          timerColor={displayTimerColor}
          spikeActive={isSpikeActive}
          spikeBlinkOn={spikeBlinkOn}
          seriesTitleText={seriesTitleText}
          gameSeriesText={gameSeriesText}
          eventTitleText={eventTitleText}
          roundText={roundText || ''}
        />
      )}

      {/* Top Right Sponsors (classic parity) */}
      {showSponsors && (
        <div
          className="clickable-component absolute right-1.5 top-1.5 z-1 flex h-[74px] w-[245px] justify-center"
          data-component-id="sponsors"
          onClick={e => {
            e.stopPropagation()
            onSelectComponent?.('sponsors')
          }}
        >
          <div className="relative size-full overflow-hidden rounded-sm p-1">
            <div className="absolute left-0 top-0 size-full bg-[#000000BD]" />
            <img
              alt="sponsor"
              className="relative z-1 size-full object-contain"
              onError={e => {
                const el = e.currentTarget
                if (!el.dataset.fb) {
                  el.dataset.fb = '1'
                  el.src = '/sponsor/Sponsor-1.png'
                }
              }}
              src={tournamentLogo || sponsorImageUrl || '/sponsor/Sponsor-1.png'}
            />
          </div>
        </div>
      )}

      {/* ===== Normal mode: side roster columns ===== */}
      {!duelMode && showTeamStats && (
        <>
          <div className="absolute bottom-[14px] left-[16px] z-10 flex flex-col gap-[6px]">
            {leftRoster.map((player: any, idx: number) => (
              <KitPanel
                key={player.id || idx}
                player={player}
                side="left"
                teamColor={leftTeamColor}
                isObserved={isObservedPlayer(player, 'left', idx)}
              />
            ))}
          </div>
          {rightRoster.length > 0 && (
            <div className="absolute bottom-[14px] right-[16px] z-10 flex flex-col items-end gap-[6px]">
              {rightRoster.map((player: any, idx: number) => (
                <KitPanel
                  key={player.id || idx}
                  player={player}
                  side="right"
                  teamColor={rightTeamColor}
                  isObserved={isObservedPlayer(player, 'right', idx)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ===== Duel (1v1) mode: survivor panel + camera per side, death strips at the corners ===== */}
      {duelMode && showTeamStats && (
        <>
          {duelSurvivorLeft && (
            <div className="absolute bottom-[150px] left-[40px] z-10 flex flex-col items-start gap-2">
              <KitPanel
                player={duelSurvivorLeft}
                side="left"
                teamColor={leftTeamColor}
                isObserved={isObservedPlayer(duelSurvivorLeft, 'left', 0)}
              />
              <DuelCamCard
                survivor={duelSurvivorLeft}
                teamColor={leftTeamColor}
                teamLogo={leftTeamLogo}
                showVideo={duelVideoSide === 'left'}
                videoStream={webcamStream}
                videoRef={duelVideoRef}
                photo={duelVideoSide === 'left' ? webcamPlayerPhoto : null}
              />
            </div>
          )}
          {duelSurvivorRight && (
            <div className="absolute bottom-[150px] right-[40px] z-10 flex flex-col items-end gap-2">
              <KitPanel
                player={duelSurvivorRight}
                side="right"
                teamColor={rightTeamColor}
                isObserved={isObservedPlayer(duelSurvivorRight, 'right', 0)}
              />
              <DuelCamCard
                survivor={duelSurvivorRight}
                teamColor={rightTeamColor}
                teamLogo={rightTeamLogo}
                showVideo={duelVideoSide === 'right'}
                videoStream={webcamStream}
                videoRef={duelVideoRef}
                photo={duelVideoSide === 'right' ? webcamPlayerPhoto : null}
              />
            </div>
          )}
          <div className="absolute bottom-[16px] left-[16px] z-10">
            <DeathStrip players={leftRoster.filter((p: any) => !aliveOf(p))} side="left" />
          </div>
          <div className="absolute bottom-[16px] right-[16px] z-10 flex justify-end">
            <DeathStrip players={rightRoster.filter((p: any) => !aliveOf(p))} side="right" />
          </div>
        </>
      )}

      {/* Game-event banner (classic parity) */}
      {(showGameEvents || liveOnly) && gameEvent && !isCeremonyActive && !(roundEnd && (roundEnd.reason === 'detonation' || roundEnd.reason === 'defusion')) && (
        <div
          className="clickable-component absolute left-1/2 top-[190px] z-40 flex -translate-x-1/2 flex-col items-center justify-center overflow-hidden rounded-md border border-white/20 px-12 py-4 shadow-2xl"
          style={{ background: eventsBg || 'rgba(0,0,0,0.9)' }}
          data-component-id="game-events"
          onClick={e => {
            e.stopPropagation()
            onSelectComponent?.('game-events')
          }}
        >
          <style>{`@keyframes geIn { from { opacity: 0; } to { opacity: 1; } } .ge-in { animation: geIn 300ms ease-out; }`}</style>
          {eventsBg && <div className="ge-in pointer-events-none absolute inset-0" style={{ background: 'rgba(0,0,0,0.45)' }} />}
          <img
            alt=""
            src="/sponsor/Game Event.png"
            className="ge-in relative z-1 object-contain"
            style={{ maxHeight: 56, marginBottom: 4 }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
          />
          <h1 className="ge-in relative z-1 font-schabo text-[64px] uppercase leading-none tracking-wider text-white drop-shadow-lg">
            {gameEvent}
          </h1>
        </div>
      )}

      {/* Facecam (normal mode) — classic identity/fallback chain, kit position */}
      {!duelMode && shouldRenderWebcam && (
        <div
          className="clickable-component absolute z-30 flex cursor-pointer flex-col overflow-hidden rounded-sm border border-white/20 bg-black/95 shadow-2xl"
          data-component-id="webcam"
          style={{ left: 476, bottom: 145, width: 310, height: 174 }}
          onClick={e => {
            e.stopPropagation()
            onSelectComponent?.('webcam')
          }}
        >
          <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#121417]">
            {webcamStream ? (
              <video ref={webcamVideoRef} autoPlay playsInline muted className="size-full object-cover" />
            ) : webcamActive && webcamPlayerPhoto ? (
              <img src={webcamPlayerPhoto} alt="" className="size-full object-cover" />
            ) : facecamFallbackLogo ? (
              <img
                src={facecamFallbackLogo}
                alt=""
                className="size-full object-contain p-5"
                style={{ background: 'radial-gradient(circle at 50% 35%, rgba(255,255,255,0.07), transparent 72%)' }}
              />
            ) : facecamFallbackPortrait ? (
              <img src={facecamFallbackPortrait} alt="" className="size-full object-contain p-2" />
            ) : (
              <div className="text-center">
                <svg className="mx-auto mb-1 w-8 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span className="font-baijam text-[11px] font-bold uppercase tracking-widest text-white/40">
                  {webcamActive ? 'CAMERA FEED' : 'CAMERA OFFLINE'}
                </span>
              </div>
            )}
          </div>
          <div className="flex h-7 items-center justify-between border-t border-white/10 bg-black/90 px-3">
            <span className="font-baijam text-xs font-bold uppercase text-white">{facecamName || 'No camera'}</span>
            {webcamStats && (
              <span className="font-baijam text-[11px] font-bold tabular-nums text-white/70">
                {webcamStats.kills ?? 0} / {webcamStats.deaths ?? 0} / {webcamStats.assists ?? 0}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default BroadcastIngameHudScene
