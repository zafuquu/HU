import React from 'react'

/**
 * SpikeIndicator — broadcast overlay component.
 *
 * Shows a pulsing spike planted indicator with a depleting timer bar.
 * Uses CSS animation classes: anim-spike-pulse, anim-spike-timer
 */

export type SpikeState = 'none' | 'planted' | 'defusing' | 'defused' | 'detonated'

interface SpikeIndicatorProps {
  state: SpikeState
  /** Spike timer in seconds (default 45) */
  timerDuration?: number
  /** When the spike was planted (Date.now()) — used to calculate remaining time */
  plantedAt?: number
  /** Position on screen */
  position?: 'top-center' | 'bottom-center'
}

export function SpikeIndicator({
  state,
  timerDuration = 45,
  plantedAt,
  position = 'top-center',
}: SpikeIndicatorProps) {
  const [elapsed, setElapsed] = React.useState(0)

  React.useEffect(() => {
    if (state !== 'planted' && state !== 'defusing') {
      setElapsed(0)
      return
    }
    if (!plantedAt) return

    const interval = setInterval(() => {
      setElapsed((Date.now() - plantedAt) / 1000)
    }, 50)

    return () => clearInterval(interval)
  }, [state, plantedAt])

  if (state === 'none') return null

  const remaining = Math.max(0, timerDuration - elapsed)
  const pct = remaining / timerDuration
  const isUrgent = pct < 0.3

  const positionClasses =
    position === 'top-center'
      ? 'top-20 left-1/2 -translate-x-1/2'
      : 'bottom-32 left-1/2 -translate-x-1/2'

  if (state === 'defused') {
    return (
      <div
        className={`absolute ${positionClasses} z-45 anim-round-result-enter`}
        style={{ pointerEvents: 'none' }}
      >
        <div className="flex items-center gap-2 rounded bg-emerald-900/80 px-4 py-2 border border-emerald-400/30 backdrop-blur-sm">
          <svg className="h-5 w-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="font-insatiable text-2xl font-bold uppercase tracking-wider text-emerald-400">
            DEFUSED
          </span>
        </div>
      </div>
    )
  }

  if (state === 'detonated') {
    return (
      <div
        className={`absolute ${positionClasses} z-45 anim-round-result-enter`}
        style={{ pointerEvents: 'none' }}
      >
        <div className="flex items-center gap-2 rounded bg-red-900/80 px-4 py-2 border border-red-400/30 backdrop-blur-sm">
          <svg className="h-5 w-5 text-red-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L1 21h22L12 2zm0 4l7.53 13H4.47L12 6zm-1 5v4h2v-4h-2zm0 6v2h2v-2h-2z" />
          </svg>
          <span className="font-insatiable text-2xl font-bold uppercase tracking-wider text-red-400">
            DETONATED
          </span>
        </div>
      </div>
    )
  }

  // planted or defusing
  return (
    <div
      className={`absolute ${positionClasses} z-45`}
      style={{ pointerEvents: 'none' }}
    >
      <div
        className={`flex flex-col items-center gap-1.5 rounded-md bg-black/85 px-5 py-2.5 border backdrop-blur-sm shadow-2xl ${
          state === 'defusing'
            ? 'border-blue-400/40'
            : isUrgent
              ? 'border-red-500/50 anim-spike-pulse'
              : 'border-red-400/30'
        }`}
      >
        {/* Status label */}
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${
              state === 'defusing' ? 'bg-blue-400 animate-pulse' : 'bg-red-500'
            }`}
          />
          <span
            className={`font-barlowCond text-xs font-bold uppercase tracking-[0.15em] ${
              state === 'defusing' ? 'text-blue-400' : 'text-red-400'
            }`}
          >
            {state === 'defusing' ? 'DEFUSING' : 'SPIKE PLANTED'}
          </span>
        </div>

        {/* Timer bar */}
        <div className="relative h-1.5 w-48 overflow-hidden rounded-full bg-white/10">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-100 ease-linear"
            style={{
              width: `${pct * 100}%`,
              background: isUrgent
                ? 'linear-gradient(90deg, #ff0000, #ff4444)'
                : state === 'defusing'
                  ? 'linear-gradient(90deg, #3b82f6, #60a5fa)'
                  : 'linear-gradient(90deg, #ff4646, #ff8c00)',
            }}
          />
        </div>

        {/* Timer text */}
        <span
          className={`font-mono text-lg font-bold tabular-nums ${
            isUrgent ? 'text-red-400' : state === 'defusing' ? 'text-blue-400' : 'text-white/80'
          }`}
        >
          {remaining.toFixed(1)}s
        </span>
      </div>
    </div>
  )
}

export default SpikeIndicator
