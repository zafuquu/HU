import { useEffect, useState } from 'react'

interface TimeoutOverlayProps {
  /**
   * `team` is null when the CALLING team is unknown — GEP never attributes it
   * (the original desktop shipped no team either). The banner then renders a
   * neutral tactical presentation instead of mislabeling a side.
   */
  timeout: { team: 'left' | 'right' | null; calledAt: number; timeoutType: string } | null
  leftTeamName?: string
  rightTeamName?: string
  leftTeamColor?: string
  rightTeamColor?: string
  leftTeamLogo?: string | null
  rightTeamLogo?: string | null
}

/**
 * ValoSpectra timeout.component parity: a 750x200 banner at the top-center of
 * the stage that swishes in/out (300ms clip reveal).
 *  - tech_pause: neutral tech gradient + "TECHNICAL PAUSE" (no team branding,
 *    persists until cleared — the game gives no resume signal).
 *  - tactical:   calling team's color gradient + team logo + timeout pips +
 *                a 60s draining countdown bar (VS timeoutDuration default).
 */
const BANNER_W = 750
const BANNER_H = 200
const TACTICAL_DURATION = 60

export function TimeoutOverlay({
  timeout,
  leftTeamName,
  rightTeamName,
  leftTeamColor = '#28D091',
  rightTeamColor = '#FF3549',
  leftTeamLogo,
  rightTeamLogo,
}: TimeoutOverlayProps) {
  const [visible, setVisible] = useState(false)
  const [snap, setSnap] = useState<typeof timeout>(null)
  const [, setTick] = useState(0)

  // Keep the last non-null timeout during the out-animation (VS parity:
  // delayEndTimeoutEffect) and re-tick every 250ms for the countdown bar.
  useEffect(() => {
    if (timeout) {
      setSnap(timeout)
      setVisible(true)
    } else {
      const t = setTimeout(() => setVisible(false), 350)
      return () => clearTimeout(t)
    }
  }, [timeout])

  useEffect(() => {
    if (!visible || snap?.timeoutType !== 'tactical') return
    const iv = setInterval(() => setTick((v) => v + 1), 250)
    return () => clearInterval(iv)
  }, [visible, snap])

  if (!visible || !snap) return null

  const isTech = snap.timeoutType === 'tech_pause'
  const hasTeam = snap.team === 'left' || snap.team === 'right'
  const isLeft = snap.team === 'left'
  const teamName = hasTeam ? (isLeft ? (leftTeamName || 'TEAM A') : (rightTeamName || 'TEAM B')) : 'TACTICAL TIMEOUT'
  const teamColor = isLeft ? leftTeamColor : rightTeamColor
  const teamLogo = hasTeam ? (isLeft ? (leftTeamLogo ?? null) : (rightTeamLogo ?? null)) : null

  const elapsed = Math.max(0, Math.floor((Date.now() - snap.calledAt) / 1000))
  const remaining = Math.max(0, TACTICAL_DURATION - elapsed)
  const pct = Math.max(0, Math.min(100, (remaining / TACTICAL_DURATION) * 100))

  // Auto-hide a finished tactical timeout even if the bridge keeps the flag.
  if (!isTech && remaining <= 0) return null

  const gradient = isTech
    ? 'linear-gradient(to top, rgba(120, 130, 160, 0.75) 0%, rgba(120, 130, 160, 0) 90%), rgba(15, 25, 35, 1)'
    : hasTeam
      ? `linear-gradient(to ${isLeft ? 'right' : 'left'}, ${teamColor}bf 0%, rgba(15, 25, 35, 1) 90%)`
      : 'linear-gradient(to top, rgba(120, 130, 160, 0.6) 0%, rgba(120, 130, 160, 0) 90%), rgba(15, 25, 35, 1)'

  return (
    <div
      style={{
        position: 'absolute',
        top: 250,
        left: '50%',
        transform: 'translateX(-50%)',
        width: BANNER_W,
        height: BANNER_H,
        pointerEvents: 'none',
        zIndex: 90,
        overflow: 'hidden',
        borderRadius: 8,
        background: gradient,
        boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
        animation: 'timeout-swish-in 300ms ease',
      }}
    >
      {isTech ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p
            style={{
              fontFamily: 'Unbounded, sans-serif',
              fontSize: 40,
              fontWeight: 800,
              color: '#fff',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              textShadow: '0 2px 12px rgba(0,0,0,0.6)',
            }}
          >
            TECHNICAL PAUSE
          </p>
        </div>
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-around', minHeight: 0 }}>
            {hasTeam && (
              <img
                alt=""
                src={teamLogo ?? undefined}
                style={{ maxHeight: 120, maxWidth: 300, objectFit: 'contain', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))' }}
              />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <p style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 20, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {hasTeam ? `${teamName} — TACTICAL TIMEOUT` : 'TACTICAL TIMEOUT'}
              </p>
              <div style={{ display: 'flex', gap: 6 }}>
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: i === 0 ? '#F9E4AB' : 'rgba(255,255,255,0.25)',
                      boxShadow: i === 0 ? '0 0 10px rgba(249, 228, 171, 0.8)' : undefined,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div style={{ height: 22, position: 'relative', background: 'rgba(255,255,255,0.2)', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: '100%',
                width: `${pct}%`,
                background: 'rgba(255,255,255,0.35)',
                transition: 'width 1s linear',
              }}
            />
            <p
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'Barlow Condensed, sans-serif',
                fontSize: 15,
                fontWeight: 700,
                color: '#fff',
                textShadow: '0 1px 3px rgba(0,0,0,0.5)',
              }}
            >
              {remaining}s
            </p>
          </div>
        </div>
      )}
      <style>{`
        @keyframes timeout-swish-in {
          from { clip-path: inset(0 100% 0 0); }
          to { clip-path: inset(0 0 0 0); }
        }
      `}</style>
    </div>
  )
}
