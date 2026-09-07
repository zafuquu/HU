import { useEffect, useState } from 'react'

interface TimeoutOverlayProps {
  timeout: { team: 'left' | 'right'; calledAt: number; timeoutType: string } | null
  leftTeamName?: string
  rightTeamName?: string
  leftTeamColor?: string
  rightTeamColor?: string
}

export function TimeoutOverlay({ timeout, leftTeamName, rightTeamName, leftTeamColor = '#28D091', rightTeamColor = '#FF3549' }: TimeoutOverlayProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (timeout) {
      setVisible(true)
    } else {
      // Fade out
      const t = setTimeout(() => setVisible(false), 500)
      return () => clearTimeout(t)
    }
  }, [timeout])

  if (!visible && !timeout) return null

  const isTech = timeout?.timeoutType === 'tech_pause'
  const teamName = timeout?.team === 'left' ? (leftTeamName || 'TEAM A') : (rightTeamName || 'TEAM B')
  const teamColor = timeout?.team === 'left' ? leftTeamColor : rightTeamColor
  const label = isTech ? 'TECHNICAL PAUSE' : 'TACTICAL TIMEOUT'

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: 1920,
        height: 1080,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 90,
        opacity: timeout ? 1 : 0,
        transition: 'opacity 0.5s ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          padding: '40px 80px',
          background: 'rgba(0, 0, 0, 0.85)',
          borderRadius: 12,
          border: `2px solid ${teamColor}`,
          backdropFilter: 'blur(20px)',
          animation: timeout ? 'timeout-pulse 2s ease-in-out infinite' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: teamColor,
              animation: 'timeout-blink 1s ease-in-out infinite',
            }}
          />
          <span
            style={{
              fontFamily: 'Unbounded, sans-serif',
              fontSize: 28,
              fontWeight: 800,
              color: 'white',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}
          >
            {label}
          </span>
        </div>
        {!isTech && (
          <span
            style={{
              fontFamily: 'Barlow Condensed, sans-serif',
              fontSize: 18,
              color: teamColor,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Called by {teamName}
          </span>
        )}
      </div>
      <style>{`
        @keyframes timeout-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
        @keyframes timeout-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
