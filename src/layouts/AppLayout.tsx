import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { TournamentSync } from '../lib/tournamentSync'
import { useRealtimeSync } from '../lib/realtimeSync'
import { useAppStore } from '../store/AppContext'
import { useDesktopPresence, GAME_NAMES } from '../lib/useDesktopPresence'
import { useAuth } from '../lib/useAuth'
import { listUserParticipatedTournamentIds, getTournament } from '../lib/dataLayer'
import {
  House, Settings, Users, Trophy, Tv, Video, Map,
  MonitorPlay, ChevronUp, LogOut
} from 'lucide-react'

const NAV_ITEMS = [
  { section: null, items: [
    { label: 'Overview', icon: Settings, path: '' },
    { label: 'HUD Editor', icon: MonitorPlay, path: '/broadcast-kit' },
  ]},
  { section: 'EVENT SETUP', items: [
    { label: 'Players & Teams', icon: Users, path: '/players-teams' },
    { label: 'Tournament', icon: Trophy, path: '/tournament' },
  ]},
  { section: 'LIVE GAME', items: [
    { label: 'Live Game', icon: Tv, path: '/live-broadcast' },
    { label: 'Camera feed', icon: Video, path: '/camera-feed' },
    { label: 'Map Veto', icon: Map, path: '/map-veto' },
  ]},
]

const PAGE_ICONS: Record<string, string> = {
  '': '⚙️',
  '/broadcast-kit': '🖥',
  '/players-teams': '👥',
  '/tournament': '🏆',
  '/live-broadcast': '📺',
  '/camera-feed': '🎬',
  '/map-veto': '🗺',
}

const PAGE_BREADCRUMBS: Record<string, string> = {
  '': 'test',
  '/broadcast-kit': 'HUD Editor',
  '/players-teams': 'Players & Teams',
  '/tournament': 'Tournament',
  '/live-broadcast': 'Live Game',
  '/camera-feed': 'Camera feed',
  '/map-veto': 'Map Veto',
}

