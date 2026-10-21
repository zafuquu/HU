import { useEffect, useRef, useState } from 'react'

/**
 * GameEventsScene — VCT-style animated round-win ceremony.
 *
 * Plays a center-screen round outcome sequence (ROUND WON / ROUND LOST /
 * ACE / CLUTCH / FLAWLESS / TEAM ACE / THRIFTY) with entrance scale +
 * glow, holds, then exits with a fade-out. Designed to be composited over
 * the ingame HUD during the round-end ceremony (≈6.6s).
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

const RESULT_CONFIG: Record<
  NonNullable<GameEventResult>,
  { label: string; sublabel?: string; glowColor: string; textClass: string }
> = {
  round_won: {
    label: 'ROUND WON',
    glowColor: 'rgba(40, 208, 145, 0.6)',
    textClass: 'text-emerald-400',
  },
  round_lost: {
    label: 'ROUND LOST',
    glowColor: 'rgba(255, 53, 73, 0.6)',
    textClass: 'text-red-400',
  },
  ace: {
    label: 'ACE',
    sublabel: 'PENTAKILL',
    glowColor: 'rgba(255, 215, 0, 0.7)',
    textClass: 'text-yellow-400',
  },
  team_ace: {
    label: 'TEAM ACE',
    sublabel: 'EVERY PLAYER GOT A KILL',
    glowColor: 'rgba(40, 208, 145, 0.6)',
    textClass: 'text-emerald-400',
  },
  clutch: {
    label: 'CLUTCH',
    sublabel: 'AGAINST ALL ODDS',
    glowColor: 'rgba(160, 120, 255, 0.7)',
    textClass: 'text-purple-400',
  },
  flawless: {
    label: 'FLAWLESS',
    sublabel: 'NO DEATHS',
    glowColor: 'rgba(40, 208, 145, 0.7)',
    textClass: 'text-emerald-300',
  },
  thrifty: {
    label: 'THRIFTY',
    sublabel: 'WON ON ECO',
    glowColor: 'rgba(76, 175, 80, 0.6)',
    textClass: 'text-green-400',
  },
}

interface GameEventsSceneProps {
  result: GameEventResult
  teamColor?: string
  teamName?: string
  playerName?: string
  agent?: string
  roundNumber?: number
  displayMs?: number
  onComplete?: () => void
}

export function GameEventsScene({
  result,
  teamColor,
  teamName,
  playerName,
  agent,
  roundNumber,
  displayMs = 3000,
  onComplete,
}: GameEventsSceneProps) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit' | 'hidden'>('hidden')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const config = result ? RESULT_CONFIG[result] : null
  const glowColor = teamColor ? `${teamColor}99` : config?.glowColor ?? 'rgba(255,255,255,0.4)'

  useEffect(() => {
    if (!result) {
      setPhase('hidden')
      return
    }
    setPhase('enter')
    timerRef.current = setTimeout(() => {
      setPhase('exit')
    }, displayMs)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [result, displayMs])

  useEffect(() => {
    if (phase === 'exit') {
      timerRef.current = setTimeout(() => {
        setPhase('hidden')
        onComplete?.()
      }, 500)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [phase, onComplete])

  if (phase === 'hidden' || !result || !config) return null

  return (
    <div className="absolute inset-0 z-50 pointer-events-none">
      {phase === 'enter' || phase === 'hold' ? (
        <div
          className="absolute rounded-full animate-pulse"
          style={{
            '--glow-color': glowColor,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 300,
            height: 300,
            boxShadow: `0 0 60px 20px ${glowColor}`,
            opacity: phase === 'enter' ? 0 : 1,
            transition: 'opacity 400ms ease-out',
          } as React.CSSProperties}
        />
      ) : null}

      <div
        className="absolute top-0 left-0 w-full h-full flex items-center justify-center"
        style={{
          opacity: phase === 'enter' ? 0 : 1,
          transform: phase === 'enter' ? 'scale(0.85)' : 'scale(1)',
          transition: phase === 'exit' ? 'opacity 500ms ease-out, transform 500ms ease-out' : 'opacity 400ms ease-out, transform 400ms ease-out',
        }}
      >
        <div className="flex flex-col items-center gap-3">
          {roundNumber != null && (
            <span
              className="font-baijam text-[12px] font-bold uppercase tracking-[0.3em] text-white/50 px-3 py-1 rounded"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: `1px solid ${glowColor}`,
              }}
            >
              ROUND {roundNumber}
            </span>
          )}

          <h1
            className="font-insatiable text-8xl font-black uppercase tracking-wider drop-shadow-2xl"
            style={{
              color: '#ffffff',
              textShadow: `0 0 40px ${glowColor}, 0 4px 24px rgba(0,0,0,0.8)`,
              letterSpacing: '0.14em',
              lineHeight: 1,
            } as React.CSSProperties}
          >
            {config.label}
          </h1>

          {config.sublabel && (
            <span
              className="font-barlowCond text-[18px] font-semibold uppercase tracking-[0.2em] text-white/70"
              style={{
                textShadow: '0 2px 10px rgba(0,0,0,0.6)',
              }}
            >
              {config.sublabel}
            </span>
          )}

          {teamName && (result === 'round_won' || result === 'round_lost') && (
            <span
              className="font-schabo text-[24px] font-bold tracking-wider text-white/90 mt-1"
              style={{ textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}
            >
              {teamName.toUpperCase()}
            </span>
          )}

          {playerName && (result === 'ace' || result === 'clutch') && (
            <div className="flex flex-col items-center gap-1">
              <span className="font-schabo text-[20px] font-bold text-white">
                {playerName.toUpperCase()}
              </span>
              {agent && (
                <span className="font-baijam text-[13px] font-bold uppercase tracking-wider text-white/60">
                  {agent.toUpperCase()}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default GameEventsScene