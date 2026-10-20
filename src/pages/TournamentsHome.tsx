import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trophy, LogOut } from 'lucide-react'
import { listTournaments, listTournamentParticipants, listUserParticipatedTournamentIds } from '../lib/dataLayer'
import type { Tournament } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { MOCK_EVENT, MOCK_TOURNAMENT } from '../lib/mockEvent'

const HAVOC_URL = 'https://havocunleash.vercel.app/'

const FALLBACK = 'https://variety.com/wp-content/uploads/2024/08/valorant.png'

function statusTone(s: string | null | undefined) {
  const v = (s || '').toLowerCase()
  if (v === 'live') return { bg: '#13352c', fg: '#4ade80' }
  if (v === 'completed') return { bg: '#27272a', fg: '#a1a1aa' }
  return { bg: '#172554', fg: '#93c5fd' }
}

export default function TournamentsHome() {
  const navigate = useNavigate()
  const { profile, isAdmin, isOwner, signOut } = useAuth()
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [participantMap, setParticipantMap] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'All' | 'My Events' | 'Shared With Me'>('All')
  // null = admin (no restriction). A set = the only room ids a non-admin may open.
  const [allowedIds, setAllowedIds] = useState<string[] | null>(null)

  // Determine which rooms the signed-in user may open.
  useEffect(() => {
    if (isAdmin) {
      setAllowedIds(null)
      return
    }
    if (!profile?.id) return
    let cancelled = false
    listUserParticipatedTournamentIds(profile.id)
      .then((ids) => {
        if (cancelled) return
        setAllowedIds(ids)
        // A non-admin with no invited rooms has no access — send them to the public site.
        if (ids.length === 0) {
          window.location.href = HAVOC_URL
        }
      })
      .catch(() => { if (!cancelled) setAllowedIds([]) })
    return () => { cancelled = true }
  }, [isAdmin, profile?.id])

  const visible = isAdmin
    ? tournaments
    : allowedIds ? tournaments.filter(t => allowedIds.includes(t.id)) : []

  const filtered = visible.filter(t => (t.title || '').toLowerCase().includes(search.toLowerCase()))

  useEffect(() => {
    let cancelled = false
    listTournaments()
      .then(async (ts) => {
        if (cancelled) return
        // TEMPORARY mock event (VITE_MOCK_EVENT=1) prepended for local testing.
        const all: Tournament[] = MOCK_EVENT ? [MOCK_TOURNAMENT as unknown as Tournament, ...ts] : ts
        setTournaments(all)
        const map: Record<string, number> = {}
        for (const t of all) {
          if (t.id === MOCK_TOURNAMENT.id) { map[t.id] = 10; continue }
          const parts = await listTournamentParticipants(t.id)
          map[t.id] = parts.length
        }
        setParticipantMap(map)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return (
    <div className='min-h-screen w-full bg-[#0d0e10] text-white'>
      <div className='flex h-screen w-full overflow-x-hidden'>
        {/* ===== Left sidebar (mirrors original dashboard-sidebar) ===== */}
        <div className='h-screen w-60 shrink-0 border-r border-white/5'>
          <div className='flex h-full flex-col p-3'>
            <div className='mb-3 flex items-center justify-between rounded-xl px-2.5 py-2'>
              <div className='flex min-w-0 items-center gap-3'>
                <div className='flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold text-white' style={{ background: 'hsl(var(--havoc-blue))' }}>
                  {(profile?.display_name || 'U').slice(0, 2).toUpperCase()}
                </div>
                <div className='min-w-0'>
                  <div className='truncate text-sm font-medium tracking-wide text-[#e7e7e7]'>{profile?.display_name || 'User'}</div>
                  <div className='truncate text-xs text-[#e7e7e7]/50'>{(isOwner ? 'Owner · ' : '') + (isAdmin ? 'Admin' : 'Member')}</div>
                </div>
              </div>
              <button
                onClick={() => { void signOut() }}
                className='flex items-center gap-1.5 rounded-md border border-white/10 px-2 py-1.5 text-xs text-[#e7e7e7]/50 hover:text-[#e7e7e7] transition-colors'
                title='Sign out'
              >
                <LogOut size={12} />
                <span className='hidden sm:inline'>Sign out</span>
              </button>
            </div>

            <nav className='flex flex-1 flex-col gap-1'>
              <a href='/app' className='flex items-center gap-3 rounded-lg bg-[#1f2123] px-3 py-2.5 text-sm text-[#e7e7e7]'>
                <span className='flex size-5 items-center justify-center'>
                  <svg width='18' height='18' fill='currentColor' viewBox='0 0 256 256'><path d='M224,160v48a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V160a16,16,0,0,1,16-16h72V95.19a40,40,0,1,1,16,0V144h72A16,16,0,0,1,224,160Z' /></svg>
                </span>
                My Events
              </a>
            </nav>

            <div className='space-y-2'>
              <a
                href={HAVOC_URL}
                target='_blank'
                rel='noopener noreferrer'
                className='flex items-center justify-between rounded-lg p-2 text-xs text-[#e7e7e7]/50 hover:text-[#e7e7e7]'
              >
                <span>Havoc Unleash</span><span className='text-[#e7e7e7]/20'>↓</span>
              </a>
              <div className='flex items-center justify-between rounded-lg p-2 text-xs text-[#e7e7e7]/50'><span>Resources</span></div>
              <div className='flex items-center justify-between rounded-lg p-2 text-xs text-[#e7e7e7]/50'><span>Legal</span></div>
            </div>
          </div>
        </div>

        {/* ===== Main column ===== */}
        <div className='flex h-screen flex-1 flex-col overflow-hidden'>

          {/* Top navbar */}
          <div className='px-6 pt-4'>
            <div className='mb-3 flex items-center justify-between'>
              <div className='flex items-center gap-4'>
                <div className='inline-flex size-6.5 items-center justify-center rounded bg-[#e7e7e7]/5'>
                  <span className='text-sm text-[#3697FF]'>●</span>
                </div>
                <nav aria-label='breadcrumb'>
                  <ol className='flex items-center gap-1.5 text-sm'>
                    <li className='text-white'>My Events</li>
                  </ol>
                </nav>
              </div>
              <div className='flex flex-1 items-center justify-end gap-4'>
                <div className='relative w-64'>
                  <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' className='absolute left-2.5 top-1/2 -translate-y-1/2 text-[#e7e7e7]/40'>
                    <circle cx='11' cy='11' r='8' /><path d='m21 21-4.3-4.3' />
                  </svg>
                  <input
                    placeholder='Search'
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className='w-full rounded-lg border border-white/10 bg-[#202224] py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-gray-400 outline-none'
                  />
                </div>
                {isAdmin && (
                  <button
                    onClick={() => navigate('/app/tournaments/new')}
                    className='rounded-lg bg-blue-500/80 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500'
                  >
                    New Event
                  </button>
                )}
              </div>
            </div>
            <div className='mb-2 flex items-center gap-5'>
              {(['All', 'My Events', 'Shared With Me'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`relative pb-1 text-sm ${tab === activeTab ? 'text-white' : 'text-[#e7e7e7]/50 hover:text-[#e7e7e7]'}`}
                >
                  {tab}
                  {tab === activeTab && <span className='absolute bottom-0 left-0 h-0.5 w-full rounded-t-sm bg-[#3697FF]' />}
                </button>
              ))}
            </div>
            <div className='mb-2 h-0.5 bg-linear-to-r from-[#101214] to-[#e4e2e7]/5' />
          </div>

          {/* Event grid */}
          <div className='flex-1 overflow-y-auto px-5 pb-6' style={{ scrollbarWidth: 'none' }}>
            {error && <p className='mb-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400'>{error}</p>}

            {loading ? (
              <div className='flex items-center gap-2 py-16 text-sm text-white/40'>
                <span className='size-4 animate-spin rounded-full border-2 border-white/20 border-t-white' />
                Loading events...
              </div>
            ) : filtered.length === 0 ? (
              <div className='rounded-xl border border-dashed border-white/10 p-16 text-center text-sm text-white/40'>
                {activeTab === 'My Events' ? 'You have no events yet. Create your first one below.' : 'No events here yet.'}
              </div>
            ) : (
              <div>
                <h2 className='mb-2 text-base font-medium text-white'>My Events</h2>
                <div className='grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-2.5'>
                  {filtered.map((t) => {
                    const tone = statusTone(t.status)
                    return (
                      <button
                        key={t.id}
                        onClick={() => navigate('/app/tournaments/' + t.id)}
                        className='group relative block w-full overflow-hidden rounded-xl border border-white/10 bg-[#141618] text-left transition-colors hover:border-white/25'
                      >
                        {/* Compact tiles: auto-fill grid keeps tiles side-by-side at ANY width;
                            thumbnail is a decent size and never stretches the card */}
                        <div className='relative w-full' style={{ paddingBottom: '74%' }}>
                          <div className='absolute inset-0 flex flex-col p-1.5'>
                            <div className='relative h-[56%] w-full shrink-0 overflow-hidden rounded-md bg-black/40'>
                              <img src={t.image_url || FALLBACK} alt={t.title || t.id} className='absolute inset-0 size-full object-contain' />
                            </div>
                            <div className='flex min-h-0 flex-1 flex-col justify-center gap-1.5 px-1 py-1.5'>
                              <div className='flex items-center gap-1.5'>
                                <Trophy size={12} style={{ color: tone.fg }} />
                                <span className='truncate text-xs font-semibold' style={{ color: tone.fg }}>{t.status || 'Upcoming'}</span>
                                {t.game && <span className='ml-auto shrink-0 truncate text-[11px] text-white/40'>{t.game}</span>}
                              </div>
                              <h3 className='max-w-full truncate text-[15px] leading-tight tracking-wide text-[#e7e7e7] transition-colors group-hover:text-white'>{t.title || t.id}</h3>
                              <p className='truncate text-[13px] leading-normal tracking-wide text-[#e7e7e7]/60'>
                                {participantMap[t.id] ? `${participantMap[t.id]} team(s)` : 'Open workspace'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

