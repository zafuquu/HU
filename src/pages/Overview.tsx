import { useState, useEffect } from 'react'
import { Copy, MoreHorizontal, Eye, EyeOff, X, Check, Search, UserRound } from 'lucide-react'
import { useAppStore } from '../store/AppContext'
import { useAuth } from '../lib/useAuth'
import { MOCK_EVENT, MOCK_TOURNAMENT } from '../lib/mockEvent'
import { listTournaments, searchProfiles, inviteRoomMember, removeRoomMember } from '../lib/dataLayer'
import type { Tournament, Profile } from '../lib/supabase'
import Dropdown from '../components/Dropdown'

const OVERLAY_OPTIONS = ['Ingame HUD', 'Agent Select', 'Buy Round', 'Map Ban', 'Postgame']
// Official-format screen keys (parity with the original's ?screen= param)
const SCREEN_KEYS: Record<string, string> = {
  'Ingame HUD': 'default',
  'Agent Select': 'agent-select',
  'Buy Round': 'buy-round',
  'Map Ban': 'map-ban',
  'Postgame': 'post-game',
}
const GAME_OPTIONS = ['Valorant']

export default function Overview() {
  const { state, setState, showToast } = useAppStore()
  const [emailMasked, setEmailMasked] = useState(true)
  const [overlayUrl, setOverlayUrl] = useState('Ingame HUD')
  const [userMenuOpen, setUserMenuOpen] = useState<string | null>(null)
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  // Invite state
  const [inviteQuery, setInviteQuery] = useState('')
  const [inviteResults, setInviteResults] = useState<Profile[]>([])
  const [inviteRole, setInviteRole] = useState('Editor')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)

  // ===== Supabase current event =====
  const { isAdmin } = useAuth()
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    listTournaments()
      .then(ts => setTournaments(MOCK_EVENT ? [MOCK_TOURNAMENT as unknown as Tournament, ...ts] : ts))
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)))
  }, [])

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedField(field)
    showToast('Copied to clipboard!')
    setTimeout(() => setCopiedField(null), 2000)
  }

  // Bump the key so AppContext reloads the room users after an invite/remove.
  const refreshUsers = () => {
    setState(prev => ({ ...prev, usersRefreshKey: (prev.usersRefreshKey || 0) + 1 }))
  }

  const runInviteSearch = async (q: string) => {
    setInviteQuery(q)
    if (!q.trim()) { setInviteResults([]); return }
    try {
      setInviteResults(await searchProfiles(q))
    } catch { setInviteResults([]) }
  }

  const doInvite = async (target: Profile) => {
    if (!state.connectedTournamentId) return
    setInviteBusy(true); setInviteError(null)
    try {
      await inviteRoomMember(state.connectedTournamentId, target.id, inviteRole)
      refreshUsers()
      setInviteQuery(''); setInviteResults([])
      setInviteModalOpen(false)
      showToast(`${target.display_name?.trim() || target.discord_id || 'User'} added as ${inviteRole}`)
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : String(e))
    } finally { setInviteBusy(false) }
  }

  const removeUser = async (userId: string, name: string) => {
    setUserMenuOpen(null)
    try {
      if (state.connectedTournamentId) {
        await removeRoomMember(state.connectedTournamentId, userId)
        refreshUsers()
      } else {
        setState(prev => ({ ...prev, users: prev.users.filter(u => u.id !== userId) }))
      }
      showToast(`${name} removed`)
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Remove failed')
    }
  }

  const changeRole = async (userId: string, newRole: string) => {
    setUserMenuOpen(null)
    setState(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === userId ? { ...u, role: newRole } : u),
    }))
    if (state.connectedTournamentId) {
      try {
        await inviteRoomMember(state.connectedTournamentId, userId, newRole)
        refreshUsers()
        showToast(`Role changed to ${newRole}`)
      } catch {
        // keep optimistic state
      }
    }
  }

  return (
    <div className="size-full overflow-y-auto p-8 text-white" style={{ scrollbarWidth: 'none', display: 'flex', gap: 48, maxWidth: 1200 }}>
      {/* Left column */}
      <div style={{ flex: 1, maxWidth: 500 }}>
        {/* Current Event */}
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Current Event</h2>
        <p style={{ fontSize: 13, color: 'hsla(var(--muted-foreground))', marginBottom: 12 }}>
          This room is tied to one event. Pick it from My Events on the home page.
        </p>

        {loadError && <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 12 }}>{loadError}</p>}

        {state.connectedTournamentId ? (() => {
          const t = tournaments.find(x => x.id === state.connectedTournamentId)
          return (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24,
              padding: '12px 14px', borderRadius: 12,
              background: 'hsla(152,60%,50%,0.08)', border: '1px solid hsla(152,60%,50%,0.35)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#4ade80', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t?.title || state.connectedTournamentName || state.connectedTournamentId}
                </div>
                <div style={{ fontSize: 12, color: 'hsla(var(--muted-foreground))', marginTop: 2 }}>
                  {t?.game ? `${t.game} · ` : ''}{t?.status || 'Connected'}
                  {t?.prize ? ` · ${t.prize}` : ''}
                </div>
              </div>
              <span style={{ fontSize: 11, color: 'hsla(var(--muted-foreground))', fontFamily: 'monospace' }}>
                {state.connectedTournamentId.slice(0, 8)}
              </span>
            </div>
          )
        })() : (
          <div style={{ padding: '12px', border: '1px dashed hsl(var(--border))', borderRadius: 8, fontSize: 12, color: 'hsla(var(--muted-foreground))', textAlign: 'center', marginBottom: 24 }}>
            No event connected. Open one from My Events to load this room&apos;s teams, players &amp; sponsors.
          </div>
        )}

        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Start Streaming</h2>
        <p style={{ fontSize: 13, color: 'hsla(var(--muted-foreground))', marginBottom: 20 }}>
          Copy the information below to get started
        </p>

        {/* Server Code */}
        <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Server Code</label>
        <div className="copy-field" style={{ marginBottom: 4 }}>
          <code style={{ flex: 1, fontSize: 13 }}>{state.serverCode}</code>
          <button
            onClick={() => copyToClipboard(state.serverCode, 'server')}
            style={{ background: 'none', border: 'none', color: copiedField === 'server' ? '#22c55e' : 'hsla(var(--muted-foreground))', cursor: 'pointer', padding: 2 }}
          >
            {copiedField === 'server' ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
        <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 24 }}>*Copy into the HAVOC UNLEASH Desktop App</p>

        {/* Overlay URL */}
        <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Overlay URL</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
          <Dropdown
            value={overlayUrl}
            options={OVERLAY_OPTIONS}
            onChange={setOverlayUrl}
          />
          <button
            onClick={() => copyToClipboard(
              `${window.location.origin}/overlays/${state.serverCode}/${SCREEN_KEYS[overlayUrl] || 'default'}?screen=${SCREEN_KEYS[overlayUrl] || 'default'}`,
              'overlay'
            )}
            style={{ background: 'none', border: 'none', color: copiedField === 'overlay' ? '#22c55e' : 'hsla(var(--muted-foreground))', cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}
          >
            {copiedField === 'overlay' ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
        <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 40 }}>*Copy into browser source to show HUD</p>

        {/* Workspace */}
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>Workspace</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: 'hsla(var(--muted-foreground))', marginBottom: 6, display: 'block' }}>Workspace name</label>
            <input
              className="input-field"
              value={state.workspaceName}
              onChange={e => setState(prev => ({ ...prev, workspaceName: e.target.value }))}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'hsla(var(--muted-foreground))', marginBottom: 6, display: 'block' }}>Event organiser</label>
            <input
              className="input-field"
              value={state.eventOrganiser}
              onChange={e => setState(prev => ({ ...prev, eventOrganiser: e.target.value }))}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: 'hsla(var(--muted-foreground))', marginBottom: 6, display: 'block' }}>Select game</label>
            <Dropdown
              value={state.selectedGame}
              options={GAME_OPTIONS}
              onChange={v => setState(prev => ({ ...prev, selectedGame: v }))}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'hsla(var(--muted-foreground))', marginBottom: 6, display: 'block' }}>Broadcast kit</label>
            <Dropdown
              value={state.broadcastKit}
              options={['Classic', 'Version 1']}
              onChange={v => setState(prev => ({ ...prev, broadcastKit: v }))}
            />
          </div>
        </div>
      </div>

      {/* Right column */}
      <div style={{ flex: 1, maxWidth: 500 }}>
        {/* Users */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>Users</h2>
            <span style={{ fontSize: 13, color: 'hsla(var(--muted-foreground))' }}>({state.users.length})</span>
          </div>
          {isAdmin && state.connectedTournamentId && (
            <button
              className="btn btn-secondary"
              style={{ gap: 6 }}
              onClick={() => setInviteModalOpen(true)}
            >
              <UserRound size={14} />
              Invite collaborator
            </button>
          )}
        </div>

        {/* User rows */}
        {state.users.map(user => (
          <div key={user.id} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
            borderBottom: '1px solid hsl(var(--border))',
          }}>
            <div
              className="squircle"
              style={{ width: 40, height: 40, background: 'hsl(var(--havoc-blue))', fontSize: 14, color: 'white', flexShrink: 0 }}
            >
              {user.avatarInitials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
                {user.name}
                {user.role === 'Owner' && (
                  <>
                    <span style={{ fontSize: 11, color: 'hsla(var(--muted-foreground))' }}>(you)</span>
                    <span style={{ fontSize: 12, color: '#f59e0b' }}>👑</span>
                  </>
                )}
                <span style={{
                  fontSize: 11, fontWeight: 500, padding: '1px 6px', borderRadius: 4,
                  background: 'hsla(0, 0%, 91%, 0.06)', color: 'hsla(var(--muted-foreground))',
                }}>
                  {user.role}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'hsla(var(--muted-foreground))' }}>
                {emailMasked && user.role === 'Owner' ? '************' : user.email}
                {user.role === 'Owner' && (
                  <button
                    onClick={() => setEmailMasked(!emailMasked)}
                    style={{ background: 'none', border: 'none', color: 'hsla(var(--muted-foreground))', cursor: 'pointer', padding: 2 }}
                  >
                    {emailMasked ? <Eye size={12} /> : <EyeOff size={12} />}
                  </button>
                )}
              </div>
            </div>
            <div style={{ position: 'relative' }}>
              {isAdmin && (
                <button
                  onClick={() => setUserMenuOpen(userMenuOpen === user.id ? null : user.id)}
                  style={{ background: 'none', border: 'none', color: 'hsla(var(--muted-foreground))', cursor: 'pointer', padding: 4 }}
                >
                  <MoreHorizontal size={16} />
                </button>
              )}
              {userMenuOpen === user.id && (
                <div style={{
                  position: 'absolute', right: 0, top: '100%', marginTop: 4,
                  background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))',
                  borderRadius: 8, padding: 4, zIndex: 10005, minWidth: 160,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                }}>
                  {isAdmin && user.role !== 'Owner' && (
                    <>
                      <button
                        onClick={() => changeRole(user.id, user.role === 'Editor' ? 'Viewer' : 'Editor')}
                        style={{
                          display: 'block', width: '100%', padding: '6px 12px',
                          background: 'transparent', color: 'hsl(var(--foreground))',
                          border: 'none', borderRadius: 4, fontSize: 13, cursor: 'pointer', textAlign: 'left',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'hsla(0,0%,91%,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        Change to {user.role === 'Editor' ? 'Viewer' : 'Editor'}
                      </button>
                      <button
                        onClick={() => removeUser(user.id, user.name)}
                        style={{
                          display: 'block', width: '100%', padding: '6px 12px',
                          background: 'transparent', color: 'hsl(var(--destructive))',
                          border: 'none', borderRadius: 4, fontSize: 13, cursor: 'pointer', textAlign: 'left',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'hsla(0,100%,64%,0.05)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        Remove user
                      </button>
                    </>
                  )}
                  {user.role === 'Owner' && (
                    <div style={{ padding: '6px 12px', fontSize: 12, color: 'hsla(var(--muted-foreground))' }}>
                      Cannot modify owner
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Desktop Connections */}
        <div style={{ marginTop: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>Desktop Connections</h2>
            <span
              style={{
                width: 16, height: 16, borderRadius: '50%',
                border: '1px solid hsla(var(--muted-foreground))',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, color: 'hsla(var(--muted-foreground))', cursor: 'help',
              }}
              title="Shows HAVOC UNLEASH Desktop App connections to this workspace"
            >
              i
            </span>
          </div>
          <div style={{
            padding: '24px', textAlign: 'center',
            border: '1px dashed hsl(var(--border))', borderRadius: 8,
            color: 'hsla(var(--muted-foreground))', fontSize: 13,
          }}>
            No desktop connections. Start the HAVOC UNLEASH Desktop App and enter the server code above.
          </div>
        </div>
      </div>

      {/* Invite collaborator Modal */}
      {inviteModalOpen && (
        <div className="modal-overlay" onClick={() => setInviteModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>Invite collaborator</h3>
              <button onClick={() => setInviteModalOpen(false)} style={{ background: 'none', border: 'none', color: 'hsla(var(--muted-foreground))', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: 'hsla(var(--muted-foreground))', marginBottom: 16 }}>
              Search by name to add a co-broadcaster / co-helper. They&apos;ll be able to open this room and help with scores &amp; edits.
            </p>

            {/* Search */}
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsla(var(--muted-foreground))' }} />
              <input
                className="input-field"
                placeholder="Search people…"
                value={inviteQuery}
                onChange={e => runInviteSearch(e.target.value)}
                style={{ paddingLeft: 32, width: '100%' }}
              />
            </div>

            {/* Role selector */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {['Editor', 'Viewer'].map(r => (
                <button
                  key={r}
                  onClick={() => setInviteRole(r)}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 13, cursor: 'pointer',
                    background: inviteRole === r ? 'hsla(var(--havoc-blue))' : 'transparent',
                    color: inviteRole === r ? 'white' : 'hsla(var(--muted-foreground))',
                    border: `1px solid ${inviteRole === r ? 'transparent' : 'hsl(var(--border))'}`,
                  }}
                >
                  {r}
                </button>
              ))}
            </div>

            {inviteError && <p style={{ fontSize: 12, color: 'hsl(var(--destructive))', marginBottom: 12 }}>{inviteError}</p>}

            {/* Results */}
            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
              {inviteQuery.trim() && inviteResults.length === 0 ? (
                <p style={{ fontSize: 13, color: 'hsla(var(--muted-foreground))', padding: '12px 0', textAlign: 'center' }}>
                  No people found.
                </p>
              ) : inviteResults.map(p => (
                <div
                  key={p.id}
                  onClick={() => doInvite(p)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderRadius: 8,
                    cursor: 'pointer', borderBottom: '1px solid hsl(var(--border))', opacity: inviteBusy ? 0.6 : 1,
                  }}
                  onMouseEnter={e => { if (!inviteBusy) e.currentTarget.style.background = 'hsla(0,0%,91%,0.05)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  {p.avatar_url ? (
                    <img src={p.avatar_url} alt="" className="squircle" style={{ width: 36, height: 36, objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div className="squircle" style={{ width: 36, height: 36, background: 'hsl(var(--havoc-blue))', fontSize: 13, color: 'white', flexShrink: 0 }}>
                      {(p.display_name || '?').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14 }}>{p.display_name || 'Unnamed'}</div>
                    <div style={{ fontSize: 12, color: 'hsla(var(--muted-foreground))', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.player_id || p.discord_id || p.id}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: 'hsla(var(--muted-foreground))' }}>
                    {inviteBusy ? 'Adding…' : 'Add'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
