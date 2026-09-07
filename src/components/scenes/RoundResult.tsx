import React from 'react'

/**
 * RoundResult — broadcast overlay component.
 *
 * Shows a center-screen round result announcement (e.g. "ROUND WON", "ROUND LOST",
 * "ACE", "CLUTCH", "FLAWLESS", "TEAM ACE", "THRIFTY") with dramatic scale-up + glow,
 * then auto-exits after a configurable duration.
 *
 * Uses CSS animation classes:
 *   anim-round-result-enter / anim-round-result-exit / anim-round-glow
 */

export type RoundResultType =
  | 'round_won'
  | 'round_lost'
  | 'ace'
  | 'team_ace'
  | 'clutch'
  | 'flawless'
  | 'thrifty'
  | null

interface RoundResultProps {
  result: RoundResultType
  /** The team color to glow */
  teamColor?: string
  /** How long to show (ms). Auto-exit after this. Default 3000. */
  displayDuration?: number
  /** Callback when the exit animation finishes */
  onDismiss?: () => void
  /** Optional round number to display */
  roundNumber?: number
}

const RESULT_CONFIG: Record<
  NonNullable<RoundResultType>,
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

export function RoundResult({
  result,
  teamColor,
  displayDuration = 3000,
  onDismiss,
  roundNumber,
}: RoundResultProps) {
  const [phase, setPhase] = React.useState<'enter' | 'exit' | 'hidden'>('hidden')
  const exitTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    if (result) {
      setPhase('enter')
      exitTimerRef.current = setTimeout(() => {
        setPhase('exit')
        // Wait for exit animation (500ms) then dismiss
        setTimeout(() => {
          setPhase('hidden')
          onDismiss?.()
        }, 500)
      }, displayDuration)
    } else {
      setPhase('hidden')
    }
    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
    }
  }, [result, displayDuration, onDismiss])

  if (phase === 'hidden' || !result) return null

  const config = RESULT_CONFIG[result]
  const glowColor = teamColor
    ? `${teamColor}99` // 60% opacity hex
    : config.glowColor

  return (
    <div
      className="absolute inset-0 z-50"
      style={{ pointerEvents: 'none' }}
    >
      {/* Glow ring behind */}
      {phase === 'enter' && (
        <div
          className="anim-round-glow absolute rounded-full"
          style={{
            '--glow-color': glowColor,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 240,
            height: 240,
          } as React.CSSProperties}
        />
      )}

      {/* Main text container */}
      <div
        className={
          phase === 'enter'
            ? 'anim-round-result-enter'
            : 'anim-round-result-exit'
        }
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
        }}
      >
        <div className="flex flex-col items-center gap-2">
          {/* Round number */}
          {roundNumber != null && (
            <span className="font-baijam text-xs font-bold uppercase tracking-[0.3em] text-white/50">
              ROUND {roundNumber}
            </span>
          )}

          {/* Main label */}
          <h1
            className={`font-insatiable text-6xl font-black uppercase tracking-wider drop-shadow-2xl ${config.textClass}`}
            style={{
              textShadow: `0 0 40px ${glowColor}, 0 4px 16px rgba(0,0,0,0.6)`,
              letterSpacing: '0.12em',
            }}
          >
            {config.label}
          </h1>

          {/* Sub-label */}
          {config.sublabel && (
            <span
              className="font-barlowCond text-sm font-semibold uppercase tracking-[0.2em] text-white/60"
              style={{
                textShadow: '0 2px 8px rgba(0,0,0,0.5)',
              }}
            >
              {config.sublabel}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default RoundResult
