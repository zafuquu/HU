import { useEffect, useRef, useState } from 'react'
import { agentBust, BLANK_IMG } from '../broadcastKit'

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
  clutchHighlight?: { name: string; agent: string | null; clutchSize?: number | null } | null
  baseColor?: string | null
  accentColor?: string | null
  eventImage?: string | null
  persistent?: boolean
  activeComponentId?: string | null
  onSelectComponent?: (id: string) => void
  onComplete?: () => void
}

const globalSeenTriggers = new Set<string>()

/**
 * Dedicated Version 1 Round Ceremony component matching new gameevent.png.
 */
export function Version1RoundCeremony({
  trigger,
  reasonText = 'ROUND WIN',
  roundNumber,
  winSide,
  winnerFromLeft = true,
  winnerName = 'HAVOC UNLEASH',
  winnerLogo,
  winnerColor = '#28D091',
  tournamentLogo,
  clutchHighlight,
  baseColor,
  accentColor,
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
    if ((trigger === seenTrigger.current || globalSeenTriggers.has(trigger)) && !persistent) return
    seenTrigger.current = trigger
    globalSeenTriggers.add(trigger)
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
  const sideLabel =
    sideRaw.includes('atk') || sideRaw.includes('att')
      ? 'ATK'
      : sideRaw.includes('def')
        ? 'DEF'
        : null

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
          {/* Logo element positioned above — falls back to Havoc Unleash logo */}
          <div className="flex size-[44px] items-center justify-center text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]">
            <img
              src={tournamentLogo || '/Logo/HU.png'}
              alt=""
              className="size-[38px] object-contain drop-shadow"
              onError={e => {
                ;(e.currentTarget as HTMLImageElement).src = '/Logo/HU.png'
              }}
            />
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
                background: baseColor ? `linear-gradient(to bottom, ${baseColor}, rgba(0,0,0,0.85))` : undefined,
                borderColor: accentColor || undefined,
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
              backgroundColor: baseColor || '#1A1F18',
              borderColor: accentColor || 'rgba(255,255,255,0.2)',
            }}
          >
            {/* Stage 3: Color layer (military olive gradient or custom baseColor + ambient highlight) */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                animation: !isExiting ? 'v1ColorIn 400ms ease-out 360ms both' : undefined,
                background: baseColor
                  ? `linear-gradient(180deg, ${baseColor}F0 0%, ${baseColor}C0 50%, #0A0D12 100%)`
                  : 'linear-gradient(180deg, rgba(52,59,49,0.95) 0%, rgba(35,40,33,0.98) 50%, rgba(24,28,22,0.98) 100%)',
              }}
            >
              {/* Team color / accent color subtle ambient glow */}
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  background: `radial-gradient(circle at 50% 35%, ${accentColor || winnerColor} 0%, transparent 68%)`,
                }}
              />
              {/* Optional custom uploaded game event banner */}
              {eventImage && (
                <img
                  src={eventImage}
                  alt=""
                  className="absolute inset-0 size-full object-cover mix-blend-overlay opacity-60"
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
              {/* Main event title or winner-side clutch card. */}
              <div className={`relative flex flex-col items-center justify-center px-8 text-center ${clutchHighlight?.clutchSize ? 'min-h-[112px] py-2' : 'py-4'}`}>
                {roundNumber != null && (
                  <span className="mb-1 font-baijam text-[10px] font-extrabold uppercase tracking-[0.24em] text-white/50">
                    ROUND {roundNumber}
                  </span>
                )}
                {clutchHighlight?.clutchSize ? (
                  <div className={`flex items-center gap-2 ${winnerFromLeft ? '-translate-x-10' : 'translate-x-10'}`}>
                    {winnerFromLeft && (
                      <img
                        src={agentBust({ agent: clutchHighlight.agent }) || BLANK_IMG}
                        alt=""
                        className="h-[88px] w-[70px] object-contain object-bottom drop-shadow-[0_0_10px_rgba(0,0,0,0.9)]"
                        onError={e => { e.currentTarget.style.visibility = 'hidden' }}
                      />
                    )}
                    <div className="flex min-w-[105px] flex-col items-center">
                      <span className="font-schabo text-[48px] uppercase leading-[0.9] text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)]" style={{ color: accentColor || '#FFFFFF', textShadow: `0 0 28px ${(accentColor || winnerColor)}55, 0 4px 12px rgba(0,0,0,0.9)` }}>
                        1v{clutchHighlight.clutchSize}
                      </span>
                      <span className="mt-1 max-w-[180px] truncate font-baijam text-[10px] uppercase tracking-[0.12em] text-white/80">
                        {clutchHighlight.name}
                      </span>
                    </div>
                    {!winnerFromLeft && (
                      <img
                        src={agentBust({ agent: clutchHighlight.agent }) || BLANK_IMG}
                        alt=""
                        className="h-[88px] w-[70px] object-contain object-bottom drop-shadow-[0_0_10px_rgba(0,0,0,0.9)]"
                        onError={e => { e.currentTarget.style.visibility = 'hidden' }}
                      />
                    )}
                  </div>
                ) : (
                  <h1
                    className="font-schabo text-[48px] uppercase tracking-[0.14em] leading-none text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)]"
                    style={{
                      color: accentColor || '#FFFFFF',
                      textShadow: `0 0 28px ${(accentColor || winnerColor)}55, 0 4px 12px rgba(0,0,0,0.9)`,
                    }}
                  >
                    {cleanTitle}
                  </h1>
                )}
              </div>

              {/* Bottom Sub-Bar: DEF / ATK  |  Team Icon/Badge  |  Team Name */}
              <div className="relative flex h-[32px] items-center justify-center gap-3 border-t border-white/10 bg-[#121511]/95 px-6 font-barlowCond">
                {sideLabel && <span className="font-baijam text-[12px] font-extrabold uppercase tracking-[0.18em] text-white/80">{sideLabel}</span>}

                {/* Team icon */}
                {winnerLogo ? (
                  <img src={winnerLogo} alt="" className="size-[17px] object-contain drop-shadow" />
                ) : null}

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
  winSide?: string | null
  winnerLogo?: string | null
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
    winSide,
    winnerLogo,
  } = props

  if (!result) return null

  const title = RESULT_TITLES[result] || 'ROUND WIN'
  const resolvedLogo = winnerLogo || (ceremonyWinner === 'red' ? rightTeamLogo : leftTeamLogo) || null

  return (
    <Version1RoundCeremony
      trigger={result ? `${result}-${Date.now()}` : null}
      reasonText={title}
      roundNumber={roundNumber}
      winnerName={teamName}
      winnerColor={teamColor}
      winnerLogo={resolvedLogo}
      tournamentLogo={tournamentLogo}
      winSide={winSide}
      onComplete={onComplete}
    />
  )
}

export default GameEventsScene
