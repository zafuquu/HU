import { createContext, useContext, useState, useEffect, useRef, type ReactNode, useCallback } from 'react'
import { updateSponsor as apiUpdateSponsor, deleteSponsor as apiDeleteSponsor, listTournamentUsers, saveBroadcastState as apiSaveBroadcastState, saveRoomBroadcast as apiSaveRoomBroadcast, loadBroadcastState as apiLoadBroadcastState, loadRoomBroadcast as apiLoadRoomBroadcast } from '../lib/dataLayer'
import { classifyRemote, stampEnvelope } from '../lib/workingProtocol'
import { useAuth } from '../lib/useAuth'
import { MOCK_EVENT } from '../lib/mockEvent'
import { supabase } from '../lib/supabase'

// True if the id looks like a real Supabase UUID (vs local `t0`/`s0` temp ids).
const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

// ===== Persistence (localStorage) =====
const SAVE_KEY = 'havoc-app-state-v1'

// Deep-merge a previously-saved state over the default state so new fields added
// in future versions still get their defaults.
function loadInitialState(base: AppState): AppState {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return base
    const saved = JSON.parse(raw)
    if (!saved || typeof saved !== 'object') return base
    // Logo migration: legacy blob: URLs die on reload and oversized data URLs
    // used to blow the localStorage quota — drop them so state still loads.
    if (Array.isArray(saved.teams)) {
      for (const t of saved.teams) {
        for (const k of ['logoUrl', 'logoSecondaryUrl', 'logoTertiaryUrl']) {
          const v = t?.[k]
          if (typeof v === 'string' && (v.startsWith('blob:') || (v.startsWith('data:') && v.length > 1_500_000))) t[k] = null
        }
        if (Array.isArray(t?.players)) {
          for (const p of t.players) {
            for (const k of ['photoUrl', 'avatarUrl']) {
              const v = p?.[k]
              if (typeof v === 'string' && (v.startsWith('blob:') || (v.startsWith('data:') && v.length > 1_500_000))) p[k] = null
            }
          }
        }
      }
    }
    if (Array.isArray(saved.tournamentLogoUrls)) {
      saved.tournamentLogoUrls = saved.tournamentLogoUrls.map((v: any) =>
        typeof v === 'string' && !v.startsWith('blob:') && !(v.startsWith('data:') && v.length > 1_500_000) ? v : null)
    }
    if (Array.isArray(saved.sponsors)) {
      for (const s of saved.sponsors) {
        if (typeof s?.imageUrl === 'string' && (s.imageUrl.startsWith('blob:') || (s.imageUrl.startsWith('data:') && s.imageUrl.length > 1_500_000))) s.imageUrl = null
      }
    }
    return sanitizeWorkspaceIds({ ...base, ...saved })
  } catch {
    return base
  }
}

/**
 * Heals a merged workspace state that may contain duplicate entity ids.
 * Teams/players/sponsors can collide after a page reload because the local numeric
 * counter `nextId` resets to 100 while persisted teams keep old `t100...` ids —
 * so adding more teams reuses an existing id,,and every team sharing that id
 * lights up as selected / updates at once. Reassigns fresh unique ids to any
 * collisionand bumps the module counter past every existing numeric suffix,
 * so future adds never collide again.
 */
function sanitizeWorkspaceIds(state: AppState): AppState {
  const seenTeams = new Set<string>();
  const seenSponsors = new Set<string>();
  const seenPlayers = new Set<string>();
  const dedupePlayers = (list: Player[]): Player[] => list.map(p => {
    if (seenPlayers.has(p.id)) return { ...p, id: `p${nextId++}` };
    seenPlayers.add(p.id);
    return p;
  });
  const teams = state.teams.map(t => {
    const deduped = seenTeams.has(t.id) ? { ...t, id: `t${nextId++}` } : t;
    seenTeams.add(deduped.id);
    return { ...deduped, players: dedupePlayers(deduped.players ?? t.players ?? []) };
  });
  const sponsors = state.sponsors.map(s => {
    if (seenSponsors.has(s.id)) return { ...s, id: `s${nextId++}` };
    seenSponsors.add(s.id);
    return s;
  });
  // Bump past every existing numeric suffix so future adds never collide even after reloads.
  for (const id of [...teams.map(t => t.id), ...teams.flatMap(t => (t.players ?? []).map(p => p.id)), ...sponsors.map(s => s.id)]) {
    const n = parseInt(String(id).replace(/^[a-z]+/i, ''), 10);
    if (Number.isFinite(n) && n >= nextId) nextId = n + 1;
  }
  return { ...state, teams, sponsors } as AppState;
}

