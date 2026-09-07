import { useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { createTournament } from '../lib/dataLayer'
import { useAuth } from '../lib/useAuth'

export default function NewTournament() {
  const navigate = useNavigate()
  const { profile, isAdmin } = useAuth()
  const [form, setForm] = useState<Record<string, string | number>>({ title: '', game: 'Valorant', prize: '', location: 'Online', status: 'Upcoming', date: '', max_teams: 8 })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Only admins may create events. Non-admins are sent back to their home page.
  if (profile && !isAdmin) {
    window.location.href = '/app'
    return null
  }

  const set = (k: string) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((p) => ({ ...p, [k]: e.target.value }))

  const submit = async () => {
    if (!String(form.title).trim()) { setError('Title is required'); return }
    setBusy(true); setError(null)
    try {
      await createTournament(form)
      navigate('/app')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally { setBusy(false) }
  }

  const input = 'h-10 w-full rounded-lg border border-white/10 bg-[#1c1e22] px-3 text-sm outline-none focus:border-white/30'
  const label = 'mb-1 block text-xs text-white/50 font-medium'

  return (
    <div className='min-h-screen w-full bg-[#0d0e10] text-white'>
      <div className='mx-auto max-w-lg px-8 py-10'>
        <h1 className='mb-6 text-2xl font-semibold'>New Tournament</h1>
        <div className='space-y-4'>
          <div>
            <label className={label}>Title</label>
            <input className={input} value={form.title} onChange={set('title')} placeholder='Tournament name' />
          </div>
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className={label}>Game</label>
              <input className={input} value={form.game} onChange={set('game')} />
            </div>
            <div>
              <label className={label}>Status</label>
              <select className={input} value={form.status} onChange={set('status')}>
                <option value='Upcoming'>Upcoming</option>
                <option value='Live'>Live</option>
                <option value='Completed'>Completed</option>
              </select>
            </div>
          </div>
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className={label}>Date</label>
              <input className={input} value={form.date} onChange={set('date')} placeholder='10/28/2024' />
            </div>
            <div>
              <label className={label}>Location</label>
              <input className={input} value={form.location} onChange={set('location')} />
            </div>
          </div>
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className={label}>Prize</label>
              <input className={input} value={form.prize} onChange={set('prize')} />
            </div>
            <div>
              <label className={label}>Max Teams</label>
              <input className={input} type='number' value={form.max_teams} onChange={(e) => setForm((p) => ({ ...p, max_teams: Number(e.target.value) }))} />
            </div>
          </div>
          {error && <p className='text-sm text-red-400'>{error}</p>}
          <div className='flex gap-3'>
            <button onClick={submit} disabled={busy} className='h-10 flex-1 rounded-lg bg-white text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-50'>
              {busy ? 'Creating...' : 'Create Tournament'},
            </button>
            <button onClick={() => navigate('/app')} className='h-10 rounded-lg border border-white/10 px-4 text-sm text-white/70 hover:bg-white/5'>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}
