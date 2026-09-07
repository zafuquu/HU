import React from 'react'

/**
 * KillFeed — broadcast overlay component.
 *
 * Renders a stack of recent kills in the top-right area, each entry
 * sliding in from the right and auto-fading after 5 seconds.
 * Uses CSS animation classes: anim-killfeed-item, anim-killfeed-headshot
 */

export interface KillEntry {
  id: string
  attackerName: string
  attackerTeam: 'left' | 'right'
  victimName: string
  victimTeam: 'left' | 'right'
  weaponIcon?: string
  weaponName?: string
  isHeadshot?: boolean
  assists?: string[]
  timestamp: number
}

interface KillFeedProps {
  kills: KillEntry[]
  maxVisible?: number
  leftTeamColor?: string
  rightTeamColor?: string
  /** Fade-out duration in ms before removing entries */
  ttl?: number
}

export function KillFeed({
  kills,
  maxVisible = 6,
  leftTeamColor = '#28D091',
  rightTeamColor = '#FF3549',
  ttl = 5000,
}: KillFeedProps) {
  const [visibleKills, setVisibleKills] = React.useState<KillEntry[]>([])

  React.useEffect(() => {
    const now = Date.now()
    const active = kills
      .filter((k) => now - k.timestamp < ttl)
      .slice(-maxVisible)
    setVisibleKills(active)
  }, [kills, maxVisible, ttl])

  // Auto-cleanup timer
  React.useEffect(() => {
    if (visibleKills.length === 0) return
    const timer = setInterval(() => {
      const now = Date.now()
      setVisibleKills((prev) => prev.filter((k) => now - k.timestamp < ttl))
    }, 500)
    return () => clearInterval(timer)
  }, [visibleKills.length, ttl])

  if (visibleKills.length === 0) return null

  const teamColor = (team: 'left' | 'right') =>
    team === 'left' ? leftTeamColor : rightTeamColor

  return (
    <div
      className="absolute top-24 right-4 z-40 flex flex-col items-end gap-1"
      style={{ pointerEvents: 'none' }}
    >
      {visibleKills.map((kill) => (
        <div
          key={kill.id}
          className={kill.isHeadshot ? 'anim-killfeed-headshot' : 'anim-killfeed-item'}
          style={{ animationDuration: `${ttl}ms` }}
        >
          <div className="flex items-center gap-2 rounded-sm bg-black/80 px-3 py-1.5 backdrop-blur-sm border border-white/10 shadow-lg">
            {/* Attacker */}
            <span
              className="font-barlowCond text-sm font-semibold uppercase tracking-wide"
              style={{ color: teamColor(kill.attackerTeam) }}
            >
              {kill.attackerName}
            </span>

            {/* Assists */}
            {kill.assists && kill.assists.length > 0 && (
              <span className="text-[10px] text-white/40 font-baijam">
                +{kill.assists.length}
              </span>
            )}

            {/* Weapon / kill icon */}
            <div className="flex items-center gap-1.5 px-1">
              {kill.isHeadshot && (
                <svg className="h-3 w-3 text-yellow-400" viewBox="0 0 16 16" fill="currentColor">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" />
                  <circle cx="8" cy="8" r="2" fill="currentColor" />
                  <line x1="8" y1="1" x2="8" y2="4" stroke="currentColor" strokeWidth="1.2" />
                  <line x1="8" y1="12" x2="8" y2="15" stroke="currentColor" strokeWidth="1.2" />
                  <line x1="1" y1="8" x2="4" y2="8" stroke="currentColor" strokeWidth="1.2" />
                  <line x1="12" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              )}
              {kill.weaponIcon ? (
                <img
                  src={kill.weaponIcon}
                  alt={kill.weaponName || ''}
                  className="h-3.5 w-auto object-contain invert opacity-70"
                />
              ) : (
                <div className="flex items-center">
                  <svg className="h-3 w-5 text-white/50" viewBox="0 0 20 12" fill="none">
                    <rect x="0" y="4" width="14" height="4" rx="1" fill="currentColor" />
                    <rect x="12" y="2" width="8" height="8" rx="1" fill="currentColor" />
                    <rect x="3" y="7" width="4" height="5" rx="1" fill="currentColor" />
                  </svg>
                </div>
              )}
            </div>

            {/* Victim */}
            <span
              className="font-barlowCond text-sm font-semibold uppercase tracking-wide"
              style={{ color: teamColor(kill.victimTeam) }}
            >
              {kill.victimName}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

export default KillFeed
