import { useState, useEffect, useRef } from 'react'
import { Bookmark, FastForward, Rewind, Radio } from 'lucide-react'

export interface ReplaySnapshot {
  id: string
  timestamp: number
  roundNumber: number
  scoreLeft: number
  scoreRight: number
  eventLabel?: string
  state: any
}

interface ReplaySystemProps {
  currentState: any
  onApplyState?: (replayedState: any) => void
  onReturnToLive?: () => void
  isLive?: boolean
}

export function ReplaySystem({
  currentState,
  onApplyState,
  onReturnToLive,
  isLive = true,
}: ReplaySystemProps) {
  const [buffer, setBuffer] = useState<ReplaySnapshot[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [isReplaying, setIsReplaying] = useState<boolean>(false)
  const [bookmarks, setBookmarks] = useState<string[]>([])
  const lastCapturedRef = useRef<number>(0)

  // Ring buffer: auto-capture snapshot every 2 seconds when live
  useEffect(() => {
    if (!isLive || !currentState) return

    const now = Date.now()
    if (now - lastCapturedRef.current < 2000) return
    lastCapturedRef.current = now

    const snapshot: ReplaySnapshot = {
      id: `snap_${now}`,
      timestamp: now,
      roundNumber: currentState.currentRoundNumber || 1,
      scoreLeft: currentState.team1Score || 0,
      scoreRight: currentState.team2Score || 0,
      state: JSON.parse(JSON.stringify(currentState)),
    }

    setBuffer(prev => {
      const next = [...prev, snapshot]
      // keep max 60 snapshots (2 minutes of replay history)
      if (next.length > 60) next.shift()
      return next
    })
  }, [currentState, isLive])

  const handleScrub = (index: number) => {
    setSelectedIndex(index)
    const target = buffer[index]
    if (target && onApplyState) {
      setIsReplaying(true)
      onApplyState(target.state)
    }
  }

  const handleReturnToLive = () => {
    setSelectedIndex(null)
    setIsReplaying(false)
    if (onReturnToLive) {
      onReturnToLive()
    } else if (onApplyState && currentState) {
      onApplyState(currentState)
    }
  }

  const addBookmark = () => {
    if (!buffer.length) return
    const idx = selectedIndex !== null ? selectedIndex : buffer.length - 1
    const snap = buffer[idx]
    if (snap && !bookmarks.includes(snap.id)) {
      setBookmarks(prev => [...prev, snap.id])
    }
  }

  const formatTimeAgo = (ts: number) => {
    const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000))
    if (diff < 60) return `-${diff}s`
    const m = Math.floor(diff / 60)
    const s = diff % 60
    return `-${m}m${s}s`
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#16171a] p-4 text-white shadow-xl space-y-3 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`size-2.5 rounded-full ${isReplaying ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`} />
          <h3 className="text-xs font-bold tracking-wider uppercase text-white/90">
            {isReplaying ? 'REPLAY MODE ACTIVE' : 'LIVE STATE RECORDER'}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {isReplaying ? (
            <button
              type="button"
              onClick={handleReturnToLive}
              className="flex items-center gap-1.5 rounded-md bg-green-600/30 border border-green-500/40 px-2.5 py-1 text-xs font-semibold text-green-300 hover:bg-green-600/40 transition-colors cursor-pointer"
            >
              <Radio className="size-3" />
              Return to Live
            </button>
          ) : (
            <span className="text-[11px] text-white/40">
              {buffer.length} frames cached
            </span>
          )}
        </div>
      </div>

      {/* Timeline Bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-white/40">
          <span>{buffer.length ? formatTimeAgo(buffer[0].timestamp) : '-0s'}</span>
          <span>LIVE</span>
        </div>

        <div className="relative flex items-center h-6 bg-black/40 rounded-lg p-1 border border-white/5">
          {buffer.map((snap, i) => {
            const isSelected = selectedIndex === i
            const isBookmarked = bookmarks.includes(snap.id)
            return (
              <button
                key={snap.id}
                type="button"
                onClick={() => handleScrub(i)}
                title={`Round ${snap.roundNumber} (${snap.scoreLeft}-${snap.scoreRight})`}
                className={`flex-1 h-full mx-0.5 rounded-sm transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-amber-400 scale-y-125 z-10'
                    : isBookmarked
                    ? 'bg-blue-400'
                    : 'bg-white/20 hover:bg-white/50'
                }`}
              />
            )
          })}
        </div>
      </div>

      {/* Action controls */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!buffer.length}
            onClick={() => handleScrub(Math.max(0, (selectedIndex ?? buffer.length - 1) - 5))}
            className="rounded border border-white/10 bg-white/5 p-1.5 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30 cursor-pointer"
            title="Rewind 10s"
          >
            <Rewind className="size-3.5" />
          </button>

          <button
            type="button"
            disabled={!buffer.length}
            onClick={() => handleScrub(Math.min(buffer.length - 1, (selectedIndex ?? 0) + 5))}
            className="rounded border border-white/10 bg-white/5 p-1.5 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-30 cursor-pointer"
            title="Forward 10s"
          >
            <FastForward className="size-3.5" />
          </button>

          <button
            type="button"
            disabled={!buffer.length}
            onClick={addBookmark}
            className="flex items-center gap-1 rounded border border-blue-500/30 bg-blue-950/40 px-2 py-1 text-xs text-blue-300 hover:bg-blue-900/40 cursor-pointer"
          >
            <Bookmark className="size-3" />
            Bookmark Moment
          </button>
        </div>

        {selectedIndex !== null && buffer[selectedIndex] && (
          <div className="text-right text-[11px] text-white/60">
            <span className="font-semibold text-amber-400">
              Round {buffer[selectedIndex].roundNumber}
            </span>{' '}
            ({buffer[selectedIndex].scoreLeft} - {buffer[selectedIndex].scoreRight}){' '}
            <span className="text-white/40">
              {formatTimeAgo(buffer[selectedIndex].timestamp)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