// ===== Types =====
export interface Player {
  id: string
  riotId: string
  alias: string
  webcamSource: 'Internal Webcam' | 'External Webcam' | 'None'
  /** P4: external stream URL (vdo.ninja etc.) when webcamSource === 'External Webcam' */
  webcamUrl?: string | null
  avatarUrl: string | null
  photoUrl?: string | null
}

export interface Team {
  id: string
  name: string
  tag: string
  description: string
  color: string
  color2: string
  logoUrl: string | null
  logoSecondaryUrl: string | null
  logoTertiaryUrl: string | null
  players: Player[]
}

export interface Sponsor {
  id: string
  name: string
  type: string
  imageUrl: string | null
  isDefault: boolean
}

export interface VetoStep {
  team: string
  action: 'Ban' | 'Pick' | 'Decider'
  map: string
  side?: 'Defense' | 'Offense'
  /** BLOB-style stable step id ("opening-ban-1", "pick-map-1"…) — stamped when
   *  the action runs so history/undo are step-addressable, not index-based. */
  stepId?: string
}

export interface AppState {
  // Event
  workspaceName: string
  eventOrganiser: string
  selectedGame: string
  broadcastKit: string
  serverCode: string
  /** Stable per-tournament server codes (tournamentId -> HAVOC-xxxx code). */
  roomServerCodes?: Record<string, string>

  // Connected Supabase tournament (set on Overview by UUID pick)
  connectedTournamentId: string
  connectedTournamentName: string
  connectedTournamentGame: string

  // Users
  users: { id: string; name: string; email: string; role: string; avatarInitials: string }[]
  usersRefreshKey: number

  // Teams
  teams: Team[]

  // Tournament
  tournamentName1: string
  tournamentName2: string
  tournamentRegion?: string
  tournamentLanguage: string
  teamCount: number
  tournamentFormat: string
  sponsors: Sponsor[]
  tournamentLogoUrls: (string | null)[]
  autoUpdateRankings: boolean
  rankings: { teamId: string; rank: number; wins?: number; losses?: number }[]

  // Map Veto
  vetoFormat: string
  teamAId: string
  teamBId: string
  selectedMapPool: string[]
  vetoActive: boolean
  vetoSteps: VetoStep[]
  vetoCurrentStep: number
  /**
   * PLAY on the Map Veto page bumps this counter. The map-ban scene (HUD
   * editor canvas + OBS overlay URL) keys off it, so PLAY replays the scene
   * exactly where the real site does — no popup, no extra window.
   */
  vetoReplayRun?: number
  matchFormat?: string
  mapPool?: string[]
  mapBans?: { sequenceNo: number; mapId: string; bannedBy: 'TEAM_A' | 'TEAM_B' }[]
  mapPicks?: { sequenceNo: number; mapId: string; pickedBy: 'TEAM_A' | 'TEAM_B' | 'DECIDER'; slot: string; sideSelection?: { TEAM_A: 'ATTACK' | 'DEFENSE'; TEAM_B: 'ATTACK' | 'DEFENSE' } }[]
  /** Series results — completed maps with final scores. SERIES state: survives Restart Active Session; only an explicit series reset clears it. */
  mapResults?: { slot: string; mapId: string; mapName?: string; score?: string }[]
  history?: any[]

  // Map Veto â€” persisted across page navigation (survives leaving/changing rooms)
  vetoStarted: boolean
  vetoCompleted: boolean
  vetoStepIndex: number
  vetoSelectedMapIds: string[]
  vetoFirstPickTeam: 'TEAM_A' | 'TEAM_B'
  vetoActingTeamOverride: 'TEAM_A' | 'TEAM_B'
  vetoActionTypeOverride: 'Ban' | 'Pick' | 'Side pick' | 'Decider'
  vetoPendingSidePick: { mapId: string; pickedBy: 'TEAM_A' | 'TEAM_B'; choosingSideTeam: 'TEAM_A' | 'TEAM_B'; slot: string } | null
  vetoMode?: 'standard' | 'grand_finals'

  // Live Game
  leftTeamId: string
  rightTeamId: string
  playerAnchorLeft?: string
  playerAnchorRight?: string
  teamsAuto: boolean
  seriesAuto: boolean
  scorelineAuto: boolean
  bestOf: number
  seriesScoreA: number
  seriesScoreB: number
  scoreA: number
  scoreB: number
  /** P1 score model (workingProtocol): derived = match-row/game-data mirror,
   *  override = manual dashboard bump. Displayed scoreA/scoreB resolve as
   *  override ?? derived ?? last-known. Absent (=undefined) for legacy blobs. */
  derivedScoreA?: number | null
  derivedScoreB?: number | null
  scoreOverrideA?: number | null
  scoreOverrideB?: number | null
  seriesTitle: string
  eventTitle: string
  roundTitle: string
  gameSeries: string

