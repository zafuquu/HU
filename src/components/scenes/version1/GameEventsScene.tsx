import { useEffect, useRef, useState } from 'react'

/**
 * GameEventsScene — Version 1 VCT-style animated game event & round-win ceremony.
 * Implements the exact tournament banner design from new gameevent.png:
 * - Top trapezoid crown tab with VCT Spark / tournament logo and shoulder arrow accents (◀ ▶)
 * - Chamfered-corner metallic banner body with bold event text (ROUND WIN, ACE, CLUTCH, etc.)
 * - Bottom sub-bar with side role (DEF/ATK), team icon, and winner name.
 */

export type GameEventResult =
  | 'round_won'
  | 'round_lost'
  | 'ace'
  | 'clutch'
  | 'flawless'
  | 'team_ace'
  | 'thrifty'
  | null

const VCT_SPARK_SVG = (
  <svg viewBox="0 0 100 100" fill="currentColor" className="size-[32px]">
    {/* VCT Spark Upper Chevron */}
    <path d="M18 16 L50 48 L82 16 L68 16 L50 34 L32 16 Z" />
    {/* VCT Spark Lower Inverted Chevron */}
    <path d="M18 84 L50 52 L82 84 L68 84 L50 66 L32 84 Z" />
  </svg>
)

const OMEGA_SVG = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5">
    <path d="M12 2C6.48 2 2 6.48 2 12c0 4.14 2.53 7.69 6.13 9.17l1.1-2.01C6.44 18.06 4.5 15.28 4.5 12c0-4.14 3.36-7.5 7.5-7.5s7.5 3.36 7.5 7.5c0 3.28-1.94 6.06-4.73 7.16l1.1 2.01C19.47 19.69 22 16.14 22 12c0-5.52-4.48-10-10-10zm-1 15h2v3h-2v-3z" />
  </svg>
)

const CEREMONY_CSS = `
/* Staged animation sequence:
   1. Tournament Logo 1st (0ms)
   2. Box / Container 2nd (180ms)
   3. Color fill 3rd (360ms)
   4. Round #, Round Win & DEF team name 4th (520ms) */
@keyframes v1LogoIn {
  0% { transform: translateY(-20px) scale(0.65); opacity: 0; }
  60% { transform: translateY(2px) scale(1.12); opacity: 1; }
  100% { transform: translateY(0) scale(1); opacity: 1; }
}

@keyframes v1BoxIn {
  0% { transform: scaleX(0.25) scaleY(0.7); opacity: 0; }
  60% { transform: scaleX(1.03) scaleY(1.02); opacity: 1; }
  100% { transform: scaleX(1) scaleY(1); opacity: 1; }
}

@keyframes v1ColorIn {
  0% { opacity: 0; filter: brightness(1.7); }
  100% { opacity: 1; filter: brightness(1); }
}

@keyframes v1ContentIn {
  0% { opacity: 0; transform: translateY(10px) scale(0.95); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes v1CeremonyExit {
  0% { transform: translate(-50%, 0) scale(1); opacity: 1; }
  100% { transform: translate(-50%, -24px) scale(0.92); opacity: 0; }
}
`

export interface Version1RoundCeremonyProps {
  trigger?: string | null
  reasonText?: string | null
  roundNumber?: number | null
  winSide?: 'attack' | 'defense' | string | null
  winnerName?: string
  winnerLogo?: string | null
  winnerColor?: string
  winnerFromLeft?: boolean
  leftColor?: string
  rightColor?: string
  gameEventLogo?: string | null
  tournamentLogo?: string | null
  clutchHighlight?: any
  baseColor?: string | null
  accentColor?: string | null
  eventImage?: string | null
  persistent?: boolean
  activeComponentId?: string | null
  onSelectComponent?: (id: string) => void
  onComplete?: () => void
}

/**
 * Dedicated Version 1 Round Ceremony component matching new gameevent.png.
 */
