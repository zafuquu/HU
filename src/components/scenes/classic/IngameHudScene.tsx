import React from 'react'
import { resolveAgent } from '../../../data/valAgentMeta'
import { fitScaleFor, contentWidth, refitAfterFonts } from '../../../lib/autoFit'
import { agentBust, agentPortrait, BLANK_IMG } from '../broadcastKit'

const CLASSIC_ULT_CSS = `
@keyframes ultGlowPulse {
  0%, 100% {
    box-shadow: 0 0 14px 2px rgba(250, 204, 21, 0.75), inset 0 0 8px rgba(250, 204, 21, 0.3);
    border-color: #FACC15;
  }
  50% {
    box-shadow: 0 0 24px 6px rgba(250, 204, 21, 0.95), inset 0 0 14px rgba(250, 204, 21, 0.5);
    border-color: #FEF08A;
  }
}
@keyframes ultIconPulse {
  0%, 100% { transform: scale(1); filter: brightness(1) drop-shadow(0 0 6px rgba(255,255,255,0.7)); }
  50% { transform: scale(1.1); filter: brightness(1.2) drop-shadow(0 0 14px rgba(255,255,255,0.95)); }
}
@keyframes v1UltSlideInLeft {
  0% { transform: translateX(-105%); }
  100% { transform: translateX(0); }
}
@keyframes v1UltSlideInRight {
  0% { transform: translateX(105%); }
  100% { transform: translateX(0); }
}
@keyframes v1UltSlideOutLeft {
  0% { transform: translateX(0); opacity: 1; }
  100% { transform: translateX(-105%); opacity: 0; }
}
@keyframes v1UltSlideOutRight {
  0% { transform: translateX(0); opacity: 1; }
  100% { transform: translateX(105%); opacity: 0; }
}
@keyframes v1UltIconReveal {
  0% { transform: scale(0.2); opacity: 0; filter: brightness(2.2); }
  65% { transform: scale(1.15); opacity: 1; filter: brightness(1.25); }
  100% { transform: scale(1); opacity: 1; filter: brightness(1); }
}
@keyframes v1UltBustRevealLeft {
  0% { transform: translateX(-24px); opacity: 0; }
  100% { transform: translateX(0); opacity: 0.96; }
}
@keyframes v1UltBustRevealRight {
  0% { transform: translateX(24px); opacity: 0; }
  100% { transform: translateX(0); opacity: 0.96; }
}
@keyframes ultEnter {
  0% { transform: scale(0.92); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes ultExit {
  0% { transform: scale(1); opacity: 1; }
  100% { transform: scale(0.92); opacity: 0; }
}
`

