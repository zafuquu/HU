import { useEffect, useState } from 'react'

interface CasterInfo {
  name: string
  role?: string
  photoUrl?: string | null
}

interface CasterCardProps {
  casters: CasterInfo[] | null
  leftTeamColor?: string
}

export function CasterCard({ casters, leftTeamColor = '#28D091' }: CasterCardProps) {
  const [show, setShow] = useState(false)
  const [data, setData] = useState(casters)

  useEffect(() => {
    if (casters && casters.length > 0) {
      setData(casters)
      setShow(true)
    } else {
      setShow(false)
    }
  }, [casters])

  if (!data || data.length === 0) return null

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 120,
        left: 40,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
        zIndex: 80,
        transform: show ? 'translateX(0)' : 'translateX(-400px)',
        opacity: show ? 1 : 0,
        transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {data.map((caster, i) => (
        <div
          key={caster.name + i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 24px 10px 12px',
            background: 'rgba(0, 0, 0, 0.85)',
            borderRadius: 6,
            borderLeft: `3px solid ${leftTeamColor}`,
            backdropFilter: 'blur(12px)',
            transitionDelay: `${i * 0.1}s`,
          }}
        >
          {caster.photoUrl && (
            <img
              src={caster.photoUrl}
              alt={caster.name}
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                objectFit: 'cover',
                border: `2px solid ${leftTeamColor}40`,
              }}
            />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span
              style={{
                fontFamily: 'Unbounded, sans-serif',
                fontSize: 16,
                fontWeight: 700,
                color: 'white',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              {caster.name}
            </span>
            {caster.role && (
              <span
                style={{
                  fontFamily: 'Barlow Condensed, sans-serif',
                  fontSize: 12,
                  color: leftTeamColor,
                  fontWeight: 500,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                {caster.role}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