export function Version1RoundCeremony({
  trigger,
  reasonText = 'ROUND WIN',
  roundNumber,
  winSide,
  winnerName = 'HAVOC UNLEASH',
  winnerLogo,
  winnerColor = '#28D091',
  tournamentLogo,
  eventImage,
  persistent = false,
  activeComponentId,
  onSelectComponent,
  onComplete,
}: Version1RoundCeremonyProps) {
  const [stage, setStage] = useState<'hidden' | 'active' | 'out'>('hidden')
  const seenTrigger = useRef<string | null>(null)

  useEffect(() => {
    if (!trigger) {
      if (persistent) {
        setStage('active')
      } else {
        setStage('hidden')
      }
      return
    }
    if (trigger === seenTrigger.current && !persistent) return
    seenTrigger.current = trigger
    setStage('active')

    if (persistent) return

    const t1 = setTimeout(() => setStage('out'), 4400)
    const t2 = setTimeout(() => {
      setStage('hidden')
      onComplete?.()
    }, 4850)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [trigger, persistent, onComplete])

  if (stage === 'hidden') return null

  // Determine Side: DEF or ATK
  const sideRaw = String(winSide || '').toLowerCase()
  const sideLabel = sideRaw.includes('def') ? 'DEF' : sideRaw.includes('atk') || sideRaw.includes('att') ? 'ATK' : 'DEF'

  // Clean event title text
  const cleanTitle = (reasonText || 'ROUND WIN').trim().toUpperCase()

  const isExiting = stage === 'out'

  return (
    <div className="pointer-events-none absolute inset-0 z-50 select-none font-schabo">
      <style>{CEREMONY_CSS}</style>
      <div
        className={`clickable-component pointer-events-auto absolute left-1/2 flex flex-col items-center cursor-pointer ${
          isExiting ? 'animate-[v1CeremonyExit_420ms_cubic-bezier(0.4,0,0.2,1)_forwards]' : ''
        } ${activeComponentId === 'game-events' ? 'ring-2 ring-white/60 rounded-md' : ''}`}
        style={{
          top: 170,
          width: 660,
          transform: 'translateX(-50%)',
        }}
        data-component-id="game-events"
        onClick={e => {
          e.stopPropagation()
          onSelectComponent?.('game-events')
        }}
      >
        {/* Stage 1: Tournament Logo protruding above the game event container (new gameevent.png) */}
        <div
          className="relative z-20 -mb-4 flex flex-col items-center"
          style={{
            animation: !isExiting ? 'v1LogoIn 420ms cubic-bezier(0.16, 1, 0.3, 1) 0ms both' : undefined,
          }}
        >
          {/* Logo element positioned above */}
          <div className="flex size-[44px] items-center justify-center text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]">
            {tournamentLogo ? (
              <img src={tournamentLogo} alt="" className="size-[38px] object-contain" />
            ) : (
              VCT_SPARK_SVG
            )}
          </div>
        </div>

        {/* Stage 2: Box / Container structure (Top tab + Chamfered Body) */}
        <div
          className="relative w-full flex flex-col items-center"
          style={{
            animation: !isExiting ? 'v1BoxIn 450ms cubic-bezier(0.16, 1, 0.3, 1) 180ms both' : undefined,
          }}
        >
          {/* Top Trapezoid Tab / Crown underneath the logo */}
          <div className="relative mx-auto flex h-[28px] w-[210px] items-center justify-between px-4">
            <div
              className="absolute inset-0 border-t border-x border-white/20 bg-gradient-to-b from-[#444A40] to-[#252822] shadow-[0_-2px_10px_rgba(0,0,0,0.5)]"
              style={{
                clipPath: 'polygon(15% 0%, 85% 0%, 100% 100%, 0% 100%)',
              }}
            />
            {/* Left shoulder accent arrow */}
            <span className="relative z-10 text-[9px] text-[#A6AAA0] select-none">◀</span>
            <div className="relative z-10 w-8" />
            {/* Right shoulder accent arrow */}
            <span className="relative z-10 text-[9px] text-[#A6AAA0] select-none">▶</span>
          </div>

          {/* Main Chamfered Metallic Banner Body */}
          <div
            className="relative w-full overflow-hidden border border-white/20 bg-[#1A1F18] shadow-[0_16px_40px_rgba(0,0,0,0.75)] backdrop-blur-md"
            style={{
              clipPath: 'polygon(0% 16%, 3.5% 0%, 96.5% 0%, 100% 16%, 100% 84%, 96.5% 100%, 3.5% 100%, 0% 84%)',
            }}
          >
            {/* Stage 3: Color layer (military olive gradient + ambient team color wash) */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                animation: !isExiting ? 'v1ColorIn 400ms ease-out 360ms both' : undefined,
                background: 'linear-gradient(180deg, rgba(52,59,49,0.95) 0%, rgba(35,40,33,0.98) 50%, rgba(24,28,22,0.98) 100%)',
              }}
            >
              {/* Team color subtle ambient glow */}
              <div
                className="absolute inset-0 opacity-25"
                style={{
                  background: `radial-gradient(circle at 50% 35%, ${winnerColor} 0%, transparent 68%)`,
                }}
              />
              {/* Optional custom uploaded game event banner */}
              {eventImage && (
                <img
                  src={eventImage}
                  alt=""
                  className="absolute inset-0 size-full object-cover mix-blend-overlay opacity-30"
                />
              )}
            </div>

            {/* Corner brackets */}
            <div className="pointer-events-none absolute inset-x-4 top-2 flex justify-between text-[11px] text-white/25 font-mono">
              <span>◤</span>
              <span>◥</span>
            </div>

            {/* Stage 4: Content layer (Round #, Round Win title, and DEF / team name sub-bar) */}
            <div
              className="relative w-full"
              style={{
                animation: !isExiting ? 'v1ContentIn 420ms cubic-bezier(0.16, 1, 0.3, 1) 520ms both' : undefined,
              }}
            >
              {/* Main Title: ROUND WIN, CLUTCH, ACE, etc. */}
              <div className="relative flex flex-col items-center justify-center py-4 px-8 text-center">
                {roundNumber != null && (
                  <span className="mb-1 font-baijam text-[10px] font-extrabold uppercase tracking-[0.24em] text-white/50">
                    ROUND {roundNumber}
                  </span>
                )}
                <h1
                  className="font-schabo text-[48px] uppercase tracking-[0.14em] leading-none text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)]"
                  style={{
                    textShadow: `0 0 28px ${winnerColor}55, 0 4px 12px rgba(0,0,0,0.9)`,
                  }}
                >
                  {cleanTitle}
                </h1>
              </div>

              {/* Bottom Sub-Bar: DEF / ATK  |  Team Icon/Badge  |  Team Name */}
              <div className="relative flex h-[32px] items-center justify-center gap-3 border-t border-white/10 bg-[#121511]/95 px-6 font-barlowCond">
                <span className="font-baijam text-[12px] font-extrabold uppercase tracking-[0.18em] text-white/80">
                  {sideLabel}
                </span>

                {/* Team icon / Omega-style badge */}
                {winnerLogo ? (
                  <img src={winnerLogo} alt="" className="size-[17px] object-contain drop-shadow" />
                ) : (
                  <div className="text-yellow-400 drop-shadow">
                    {OMEGA_SVG}
                  </div>
                )}

                <span className="font-schabo text-[17px] uppercase tracking-[0.12em] text-white">
                  {winnerName}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * GameEventsScene top-level adapter for standalone overlay usage.
 */
interface GameEventsSceneProps {
  result: GameEventResult
  teamColor?: string
  teamName?: string
  playerName?: string
  agent?: string
  roundNumber?: number
  displayMs?: number
  onComplete?: () => void
  tournamentLogo?: string | null
  leftTeamLogo?: string | null
  rightTeamLogo?: string | null
  leftTeamColor?: string
  rightTeamColor?: string
  ceremonyWinner?: 'blue' | 'red' | null
}

const RESULT_TITLES: Record<NonNullable<GameEventResult>, string> = {
  round_won: 'ROUND WIN',
  round_lost: 'ROUND LOST',
  ace: 'ACE',
  team_ace: 'TEAM ACE',
  clutch: 'CLUTCH',
  flawless: 'FLAWLESS',
  thrifty: 'THRIFTY',
}

export function GameEventsScene(props: GameEventsSceneProps) {
  const {
    result,
    teamColor = '#28D091',
    teamName = 'TEAM',
    roundNumber,
    onComplete,
    tournamentLogo,
    ceremonyWinner,
    leftTeamLogo,
    rightTeamLogo,
  } = props

  if (!result) return null

  const title = RESULT_TITLES[result] || 'ROUND WIN'
  const logo = (ceremonyWinner === 'blue' ? leftTeamLogo : rightTeamLogo) || tournamentLogo

  return (
    <Version1RoundCeremony
      trigger={result ? `${result}-${Date.now()}` : null}
      reasonText={title}
      roundNumber={roundNumber}
      winnerName={teamName}
      winnerColor={teamColor}
      winnerLogo={logo}
      tournamentLogo={tournamentLogo}
      onComplete={onComplete}
    />
  )
}

export default GameEventsScene