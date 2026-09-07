import { supabase, type Tournament, type Team, type TeamMember, type Sponsor, type TournamentMatch, type TournamentParticipant, type Profile } from './supabase'

// ===== Tournaments =====
export async function listTournaments(): Promise<Tournament[]> {
  const { data } = await supabase
    .from('tournaments')
    .select('*')
    .order('sort_order', { ascending: true })
  return (data as Tournament[]) || []
}

export async function getTournament(id: string): Promise<Tournament | null> {
  const { data } = await supabase.from('tournaments').select('*').eq('id', id).maybeSingle()
  return (data as Tournament) || null
}

export async function createTournament(input: Partial<Tournament>): Promise<Tournament | null> {
  const { data, error } = await supabase
    .from('tournaments')
    .insert({ status: 'Upcoming', ...input })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return (data as Tournament) || null
}

export async function updateTournament(id: string, input: Partial<Tournament>): Promise<Tournament | null> {
  const { data, error } = await supabase.from('tournaments').update(input).eq('id', id).select().maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Tournament) || null
}

export async function deleteTournament(id: string): Promise<void> {
  const { error } = await supabase.from('tournaments').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ===== Teams =====
export async function listTeams(): Promise<Team[]> {
  const { data } = await supabase.from('teams').select('*')
  return (data as Team[]) || []
}

// ===== Tournament participants (team <-> tournament registration) =====
export async function addTournamentParticipant(input: Partial<TournamentParticipant>): Promise<TournamentParticipant | null> {
  const { data, error } = await supabase.from('tournament_participants').insert(input).select().single()
  if (error) throw new Error(error.message)
  return (data as TournamentParticipant) || null
}

export async function listTournamentParticipants(tournamentId: string): Promise<TournamentParticipant[]> {
  const { data } = await supabase
    .from('tournament_participants')
    .select('*')
    .eq('tournament_id', tournamentId)
  return (data as TournamentParticipant[]) || []
}

/**
 * Load only the teams that are REGISTERED for the given tournament AND match its
 * game. Because `tournament_participants` (team_id rows) is the join that records
 * registration, an empty participants table means no teams show up —
 * fixing the bug where "every team appears for every tournament".
 */
export async function listTeamsForTournament(tournamentId: string, game?: string | null): Promise<Team[]> {
  const [participants, allTeams] = await Promise.all([
    listTournamentParticipants(tournamentId),
    supabase.from('teams').select('*'),
  ])
  const all = (allTeams.data as Team[]) || []
  const registeredIds = new Set((participants || []).map(p => p.team_id).filter(Boolean))
  // No team is registered for this tournament -> show no teams at all.
  if (registeredIds.size === 0) return []
  const gameNorm = (game || '').trim().toLowerCase()
  return all.filter(t => {
    if (!registeredIds.has(t.id)) return false
    if (gameNorm && (t.game || '').trim().toLowerCase() !== gameNorm) return false
    return true
  })
}

// ===== Roster (team_members + profiles) =====
/**
 * Returns a team's roster: each team_members row joined with its linked profile
 * (name / IGN / avatar / player id), so the replica auto-populates players that
 * are already registered in Supabase — no manual one-by-one entry required.
 */
export async function listTeamRoster(teamId: string): Promise<{ member: TeamMember; profile: Profile | null }[]> {
  const { data } = await supabase.from('team_members').select('*').eq('team_id', teamId)
  const members = (data as TeamMember[]) || []
  const ids = members.map(m => m.user_id).filter((x): x is string => !!x)
  let profiles: Profile[] = []
  if (ids.length) {
    const { data: p } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, ign, player_id')
      .in('id', ids)
    profiles = (p as Profile[]) || []
  }
  const byId = new Map(profiles.map(pr => [pr.id, pr]))
  return members.map(m => ({ member: m, profile: byId.get(m.user_id || '') || null }))
}

// ===== Profiles (real users for the "Users" panel) =====
export async function listProfiles(): Promise<Profile[]> {
  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, discord_id, player_id, role, badges, avatar_url')
    .order('display_name', { ascending: true })
  return (data as Profile[]) || []
}

/**
 * The users who can ACCESS the tournament room: the admins/owners (who own it)
 * plus any user linked to it through registered teams (tournament_participants.
 * user_id). This is the intended "Users / invited" panel for a single event —
 * NOT the entire profiles table.
 */
export async function listTournamentUsers(tournamentId: string): Promise<Profile[]> {
  const participants = (await listTournamentParticipants(tournamentId)) || []
  const participantUserIds = participants.map(p => p.user_id).filter(Boolean) as string[]
  const { data: admins } = await supabase
    .from('profiles')
    .select('id, display_name, discord_id, player_id, role, badges, avatar_url')
    .eq('role', 'admin')
  const ids = new Set<string>([...(admins || []).map(a => a.id), ...participantUserIds])
  if (ids.size === 0) return []
  const { data: users } = await supabase
    .from('profiles')
    .select('id, display_name, discord_id, player_id, role, badges, avatar_url')
    .in('id', [...ids])
  return (users as Profile[]) || []
}

// ===== Room access / membership =====
/**
 * Returns the ids of the tournaments a user is a participant/member of, via
 * tournament_participants.user_id. Used to decide which rooms a non-admin
 * collaborator may open. Admins bypass this (they can open every room).
 */
export async function listUserParticipatedTournamentIds(userId: string): Promise<string[]> {
  if (!userId) return []
  const { data } = await supabase
    .from('tournament_participants')
    .select('tournament_id')
    .eq('user_id', userId)
  return (data || []).map(p => (p as any).tournament_id as string).filter(Boolean)
}

/**
 * Server-side inviter — the actual insert runs on the auth server (service role)
 * so RLS never blocks it, and the server verifies the caller is an admin.
 */
export async function inviteRoomMember(tournamentId: string, userId: string, role = 'Editor'): Promise<void> {
  const res = await fetch(`/api/room/${encodeURIComponent(tournamentId)}/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, role }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as any).error || 'Invite failed')
  }
}

/** Server-side removal of an invited member from a room. */
export async function removeRoomMember(tournamentId: string, userId: string): Promise<void> {
  const res = await fetch(`/api/room/${encodeURIComponent(tournamentId)}/remove`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as any).error || 'Remove failed')
  }
}

/** Search profiles by display name / discord id for the invite picker. */
export async function searchProfiles(query: string): Promise<Profile[]> {
  const q = query.trim()
  if (!q) return []
  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, discord_id, player_id, role, badges, avatar_url')
    .ilike('display_name', `%${q}%`)
    .order('display_name', { ascending: true })
    .limit(20)
  return (data as Profile[]) || []
}

export async function createTeam(input: Partial<Team>): Promise<Team | null> {
  const { data, error } = await supabase.from('teams').insert(input).select().single()
  if (error) throw new Error(error.message)
  return (data as Team) || null
}

export async function updateTeam(id: string, input: Partial<Team>): Promise<Team | null> {
  const { data, error } = await supabase.from('teams').update(input).eq('id', id).select().maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Team) || null
}

export async function deleteTeam(id: string): Promise<void> {
  const { error } = await supabase.from('teams').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ===== Team members =====
export async function listTeamMembers(teamId?: string): Promise<TeamMember[]> {
  let q = supabase.from('team_members').select('*')
  if (teamId) q = q.eq('team_id', teamId)
  const { data } = await q
  return (data as TeamMember[]) || []
}

export async function addTeamMember(input: Partial<TeamMember>): Promise<TeamMember | null> {
  const { data, error } = await supabase.from('team_members').insert(input).select().single()
  if (error) throw new Error(error.message)
  return (data as TeamMember) || null
}

export async function updateTeamMember(id: string, input: Partial<TeamMember>): Promise<TeamMember | null> {
  const { data, error } = await supabase.from('team_members').update(input).eq('id', id).select().maybeSingle()
  if (error) throw new Error(error.message)
  return (data as TeamMember) || null
}

export async function removeTeamMember(id: string): Promise<void> {
  const { error } = await supabase.from('team_members').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ===== Sponsors =====
export async function listSponsors(): Promise<Sponsor[]> {
  const { data } = await supabase.from('sponsors').select('*')
  return (data as Sponsor[]) || []
}

export async function createSponsor(input: Partial<Sponsor>): Promise<Sponsor | null> {
  const { data, error } = await supabase.from('sponsors').insert(input).select().single()
  if (error) throw new Error(error.message)
  return (data as Sponsor) || null
}

export async function updateSponsor(id: string, input: Partial<Sponsor>): Promise<Sponsor | null> {
  const { data, error } = await supabase.from('sponsors').update(input).eq('id', id).select().maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Sponsor) || null
}

export async function deleteSponsor(id: string): Promise<void> {
  const { error } = await supabase.from('sponsors').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ===== Tournament matches =====
export async function listMatches(tournamentId: string): Promise<TournamentMatch[]> {
  const { data } = await supabase.from('tournament_matches').select('*').eq('tournament_id', tournamentId)
  return (data as TournamentMatch[]) || []
}

export async function updateMatch(id: string, input: Partial<TournamentMatch>): Promise<TournamentMatch | null> {
  const { data, error } = await supabase.from('tournament_matches').update(input).eq('id', id).select().maybeSingle()
  if (error) throw new Error(error.message)
  return (data as TournamentMatch) || null
}

// ===== Persist current live-match state =====
/**
 * Persists scoreline / series / format changes from the replica back to the
 * connected tournament's match row in Supabase. If no match row exists yet for
 * the tournament, it creates one. Wrapped in try/catch by callers so a missing
 * column or RLS constraint surfaces as a toast instead of crashing the UI.
 */
export async function persistMatchScore(
  tournamentId: string,
  patch: {
    team1_score?: number
    team2_score?: number
    series_score_a?: number
    series_score_b?: number
    format?: string
    team1_id?: string
    team2_id?: string
    round_title?: string
  }
): Promise<TournamentMatch | null> {
  const existing = await supabase
    .from('tournament_matches')
    .select('id')
    .eq('tournament_id', tournamentId)
    .order('created_at', { ascending: true })
    .limit(1)

  if (existing.data && existing.data.length > 0) {
    return updateMatch(existing.data[0].id as string, patch)
  }

  const created = await supabase
    .from('tournament_matches')
    .insert({ tournament_id: tournamentId, ...patch })
    .select()
    .single()

  if (created.error) throw new Error(created.error.message)
  return (created.data as TournamentMatch) || null
}

// ===== Broadcast state (site_settings jsonb) =====
/** Saves the whole broadcast/app state for a tournament into site_settings so it
 *  survives refresh and is shared across devices (server-typed as jsonb). */
export async function saveBroadcastState(tournamentId: string, value: unknown): Promise<void> {
  const key = `broadcast:${tournamentId}`
  const { error } = await supabase
    .from('site_settings' as any)
    .upsert({ id: key, value }, { onConflict: 'id' })
  if (!error) return

  // Fallback: same-origin Vercel function with service key (bypasses RLS).
  try {
    const res = await fetch('/api/broadcast-room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentId, value }),
    })
    if (res.ok) return
  } catch { /* best-effort fallback */ }

  throw new Error(error.message)
}

/** Saves the broadcast workspace keyed by SERVER CODE (room code) so any device
 *  joining that room sees the same rosters/scores — no tournament required. */
export async function loadRoomBroadcast(serverCode: string): Promise<unknown | null> {
  try {
    const { data } = await supabase
      .from('site_settings')
      .select('value')
      .eq('id', `broadcast-room:${serverCode}`)
      .maybeSingle()
    return (data?.value as unknown) ?? null
  } catch {
    return null
  }
}

export async function saveRoomBroadcast(serverCode: string, value: unknown): Promise<void> {
  const key = `broadcast-room:${serverCode}`
  const { error } = await supabase
    .from('site_settings' as any)
    .upsert({ id: key, value }, { onConflict: 'id' })
  if (!error) return

  // Fallback 1: same-origin Vercel function (cookie session + service key).
  // Works whenever signed into the website - no Supabase JWT needed.
  try {
    const res2 = await fetch('/api/broadcast-room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverCode, value }),
    })
    if (res2.ok) return
  } catch { /* ignore */ }

  // Fallback 2: cloud bridge with a Supabase JWT (only when one exists).
  const bridge = (import.meta as any).env?.VITE_BRIDGE_ORIGIN || 'https://hu-bridge.onrender.com'
  const { data: sess } = await supabase.auth.getSession()
  const jwt = sess?.session?.access_token
  if (!jwt) throw new Error(error.message)
  const res = await fetch(`${bridge}/broadcast-room`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({ serverCode, value }),
  })
  if (!res.ok) throw new Error(`bridge save failed: ${res.status}`)
}

/** Loads a previously-saved broadcast state for a tournament from site_settings. */
export async function loadBroadcastState(tournamentId: string): Promise<unknown | null> {
  const key = `broadcast:${tournamentId}`
  const { data, error } = await supabase
    .from('site_settings' as any)
    .select('value')
    .eq('id', key)
    .maybeSingle()
  if (error) return null
  return (data as { value?: unknown } | null)?.value ?? null
}
