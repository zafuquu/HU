import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface InvitePlayer {
  id: string
  alias: string
  riotId: string
  avatarUrl: string | null
}

/**
 * P4: player-facing camera invite page — BLOB's "CLICK YOUR NAME" flow.
 * The producer copies `/webcams/invite/:roomId/:teamId` (roster link) to the
 * team; each player opens it, clicks their alias, and lands on the existing
 * publisher page (`/webcams/invite/:roomId/:teamId/:slotId`, slotId = player id).
 * Publicly readable through the broadcast-room:{roomId} row — no login needed.
 */
export default function WebcamInvite() {
  const { roomId, teamId } = useParams<{ roomId: string; teamId: string }>()
  const navigate = useNavigate()
  const [players, setPlayers] = useState<InvitePlayer[]>([])
  const [teamName, setTeamName] = useState('Your Team')
  const [teamLogo, setTeamLogo] = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await supabase.from('broadcast-room').select('value').eq('id', roomId).maybeSingle()
        const value: any = data?.value
        const teams: any[] = Array.isArray(value?.teams) ? value.teams : []
        const team = teams.find((t: any) => String(t.id) === String(teamId))
        if (!team) {
          if (!cancelled) setStatus('missing')
          return
        }
        if (!cancelled) {
          setTeamName(team.name || 'Your Team')
          setTeamLogo(team.logoUrl || null)
          setPlayers(
            (team.players || []).map((p: any) => ({
              id: String(p.id),
              alias: p.alias || p.riotId || 'Player',
              riotId: p.riotId || '',
              avatarUrl: p.avatarUrl || null,
            })),
          )
          setStatus('ready')
        }
      } catch {
        if (!cancelled) setStatus('missing')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [roomId, teamId])

  return (
    <div style={{ minHeight: '100vh', background: '#111214', color: '#e7e7e7', fontFamily: 'system-ui, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>{teamName}</h1>
        <p style={{ color: '#9ca3af', fontSize: 14, marginBottom: 22 }}>Click your name to put your camera on the broadcast</p>

        {status === 'loading' && <p style={{ color: '#6b7280', fontSize: 14 }}>Loading roster…</p>}
        {status === 'missing' && (
          <p style={{ color: '#f59e0b', fontSize: 14 }}>
            Roster not found. Ask your producer for a fresh invite link.
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {status === 'ready' &&
            players.map(p => (
              <button
                key={p.id}
                onClick={() => navigate(`/webcams/invite/${roomId}/${teamId}/${p.id}`)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: '#15171a', color: '#e7e7e7', border: '1px solid #2a2d33', borderRadius: 10, padding: '12px 16px', fontSize: 15, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}
              >
                {/* Avatar fallback chain: player avatar → team logo → alias initial */}
                {(() => {
                  const src = p.avatarUrl || teamLogo
                  if (src) {
                    return (
                      <img
                        src={src}
                        alt=""
                        onError={e => {
                          const el = e.currentTarget
                          if (teamLogo && el.src !== teamLogo) el.src = teamLogo
                          else el.style.display = 'none'
                        }}
                        style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', background: '#22262b' }}
                      />
                    )
                  }
                  return (
                    <span style={{ width: 34, height: 34, borderRadius: '50%', background: '#22262b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>
                      {p.alias.slice(0, 1).toUpperCase()}
                    </span>
                  )
                })()}
                <span>{p.alias}</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  )
}
