import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { Check, X, Shield, Swords, RefreshCw, Coins } from 'lucide-react'
import { loadRoomBroadcast, saveRoomBroadcast } from '../lib/dataLayer'
import { supabase } from '../lib/supabase'
import { VAL_MAPS, getVetoSequence, type VetoStep, type VetoMode } from './MapVeto'
import { CoinTossModal } from '../components/veto/CoinTossModal'

export default function CaptainVeto() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const [roomState, setRoomState] = useState<any>(() => {
    if (!roomCode) return null
    try {
      const cached = localStorage.getItem(`hu_room_${roomCode.trim()}`)
      if (cached) return JSON.parse(cached)
    } catch { /* ignore */ }
    return null
  })
  const [loading, setLoading] = useState(() => !roomState)
  const [coinTossOpen, setCoinTossOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<'TEAM_A' | 'TEAM_B' | 'SPECTATOR' | null>(() => {
    return (sessionStorage.getItem(`hu_captain_role_${roomCode}`) as any) || null
  })

  // Load initial broadcast state for this room
  const loadState = async () => {
    if (!roomCode) return
    try {
      const data = await loadRoomBroadcast(roomCode)
      if (data && typeof data === 'object') {
        setRoomState((prev: any) => ({ ...(prev || {}), ...data }))
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadState()
  }, [roomCode])

  // Multi-Channel Real-time sync: BroadcastChannel (0ms local cross-tab) + LocalStorage + Supabase Realtime
  useEffect(() => {
    if (!roomCode) return
    const cleanRoom = roomCode.trim()

    // 1. Cross-tab BroadcastChannel listener (0ms instant sync with MapVeto tab)
    let bc: BroadcastChannel | null = null
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel(`hu_channel_${cleanRoom}`)
      bc.onmessage = (e) => {
        if (e.data?.value && typeof e.data.value === 'object') {
          setRoomState(e.data.value)
        }
      }
    }

    // 2. Same-window custom event
    const onLocalEvent = (e: any) => {
      if (e.detail?.serverCode === cleanRoom && e.detail?.value) {
        setRoomState(e.detail.value)
      }
    }
    window.addEventListener('hu_room_update', onLocalEvent)

    // 3. Storage event
    const onStorage = (e: StorageEvent) => {
      if (e.key === `hu_room_${cleanRoom}` && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue)
          if (parsed && typeof parsed === 'object') setRoomState(parsed)
        } catch {}
      }
    }
    window.addEventListener('storage', onStorage)

    // 4. Supabase Realtime channel
    const channel = supabase
      .channel(`captain-lobby-${cleanRoom}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'site_settings',
          filter: `id=eq.broadcast-room:${cleanRoom}`,
        },
        (payload) => {
          const val = (payload.new as any)?.value
          if (val && typeof val === 'object') {
            setRoomState(val)
          }
        }
      )
      .subscribe()

    return () => {
      if (bc) bc.close()
      window.removeEventListener('hu_room_update', onLocalEvent)
      window.removeEventListener('storage', onStorage)
      supabase.removeChannel(channel).catch(() => {})
    }
  }, [roomCode])

  const selectRole = (role: 'TEAM_A' | 'TEAM_B' | 'SPECTATOR') => {
    setSelectedRole(role)
    if (roomCode) {
      sessionStorage.setItem(`hu_captain_role_${roomCode}`, role)
    }
  }

  // Derive teams and state
  const teamA = roomState?.teams?.find((t: any) => t.id === roomState?.teamAId) || roomState?.teams?.[0] || { name: 'Team A' }
  const teamB = roomState?.teams?.find((t: any) => t.id === roomState?.teamBId) || roomState?.teams?.[1] || { name: 'Team B' }

  const firstPickTeam: 'TEAM_A' | 'TEAM_B' = roomState?.vetoFirstPickTeam ?? 'TEAM_A'
  const teamAName = firstPickTeam === 'TEAM_A' ? teamA?.name : teamB?.name
  const teamBName = firstPickTeam === 'TEAM_A' ? teamB?.name : teamA?.name

  const format = roomState?.vetoFormat || 'BO3'
  const mode: VetoMode = roomState?.vetoMode || 'standard'
  const sequence: VetoStep[] = useMemo(() => getVetoSequence(format, firstPickTeam, mode), [format, firstPickTeam, mode])

  const isStarted = roomState?.vetoStarted ?? false
  const isCompleted = roomState?.vetoCompleted ?? false
  const currentStepIndex = roomState?.vetoStepIndex ?? 0
  const currentStep = sequence[currentStepIndex]

  const bannedMaps: any[] = roomState?.mapBans || []
  const pickedMaps: any[] = roomState?.mapPicks || []
  const pendingSidePick = roomState?.vetoPendingSidePick || null

  const selectedMapIds: string[] = roomState?.vetoSelectedMapIds || VAL_MAPS.filter(m => m.isActiveComp).map(m => m.mapId)
  const remainingMapIds = useMemo(() => {
    const banned = new Set(bannedMaps.map(b => b.mapId))
    const picked = new Set(pickedMaps.map(p => p.mapId))
    return selectedMapIds.filter(id => !banned.has(id) && !picked.has(id))
  }, [selectedMapIds, bannedMaps, pickedMaps])

  // Current turn checks
  const isMyTurn = useMemo(() => {
    if (!isStarted || isCompleted) return false
    if (!selectedRole || selectedRole === 'SPECTATOR') return false

    if (pendingSidePick) {
      return pendingSidePick.choosingSideTeam === selectedRole
    }

    const actor = currentStep?.actor
    return actor === selectedRole
  }, [isStarted, isCompleted, selectedRole, pendingSidePick, currentStep])

  const actingTeamName = currentStep?.actor === 'TEAM_A' ? teamAName : teamBName

  // Broadcast action update
  const pushUpdate = async (updates: any) => {
    if (!roomCode) return
    const nextState = {
      ...roomState,
      ...updates,
    }
    setRoomState(nextState)
    await saveRoomBroadcast(roomCode, nextState).catch(() => {})
  }

  // Handle map ban/pick by captain
  const handleCaptainMapClick = async (mapId: string) => {
    if (!isMyTurn || pendingSidePick) return
    if (!remainingMapIds.includes(mapId)) return

    const action = currentStep?.type === 'PICK' ? 'Pick' : currentStep?.type === 'DECIDER' ? 'Decider' : 'Ban'
    const actor = selectedRole as 'TEAM_A' | 'TEAM_B'

    if (action === 'Ban') {
      const newBan = {
        sequenceNo: currentStepIndex + 1,
        mapId,
        bannedBy: actor,
      }
      const newBans = [...bannedMaps, newBan]
      const newSteps = [...(roomState?.vetoSteps || []), { team: actor, action: 'Ban', map: mapId, stepId: currentStep?.id }]

      const nextIdx = currentStepIndex + 1
      const isDone = nextIdx >= sequence.length

      await pushUpdate({
        mapBans: newBans,
        vetoSteps: newSteps,
        vetoStepIndex: nextIdx,
        vetoCompleted: isDone,
        vetoActingTeamOverride: sequence[nextIdx]?.actor === 'DECIDER' ? 'TEAM_A' : sequence[nextIdx]?.actor,
        vetoActionTypeOverride: sequence[nextIdx]?.type === 'BAN' ? 'Ban' : sequence[nextIdx]?.type === 'PICK' ? 'Pick' : 'Decider',
      })
    } else if (action === 'Pick') {
      const choosingSideTeam = actor === 'TEAM_A' ? 'TEAM_B' : 'TEAM_A'
      const sidePickObj = {
        mapId,
        pickedBy: actor,
        choosingSideTeam,
        slot: `map${pickedMaps.length + 1}`,
        stepId: currentStep?.id,
      }
      await pushUpdate({
        vetoPendingSidePick: sidePickObj,
        vetoActionTypeOverride: 'Side pick',
      })
    } else if (action === 'Decider') {
      const newPick = {
        sequenceNo: currentStepIndex + 1,
        mapId,
        pickedBy: 'DECIDER',
        slot: 'decider',
      }
      const newPicks = [...pickedMaps, newPick]
      const newSteps = [...(roomState?.vetoSteps || []), { team: 'DECIDER', action: 'Decider', map: mapId, stepId: currentStep?.id }]
      const nextIdx = currentStepIndex + 1

      await pushUpdate({
        mapPicks: newPicks,
        vetoSteps: newSteps,
        vetoStepIndex: nextIdx,
        vetoCompleted: true,
      })
    }
  }

  // Handle side pick by captain
  const handleCaptainSidePick = async (side: 'ATTACK' | 'DEFENSE') => {
    if (!pendingSidePick || pendingSidePick.choosingSideTeam !== selectedRole) return

    const choosingSideTeam = pendingSidePick.choosingSideTeam
    const otherTeam = choosingSideTeam === 'TEAM_A' ? 'TEAM_B' : 'TEAM_A'
    const otherSide = side === 'ATTACK' ? 'DEFENSE' : 'ATTACK'

    const sideSelection = {
      [choosingSideTeam]: side,
      [otherTeam]: otherSide,
    }

    const newPick = {
      sequenceNo: currentStepIndex + 1,
      mapId: pendingSidePick.mapId,
      pickedBy: pendingSidePick.pickedBy,
      slot: pendingSidePick.slot,
      sideSelection,
    }

    const newPicks = [...pickedMaps, newPick]
    const newSteps = [...(roomState?.vetoSteps || []), {
      team: pendingSidePick.pickedBy,
      action: 'Pick',
      map: pendingSidePick.mapId,
      side: side === 'ATTACK' ? 'Offense' : 'Defense',
      stepId: pendingSidePick.stepId,
    }]

    const nextIdx = currentStepIndex + 2
    const isDone = nextIdx >= sequence.length

    await pushUpdate({
      mapPicks: newPicks,
      vetoSteps: newSteps,
      vetoPendingSidePick: null,
      vetoStepIndex: nextIdx,
      vetoCompleted: isDone,
      vetoActingTeamOverride: sequence[nextIdx]?.actor === 'DECIDER' ? 'TEAM_A' : sequence[nextIdx]?.actor,
      vetoActionTypeOverride: sequence[nextIdx]?.type === 'BAN' ? 'Ban' : sequence[nextIdx]?.type === 'PICK' ? 'Pick' : 'Decider',
    })
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0e0f12] text-white">
        <div className="flex items-center gap-3">
          <RefreshCw className="size-5 animate-spin text-amber-400" />
          <span className="text-sm font-semibold tracking-wide">Connecting to Captain Lobby...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0e0f12] text-white flex flex-col">
      {/* Top Header */}
      <header className="border-b border-white/10 bg-[#141519] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-schabo text-2xl tracking-wider text-white">HAVOC</span>
            <span className="font-schabo text-2xl tracking-wider text-amber-400">VETO</span>
          </div>
          <div className="h-5 w-px bg-white/20" />
          <span className="text-xs text-zinc-400 font-mono">Room: {roomCode}</span>
          <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] font-bold text-zinc-300 uppercase">
            {format}
          </span>
          {mode === 'grand_finals' && (
            <span className="rounded bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[11px] font-bold text-amber-300 uppercase">
              Grand Finals
            </span>
          )}
        </div>

        {/* Header Right: Coin Toss + Role Switcher */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCoinTossOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-400 transition-all cursor-pointer shadow-sm"
            title="VCT Official 3D Coin Toss"
          >
            <Coins className="size-3.5" />
            <span>3D Coin Toss</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Acting as:</span>
            <div className="flex rounded-lg border border-white/10 bg-black/40 p-0.5">
              <button
                type="button"
                onClick={() => selectRole('TEAM_A')}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                  selectedRole === 'TEAM_A' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {teamAName}
              </button>
              <button
                type="button"
                onClick={() => selectRole('TEAM_B')}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                  selectedRole === 'TEAM_B' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {teamBName}
              </button>
              <button
                type="button"
                onClick={() => selectRole('SPECTATOR')}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                  selectedRole === 'SPECTATOR' ? 'bg-white/20 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Viewer
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Status / Turn Banner */}
        <div className="rounded-xl border border-white/10 bg-[#16171a] p-5 shadow-lg">
          {!isStarted ? (
            <div className="text-center py-6">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">MATCH SETUP & LOBBY</span>
              
              {/* Matching Teams Display */}
              <div className="mt-4 flex items-center justify-center gap-6">
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 px-5 py-3">
                  {teamA?.logoUrl ? (
                    <img src={teamA.logoUrl} alt="" className="size-8 object-contain" />
                  ) : (
                    <div className="grid size-8 place-items-center rounded-full bg-sky-500 text-xs font-bold text-black">
                      {(teamA?.name || 'A').slice(0, 1)}
                    </div>
                  )}
                  <div className="text-left">
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase block">TEAM A</span>
                    <span className="text-base font-bold text-white">{teamA?.name || 'Team A'}</span>
                  </div>
                </div>

                <span className="font-schabo text-xl text-zinc-500">VS</span>

                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 px-5 py-3">
                  {teamB?.logoUrl ? (
                    <img src={teamB.logoUrl} alt="" className="size-8 object-contain" />
                  ) : (
                    <div className="grid size-8 place-items-center rounded-full bg-rose-500 text-xs font-bold text-white">
                      {(teamB?.name || 'B').slice(0, 1)}
                    </div>
                  )}
                  <div className="text-left">
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase block">TEAM B</span>
                    <span className="text-base font-bold text-white">{teamB?.name || 'Team B'}</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setCoinTossOpen(true)}
                  className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/20 hover:bg-amber-500/30 px-5 py-2.5 text-xs font-bold text-amber-300 transition-all cursor-pointer shadow-lg hover:shadow-amber-500/20"
                >
                  <Coins className="size-4 text-amber-400" />
                  <span>FLIP 3D COIN TOSS</span>
                </button>
              </div>

              <p className="text-xs text-zinc-400 mt-3">
                Best of {format.replace('BO', '')} • Waiting for tournament organizer to start the Map Veto
              </p>
            </div>
          ) : isCompleted ? (
            <div className="text-center py-4">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">MAP VETO COMPLETED</span>
              <h2 className="text-lg font-bold text-white mt-1">All maps and sides have been decided!</h2>
            </div>
          ) : isMyTurn ? (
            <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="size-3 rounded-full bg-amber-400 shadow-[0_0_10px_#f59e0b]" />
                <div>
                  <h3 className="text-base font-bold text-amber-300 uppercase tracking-wide">
                    {pendingSidePick
                      ? `YOUR TURN TO CHOOSE STARTING SIDE ON ${pendingSidePick.mapId.toUpperCase()}`
                      : `YOUR TURN TO ${currentStep?.type === 'PICK' ? 'PICK' : 'BAN'} A MAP`}
                  </h3>
                  <p className="text-xs text-amber-200/70">
                    Step {currentStepIndex + 1} of {sequence.length}: Acting for {selectedRole === 'TEAM_A' ? teamAName : teamBName}
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold uppercase tracking-wider bg-amber-400 text-black px-3 py-1 rounded">
                ACTION REQUIRED
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between p-2">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">CURRENT STEP</span>
                <h3 className="text-base font-semibold text-white mt-0.5">
                  Waiting for {actingTeamName} to {currentStep?.type === 'PICK' ? 'pick a map' : currentStep?.type === 'SIDE_PICK' ? 'choose side' : 'ban a map'}...
                </h3>
              </div>
              <span className="text-xs font-mono text-zinc-400">
                Step {currentStepIndex + 1} / {sequence.length}
              </span>
            </div>
          )}
        </div>

        {/* Side Selection Modal (when pending) */}
        {pendingSidePick && (
          <div className="rounded-2xl border-2 border-amber-500/50 bg-[#18191e] p-6 shadow-2xl">
            <div className="text-center mb-6">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">SIDE SELECTION</span>
              <h2 className="text-xl font-bold text-white mt-1">
                {pendingSidePick.pickedBy === 'TEAM_A' ? teamAName : teamBName} Picked{' '}
                <span className="uppercase text-amber-400">{pendingSidePick.mapId}</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                {pendingSidePick.choosingSideTeam === 'TEAM_A' ? teamAName : teamBName} must select Attack or Defense
              </p>
            </div>

            {pendingSidePick.choosingSideTeam === selectedRole ? (
              <div className="grid grid-cols-2 gap-6 max-w-xl mx-auto">
                <button
                  type="button"
                  onClick={() => handleCaptainSidePick('ATTACK')}
                  className="flex flex-col items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 p-6 transition-all cursor-pointer group"
                >
                  <Swords className="size-10 text-red-400 group-hover:scale-110 transition-transform" />
                  <span className="text-base font-bold uppercase text-red-400">START ON ATTACK</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCaptainSidePick('DEFENSE')}
                  className="flex flex-col items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 p-6 transition-all cursor-pointer group"
                >
                  <Shield className="size-10 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <span className="text-base font-bold uppercase text-emerald-400">START ON DEFENSE</span>
                </button>
              </div>
            ) : (
              <div className="text-center py-4 text-xs text-zinc-400">
                Waiting for {pendingSidePick.choosingSideTeam === 'TEAM_A' ? teamAName : teamBName} to choose starting side...
              </div>
            )}
          </div>
        )}

        {/* Maps Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              MAP POOL ({remainingMapIds.length} REMAINING)
            </h3>
            {isMyTurn && !pendingSidePick && (
              <span className="text-xs text-amber-400 font-semibold animate-pulse">
                Click a map below to {currentStep?.type === 'PICK' ? 'PICK' : 'BAN'}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {selectedMapIds.map(mapId => {
              const map = VAL_MAPS.find(m => m.mapId === mapId)
              const isBanned = bannedMaps.find(b => b.mapId === mapId)
              const isPicked = pickedMaps.find(p => p.mapId === mapId)
              const isAvailable = remainingMapIds.includes(mapId)
              const isDecider = isPicked?.slot === 'decider'

              const canClick = isMyTurn && !pendingSidePick && isAvailable

              return (
                <button
                  key={mapId}
                  type="button"
                  disabled={!canClick}
                  onClick={() => handleCaptainMapClick(mapId)}
                  className={`group relative aspect-video w-full overflow-hidden rounded-xl transition-all text-left ${
                    canClick
                      ? 'cursor-pointer ring-2 ring-amber-400/80 hover:ring-white hover:scale-[1.03] shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                      : isAvailable
                        ? 'opacity-80 ring-1 ring-white/10 cursor-not-allowed'
                        : 'opacity-40 ring-1 ring-white/5 cursor-not-allowed'
                  }`}
                >
                  <img
                    src={map?.image || ''}
                    alt={map?.mapName || mapId}
                    className={`size-full object-cover ${isBanned ? 'grayscale brightness-40' : 'brightness-75'}`}
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />

                  {/* Center Map Name */}
                  <div className="absolute inset-0 flex items-center justify-center z-5">
                    <span
                      className="font-schabo text-3xl tracking-wider uppercase text-white"
                      style={{ textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}
                    >
                      {map?.mapName || mapId}
                    </span>
                  </div>

                  {/* Status Overlay */}
                  {isBanned && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/75 backdrop-blur-[2px]">
                      <X className="size-6 text-red-500 mb-0.5" />
                      <span className="text-[10px] font-bold uppercase text-red-400">
                        Banned by {isBanned.bannedBy === 'TEAM_A' ? teamAName : teamBName}
                      </span>
                    </div>
                  )}

                  {isPicked && !isDecider && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/75 backdrop-blur-[2px] p-2 text-center">
                      <Check className="size-6 text-emerald-400 mb-0.5" />
                      <span className="text-[10px] font-bold uppercase text-emerald-400">
                        {isPicked.slot.toUpperCase()} • Picked by {isPicked.pickedBy === 'TEAM_A' ? teamAName : teamBName}
                      </span>
                    </div>
                  )}

                  {isDecider && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/75 backdrop-blur-[2px]">
                      <span className="text-xs font-bold uppercase text-amber-400 tracking-wider">
                        DECIDER MAP
                      </span>
                    </div>
                  )}

                  {/* Hover Prompt on My Turn */}
                  {canClick && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-amber-500/20 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="rounded bg-amber-500 px-3 py-1.5 text-xs font-bold text-black uppercase tracking-wider shadow-lg">
                        {currentStep?.type === 'PICK' ? 'PICK THIS MAP' : 'BAN THIS MAP'}
                      </span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Sequence Progress Tracker */}
        <div className="rounded-xl border border-white/10 bg-[#16171a] p-5 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            VETO PROGRESSION
          </h3>
          <div className="flex flex-wrap gap-2">
            {sequence.map((step, idx) => {
              const pick = pickedMaps.find(p => p.sequenceNo === step.sequenceNo)
              const ban = bannedMaps.find(b => b.sequenceNo === step.sequenceNo)
              const isCurrent = idx === currentStepIndex && isStarted && !isCompleted
              const isDone = !!pick || !!ban || idx < currentStepIndex
              const mapName = (pick?.mapId || ban?.mapId || '').toUpperCase()

              return (
                <div
                  key={step.id || idx}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-all ${
                    isCurrent
                      ? 'border-amber-400 bg-amber-500/10 text-amber-300 font-bold shadow-md'
                      : isDone
                        ? 'border-white/10 bg-white/5 text-zinc-300'
                        : 'border-white/5 bg-[#121417] text-zinc-500'
                  }`}
                >
                  <span className="text-[10px] font-mono opacity-60">#{step.sequenceNo}</span>
                  <span className="font-semibold uppercase">{step.type}</span>
                  <span className="opacity-80">
                    ({step.actor === 'TEAM_A' ? teamAName : step.actor === 'TEAM_B' ? teamBName : 'Decider'})
                  </span>
                  {mapName && (
                    <span className="font-bold text-white bg-white/10 px-1.5 py-0.5 rounded text-[10px]">
                      {mapName}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </main>

      {/* 3D Coin Toss Modal */}
      <CoinTossModal
        isOpen={coinTossOpen}
        onClose={() => setCoinTossOpen(false)}
        teamA={teamA as any}
        teamB={teamB as any}
        onAssignWinner={async (winner) => {
          await pushUpdate({ vetoFirstPickTeam: winner })
          setCoinTossOpen(false)
        }}
      />
    </div>
  )
}
