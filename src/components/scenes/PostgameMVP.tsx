
export interface MvpPlayerData {
  name: string
  agent?: string
  kills?: number
  deaths?: number
  assists?: number
  acs?: number
  team?: 'left' | 'right'
  rating?: string
}

interface PostgameMVPProps {
  mvp: MvpPlayerData | null
  leftTeamName?: string
  rightTeamName?: string
  leftTeamColor?: string
  rightTeamColor?: string
}

export function PostgameMVP({
  mvp,
  leftTeamName = 'TEAM A',
  rightTeamName = 'TEAM B',
  leftTeamColor = '#28D091',
  rightTeamColor = '#FF3549',
}: PostgameMVPProps) {
  if (!mvp) return null

  const isLeft = mvp.team === 'left'
  const teamName = isLeft ? leftTeamName : rightTeamName
  const teamColor = isLeft ? leftTeamColor : rightTeamColor
  const kills = mvp.kills ?? 0
  const deaths = mvp.deaths ?? 0
  const assists = mvp.assists ?? 0
  const acs = mvp.acs ?? 0
  const kd = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2)

  // Agent image resolver (lowercase sanitized)
  const agentKey = (mvp.agent || 'hunter').toLowerCase().replace(/[^a-z0-9]/g, '')
  const agentPortrait = `/game/val/agents/${agentKey}/portrait.png`

  return (
    <div
      className="mvp-card-container"
      style={{
        position: 'absolute',
        bottom: 80,
        right: 80,
        width: 520,
        height: 280,
        zIndex: 60,
        animation: 'mvpSlideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }}
    >
      <style>{`
        @keyframes mvpSlideUp {
          from { opacity: 0; transform: translateY(40px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes goldGlow {
          0%, 100% { box-shadow: 0 0 25px rgba(250, 204, 21, 0.25), 0 0 50px rgba(250, 204, 21, 0.1); }
          50% { box-shadow: 0 0 35px rgba(250, 204, 21, 0.45), 0 0 70px rgba(250, 204, 21, 0.2); }
        }
      `}</style>

      {/* Main card background */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: 12,
          overflow: 'hidden',
          background: 'linear-gradient(135deg, rgba(20,20,24,0.95) 0%, rgba(10,10,12,0.98) 100%)',
          border: '2px solid rgba(250, 204, 21, 0.6)',
          animation: 'goldGlow 3s ease-in-out infinite',
          backdropFilter: 'blur(16px)',
          display: 'flex',
        }}
      >
        {/* Left: Agent Portrait Cutout */}
        <div
          style={{
            position: 'relative',
            width: 200,
            height: '100%',
            overflow: 'hidden',
            flexShrink: 0,
            background: `linear-gradient(180deg, ${teamColor}33 0%, rgba(0,0,0,0.8) 100%)`,
          }}
        >
          <img
            src={agentPortrait}
            alt={mvp.agent || 'Agent'}
            onError={(e) => {
              ;(e.target as HTMLImageElement).src = '/game/val/agents/hunter/portrait.png'
            }}
            style={{
              position: 'absolute',
              bottom: -20,
              left: -30,
              width: 260,
              height: 'auto',
              objectFit: 'cover',
              filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.7))',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to right, transparent 60%, rgba(15,15,18,0.95) 100%)',
            }}
          />
        </div>

        {/* Right: Player stats & details */}
        <div
          style={{
            flex: 1,
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            fontFamily: 'Barlow Condensed, sans-serif',
          }}
        >
          {/* Top: MATCH MVP badge & Team */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                borderRadius: 4,
                background: 'linear-gradient(90deg, #F59E0B 0%, #D97706 100%)',
                color: '#000',
                fontWeight: 800,
                fontSize: 14,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              MATCH MVP
            </div>

            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: teamColor,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              {teamName}
            </div>
          </div>

          {/* Middle: Player Name */}
          <div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 900,
                color: '#FFFFFF',
                lineHeight: 1.1,
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {mvp.name}
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.5)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {mvp.agent || 'AGENT'}
            </div>
          </div>

          {/* Bottom: Stat Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 8,
              padding: '8px 12px',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.05em' }}>
                K / D / A
              </div>
              <div style={{ fontSize: 18, color: '#FFF', fontWeight: 800 }}>
                {kills}/{deaths}/{assists}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.05em' }}>
                ACS
              </div>
              <div style={{ fontSize: 18, color: '#F59E0B', fontWeight: 800 }}>
                {acs}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.05em' }}>
                K/D RATIO
              </div>
              <div style={{ fontSize: 18, color: Number(kd) >= 1 ? '#10B981' : '#EF4444', fontWeight: 800 }}>
                {kd}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
