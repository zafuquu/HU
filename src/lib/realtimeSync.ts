import { useEffect } from 'react'
import { useAppStore } from '../store/AppContext'
import { supabase } from './supabase'
import { classifyRemote, displayScore } from './workingProtocol'
import { loadBroadcastState } from './dataLayer'

/** Per-key trackers for classifyRemote() — one per broadcast workspace key. */
const revTrackers = new Map<string, { rev: number; sub: string }>()

/**
 * Subscribes to Supabase Realtime for the connected tournament's tables so that any
 * change pushed to Supabase (from any client) is reflected in the replica's AppContext
 * immediately â€” scores, series, teams, sponsors, matches. Mirrors the original's
 * socket-provider live-update behavior.
 *
 * NOTE: Realtime must be enabled on these tables first â€” run the `alter publication`
 * statements in scratch/phaseB/b2_rls_migration.sql.
 */
export function useRealtimeSync() {
  const { state, setStateSilent, isDirtyNow } = useAppStore()
  const tournamentId = state.connectedTournamentId

  useEffect(() => {
    if (!tournamentId) return

    // 1) tournament_matches: live scores / series / format
    //    P1 score model: the match row feeds derivedScore; displayed scoreA/B
    //    resolves override ?? derived ?? last-known (see workingProtocol).
    const matches = supabase
      .channel('realtime-matches')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tournament_matches',
          filter: 'tournament_id=eq.' + tournamentId,
        },
        (payload) => {
          const row = payload.new as any
          if (!row) return
          setStateSilent((prev) => {
            const dA = row.team1_score ?? prev.derivedScoreA ?? null
            const dB = row.team2_score ?? prev.derivedScoreB ?? null
            return {
              ...prev,
              derivedScoreA: dA,
              derivedScoreB: dB,
              scoreA: displayScore(prev.scoreOverrideA, dA, prev.scoreA),
              scoreB: displayScore(prev.scoreOverrideB, dB, prev.scoreB),
              matchFormat: row.format ?? prev.matchFormat,
            }
          })
        }
      )
      .subscribe()

    // 2) teams channel REMOVED: rosters are broadcast personas carried by
    //    the room havoc. The teams-table realtime channel only resurrected
    //    zombie rows and corrupted rosters with empty players/colors.
    // 3) sponsors: live list
    const sponsors = supabase
      .channel('realtime-sponsors')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sponsors' }, () => {
        supabase.from('sponsors').select('*').then(({ data }) => {
          if (!data) return
          setStateSilent((prev) => ({
            ...prev,
            sponsors: data.map((s) => ({
              id: (s as any).id,
              name: (s as any).name || '',
              type: 'Co-Sponsor',
              imageUrl: (s as any).image_url || null,
              isDefault: false,
            })),
          }))
        })
      })
      .subscribe()

    // 4) tournaments: live name/status/etc.
    const tournament = supabase
      .channel('realtime-tournament')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tournaments', filter: 'id=eq.' + tournamentId },
        (payload) => {
          const row = payload.new as any
          if (!row) return
          setStateSilent((prev) => ({ ...prev, connectedTournamentName: row.title || prev.connectedTournamentName }))
        }
      )
      .subscribe()

    // 5) broadcast workspace havoc: live sync for teams, players, veto, and titles across all devices
    //    P1: classify every incoming snapshot (same/stale/apply/conflict) — this
    //    used to be a blind {...prev, ...remote} merge that let stale writers win.
    const broadcast = supabase
      .channel('realtime-broadcast-' + tournamentId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_settings', filter: 'id=eq.broadcast:' + tournamentId },
        (payload) => {
          const remote = (payload.new as any)?.value
          if (!remote || typeof remote !== 'object') return
          const key = 'broadcast:' + tournamentId
          const tracker = revTrackers.get(key) || { rev: 0, sub: '' }
          const verdict = classifyRemote(remote, tracker)
          tracker.rev = Math.max(tracker.rev, Number(remote._rev || 0))
          if (verdict === 'apply' || verdict === 'conflict') tracker.sub = String(remote._sub || '')
          revTrackers.set(key, tracker)
          if (verdict === 'same' || verdict === 'stale') return
          if (isDirtyNow()) {
            // Local edits in progress — never clobber (the save bar surfaces
            // the room-key conflict; explicit Save re-bumps beyond this rev).
            console.debug('[sync] broadcast snapshot newer but local edits pending — skipped', remote._rev)
            return
          }
          if (verdict === 'conflict') {
            // Two writers landed on the same _rev: refetch the authoritative row.
            loadBroadcastState(tournamentId).then((fresh) => {
              if (!fresh || typeof fresh !== 'object' || isDirtyNow()) return
              const t2 = revTrackers.get(key) || { rev: 0, sub: '' }
              if (classifyRemote(fresh, t2) === 'stale') return
              revTrackers.set(key, { rev: Number((fresh as any)._rev || 0), sub: String((fresh as any)._sub || '') })
              mergeBroadcast(fresh)
            }).catch(() => {})
            return
          }
          mergeBroadcast(remote)
        }
      )
      .subscribe()

    const mergeBroadcast = (remote: any) => {
      setStateSilent((prev) => {
        const merged: any = { ...prev, ...remote }
        const seen = new Set<string>()
        merged.teams = (merged.teams || []).filter((t: any) => {
          const k = String(t?.id ?? t?.name ?? Math.random())
          if (seen.has(k)) return false
          seen.add(k)
          return true
        })
        return merged
      })
    }

    return () => {
      supabase.removeChannel(matches)
      supabase.removeChannel(sponsors)
      supabase.removeChannel(tournament)
      supabase.removeChannel(broadcast)
    }
  }, [tournamentId, setStateSilent])

  return null
}
