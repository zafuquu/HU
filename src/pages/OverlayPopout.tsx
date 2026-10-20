import { useEffect, useReducer, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAppStore } from '../store/AppContext'
import { useRealtimeSync } from '../lib/realtimeSync'
import { supabase } from '../lib/supabase'
import { useDesktopPresence } from '../lib/useDesktopPresence'
import { IngameHudScene } from '../components/scenes/IngameHudScene'
import { AgentSelectScene } from '../components/scenes/AgentSelectScene'
import { BuyRoundScene } from '../components/scenes/BuyRoundScene'
import { MapBanScene } from '../components/scenes/MapBanScene'
import { PostgameScene } from '../components/scenes/PostgameScene'
import { pickSource } from '../lib/sourceSelection'
import { winnerSideFromViewer, winnerSideFromStart } from '../lib/broadcast'
import { TimeoutOverlay } from '../components/scenes/TimeoutOverlay'
import { CasterCard } from '../components/scenes/CasterCard'
import { EconomyTracker } from '../components/scenes/EconomyTracker'
import { PostgameMVP } from '../components/scenes/PostgameMVP'
import { OverlayToast } from '../components/scenes/OverlayToast'
import { buildMapHistoryItems, VAL_MAPS } from './MapVeto'

/**
 * Overlay popout page â€” the page the HAVOC UNLEASH desktop overlay windows load:
 *   /<roomCode>/<overlayId>?screen=default&isPopout=true
 *
 * Renders the broadcast scene full-bleed at 1920x1080 (scaled to the window)
 * with no app chrome. Scoreline is driven live from two sources:
 *   1. Supabase `tournament_matches` realtime (via useRealtimeSync â†’ AppContext)
 *   2. The desktop bridge's raw snapshot mirror in `site_settings` (`live:<roomCode>`)
 *      which carries the exact game snapshot (round score, series, round number).
 */
/**
 * Sticky roster persistence (localStorage): the final roster must survive a
 * page reload — a fresh OBS/browser-source load during post-game started with
 * an empty roster and the postgame scene then fell back to its built-in DEMO
 * players (reported live 2026-10-18: "post game no data feed, all mock/demo
 * data"). Cleared by the same round-1 / agent-select transitions that reset
 * the in-memory sticky, so a new match never bleeds into the next post-game.
 */
const STICKY_ROSTER_KEY = 'hu-overlay-sticky-roster'
function saveStickyRoster(value: { left: any[]; right: any[] }): void {
  try {
    localStorage.setItem(STICKY_ROSTER_KEY, JSON.stringify(value))
  } catch {
    /* storage unavailable — sticky stays in-memory only */
  }
}
function loadStickyRoster(): { left: any[]; right: any[] } {
  try {
    const raw = localStorage.getItem(STICKY_ROSTER_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed?.left) && Array.isArray(parsed?.right)) return parsed
    }
  } catch {
    /* ignore corrupt storage */
  }
  return { left: [], right: [] }
}


