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
    return (
      st.roundPhase ||
      (st.roundInfo && st.roundInfo.roundPhase) ||
      st.phase ||
      (st.currentRound && st.currentRound.roundPhase) ||
      (st.isAgentSelectPhase === true ? 'game_start' : null) ||
      null
    )
  })()
  const phaseDerivedScene =
    livePhase === 'game_end' ? 'post-game'
    : livePhase === 'shopping' ? 'buy-round'
    : livePhase === 'game_start' ? 'agent-select'
    : null
  const sceneKey =
    forceScene ? String(forceScene)
    : liveScene && ['agent-select', 'buy-round', 'ingame-hud', 'post-game', 'map-interstitial'].includes(String(liveScene))
      ? String(liveScene)
      : phaseDerivedScene
      ? phaseDerivedScene
      : urlSceneKey
  const [scale, setScale] = useState(1)
  const fullTournamentIdRef = useRef<string | null>(null)
  // Sticky: once we have shown real data, never blank out mid-stream.
  const hasEverHadDataRef = useRef(false)
  const lastRevRef = useRef(0)

  // Full-field authority: the room workspace havoc wins wholesale on overlay
  // pages (OBS/browser sources have no local workspace worth preserving).
  const HAVOC_FIELDS = ['teams','teamAId','teamBId','sponsors','mapPicks','connectedTournamentId',
    'scoreA','scoreB','seriesScoreA','seriesScoreB','roundTitle','eventTitle','seriesTitle',
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
          if (value && !cancelled) setLiveScores(value)
        },
      )
      .subscribe()
    supabase
      .from('site_settings')
      .select('value')
      .eq('id', key)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data?.value) setLiveScores(data.value as any)
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

    const bridgeWsUrl =
      new URLSearchParams(window.location.search).get('bridgeWs') || 'ws://localhost:7180/ws/live'

    const connectLocalWs = () => {
      if (!isMounted) return
      try {
        ws = new WebSocket(bridgeWsUrl)
        ws.onopen = () => {
          if (!isMounted) return
          setIsLocalTransport(true)
          console.log('[OBS-Driver] Connected directly to local bridge:', bridgeWsUrl)
        }
        ws.onmessage = (evt) => {
          if (!isMounted) return
          try {
            const data = JSON.parse(evt.data)
            if (data && (data.snapshot || data.scores || data.updatedAt)) {
              setLiveScores(data)
            }
          } catch {}
        }
        ws.onerror = () => {
          if (ws) ws.close()
        }
        ws.onclose = () => {
          if (!isMounted) return
          setIsLocalTransport(false)
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
        .then(({ data }) => { if (data?.value) setLiveScores(data.value as any) })
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

  // Scoreline: live snapshot (from the desktop via the bridge) wins when
  // present; otherwise fall back to the dashboard state (manual /
  // tournament_matches realtime via AppContext).
  const scores = liveScores?.scores
  const scoreLeft = scores ? Number(scores.roundLeft ?? 0) : state.scoreA
  const scoreRight = scores ? Number(scores.roundRight ?? 0) : state.scoreB
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
  const timerText = (function () {
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
    credits: p.credits ?? p.money ?? 800,
    spent: p.loadoutValue != null ? p.loadoutValue : null,
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
    weapon: p.weapon ?? p.scoreboardWeaponInternal ?? p.weaponKillfeedInternal ?? p.loadout ?? 'Classic',
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
  const stickyRosterRef = useRef<{ left: any[]; right: any[] }>({ left: [], right: [] })
  if (liveLeft && liveLeft.length > 0) stickyRosterRef.current.left = liveLeft
  if (liveRight && liveRight.length > 0) stickyRosterRef.current.right = liveRight

  // ===== Halftime / overtime side swap (automatic, VS parity) =====
  // VALORANT flips attack/defense sides every 12 rounds (and again in
  // overtime). The overlay mirrors the in-game HUD: the whole team panel
  // (name, color, logo, score, roster) moves to the other side.
  const liveRoundNumber = (function () {
    const st = (snapState as any) || {}
    return Number(st?.round?.number ?? st?.currentRound?.roundNumber ?? st?.roundNumber ?? liveScores?.scores?.roundNumber ?? 0) || 0
  })()
  const sideSwap = liveRoundNumber >= 13 && Math.floor((liveRoundNumber - 1) / 12) % 2 === 1

  // New-match reset: GEP keeps the same match_id across games, so round 1
  // arriving after a played match (or a return to agent select) is the only
  // reliable signal — drop the previous game's roster so its score/KD never
  // bleeds into the next match.
  const lastRoundRef = useRef(0)
  const lastSceneRef = useRef<string | null>(null)
  const curEngineScene = String((snapState as any)?.scene || '')
  if (liveRoundNumber === 1 && lastRoundRef.current > 1) stickyRosterRef.current = { left: [], right: [] }
  if (curEngineScene === 'agent-select' && lastSceneRef.current && lastSceneRef.current !== 'agent-select') stickyRosterRef.current = { left: [], right: [] }
  if (liveRoundNumber > 0) lastRoundRef.current = liveRoundNumber
  if (curEngineScene) lastSceneRef.current = curEngineScene
  // LIVE map wins over the veto pick / defaults (the desktop publishes the
  // actual in-game map every snapshot — 'Sunset' was a hardcoded fallback).
  const liveMapKey = (snapState as any)?.mapKey || null
  const liveMapName = (snapState as any)?.mapName || pickedMap?.mapName || 'Sunset'
  const liveMapImage =
    pickedMap?.image ||
    (liveMapKey ? `/game/val/maps/${liveMapKey}/splash-small.png` : '/game/val/maps/juliett/splash-small.png')
  const viewerRole = String((snapState as any)?.viewerRole ?? '').toLowerCase()
  const spectating = viewerRole === 'observer' || viewerRole === 'spectator' || viewerRole === 'coach'
  const leftPlayers = stickyRosterRef.current.left.length > 0 ? mapLivePlayers(stickyRosterRef.current.left) : []
  const rightPlayers = stickyRosterRef.current.right.length > 0 ? mapLivePlayers(stickyRosterRef.current.right) : []

  // Team-attributed props under the side swap (everything moves with the
  // panel: names, colors, logos, round + series scores, rosters).
  const baseLeftName = teamA?.name || (snapState as any)?.leftTeam?.name || 'TEAM A'
  const baseRightName = teamB?.name || (snapState as any)?.rightTeam?.name || 'TEAM B'
  const baseLeftColor = teamA?.color || '#28D091'
  const baseRightColor = teamB?.color || '#FF3549'
  const hudLeftName = sideSwap ? baseRightName : baseLeftName
  const hudRightName = sideSwap ? baseLeftName : baseRightName
  const hudLeftColor = sideSwap ? baseRightColor : baseLeftColor
  const hudRightColor = sideSwap ? baseLeftColor : baseRightColor
  const hudLeftPlayers = sideSwap ? rightPlayers : leftPlayers
  const hudRightPlayers = sideSwap ? leftPlayers : rightPlayers
  const hudScoreLeft = sideSwap ? scoreRight : scoreLeft
  const hudScoreRight = sideSwap ? scoreLeft : scoreRight
  const hudSeriesLeft = sideSwap ? seriesRight : seriesLeft
  const hudSeriesRight = sideSwap ? seriesLeft : seriesRight
  const hudLeftLogo = sideSwap ? (teamB?.logoUrl || null) : (teamA?.logoUrl || null)
  const hudRightLogo = sideSwap ? (teamA?.logoUrl || null) : (teamB?.logoUrl || null)
  const hudLeftSeed = sideSwap ? (teamB as any)?.seed : (teamA as any)?.seed
  const hudRightSeed = sideSwap ? (teamA as any)?.seed : (teamB as any)?.seed
  const flipWinner = (w: any) => (w === 'blue' ? 'red' : w === 'red' ? 'blue' : w)
  const baseRoundEnd = (snapState as any)?.roundEnd || null
  const hudRoundEnd = sideSwap && baseRoundEnd ? { ...baseRoundEnd, winner: flipWinner(baseRoundEnd.winner) } : baseRoundEnd
  const baseRoundHistory = ((snapState as any)?.roundHistory || []) as Array<{ round: number; winner: 'blue' | 'red'; reason: string }>
  const hudRoundHistory = sideSwap ? baseRoundHistory.map((h) => ({ ...h, winner: flipWinner(h.winner) })) : baseRoundHistory
  // Phantom-camera guard: only treat the configured player as a live publisher
  // when the desktop is connected AND they are in the current live roster.
  // Otherwise no camera box is rendered and no viewer connection is opened.
  const webcamPlayer = [...(teamA?.players || []), ...(teamB?.players || [])].find(p => p.webcamSource !== 'None' && state.cameraVisibility?.[p.id] !== false)
  const webcamPlayerInRoster = !!webcamPlayer && Array.isArray(snapPlayers) && snapPlayers.some((p: any) => String(p.playerId ?? p.name ?? '') === String(webcamPlayer.id))
  const webcamActive = !!webcamPlayer && desktopLive && webcamPlayerInRoster
  const webcamStream = useWebcamViewer(roomCode, webcamActive ? (webcamPlayer?.id || null) : null)
  const EVENT_TEXT = {
    'val:spike_defused': 'SPIKE DEFUSED',
    'val:spike_detonated': 'SPIKE DETONATED',
    'val:match_end': 'MATCH END',
    'val:match_start': 'MATCH START',
    'val:tech_pause': 'TECH PAUSE',
    'val:pause': 'PAUSE',
  }
  const liveEventKind = liveScores?.event?.event || liveScores?.event?.kind || null
  const liveEventText = liveEventKind ? ((EVENT_TEXT as Record<string, string>)[liveEventKind] || null) : null

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

  // Extract new bridge state fields for overlay components
  const liveTimeout = liveScores?.timeout || null
  const liveEconomy = liveScores?.economy || null
  const liveMvpPlayer = liveScores?.mvpPlayer || null
  const liveCasterCards = liveScores?.casterCards || null
  const liveCurrentlyObserving = liveScores?.currentlyObserving || (snapState as any)?.currentlyObserving || null
  const liveSpike = liveScores?.spike || (snapState as any)?.spike || null
  const spikeSite = liveSpike?.site || (snapState as any)?.plantSite || null
  const spikeState = (liveSpike?.state || (snapState?.bombPlanted ? 'planted' : null)) as 'none' | 'planted' | 'defusing' | null

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: 'transparent' }}>
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
            mapHistoryItems={buildMapHistoryItems(state.mapPicks, state.mapBans, state.vetoSelectedMapIds)}
            webcamPlayerName={webcamActive ? (webcamPlayer?.alias || 'No camera') : ''}
            webcamPlayerPhoto={webcamActive ? (webcamPlayer?.avatarUrl || null) : null}
            webcamActive={webcamActive}
            webcamStream={webcamStream}
            liveOnly={true}
            gameEvent={liveEventText}
            roundEnd={hudRoundEnd}
            roundNumber={snapState?.currentRound?.roundNumber ?? snapState?.roundNumber ?? null}
            currentlyObserving={liveCurrentlyObserving}
            spectating={spectating}
            spikeSite={spikeSite}
            spikeState={spikeState}
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
            roundHistory={hudRoundHistory}
          />
        )}
        {sceneKey === 'map-ban' && (
          <MapBanScene
            leftTeamName={teamA?.name || (snapState as any)?.leftTeam?.name || 'TEAM A'}
            rightTeamName={teamB?.name || (snapState as any)?.rightTeam?.name || 'TEAM B'}
            leftTeamColor={teamA?.color || '#28D091'}
            rightTeamColor={teamB?.color || '#FF3549'}
            leftTeamLogo={teamA?.logoUrl || null}
            rightTeamLogo={teamB?.logoUrl || null}
            mapBans={(state.mapBans || []).map((m: any) => VAL_MAPS.find(v => v.mapId === m.mapId)).filter((v): v is (typeof VAL_MAPS)[number] => !!v)}
            mapPicks={(state.mapPicks || []).map((m: any) => VAL_MAPS.find(v => v.mapId === m.mapId)).filter((v): v is (typeof VAL_MAPS)[number] => !!v)}
            mapDecider={VAL_MAPS.find(v => v.mapId === state.vetoSelectedMapIds?.[0]) || undefined}
          />
        )}
        {sceneKey === 'post-game' && (
          <PostgameScene
            leftTeamName={teamA?.name || (snapState as any)?.leftTeam?.name || 'TEAM A'}
            rightTeamName={teamB?.name || (snapState as any)?.rightTeam?.name || 'TEAM B'}
            leftTeamColor={teamA?.color || '#28D091'}
            rightTeamColor={teamB?.color || '#FF3549'}
            scoreLeft={scoreLeft}
            scoreRight={scoreRight}
            leftTeamPlayers={leftPlayers}
            rightTeamPlayers={rightPlayers}
          />
        )}

        {/* ====== NEW OVERLAY LAYERS (#4) ====== */}

        {/* Timeout overlay — shows during tactical timeouts and tech pauses */}
        <TimeoutOverlay
          timeout={liveTimeout}
          leftTeamName={teamA?.name || (snapState as any)?.leftTeam?.name || 'TEAM A'}
          rightTeamName={teamB?.name || (snapState as any)?.rightTeam?.name || 'TEAM B'}
          leftTeamColor={teamA?.color || '#28D091'}
          rightTeamColor={teamB?.color || '#FF3549'}
        />

        {/* (Kill banner / first-blood popup removed by request) */}

        {/* Caster cards — lower-third name plates */}
        <CasterCard
          casters={liveCasterCards}
          leftTeamColor={teamA?.color || '#28D091'}
        />

        {/* Economy tracker fallback if BuyRoundScene not active during shopping */}
        {sceneKey === 'ingame-hud' && gamePhase === 'shopping' && liveEconomy && (
          <div style={{ position: 'absolute', bottom: 295, left: 0, width: 1920, zIndex: 50 }}>
            <EconomyTracker
              economy={liveEconomy}
              leftTeamColor={teamA?.color || '#28D091'}
              rightTeamColor={teamB?.color || '#FF3549'}
              leftTeamName={teamA?.name || (snapState as any)?.leftTeam?.name || 'TEAM A'}
              rightTeamName={teamB?.name || (snapState as any)?.rightTeam?.name || 'TEAM B'}
            />
          </div>
        )}

        {/* Postgame MVP card (#17) */}
        {(sceneKey === 'post-game' || sceneKey === 'default') && liveMvpPlayer && (
          <PostgameMVP
            mvp={liveMvpPlayer}
            leftTeamName={teamA?.name || (snapState as any)?.leftTeam?.name || 'TEAM A'}
            rightTeamName={teamB?.name || (snapState as any)?.rightTeam?.name || 'TEAM B'}
            leftTeamColor={teamA?.color || '#28D091'}
            rightTeamColor={teamB?.color || '#FF3549'}
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


