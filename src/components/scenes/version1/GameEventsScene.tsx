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
  tournamentLogo?: string | null
  leftTeamLogo?: string | null
  rightTeamLogo?: string | null
  leftTeamColor?: string
  rightTeamColor?: string
  ceremonyWinner?: 'blue' | 'red' | null
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
  tournamentLogo,
  leftTeamLogo,
  rightTeamLogo,
  leftTeamColor,
  rightTeamColor,
  ceremonyWinner,
}: GameEventsSceneProps) {
  const [phase, setPhase] = useState<'stage1' | 'stage2' | 'stage3' | 'hold' | 'exit' | 'hidden'>('hidden')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const config = result ? RESULT_CONFIG[result] : null
  const glowColor = teamColor ? `${teamColor}99` : config?.glowColor ?? 'rgba(255,255,255,0.4)'
  const isRoundWin = result === 'round_won' || result === 'round_lost'

  useEffect(() => {
    if (!result) {
      setPhase('hidden')
      return
    }
    setPhase('stage1')
    timerRef.current = setTimeout(() => setPhase('stage2'), 400)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [result])

  useEffect(() => {
    if (phase === 'stage2') {
      timerRef.current = setTimeout(() => setPhase('stage3'), 400)
    } else if (phase === 'stage3') {
      timerRef.current = setTimeout(() => setPhase('hold'), 400)
    } else if (phase === 'hold') {
      timerRef.current = setTimeout(() => setPhase('exit'), displayMs)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [phase, displayMs])

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

  const showTeamInfo = phase === 'stage3' || phase === 'hold'
  const stageOpacity = phase === 'stage1' ? 0 : 1
  const stageTranslateY = phase === 'stage1' ? -40 : 0
  const stageTransition = 'opacity 400ms ease-out, transform 400ms ease-out'

  return (
    <div className="absolute inset-0 z-50 pointer-events-none">
      {(phase === "stage1" || phase === "stage2" || phase === "stage3" || phase === "hold") && (
        <div className="absolute inset-0 z-0"
          style={{
            background: `linear-gradient(180deg, ${glowColor} 0%, transparent 100%)`,
            opacity: stageOpacity,
            transition: stageTransition,
            transform: `translateY(${stageTranslateY}px)`,
          } as React.CSSProperties}
        />
      )}
      {tournamentLogo && (phase === "stage2" || phase === "stage3" || phase === "hold") && (
        <div className="absolute top-[40px] left-1/2 -translate-x-1/2 z-10 flex items-center"
          style={{
            opacity: stageOpacity,
            transition: stageTransition,
            transform: `translateY(${stageTranslateY}px)`,
          }}>
          <img src={tournamentLogo} alt="tournament" className="size-[80px] object-contain drop-shadow-lg"
            onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden" }} />
        </div>
      )}
      {showTeamInfo && (
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center z-20"
          style={{
            opacity: stageOpacity,
            transition: stageTransition,
            transform: `translateY(${stageTranslateY}px)`,
          }}>
        <div className="flex flex-col items-center gap-3">
          {roundNumber != null && (
            <span className="font-baijam text-[12px] font-bold uppercase tracking-[0.3em] text-white/50 px-3 py-1 rounded"
              style={{ background: "rgba(255,255,255,0.1)", border: `1px solid ${glowColor}` }}>
            ROUND {roundNumber}</span>
          )}
          <h1 className="font-insatiable text-8xl font-black uppercase tracking-wider drop-shadow-2xl"
            style={{ color: "#ffffff", textShadow: `0 0 40px ${glowColor}, 0 4px 24px rgba(0,0,0,0.8)`,
              letterSpacing: "0.14em", lineHeight: 1 } as React.CSSProperties}>
            {config.label}</h1>
          {config.sublabel && (<span className="font-barlowCond text-[18px] font-semibold uppercase tracking-[0.2em] text-white/70"
            style={{ textShadow: "0 2px 10px rgba(0,0,0,0.6)" }}>{config.sublabel}</span>)}
          {isRoundWin && teamName && (<span className="font-schabo text-[24px] font-bold tracking-wider text-white/90 mt-1"
            style={{ textShadow: "0 2px 8px rgba(0,0,0,0.6)" }}>{teamName.toUpperCase()}</span>)}
          {playerName && (result === "ace" || result === "clutch") && (
            <div className="flex flex-col items-center gap-1">
              <span className="font-schabo text-[20px] font-bold text-white">{playerName.toUpperCase()}</span>
              {agent && (<span className="font-baijam text-[13px] font-bold uppercase tracking-wider text-white/60">
                {agent.toUpperCase()}</span>)}
            </div>
          )}
          {isRoundWin && leftTeamLogo && rightTeamLogo && (
            <div className="mt-6 flex items-center gap-8">
              <div className="flex flex-col items-center gap-2">
                <img src={leftTeamLogo} alt="left" className="size-[48px] object-contain drop-shadow-lg"
                  style={{ filter: ceremonyWinner === "blue" ? "drop-shadow(0 0 12px rgba(40,208,145,0.8))" : "opacity:0.6" }}
                  onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden" }} />
                <span className="font-baijam text-[12px] font-bold uppercase text-white/90" style={{ color: leftTeamColor }}>LEFT</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <img src={rightTeamLogo} alt="right" className="size-[48px] object-contain drop-shadow-lg"
                  style={{ filter: ceremonyWinner === "red" ? "drop-shadow(0 0 12px rgba(255,56,73,0.8))" : "opacity:0.6" }}
                  onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden" }} />
                <span className="font-baijam text-[12px] font-bold uppercase text-white/90" style={{ color: rightTeamColor }}>RIGHT</span>
              </div>
            </div>
          )}
        </div>
        </div>
      )}
    </div>
  )
}

export default GameEventsScene