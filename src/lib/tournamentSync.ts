import { useEffect } from 'react'
import { useAppStore, makeTournamentServerCode, type Team as AppTeam, type AppState } from '../store/AppContext'
import { useAuth } from './useAuth'
import {
  getTournament,
  listTeamsForTournament,
  listSponsors,
  listMatches,
  listTeamRoster,
  loadBroadcastState,
  saveRoomBroadcast,
} from './dataLayer'
import type { Tournament } from './supabase'
import { displayScore, stampEnvelope } from './workingProtocol'

/**
 * Keeps the replica's in-memory state in sync with the connected Supabase tournament.
 * When `connectedTournamentId` is set (via Overview "Connect"), it loads that
 * tournament's saved workspace havoc (broadcast:<id>), teams, members, sponsors and matches
 * into AppContext so downstream pages (Teams & Players, Tournament, Live Game, OBS) populate automatically.
 */
export function TournamentSync() {
  const { state, setStateSilent } = useAppStore()
  const { status } = useAuth()

  useEffect(() => {
    if (status !== 'signedIn') return
    const id = state.connectedTournamentId
    if (!id) return

    let cancelled = false

    const load = async () => {
      try {
        const [t, saved, teams, sponsors, matches] = await Promise.all([
          getTournament(id) as Promise<Tournament | null>,
          loadBroadcastState(id) as Promise<Partial<AppState> | null>,
          listTeamsForTournament(id),
          listSponsors(),
          listMatches(id),
        ])

        if (cancelled) return

        const mappedTeams: AppTeam[] = []

        for (const realTeam of teams) {
          let roster: { member: { id: string; user_id?: string | null }; profile: { display_name?: string | null; ign?: string | null; avatar_url?: string | null; player_id?: string | null } | null }[] = []
          try { roster = await listTeamRoster(realTeam.id) } catch { roster = [] }
          mappedTeams.push({
            id: realTeam.id,
            name: realTeam.name ?? '',
            tag: '',
            description: realTeam.description ?? '',
            color: '#ef4444',
            color2: '#3b82f6',
            logoUrl: realTeam.logo_url ?? null,
            logoSecondaryUrl: null,
            logoTertiaryUrl: null,
            players: roster.map(r => {
              const alias = r.profile?.display_name?.trim() || r.profile?.ign?.trim() || ''
              return {
                id: r.member.id,
                riotId: r.profile?.player_id || '',
                alias: alias || 'Player',
                webcamSource: 'None' as const,
                avatarUrl: r.profile?.avatar_url || null,
                photoUrl: null,
              }
            }),
          })
        }

        setStateSilent(prev => {
          // If we have a saved broadcast havoc from Supabase, merge it first
          const base: AppState = saved && typeof saved === 'object'
            ? { ...prev, ...(saved as Partial<AppState>) }
            : prev

          // Combine DB registered teams with saved/local teams
          const dbIds = new Set(mappedTeams.map(m => m.id))
          const existingTeams = (base.teams || []).filter(item => !dbIds.has(item.id))
          const mergedTeams = [...existingTeams, ...mappedTeams]

          // Deduplicate teams by ID
          const seen = new Set<string>()
          const dedupedTeams = mergedTeams.filter(team => {
            const k = String(team?.id ?? team?.name ?? Math.random())
            if (seen.has(k)) return false
            seen.add(k)
            return true
          })

          return {
            ...base,
            teams: dedupedTeams,
            connectedTournamentId: id,
            connectedTournamentName: t?.title ?? base.connectedTournamentName ?? id,
            connectedTournamentGame: t?.game ?? base.connectedTournamentGame,
            serverCode: (() => {
              // Unique, stable server code per event: each connected tournament
              // gets its own HAVOC code, persisted IMMEDIATELY (the autosave
              // only fires on user edits, so without this explicit write the
              // assignment would be lost on refresh and the code would rotate).
              const roomCodes: Record<string, string> = {
                ...((base as { roomServerCodes?: Record<string, string> }).roomServerCodes || {}),
              }
              let code = roomCodes[id]
              if (!code) {
                // First event ever connected in this workspace inherits the
                // workspace's original code, so the desktop app configured for
                // it keeps working without changes.
                const legacyClaimed = localStorage.getItem('havoc-legacy-room-claimed') === '1'
                code =
                  !legacyClaimed && base.serverCode && base.serverCode.startsWith('HAVOC-')
                    ? base.serverCode
                    : makeTournamentServerCode(id)
                roomCodes[id] = code
                localStorage.setItem('havoc-legacy-room-claimed', '1')
                try {
                  const snapshot = localStorage.getItem('havoc-app-state-v1')
                  const parsed = snapshot ? JSON.parse(snapshot) : {}
                  parsed.roomServerCodes = roomCodes
                  parsed.serverCode = code
                  localStorage.setItem('havoc-app-state-v1', JSON.stringify(parsed))
                } catch { /* best-effort */ }
              }
              // Publish the room havoc under this event's code so overlays work.
              // P1: stamp a real envelope — the old hardcoded `_rev: 1` made this
              // write look STALE to every reader and it was silently ignored.
              void saveRoomBroadcast(
                code,
                stampEnvelope(
                  { ...(saved || {}), ...base, connectedTournamentId: id },
                  Math.max(Date.now(), Number((base as any)._rev || 0) + 1),
                ),
              ).catch(() => {})
              return code
            })(),
            roomServerCodes: (() => {
              const roomCodes: Record<string, string> = {
                ...((base as { roomServerCodes?: Record<string, string> }).roomServerCodes || {}),
              }
              if (!roomCodes[id]) roomCodes[id] = makeTournamentServerCode(id)
              return roomCodes
            })(),
            sponsors: sponsors.length > 0
              ? sponsors.map(s => ({
                  id: s.id,
                  name: s.name ?? '',
                  type: 'Co-Sponsor',
                  imageUrl: s.image_url ?? null,
                  isDefault: false,
                }))
              : (base.sponsors || prev.sponsors),
            // P1 score model: match row = derived; displayed honors any manual override.
            derivedScoreA: matches[0]?.team1_score ?? base.derivedScoreA ?? prev.derivedScoreA ?? null,
            derivedScoreB: matches[0]?.team2_score ?? base.derivedScoreB ?? prev.derivedScoreB ?? null,
            scoreA: displayScore(
              prev.scoreOverrideA ?? (base as any)?.scoreOverrideA ?? null,
              matches[0]?.team1_score ?? (base as any)?.derivedScoreA ?? null,
              base.scoreA ?? prev.scoreA,
            ),
            scoreB: displayScore(
              prev.scoreOverrideB ?? (base as any)?.scoreOverrideB ?? null,
              matches[0]?.team2_score ?? (base as any)?.derivedScoreB ?? null,
              base.scoreB ?? prev.scoreB,
            ),
            matchFormat: matches[0]?.format ?? base.matchFormat ?? prev.matchFormat,
          }
        })
      } catch (e) {
        console.error('TournamentSync load failed:', e)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [state.connectedTournamentId, status, setStateSilent])

  return null
}