export default function OverlayPopout() {
  const { state, setStateSilent } = useAppStore()
  useRealtimeSync()
  const { roomCode, overlayId: overlayIdRaw } = useParams<{ roomCode: string; overlayId: string }>()
  // Normalize the overlayId to a scene key (desktop uses a few aliases)
  const urlSceneKey = (() => {
    const screenParam = new URLSearchParams(window.location.search).get('screen')
    const id = (overlayIdRaw || screenParam || 'default').toLowerCase()
    if (id === 'ingame-hud' || id === 'buy-round-part-of-hud' || id === 'postgame') {
      if (id === 'buy-round-part-of-hud') return 'buy-round'
      if (id === 'postgame') return 'post-game'
      return 'default'
    }
    return id
  })()
  const pickedMap = VAL_MAPS.find(m => m.mapId === (state.mapPicks?.[0]?.mapId || state.vetoSelectedMapIds?.[0]))
  const { live: desktopLive } = useDesktopPresence(roomCode)
  const [liveScores, setLiveScores] = useState<{ scores?: any; snapshot?: any; event?: any; updatedAt?: number; timeout?: any; killBanner?: any; economy?: any; mvpPlayer?: any; casterCards?: any; forceScene?: string | null; overlayHidden?: boolean; toast?: any; audioCuesEnabled?: boolean; currentlyObserving?: any; spike?: any } | null>(null)
  const [isLocalTransport, setIsLocalTransport] = useState(false)
  // Stale-data detection (#1): if no update in 10s, show reconnecting badge
  const [isStale, setIsStale] = useState(false)
  const lastUpdateRef = useRef(Date.now())
  useEffect(() => {
    if (liveScores?.updatedAt) lastUpdateRef.current = Date.now()
  }, [liveScores?.updatedAt])
  useEffect(() => {
    const t = setInterval(() => {
      setIsStale(!isLocalTransport && Date.now() - lastUpdateRef.current > 10000)
    }, 2000)
    return () => clearInterval(t)
  }, [isLocalTransport])

  // (Audio cues removed — broadcast overlays must stay silent.)

  // Auto scene switching: the desktop producer publishes the scene its game data
  // implies (agent-select / buy-round / ingame-hud / post-game / map-interstitial),
  // OR we derive it from the live round phase when no explicit scene was sent.
  // forceScene from bridge control API (#3) takes highest priority.
  const liveScene = liveScores?.snapshot?.state?.scene
  const forceScene = liveScores?.forceScene || null
  const overlayHidden = liveScores?.overlayHidden === true
  const livePhase = (function () {
    const st = (liveScores?.snapshot?.state || liveScores?.snapshot || {}) as any
    const raw = (
      st.roundPhase ||
      (st.roundInfo && st.roundInfo.roundPhase) ||
      st.phase ||
      (st.currentRound && st.currentRound.roundPhase) ||
      (st.isAgentSelectPhase === true ? 'game_start' : null) ||
      null
    ) as string | null
    // Engine dialect aliases → the overlay's scene phases (auto-switching must
    // not stall when the engine says 'buy' / 'planning' / 'agent_select').
    if (!raw) return null
    const s = String(raw).toLowerCase()
    if (s === 'buy' || s === 'buy_phase' || s === 'buytime' || s === 'planning' || s === 'buytime_start') return 'shopping'
    if (s === 'agent_select' || s === 'select' || s === 'lock_in') return 'game_start'
    if (s === 'matchend' || s === 'ended' || s === 'postgame') return 'game_end'
    return s
  })()
  const phaseDerivedScene =
    livePhase === 'game_end' ? 'post-game'
    : livePhase === 'shopping' ? 'buy-round'
    : livePhase === 'game_start' ? 'agent-select'
    : null
  // Map Veto persistence (production operator requirement): when the browser
  // source IS the veto scene, the veto sequence completing must NEVER auto-
  // advance — hold Map Veto until genuine agent-select evidence arrives or
  // the operator picks another scene (forceScene stays highest priority and
  // fully releasable).
  const isVetoSource = urlSceneKey === 'map-ban' || urlSceneKey === 'map-veto'
  const sceneKey = (() => {
    if (forceScene) return String(forceScene)
    if (isVetoSource) {
      return (livePhase === 'game_start' || liveScene === 'agent-select') ? 'agent-select' : 'map-ban'
    }
    if (liveScene && ['agent-select', 'buy-round', 'ingame-hud', 'post-game', 'map-interstitial'].includes(String(liveScene))) return String(liveScene)
    if (phaseDerivedScene) return phaseDerivedScene
    return urlSceneKey
  })()
  const [scale, setScale] = useState(1)
  // Sponsor cycler: rotate through the tournament's sponsors every 8s
  // (ValoSpectra sponsor-cycle parity). Logos are 1:1 square; backdrops 875x200.
  const sponsorList = (state.sponsors || []).map((s: any) => s?.imageUrl).filter((u: any): u is string => !!u)
  const [sponsorIdx, setSponsorIdx] = useState(0)
  useEffect(() => {
    if (sponsorList.length <= 1) return
    const t = setInterval(() => setSponsorIdx((i) => (i + 1) % sponsorList.length), 8000)
    return () => clearInterval(t)
  }, [sponsorList.length])
  const sponsorCycleUrl = sponsorList.length > 0 ? sponsorList[sponsorIdx % sponsorList.length] : null
  const fullTournamentIdRef = useRef<string | null>(null)
  // Sticky: once we have shown real data, never blank out mid-stream.
  const hasEverHadDataRef = useRef(false)
  const lastRevRef = useRef(0)

  // Full-field authority: the room workspace havoc wins wholesale on overlay
  // pages (OBS/browser sources have no local workspace worth preserving).
  const HAVOC_FIELDS = ['teams','teamAId','teamBId','sponsors','tournamentLogoUrls','mapPicks','connectedTournamentId',
    'mapResults',
    'scoreA','scoreB','seriesScoreA','seriesScoreB','roundTitle','eventTitle','seriesTitle',
    'derivedScoreA','derivedScoreB','scoreOverrideA','scoreOverrideB',
    'gameSeries','matchFormat','bestOf'] as const
  const applyHavoc = (saved: any) => {
    if (!saved) return
    // Stale-write guard (G2): never apply an older revision than shown
    const rev = Number((saved as any)._rev || 0)
    if (rev && lastRevRef.current && rev < lastRevRef.current) {
      console.debug('[overlay] skipping stale havoc revision', rev, '<', lastRevRef.current)
      return
    }
    if (rev) lastRevRef.current = rev
    const seen = new Set<string>()
    const teams = Array.isArray(saved.teams)
      ? saved.teams.filter((t: any) => {
          const k = String(t?.id ?? t?.name ?? Math.random())
          if (seen.has(k)) return false
          seen.add(k)
          return true
        })
      : []
    console.debug('[overlay] applying broadcast havoc:', teams.length, 'teams, scores', saved.scoreA, '-', saved.scoreB)
    setStateSilent(prev => {
      const next: any = { ...prev }
      for (const f of HAVOC_FIELDS) {
        const v = (saved as any)[f]
        if (v !== undefined) next[f] = v
      }
      next.teams = teams
      return next
    })
  }

  // ── Broadcast source model (Phase 12) ──────────────────────────────────────
  // Three whole-snapshot sources — LOCAL (:7103/ws/broadcast) > BRIDGE
  // (/ws/live) > MIRROR (Supabase live:<room>). Frames are stored per source
  // and ONE selector (src/lib/sourceSelection.ts) decides which COMPLETE
  // snapshot is displayed. Never field-merged.
  type SourceIdT = 'local' | 'bridge' | 'mirror'
  // DEFAULT BRIDGE = the SAME instance the desktop producer and LiveGame
  // producer controls use (Render). The old localhost:7180 default split the
  // transport: producer commands went to Render while OBS listened to the
  // local bridge — buttons "succeeded" but OBS never saw the event.
  const bridgeWsUrl =
    new URLSearchParams(window.location.search).get('bridgeWs') || 'wss://hu-bridge.onrender.com/ws/live'
  // LOCAL-first is automatic when the bridge itself is on this machine
  // (production PC running the local bridge). Remote OBS (default Render
  // bridgeWs) never probes 127.0.0.1:7103. ?local=1 forces local-first
  // regardless; ?local=0 disables.
  const localParam = new URLSearchParams(window.location.search).get('local')
  const bridgeIsLocal = /localhost|127\.0\.0\.1/.test(bridgeWsUrl)
  const wantLocalSource = localParam === '1' || (localParam === null && bridgeIsLocal)
  const srcFramesRef = useRef<Partial<Record<SourceIdT, any>>>({})
  const srcSlotsRef = useRef<Partial<Record<SourceIdT, { connected: boolean; observedAt: number; lastAt: number; freshSince?: number }>>>({})
  const sourceOfTruthRef = useRef<'local' | 'bridge' | 'mirror' | null>(null)
  const displayedObsRef = useRef(0)
  const lastAppliedFrameRef = useRef<any>(null)
  const [sourceOfTruth, setSourceOfTruth] = useState<'local' | 'bridge' | 'mirror' | null>(null)

  const publishSourceDiagnostics = () => {
    // Internal diagnostics only — no credentials or secrets.
    const s = srcSlotsRef.current
    const f = srcFramesRef.current
    ;(window as any).__HU_SOURCES = {
      sourceOfTruth: sourceOfTruthRef.current,
      localConnected: !!s.local?.connected,
      localLastObservedAt: s.local?.observedAt ?? null,
      localLastRevision: (f.local?.snapshot?.revision as number) ?? null,
      bridgeConnected: !!s.bridge?.connected,
      bridgeLastObservedAt: s.bridge?.observedAt ?? null,
      bridgeLastRevision: (f.bridge?.snapshot?.revision as number) ?? null,
      mirrorLastObservedAt: s.mirror?.observedAt ?? null,
      mirrorLastRevision: (f.mirror?.snapshot?.revision as number) ?? null,
    }
  }

  const setSourceConnected = (id: SourceIdT, connected: boolean) => {
    const slot = srcSlotsRef.current[id] || { observedAt: 0, lastAt: 0, freshSince: 0 }
    srcSlotsRef.current[id] = { ...slot, connected }
    if (connected) slot.freshSince = Date.now()
    publishSourceDiagnostics()
    runSelection()
  }

  const updateSource = (id: SourceIdT, frame: any) => {
    if (!frame) return
    const now = Date.now()
    const observedAt = Number(frame?.snapshot?.state?.observedAt ?? frame?.updatedAt ?? 0)
    const slot = srcSlotsRef.current[id]
    const wasFresh = slot ? now - slot.lastAt <= 10_000 : false
    srcFramesRef.current[id] = frame
    srcSlotsRef.current[id] = {
      connected: true,
      observedAt,
      lastAt: now,
      freshSince: wasFresh ? slot?.freshSince ?? now : now,
    }
    publishSourceDiagnostics()
    runSelection()
  }

  const runSelection = () => {
    const now = Date.now()
    const pick = pickSource(srcSlotsRef.current as any, {
      now,
      current: sourceOfTruthRef.current,
      displayedObservedAt: displayedObsRef.current,
    })
    if (!pick.source) return
    const frame = srcFramesRef.current[pick.source]
    if (!frame) return
    const changed = pick.source !== sourceOfTruthRef.current || frame !== lastAppliedFrameRef.current
    if (!changed) return
    const obs = Number(frame?.snapshot?.state?.observedAt ?? frame?.updatedAt ?? 0)
    if (sourceOfTruthRef.current && obs && obs < displayedObsRef.current && pick.reason !== 'failover-down') return
    sourceOfTruthRef.current = pick.source
    displayedObsRef.current = obs || displayedObsRef.current
    lastAppliedFrameRef.current = frame
    setSourceOfTruth(pick.source)
    setIsLocalTransport(pick.source === 'local' || (pick.source === 'bridge' && bridgeIsLocal))
    lastUpdateRef.current = now
    hasEverHadDataRef.current = true
    setLiveScores(frame)
    console.debug('[HU sources]', pick.source, '<=', pick.reason, 'observedAt', obs)
  }
  useEffect(() => {
    const t = setInterval(runSelection, 1000)
    return () => clearInterval(t)
  }, [])

  // Subscribe to the bridge's live snapshot mirror
  useEffect(() => {
    if (!roomCode) return
    const key = `live:${roomCode}`
    let cancelled = false
    const channel = supabase
      .channel(`live-overlay-${roomCode}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_settings', filter: `id=eq.${key}` },
        (payload) => {
          const value = (payload.new as any)?.value
          if (value && !cancelled) updateSource('mirror', value)
        },
      )
      .subscribe()
    supabase
      .from('site_settings')
      .select('value')
      .eq('id', key)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data?.value) updateSource('mirror', data.value as any)
      })
    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [roomCode])

  // High-Frequency Local OBS WebSocket Driver (Sub-20ms Latency fallback to Supabase)
  useEffect(() => {
    let ws: WebSocket | null = null
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null
    let isMounted = true

    const connectLocalWs = () => {
      if (!isMounted) return
      try {
        ws = new WebSocket(bridgeWsUrl)
        ws.onopen = () => {
          if (!isMounted) return
          setIsLocalTransport(true)
          setSourceConnected('bridge', true)
          console.log('[OBS-Driver] Connected directly to local bridge:', bridgeWsUrl)
        }
        ws.onmessage = (evt) => {
          if (!isMounted) return
          try {
            const data = JSON.parse(evt.data)
            if (data && (data.snapshot || data.scores || data.updatedAt)) {
              updateSource('bridge', data)
            }
          } catch {}
        }
        ws.onerror = () => {
          if (ws) ws.close()
        }
        ws.onclose = () => {
          if (!isMounted) return
          setIsLocalTransport(false)
          setSourceConnected('bridge', false)
          reconnectTimeout = setTimeout(connectLocalWs, 5000)
        }
      } catch {
        setIsLocalTransport(false)
        reconnectTimeout = setTimeout(connectLocalWs, 5000)
      }
    }

    connectLocalWs()

    return () => {
      isMounted = false
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
      if (ws) ws.close()
    }
  }, [])

  // ── Local authoritative source (automatic local-first; ?local=0 disables) ──
  // Consumes the desktop HudServer's broadcast channel (:7103/ws/broadcast),
  // which pushes the SAME revisioned GameSnapshot the bridge distributes.
  // Whole-snapshot switching only — never field-merged with bridge/mirror.
  useEffect(() => {
    if (!wantLocalSource) return
    let ws: WebSocket | null = null
    let reconnect: ReturnType<typeof setTimeout> | null = null
    let isMounted = true
    const connect = () => {
      if (!isMounted) return
      try {
        ws = new WebSocket('ws://127.0.0.1:7103/ws/broadcast')
        ws.onopen = () => {
          if (!isMounted) return
          setSourceConnected('local', true)
        }
        ws.onmessage = (evt) => {
          if (!isMounted) return
          try {
            const frame = JSON.parse(evt.data)
            if (frame?.kind !== 'broadcast' || !frame.snapshot) return
            const st = frame.snapshot.state || {}
            updateSource('local', {
              snapshot: frame.snapshot,
              updatedAt: frame.observedAt ?? Date.now(),
              scores: st.gameScore
                ? { roundLeft: st.gameScore.left, roundRight: st.gameScore.right, roundNumber: st.currentRound?.roundNumber }
                : undefined,
            })
          } catch {}
        }
        ws.onclose = () => {
          if (!isMounted) return
          setSourceConnected('local', false)
          reconnect = setTimeout(connect, 2000)
        }
        ws.onerror = () => ws?.close()
      } catch {
        reconnect = setTimeout(connect, 2000)
      }
    }
    connect()
    return () => {
      isMounted = false
      if (reconnect) clearTimeout(reconnect)
      if (ws) ws.close()
    }
  }, [])

  // Load the tournament workspace (teams/players/sponsors) saved by the
  // dashboard under site_settings key `broadcast:<tournamentId>`. The room
  // code embeds the first 8 chars of the tournament id:
  //   HAVOC-<tid8>-<rand>
  useEffect(() => {
    if (!roomCode) return
    const tid8 = (roomCode.split('-')[1] || '').toUpperCase()
    if (!tid8) return
    let cancelled = false

    const resolve = async () => {
      // Fast path: the dashboard mirrors its workspace under the room code.
      try {
        const { data: direct } = await supabase
          .from('site_settings')
          .select('value')
          .eq('id', `broadcast-room:${roomCode}`)
          .maybeSingle()
        console.debug('[overlay] direct havoc:', direct?.value ? ('found, ' + ((direct.value.teams || []).length) + ' teams') : 'none')
        if (direct?.value) {
          applyHavoc(direct.value)
          return
        }
      } catch { /* fall through to tournament lookup */ }
      try {
        const { data: tournaments } = await supabase.from('tournaments').select('id')
        const match = (tournaments || []).find((t: any) =>
          String(t.id).replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase() === tid8)
        if (!match || cancelled) return
        fullTournamentIdRef.current = match.id as string
        const { data } = await supabase
          .from('site_settings')
          .select('value')
          .eq('id', `broadcast:${match.id}`)
          .maybeSingle()
        applyHavoc(data?.value)
      } catch { /* best-effort */ }
    }
    void resolve()

    // Live refresh: when the dashboard hits "Save", the broadcast havoc updates
    const channel = supabase
      .channel(`broadcast-overlay-${roomCode}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_settings', filter: `id=eq.broadcast-room:${roomCode}` },
        (payload) => {
          applyHavoc((payload.new as any)?.value)
        },
      )
      .subscribe()
    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode])

  // Scale the fixed 1920x1080 stage to fit the window
  useEffect(() => {
    const update = () => setScale(Math.min(window.innerWidth / 1920, window.innerHeight / 1080))
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // Self-healing polls: OBS suspends hidden sources & websockets can drop
  // silently â€” poll Supabase every 5s so the overlay recovers on its own.
  useEffect(() => {
    if (!roomCode) return
    const t = setInterval(() => {
      supabase.from('site_settings').select('value').eq('id', `live:${roomCode}`).maybeSingle()
        .then(({ data }) => { if (data?.value) updateSource('mirror', data.value as any) })
      supabase.from('site_settings').select('value').eq('id', `broadcast-room:${roomCode}`).maybeSingle()
        .then(({ data }) => { applyHavoc(data?.value) })
      supabase.from('site_settings').select('value').eq('id', `desktop:${roomCode}`).maybeSingle()
        .then(() => { /* presence hook handles its own; kept for warm-up */ })
    }, 5000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode])

  // Overlay popout mode: make html/body/#root transparent so the HUD composites
  // cleanly over the game (desktop anchored-transparent window / OBS source)
  useEffect(() => {
    document.documentElement.classList.add('overlay-popout')
    return () => document.documentElement.classList.remove('overlay-popout')
  }, [])

  const teamA = state.teams.find(t => t.id === state.teamAId) || state.teams[0] || null
  const teamB = state.teams.find(t => t.id === state.teamBId) || (state.teams.length > 1 ? state.teams[1] : null)

  // Scoreline: P1 order — a manual dashboard OVERRIDE wins (it exists exactly
  // to correct a bad live feed, per the Live Game copy); otherwise the live
  // snapshot (desktop bridge) wins when present; otherwise the dashboard
  // derived/manual state.
  const scores = liveScores?.scores
  const scoreLeft = state.scoreOverrideA ?? (scores ? Number(scores.roundLeft ?? 0) : state.scoreA)
  const scoreRight = state.scoreOverrideB ?? (scores ? Number(scores.roundRight ?? 0) : state.scoreB)
  const seriesLeft = scores ? Number(scores.seriesLeft ?? 0) : state.seriesScoreA
  const seriesRight = scores ? Number(scores.seriesRight ?? 0) : state.seriesScoreB
  const roundText = scores?.roundNumber != null ? `Round ${scores.roundNumber}` : (state.roundTitle || '')

  // (webcam block moved below: gated on live roster)

  // Shared roster mapping â€” carries agent/role fields for the scenes that use them
  // LIVE snapshot players win over dashboard rosters: only players actually
  // detected in the game (OCR/runtime) are rendered; empty sides stay hidden.
  const snapState = liveScores?.snapshot?.state || liveScores?.snapshot || null
  // Round clock: the desktop re-publishes roundTimer every second, but the
  // Supabase realtime path can lag — interpolate locally so the timer always
  // ticks smoothly between snapshots.
  const [, tickClock] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    const t = setInterval(tickClock, 250)
    return () => clearInterval(t)
  }, [tickClock])
  const timerRoundRef = useRef<number | null>(null)
  const timerHoldUntilRef = useRef(0)
  const timerText = (function () {
    // Round-clock hold: when the round number changes, the previous round's
    // last timer value may still be in flight — suppress the clock for 2s so
    // round 1 never shows a stale/unsynced time.
    const roundNow = Number((snapState as any)?.roundNumber ?? scores?.roundNumber ?? 0)
    if (timerRoundRef.current !== null && roundNow !== timerRoundRef.current) timerHoldUntilRef.current = Date.now() + 2000
    timerRoundRef.current = roundNow
    if (Date.now() < timerHoldUntilRef.current) return undefined
    const base = (snapState as any)?.roundTimer
    if (typeof base !== 'number' || !isFinite(base) || base <= 0) return undefined
    const elapsed = Math.max(0, Math.floor((Date.now() - ((liveScores as any)?.updatedAt ?? Date.now())) / 1000))
    const remaining = Math.max(0, Math.floor(base) - elapsed)
    const m = Math.floor(remaining / 60)
    const s = remaining % 60
    return `${m}:${String(s).padStart(2, '0')}`
  })()
  const snapPlayers = Array.isArray(snapState?.players) ? snapState.players : null
  // Buy phase: everyone is alive by definition — stale death evidence that
  // trails the round reset must never grey out the freshly mounted cards.
  const snapShopping = (snapState as any)?.roundPhase === 'shopping'
  const mapLivePlayers = (arr: any[]) => arr.map((p: any, idx: number) => ({
    id: p.playerId || p.name || Math.random(),
    alias: p.name || p.alias || p.agentName || `Player ${idx + 1}`,
    agentKey: p.agentKey ?? null,
    abilityState: p.abilityState ?? null,
    riotId: p.tagline || '',
    agentName: p.agentName || p.character || p.agent || null,
    agent: p.agentName || p.character || p.agent || null,
    character: p.agentName || p.character || p.agent || null,
    role: null,
    img: null,
    photoUrl: null,
    avatarUrl: null,
    health: snapShopping ? 100 : (p.health ?? (p.isAlive === false ? 0 : 100)),
    isAlive: snapShopping ? true : (p.isAlive ?? ((p.health ?? 100) === 0 ? false : true)),
    // Real desktop protocol carries shieldType (0 none / 1 light 25 / 2 heavy 50
    // / 3 enemy-heavy 50 / 4 regen 25) — derive the armor bar values from it.
    armor: p.armor ?? (p.shieldType === 2 || p.shieldType === 3 ? 50 : p.shieldType === 1 || p.shieldType === 4 ? 25 : 0),
    armorType: p.armorType ?? (p.shieldType === 2 || p.shieldType === 3 ? 'Heavy' : p.shieldType === 1 || p.shieldType === 4 ? 'Light' : 'None'),
    credits: p.credits ?? p.money ?? null,
    spent: p.loadoutValue != null ? p.loadoutValue : null,
    // Authoritative spent/loadout (snapshot publishes spentCredits; tolerate
    // the legacy `spent`/`loadoutValue` spellings for compatibility).
    spentCredits: p.spentCredits ?? p.spent ?? p.loadoutValue ?? null,
    weaponName: p.weaponName || p.scoreboardWeaponInternal || p.weapon || null,
    shieldType: p.shieldType,
    currUltPoints: p.currUltPoints ?? p.ultPoints ?? p.ultimate ?? 0,
    ultPoints: p.ultPoints ?? p.currUltPoints ?? p.ultimate ?? 0,
    shield: p.shield ?? p.armor ?? 0,
    maxUltPoints: p.maxUltPoints ?? p.ultMax ?? p.ultimateMax ?? 8,
    hasSpike: Boolean(p.hasSpike),
    kills: p.kills ?? 0,
    deaths: p.deaths ?? 0,
    assists: p.assists ?? 0,
    // No fake weapon fallback — blank until GEP reports the real carried gun.
    weapon: p.weapon ?? p.weaponName ?? null,
    ultimate: p.ultimate ?? p.currUltPoints ?? p.ultPoints ?? 0,
    ultimateMax: p.ultimateMax ?? p.maxUltPoints ?? p.ultMax ?? 8,
    isUltReady: p.isUltReady ?? ((p.currUltPoints ?? p.ultPoints ?? 0) >= (p.maxUltPoints ?? p.ultMax ?? 8) && (p.maxUltPoints ?? p.ultMax ?? 8) > 0),
    abilities: p.abilities ?? [],
  }))
    // Team side: trust explicit startTeam/teamIndex, then the team id string.
  // Players with NO side evidence go LEFT only — never both sides.
  const sideOf = (p: any): 0 | 1 => {
    const st = p.startTeam ?? p.teamIndex
    if (st === 0 || st === 1) return st
    const tid = String(p.teamId ?? p.team ?? '').toLowerCase()
    if (tid === 'blue' || tid === 'team one' || tid === '1') return 0
    if (tid === 'red' || tid === 'team two' || tid === '2') return 1
    return 0
  }
  const liveLeft = snapPlayers ? snapPlayers.filter((p: any) => sideOf(p) === 0) : null
  const liveRight = snapPlayers ? snapPlayers.filter((p: any) => sideOf(p) === 1) : null
  // Sticky roster: transient empty-player frames (engine hiccups, scene
  // remounts) must never blank the team stats — keep the last real roster.
  const stickyRosterRef = useRef<{ left: any[]; right: any[] }>(loadStickyRoster())
  if (liveLeft && liveLeft.length > 0) stickyRosterRef.current.left = liveLeft
  if (liveRight && liveRight.length > 0) stickyRosterRef.current.right = liveRight
  saveStickyRoster(stickyRosterRef.current)

  // NOTE: the desktop ENGINE already re-anchors sides at halftime (the viewer
  // stays LEFT/blue for the whole match — see projection.ts re-anchor). This
  // overlay must NOT swap panels again: the old round>=13 swap double-applied
  // the flip and inverted every team attribution for rounds 13-24/37+ (wrong
  // winner block, wrong logo/name, DEFENDER WIN on your own logo, strip icons
  // on the wrong team, right-side name vanishing at OT). The engine is the
  // single source of truth for sides.
  const liveRoundNumber = (function () {
    const st = (snapState as any) || {}
    return Number(st?.round?.number ?? st?.currentRound?.roundNumber ?? st?.roundNumber ?? liveScores?.scores?.roundNumber ?? 0) || 0
  })()

  // New-match reset: GEP keeps the same match_id across games, so round 1
  // arriving after a played match (or a return to agent select) is the only
  // reliable signal — drop the previous game's roster so its score/KD never
  // bleeds into the next match.
  const lastRoundRef = useRef(0)
  const lastSceneRef = useRef<string | null>(null)
  const curEngineScene = String((snapState as any)?.scene || '')
  if (liveRoundNumber === 1 && lastRoundRef.current > 1) stickyRosterRef.current = { left: [], right: [] }
  if (curEngineScene === 'agent-select' && lastSceneRef.current && lastSceneRef.current !== 'agent-select') stickyRosterRef.current = { left: [], right: [] }
  saveStickyRoster(stickyRosterRef.current)
  if (liveRoundNumber > 0) lastRoundRef.current = liveRoundNumber
  if (curEngineScene) lastSceneRef.current = curEngineScene
  // LIVE map wins over the veto pick / defaults (the desktop publishes the
  // actual in-game map every snapshot). No hardcoded fallback: during agent
  // select of a NEW match the desktop clears the previous match's map at the
  // boundary, and showing 'Sunset'/the old splash until the real map arrives
  // was the reported "agent select map is incorrect" (live 2026-10-18).
  const liveMapKey = (snapState as any)?.mapKey || null
  const liveMapName = (snapState as any)?.mapName || pickedMap?.mapName || undefined
  const liveMapImage =
    pickedMap?.image ||
    (liveMapKey ? `/game/val/maps/${liveMapKey}/splash-small.png` : undefined)
  // Series map results: when the authoritative engine reports a completed
  // match (match.winner) and the current map's slot has no recorded result
  // yet, record its final score. SERIES state — survives Restart Active
  // Session, cleared only by the explicit series reset.
  const matchWinnerNow = (snapState as any)?.match?.winner ?? null
  const finishedRef = useRef<string | null>(null)
  // Sticky map key/name: the map may already be cleared on the very frame the
  // match winner lands (or the page loaded after it) — the series result must
  // still record, otherwise the in-game "map history" strip silently misses
  // that match (reported: "map history sometimes missing").
  const lastMapKeyRef = useRef<string | null>(null)
  const lastMapNameRef = useRef<string | null>(null)
  if (liveMapKey) lastMapKeyRef.current = liveMapKey
  if (liveMapName) lastMapNameRef.current = liveMapName
  const recordMapKey = liveMapKey || lastMapKeyRef.current
  const recordMapName = liveMapName || lastMapNameRef.current || recordMapKey
  if (matchWinnerNow && !finishedRef.current && recordMapKey && (scoreLeft ?? 0) + (scoreRight ?? 0) > 0) {
    finishedRef.current = String(recordMapKey)
    const results = state.mapResults || []
    const taken = new Set(results.map(r => r.slot))
    const pick = (state.mapPicks || []).find((p: any) => p.mapId === recordMapKey && !taken.has(p.slot))
    const slot = pick?.slot
      ?? (results.filter(r => r.slot !== 'decider').length === 0 ? 'map1'
        : results.filter(r => r.slot !== 'decider').length === 1 ? 'map2'
        : 'decider')
    if (!results.some(r => r.slot === slot)) {
      setStateSilent(prev => ({ ...prev, mapResults: [...(prev.mapResults || []), { slot, mapId: String(recordMapKey), mapName: recordMapName, score: `${scoreLeft ?? 0}-${scoreRight ?? 0}` }] }))
    }
  }
  if (!matchWinnerNow && finishedRef.current) finishedRef.current = null

  const viewerRole = String((snapState as any)?.viewerRole ?? '').toLowerCase()
  const spectating = viewerRole === 'observer' || viewerRole === 'spectator' || viewerRole === 'coach'
  const leftPlayers = stickyRosterRef.current.left.length > 0 ? mapLivePlayers(stickyRosterRef.current.left) : []
  const rightPlayers = stickyRosterRef.current.right.length > 0 ? mapLivePlayers(stickyRosterRef.current.right) : []

  // ===== Panel identity auto-match =====
  // GEP anchors the VIEWER'S team to blue/left for the whole match, but the
  // dashboard's Team A / Team B order has no guaranteed relation to that — a
  // mismatch put the wrong name/logo/color on every panel ("DEFENDER WIN" with
  // MY logo, strip icons on the wrong team, my score under the enemy's name).
  // Match workspace teams to the live rosters by player-name overlap; the
  // dashboard order is only the fallback. Sticky so one odd frame can't flip.
  const panelSideRef = useRef<'A' | 'B' | null>(null)
  if (leftPlayers.length > 0 && rightPlayers.length > 0) {
    const norm = (v: string) => String(v || '').split('#')[0].trim().toLowerCase()
    const leftNames = new Set(leftPlayers.map((p: any) => norm(p.alias || p.name || p.riotId)))
    const overlap = (team: any) => (team?.players || []).filter((p: any) => {
      const candidates = [p?.riotId, p?.alias, p?.name].map((v: any) => norm(v))
      return candidates.some((v: string) => leftNames.has(v))
    }).length
    const aLeft = overlap(teamA)
    const bLeft = overlap(teamB)
    if (aLeft !== bLeft) panelSideRef.current = aLeft > bLeft ? 'A' : 'B'
  }
  const leftTeam = panelSideRef.current === 'B' ? teamB : teamA
  const rightTeam = panelSideRef.current === 'B' ? teamA : teamB

  // Team-attributed props under the side swap (everything moves with the
  // panel: names, colors, logos, round + series scores, rosters).
  const baseLeftName = leftTeam?.name || (snapState as any)?.leftTeam?.name || 'TEAM A'
  const baseRightName = rightTeam?.name || (snapState as any)?.rightTeam?.name || 'TEAM B'
  const baseLeftColor = leftTeam?.color || '#28D091'
  const baseRightColor = rightTeam?.color || '#FF3549'
  const hudLeftName = baseLeftName
  const hudRightName = baseRightName
  const hudLeftColor = baseLeftColor
  const hudRightColor = baseRightColor
  const hudLeftPlayers = leftPlayers
  const hudRightPlayers = rightPlayers
  const hudScoreLeft = scoreLeft
  const hudScoreRight = scoreRight
  const hudSeriesLeft = seriesLeft
  const hudSeriesRight = seriesRight
  const hudLeftLogo = leftTeam?.logoUrl || null
  const hudRightLogo = rightTeam?.logoUrl || null
  // User-configured sponsor, cycled (see sponsorList above).
  const sponsorImageUrl = sponsorCycleUrl
  // Tournament/event logo (workspace-configured) — used by the round ceremony
  // and post-game; falls back to the bundled Game Event / Sponsor-1 assets.
  const tournamentLogoUrl = (state.tournamentLogoUrls || []).find((u: any): u is string =>
    typeof u === 'string' && (/^https:\/\//i.test(u) || u.startsWith('data:image/'))) || null
  const hudLeftSeed = (leftTeam as any)?.seed
  const hudRightSeed = (rightTeam as any)?.seed
  const baseRoundEnd = (snapState as any)?.roundEnd || null
  const hudRoundEnd = baseRoundEnd
  const baseRoundHistory = ((snapState as any)?.roundHistory || []) as Array<{ round: number; winner: 'blue' | 'red'; reason: string }>
  const hudRoundHistory = baseRoundHistory
  // ValoSpectra endround parity: label the round win by SIDE. GEP native team 0
  // starts on attack; sides flip every 12 rounds (rounds 1-12 / 13-24, OT ignored).
  // Round number for the side-label fallback: the snapshot nests it under
  // currentRound.roundNumber — the flat field does not exist in the broadcast
  // snapshot, so the old lookup here was ALWAYS null (label vanished).
  const nativeRoundNumber = (snapState as any)?.currentRound?.roundNumber
    ?? (snapState as any)?.roundNumber
    ?? scores?.roundNumber
    ?? liveRoundNumber
    ?? null
  // ValoSpectra endround parity: label the round win by SIDE. Ground truth
  // first — roundEnd.winnerSide is stamped by the engine from the snapshot's
  // team startingSide; then the live viewerSide fact; the round-parity
  // heuristic is the last fallback only.
  // ValoSpectra endround parity: label the round win by SIDE. Ground truth
  // first — roundEnd.winnerSide is stamped by the engine; then derive the
  // WINNING team's side from the viewer's live side (viewer = blue, so the
  // raw viewer side is only the winner's side when blue won — using it raw
  // inverted the ATTACKER/DEFENDER label whenever the enemy won).
  const liveViewerSide = (snapState as any)?.viewerSide as 'attack' | 'defense' | null
  // Chain: engine-stamped winnerSide (session-snapshot startingSide ground
  // truth) → winner-aware flip from the live side fact → start-side
  // derivation from the round window. NEVER the old "team_0 attacked first"
  // parity guess (inverted for every defense-start player).
  const roundWinnerSide = (baseRoundEnd as any)?.winnerSide
    ?? winnerSideFromViewer(baseRoundEnd?.winner ?? null, liveViewerSide)
    ?? winnerSideFromStart(baseRoundEnd?.winner ?? null, (snapState as any)?.viewerStartSide, nativeRoundNumber ?? liveRoundNumber)
  const roundWinSide = roundWinnerSide === 'attacker' || roundWinnerSide === 'attack'
    ? 'ATTACKER WIN'
    : roundWinnerSide === 'defender' || roundWinnerSide === 'defense'
      ? 'DEFENDER WIN'
      : null // no side evidence → no label (never guess sides)
  // Round-ceremony text: a fresh bridge killBanner (FIRST BLOOD / ACE / CLUTCH /
  // TEAM ACE / THRIFTY — the bridge auto-clears it after 6s) wins, else the
  // engine's round-settlement ceremony from snapshot.state.gameEvent
  // (ROUND WIN / CLUTCH / ACE / TEAM ACE / FLAWLESS).
  const kb = (liveScores as any)?.killBanner || null
  const kbFresh = kb && kb.at && Date.now() - Number(kb.at) < 6000 ? kb : null
  const KB_TEXT: Record<string, string> = { ace: 'ACE', clutch: 'CLUTCH', thrifty: 'THRIFTY', 'team ace': 'TEAM ACE', flawless: 'FLAWLESS' }
  const ceremonyText = (kbFresh ? (KB_TEXT[String(kbFresh.type || '').toLowerCase()] || null) : null)
    || (((snapState as any)?.gameEvent as string | null) ? String((snapState as any).gameEvent).toUpperCase() : null)
  const ceremonyWinner: 'blue' | 'red' | null =
    hudRoundEnd?.winner ?? (kbFresh ? (kbFresh.team === 'right' ? 'red' : 'blue') : null)
  const ceremonyTrigger = hudRoundEnd
    ? `rd:${nativeRoundNumber ?? 0}:${hudRoundEnd.winner}`
    : (kbFresh ? `kb:${kbFresh.at}` : null)
  // Phantom-camera guard: only treat the configured player as a live publisher
  // when the desktop is connected AND they are in the current live roster.
  // Otherwise no camera box is rendered and no viewer connection is opened.
  const webcamPlayer = [...(teamA?.players || []), ...(teamB?.players || [])].find(p => p.webcamSource !== 'None' && state.cameraVisibility?.[p.id] !== false)
  const webcamPlayerInRoster = !!webcamPlayer && Array.isArray(snapPlayers) && snapPlayers.some((p: any) => String(p.playerId ?? p.name ?? '') === String(webcamPlayer.id))
  const webcamActive = !!webcamPlayer && desktopLive && webcamPlayerInRoster
  // Facecam footer K/D/A from the desktop snapshot (BLOB parity; no LIVE pill)
  const webcamStats = (() => {
    if (!webcamPlayer || !webcamPlayerInRoster || !Array.isArray(snapPlayers)) return null
    const p = (snapPlayers as any[]).find(x => String(x?.playerId ?? x?.name ?? '') === String(webcamPlayer.id))
    return p ? { kills: p.kills ?? 0, deaths: p.deaths ?? 0, assists: p.assists ?? 0 } : null
  })()
  const webcamStream = useWebcamViewer(roomCode, webcamActive ? (webcamPlayer?.id || null) : null)
  const EVENT_TEXT = {
    'val:spike_defused': 'SPIKE DEFUSED',
    'val:spike_detonated': 'SPIKE DETONATED',
    'val:match_end': 'MATCH END',
    'val:tech_pause': 'TECH PAUSE',
    'val:pause': 'PAUSE',
  }
  const liveEventKind = liveScores?.event?.event || liveScores?.event?.kind || null
  // Expire the ceremony event 8s after it fired — the bridge keeps lastEvent
  // forever, which made the banner stick on screen ("stuck game event").
  const liveEventText = liveEventKind && liveScores?.event?.at && (Date.now() - Number(liveScores.event.at)) < 8000
    ? ((EVENT_TEXT as Record<string, string>)[liveEventKind] || null)
    : null

    const gamePhase = (function(){
    const st = snapState || {}
    return (
      st.roundPhase ||
      (st.roundInfo && st.roundInfo.roundPhase) ||
      st.phase ||
      (st.currentRound && st.currentRound.roundPhase) ||
      (st.isAgentSelectPhase === true ? 'game_start' : null) ||
      null
    )
  })()

  // Original-HAVOC behaviour: the browser source renders NOTHING (fully
  // transparent) until there is real data â€” desktop connected + snapshot,
  // or a saved tournament workspace. No demo players in OBS, ever.
  if (desktopLive || !!liveScores) hasEverHadDataRef.current = true
  if (!hasEverHadDataRef.current) {
    return null
  }

  // Panic hide (#3): if overlayHidden flag is set by bridge control API, render nothing
  if (overlayHidden) {
    return null
  }

  // Restored-from-cache state not yet confirmed by live runtime frames —
  // never present a stale previous match as the live game.
  if ((snapState as any)?.restorePending === true) {
    return null
  }

  // Extract new bridge state fields for overlay components
  const liveTimeout = liveScores?.timeout || null
  const liveEconomy = liveScores?.economy || null
  const liveMvpPlayer = liveScores?.mvpPlayer || null
  const liveCasterCards = liveScores?.casterCards || null
  // Map-ban scene slots from the EXECUTED veto (kinds/teams/sides in real
  // order). The raw mapBans/mapPicks arrays carry no `kind`, which made every
  // overlay card render as "PICK" with a phantom decider in OBS.
  const overlayMapSlots = (state.vetoSteps || [])
    .filter((s: any) => !!s.map)
    .map((s: any) => {
      const v = VAL_MAPS.find(m => m.mapId === s.map)
      return {
        mapName: (v?.mapName || String(s.map)) as string,
        image: (v?.image || '') as string,
        kind: (s.action === 'Ban' ? 'ban' : s.action === 'Decider' ? 'decider' : 'pick') as 'ban' | 'pick' | 'decider',
        team: (s.action === 'Decider' ? 'DECIDER' : s.team) as string,
        side: (s.side === 'Offense' || s.side === 'Defense' ? s.side : undefined) as 'Offense' | 'Defense' | undefined,
      }
    })
  const liveCurrentlyObserving = liveScores?.currentlyObserving || (snapState as any)?.currentlyObserving || null
  // The engine sends spike as a plain string ('planted' | 'defused' |
  // 'detonated' | null) — never an object; consume both shapes safely.
  const spikeRaw = (liveScores as any)?.spike ?? (snapState as any)?.spike ?? null
  const spikeSite = ((spikeRaw && typeof spikeRaw === 'object' && spikeRaw.site) || (snapState as any)?.plantSite || null) as string | null
  const spikeState = (typeof spikeRaw === 'string' ? spikeRaw : (spikeRaw?.state ?? null) || ((snapState as any)?.bombPlanted ? 'planted' : null) || ((snapState as any)?.plantSite ? 'planted' : null)) as 'none' | 'planted' | 'defusing' | null

  return (
    <div data-source-of-truth={sourceOfTruth ?? ''} style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: 'transparent' }}>
      {/* Scene-change fade — must live OUTSIDE any conditional render (it used
          to sit inside the stale badge, so the animation never played). */}
      <style>{`.scene-fade { animation: sceneFade 320ms ease; will-change: opacity, transform; } @keyframes sceneFade { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }`}</style>
      {/* Spectator badge: shown while the desktop reports an observing role */}
      {spectating && (
        <div style={{
          position: 'fixed', top: 12, left: 12, zIndex: 9998,
          fontSize: 12, fontWeight: 800, letterSpacing: 1, color: '#FFD166',
          border: '1px solid #FFD16666', borderRadius: 4, padding: '2px 10px',
          background: 'rgba(0,0,0,0.6)', pointerEvents: 'none',
        }}>SPECTATING</div>
      )}
      {/* Stale-data reconnecting badge (#1) */}
      {isStale && (
        <div style={{
          position: 'fixed', top: 12, right: 12, zIndex: 9999,
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', borderRadius: 6,
          background: 'rgba(0,0,0,0.8)', border: '1px solid #FF6B35',
          fontFamily: 'Barlow Condensed, sans-serif', fontSize: 12,
          color: '#FF6B35', fontWeight: 600, letterSpacing: '0.05em',
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FF6B35', animation: 'timeout-blink 1s ease-in-out infinite' }} />
          RECONNECTING…
          <style>{`@keyframes timeout-blink { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
        </div>
      )}
      {/* Desktop connection badge (top-right, subtle) */}
      <div
        className="hud-stage"
        style={{
          width: 1920,
          height: 1080,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          position: 'absolute',
          left: `calc(50% - ${(1920 * scale) / 2}px)`,
          top: `calc(50% - ${(1080 * scale) / 2}px)`,
        }}
      >
        <div key={sceneKey} className="scene-fade">
        {(sceneKey === 'default' || sceneKey === 'ingame-hud') && liveScores && gamePhase === 'shopping' && (
          <BuyRoundScene
            leftTeamName={hudLeftName}
            rightTeamName={hudRightName}
            leftTeamSeed={hudLeftSeed}
            rightTeamSeed={hudRightSeed}
            leftTeamColor={hudLeftColor}
            rightTeamColor={hudRightColor}
            leftTeamPlayers={hudLeftPlayers}
            rightTeamPlayers={hudRightPlayers}
            economy={liveEconomy}
            sponsorImageUrl={sponsorImageUrl}
            roundHistory={hudRoundHistory}
          />
        )}
        {(sceneKey === 'default' || sceneKey === 'ingame-hud') && liveScores && gamePhase === 'game_start' && (
          <AgentSelectScene
            leftTeamName={hudLeftName}
            rightTeamName={hudRightName}
            leftTeamColor={hudLeftColor}
            rightTeamColor={hudRightColor}
            mapName={liveMapName}
            mapImage={liveMapImage}
            leftTeamPlayers={hudLeftPlayers}
            rightTeamPlayers={hudRightPlayers}
            leftTeamLogo={hudLeftLogo}
            rightTeamLogo={hudRightLogo}
          />
        )}
        {(sceneKey === 'default' || sceneKey === 'ingame-hud') && !(liveScores && (gamePhase === 'shopping' || gamePhase === 'game_start')) && (
          <IngameHudScene
            leftTeamName={hudLeftName}
            rightTeamName={hudRightName}
            leftTeamSeed={hudLeftSeed}
            rightTeamSeed={hudRightSeed}
            leftTeamColor={hudLeftColor}
            rightTeamColor={hudRightColor}
            scoreLeft={hudScoreLeft}
            scoreRight={hudScoreRight}
            seriesScoreLeft={hudSeriesLeft}
            seriesScoreRight={hudSeriesRight}
            bestOf={Number(state.matchFormat) || state.bestOf || 3}
            roundText={roundText}
            timerText={timerText}
            seriesTitleText={state.seriesTitle || ''}
            eventTitleText={state.eventTitle || ''}
            gameSeriesText={state.gameSeries || ''}
            leftTeamLogo={hudLeftLogo}
            rightTeamLogo={hudRightLogo}
            mapHistoryItems={buildMapHistoryItems(state.mapPicks, state.mapBans, state.vetoSelectedMapIds, state.mapResults)}
            webcamPlayerName={webcamPlayer?.alias || ''}
            webcamPlayerPhoto={webcamActive ? (webcamPlayer?.avatarUrl || null) : null}
            webcamActive={webcamActive}
            webcamPlayerStats={webcamStats}
            webcamStream={webcamStream}
            localPlayerName={(snapState as any)?.viewerName ?? null}
            liveOnly={true}
            gameEvent={liveEventText}
            winSide={roundWinSide}
            sponsorImageUrl={sponsorImageUrl}
            tournamentLogo={tournamentLogoUrl}
            ceremonyText={ceremonyText}
            ceremonyTrigger={ceremonyTrigger}
            ceremonyWinner={ceremonyWinner}
            roundEnd={hudRoundEnd}
            roundNumber={liveRoundNumber || null}
            currentlyObserving={liveCurrentlyObserving}
            spectating={spectating}
            spikeSite={spikeSite}
            spikeState={spikeState}
            spikePlantedAt={(snapState as any)?.round?.spikePlantedAt ?? null}
            leftTeamPlayers={hudLeftPlayers}
            rightTeamPlayers={hudRightPlayers}
          />
        )}
        {sceneKey === 'agent-select' && (
          <AgentSelectScene
            leftTeamName={hudLeftName}
            rightTeamName={hudRightName}
            leftTeamColor={hudLeftColor}
            rightTeamColor={hudRightColor}
            mapName={liveMapName}
            mapImage={liveMapImage}
            leftTeamPlayers={hudLeftPlayers}
            rightTeamPlayers={hudRightPlayers}
            leftTeamLogo={hudLeftLogo}
            rightTeamLogo={hudRightLogo}
          />
        )}
        {sceneKey === 'buy-round' && (
          <BuyRoundScene
            leftTeamName={hudLeftName}
            rightTeamName={hudRightName}
            leftTeamColor={hudLeftColor}
            rightTeamColor={hudRightColor}
            leftTeamPlayers={hudLeftPlayers}
            rightTeamPlayers={hudRightPlayers}
            economy={liveEconomy}
            sponsorImageUrl={sponsorImageUrl}
            roundHistory={hudRoundHistory}
          />
        )}
        {sceneKey === 'map-ban' && (
          <MapBanScene
            key={`map-ban-${state.vetoReplayRun || 0}`}
            leftTeamName={leftTeam?.name || (snapState as any)?.leftTeam?.name || 'TEAM A'}
            rightTeamName={rightTeam?.name || (snapState as any)?.rightTeam?.name || 'TEAM B'}
            leftTeamColor={leftTeam?.color || '#28D091'}
            rightTeamColor={rightTeam?.color || '#FF3549'}
            leftTeamLogo={leftTeam?.logoUrl || null}
            rightTeamLogo={rightTeam?.logoUrl || null}
            mapSlots={overlayMapSlots.length ? overlayMapSlots : undefined}
            mapBans={(state.mapBans || []).map((m: any) => VAL_MAPS.find(v => v.mapId === m.mapId)).filter((v): v is (typeof VAL_MAPS)[number] => !!v)}
            mapPicks={(state.mapPicks || []).map((m: any) => VAL_MAPS.find(v => v.mapId === m.mapId)).filter((v): v is (typeof VAL_MAPS)[number] => !!v)}
            mapDecider={VAL_MAPS.find(v => v.mapId === state.vetoSelectedMapIds?.[0]) || undefined}
          />
        )}
        {sceneKey === 'post-game' && (
          <PostgameScene
            leftTeamName={leftTeam?.name || (snapState as any)?.leftTeam?.name || 'TEAM A'}
            rightTeamName={rightTeam?.name || (snapState as any)?.rightTeam?.name || 'TEAM B'}
            leftTeamColor={leftTeam?.color || '#28D091'}
            rightTeamColor={rightTeam?.color || '#FF3549'}
            leftTeamLogo={leftTeam?.logoUrl || null}
            rightTeamLogo={rightTeam?.logoUrl || null}
            scoreLeft={scoreLeft}
            scoreRight={scoreRight}
            leftTeamPlayers={leftPlayers}
            rightTeamPlayers={rightPlayers}
            allowDemo={false}
          />
        )}

        </div>

        {/* ====== NEW OVERLAY LAYERS (#4) ====== */}

        {/* Timeout overlay — shows during tactical timeouts and tech pauses */}
        <TimeoutOverlay
          timeout={liveTimeout}
          leftTeamName={leftTeam?.name || (snapState as any)?.leftTeam?.name || 'TEAM A'}
          rightTeamName={rightTeam?.name || (snapState as any)?.rightTeam?.name || 'TEAM B'}
          leftTeamColor={leftTeam?.color || '#28D091'}
          rightTeamColor={rightTeam?.color || '#FF3549'}
          leftTeamLogo={leftTeam?.logoUrl || null}
          rightTeamLogo={rightTeam?.logoUrl || null}
        />

        {/* (Kill banner / first-blood popup removed by request) */}

        {/* Caster cards — lower-third name plates */}
        <CasterCard
          casters={liveCasterCards}
          leftTeamColor={leftTeam?.color || '#28D091'}
        />

        {/* Economy tracker fallback if BuyRoundScene not active during shopping */}
        {sceneKey === 'ingame-hud' && gamePhase === 'shopping' && liveEconomy && (
          <div style={{ position: 'absolute', bottom: 295, left: 0, width: 1920, zIndex: 50 }}>
            <EconomyTracker
              economy={liveEconomy}
              leftTeamColor={leftTeam?.color || '#28D091'}
              rightTeamColor={rightTeam?.color || '#FF3549'}
              leftTeamName={leftTeam?.name || (snapState as any)?.leftTeam?.name || 'TEAM A'}
              rightTeamName={rightTeam?.name || (snapState as any)?.rightTeam?.name || 'TEAM B'}
            />
          </div>
        )}

        {/* Postgame MVP card (#17) */}
        {(sceneKey === 'post-game' || sceneKey === 'default') && liveMvpPlayer && (
          <PostgameMVP
            mvp={liveMvpPlayer}
            leftTeamName={leftTeam?.name || (snapState as any)?.leftTeam?.name || 'TEAM A'}
            rightTeamName={rightTeam?.name || (snapState as any)?.rightTeam?.name || 'TEAM B'}
            leftTeamColor={leftTeam?.color || '#28D091'}
            rightTeamColor={rightTeam?.color || '#FF3549'}
          />
        )}

        {/* Tournament Watermark Branding (#12) */}
        {state.watermark?.enabled && state.watermark?.imageUrl && (
          <div
            style={{
              position: 'absolute',
              zIndex: 90,
              top: state.watermark.position?.startsWith('top') ? 24 : undefined,
              bottom: state.watermark.position?.startsWith('bottom') ? 24 : undefined,
              left: state.watermark.position?.endsWith('left') ? 24 : undefined,
              right: state.watermark.position?.endsWith('right') ? 24 : undefined,
              opacity: state.watermark.opacity ?? 0.8,
              pointerEvents: 'none',
            }}
          >
            <img
              src={state.watermark.imageUrl}
              alt="Watermark"
              style={{
                width: state.watermark.size ?? 80,
                height: 'auto',
                objectFit: 'contain',
                filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.5))',
              }}
            />
          </div>
        )}
        {/* Broadcast In-Overlay Toast (#18) */}
        <OverlayToast toast={liveScores?.toast || null} />
      </div>
    </div>
  )
}

function useWebcamViewer(roomCode?: string, slotId?: string | null) {
  const [stream, setStream] = useState<MediaStream | null>(null)
  useEffect(() => {
    if (!roomCode || !slotId) return
    let dead = false
    let socket: any = null
    const st: { pc?: RTCPeerConnection; remotePeerId?: string } = {}
    const peerId = 'view_' + Math.random().toString(36).slice(2, 10)
    const origin = (import.meta as any).env?.VITE_BRIDGE_ORIGIN || 'https://hu-bridge.onrender.com'
    import('socket.io-client').then(({ io }) => {
      if (dead) return
      socket = io(origin, { transports: ['websocket', 'polling'] })
      const ensurePC = () => {
        if (!st.pc) {
          st.pc = new RTCPeerConnection()
          st.pc.ontrack = (e) => { if (!dead && e.streams[0]) setStream(e.streams[0]) }
          st.pc.onicecandidate = (e) => {
            if (e.candidate && socket && st.remotePeerId) socket.emit('webcam:signal', { to: st.remotePeerId, from: peerId, data: { candidate: e.candidate.toJSON() } })
          }
        }
        return st.pc!
      }
      socket.on('connect', () => socket.emit('webcam:join', { roomId: roomCode, peerId, role: 'viewer', slotId }))
      socket.on('webcam:signal', async (msg: any) => {
        if (!msg || msg.to !== peerId) return
        const d = msg.data || {}
        try {
          if (d.description && d.description.type === 'offer') {
            st.remotePeerId = msg.from
            const pc = ensurePC()
            await pc.setRemoteDescription(new RTCSessionDescription(d.description))
            const ans = await pc.createAnswer()
            await pc.setLocalDescription(ans)
            socket.emit('webcam:signal', { to: msg.from, from: peerId, data: { description: ans } })
          } else if (d.candidate) {
            await ensurePC().addIceCandidate(new RTCIceCandidate(d.candidate))
          }
        } catch { /* signaling race */ }
      })
    })
    return () => { dead = true; try { st.pc?.close() } catch {}; socket?.disconnect() }
  }, [roomCode, slotId])
  return stream
}