export interface IngameHudSceneProps {
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
  /** Game-events popover wiring → the RoundCeremony banner (the canonical
      game-events component; the legacy ACE card is suppressed when a
      ceremony is active). */
  eventsHighlight?: string
  gameEventsIndividual?: boolean
  gameEventsUploads?: Record<string, string | null>
  /** Editor preview: keep the ceremony resting at frame 1 so it stays clickable. */
  ceremonyPersistent?: boolean
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
  /** Observed player K/D/A shown in the facecam footer (BLOB parity — the
      original never shows a LIVE pill on the broadcast). */
  webcamPlayerStats?: { kills?: number; deaths?: number; assists?: number } | null
  webcamStream?: MediaStream | null
  liveOnly?: boolean
  roundEnd?: { winner: 'blue' | 'red' | null; reason: string | null; highlightPlayer?: { name: string; agent: string | null; kills: number | null; deaths: number | null; assists: number | null } | null } | null
  roundNumber?: number | null
  gameEvent?: string | null
  winSide?: string | null
  sponsorImageUrl?: string | null
  tournamentLogo?: string | null
  ceremonyText?: string | null
  ceremonyTrigger?: string | null
  ceremonyWinner?: string | null
  activeComponentId?: string | null
  onSelectComponent?: (id: string) => void
  isToggled?: (componentId: string) => boolean
  currentlyObserving?: string | null
  /** The local/viewer player's "Name#TAG" (snapshot state.viewerName — matches
      players[].playerId). Third facecam-identity anchor: observed → camera
      player → local. */
  localPlayerName?: string | null
  spectating?: boolean
  spikeSite?: string | null
  spikeState?: 'none' | 'planted' | 'defusing' | 'detonated' | 'defused' | null
  spikePlantedAt?: number | null
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

/** BLOB `auto-scaler` parity: scales the text down (never ellipsis) to fit the
    wrapper — this is what makes team names "auto adjust" in the original. */
function AutoScalerText({
  text,
  color,
  fontSize,
  fontWeight,
  letterSpacing,
  h1ClassName,
  wrapperClassName,
  minScale = 0.42,
}: {
  text: string
  color?: string
  fontSize: number
  fontWeight?: number
  letterSpacing?: number
  h1ClassName?: string
  wrapperClassName?: string
  minScale?: number
}) {
  const wrapRef = React.useRef<HTMLDivElement | null>(null)
  const h1Ref = React.useRef<HTMLHeadingElement | null>(null)
  const [scale, setScale] = React.useState(1)
  React.useLayoutEffect(() => {
    const update = () => {
      const wrap = wrapRef.current
      const el = h1Ref.current
      if (!wrap || !el) return
      // Canvas measure against the wrapper's CONTENT width — DOM measurement
      // pairs (scrollWidth/clientWidth) silently returned "fits" when the
      // wrapper was sized by its content or before the webfont loaded.
      setScale(fitScaleFor(text, el, contentWidth(wrap), minScale))
    }
    update()
    const ro = new ResizeObserver(update)
    if (wrapRef.current) ro.observe(wrapRef.current)
    if (h1Ref.current) ro.observe(h1Ref.current)
    refitAfterFonts(h1Ref.current, update)
    return () => ro.disconnect()
  }, [text, fontSize, minScale])
  return (
    <div ref={wrapRef} className={`relative h-full min-w-0 flex-1 ${wrapperClassName || ''}`} style={{ overflow: 'visible' }}>
      <h1
        ref={h1Ref}
        className={`whitespace-nowrap absolute left-1/2 top-1/2 uppercase ${h1ClassName || ''}`}
        style={{
          color,
          fontSize,
          fontWeight,
          letterSpacing,
          transform: `scale(${scale}) translate(-50%, -50%)`,
          transformOrigin: 'left top',
          transition: 'transform 200ms ease-out',
        }}
      >
        {text}
      </h1>
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
  // Original parity width: default variant reserves the logo slot (logo image
  // when configured, otherwise the team-color circle placeholder); no-logo is
  // the narrow w-80 block.
  const showLogoSlot = variant === 'default'
  return (
    <div
      className={`flex h-full justify-between bg-black/90 ${showLogoSlot ? 'w-95' : 'w-80'}`}
    >
      <div className={`h-full w-1.25 ${isFlipped ? 'rounded-r-xs' : 'rounded-l-xs'}`} style={{ backgroundColor: teamColor }} />
      <div className={`flex w-[86%] items-center justify-center gap-3.75 ${isFlipped ? 'flex-row-reverse' : ''}`}>
        {showLogoSlot && (
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
            <span className="shrink-0 text-[12px] font-bold px-1.5 py-0.5 rounded bg-white/15 text-white/80 font-mono">
              #{seed}
            </span>
          )}
          <AutoScalerText
            text={teamName || (isFlipped ? 'TEAM B' : 'TEAM A')}
            color={colors?.title || '#DADBE3'}
            fontSize={40}
          />
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
  // Original parity: the small variant's team block is a BLANK color square —
  // the team names move to the bottom info bar's side cells instead.
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

export function getWeaponImg(weapon: any) {
  if (!weapon || typeof weapon !== 'string') return '/game/val/weapons/classic.png'
  let w = weapon.toLowerCase().replace(/tx_hud_weapon_|tx_hud_pistol_|tx_hud_|weapon_/g, '').trim()
  if (w === 'knife' || w === 'tactical knife') w = 'melee'
  if (w === 'auto shotgun' || w === 'autoshotgun') w = 'judge'
  if (w === 'heavy sniper') w = 'operator'
  if (w === 'lever sniper') w = 'marshal'
  if (w === 'double barrel') w = 'outlaw'
  return `/game/val/weapons/${w}.png`
}

export function getShieldImg(p: any) {
  const armor = Number(p?.armor ?? p?.shield ?? 0)
  // GEP shield TIER enum (VS Armor table): 0 none / 1 light / 2 heavy /
  // 3 enemy-unknown (assume heavy) / 4 regen. Tier wins over points so a
  // regen shield never renders as light.
  const raw = Number(p?.shieldType)
  const type = Number.isInteger(raw) && raw >= 0 && raw <= 4 ? raw : (armor >= 50 ? 2 : armor > 0 ? 1 : 0)
  // Points first: a stale TIER with zero points must never render a shield
  // ("shield icon even without shield" — stale shieldType from the last round).
  if (armor <= 0) return '/game/val/shields/None.webp'
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


// VS spike-planted parity: the planted spike icon blinks faster as detonation
// approaches (1s -> 0.5s -> 0.25s -> 0.125s over the 45s fuse).
export function useSpikeBlink(active: boolean) {
  const [on, setOn] = React.useState(true)
  React.useEffect(() => {
    if (!active) { setOn(true); return }
    let alive = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let left = 45_000
    let last = Date.now()
    const tick = () => {
      if (!alive) return
      const now = Date.now()
      left -= now - last
      last = now
      if (left <= 1_000) return // stop blinking in the final second
      setOn((v) => !v)
      const next = left > 20_000 ? 1_000 : left > 10_000 ? 500 : left > 5_000 ? 250 : 125
      timer = setTimeout(tick, next)
    }
    timer = setTimeout(tick, 1_000)
    return () => { alive = false; if (timer) clearTimeout(timer) }
  }, [active])
  return on
}

const CEREMONY_CSS = '@keyframes cerIn { from { opacity: 0; transform: translateY(-18px); } to { opacity: 1; transform: none; } } @keyframes cerFrame2 { from { opacity: 0; transform: translateY(26px); } to { opacity: 1; transform: none; } }'
// Round ceremony, Havoc layout (user spec):
//   Frame 1 — CENTERED: brand logo + reason text (ROUND WIN / ACE / CLUTCH ...)
//   then the whole frame slides DOWN to the very bottom center, where
//   Frame 2 — [team logo / team name / ATTACKER-DEFENDER]  [brand logo / ROUND n]
export function RoundCeremony({ trigger, reasonText, roundNumber, winSide, winnerName, winnerLogo, winnerColor, winnerFromLeft, leftColor, rightColor, gameEventLogo, tournamentLogo, clutchHighlight, baseColor, accentColor, eventImage, persistent, activeComponentId, onSelectComponent }: {
  trigger: string | null
  reasonText: string | null
  roundNumber: number | null
  winSide?: string | null
  winnerName: string
  winnerLogo: string | null
  winnerColor: string
  /** True when the winner is the LEFT panel team — anchors the reveal gradient on that side. */
  winnerFromLeft?: boolean
  leftColor: string
  rightColor: string
  /** Logo shown above the round-end reason in frame 1 (tournament logo; default Game Event.png). */
  gameEventLogo?: string | null
  /** Logo shown above ROUND n in frame 2 (tournament logo; default Sponsor-1.png). */
  tournamentLogo?: string | null
  /**
   * Clutch player (agent + KDA) — original-desktop parity: on a 1vX clutch the
   * ceremony shows WHO clutched (agent portrait + K/D/A) instead of the plain
   * ATTACKER/DEFENDER line.
   */
  clutchHighlight?: { name: string; agent: string | null; kills: number | null; deaths: number | null; assists: number | null } | null
  /** Game-events popover wiring: Bg Color (banner base) + Highlight Color (edge glow). */
  baseColor?: string
  accentColor?: string
  /** Uploaded per-reason image (Round Win / Ace / …) replacing the default logo. */
  eventImage?: string | null
  /** Editor preview: rest at frame 1 forever so the card stays clickable. */
  persistent?: boolean
  activeComponentId?: string | null
  onSelectComponent?: (id: string) => void
}) {
  const [stage, setStage] = React.useState<'hidden' | 'center' | 'slide' | 'bottom' | 'out'>('hidden')
  const seen = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (!trigger || trigger === seen.current) return
    seen.current = trigger
    setStage('center')
    // Editor preview: rest at frame 1 so the card stays clickable for the
    // game-events popover — no slide/out/hidden sequence.
    if (persistent) return
    const t1 = setTimeout(() => setStage('slide'), 1900)
    const t2 = setTimeout(() => setStage('bottom'), 2400)
    const t3 = setTimeout(() => setStage('out'), 6200)
    const t4 = setTimeout(() => setStage('hidden'), 6600)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
  }, [trigger, persistent])
  if (stage === 'hidden') return null
  // Frame 1 sits centered; from the slide phase on, the box moves to the
  // bottom-center (box bottom lands 120px above the screen bottom).
  const boxTop = stage === 'center' ? 'calc(50% - 120px)' : 'calc(100% - 320px)'
  const frame2Visible = stage === 'bottom' || stage === 'out'
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 60, pointerEvents: 'none' }}>
      <style>{CEREMONY_CSS}</style>
      <div
        className={`clickable-component${activeComponentId === 'game-events' ? ' selected' : ''}`}
        data-component-id="game-events"
        data-make-transparent="true"
        onClick={(e) => {
          e.stopPropagation()
          onSelectComponent?.('game-events')
        }}
        style={{
          position: 'absolute', left: '50%', top: boxTop, width: 875, height: 200,
          transform: 'translateX(-50%)', transition: 'top 480ms cubic-bezier(0.4, 0, 0.2, 1)',
          opacity: stage === 'out' ? 0 : 1, transitionProperty: 'top, opacity',
          animation: stage === 'center' ? 'cerIn 300ms ease-out' : undefined,
          borderRadius: 4, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
          pointerEvents: 'auto', cursor: 'pointer',
        }}
      >
        {/* Frame 1 — brand logo + reason text */}
        <div
          style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            // Edge tints stay TEAM colors (left/right side each takes its own
            // team color — operator request); the popover Bg Color owns the
            // base band.
            background: 'linear-gradient(90deg, ' + leftColor + '55 0%, ' + (baseColor || 'rgba(10,14,22,0.92)') + ' 30%, ' + (baseColor || 'rgba(10,14,22,0.92)') + ' 70%, ' + rightColor + '55 100%)',
            opacity: frame2Visible ? 0 : 1, transition: 'opacity 250ms ease',
          }}
        >
          <img alt="" src={eventImage || gameEventLogo || '/sponsor/Game Event.png'} style={{ maxHeight: 76, objectFit: 'contain', marginBottom: 8 }} onError={e => { const el = e.currentTarget; if (!el.dataset.fb) { el.dataset.fb = '1'; el.src = '/sponsor/Game Event.png' } }} />
          <p style={{ fontSize: 34, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 3, margin: 0, textShadow: accentColor ? `0 0 18px ${accentColor}, 0 0 42px ${accentColor}66` : undefined }}>{reasonText || 'ROUND WIN'}</p>
          {/* Highlight Color (popover) — bottom accent glow bar across the banner */}
          {accentColor && (
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 4, background: accentColor, boxShadow: `0 0 14px ${accentColor}`, opacity: frame2Visible ? 0 : 1, transition: 'opacity 250ms ease' }} />
          )}
        </div>
        {/* Frame 2 — winner block + brand/ROUND n block */}
        <div
          style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
            // Reveal gradient anchored on the WINNING team's side — when the
            // right team wins, the color sweeps from the right edge (the old
            // always-left gradient put the right team's color on the wrong
            // side of the banner).
            background: 'linear-gradient(' + (winnerFromLeft ? '90deg' : '270deg') + ', ' + winnerColor + 'dd 0%, rgba(10,14,22,0.92) 55%)',
            opacity: frame2Visible ? 1 : 0, animation: stage === 'bottom' ? 'cerFrame2 300ms ease-out' : undefined,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            {winnerLogo && <img src={winnerLogo} alt="" style={{ maxHeight: clutchHighlight ? 68 : 92, maxWidth: 150, objectFit: 'contain' }} />}
            <p style={{ fontSize: 24, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 2, margin: 0 }}>{winnerName}</p>
            {clutchHighlight ? (
              // Clutch card (original-desktop parity): the clutching agent's
              // portrait + K/D/A in place of the attacker/defender line.
              (() => {
                const meta = resolveAgent({ agent: clutchHighlight.agent, agentName: clutchHighlight.agent })
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
                    {meta?.portrait && (
                      <img src={meta.portrait} alt="" style={{ height: 58, objectFit: 'contain', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.65))' }} />
                    )}
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: 13, fontWeight: 800, color: '#FFD166', textTransform: 'uppercase', letterSpacing: 2, margin: 0 }}>K / D / A</p>
                      <p style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: 1, margin: 0 }}>
                        {clutchHighlight.kills ?? 0} / {clutchHighlight.deaths ?? 0} / {clutchHighlight.assists ?? 0}
                      </p>
                    </div>
                  </div>
                )
              })()
            ) : winSide ? (
              <p style={{ fontSize: 18, fontWeight: 800, color: '#FFD166', textTransform: 'uppercase', letterSpacing: 3, margin: 0 }}>{winSide}</p>
            ) : null}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <img alt="" src={tournamentLogo || '/Logo/HU.png'} style={{ maxHeight: 62, objectFit: 'contain' }} onError={e => { const el = e.currentTarget; if (!el.dataset.fb) { el.dataset.fb = '1'; el.src = '/Logo/HU.png' } }} />
            <p style={{ fontSize: 26, fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: 2, margin: 0 }}>ROUND {roundNumber ?? ''}</p>
          </div>
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
  isUsingUltOverride = false,
  onToggleUlt,
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
  isUsingUltOverride?: boolean
  onToggleUlt?: () => void
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
  // Positive health is definitive alive evidence — GEP's alive flag can trail
  // the damage packet and would flip a wounded player into the death state.
  const healthNum = player.health == null ? null : Number(player.health)
  const isAlive = healthNum != null ? healthNum > 0 : player.isAlive !== false
  const health = isAlive ? (healthNum ?? 100) : 0
  const kills = player.kills ?? 0
  const deaths = player.deaths ?? 0
  const assists = player.assists ?? 0
  const credits = player.credits ?? player.money ?? null
  const shieldSrc = isAlive ? getShieldImg(player) : null
  const weaponSrc = getWeaponImg(player.weapon || player.weaponName)
  // Ult points: the desktop publishes ultPoints/ultMax (GEP scoreboard).
  const ultPoints = player.currUltPoints ?? player.ultPoints ?? player.ultimate ?? 0
  const ultMax = player.maxUltPoints ?? player.ultMax ?? player.ultimateMax ?? 0
  const ultReady = ultMax > 0 && ultPoints >= ultMax

  // Ult active / trigger logic
  const [localUltActive, setLocalUltActive] = React.useState(false)
  const isUltActiveFlag = Boolean(
    player?.isUsingUlt ||
    player?.abilityState?.X === 'active' ||
    player?.abilityState?.X === true ||
    player?.abilityState?.ultimate === 'active' ||
    player?.abilityState?.ultimate === true ||
    player?.activeAbility === 'X' ||
    player?.activeAbility === 'ultimate'
  )

  const ultTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const triggerUltAnimation = React.useCallback((durationMs = 6500) => {
    setLocalUltActive(true)
    if (ultTimerRef.current) clearTimeout(ultTimerRef.current)
    ultTimerRef.current = setTimeout(() => {
      setLocalUltActive(false)
      ultTimerRef.current = null
    }, durationMs)
  }, [])

  const prevUltActiveFlag = React.useRef(false)
  React.useEffect(() => {
    if (isUltActiveFlag && !prevUltActiveFlag.current && isAlive) {
      triggerUltAnimation(6500)
    }
    prevUltActiveFlag.current = isUltActiveFlag
    if (!isAlive && localUltActive) {
      if (ultTimerRef.current) clearTimeout(ultTimerRef.current)
      setLocalUltActive(false)
    }
  }, [isUltActiveFlag, isAlive, triggerUltAnimation, localUltActive])

  const isUsingUlt = Boolean(
    isAlive && (
      isUsingUltOverride ||
      localUltActive ||
      isUltActiveFlag
    )
  )

  const [ultStage, setUltStage] = React.useState<'idle' | 'active' | 'exiting'>('idle')
  const prevUsingUlt = React.useRef(isUsingUlt)

  React.useEffect(() => {
    if (isUsingUlt) {
      setUltStage('active')
    } else if (prevUsingUlt.current && !isUsingUlt) {
      setUltStage('exiting')
      const t = setTimeout(() => setUltStage('idle'), 220)
      return () => clearTimeout(t)
    }
    prevUsingUlt.current = isUsingUlt
  }, [isUsingUlt])

  const handleToggleUlt = (e: React.MouseEvent) => {
    e.stopPropagation()
    setLocalUltActive(prev => !prev)
    onToggleUlt?.()
  }

  // === "USING ULT" CARD FOR CLASSIC BROADCAST KIT ===
  if (ultStage === 'active' || ultStage === 'exiting') {
    const headArt = agentBust(player) || agentPortrait(player) || resolveAgent(player)?.portrait || BLANK_IMG
    const isExiting = ultStage === 'exiting'
    const hasSpike = Boolean(player?.hasSpike)
    return (
      <div className={`w-full ${isRight ? 'team-stats-val-classic-flip' : 'team-stats-val-classic'}`}>
        <div className={`flex w-full transition-all ease-in-out ${isRight ? 'justify-end' : 'justify-start'} max-h-75 opacity-100 mb-2`}>
          <div
            className="relative h-15.25 w-full cursor-pointer select-none overflow-hidden rounded-[3px] border-2 border-[#FACC15] bg-[#0A0D12] shadow-[0_0_18px_rgba(250,204,21,0.85),inset_0_0_10px_rgba(250,204,21,0.35)]"
            style={{
              animation: isExiting ? 'ultExit 220ms ease-in forwards' : 'ultEnter 260ms cubic-bezier(0.16,1,0.3,1) forwards, ultGlowPulse 1.8s ease-in-out infinite',
            }}
            onClick={handleToggleUlt}
            title="Using Ult (Click to toggle)"
          >
            {/* Spike carrier badge */}
            {hasSpike && (
              <div
                className={`absolute top-[4px] z-30 grid size-[22px] place-items-center rounded-full bg-white shadow-lg ${isRight ? 'right-2' : 'left-2'}`}
              >
                <img src="/game/val/misc/Spike_Icon.svg" alt="spike" className="size-[12px] object-contain" />
              </div>
            )}
            {/* Spectated eye badge */}
            {isObserved && (
              <div
                className={`absolute bottom-1 z-30 grid size-[18px] place-items-center rounded-full border border-white/40 bg-black/85 ${isRight ? 'right-2' : 'left-2'}`}
              >
                <div style={{ transform: 'scale(0.8)' }}>
                  <svg fill="none" height="9" viewBox="0 0 10 8" width="11">
                    <path d="M9.97125 3.42679C9.95667 3.39152 9.60375 2.55268 8.81917 1.71205C7.77375 0.591964 6.45333 0 5 0C3.54667 0 2.22625 0.591964 1.18083 1.71205C0.396246 2.55268 0.0416627 3.39286 0.028746 3.42679C0.00979317 3.47246 0 3.52189 0 3.57187C0 3.62186 0.00979317 3.67129 0.028746 3.71696C0.0433294 3.75223 0.396246 4.59063 1.18083 5.43125C2.22625 6.55089 3.54667 7.14286 5 7.14286C6.45333 7.14286 7.77375 6.55089 8.81917 5.43125C9.60375 4.59063 9.95667 3.75223 9.97125 3.71696C9.99021 3.67129 10 3.62186 10 3.57187C10 3.52189 9.99021 3.47246 9.97125 3.42679ZM5 5.35714C4.67036 5.35714 4.34813 5.25241 4.07405 5.0562C3.79997 4.85998 3.58635 4.58109 3.4602 4.25479C3.33405 3.9285 3.30105 3.56945 3.36536 3.22305C3.42967 2.87666 3.5884 2.55847 3.82149 2.30874C4.05458 2.059 4.35155 1.88893 4.67485 1.82003C4.99815 1.75112 5.33326 1.78649 5.63781 1.92164C5.94235 2.0568 6.20265 2.28568 6.38578 2.57934C6.56892 2.873 6.66667 3.21825 6.66667 3.57143C6.66667 4.04503 6.49107 4.49923 6.17851 4.83412C5.86595 5.16901 5.44203 5.35714 5 5.35714Z" fill="white" />
                  </svg>
                </div>
              </div>
            )}

            {/* Team color block with diagonal slant */}
            <div
              className="absolute inset-y-0 z-10 flex items-center overflow-hidden"
              style={{
                [isRight ? 'right' : 'left']: 0,
                width: '100%',
                background: teamColor,
                clipPath: isRight
                  ? 'polygon(25% 0%, 100% 0%, 100% 100%, 52% 100%)'
                  : 'polygon(0% 0%, 75% 0%, 48% 100%, 0% 100%)',
                animation: isExiting
                  ? (isRight ? 'v1UltSlideOutRight 200ms ease-in forwards' : 'v1UltSlideOutLeft 200ms ease-in forwards')
                  : (isRight ? 'v1UltSlideInRight 280ms cubic-bezier(0.16,1,0.3,1) forwards' : 'v1UltSlideInLeft 280ms cubic-bezier(0.16,1,0.3,1) forwards'),
              }}
            >
              {/* Metallic gradient overlay */}
              <div
                className="absolute inset-0 opacity-20"
                style={{
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(0,0,0,0.6) 100%)',
                }}
              />

              {/* Large White Ult Icon */}
              <div
                className="relative z-10 flex items-center justify-center"
                style={{
                  [isRight ? 'marginRight' : 'marginLeft']: '24px',
                  width: '56px',
                }}
              >
                <img
                  src={`/game/val/agents/${codename}/abilities/ultimate.png`}
                  alt="ult"
                  className="size-[44px] object-contain brightness-0 invert drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)]"
                  style={{
                    animation: isExiting
                      ? undefined
                      : 'v1UltIconReveal 300ms cubic-bezier(0.16,1,0.3,1) 160ms both, ultIconPulse 1.8s ease-in-out 460ms infinite',
                  }}
                  onError={e => {
                    ;(e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
                  }}
                />
              </div>
            </div>

            {/* Agent Bust Portrait Crop */}
            <div
              className="absolute inset-y-0 z-0 overflow-hidden"
              style={{
                [isRight ? 'left' : 'right']: 0,
                width: '60%',
                animation: isExiting
                  ? undefined
                  : (isRight ? 'v1UltBustRevealRight 300ms ease-out 260ms both' : 'v1UltBustRevealLeft 300ms ease-out 260ms both'),
              }}
            >
              <img
                src={headArt}
                alt=""
                className="absolute top-[-10px] h-[220px] w-auto max-w-none object-contain"
                style={{
                  [isRight ? 'left' : 'right']: '-15px',
                  transform: isRight ? 'scaleX(-1)' : undefined,
                }}
                onError={e => {
                  ;(e.currentTarget as HTMLImageElement).src = agentIcon
                }}
              />
            </div>
          </div>
        </div>
      </div>
    )
  }

  const hiddenX = !isRight ? 'translateX(-100%)' : 'translateX(100%)'
  const eyeContainerStyle: React.CSSProperties = {
    opacity: isObserved ? '0.9' : '0',
    transform: isObserved ? 'translateX(0px)' : hiddenX,
    transitionDuration: '0.3s',
  }

  // Authoritative ability state → icon opacity: owned/charged = lit, spent =
  // grey, NO telemetry = dim-unknown (never faked). Numbers coerced (GEP 0/1).
  const abilityOpacity = (p: any, key: string): number => {
    const st = p?.abilityState
    if (!st) return 0.35
    const v = st[key]
    return (v === true || v === 1 || v === '1') ? 1 : (v === false || v === 0 || v === '0') ? 0.3 : 0.35
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
                  // Team-colored fill (VS parity): the bar belongs to the team,
                  // not to generic HP tiers.
                  backgroundColor: isAlive ? teamColor : 'rgba(0, 0, 0, 0.41)',
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

            {/* Ability row — ICONS ONLY (no C/Q/E/X letters). C/Q/E/X map to
                grenade/ability1/ability2/ultimate. State is authoritative
                (abilityState charges for the observed player); players without
                telemetry render dim-unknown — never faked. */}
            <div className={`flex h-[17px] w-full shrink-0 items-center justify-center gap-2.5 px-2 ${isRight ? 'flex-row-reverse' : ''}`}>
              {([['grenade', 'C'], ['ability1', 'Q'], ['ability2', 'E']] as const).map(([slot, key]) => (
                <img
                  key={slot}
                  src={`/game/val/agents/${codename}/abilities/${slot}.png`}
                  alt=""
                  className="size-[13px] object-contain"
                  style={{ opacity: abilityOpacity(player, key) }}
                  onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden' }}
                />
              ))}
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
                    {/* (Raw ult points badge removed — VS parity shows the
                        icon + dash-progress ring only, gold when ready.) */}
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

          {/* Spike carrier slot - small spike glyph on the row carrying the
              spike (GEP hasSpike), next to the spectator eye slot. */}
          {Boolean(player.hasSpike || (player as any).carryingSpike || (player as any).hasBomb || (player as any).isCarrier || (player as any).spike) && (
            <div
              className={`h-full overflow-hidden ${isRight ? 'rounded-l-md' : 'rounded-r-md'}`}
              style={{ width: 18 }}
            >
              <div className="flex size-full items-center justify-center bg-[#00000073]">
                <img src="/game/val/misc/Spike_Icon.svg" alt="spike" className="h-[11px] w-[11px] object-contain" />
              </div>
            </div>
          )}
          {/* Spectator Eye Slot — VS parity: only the spectated row extends
              (slot goes 0 -> 24px), all other cards stay the same length. */}
          <div
            className={`h-full overflow-hidden transition-all duration-300 ${isRight ? 'rounded-l-md' : 'rounded-r-md'}`}
            style={{ width: isObserved ? 24 : 0 }}
          >
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
    sponsorImageUrl = null,
    tournamentLogo = null,
    ceremonyText = null,
    ceremonyTrigger = null,
    ceremonyWinner = null,
    leftTeamName: leftTeamNameProp,
    rightTeamName: rightTeamNameProp,
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
    eventsHighlight,
    gameEventsIndividual = false,
    gameEventsUploads,
    ceremonyPersistent = false,
  } = props

  // ===== Endround banner names (ValoSpectra endround-banner parity) =====
  const bannerLeftName = (leftTeamNameProp || leftTeamName || '').toUpperCase()
  const bannerRightName = (rightTeamNameProp || rightTeamName || '').toUpperCase()
  // Round-win banner text comes from the SETTLED round reason — never from the
  // ceremony gameEvent (which shows MATCH END / tech pauses and pollutes it).
  const roundEndReasonText =
    roundEnd?.reason === 'detonation' ? 'SPIKE DETONATED'
    : roundEnd?.reason === 'defusion' ? 'SPIKE DEFUSED'
    : roundEnd?.winner || roundEnd?.reason ? 'ROUND WIN'
    : null

  // Game-events popover: resolve the uploaded image for the ceremony reason
  // (Individual Uploads → per-reason slot; otherwise the Round Win upload).
  const ceremonyReasonText = (ceremonyText || roundEndReasonText || '').trim().toUpperCase()
  const GE_REASON_FIELDS: Record<string, string> = {
    'ROUND WIN': 'game-events-bg-round-winner',
    'ACE': 'game-events-bg-ace',
    'CLUTCH': 'game-events-bg-clutch',
    'FLAWLESS': 'game-events-bg-flawless',
    'TEAM ACE': 'game-events-bg-team-ace',
    'THRIFTY': 'game-events-bg-thrifty',
  }
  const ceremonyEventImage =
    (gameEventsIndividual && ceremonyReasonText && GE_REASON_FIELDS[ceremonyReasonText]
      ? (gameEventsUploads?.[GE_REASON_FIELDS[ceremonyReasonText]] ?? null)
      : null)
    || gameEventsUploads?.['game-events-bg-round-winner']
    || null
  // The RoundCeremony banner IS the game-events component — the legacy ACE
  // card must never render alongside it (that was the duplicate the user saw).
  const isCeremonyActive = !!(ceremonyTrigger || roundEnd?.winner)

  const hasLiveMatch = (leftTeamPlayers && leftTeamPlayers.length > 0) || (rightTeamPlayers && rightTeamPlayers.length > 0)
  const leftRoster = leftTeamPlayers && leftTeamPlayers.length > 0 ? leftTeamPlayers : (hasLiveMatch || liveOnly ? [] : DEMO_LEFT)
  const rightRoster = rightTeamPlayers && rightTeamPlayers.length > 0 ? rightTeamPlayers : (hasLiveMatch || liveOnly ? [] : DEMO_RIGHT)

  const [toggledUlts, setToggledUlts] = React.useState<Record<string, boolean>>({})
  const handleToggleUlt = (pKey: string) => {
    setToggledUlts(prev => ({ ...prev, [pKey]: !prev[pKey] }))
  }

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

  const isRoundOver = Boolean(
    roundEnd != null ||
    (roundEndReasonText && roundEndReasonText.length > 0)
  )
  const isSpikeDetonatedOrDefused = Boolean(
    spikeState === 'detonated' ||
    spikeState === 'defused' ||
    roundEnd?.reason === 'detonation' ||
    roundEnd?.reason === 'defusion' ||
    (typeof spikeState === 'string' && (spikeState.toLowerCase().includes('detonat') || spikeState.toLowerCase().includes('explod') || spikeState.toLowerCase().includes('defus')))
  )
  const isSpikeActive = Boolean(
    !isRoundOver &&
    !isSpikeDetonatedOrDefused &&
    (spikeState === 'planted' ||
      spikeState === 'defusing' ||
      (typeof spikeState === 'string' && (spikeState.toLowerCase().includes('plant') || spikeState.toLowerCase().includes('defus'))))
  )
  const spikeBlinkOn = useSpikeBlink(spikeState === 'planted' && isSpikeActive)
  // Spike 45s detonation countdown (VS spike-planted parity): while planted,
  // the timer slot shows the ticking spike clock instead of the round clock.
  const [spikeNow, setSpikeNow] = React.useState(Date.now())
  React.useEffect(() => {
    if (!isSpikeActive || spikeState !== 'planted' || !spikePlantedAt) return
    setSpikeNow(Date.now())
    const t = setInterval(() => setSpikeNow(Date.now()), 200)
    return () => clearInterval(t)
  }, [isSpikeActive, spikeState, spikePlantedAt])
  const spikeRemainingSec = (() => {
    if (!isSpikeActive || spikeState !== 'planted' || !spikePlantedAt) return null
    return Math.max(0, 45 - Math.floor((spikeNow - Number(spikePlantedAt)) / 1000))
  })()
  // Endround: keep the plain clock in the timer slot (the banner tells the
  // story — no ELIMINATED/SPIKE DETONATED words crowding the scoreline).
  const displayTimerText = isRoundOver
    ? (roundEndReasonText || '0:00')
    : isSpikeDetonatedOrDefused
      ? (spikeState === 'defused' ? 'DEFUSED' : 'DETONATED')
      : isSpikeActive
        ? (spikeState === 'defusing'
            ? 'DEFUSING'
            : spikeRemainingSec != null
              ? `${Math.floor(spikeRemainingSec / 60)}:${String(spikeRemainingSec % 60).padStart(2, '0')}`
              : (spikeSite ? `SITE ${spikeSite}` : 'SPIKE'))
        : timerText
  const displayTimerColor = isSpikeActive || isSpikeDetonatedOrDefused ? '#FF3549' : timerColor

  const showScoreLine = isToggled('score-line')
  const showTeamStats = isToggled('team-stats') || isToggled('alive')
  const showMapHistory = isToggled('map-history')
  const showGameEvents = isToggled('game-events')
  const showSponsors = isToggled('sponsors')
  const showWebcam = isToggled('webcam')

  // Facecam identity (BLOB parity): the footer name + K/D/A and the fallback
  // art (team logo → agent portrait) always describe ONE player. GEP exposes
  // no spectated-target fact (the original used screen reading for it), so the
  // chain is: observed → Camera-Feed player → local/viewer player. With the
  // webcam live the camera player leads so name/stats match the video.
  const facecamIdentity = (() => {
    const sides = [
      { rows: leftTeamPlayers || [], side: 'left' as const },
      { rows: rightTeamPlayers || [], side: 'right' as const },
    ]
    const norm = (v: unknown) => String(v ?? '').toLowerCase().split('#')[0].trim()
    const keys = (
      webcamActive
        ? [webcamPlayerName, currentlyObserving]
        : [currentlyObserving, webcamPlayerName, localPlayerName]
    ).filter((k): k is string => !!k && k !== 'No camera' && k.trim() !== '')
    for (const k of keys) {
      for (const { rows, side } of sides) {
        const row = rows.find(
          (r) =>
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
    const base = String(raw || '').split('#')[0].trim()
    return base || null
  })()
  const facecamFallbackLogo =
    facecamIdentity?.row && facecamIdentity.side
      ? facecamIdentity.side === 'left'
        ? leftTeamLogo
        : rightTeamLogo
      : null
  const facecamFallbackPortrait = resolveAgent(facecamIdentity?.row)?.portrait ?? null

  // Webcam auto-hide: only show if stream/photo/identity is known, unless editor
  const shouldRenderWebcam =
    showWebcam && (!liveOnly || (webcamActive && (webcamStream || webcamPlayerPhoto)) || !!facecamName)

  // Facecam K/D/A: prefer the explicit prop (live overlay passes snapshot
  // stats by id); otherwise use the identity row — else look the facecam
  // player up in the scene rosters by alias (editor + LiveGame state players).
  const webcamStats = webcamPlayerStats ?? (facecamIdentity?.row
    ? {
        kills: facecamIdentity.row.kills ?? 0,
        deaths: facecamIdentity.row.deaths ?? 0,
        assists: facecamIdentity.row.assists ?? 0,
      }
    : (() => {
        if (!webcamPlayerName || !webcamActive) return null
        const all: any[] = [...(leftTeamPlayers || []), ...(rightTeamPlayers || [])]
        const p = all.find(r => r && (r.alias === webcamPlayerName || r.name === webcamPlayerName))
        return p ? { kills: p.kills ?? 0, deaths: p.deaths ?? 0, assists: p.assists ?? 0 } : null
      })())

  // Scoreline Team B guard: don't show phantom Team B when testing solo
  const hasRightTeam = !liveOnly ? true : (rightRoster.length > 0 || (scoreRight ?? 0) > 0 || (seriesScoreRight ?? 0) > 0 || (!!rightTeamName && rightTeamName.trim() !== '' && rightTeamName !== 'Right Team' && rightTeamName !== 'Team B'))

  const webcamVideoRef = React.useRef<HTMLVideoElement | null>(null)
  React.useEffect(() => {
    if (webcamVideoRef.current && webcamStream) {
      webcamVideoRef.current.srcObject = webcamStream
      webcamVideoRef.current.play?.().catch(() => {})
    }
  }, [webcamStream])

  return (
    <div
      className="scene-root relative size-full min-h-full bg-[#1B1D1F] overflow-hidden select-none font-schabo text-[#DADBE3]"
      style={{
        width: 1920,
        height: 1080,
        '--left-team-color': leftTeamColor,
        '--right-team-color': rightTeamColor,
        '--main-left-color-change': leftTeamColor,
        '--main-right-color-change': rightTeamColor,
      } as React.CSSProperties}
    >
      <style>{CLASSIC_ULT_CSS}</style>
      {/* ===== ENDROUND BANNER (ValoSpectra endround-banner parity) ===== */}
      {/* ===== ROUND CEREMONY (frame 1 centered → slides to bottom center → frame 2) ===== */}
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
        accentColor={eventsHighlight}
        eventImage={ceremonyEventImage}
        persistent={ceremonyPersistent}
        activeComponentId={activeComponentId}
        onSelectComponent={onSelectComponent}
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
                      <div className={scoreLineSmall ? 'flex h-full w-[100px] shrink-0 items-center justify-center tabular-nums' : ''}>
                      <h1 className="translate-y-1 flex items-center gap-2 text-[40px]" style={{ color: displayTimerColor }}>
                        {isSpikeActive && spikeState === 'planted' ? (
                          // Planted: pulsing red spike icon ONLY — no 45s countdown
                          // (operator request, live 2026-10-18). Blink rate still
                          // accelerates as detonation approaches.
                          <img
                            src="/game/val/misc/Spike_Icon.svg"
                            alt="spike"
                            className="h-[36px] w-auto object-contain"
                            style={{ filter: 'drop-shadow(0 0 8px #FF3549)', opacity: spikeBlinkOn ? 1 : 0.25, transition: 'opacity 120ms linear' }}
                          />
                        ) : (
                          <>
                            {spikeState === 'defusing' && (
                              <img src="/game/val/misc/Spike_Icon.svg" alt="" className="h-[30px] w-auto object-contain" />
                            )}
                            {displayTimerText}
                          </>
                        )}
                      </h1>
                      </div>
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

            {/* Bottom watermarked info bar — original layout: side cells are
                calc(58% - 120px), the round text is a centered 120px slot. In
                the SMALL variant the side cells carry the team names (that is
                where the original puts them; the team blocks go blank). */}
            <div
              className="relative flex h-full w-full items-center justify-between rounded-[3.37px] bg-[#000000AA] text-[22px] whitespace-nowrap uppercase"
              style={{ height: (19 * (scoreLineSize > 1 ? 1 + scoreLineSize * 0.1 : 1)).toFixed(1) + 'px' }}
            >
              <div
                className={`font-semibold flex h-full min-w-0 items-center px-1 font-mussels ${scoreLineSmall ? 'justify-start' : 'justify-center'}`}
                style={{ width: 'calc(58% - 120px)' }}
              >
                {scoreLineSmall ? (
                  <span className="truncate text-[14px]">{leftTeamName || 'TEAM A'}</span>
                ) : (
                  [seriesTitleText, gameSeriesText].filter(Boolean).map((t, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && <span className="text-white/40">|</span>}
                      <span className="truncate">{t}</span>
                    </React.Fragment>
                  ))
                )}
              </div>
              <div className="absolute left-1/2 top-0 h-full -translate-x-1/2" style={{ width: 120 }}>
                <AutoScalerText
                  text={roundText}
                  fontSize={20}
                  h1ClassName="font-insatiable leading-none"
                  minScale={0.5}
                />
              </div>
              <div
                className={`font-semibold flex h-full min-w-0 items-center px-1 font-mussels ${scoreLineSmall ? 'justify-end' : 'justify-center'}`}
                style={{ width: 'calc(58% - 120px)' }}
              >
                {scoreLineSmall ? (
                  <span className="truncate text-[14px]">{rightTeamName || 'TEAM B'}</span>
                ) : (
                  [eventTitleText, watermarkText].filter(Boolean).map((t, i) => (
                    <React.Fragment key={i}>
                      {i > 0 && <span className="text-white/40">|</span>}
                      <span className="truncate">{t}</span>
                    </React.Fragment>
                  ))
                )}
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
                onError={e => { const el = e.currentTarget; if (!el.dataset.fb) { el.dataset.fb = '1'; el.src = '/sponsor/Sponsor-1.png' } }}
                src={tournamentLogo || sponsorImageUrl || '/sponsor/Sponsor-1.png'}
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
              {leftRoster.map((player, idx) => {
                const pKey = String(player.id || player.name || player.alias || `left-${idx}`)
                return (
                  <IngamePlayerCard
                    key={pKey}
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
                    isUsingUltOverride={Boolean(toggledUlts[pKey])}
                    onToggleUlt={() => handleToggleUlt(pKey)}
                  />
                )
              })}
            </div>

            {/* Right Team Roster Column (Hidden when empty in solo testing) */}
            {rightRoster.length > 0 && (
              <div className="w-67.5 duration-700 origin-bottom-right flex flex-col justify-end">
                {rightRoster.map((player, idx) => {
                  const pKey = String(player.id || player.name || player.alias || `right-${idx}`)
                  return (
                    <IngamePlayerCard
                      key={pKey}
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
                      isUsingUltOverride={Boolean(toggledUlts[pKey])}
                      onToggleUlt={() => handleToggleUlt(pKey)}
                    />
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Ceremony Banner / Game Event (Spike Defused/Detonated, pauses, etc.)
          — round-end ceremonies live in RoundCeremony; spike outcomes are
          suppressed here so the same event never renders twice. */}
      {(showGameEvents || liveOnly) && gameEvent && !isCeremonyActive && !(roundEnd && (roundEnd.reason === 'detonation' || roundEnd.reason === 'defusion')) && (
        <div
          className={`clickable-component absolute top-48 z-40 overflow-hidden flex flex-col items-center justify-center px-12 py-4 rounded-md border border-white/20 shadow-2xl${
            activeComponentId === 'game-events' ? ' selected' : ''
          }`}
          style={{ left: '50%', transform: 'translateX(-50%)', background: eventsBg || 'rgba(0,0,0,0.9)' }}
          data-component-id="game-events"
          onClick={(e) => {
            e.stopPropagation()
            onSelectComponent?.('game-events')
          }}
        >
          {/* Opacity-only enter animation — a transform-based animation would
              override the translateX(-50%) centering above. */}
          <style>{`@keyframes geIn { from { opacity: 0; } to { opacity: 1; } } .ge-in { animation: geIn 300ms ease-out; }`}</style>
          {eventsBg && <div className="ge-in absolute inset-0 pointer-events-none" style={{ background: 'rgba(0,0,0,0.45)' }} />}
          <img alt="" src="/sponsor/Game Event.png" className="ge-in relative z-1 object-contain" style={{ maxHeight: 56, marginBottom: 4 }} onError={e => { e.currentTarget.style.visibility = 'hidden' }} />
          <h1 className="ge-in relative z-1 font-schabo text-[64px] text-white uppercase drop-shadow-lg tracking-wider leading-none">
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
            ) : facecamFallbackLogo ? (
              // No camera → the player's TEAM logo on a quiet dark stage.
              <img
                src={facecamFallbackLogo}
                alt=""
                className="size-full object-contain p-5"
                style={{ background: 'radial-gradient(circle at 50% 35%, rgba(255,255,255,0.07), transparent 72%)' }}
              />
            ) : facecamFallbackPortrait ? (
              // … no logo → the player's AGENT portrait.
              <img src={facecamFallbackPortrait} alt="" className="size-full object-contain p-2" />
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
            <span className="font-baijam text-xs font-bold text-white uppercase">{facecamName || 'No camera'}</span>
            {/* BLOB parity: facecam footer carries the player's K/D/A; no LIVE pill */}
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

export default IngameHudScene