  // Camera Feed
  globalDelay: number
  teamADelay: string
  teamBDelay: string
  cameraVisibility: Record<string, boolean>
  cameraMode: Record<string, 'internal' | 'hide'>

  // HUD Editor
  selectedScene: string
  colorMode: 'Custom' | 'Team'
  customColorA: string
  customColorB: string
  sceneToggles: Record<string, boolean>

  // Watermark management (#12)
  watermark?: {
    enabled?: boolean
    imageUrl?: string | null
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
    opacity?: number
    size?: number
  }
}

export const ALL_MAPS = [
  { name: 'Ascent', key: 'ascent', active: true },
  { name: 'Split', key: 'split', active: true },
  { name: 'Breeze', key: 'breeze', active: true },
  { name: 'Lotus', key: 'lotus', active: true },
  { name: 'Sunset', key: 'sunset', active: true },
  { name: 'Summit', key: 'summit', active: true },
  { name: 'Haven', key: 'haven', active: true },
  { name: 'Fracture', key: 'fracture', active: false },
  { name: 'Bind', key: 'bind', active: false },
  { name: 'District', key: 'district', active: false },
  { name: 'Kasbah', key: 'kasbah', active: false },
  { name: 'Drift', key: 'drift', active: false },
  { name: 'Glitch', key: 'glitch', active: false },
  { name: 'Piazza', key: 'piazza', active: false },
  { name: 'Abyss', key: 'abyss', active: false },
  { name: 'Pearl', key: 'pearl', active: false },
  { name: 'Icebox', key: 'icebox', active: false },
  { name: 'Corrode', key: 'corrode', active: false },
  { name: 'Skirmish A', key: 'skirmish_a', active: false },
  { name: 'Skirmish B', key: 'skirmish_b', active: false },
  { name: 'Skirmish C', key: 'skirmish_c', active: false },
  { name: 'Skirmish D', key: 'skirmish_d', active: false },
]

export function getMapImage(key: string): string {
  return `/maps/${key}.webp`
}

// ===== Veto Logic =====
export function getVetoSequence(format: string): { action: 'Ban' | 'Pick' | 'Decider'; teamIndex: number }[] {
  switch (format) {
    case 'BO1':
      return [
        { action: 'Ban', teamIndex: 0 }, { action: 'Ban', teamIndex: 1 },
        { action: 'Ban', teamIndex: 0 }, { action: 'Ban', teamIndex: 1 },
        { action: 'Ban', teamIndex: 0 }, { action: 'Ban', teamIndex: 1 },
        { action: 'Decider', teamIndex: -1 },
      ]
    case 'BO3':
      return [
        { action: 'Ban', teamIndex: 0 }, { action: 'Ban', teamIndex: 1 },
        { action: 'Pick', teamIndex: 0 }, { action: 'Pick', teamIndex: 1 },
        { action: 'Ban', teamIndex: 0 }, { action: 'Ban', teamIndex: 1 },
        { action: 'Ban', teamIndex: 0 }, { action: 'Ban', teamIndex: 1 },
        { action: 'Decider', teamIndex: -1 },
      ]
    case 'BO5':
      return [
        { action: 'Ban', teamIndex: 0 }, { action: 'Ban', teamIndex: 1 },
        { action: 'Pick', teamIndex: 0 }, { action: 'Pick', teamIndex: 1 },
        { action: 'Pick', teamIndex: 0 }, { action: 'Pick', teamIndex: 1 },
        { action: 'Decider', teamIndex: -1 },
      ]
    default: // BO2, BO7
      return [
        { action: 'Ban', teamIndex: 0 }, { action: 'Ban', teamIndex: 1 },
        { action: 'Pick', teamIndex: 0 }, { action: 'Pick', teamIndex: 1 },
      ]
  }
}

// ===== Context =====
interface AppContextType {
  state: AppState
  setState: React.Dispatch<React.SetStateAction<AppState>>
  // Same as setState but does NOT mark the state as having unsaved changes
  // (used for background syncs like DB loads & realtime).
  setStateSilent: React.Dispatch<React.SetStateAction<AppState>>

  // Team helpers
  addTeam: () => void
  deleteTeam: (id: string) => void
  updateTeam: (id: string, updates: Partial<Team>) => void
  addPlayer: (teamId: string) => void
  deletePlayer: (teamId: string, playerId: string) => void
  updatePlayer: (teamId: string, playerId: string, updates: Partial<Player>) => void

