interface EconomyTrackerProps {
  economy: {
    left: { total: number; avgCredits: number; ecoType: string; playerCount: number }
    right: { total: number; avgCredits: number; ecoType: string; playerCount: number }
  } | null
  leftTeamColor?: string
  rightTeamColor?: string
  leftTeamName?: string
  rightTeamName?: string
}

const ECO_LABELS: Record<string, string> = {
  'full-buy': 'FULL BUY',
  'half-buy': 'HALF BUY',
  'force-buy': 'FORCE',
  'eco': 'ECO',
}

const ECO_COLORS: Record<string, string> = {
  'full-buy': '#4ADE80',
  'half-buy': '#FACC15',
  'force-buy': '#FB923C',
  'eco': '#F87171',
}

export function EconomyTracker({ economy, leftTeamColor = '#28D091', rightTeamColor = '#FF3549', leftTeamName, rightTeamName }: EconomyTrackerProps) {
  if (!economy) return null

  const formatCredits = (n: number) => n.toLocaleString()

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        width: '100%',
        padding: '0 8px',
        gap: 8,
      }}
    >
      {/* Left team economy */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 14px',
          background: 'rgba(0, 0, 0, 0.7)',
          borderRadius: 4,
          borderLeft: `3px solid ${leftTeamColor}`,
        }}
      >
        {leftTeamName && (
          <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '0.05em' }}>
            {leftTeamName}
          </span>
        )}
        <div
          style={{
            fontFamily: 'Barlow Condensed, sans-serif',
            fontSize: 13,
            fontWeight: 700,
            color: ECO_COLORS[economy.left.ecoType] || '#fff',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          {ECO_LABELS[economy.left.ecoType] || economy.left.ecoType}
        </div>
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.2)' }} />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 190 190" style={{ width: 10, height: 10, transform: 'rotate(45deg)', color: '#F9E4AB' }}>
            <circle cx="94.566" cy="94.574" r="54.425" stroke="currentColor" strokeWidth="22.41" />
            <path fill="currentColor" d="M80.164.12h28.813v32.015H80.164zM80.162 156.996h28.813v32.015H80.162zM32.135 76.965v28.813H.12V76.965zM189.01 76.964v28.813h-32.014V76.964z" />
          </svg>
          <span
            style={{
              fontFamily: 'Barlow Condensed, sans-serif',
              fontSize: 14,
              fontWeight: 600,
              color: '#F9E4AB',
            }}
          >
            {formatCredits(economy.left.total)}
          </span>
        </div>
      </div>

      {/* Right team economy */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 14px',
          background: 'rgba(0, 0, 0, 0.7)',
          borderRadius: 4,
          borderRight: `3px solid ${rightTeamColor}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span
            style={{
              fontFamily: 'Barlow Condensed, sans-serif',
              fontSize: 14,
              fontWeight: 600,
              color: '#F9E4AB',
            }}
          >
            {formatCredits(economy.right.total)}
          </span>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 190 190" style={{ width: 10, height: 10, transform: 'rotate(45deg)', color: '#F9E4AB' }}>
            <circle cx="94.566" cy="94.574" r="54.425" stroke="currentColor" strokeWidth="22.41" />
            <path fill="currentColor" d="M80.164.12h28.813v32.015H80.164zM80.162 156.996h28.813v32.015H80.162zM32.135 76.965v28.813H.12V76.965zM189.01 76.964v28.813h-32.014V76.964z" />
          </svg>
        </div>
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.2)' }} />
        <div
          style={{
            fontFamily: 'Barlow Condensed, sans-serif',
            fontSize: 13,
            fontWeight: 700,
            color: ECO_COLORS[economy.right.ecoType] || '#fff',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          {ECO_LABELS[economy.right.ecoType] || economy.right.ecoType}
        </div>
        {rightTeamName && (
          <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '0.05em' }}>
            {rightTeamName}
          </span>
        )}
      </div>
    </div>
  )
}
