import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn('Supabase env vars (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) are not set.')
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
)

export type Profile = {
  id: string
  discord_id?: string | null
  display_name?: string | null
  bio?: string | null
  avatar_url?: string | null
  role?: string | null
  ign?: string | null
  player_id?: string | null
  badges?: string[] | null
  region?: string | null
  twitch_url?: string | null
  twitter_url?: string | null
  youtube_url?: string | null
}

export type Tournament = {
  id: string
  status?: string | null
  badge_color?: string | null
  title?: string | null
  date?: string | null
  cta?: string | null
  image_url?: string | null
  created_at?: string | null
  game?: string | null
  prize?: string | null
  max_teams?: number | null
  location?: string | null
  start_time?: string | null
  end_time?: string | null
  alerted_24h?: boolean | null
  alerted_12h?: boolean | null
  entry_fee?: number | null
  payment_instructions?: string | null
  sort_order?: number | null
  has_giveaway?: boolean | null
  sponsors?: any[] | null
}

export type Team = {
  id: string
  name?: string | null
  game?: string | null
  owner_id?: string | null
  logo_url?: string | null
  description?: string | null
  created_at?: string | null
  updated_at?: string | null
  team_elo?: number | null
  tournament_rating?: number | null
  badges?: string[] | null
  organization_id?: string | null
}

export type TeamMember = {
  id: string
  team_id: string
  user_id: string
  role?: string | null
  created_at?: string | null
  is_active?: boolean | null
}

export type Sponsor = {
  id: string
  name?: string | null
  url?: string | null
  image_url?: string | null
  created_at?: string | null
}

export type TournamentMatch = {
  id: string
  tournament_id?: string | null
  round?: number | null
  match_index?: number | null
  team1_id?: string | null
  team2_id?: string | null
  team1_score?: number | null
  team2_score?: number | null
  winner_id?: string | null
  status?: string | null
  next_match_id?: string | null
  custom_team1_name?: string | null
  custom_team2_name?: string | null
  format?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export type LeagueProfile = {
  id: string
  name: string
  role: string
  badges: string[]
}

export type TournamentParticipant = {
  id: string
  tournament_id: string
  team_id?: string | null
  user_id?: string | null
  role?: string | null
}
