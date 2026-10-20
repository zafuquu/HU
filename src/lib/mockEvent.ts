// ============================================================================
// TEMPORARY local-test scaffolding — created for offline browser testing of
// P1–P6 (Discord OAuth serverless proxy returns 502 locally). Remove this
// file together with the mock blocks in useAuth.tsx, AppContext.tsx,
// TournamentsHome.tsx, Overview.tsx and the .env.local file when Discord
// login is reinstated.
// ============================================================================
export const MOCK_AUTH = (import.meta as any).env?.VITE_MOCK_AUTH === '1'
export const MOCK_EVENT = (import.meta as any).env?.VITE_MOCK_EVENT === '1'

/** Synthetic dashboard event — clickable card in My Events → opens the workspace. */
export const MOCK_TOURNAMENT = {
  id: 'mock-event',
  title: 'HU Local Test Cup',
  game: 'Valorant',
  status: 'Live',
  date: '2026-10-19',
  prize: 'N/A',
  location: 'Online',
  max_teams: 8,
  image_url: 'https://variety.com/wp-content/uploads/2024/08/valorant.png',
}

/** Signed-in admin profile so AuthGate passes and admin-only UI unlocks. */
export const MOCK_PROFILE = {
  id: 'mock-user',
  discord_id: '000000000000000000',
  player_id: 'LocalTester',
  role: 'admin',
  badges: ['Admin', 'Owner'],
  display_name: 'Local Tester',
  avatar_url: null as string | null,
}
