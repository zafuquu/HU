import React, { useState, useRef, useEffect } from 'react'
import { X, Sparkles, RotateCcw, Trophy } from 'lucide-react'
import type { Team } from '../../store/AppContext'

interface CoinTossModalProps {
  isOpen: boolean
  onClose: () => void
  teamA: Team | undefined
  teamB: Team | undefined
  onAssignWinner: (winner: 'TEAM_A' | 'TEAM_B') => void
}

export const CoinTossModal: React.FC<CoinTossModalProps> = ({
  isOpen,
  onClose,
  teamA,
  teamB,
  onAssignWinner,
}) => {
  const [isFlipping, setIsFlipping] = useState(false)
  const [rotationY, setRotationY] = useState(0)
  const [winner, setWinner] = useState<'TEAM_A' | 'TEAM_B' | null>(null)
  const flipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setIsFlipping(false)
      setWinner(null)
      if (flipTimerRef.current) clearTimeout(flipTimerRef.current)
    }
  }, [isOpen])

  if (!isOpen) return null

  const nameA = teamA?.name || 'Team A'
  const nameB = teamB?.name || 'Team B'

  const handleFlip = () => {
    if (isFlipping) return
    setIsFlipping(true)
    setWinner(null)

    // Random winner (50/50 chance)
    const result: 'TEAM_A' | 'TEAM_B' = Math.random() < 0.5 ? 'TEAM_A' : 'TEAM_B'
    
    // Calculate total degrees: at least 6 full spins (2160 deg) + target side
    // Team A is at 0 mod 360, Team B is at 180 mod 360
    const currentBase = Math.floor(rotationY / 360) * 360
    const spins = 6 * 360
    const targetSide = result === 'TEAM_A' ? 0 : 180
    const nextRotation = currentBase + spins + targetSide

    setRotationY(nextRotation)

    if (flipTimerRef.current) clearTimeout(flipTimerRef.current)
    flipTimerRef.current = setTimeout(() => {
      setIsFlipping(false)
      setWinner(result)
    }, 2800)
  }

  const winningTeamName = winner === 'TEAM_A' ? nameA : nameB

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-amber-500/30 bg-[#121316] p-6 shadow-[0_0_50px_rgba(245,158,11,0.2)]">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="size-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-2">
            <Sparkles className="size-3.5" />
            VCT Official Coin Toss
          </div>
          <h2 className="text-lg font-bold text-white">Determine Starting Team</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Heads ({nameA}) vs. Tails ({nameB})
          </p>
        </div>

        {/* 3D Coin Flip Arena */}
        <div className="flex flex-col items-center justify-center py-6" style={{ perspective: '1000px' }}>
          <div
            className="relative size-36 rounded-full cursor-pointer select-none transition-transform"
            style={{
              transformStyle: 'preserve-3d',
              transform: `rotateY(${rotationY}deg)`,
              transition: isFlipping
                ? 'transform 2.8s cubic-bezier(0.15, 0.85, 0.35, 1.0)'
                : 'transform 0.3s ease-out',
            }}
            onClick={!isFlipping ? handleFlip : undefined}
          >
            {/* FRONT FACE (Team A - Heads) */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center rounded-full border-4 border-amber-400 bg-linear-to-br from-amber-600 via-amber-700 to-amber-900 text-white shadow-[0_0_30px_rgba(245,158,11,0.5)] p-3"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
              }}
            >
              <div className="size-14 rounded-full bg-black/40 border border-amber-300/40 flex items-center justify-center overflow-hidden mb-1">
                {teamA?.logoUrl ? (
                  <img src={teamA.logoUrl} alt={nameA} className="size-full object-contain p-1" />
                ) : (
                  <span className="font-schabo text-2xl text-amber-200">{nameA.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-300">HEADS</span>
              <span className="text-[11px] font-bold text-white truncate max-w-[110px] text-center leading-tight">
                {nameA}
              </span>
            </div>

            {/* BACK FACE (Team B - Tails) */}
            <div
              className="absolute inset-0 flex flex-col items-center justify-center rounded-full border-4 border-amber-400 bg-linear-to-br from-zinc-800 via-zinc-900 to-black text-white shadow-[0_0_30px_rgba(245,158,11,0.5)] p-3"
              style={{
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
              }}
            >
              <div className="size-14 rounded-full bg-black/40 border border-amber-300/40 flex items-center justify-center overflow-hidden mb-1">
                {teamB?.logoUrl ? (
                  <img src={teamB.logoUrl} alt={nameB} className="size-full object-contain p-1" />
                ) : (
                  <span className="font-schabo text-2xl text-amber-200">{nameB.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-300">TAILS</span>
              <span className="text-[11px] font-bold text-white truncate max-w-[110px] text-center leading-tight">
                {nameB}
              </span>
            </div>
          </div>

          {/* Winner Announcement or Prompt */}
          <div className="mt-6 text-center min-h-[52px]">
            {isFlipping ? (
              <span className="text-sm font-semibold text-amber-300 animate-pulse">
                Flipping the coin...
              </span>
            ) : winner ? (
              <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold text-sm">
                  <Trophy className="size-4" />
                  <span>{winningTeamName.toUpperCase()} WON THE TOSS!</span>
                </div>
                <span className="text-xs text-zinc-400 mt-0.5">
                  Landed on {winner === 'TEAM_A' ? 'Heads' : 'Tails'}
                </span>
              </div>
            ) : (
              <span className="text-xs text-zinc-400">
                Click the coin or button below to flip
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2.5 pt-2 border-t border-white/10">
          {winner ? (
            <>
              <button
                type="button"
                onClick={() => {
                  onAssignWinner(winner)
                  onClose()
                }}
                className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trophy className="size-4" />
                <span>Assign {winningTeamName} as Team A (First Action)</span>
              </button>
              <button
                type="button"
                onClick={handleFlip}
                className="w-full py-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="size-3.5" />
                <span>Flip Again</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={isFlipping}
              onClick={handleFlip}
              className={`w-full py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                isFlipping
                  ? 'bg-amber-500/50 text-black/60 cursor-not-allowed'
                  : 'bg-amber-500 hover:bg-amber-400 text-black shadow-lg cursor-pointer'
              }`}
            >
              <Sparkles className="size-4" />
              <span>FLIP COIN</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
