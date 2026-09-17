import { useState, useRef, useEffect } from 'react'
import { Copy, Info, ChevronDown, Minus, Plus, Eye, EyeOff, Tv, Download, Upload, Mic, Film, Video, Bell, Sun, Moon, BarChart3, History, Send, Clock, X } from 'lucide-react'
import { useAppStore } from '../store/AppContext'
import { IngameHudScene } from '../components/scenes/IngameHudScene'
import { buildMapHistoryItems } from './MapVeto'
import { persistMatchScore } from '../lib/dataLayer'
import { ReplaySystem } from '../components/ReplaySystem'
import { ObsWebSocketClient } from '../lib/obsWebSocket'

const SwitchSidesIcon = ({ className = 'size-6' }: { className?: string }) => (
  <svg width="19" height="18" viewBox="0 0 19 18" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <g>
      <path d="M1.25 7H9.92146C13.2187 7 14.8673 7 15.2364 6.03676C15.6055 5.07351 14.3791 3.97177 11.9263 1.76829L11.0711 1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17.75 11H9.07854C5.78133 11 4.13272 11 3.76359 11.9632C3.39447 12.9265 4.62087 14.0282 7.07368 16.2317L7.9289 17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  </svg>
)

export default function LiveGame() {
  const { state, setState, showToast } = useAppStore()

  // Auto toggles are connected to the shared AppContext so they persist and
  // control whether the manual team/score controls are locked or overridable.
  const autoTeams = state.teamsAuto ?? true
  const autoSeriesScore = state.seriesAuto ?? true
  const autoScoreline = state.scorelineAuto ?? true

  const [teamADropdownOpen, setTeamADropdownOpen] = useState(false)
  const [teamBDropdownOpen, setTeamBDropdownOpen] = useState(false)
  const [bestOfDropdownOpen, setBestOfDropdownOpen] = useState(false)

  const previewContainerRef = useRef<HTMLDivElement>(null)
  const [previewScale, setPreviewScale] = useState(0.3)

  useEffect(() => {
    const updateScale = () => {
      if (previewContainerRef.current) {
        const { clientWidth, clientHeight } = previewContainerRef.current
        const scaleX = clientWidth / 1920
        const scaleY = clientHeight / 1080
        setPreviewScale(Math.min(scaleX, scaleY))
      }
    }
    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  // Producer Controls State (#3, #8, #11, #14, #15)
  const [bridgeHealth, setBridgeHealth] = useState<any>(null)
  const [caster1Name, setCaster1Name] = useState('')
  const [caster1Role, setCaster1Role] = useState('Play-by-Play')
  const [caster2Name, setCaster2Name] = useState('')
  const [caster2Role, setCaster2Role] = useState('Color Analyst')
  const [showReplay, setShowReplay] = useState(false)
  const [showCastersPanel, setShowCastersPanel] = useState(false)
  const [showObsPanel, setShowObsPanel] = useState(false)
  const [obsConnected, setObsConnected] = useState(false)
  const [obsAutoSwitch, setObsAutoSwitch] = useState(true)
  const [obsHost, setObsHost] = useState('localhost')
  const [obsPort, setObsPort] = useState(4455)
  const obsClientRef = useRef<ObsWebSocketClient | null>(null)
  /** Live game scene from the bridge's /status (drives OBS auto-switch). */
  const [bridgeScene, setBridgeScene] = useState<string | null>(null)
  const lastObsSceneRef = useRef<string | null>(null)

  const [showToastPanel, setShowToastPanel] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const [toastTitle, setToastTitle] = useState('BROADCAST ALERT')
  const [toastType, setToastType] = useState<'info' | 'warning' | 'alert' | 'success'>('info')

  const [showRecordings, setShowRecordings] = useState(false)
  const [matchLogs, setMatchLogs] = useState<{ filename: string; size: number; modified: number }[]>([])

  const [showAnalytics, setShowAnalytics] = useState(false)
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const toggleObsConnection = async () => {
    if (obsConnected) {
      obsClientRef.current?.disconnect()
      obsClientRef.current = null
      setObsConnected(false)
      showToast('OBS Studio disconnected')
    } else {
      const client = new ObsWebSocketClient(
        { host: obsHost, port: Number(obsPort), autoSwitch: obsAutoSwitch },
        (connected) => setObsConnected(connected)
      )
      obsClientRef.current = client
      const ok = await client.connect()
      if (ok) {
        showToast('Connected to OBS Studio (obs-websocket v5)')
      } else {
        showToast('Failed to connect to OBS Studio on port ' + obsPort)
      }
    }
  }

  // Producer control transport — SUCCESS is reported only for successful HTTP
  // responses. fetch() resolves on 4xx/5xx too, which previously made every
  // button claim "sent" even when the bridge rejected the action (400
  // "unknown action" for set-caster-cards/timeout/clear-events).
  const sendControl = async (payload: Record<string, unknown>): Promise<{ ok: boolean; status: number; error?: string }> => {
    const origin = (import.meta as any).env?.VITE_BRIDGE_ORIGIN || 'https://hu-bridge.onrender.com'
    try {
      const res = await fetch(`${origin}/api/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      let error: string | undefined
      try { error = (await res.json())?.error } catch { /* non-JSON body */ }
      return { ok: res.ok, status: res.status, error }
    } catch {
      return { ok: false, status: 0, error: 'bridge unreachable' }
    }
  }

  const handleSendOverlayToast = async () => {
    if (!toastMsg.trim()) return
    const r = await sendControl({ action: 'toast', title: toastTitle, message: toastMsg, type: toastType })
    showToast(r.ok ? 'Broadcast Toast sent to overlay' : `Toast rejected: ${r.error ?? r.status}`)
    if (r.ok) setToastMsg('')
  }

  const fetchMatchLogs = async () => {
    const origin = (import.meta as any).env?.VITE_BRIDGE_ORIGIN || 'https://hu-bridge.onrender.com'
    try {
      const res = await fetch(`${origin}/api/matches`)
      if (res.ok) {
        const d = await res.json()
        setMatchLogs(d.matches || [])
      }
    } catch { /* best-effort */ }
  }

  // Poll bridge health status (#8)
  useEffect(() => {
    let alive = true
    const origin = (import.meta as any).env?.VITE_BRIDGE_ORIGIN || 'https://hu-bridge.onrender.com'
    const checkHealth = async () => {
      try {
        const res = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(3000) })
        if (res.ok) {
          const data = await res.json()
          if (alive) setBridgeHealth(data)
        } else {
          if (alive) setBridgeHealth({ ok: false })
        }
      } catch {
        if (alive) setBridgeHealth({ ok: false })
      }
      // Live game scene signal: the bridge's /status exposes the last desktop
      // snapshot's projected scene — consumed by the OBS auto-switch below.
      try {
        const res = await fetch(`${origin}/status`, { signal: AbortSignal.timeout(3000) })
        if (res.ok) {
          const data = await res.json()
          if (alive) setBridgeScene(data?.lastScene ?? null)
        }
      } catch { /* best-effort */ }
    }
    checkHealth()
    const timer = setInterval(checkHealth, 5000)
    return () => { alive = false; clearInterval(timer) }
  }, [])

  // OBS auto scene switching (#OBS): SetCurrentProgramScene whenever the
  // projected game scene changes while auto-switch is enabled and OBS is
  // connected. obsWebSocket.sceneMap translates keys -> OBS scene names
  // ('agent-select' -> 'Agent Select', 'buy-round' -> 'Buy Phase', ...).
  useEffect(() => {
    if (!obsAutoSwitch || !obsConnected || !bridgeScene) return
    if (lastObsSceneRef.current === bridgeScene) return
    lastObsSceneRef.current = bridgeScene
    console.log('[obs] auto scene switch ->', bridgeScene)
    obsClientRef.current?.switchScene(bridgeScene)
  }, [bridgeScene, obsAutoSwitch, obsConnected])

  // Export Config (#11)
  const handleExportConfig = () => {
    const exportData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      matchFormat: state.matchFormat,
      seriesTitle: state.seriesTitle,
      eventTitle: state.eventTitle,
      gameSeries: state.gameSeries,
      teams: state.teams,
      teamAId: state.teamAId,
      teamBId: state.teamBId,
      mapPicks: state.mapPicks,
      mapBans: state.mapBans,
      serverCode: state.serverCode,
    }
    const havoc = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(havoc)
    const a = document.createElement('a')
    a.href = url
    a.download = `havoc-config-${state.serverCode || 'match'}.json`
    a.click()
    URL.revokeObjectURL(url)
    showToast('Config exported')
  }

  // Import Config (#11)
  const handleImportConfig = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string)
        if (parsed && typeof parsed === 'object') {
          setState(prev => ({
            ...prev,
            ...(parsed.teams ? { teams: parsed.teams } : {}),
            ...(parsed.teamAId ? { teamAId: parsed.teamAId } : {}),
            ...(parsed.teamBId ? { teamBId: parsed.teamBId } : {}),
            ...(parsed.matchFormat ? { matchFormat: parsed.matchFormat } : {}),
            ...(parsed.seriesTitle ? { seriesTitle: parsed.seriesTitle } : {}),
            ...(parsed.eventTitle ? { eventTitle: parsed.eventTitle } : {}),
            ...(parsed.gameSeries ? { gameSeries: parsed.gameSeries } : {}),
            ...(parsed.mapPicks ? { mapPicks: parsed.mapPicks } : {}),
            ...(parsed.mapBans ? { mapBans: parsed.mapBans } : {}),
          }))
          showToast('Config imported successfully')
        }
      } catch {
        showToast('Invalid JSON config file')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // Trigger Caster Cards (#15)
  const handleTriggerCasters = async (show: boolean) => {
    const origin = (import.meta as any).env?.VITE_BRIDGE_ORIGIN || 'https://hu-bridge.onrender.com'
    const casters = show ? [
      ...(caster1Name ? [{ name: caster1Name, role: caster1Role }] : []),
      ...(caster2Name ? [{ name: caster2Name, role: caster2Role }] : []),
    ] : null

    try {
      const res = await fetch(`${origin}/api/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set-caster-cards', casters }),
      })
      const r = await res.json().catch(() => ({}))
      showToast(r.ok ? (show ? 'Caster cards shown on overlay' : 'Caster cards hidden') : `Bridge rejected: ${r.error ?? 'unknown'}`)
    } catch {
      showToast('Bridge unreachable')
    }
  }

  const teamA = state.teams.find(t => t.id === state.teamAId) || state.teams[0]
  const teamB = state.teams.find(t => t.id === state.teamBId) || state.teams[1]
  // The HUD facecam shows the first player that has a camera configured.
  const webcamPlayer = [...(teamA?.players || []), ...(teamB?.players || [])].find(p => p.webcamSource !== 'None' && state.cameraVisibility?.[p.id] !== false)

  const swapTeams = () => {
    setState(prev => ({
      ...prev,
      teamAId: prev.teamBId,
      teamBId: prev.teamAId,
      scoreA: prev.scoreB,
      scoreB: prev.scoreA,
      seriesScoreA: prev.seriesScoreB,
      seriesScoreB: prev.seriesScoreA,
    }))
    saveMatch({
      team1_id: state.teamBId,
      team2_id: state.teamAId,
      team1_score: state.scoreB,
      team2_score: state.scoreA,
      series_score_a: state.seriesScoreB,
      series_score_b: state.seriesScoreA,
    })
    showToast('Teams swapped')
  }

  const copyWebcamsAndMapbans = () => {
    const webcams = [
      `=== ${teamA?.name || ''} Webcams ===`,
      ...(teamA?.players || []).map(p => `${p.riotId || p.alias || 'Player'}: webcam://${state.serverCode}/${p.id}`),
      `\n=== ${teamB?.name || ''} Webcams ===`,
      ...(teamB?.players || []).map(p => `${p.riotId || p.alias || 'Player'}: webcam://${state.serverCode}/${p.id}`),
      `\n=== Map Veto ===`,
      `Active: ${state.mapPool?.join(', ') || 'Ascent, Split, Breeze, Lotus, Sunset, Summit, Haven'}`,
    ].join('\n')

    navigator.clipboard.writeText(webcams).catch(() => {})
    showToast('Webcams & Mapbans copied!')
  }

  /** Persist live-match changes back to the connected tournament's Supabase row. */
  const saveMatch = (patch: Parameters<typeof persistMatchScore>[1]) => {
    if (state.connectedTournamentId) {
      persistMatchScore(state.connectedTournamentId, patch).catch(e => {
        console.error('Score save failed:', e)
        showToast('Failed to save score to Supabase: ' + e.message)
      })
    }
  }

  const bumpScore = (side: 'A' | 'B', delta: number) => {
    const key = side === 'A' ? 'scoreA' : 'scoreB'
    const v = Math.max(0, (state[key] || 0) + delta)
    setState(p => ({ ...p, [key]: v }))
    saveMatch(side === 'A' ? { team1_score: v } : { team2_score: v })
  }

  const bumpSeries = (side: 'A' | 'B', delta: number) => {
    const key = side === 'A' ? 'seriesScoreA' : 'seriesScoreB'
    const v = Math.max(0, (state[key] || 0) + delta)
    setState(p => ({ ...p, [key]: v }))
    saveMatch(side === 'A' ? { series_score_a: v } : { series_score_b: v })
  }

  return (
    <div className={`flex h-full w-full min-w-0 flex-col overflow-y-auto p-5 transition-colors duration-200 ${themeMode === 'light' ? 'bg-[#1a1c20] text-[#f1f2f4] filter contrast-125' : 'text-white'}`} style={{ scrollbarWidth: 'none' }}>
      <form onSubmit={e => e.preventDefault()} className="grid h-full w-full grid-cols-1 gap-x-10 gap-y-6 lg:grid-cols-2">
        {/* ========================================================================= */}
        {/* Left Column (Teams, Scoreline, Information) - 50%                       */}
        {/* ========================================================================= */}
        <div className="flex w-full min-w-0 flex-col gap-4">
          {/* Teams Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-[#e7e7e7]">Teams</h2>
                <button
                  type="button"
                  onClick={() => showToast('Teams refreshed')}
                  className="flex size-5 items-center justify-center text-[#e7e7e7]/40 hover:text-white transition-colors cursor-pointer"
                >
                  <svg className="size-3.5" fill="none" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M14 8C14 11.3138 11.3138 14 8 14C4.6862 14 2 11.3138 2 8C2 4.6862 4.6862 2 8 2V3.2C6.85072 3.20013 5.73963 3.61262 4.86869 4.36249C3.99775 5.11236 3.42477 6.14984 3.2539 7.28635C3.08302 8.42285 3.3256 9.58295 3.93754 10.5558C4.54947 11.5286 5.49015 12.2496 6.58858 12.5876C7.68701 12.9257 8.87028 12.8584 9.92333 12.3981C10.9764 11.9377 11.8293 11.1148 12.327 10.0789C12.8248 9.04295 12.9343 7.86284 12.6357 6.75302C12.3372 5.6432 11.6503 4.67734 10.7 4.031V5.6H9.5V2H13.1V3.2H11.6C12.3455 3.75856 12.9506 4.4832 13.3672 5.3164C13.7838 6.14961 14.0005 7.06845 14 8Z"
                      fill="currentColor"
                    />
                  </svg>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-[#e7e7e7]/50">Auto</span>
                <button
                  type="button"
                  onClick={() => setState(p => ({ ...p, teamsAuto: !(p.teamsAuto ?? true) }))}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-white/5 p-0.5 transition-colors duration-200 ${
                    autoTeams ? 'bg-[#3697FF]' : 'bg-[#202224]'
                  }`}
                >
                  <span
                    className={`inline-block size-3.5 transform rounded-full bg-white transition-transform duration-200 ${
                      autoTeams ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Left & Right Team Dropdowns */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-[#e7e7e7]/40">
                <span>Left Team</span>
                <span>Right Team</span>
              </div>

              <div className="flex items-center gap-3">
                {/* Left Team Squircle Selector */}
                <div className="flex flex-1 items-center gap-2.5 rounded-xl border border-white/10 bg-[#16171a] p-2.5">
                  <div className="size-6 rounded bg-[#2a2e33]" />
                  <div className="relative flex-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (autoTeams) return
                        setTeamADropdownOpen(!teamADropdownOpen)
                        setTeamBDropdownOpen(false)
                      }}
                      disabled={autoTeams}
                      className="flex w-full items-center justify-between text-xs font-semibold text-white cursor-pointer"
                    >
                      <span className="truncate">{teamA?.name || ''}</span>
                      <ChevronDown className="size-3.5 text-[#e7e7e7]/40" />
                    </button>

                    {teamADropdownOpen && (
                      <div className="absolute left-0 top-full z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-white/10 bg-[#1A1C1E] p-1 shadow-xl">
                        {state.teams.map(t => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              setState(p => ({ ...p, teamAId: t.id }))
                              saveMatch({ team1_id: t.id })
                              setTeamADropdownOpen(false)
                            }}
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-white hover:bg-white/10 cursor-pointer"
                          >
                            <span className="truncate">{t.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Swap Sides Button */}
                <button
                  type="button"
                  onClick={swapTeams}
                  disabled={autoTeams}
                  className="flex size-7 shrink-0 items-center justify-center text-[#e7e7e7]/40 hover:text-white transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                  title="Swap team sides"
                >
                  <SwitchSidesIcon className="size-4" />
                </button>

                {/* Right Team Squircle Selector */}
                <div className="flex flex-1 items-center gap-2.5 rounded-xl border border-white/10 bg-[#16171a] p-2.5">
                  <div className="size-6 rounded bg-[#2a2e33]" />
                  <div className="relative flex-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (autoTeams) return
                        setTeamBDropdownOpen(!teamBDropdownOpen)
                        setTeamADropdownOpen(false)
                      }}
                      disabled={autoTeams}
                      className="flex w-full items-center justify-between text-xs font-semibold text-white cursor-pointer"
                    >
                      <span className="truncate">{teamB?.name || ''}</span>
                      <ChevronDown className="size-3.5 text-[#e7e7e7]/40" />
                    </button>

                    {teamBDropdownOpen && (
                      <div className="absolute left-0 top-full z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-white/10 bg-[#1A1C1E] p-1 shadow-xl">
                        {state.teams.map(t => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                              setState(p => ({ ...p, teamBId: t.id }))
                              saveMatch({ team2_id: t.id })
                              setTeamBDropdownOpen(false)
                            }}
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-white hover:bg-white/10 cursor-pointer"
                          >
                            <span className="truncate">{t.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Sub-Badges: Tracked via team data */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="flex flex-1 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/5 py-1.5 text-[11px] font-medium text-emerald-400">
                  Tracked via team data
                </div>
                <div className="size-7 shrink-0" />
                <div className="flex flex-1 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/5 py-1.5 text-[11px] font-medium text-emerald-400">
                  Tracked via team data
                </div>
              </div>

              {/* Full Width Button: Copy Webcams & Mapbans */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={copyWebcamsAndMapbans}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#16171a] py-2.5 text-xs font-semibold text-[#e7e7e7]/80 hover:bg-white/5 hover:text-white transition-all cursor-pointer"
                >
                  <Copy className="size-3.5" />
                  <span>Copy Webcams & Mapbans</span>
                </button>
              </div>
            </div>
          </div>

          {/* Scoreline Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#e7e7e7]">Scoreline</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#e7e7e7]/50">Auto</span>
                <button
                  type="button"
                onClick={() => setState(p => ({ ...p, scorelineAuto: !(p.scorelineAuto ?? true) }))}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-white/5 p-0.5 transition-colors duration-200 ${
                    autoScoreline ? 'bg-[#3697FF]' : 'bg-[#202224]'
                  }`}
                >
                  <span
                    className={`inline-block size-3.5 transform rounded-full bg-white transition-transform duration-200 ${
                      autoScoreline ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <p className="flex items-center gap-1.5 text-xs text-[#e7e7e7]/40">
              <span>Score changes here temporarily override the live score.</span>
              <Info className="size-3.5" />
            </p>

            {/* Score Counters Row */}
            <div className="flex items-center justify-between gap-6 pt-2">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-white/80">{teamA?.name || ''}</span>
                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#16171a] px-2.5 py-1">
                  <button
                    type="button"
                    onClick={() => bumpScore('A', -1)}
                    className="text-[#e7e7e7]/50 hover:text-white cursor-pointer"
                  >
                    <Minus className="size-3" />
                  </button>
                  <span className="w-5 text-center text-xs font-bold">{state.scoreA}</span>
                  <button
                    type="button"
                    onClick={() => bumpScore('A', 1)}
                    className="text-[#e7e7e7]/50 hover:text-white cursor-pointer"
                  >
                    <Plus className="size-3" />
                  </button>
                </div>
              </div>

              <span className="text-xs font-bold text-[#e7e7e7]/40 uppercase tracking-widest">VS</span>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#16171a] px-2.5 py-1">
                  <button
                    type="button"
                    onClick={() => bumpScore('B', -1)}
                    className="text-[#e7e7e7]/50 hover:text-white cursor-pointer"
                  >
                    <Minus className="size-3" />
                  </button>
                  <span className="w-5 text-center text-xs font-bold">{state.scoreB}</span>
                  <button
                    type="button"
                    onClick={() => bumpScore('B', 1)}
                    className="text-[#e7e7e7]/50 hover:text-white cursor-pointer"
                  >
                    <Plus className="size-3" />
                  </button>
                </div>
                <span className="text-xs font-semibold text-white/80">{teamB?.name || ''}</span>
              </div>
            </div>
          </div>

          {/* Information Section */}
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-[#e7e7e7]">Information</h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-[#e7e7e7]/50">Series Title</label>
                <input
                  type="text"
                  placeholder="e.g. Grand Finals" value={state.seriesTitle || ''}
                  onChange={e => setState(p => ({ ...p, seriesTitle: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-[#16171a] px-3 py-2 text-xs text-white outline-none focus:border-[#3697FF]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-[#e7e7e7]/50">Event Title</label>
                <input
                  type="text"
                  placeholder="e.g. Havoc Unleash"
                  value={state.eventTitle ?? state.tournamentName1 ?? ''}
                  onChange={e => setState(p => ({ ...p, eventTitle: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-[#16171a] px-3 py-2 text-xs text-white outline-none focus:border-[#3697FF]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-[#e7e7e7]/50">Round Title</label>
                <input
                  type="text"
                  placeholder="e.g. Round 12/24" value={state.roundTitle || ''}
                  onChange={e => setState(p => ({ ...p, roundTitle: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-[#16171a] px-3 py-2 text-xs text-white outline-none focus:border-[#3697FF]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-[#e7e7e7]/50">Game Series</label>
                <input
                  type="text"
                  placeholder="e.g BO5/Best of 5"
                  value={state.gameSeries || ''}
                  onChange={e => setState(p => ({ ...p, gameSeries: e.target.value }))}
                  className="w-full rounded-lg border border-white/10 bg-[#16171a] px-3 py-2 text-xs text-white placeholder:text-white/20 outline-none focus:border-[#3697FF]"
                />
              </div>
            </div>
          </div>

          {/* Producer Controls Section (#3, #8, #11, #14, #15) */}
          <div className="space-y-4 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#e7e7e7]">Producer Controls</h2>

              {/* Bridge Health Status Badge (#8) */}
              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[#16171a] px-2.5 py-1 text-[11px]">
                <div className={`size-2 rounded-full ${bridgeHealth?.ok ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-white/80 font-medium">
                  {bridgeHealth?.ok ? 'Bridge Live' : 'Bridge Offline'}
                </span>
                {bridgeHealth?.ok && (
                  <span className="text-white/40 text-[10px]">
                    ({bridgeHealth.connections ?? 0} prod / {bridgeHealth.viewers ?? 0} view)
                  </span>
                )}
              </div>
            </div>

            {/* Quick Actions Bar (#3) */}
            <div className="flex flex-wrap gap-2">
              {/* Force Scene Dropdown */}
              <div className="relative">
                <select
                  className="rounded-lg border border-white/10 bg-[#16171a] px-3 py-1.5 text-xs text-white cursor-pointer appearance-none pr-7 outline-none"
                  defaultValue=""
                  onChange={async (e) => {
                    const scene = e.target.value || null
                    const origin = (import.meta as any).env?.VITE_BRIDGE_ORIGIN || 'https://hu-bridge.onrender.com'
                    try {
                      await fetch(`${origin}/api/control`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'force-scene', scene }),
                      })
                      showToast(scene ? `Forced: ${scene}` : 'Scene auto-mode restored')
                    } catch { showToast('Bridge unreachable') }
                  }}
                >
                  <option value="">Auto Scene</option>
                  <option value="ingame-hud">Ingame HUD</option>
                  <option value="buy-round">Buy Round</option>
                  <option value="agent-select">Agent Select</option>
                  <option value="post-game">Postgame</option>
                  <option value="map-ban">Map Veto (hold)</option>
                </select>
                <Tv className="absolute right-2 top-1/2 -translate-y-1/2 size-3 text-white/40 pointer-events-none" />
              </div>

              {/* Panic Hide Button */}
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/50 cursor-pointer transition-colors"
                onClick={async () => {
                  const origin = (import.meta as any).env?.VITE_BRIDGE_ORIGIN || 'https://hu-bridge.onrender.com'
                  try {
                    const res = await fetch(`${origin}/api/control`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'hide-overlay' }),
                    })
                    const r = await res.json().catch(() => ({}))
                    showToast(r.ok ? 'Overlay HIDDEN' : `Bridge rejected: ${r.error ?? res.status}`)
                  } catch { showToast('Bridge unreachable') }
                }}
              >
                <EyeOff className="size-3" />
                Hide All
              </button>

              {/* Show Overlay Button */}
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-lg border border-green-500/30 bg-green-950/40 px-3 py-1.5 text-xs text-green-400 hover:bg-green-900/50 cursor-pointer transition-colors"
                onClick={async () => {
                  const origin = (import.meta as any).env?.VITE_BRIDGE_ORIGIN || 'https://hu-bridge.onrender.com'
                  try {
                    const res = await fetch(`${origin}/api/control`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'clear-events' }),
                    })
                    const r = await res.json().catch(() => ({}))
                    showToast(r.ok ? 'Overlay Visible / Cleared' : `Bridge rejected: ${r.error ?? res.status}`)
                  } catch { showToast('Bridge unreachable') }
                }}
              >
                <Eye className="size-3" />
                Show All
              </button>

              {/* Technical Pause (ValoSpectra timeout parity) */}
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-950/40 px-3 py-1.5 text-xs text-amber-400 hover:bg-amber-900/50 cursor-pointer transition-colors"
                onClick={async () => {
                  const origin = (import.meta as any).env?.VITE_BRIDGE_ORIGIN || 'https://hu-bridge.onrender.com'
                  try {
                    const res = await fetch(`${origin}/api/control`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'timeout', timeoutType: 'tech_pause' }),
                    })
                    const r = await res.json().catch(() => ({}))
                    showToast(r.ok ? 'TECHNICAL PAUSE shown on overlay' : `Bridge rejected: ${r.error ?? res.status}`)
                  } catch { showToast('Bridge unreachable') }
                }}
              >
                <Clock className="size-3" />
                Tech Pause
              </button>

              {/* Tactical Timeouts */}
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#16171a] px-3 py-1.5 text-xs text-white hover:bg-white/5 cursor-pointer transition-colors"
                onClick={async () => {
                  const origin = (import.meta as any).env?.VITE_BRIDGE_ORIGIN || 'https://hu-bridge.onrender.com'
                  try {
                    const res = await fetch(`${origin}/api/control`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'timeout', timeoutType: 'tactical', team: 'left' }),
                    })
                    const r = await res.json().catch(() => ({}))
                    showToast(r.ok ? 'Tactical timeout (LEFT) shown' : `Bridge rejected: ${r.error ?? res.status}`)
                  } catch { showToast('Bridge unreachable') }
                }}
              >
                <Clock className="size-3" />
                Timeout L
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#16171a] px-3 py-1.5 text-xs text-white hover:bg-white/5 cursor-pointer transition-colors"
                onClick={async () => {
                  const origin = (import.meta as any).env?.VITE_BRIDGE_ORIGIN || 'https://hu-bridge.onrender.com'
                  try {
                    const res = await fetch(`${origin}/api/control`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'timeout', timeoutType: 'tactical', team: 'right' }),
                    })
                    const r = await res.json().catch(() => ({}))
                    showToast(r.ok ? 'Tactical timeout (RIGHT) shown' : `Bridge rejected: ${r.error ?? res.status}`)
                  } catch { showToast('Bridge unreachable') }
                }}
              >
                <Clock className="size-3" />
                Timeout R
              </button>

              {/* Clear pause/timeout */}
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#16171a] px-3 py-1.5 text-xs text-white/70 hover:bg-white/5 cursor-pointer transition-colors"
                onClick={async () => {
                  const origin = (import.meta as any).env?.VITE_BRIDGE_ORIGIN || 'https://hu-bridge.onrender.com'
                  try {
                    const res = await fetch(`${origin}/api/control`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'timeout', timeoutType: 'clear' }),
                    })
                    const r = await res.json().catch(() => ({}))
                    showToast(r.ok ? 'Pause / timeout cleared' : `Bridge rejected: ${r.error ?? res.status}`)
                  } catch { showToast('Bridge unreachable') }
                }}
              >
                <X className="size-3" />
                Clear Pause
              </button>

              {/* Casters Toggle Button (#15) */}
              <button
                type="button"
                onClick={() => setShowCastersPanel(!showCastersPanel)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                  showCastersPanel ? 'border-[#3697FF]/50 bg-[#3697FF]/20 text-[#3697FF]' : 'border-white/10 bg-[#16171a] text-white hover:bg-white/5'
                }`}
              >
                <Mic className="size-3" />
                Casters
              </button>

              {/* Replay Panel Toggle Button (#14) */}
              <button
                type="button"
                onClick={() => setShowReplay(!showReplay)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                  showReplay ? 'border-amber-500/50 bg-amber-500/20 text-amber-400' : 'border-white/10 bg-[#16171a] text-white hover:bg-white/5'
                }`}
              >
                <Film className="size-3" />
                Replay
              </button>

              {/* OBS Studio Link (#24) */}
              <button
                type="button"
                onClick={() => setShowObsPanel(!showObsPanel)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                  showObsPanel ? 'border-purple-500/50 bg-purple-500/20 text-purple-400' : 'border-white/10 bg-[#16171a] text-white hover:bg-white/5'
                }`}
              >
                <Video className="size-3" />
                OBS {obsConnected ? '(Linked)' : ''}
              </button>

              {/* Toast Trigger (#18) */}
              <button
                type="button"
                onClick={() => setShowToastPanel(!showToastPanel)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                  showToastPanel ? 'border-yellow-500/50 bg-yellow-500/20 text-yellow-400' : 'border-white/10 bg-[#16171a] text-white hover:bg-white/5'
                }`}
              >
                <Bell className="size-3" />
                Toast
              </button>

              {/* Recordings / JSONL Logs (#10) */}
              <button
                type="button"
                onClick={() => {
                  const next = !showRecordings
                  setShowRecordings(next)
                  if (next) void fetchMatchLogs()
                }}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                  showRecordings ? 'border-cyan-500/50 bg-cyan-500/20 text-cyan-400' : 'border-white/10 bg-[#16171a] text-white hover:bg-white/5'
                }`}
              >
                <History className="size-3" />
                Logs
              </button>

              {/* Analytics (#25) */}
              <button
                type="button"
                onClick={() => setShowAnalytics(!showAnalytics)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                  showAnalytics ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-400' : 'border-white/10 bg-[#16171a] text-white hover:bg-white/5'
                }`}
              >
                <BarChart3 className="size-3" />
                Stats
              </button>

              {/* Theme Toggle (#21) */}
              <button
                type="button"
                onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#16171a] px-3 py-1.5 text-xs text-white hover:bg-white/5 cursor-pointer transition-colors"
                title="Toggle High-Contrast Venue Theme"
              >
                {themeMode === 'dark' ? <Sun className="size-3 text-amber-300" /> : <Moon className="size-3 text-blue-300" />}
                {themeMode === 'dark' ? 'Light' : 'Dark'}
              </button>

              {/* Broadcast Language (#22) */}
              <select
                value={state.tournamentLanguage || 'en'}
                onChange={e => setState(p => ({ ...p, tournamentLanguage: e.target.value }))}
                className="rounded-lg border border-white/10 bg-[#16171a] px-2.5 py-1.5 text-xs text-white cursor-pointer outline-none"
                title="Broadcast Language / Localization"
              >
                <option value="en">EN</option>
                <option value="es">ES</option>
                <option value="pt">PT</option>
                <option value="ja">JA</option>
                <option value="ko">KO</option>
              </select>

              {/* Config Export (#11) */}
              <button
                type="button"
                onClick={handleExportConfig}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#16171a] px-3 py-1.5 text-xs text-white hover:bg-white/5 cursor-pointer transition-colors"
                title="Export Tournament Config JSON"
              >
                <Download className="size-3" />
                Export
              </button>

              {/* Config Import (#11) */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#16171a] px-3 py-1.5 text-xs text-white hover:bg-white/5 cursor-pointer transition-colors"
                title="Import Tournament Config JSON"
              >
                <Upload className="size-3" />
                Import
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImportConfig}
              />
            </div>

            {/* Caster Cards Trigger UI (#15) */}
            {showCastersPanel && (
              <div className="rounded-xl border border-white/10 bg-[#16171a] p-3 space-y-3">
                <div className="text-xs font-semibold text-white/80 flex items-center justify-between">
                  <span>Caster Lower Thirds</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleTriggerCasters(true)}
                      className="rounded bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-blue-500 cursor-pointer"
                    >
                      Show On Stream
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTriggerCasters(false)}
                      className="rounded bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/80 hover:bg-white/20 cursor-pointer"
                    >
                      Hide
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <input
                      type="text"
                      placeholder="Caster 1 Name"
                      value={caster1Name}
                      onChange={e => setCaster1Name(e.target.value)}
                      className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-white outline-none focus:border-[#3697FF]"
                    />
                    <input
                      type="text"
                      placeholder="Role (e.g. Play-by-Play)"
                      value={caster1Role}
                      onChange={e => setCaster1Role(e.target.value)}
                      className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-white/70 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <input
                      type="text"
                      placeholder="Caster 2 Name"
                      value={caster2Name}
                      onChange={e => setCaster2Name(e.target.value)}
                      className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-white outline-none focus:border-[#3697FF]"
                    />
                    <input
                      type="text"
                      placeholder="Role (e.g. Color Analyst)"
                      value={caster2Role}
                      onChange={e => setCaster2Role(e.target.value)}
                      className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-[11px] text-white/70 outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Replay System Panel (#14) */}
            {showReplay && (
              <div className="pt-1">
                <ReplaySystem
                  currentState={state}
                  isLive={true}
                  onApplyState={(replayed) => setState(prev => ({ ...prev, ...replayed }))}
                  onReturnToLive={() => showToast('Returned to live state')}
                />
              </div>
            )}

            {/* OBS Studio Link Panel (#24) */}
            {showObsPanel && (
              <div className="rounded-xl border border-purple-500/30 bg-[#16171a] p-3 space-y-3">
                <div className="text-xs font-semibold text-purple-300 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Video className="size-3.5" />
                    <span>OBS Studio Integration (obs-websocket v5)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className={`size-2 rounded-full ${obsConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-[11px] text-white/60">{obsConnected ? 'Connected' : 'Disconnected'}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-white/50 block mb-1">Host</label>
                    <input
                      type="text"
                      value={obsHost}
                      onChange={e => setObsHost(e.target.value)}
                      className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-white/50 block mb-1">Port</label>
                    <input
                      type="number"
                      value={obsPort}
                      onChange={e => setObsPort(Number(e.target.value))}
                      className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-white outline-none"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={obsAutoSwitch}
                      onChange={e => setObsAutoSwitch(e.target.checked)}
                      className="rounded border-white/20"
                    />
                    <span>Auto-switch OBS scenes based on game phase</span>
                  </label>
                  <button
                    type="button"
                    onClick={toggleObsConnection}
                    className={`rounded px-3 py-1 text-xs font-bold cursor-pointer transition-colors ${
                      obsConnected
                        ? 'bg-red-950/60 text-red-300 border border-red-500/40 hover:bg-red-900/60'
                        : 'bg-purple-600 text-white hover:bg-purple-500'
                    }`}
                  >
                    {obsConnected ? 'Disconnect' : 'Connect OBS'}
                  </button>
                </div>
              </div>
            )}

            {/* Broadcast Toast Sender (#18) */}
            {showToastPanel && (
              <div className="rounded-xl border border-yellow-500/30 bg-[#16171a] p-3 space-y-2.5">
                <div className="text-xs font-semibold text-yellow-400 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="size-3.5" />
                    <span>In-Overlay Toast Notification</span>
                  </div>
                  <span className="text-[10px] text-white/40">Displays directly on stream</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <label className="text-[10px] text-white/50 block mb-1">Badge Type</label>
                    <select
                      value={toastType}
                      onChange={e => setToastType(e.target.value as any)}
                      className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-white outline-none cursor-pointer"
                    >
                      <option value="info">Broadcast Alert</option>
                      <option value="warning">Tech Notice</option>
                      <option value="alert">Match Event</option>
                      <option value="success">System OK</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] text-white/50 block mb-1">Badge Label</label>
                    <input
                      type="text"
                      value={toastTitle}
                      onChange={e => setToastTitle(e.target.value)}
                      placeholder="e.g. TECH PAUSE"
                      className="w-full rounded border border-white/10 bg-black/30 px-2 py-1 text-xs text-white outline-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={toastMsg}
                    onChange={e => setToastMsg(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleSendOverlayToast() } }}
                    placeholder="Enter message (e.g. Tactical Timeout called by Sentinels)..."
                    className="flex-1 rounded border border-white/10 bg-black/30 px-2.5 py-1.5 text-xs text-white outline-none focus:border-yellow-500/60"
                  />
                  <button
                    type="button"
                    onClick={handleSendOverlayToast}
                    className="flex items-center gap-1.5 rounded bg-yellow-500/20 border border-yellow-500/50 px-3 py-1.5 text-xs font-bold text-yellow-300 hover:bg-yellow-500/30 cursor-pointer"
                  >
                    <Send className="size-3" />
                    Send
                  </button>
                </div>
              </div>
            )}

            {/* Match Recordings Panel (#10) */}
            {showRecordings && (
              <div className="rounded-xl border border-cyan-500/30 bg-[#16171a] p-3 space-y-2.5">
                <div className="text-xs font-semibold text-cyan-400 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="size-3.5" />
                    <span>Match Recordings & JSONL Logs</span>
                  </div>
                  <button
                    type="button"
                    onClick={fetchMatchLogs}
                    className="text-[10px] text-cyan-400/80 hover:text-cyan-300 cursor-pointer"
                  >
                    Refresh
                  </button>
                </div>
                {matchLogs.length === 0 ? (
                  <p className="text-xs text-white/40 italic py-1">No recorded match sessions found on bridge.</p>
                ) : (
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {matchLogs.map(m => {
                      const origin = (import.meta as any).env?.VITE_BRIDGE_ORIGIN || 'https://hu-bridge.onrender.com'
                      return (
                        <div key={m.filename} className="flex items-center justify-between rounded bg-black/30 px-2.5 py-1.5 text-xs border border-white/5">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-mono text-white/90 text-[11px]">{m.filename}</p>
                            <p className="text-[10px] text-white/40">{new Date(m.modified).toLocaleString()} · {(m.size / 1024).toFixed(1)} KB</p>
                          </div>
                          <a
                            href={`${origin}/api/matches/${encodeURIComponent(m.filename)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="ml-2 rounded border border-cyan-500/40 bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-300 hover:bg-cyan-500/30"
                          >
                            Download
                          </a>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Analytics Dashboard (#25) */}
            {showAnalytics && (
              <div className="rounded-xl border border-emerald-500/30 bg-[#16171a] p-3 space-y-2.5">
                <div className="text-xs font-semibold text-emerald-400 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="size-3.5" />
                    <span>Broadcast Stream Analytics</span>
                  </div>
                  <span className="text-[10px] text-white/40">Real-time metrics</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="rounded-lg bg-black/30 p-2 border border-white/5">
                    <div className="text-lg font-bold text-emerald-400">
                      {bridgeHealth?.uptime ? `${Math.round(bridgeHealth.uptime / 60000)}m` : '0m'}
                    </div>
                    <div className="text-[10px] text-white/50 uppercase">Uptime</div>
                  </div>
                  <div className="rounded-lg bg-black/30 p-2 border border-white/5">
                    <div className="text-lg font-bold text-white">
                      {bridgeHealth?.connections ?? 0}
                    </div>
                    <div className="text-[10px] text-white/50 uppercase">Producers</div>
                  </div>
                  <div className="rounded-lg bg-black/30 p-2 border border-white/5">
                    <div className="text-lg font-bold text-white">
                      {bridgeHealth?.viewers ?? 0}
                    </div>
                    <div className="text-[10px] text-white/50 uppercase">Overlays</div>
                  </div>
                  <div className="rounded-lg bg-black/30 p-2 border border-white/5">
                    <div className="text-lg font-bold text-cyan-400">
                      {bridgeHealth?.stats?.supabaseWrites ?? 0}
                    </div>
                    <div className="text-[10px] text-white/50 uppercase">DB Syncs</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* Right Column (Series Score, Final Preview) - 50%                        */}
        {/* ========================================================================= */}
        <div className="flex w-full min-w-0 flex-col gap-4">
          {/* Series Score Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#e7e7e7]">Series Score</h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#e7e7e7]/50">Auto</span>
                <button
                  type="button"
                onClick={() => setState(p => ({ ...p, seriesAuto: !(p.seriesAuto ?? true) }))}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-white/5 p-0.5 transition-colors duration-200 ${
                    autoSeriesScore ? 'bg-[#3697FF]' : 'bg-[#202224]'
                  }`}
                >
                  <span
                    className={`inline-block size-3.5 transform rounded-full bg-white transition-transform duration-200 ${
                      autoSeriesScore ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-6">
              {/* Best of Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setBestOfDropdownOpen(!bestOfDropdownOpen)}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#16171a] px-3 py-1.5 text-xs text-white cursor-pointer"
                >
                  <span className="text-[#e7e7e7]/50">Best of</span>
                  <span className="font-bold">{state.matchFormat || '3'}</span>
                  <ChevronDown className="size-3 text-[#e7e7e7]/40" />
                </button>

                {bestOfDropdownOpen && (
                  <div className="absolute left-0 top-full z-50 mt-1 w-28 rounded-lg border border-white/10 bg-[#1A1C1E] p-1 shadow-xl">
                    {['1', '3', '5', '7', '9'].map(num => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => {
                          setState(p => ({ ...p, matchFormat: num, bestOf: Number(num) }))
                          saveMatch({ format: num })
                          setBestOfDropdownOpen(false)
                        }}
                        className="flex w-full px-2.5 py-1 text-left text-xs text-white hover:bg-white/10 cursor-pointer"
                      >
                        Best of {num}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Series Score Counters */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/80">{teamA?.name || ''}</span>
                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#16171a] px-2.5 py-1">
                  <button
                    type="button"
                    onClick={() => bumpSeries('A', -1)}
                    className="text-[#e7e7e7]/50 hover:text-white cursor-pointer"
                  >
                    <Minus className="size-3" />
                  </button>
                  <span className="w-4 text-center text-xs font-bold">{state.seriesScoreA}</span>
                  <button
                    type="button"
                    onClick={() => bumpSeries('A', 1)}
                    className="text-[#e7e7e7]/50 hover:text-white cursor-pointer"
                  >
                    <Plus className="size-3" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#16171a] px-2.5 py-1">
                  <button
                    type="button"
                    onClick={() => bumpSeries('B', -1)}
                    className="text-[#e7e7e7]/50 hover:text-white cursor-pointer"
                  >
                    <Minus className="size-3" />
                  </button>
                  <span className="w-4 text-center text-xs font-bold">{state.seriesScoreB}</span>
                  <button
                    type="button"
                    onClick={() => bumpSeries('B', 1)}
                    className="text-[#e7e7e7]/50 hover:text-white cursor-pointer"
                  >
                    <Plus className="size-3" />
                  </button>
                </div>
                <span className="text-xs text-white/80">{teamB?.name || ''}</span>
              </div>
            </div>
          </div>

          {/* Final Preview Section connected to HUD Editor & Live Game State */}
          <div className="mt-auto flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#e7e7e7]">Final Preview</h2>
              <span className={'text-[11px] font-medium px-2 py-0.5 rounded border ' + (autoScoreline ? 'text-[#4ed9b4] bg-[#13352c] border-[#1dcd9b]/30' : 'text-[#e7e7e7]/60 bg-[#1f2123] border-white/10')}>
                {autoScoreline ? 'Live Synced' : 'Manual override'}
              </span>
            </div>
            <div className="flex flex-1 w-full min-h-60 rounded-2xl border border-[#24272b] bg-[#101113] p-1.5 shadow-2xl">
              <div
                ref={previewContainerRef}
                className="relative size-full min-h-0 overflow-hidden rounded-xl bg-black flex items-center justify-center"
              >
                <div
                  style={{
                    width: 1920,
                    height: 1080,
                    transform: `scale(${previewScale})`,
                    transformOrigin: 'center center',
                  }}
                  className="pointer-events-none"
                >
                  <IngameHudScene
                    leftTeamName={teamA?.name || ''}
                    rightTeamName={teamB?.name || ''}
                    leftTeamColor={teamA?.color || '#28D091'}
                    rightTeamColor={teamB?.color || '#FF3549'}
                    scoreLeft={state.scoreA}
                    scoreRight={state.scoreB}
                    seriesScoreLeft={state.seriesScoreA}
                    seriesScoreRight={state.seriesScoreB}
                    bestOf={Number(state.matchFormat) || state.bestOf || 3}
                    roundText={state.roundTitle || ''}
                    seriesTitleText={state.seriesTitle || ''}
                    eventTitleText={state.eventTitle || state.tournamentName1 || ''}
                    gameSeriesText={state.gameSeries || ''}
                    leftTeamLogo={(teamA?.logoUrl) || null}
                    rightTeamLogo={(teamB?.logoUrl) || null}
                    mapHistoryItems={buildMapHistoryItems(state.mapPicks, state.mapBans, state.vetoSelectedMapIds)}
                    webcamPlayerName={webcamPlayer?.alias || 'No camera'}
                    webcamPlayerPhoto={webcamPlayer?.avatarUrl || null}
                    webcamActive={!!webcamPlayer}
                    leftTeamPlayers={(teamA?.players || []).map(function(p){ return { id: p.id, alias: p.alias || p.riotId || '', riotId: p.riotId || '' } })}
                    rightTeamPlayers={(teamB?.players || []).map(function(p){ return { id: p.id, alias: p.alias || p.riotId || '', riotId: p.riotId || '' } })}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