  // Sponsor helpers
  addSponsor: () => void
  deleteSponsor: (id: string) => void
  updateSponsor: (id: string, updates: Partial<Sponsor>) => void

  // Toast
  showToast: (message: string) => void
  toastMessage: string | null

  // Persistence
  hasChanges: boolean
  saveChanges: () => void
  discardChanges: () => void
  restoreFromServer: () => Promise<void>
  /** Fresh dirty check (refs don't re-render) — used by sync readers. */
  isDirtyNow: () => boolean
  /** Newer remote workspace arrived while local edits are pending — the save
   *  bar surfaces this so the operator chooses Restore vs Save instead of
   *  silently losing either side (P1 conflict handling). */
  pendingRemoteRev: number | null
}

const AppContext = createContext<AppContextType | null>(null)

export function useAppStore() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppStore must be used within AppProvider')
  return ctx
}

let nextId = 100

/**
 * Unique per-workspace server code the desktop app joins with.
 * Format: HAVOC-<tournament-id>-<short-uuid>  e.g. HAVOC-6e8929cb-X7K2QF
 * Generated once and persisted with the rest of the workspace state.
 */
export function makeServerCode(tournamentId?: string): string {
  const hex = (n: number) =>
    Array.from(crypto.getRandomValues(new Uint8Array(n))).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, n * 2)
  const tid = String(tournamentId || hex(4)).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || hex(4)
  return `HAVOC-${tid.toUpperCase()}-${hex(3).toUpperCase()}`
}


/**
 * Deterministic per-tournament server code: HAVOC-<tid>-<fnv-hash>.
 * Same tournament always maps to the same code (desktops/overlays keep
 * working), different tournaments always get different codes.
 */