export default function AppLayout() {
  const { tournamentId } = useParams()
  const { state, setStateSilent } = useAppStore()
  const { presence, live: desktopLive } = useDesktopPresence(state.serverCode || null)
  const location = useLocation()
  const navigate = useNavigate()
  const basePath = `/app/tournaments/${tournamentId}`
  const currentSuffix = location.pathname.replace(basePath, '') || ''

  // Keep the in-memory state live with Supabase Realtime (scores/teams/sponsors).
  useRealtimeSync()

  // Sync connected tournament from the URL - update name immediately so the
  // breadcrumb doesn't show the previous tournament while team data loads.
  useEffect(() => {
    if (!tournamentId) return
    setStateSilent(prev => prev.connectedTournamentId === tournamentId
      ? prev
      : {
          ...prev,
          connectedTournamentId: tournamentId,
          connectedTournamentName: tournamentId,
          // NOTE: Map Veto state is intentionally NOT reset here so a saved/ongoing
          // veto survives navigation between pages within the same tournament.
        })
    let cancelled = false
    getTournament(tournamentId).then(t => {
      if (!cancelled && t && t.title) {
        setStateSilent(prev => prev.connectedTournamentId === tournamentId
          ? { ...prev, connectedTournamentName: t.title ?? tournamentId }
          : prev)
      }
    }).catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, setStateSilent])

  // Room access guard: admins can open every room; a non-admin must have been
  // invited (tournament_participants.user_id = them). Otherwise redirect away.
  const { profile: authProfile, isAdmin: authIsAdmin, isOwner: authIsOwner, signOut } = useAuth()
  const [accessChecked, setAccessChecked] = useState(false)
  const [accessAllowed, setAccessAllowed] = useState(false)
  useEffect(() => {
    let cancelled = false
    const check = async () => {
      if (authIsAdmin) {
        setAccessAllowed(true); setAccessChecked(true); return
      }
      if (!authProfile?.id || !tournamentId) return
      try {
        const ids = await listUserParticipatedTournamentIds(authProfile.id)
        if (cancelled) return
        setAccessAllowed(ids.includes(tournamentId)); setAccessChecked(true)
      } catch {
        if (!cancelled) { setAccessAllowed(false); setAccessChecked(true) }
      }
    }
    void check()
    return () => { cancelled = true }
  }, [authProfile?.id, authIsAdmin, tournamentId])

  useEffect(() => {
    if (accessChecked && !accessAllowed) {
      window.location.href = 'https://havocunleash.vercel.app/'
    }
  }, [accessChecked, accessAllowed])

  if (accessChecked && !accessAllowed) {
    return (
      <div className='flex min-h-screen w-full items-center justify-center bg-[#0d0e10] text-sm text-white/50'>
        You don&apos;t have access to this room. Redirecting…
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'hsl(var(--background))' }}>
      {/* Sync connected tournament data into state */}
      <TournamentSync />
      {/* Sidebar */}
      <aside style={{
        width: 160,
        minWidth: 160,
        background: 'hsl(var(--background))',
        borderRight: '1px solid hsl(var(--border))',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
        overflow: 'hidden',
      }}>
        {/* Grid icon -> back to tournaments */}
        <div style={{ padding: '12px 12px 8px' }}>
          <button
            onClick={() => navigate('/app')}
            title="Tournaments"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'hsla(var(--muted-foreground))',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <House size={18} />
          </button>
        </div>

        {/* User avatar + info */}
        <div style={{ padding: '8px 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              className="squircle"
              style={{
                width: 34, height: 34,
                background: 'hsl(var(--havoc-blue))',
                fontSize: 12, color: 'white',
                flexShrink: 0,
              }}
            >
              {(authProfile?.display_name || 'U').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {authProfile?.display_name || 'User'}
              </div>
              <div style={{ fontSize: 11, color: 'hsla(var(--muted-foreground))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {(authIsOwner ? 'Owner · ' : '') + (authIsAdmin ? 'Admin' : 'Member')}
              </div>
            </div>
          </div>
          <button
            onClick={() => { void signOut() }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: 'none', border: '1px solid hsl(var(--border))', borderRadius: 6,
              padding: '5px 8px', color: 'hsla(var(--muted-foreground))', fontSize: 11,
              cursor: 'pointer',
            }}
          >
            <LogOut size={11} /> Sign out
          </button>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
          {NAV_ITEMS.map((section, si) => (
            <div key={si} style={{ marginBottom: 4 }}>
              {section.section && (
                <div style={{
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'hsla(var(--muted-foreground))',
                  padding: '12px 8px 4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0,
                }}>
                  <span style={{ flex: 1 }}>{section.section}</span>
                  <span style={{ width: '100%', height: 1, background: 'hsl(var(--border))', marginLeft: 6 }} />
                </div>
              )}
              {section.items.map(item => {
                const isActive = currentSuffix === item.path
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(`${basePath}${item.path}`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '7px 8px',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? 'hsl(var(--foreground))' : 'hsla(var(--muted-foreground))',
                      background: isActive ? 'hsla(0, 0%, 91%, 0.08)' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <item.icon size={15} style={{ opacity: isActive ? 1 : 0.7 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.label}
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Bottom actions */}
        <div style={{ padding: '8px 8px 12px', borderTop: '1px solid hsl(var(--border))' }}>
          <button
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '6px 8px',
              borderRadius: 6,
              fontSize: 11,
              color: 'hsla(var(--muted-foreground))',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <span>Feedback</span>
            <ChevronUp size={12} />
          </button>
          <div style={{ display: 'flex', gap: 8, padding: '4px 8px', fontSize: 10, color: 'hsla(var(--muted-foreground))' }}>
            <span style={{ cursor: 'pointer' }}>Legal</span>
            <span>•</span>
            <span style={{ cursor: 'pointer' }}>Resources</span>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100vh', overflow: 'hidden' }}>
        {/* Top header bar */}
        <header style={{
          height: 48,
          borderBottom: '1px solid hsl(var(--border))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          background: 'hsl(var(--background))',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          flexShrink: 0,
        }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <button
              onClick={() => navigate('/app')}
              style={{ background: 'none', border: 'none', color: 'hsla(var(--muted-foreground))', cursor: 'pointer', padding: 0, fontSize: 13 }}
              title="Back to tournaments"
            >←</button>
            <span>{PAGE_ICONS[currentSuffix] || '⚙️'}</span>
            <span style={{ color: 'hsla(var(--muted-foreground))' }}>/</span>
            <span style={{ fontWeight: 500 }}>{state.connectedTournamentName || PAGE_BREADCRUMBS[currentSuffix] || 'Overview'}</span>
          </div>

          {/* Desktop connection pill */}
          {state.serverCode && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 14px',
                borderRadius: 99,
                fontSize: 12,
                fontWeight: 600,
                background: desktopLive ? 'rgba(19, 53, 44, 0.9)' : 'rgba(42, 45, 49, 0.6)',
                color: desktopLive ? '#4ed9b4' : '#9aa0a6',
                border: desktopLive ? '1px solid rgba(29, 205, 155, 0.35)' : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {desktopLive
                ? `🖥 Desktop Connected${presence?.game ? ` — ${GAME_NAMES[presence.game] || presence.game}` : ''}`
                : '🖥 Desktop Offline'}
            </div>
          )}
        </header>

        {/* Page content */}
        <main style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
