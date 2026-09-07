import { useEffect } from 'react'
import { useAppStore } from '../store/AppContext'
import { supabase } from './supabase'

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
  const { state, setStateSilent } = useAppStore()
  const tournamentId = state.connectedTournamentId

  useEffect(() => {
    if (!tournamentId) return

    // 1) tournament_matches: live scores / series / format
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
          setStateSilent((prev) => ({
            ...prev,
            scoreA: row.team1_score ?? prev.scoreA,
            scoreB: row.team2_score ?? prev.scoreB,
            matchFormat: row.format ?? prev.matchFormat,
          }))
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
    const broadcast = supabase
      .channel('realtime-broadcast-' + tournamentId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_settings', filter: 'id=eq.broadcast:' + tournamentId },
        (payload) => {
          const remote = (payload.new as any)?.value
          if (!remote || typeof remote !== 'object') return
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
      )
      .subscribe()

    return () => {
      supabase.removeChannel(matches)
      supabase.removeChannel(sponsors)
      supabase.removeChannel(tournament)
      supabase.removeChannel(broadcast)
    }
  }, [tournamentId, setStateSilent])

  return null
}