export function makeTournamentServerCode(tournamentId: string): string {
  const tid = String(tournamentId || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase() || 'ROOM'
  let h = 2166136261
  const s = String(tournamentId || '')
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  const suffix = h.toString(16).toUpperCase().padStart(8, '0').slice(0, 6)
  return `HAVOC-${tid}-${suffix}`
}
export function AppProvider({ children }: { children: ReactNode }) {
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const savedRef = useRef<AppState | null>(null)
  const dirtyRef = useRef(false)

  const [state, rawSetState] = useState<AppState>(() => {
    const initial = loadInitialState({
      workspaceName: 'test',
      eventOrganiser: 'test',
      selectedGame: 'Valorant',
      broadcastKit: 'Classic',
      serverCode: makeServerCode(),
      connectedTournamentId: '',
      connectedTournamentName: '',
      connectedTournamentGame: '',
    users: [],
    usersRefreshKey: 0,
    teams: [],
    tournamentName1: 'test',
    tournamentName2: 'test',
    tournamentLanguage: '',
    teamCount: 4,
    tournamentFormat: 'Single Elimination',
    sponsors: [
      { id: 's1', name: 'HAVOC UNLEASH', type: 'Main Sponsor', imageUrl: null, isDefault: true },
    ],
    tournamentLogoUrls: [null, null, null, null],
    autoUpdateRankings: false,
    rankings: [],
    vetoFormat: 'BO3',
    matchFormat: '3',
    mapPool: ['ascent', 'split', 'breeze', 'lotus', 'sunset', 'summit', 'haven'],
    mapBans: [],
    mapPicks: [],
    history: [],
    teamAId: 't1',
    teamBId: 't2',
    selectedMapPool: ALL_MAPS.filter(m => m.active).map(m => m.name),
    vetoActive: false,
    vetoSteps: [],
    vetoCurrentStep: 0,
    vetoStarted: false,
    vetoCompleted: false,
    vetoStepIndex: 0,
    vetoSelectedMapIds: [],
    vetoFirstPickTeam: 'TEAM_A',
    vetoActingTeamOverride: 'TEAM_A',
    vetoActionTypeOverride: 'Ban',
    vetoPendingSidePick: null,
    vetoMode: 'standard',
    leftTeamId: 't1',
    rightTeamId: 't2',
    playerAnchorLeft: '',
    playerAnchorRight: '',
    teamsAuto: true,
    seriesAuto: true,
    scorelineAuto: true,
    bestOf: 3,
    seriesScoreA: 0,
    seriesScoreB: 0,
    scoreA: 0,
    scoreB: 0,
    seriesTitle: '',
    eventTitle: '',
    roundTitle: '',
    gameSeries: '',
    globalDelay: 0,
    teamADelay: '',
    teamBDelay: '',
    cameraVisibility: {},
    cameraMode: {},
    selectedScene: 'Agent Select',
    colorMode: 'Custom',
    customColorA: '#22c55e',
    customColorB: '#ef4444',
    sceneToggles: {
      'Background': true, 'Map Name': true, 'Team Lineup': true,
      'Buy Round': true,
      'Players Alive': true, 'Game Events': true, 'Map History': true, 'Score Line': true, 'Sponsors': true, 'Team Stats': true, 'Webcam': true,
      'Card': true,
    },
    watermark: {
      enabled: false,
      imageUrl: null,
      position: 'top-right',
      opacity: 0.8,
      size: 80,
    },
    })
    // Migrate legacy codes to the unique HAVOC- format (one-time per workspace)
    if (!initial.serverCode || !initial.serverCode.startsWith('HAVOC-')) {
      initial.serverCode = makeServerCode(initial.connectedTournamentId)
    }
    // Dedupe any teams accumulated before server-sync existed
    const _seen = new Set<string>()
    initial.teams = (initial.teams || []).filter((t: any) => {
      const k = String(t?.id ?? t?.name ?? Math.random())
      if (_seen.has(k)) return false
      _seen.add(k); return true
    })
    return initial
  })
  // Last-saved snapshot for dirty-tracking + discard.
  if (savedRef.current === null) savedRef.current = state

  // Cross-PC sync revision: bumped on every save, compared against the server's
  // room havoc so the newest workspace always wins.
  const revRef = useRef<number>(Number((savedRef.current as any)?._rev || 0))
  // _sub of the last write THIS tab performed — lets classifyRemote() recognize
  // our own realtime echoes as 'same' instead of flagging a false conflict.
  const subRef = useRef<string>(String((savedRef.current as any)?._sub || ''))
  // Pre-revision local snapshots stay at rev 0: the server room havoc is
  // authoritative on load. Mid-session edits are protected by dirtyRef.
  const bumpRev = () => { revRef.current = Math.max(revRef.current + 1, Date.now()); return revRef.current }
  // Legacy snapshot protection: workspaces saved before the revision system
  // have no _rev. Treat them as newest so the mount-time adoption cannot wipe
  // local modifications with an older server havoc.

  // User edits mark "unsaved changes"; silent background syncs (DB load / realtime)
  // do not.
  const setState = useCallback((update: React.SetStateAction<AppState>) => {
    dirtyRef.current = true
    rawSetState(update)
  }, [rawSetState])
  const setStateSilent = useCallback((update: React.SetStateAction<AppState>) => {
    rawSetState(update)
  }, [rawSetState])

  // Load the tournament room's users (owners/admins + invited/registered members)
  // into the "Users" panel â€” only when a tournament is connected.
  const { status: authStatus, profile: authProfile } = useAuth()
  useEffect(() => {
    if (authStatus !== 'signedIn' || !state.connectedTournamentId) {
      setStateSilent(prev => (prev.users.length ? { ...prev, users: [] } : prev))
      return
    }
    let cancelled = false
    listTournamentUsers(state.connectedTournamentId)
      .then((profiles) => {
        if (cancelled) return
        const users = profiles.map(p => {
          const badges = p.badges || []
          const role = badges.includes('Owner') ? 'Owner'
            : (p.role === 'admin' || badges.includes('Admin')) ? 'Admin' : 'Member'
          const name = p.display_name?.trim() || p.discord_id || 'User'
          return {
            id: p.id,
            name,
            email: p.player_id || name,
            role,
            avatarInitials: (name || 'U').slice(0, 2).toUpperCase(),
          }
        })
        setStateSilent(prev => ({ ...prev, users }))
      })
      .catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus, state.connectedTournamentId, authProfile?.id, state.usersRefreshKey])

  // TEMPORARY mock event seed (VITE_MOCK_EVENT=1 in .envlocal): injects two
  // 5-player teams + connected-event metadata on first load of an empty
  // workspace so every page (PlayersTeams, MapVeto, Camera, LiveGame,
  // HudEditor) has data to render. Remove together with mockEvent.ts.
  const mockSeededRef = useRef(false)
  useEffect(() => {
    if (!MOCK_EVENT || mockSeededRef.current) return
    mockSeededRef.current = true
    setStateSilent(prev => {
      if (prev.teams.length > 0) return prev
      const roster = (prefix: string, base: number): Player[] =>
        Array.from({ length: 5 }, (_, i) => ({
          id: `${prefix}-p${i + 1}`,
          riotId: `${prefix.toUpperCase()}${i + 1}#HU`,
          alias: `${prefix}${i + 1}`,
          webcamSource: 'Internal Webcam',
          avatarUrl: `https://i.pravatar.cc/150?img=${base + i}`,
          photoUrl: null,
        }))
      return {
        ...prev,
        connectedTournamentId: 'mock-event',
        connectedTournamentName: 'HU Local Test Cup',
        connectedTournamentGame: 'Valorant',
        tournamentName1: 'HU Local Test Cup',
        eventTitle: 'HU Local Test Cup',
        gameSeries: 'Grand Final',
        bestOf: 3,
        teamAId: 'mock-team-a',
        teamBId: 'mock-team-b',
        teams: [
          {
            id: 'mock-team-a', name: 'Crimson Vanguard', tag: 'CRV', description: 'Mock team A',
            color: '#28D091', color2: '#0f766e', logoUrl: null, logoSecondaryUrl: null, logoTertiaryUrl: null,
            players: roster('crimson', 11),
          },
          {
            id: 'mock-team-b', name: 'Azure Syndicate', tag: 'AZS', description: 'Mock team B',
            color: '#FF3549', color2: '#7f1d1d', logoUrl: null, logoSecondaryUrl: null, logoTertiaryUrl: null,
            players: roster('azure', 26),
          },
        ],
      }
    })
  }, [])

  const showToast = useCallback((message: string) => {
    setToastMessage(message)
    setTimeout(() => setToastMessage(null), 2000)
  }, [])
  // ---- Persistence (localStorage + Supabase site_settings) ----
  const [hasChanges, setHasChanges] = useState(false)
  // Set when a NEWER remote workspace arrives while we hold local edits.
  const [pendingRemoteRev, setPendingRemoteRev] = useState<number | null>(null)

  // `hasChanges` is driven purely by user edits (setState marks dirtyRef, then we
  // sync that into a state flag). Background/silent syncs never trigger it.
  useEffect(() => {
    setHasChanges(dirtyRef.current)
  }, [state])

  // Auto-persist local edits to localStorage (debounced) so a refresh is never
  // required to keep your work. The explicit Save button additionally writes the
  // durable copy to Supabase.
  useEffect(() => {
    if (!dirtyRef.current) return
    const h = setTimeout(() => {
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)) } catch (err) {
        console.warn('[state] localStorage save failed (quota?) — oversized logos can cause this:', err)
      }
    }, 400)
    return () => clearTimeout(h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  // Auto-sync the broadcast havoc to Supabase (debounced) whenever connected to
  // a tournament â€” OBS overlay pages on other devices load THIS havoc by room
  // code, so rosters/scores stay in sync without pressing Save.
  useEffect(() => {
    if (!dirtyRef.current) return
    const h = setTimeout(() => {
      // One envelope per flush, stamped for BOTH mirror keys (room + tournament).
      // Previously the tournament key saved raw state with a stale _rev while the
      // room key bumped — readers of broadcast:<tid> then saw un-regressed
      // revisions and blind-merged stale snapshots.
      const stamped = stampEnvelope(state, bumpRev())
      subRef.current = stamped._sub
      // Room-keyed mirror: works even without a connected tournament, so any
      // PC joining the server code sees the exact same workspace.
      if (state.serverCode) {
        apiSaveRoomBroadcast(state.serverCode, stamped).catch(() => { /* best-effort */ })
      }
      if (state.connectedTournamentId) {
        apiSaveBroadcastState(state.connectedTournamentId, stamped).catch(() => { /* best-effort */ })
      }
    }, 2000)
    return () => clearTimeout(h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])
  // Cross-PC sync: adopt the server room havoc when it is newer than this
  // PC workspace, and live-apply remote saves while this dashboard is open.
  // Local edits in progress are never clobbered - your next save re-bumps
  // the revision and every other device converges on it.
  useEffect(() => {
    if (!state.serverCode) return
    let cancelled = false
    const adopt = (remote: any) => {
      if (!remote || cancelled || typeof remote !== 'object') return
      const verdict = classifyRemote(remote, { rev: revRef.current, sub: subRef.current })
      if (verdict === 'same' || verdict === 'stale') return
      if (verdict === 'conflict') console.warn('[sync] room havoc rev tie (two writers) — adopting server copy', (remote as any)._rev)
      const remoteRev = Number((remote as any)._rev || 0)
      if (dirtyRef.current) {
        // Local edits in progress: never clobber — surface the newer server
        // revision on the save bar so the operator chooses Restore vs Save.
        setPendingRemoteRev(remoteRev)
        return
      }
      setStateSilent(prev => {
        const merged: any = { ...prev, ...(remote as Partial<AppState>) }
        const seen = new Set<string>()
        merged.teams = (merged.teams || []).filter((t: any) => {
          const k = String(t?.id ?? t?.name ?? Math.random())
          if (seen.has(k)) return false
          seen.add(k); return true
        })
        merged._rev = remoteRev
        merged._sub = (remote as any)._sub ?? merged._sub
        savedRef.current = JSON.parse(JSON.stringify(merged))
        dirtyRef.current = false
        return merged
      })
      revRef.current = remoteRev
      subRef.current = String((remote as any)._sub || '')
      setPendingRemoteRev(null)
      setHasChanges(false)
      console.debug('[sync] adopted room havoc rev', remoteRev)
    }
    apiLoadRoomBroadcast(state.serverCode).then(adopt).catch(() => {})
    const channel = supabase
      .channel('room-havoc-' + state.serverCode)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_settings', filter: `id=eq.broadcast-room:` + state.serverCode },
        (payload) => adopt((payload.new as any)?.value))
      .subscribe()
    return () => { cancelled = true; supabase.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.serverCode])

  const saveChanges = useCallback(() => {
    // Stamp FIRST so the persisted baseline carries the exact envelope of the
    // last write — on reload, revRef/subRef resume at the true server revision.
    const stamped = stampEnvelope(state, bumpRev())
    subRef.current = stamped._sub
    const snapshot = JSON.stringify(stamped)
    savedRef.current = JSON.parse(snapshot)
    dirtyRef.current = false
    setHasChanges(false)
    setPendingRemoteRev(null)
    try { localStorage.setItem(SAVE_KEY, snapshot) } catch (err) {
      console.warn('[state] localStorage save failed (quota?) — oversized logos can cause this:', err)
    }
    if (state.serverCode) {
      apiSaveRoomBroadcast(state.serverCode, stamped).catch(e => console.warn('room broadcast save failed', e))
    }
    if (state.connectedTournamentId) {
      apiSaveBroadcastState(state.connectedTournamentId, stamped).catch(e => console.warn('broadcast save failed', e))
      // Create real Supabase team rows for teams that only exist locally (temp ids)
      // so they're not dropped on a hard refresh.
    }
    showToast('Changes saved')
  }, [state, showToast, authProfile?.id])

  // Creates real Supabase rows for teams that only exist locally (temp ids), then
  // swaps the temp ids for the real ids (silent so it doesn't mark "dirty"). Player
  // rosters are stored in the saved broadcast havoc (they aren't real user accounts),
  // so they survive via that instead of being written to team_members.

  const discardChanges = useCallback(() => {
    if (savedRef.current) setStateSilent(savedRef.current)
    dirtyRef.current = false
    setHasChanges(false)
    showToast('Changes discarded')
  }, [setStateSilent, showToast])

  // Manual "restore from server" â€” only runs on-demand from the save bar, so it
  // never overwrites in-progress edits automatically (that caused the "flicker").
  const restoreFromServer = useCallback(async () => {
    if (!state.connectedTournamentId) return
    try {
      const saved = await apiLoadBroadcastState(state.connectedTournamentId)
      if (!saved || typeof saved !== 'object') {
        showToast('No saved broadcast found on server')
        return
      }
      setStateSilent(prev => {
        const merged = { ...prev, ...(saved as Partial<AppState>) }
        savedRef.current = JSON.parse(JSON.stringify(merged))
        dirtyRef.current = false
        return merged
      })
      setHasChanges(false)
      showToast('Restored from server')
    } catch {
      showToast('Could not reach server')
    }
  }, [state.connectedTournamentId, setStateSilent, showToast])

  const addTeam = useCallback(() => {
    const id = `t${nextId++}`
    setState(prev => ({
      ...prev,
      teams: [...prev.teams, {
        id, name: `Team ${prev.teams.length + 1}`, tag: '', description: '',
        color: '#ef4444', color2: '#3b82f6', logoUrl: null, logoSecondaryUrl: null, logoTertiaryUrl: null, players: [],
      }],
    }))
    // Teams are broadcast personas carried by the room havoc - no DB rows,
    // so nothing can accumulate or resurrect (verified 2026-08-26).
  }, [])

  const deleteTeam = useCallback((id: string) => {
    setState(prev => ({ ...prev, teams: prev.teams.filter(t => t.id !== id) }))
  }, [])

  const updateTeam = useCallback((id: string, updates: Partial<Team>) => {
    setState(prev => ({
      ...prev,
      teams: prev.teams.map(t => t.id === id ? { ...t, ...updates } : t),
    }))

  }, [])

  const addPlayer = useCallback((teamId: string) => {
    const pid = 'p' + (nextId++) + ''
    setState(prev => ({
      ...prev,
      teams: prev.teams.map(t =>
        t.id === teamId ? {
          ...t,
          players: [...t.players, { id: pid, riotId: '', alias: '', webcamSource: 'None', avatarUrl: null, photoUrl: null }],
        } : t
      ),
    }))
    // Roster players are broadcast personas carried by the room havoc -
    // they are NOT platform accounts, so no team_members row is written.
  }, [])

  const deletePlayer = useCallback((teamId: string, playerId: string) => {
    setState(prev => ({
      ...prev,
      teams: prev.teams.map(t =>
        t.id === teamId ? { ...t, players: t.players.filter(p => p.id !== playerId) } : t
      ),
    }))
  }, [])

  const updatePlayer = useCallback((teamId: string, playerId: string, updates: Partial<Player>) => {
    setState(prev => ({
      ...prev,
      teams: prev.teams.map(t =>
        t.id === teamId ? {
          ...t,
          players: t.players.map(p => p.id === playerId ? { ...p, ...updates } : p),
        } : t
      ),
    }))
  }, [])

  const addSponsor = useCallback(() => {
    const id = `s${nextId++}`
    setState(prev => ({
      ...prev,
      sponsors: [...prev.sponsors, { id, name: 'New Sponsor', type: 'Co-Sponsor', imageUrl: null, isDefault: false }],
    }))
  }, [])

  const deleteSponsor = useCallback((id: string) => {
    setState(prev => ({ ...prev, sponsors: prev.sponsors.filter(s => s.id !== id) }))
    if (isUuid(id)) apiDeleteSponsor(id).catch(e => console.warn('sponsor delete failed', e))
  }, [])

  const updateSponsor = useCallback((id: string, updates: Partial<Sponsor>) => {
    setState(prev => ({
      ...prev,
      sponsors: prev.sponsors.map(s => s.id === id ? { ...s, ...updates } : s),
    }))
    if (isUuid(id)) {
      apiUpdateSponsor(id, { name: updates.name, image_url: updates.imageUrl ?? undefined }).catch(e => console.warn('sponsor update failed', e))
    }
  }, [])

  return (
    <AppContext.Provider value={{
      state, setState, setStateSilent,
      addTeam, deleteTeam, updateTeam,
      addPlayer, deletePlayer, updatePlayer,
      addSponsor, deleteSponsor, updateSponsor,
      showToast, toastMessage,
      hasChanges, saveChanges, discardChanges, restoreFromServer,
      isDirtyNow: () => dirtyRef.current,
      pendingRemoteRev,
    }}>
      {children}
      {/* Toast */}
      {toastMessage && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'hsl(var(--foreground))', color: 'hsl(var(--background))',
          padding: '8px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500,
          zIndex: 99999, boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          animation: 'fadeIn 0.2s ease',
        }}>
          {toastMessage}
        </div>
      )}

      {/* Unsaved-changes bar â€” only visible when there are unsaved edits */}
      {hasChanges && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'hsl(var(--card))', color: 'hsl(var(--foreground))',
          padding: '6px 8px 6px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500,
          zIndex: 99998, boxShadow: '0 8px 24px rgba(0,0,0,0.45)', animation: 'fadeIn 0.2s ease',
          border: '1px solid hsla(0,0%,100%,0.12)',
        }}>
          <span style={{ whiteSpace: 'nowrap' }}>âš ï¸ Unsaved changes</span>
          {pendingRemoteRev != null && (
            <span style={{ whiteSpace: 'nowrap', color: '#f87171', fontWeight: 600 }}>
              · a newer version exists on the server — Restore to load it, or Save to overwrite
            </span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => { void restoreFromServer() }} style={{
              background: 'transparent', border: 'none', color: 'hsl(var(--muted-foreground))',
              cursor: 'pointer', fontSize: 13, padding: '6px 10px', borderRadius: 6,
            }}>Restore from server</button>
            <button onClick={discardChanges} style={{
              background: 'transparent', border: 'none', color: 'hsl(var(--muted-foreground))',
              cursor: 'pointer', fontSize: 13, padding: '6px 10px', borderRadius: 6,
            }}>Discard</button>
            <button onClick={saveChanges} style={{
              background: 'hsl(var(--foreground))', color: 'hsl(var(--background))',
              border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '6px 14px', borderRadius: 6,
            }}>Save Changes</button>
          </div>
        </div>
      )}
    </AppContext.Provider>
  )
}


