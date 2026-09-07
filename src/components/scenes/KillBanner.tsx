import { useEffect, useState } from 'react'

interface KillBannerProps {
  killBanner: {
    type: 'first_blood' | 'ace' | 'clutch' | 'thrifty'
    playerName: string | null
    team: 'left' | 'right'
    at: number
    kills?: number
  } | null
  leftTeamColor?: string
  rightTeamColor?: string
}

const BANNER_LABELS: Record<string, string> = {
  first_blood: 'FIRST BLOOD',
  ace: 'ACE',
  clutch: 'CLUTCH',
  thrifty: 'THRIFTY',
}

const BANNER_ICONS: Record<string, string> = {
  first_blood: '💀',
  ace: '🔥',
  clutch: '⚡',
  thrifty: '💰',
}

export function KillBanner({ killBanner, leftTeamColor = '#28D091', rightTeamColor = '#FF3549' }: KillBannerProps) {
  const [show, setShow] = useState(false)
  const [data, setData] = useState(killBanner)

  useEffect(() => {
    if (killBanner) {
      setData(killBanner)
      setShow(true)
    } else {
      // Slide out
      setShow(false)
    }
  }, [killBanner])

  if (!data) return null

  const teamColor = data.team === 'left' ? leftTeamColor : rightTeamColor
  const label = BANNER_LABELS[data.type] || data.type.toUpperCase()
  const icon = BANNER_ICONS[data.type] || ''

  return (
    <div
      style={{
        position: 'absolute',
        top: 200,
        left: 0,
        width: 1920,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 95,
        transform: show ? 'translateY(0)' : 'translateY(-60px)',
        opacity: show ? 1 : 0,
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: '14px 48px',
          background: `linear-gradient(135deg, rgba(0,0,0,0.9) 0%, rgba(20,20,20,0.95) 100%)`,
          borderRadius: 8,
          border: `2px solid ${teamColor}`,
          boxShadow: `0 0 40px ${teamColor}40, 0 8px 32px rgba(0,0,0,0.6)`,
        }}
      >
        <span style={{ fontSize: 32 }}>{icon}</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span
            style={{
              fontFamily: 'Unbounded, sans-serif',
              fontSize: 24,
              fontWeight: 800,
              color: teamColor,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              textShadow: `0 0 20px ${teamColor}80`,
            }}
          >
            {label}
          </span>
          {data.playerName && (
            <span
              style={{
                fontFamily: 'Barlow Condensed, sans-serif',
                fontSize: 16,
                color: 'white',
                fontWeight: 600,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                opacity: 0.9,
              }}
            >
              {data.playerName}
              {data.type === 'clutch' && data.kills ? ` (1v${data.kills})` : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
