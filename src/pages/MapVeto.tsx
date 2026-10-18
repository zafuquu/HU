import { useState, useEffect, useMemo, useRef } from 'react'
import { Check, X, RotateCcw, ChevronDown, ClipboardList, Play, Copy, Undo2 } from 'lucide-react'
import { useAppStore } from '../store/AppContext'

export interface MapItem {
  mapId: string
  mapName: string
  image: string
  isActiveComp: boolean
}

// 7 Active Competitive Maps in exact order from screenshot
export const VAL_MAPS: MapItem[] = [
  { mapId: 'ascent', mapName: 'ASCENT', image: '/game/val/maps/ascent/splash-small.png', isActiveComp: true },
  { mapId: 'split', mapName: 'SPLIT', image: '/game/val/maps/bonsai/splash-small.png', isActiveComp: true },
  { mapId: 'breeze', mapName: 'BREEZE', image: '/game/val/maps/foxtrot/splash-small.png', isActiveComp: true },
  { mapId: 'lotus', mapName: 'LOTUS', image: '/game/val/maps/jam/splash-small.png', isActiveComp: true },
  { mapId: 'sunset', mapName: 'SUNSET', image: '/game/val/maps/juliett/splash-small.png', isActiveComp: true },
  { mapId: 'summit', mapName: 'SUMMIT', image: '/game/val/maps/plummet/splash-small.png', isActiveComp: true },
  { mapId: 'haven', mapName: 'HAVEN', image: '/game/val/maps/triad/splash-small.png', isActiveComp: true },
  { mapId: 'corrode', mapName: 'CORRODE', image: '/game/val/maps/rook/splash-small.png', isActiveComp: true },
  { mapId: 'gauntlet', mapName: 'GAUNTLET', image: '/game/val/maps/gauntlet/splash-small.png', isActiveComp: true },

  // Other Maps (collapsible)
  { mapId: 'fracture', mapName: 'FRACTURE', image: '/game/val/maps/canyon/splash-small.png', isActiveComp: false },
  { mapId: 'bind', mapName: 'BIND', image: '/game/val/maps/duality/splash-small.png', isActiveComp: false },
  { mapId: 'district', mapName: 'DISTRICT', image: '/game/val/maps/hurm_alley/splash-small.png', isActiveComp: false },
  { mapId: 'kasbah', mapName: 'KASBAH', image: '/game/val/maps/hurm_bowl/splash-small.png', isActiveComp: false },
  { mapId: 'drift', mapName: 'DRIFT', image: '/game/val/maps/hurm_helix/splash-small.png', isActiveComp: false },
  { mapId: 'glitch', mapName: 'GLITCH', image: '/game/val/maps/hurm_hightide/splash-small.png', isActiveComp: false },
  { mapId: 'piazza', mapName: 'PIAZZA', image: '/game/val/maps/hurm_yard/splash-small.png', isActiveComp: false },
  { mapId: 'abyss', mapName: 'ABYSS', image: '/game/val/maps/infinity_/splash-small.png', isActiveComp: false },
  { mapId: 'pearl', mapName: 'PEARL', image: '/game/val/maps/pitt/splash-small.png', isActiveComp: false },
  { mapId: 'icebox', mapName: 'ICEBOX', image: '/game/val/maps/port/splash-small.png', isActiveComp: false },
  { mapId: 'skirmish_a', mapName: 'SKIRMISH A', image: '/game/val/maps/skirmish_a/splash-small.png', isActiveComp: false },
  { mapId: 'skirmish_b', mapName: 'SKIRMISH B', image: '/game/val/maps/skirmish_b/splash-small.png', isActiveComp: false },
  { mapId: 'skirmish_c', mapName: 'SKIRMISH C', image: '/game/val/maps/skirmish_c/splash-small.png', isActiveComp: false },
  { mapId: 'skirmish_d', mapName: 'SKIRMISH D', image: '/game/val/maps/skirmish_d/splash-small.png', isActiveComp: false },
  { mapId: 'skirmish_e', mapName: 'SKIRMISH E', image: '/game/val/maps/skirmish_e/splash-small.png', isActiveComp: false },
]

export interface MapHistoryItem {
  slot: string
  mapId: string
  mapName: string
  kind: 'pick' | 'ban' | 'decider' | 'pool'
  score?: string
}

export function buildMapHistoryItems(
  picks: { mapId: string; slot?: string | null }[] | undefined | null,
  bans: { mapId: string }[] | undefined | null,
  poolMapIds: string[] | undefined | null,
  results?: { slot: string; mapId: string; score?: string }[] | null,
): MapHistoryItem[] {
  const name = (id: string) => VAL_MAPS.find(mm => mm.mapId === id)?.mapName || id.toUpperCase()
  const order: Record<string, number> = { map1: 1, map2: 2, map3: 3, map4: 4, map5: 5, decider: 99 }
  const items: MapHistoryItem[] = []
  const seen = new Set<string>()
  // Series results FIRST — they are the durable series record (they survive
  // Restart Active Session) and carry each completed map's final score
  // ("Map 1: SPLIT 13-9").
  for (const r of results || []) {
    const slot = r.slot || 'map' + (items.filter(i => i.kind !== 'decider').length + 1)
    if (seen.has(slot)) continue
    seen.add(slot)
    items.push({ slot, mapId: r.mapId, mapName: name(r.mapId), kind: slot === 'decider' ? 'decider' : 'pick', score: r.score })
  }
  // Picks: dedupe BY SLOT keeping the LATEST entry — a later pick for the
  // same slot (e.g. a re-run decider) overwrites the earlier one instead of
  // appending a duplicate DECIDER with a different map. A slot already
  // recorded in the series results keeps its completed score.
  let pickN = 0
  for (const p of picks || []) {
    const slotName = p.slot || 'map' + String(++pickN)
    if (seen.has(slotName)) {
      const idx = items.findIndex(i => i.slot === slotName)
      if (idx >= 0 && !items[idx].score) {
        items[idx] = { slot: slotName, mapId: p.mapId, mapName: name(p.mapId), kind: slotName === 'decider' ? 'decider' : 'pick', score: items[idx].score }
      }
      continue
    }
    seen.add(slotName)
    items.push({
      slot: slotName,
      mapId: p.mapId,
      mapName: name(p.mapId),
      kind: slotName === 'decider' ? 'decider' : 'pick',
    })
  }
  items.sort((a, b) => (order[a.slot] ?? 50) - (order[b.slot] ?? 50))
  for (const b of bans || []) {
    if (!items.some(i => i.mapId === b.mapId)) {
      items.push({ slot: 'ban-' + b.mapId, mapId: b.mapId, mapName: name(b.mapId), kind: 'ban' })
    }
  }
  if (items.length === 0) {
    for (const id of (poolMapIds || []).slice(0, 3)) {
      items.push({ slot: 'pool-' + id, mapId: id, mapName: name(id), kind: 'pool' })
    }
  }
  if (items.length === 0) {
    items.push({ slot: 'pool', mapId: 'ascent', mapName: 'ASCENT', kind: 'pool' })
    items.push({ slot: 'pool', mapId: 'haven', mapName: 'HAVEN', kind: 'pool' })
  }
  return items
}

export type VetoStepType = 'BAN' | 'PICK' | 'SIDE_PICK' | 'DECIDER'

export interface VetoStep {
  sequenceNo: number
  type: VetoStepType
  actor: 'TEAM_A' | 'TEAM_B' | 'DECIDER'
  targetSlot?: string
}

export function getVetoSequence(format: string): VetoStep[] {
  switch (format) {
    case 'BO1':
      return [
        { sequenceNo: 1, type: 'BAN', actor: 'TEAM_A' },
        { sequenceNo: 2, type: 'BAN', actor: 'TEAM_B' },
        { sequenceNo: 3, type: 'BAN', actor: 'TEAM_A' },
        { sequenceNo: 4, type: 'BAN', actor: 'TEAM_B' },
        { sequenceNo: 5, type: 'BAN', actor: 'TEAM_A' },
        { sequenceNo: 6, type: 'BAN', actor: 'TEAM_B' },
        { sequenceNo: 7, type: 'DECIDER', actor: 'DECIDER' },
      ]
    case 'BO5':
      return [
        { sequenceNo: 1, type: 'BAN', actor: 'TEAM_A' },
        { sequenceNo: 2, type: 'BAN', actor: 'TEAM_B' },
        { sequenceNo: 3, type: 'PICK', actor: 'TEAM_A', targetSlot: 'map1' },
        { sequenceNo: 4, type: 'SIDE_PICK', actor: 'TEAM_B', targetSlot: 'map1' },
        { sequenceNo: 5, type: 'PICK', actor: 'TEAM_B', targetSlot: 'map2' },
        { sequenceNo: 6, type: 'SIDE_PICK', actor: 'TEAM_A', targetSlot: 'map2' },
        { sequenceNo: 7, type: 'PICK', actor: 'TEAM_A', targetSlot: 'map3' },
        { sequenceNo: 8, type: 'SIDE_PICK', actor: 'TEAM_B', targetSlot: 'map3' },
        { sequenceNo: 9, type: 'PICK', actor: 'TEAM_B', targetSlot: 'map4' },
        { sequenceNo: 10, type: 'SIDE_PICK', actor: 'TEAM_A', targetSlot: 'map4' },
        { sequenceNo: 11, type: 'DECIDER', actor: 'DECIDER', targetSlot: 'map5' },
      ]
    case 'BO3':
    default:
      // BO3 9 steps (Ban A, Ban B, Pick A, Side B, Pick B, Side A, Ban A, Ban B, Decider)
      return [
        { sequenceNo: 1, type: 'BAN', actor: 'TEAM_A' },
        { sequenceNo: 2, type: 'BAN', actor: 'TEAM_B' },
        { sequenceNo: 3, type: 'PICK', actor: 'TEAM_A', targetSlot: 'map1' },
        { sequenceNo: 4, type: 'SIDE_PICK', actor: 'TEAM_B', targetSlot: 'map1' },
        { sequenceNo: 5, type: 'PICK', actor: 'TEAM_B', targetSlot: 'map2' },
        { sequenceNo: 6, type: 'SIDE_PICK', actor: 'TEAM_A', targetSlot: 'map2' },
        { sequenceNo: 7, type: 'BAN', actor: 'TEAM_A' },
        { sequenceNo: 8, type: 'BAN', actor: 'TEAM_B' },
        { sequenceNo: 9, type: 'DECIDER', actor: 'DECIDER', targetSlot: 'map3' },
      ]
  }
}

// Crossed swords attack icon
const ValorantAttackIcon = ({ className = 'size-6' }: { className?: string }) => (
  <svg viewBox="0 0 83 81" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      d="M20.7038 44.2252C20.9022 44.245 21.0898 44.3229 21.2429 44.4489L21.3161 44.5162L35.235 58.4957C36.012 59.276 36.0129 60.5376 35.236 61.318L30.7936 65.7789L35.2429 70.2448C36.0204 71.0252 36.0204 72.2875 35.2429 73.068L30.8034 77.524C30.0217 78.3085 28.751 78.3086 27.9694 77.524L19.1452 68.6666L8.85614 78.9948C8.07446 79.779 6.8037 79.7792 6.02216 78.9948L1.5827 74.5377C0.805779 73.7574 0.805746 72.4958 1.5827 71.7155L11.8825 61.3727L3.04852 52.5084C2.27089 51.728 2.27095 50.4657 3.04852 49.6852L7.48798 45.2291C8.26944 44.4449 9.53931 44.4451 10.321 45.2291L14.7546 49.6764L19.8923 44.5162L19.9655 44.4489C20.1438 44.3021 20.3692 44.2203 20.6042 44.2203L20.7038 44.2252ZM18.1071 1.01135C18.6381 1.01192 19.1474 1.22401 19.5222 1.60022L67.4177 49.6803L71.8561 45.2291C72.6378 44.4451 73.9077 44.4449 74.6891 45.2291L79.1296 49.6852C79.907 50.4655 79.9067 51.7279 79.1296 52.5084L70.2975 61.3766L80.5944 71.7155C81.3714 72.4958 81.3713 73.7574 80.5944 74.5377L76.155 78.9948C75.3734 79.7792 74.1027 79.779 73.321 78.9948L63.0319 68.6666L54.2077 77.524C53.4261 78.3086 52.1554 78.3085 51.3737 77.524L46.9343 73.068C46.1569 72.2877 46.1562 71.0253 46.9333 70.2448L51.3796 65.7799L3.44305 17.6637C3.07002 17.2893 2.86049 16.7821 2.86005 16.2535L2.84833 3.00256C2.84739 1.8967 3.74443 0.999724 4.85028 1.00061L18.1071 1.01135ZM77.3317 1.01135C78.4351 1.01238 79.3291 1.90697 79.3298 3.01038L79.3376 16.2301C79.3379 16.7597 79.1274 17.268 78.7536 17.6432L62.9831 33.4694C62.2015 34.2534 60.9316 34.2536 60.1501 33.4694L46.9304 20.2037C46.1527 19.4233 46.1528 18.161 46.9304 17.3805L62.6667 1.5885C63.0424 1.21149 63.5534 0.999181 64.0856 0.999634L77.3317 1.01135Z"
      fill="#FF4646"
    />
  </svg>
)

// Shield defense icon
const ValorantDefenseIcon = ({ className = 'size-6' }: { className?: string }) => (
  <svg viewBox="0 0 83 87" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      d="M41.5 87H39.6807L25.3864 75.0808L11.0926 63.1616L10.4531 62.2916L9.81361 61.4216L4.90856 41.2373L0.00315184 21.0529L0.0017511 19.3599L0 17.6669L0.96308 16.8038L1.92616 15.9411L21.0127 7.97072L40.0992 0H41.5H42.9008L61.9873 7.97072L81.0738 15.9411L82.0369 16.8038L83 17.6669L82.9983 19.3599L82.9968 21.0529L78.0914 41.2373L73.1864 61.4216L72.5469 62.2916L71.9074 63.1616L57.6136 75.0808L43.3193 87H41.5Z"
      fill="#2FC28F"
    />
  </svg>
)

const SwitchSidesIcon = ({ className = 'size-5' }: { className?: string }) => (
  <svg width="19" height="18" viewBox="0 0 19 18" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <g>
      <path d="M1.25 7H9.92146C13.2187 7 14.8673 7 15.2364 6.03676C15.6055 5.07351 14.3791 3.97177 11.9263 1.76829L11.0711 1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17.75 11H9.07854C5.78133 11 4.13272 11 3.76359 11.9632C3.39447 12.9265 4.62087 14.0282 7.07368 16.2317L7.9289 17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  </svg>
)

export default function MapVeto() {
  const { state, setState, showToast } = useAppStore()

  const [selectedFormat, setSelectedFormat] = useState<'BO1' | 'BO2' | 'BO3' | 'BO5' | 'BO7'>((state.vetoFormat as 'BO1' | 'BO2' | 'BO3' | 'BO5' | 'BO7') || 'BO3')
  const [selectedMapIds, setSelectedMapIds] = useState<string[]>(
    state.vetoSelectedMapIds && state.vetoSelectedMapIds.length
      ? state.vetoSelectedMapIds
      : VAL_MAPS.filter(m => m.isActiveComp).map(m => m.mapId)
  )

  const [otherMapsOpen, setOtherMapsOpen] = useState(false)
  const [firstPickTeam, setFirstPickTeam] = useState<'TEAM_A' | 'TEAM_B'>(state.vetoFirstPickTeam ?? 'TEAM_A')
  const [isVetoStarted, setIsVetoStarted] = useState(state.vetoStarted ?? false)
  const [isVetoCompleted, setIsVetoCompleted] = useState(state.vetoCompleted ?? false)
  const [currentStepIndex, setCurrentStepIndex] = useState(state.vetoStepIndex ?? 0)
  const [animationSpeed, setAnimationSpeed] = useState('750')

  // In-progress acting team and action overrides (persisted to context so a
  // mid-veto navigation doesn't reset them).
  const [actingTeamOverride, setActingTeamOverride] = useState<'TEAM_A' | 'TEAM_B'>(state.vetoActingTeamOverride ?? 'TEAM_A')
  const [actionTypeOverride, setActionTypeOverride] = useState<'Ban' | 'Pick' | 'Side pick' | 'Decider'>(state.vetoActionTypeOverride ?? 'Ban')

  const [pendingSidePick, setPendingSidePick] = useState<{
    mapId: string
    pickedBy: 'TEAM_A' | 'TEAM_B'
    choosingSideTeam: 'TEAM_A' | 'TEAM_B'
    slot: string
  } | null>(state.vetoPendingSidePick ?? null)

  const [deciderSideOpen, setDeciderSideOpen] = useState(false)

  const vetoPersistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Persist the veto session across page navigation by mirroring it back to
  // AppContext (which survives route changes).
  useEffect(() => {
    if (vetoPersistTimer.current) clearTimeout(vetoPersistTimer.current)
    vetoPersistTimer.current = setTimeout(() => {
      setState(prev => ({
        ...prev,
        vetoFormat: selectedFormat,
        vetoSelectedMapIds: selectedMapIds,
        vetoFirstPickTeam: firstPickTeam,
        vetoStarted: isVetoStarted,
        vetoCompleted: isVetoCompleted,
        vetoStepIndex: currentStepIndex,
        vetoActingTeamOverride: actingTeamOverride,
        vetoActionTypeOverride: actionTypeOverride,
        vetoPendingSidePick: pendingSidePick,
      }))
    }, 150)
    return () => { if (vetoPersistTimer.current) clearTimeout(vetoPersistTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMapIds, firstPickTeam, isVetoStarted, isVetoCompleted, currentStepIndex, actingTeamOverride, actionTypeOverride, pendingSidePick, setState])

  const teamA = state.teams.find(t => t.id === state.teamAId) || state.teams[0]
  const teamB = state.teams.find(t => t.id === state.teamBId) || state.teams[1]

  const sequence = useMemo(() => getVetoSequence(selectedFormat), [selectedFormat])

  const bannedMaps = state.mapBans || []
  const pickedMaps = state.mapPicks || []

  const remainingMapIds = useMemo(() => {
    const banned = new Set(bannedMaps.map((b: { mapId: string }) => b.mapId))
    const picked = new Set(pickedMaps.map((p: { mapId: string }) => p.mapId))
    return selectedMapIds.filter(id => !banned.has(id) && !picked.has(id))
  }, [selectedMapIds, bannedMaps, pickedMaps])

  const toggleMapSelection = (mapId: string) => {
    if (isVetoStarted) return
    setSelectedMapIds(prev =>
      prev.includes(mapId) ? prev.filter(id => id !== mapId) : [...prev, mapId]
    )
  }

  const swapOrder = () => {
    setFirstPickTeam(prev => (prev === 'TEAM_A' ? 'TEAM_B' : 'TEAM_A'))
    showToast('Team order swapped')
  }

  const startVeto = () => {
    if (selectedMapIds.length < 3) {
      showToast('Select at least 3 maps to start veto')
      return
    }
    setIsVetoStarted(true)
    setIsVetoCompleted(false)
    setCurrentStepIndex(0)
    setState(prev => ({ ...prev, mapBans: [], mapPicks: [], vetoSteps: [] }))
    showToast('Map Veto started!')
  }

  const resetVeto = () => {
    setIsVetoStarted(false)
    setIsVetoCompleted(false)
    setCurrentStepIndex(0)
    setPendingSidePick(null)
    setState(prev => ({ ...prev, mapBans: [], mapPicks: [], vetoSteps: [] }))
    showToast('Map Veto restarted')
  }

  // EXPLICIT series reset — the ONLY action that clears the series map
  // history. Restart Active Session intentionally does NOT touch mapResults.
  const resetSeries = () => {
    setState(prev => ({ ...prev, mapResults: [], mapBans: [], mapPicks: [], vetoSteps: [] }))
    setIsVetoStarted(false)
    setIsVetoCompleted(false)
    setCurrentStepIndex(0)
    setPendingSidePick(null)
    showToast('Series reset — map history cleared')
  }

  const handleMapClick = (mapId: string) => {
    if (!isVetoStarted || isVetoCompleted) return
    if (!remainingMapIds.includes(mapId)) return

    const actor = actingTeamOverride
    const action = actionTypeOverride

    if (action === 'Ban') {
      const newBan = {
        sequenceNo: currentStepIndex + 1,
        mapId,
        bannedBy: actor,
      }
      setState(prev => ({
        ...prev,
        mapBans: [...(prev.mapBans || []), newBan],
        vetoSteps: [...(prev.vetoSteps || []), { team: actor, action: 'Ban' as const, map: mapId }],
      }))
      showToast(`${actor === 'TEAM_A' ? teamA?.name : teamB?.name} banned ${mapId.toUpperCase()}`)
      advanceStep()
    } else if (action === 'Pick') {
      const choosingSideTeam = actor === 'TEAM_A' ? 'TEAM_B' : 'TEAM_A'
      setPendingSidePick({
        mapId,
        pickedBy: actor,
        choosingSideTeam,
        slot: `map${pickedMaps.length + 1}`,
      })
    } else if (action === 'Decider') {
      const newPick = {
        sequenceNo: currentStepIndex + 1,
        mapId,
        pickedBy: 'DECIDER' as const,
        slot: 'decider',
      }
      setState(prev => ({
        ...prev,
        mapPicks: [...(prev.mapPicks || []), newPick],
        vetoSteps: [...(prev.vetoSteps || []), { team: 'DECIDER', action: 'Decider' as const, map: mapId }],
      }))
      showToast(`${mapId.toUpperCase()} selected as Decider!`)
      advanceStep()
    }
  }

  const handleSidePick = (side: 'ATTACK' | 'DEFENSE') => {
    if (!pendingSidePick) return

    const choosingSideTeam = pendingSidePick.choosingSideTeam
    const otherTeam = choosingSideTeam === 'TEAM_A' ? 'TEAM_B' : 'TEAM_A'
    const otherSide = side === 'ATTACK' ? 'DEFENSE' : 'ATTACK'

    const sideSelection = {
      [choosingSideTeam]: side,
      [otherTeam]: otherSide,
    } as { TEAM_A: 'ATTACK' | 'DEFENSE'; TEAM_B: 'ATTACK' | 'DEFENSE' }

    const newPick = {
      sequenceNo: currentStepIndex + 1,
      mapId: pendingSidePick.mapId,
      pickedBy: pendingSidePick.pickedBy,
      slot: pendingSidePick.slot,
      sideSelection,
    }

    setState(prev => ({
      ...prev,
      mapPicks: [...(prev.mapPicks || []), newPick],
      vetoSteps: [...(prev.vetoSteps || []), { team: pendingSidePick.pickedBy, action: 'Pick' as const, map: pendingSidePick.mapId, side: side === 'ATTACK' ? 'Offense' : 'Defense' }],
    }))

    showToast(
      `${choosingSideTeam === 'TEAM_A' ? teamA?.name : teamB?.name} picked ${side} on ${pendingSidePick.mapId.toUpperCase()}`
    )
    setPendingSidePick(null)
    advanceStep(2)
  }

  const handleDeciderSide = (side: 'ATTACK' | 'DEFENSE') => {
    const decider = (state.mapPicks || []).find(p => p.slot === 'decider')
    if (!decider) return
    const otherSide = side === 'ATTACK' ? 'DEFENSE' : 'ATTACK'
    const sideSelection = { TEAM_A: side, TEAM_B: otherSide } as { TEAM_A: 'ATTACK' | 'DEFENSE'; TEAM_B: 'ATTACK' | 'DEFENSE' }
    setState(prev => ({
      ...prev,
      mapPicks: (prev.mapPicks || []).map(p => p.slot === 'decider' ? { ...p, sideSelection } : p),
    }))
    setDeciderSideOpen(false)
    showToast(`Decider side set: ${teamA?.name} ${side} / ${teamB?.name} ${otherSide}`)
  }

  const advanceStep = (stepCount = 1) => {
    const nextIdx = currentStepIndex + stepCount
    if (nextIdx >= sequence.length) {
      showToast('Map Veto completed!')
      setCurrentStepIndex(sequence.length)
      setIsVetoCompleted(true)
    } else {
      setCurrentStepIndex(nextIdx)
      const nextStep = sequence[nextIdx]
      if (nextStep) {
        setActingTeamOverride(nextStep.actor === 'DECIDER' ? 'TEAM_A' : nextStep.actor)
        setActionTypeOverride(nextStep.type === 'BAN' ? 'Ban' : nextStep.type === 'PICK' ? 'Pick' : nextStep.type === 'DECIDER' ? 'Decider' : 'Side pick')
      }
    }
  }

  const undoLastStep = () => {
    if (currentStepIndex === 0) return
    setCurrentStepIndex(prev => Math.max(0, prev - 1))
    setState(prev => {
      const bans = [...(prev.mapBans || [])]
      const picks = [...(prev.mapPicks || [])]
      const steps = [...(prev.vetoSteps || [])]
      if (bans.length > picks.length) bans.pop()
      else if (picks.length > 0) picks.pop()
      steps.pop()
      return { ...prev, mapBans: bans, mapPicks: picks, vetoSteps: steps }
    })
    showToast('Undid previous action')
  }

  const exportVetoSummary = () => {
    const summary = sequence.map(step => {
      const pick = pickedMaps.find((p: any) => p.sequenceNo === step.sequenceNo)
      const ban = bannedMaps.find((b: any) => b.sequenceNo === step.sequenceNo)
      const mapId = pick?.mapId || ban?.mapId || 'TBD'
      const actorName = step.actor === 'TEAM_A' ? teamA?.name : step.actor === 'TEAM_B' ? teamB?.name : 'Decider'
      return `${step.sequenceNo}. [${step.type}] ${mapId.toUpperCase()} (${actorName})`
    }).join('\n')

    navigator.clipboard.writeText(summary).catch(() => {})
    showToast('Veto summary copied to clipboard!')
  }

  const compMaps = VAL_MAPS.filter(m => m.isActiveComp)
  const otherMaps = VAL_MAPS.filter(m => !m.isActiveComp)
  // The actual pool being vetoed = whatever the user selected (active comp + any
  // "other" maps), so non-active maps selected in setup appear in the veto grid.
  const poolMaps = selectedMapIds
    .map(id => VAL_MAPS.find(m => m.mapId === id))
    .filter((m): m is MapItem => !!m)

  return (
    <div className="size-full overflow-y-auto p-8 text-white" style={{ scrollbarWidth: 'none' }}>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#f1f1f1]">Map Veto</h1>
          <p className="mt-1 text-sm text-[#e7e7e7]/50">
            Choose the map pool and team order, then run the veto or invite captains.
          </p>
        </div>

        {isVetoCompleted && (
          <button
            type="button"
            onClick={() => {
              const decider = (state.mapPicks || []).find(p => p.slot === 'decider')
              if (!decider) { showToast('No decider map selected yet'); return }
              setDeciderSideOpen(true)
            }}
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-[#eaeaea] transition-all cursor-pointer"
          >
            Choose decider side
          </button>
        )}
      </div>

      {/* ========================================================================= */}
      {/* PHASE 1: Setup Mode (Exact match to map veto.png)                         */}
      {/* ========================================================================= */}
      {!isVetoStarted && !isVetoCompleted && (
        <div className="space-y-6">
          {/* Controls Bar: FORMAT | TEAM ASSIGNMENT | MAP POOL */}
          <div className="flex flex-wrap items-center justify-between gap-6 border-b border-white/5 pb-6">
            {/* Format Pills */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold tracking-wider text-[#e7e7e7]/40 uppercase">FORMAT</span>
              <div className="flex items-center gap-1 rounded-lg border border-white/5 bg-[#121417] p-1">
                {(['BO1', 'BO2', 'BO3', 'BO5', 'BO7'] as const).map(fmt => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setSelectedFormat(fmt)}
                    className={`rounded-md px-3.5 py-1 text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                      selectedFormat === fmt
                        ? 'bg-white/10 text-white shadow-sm'
                        : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            {/* Team Assignment with Swap Button */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold tracking-wider text-[#e7e7e7]/40 uppercase">TEAM ASSIGNMENT</span>
              <div className="flex items-center gap-3">
                <div className="flex w-36 flex-col justify-center rounded-lg border border-white/5 bg-[#121417] px-3.5 py-2">
                  <span className="text-[9px] font-medium text-[#e7e7e7]/40 uppercase">TEAM A</span>
                  <span className="truncate text-xs font-semibold text-white">{firstPickTeam === 'TEAM_A' ? teamA?.name : teamB?.name}</span>
                </div>

                <button
                  type="button"
                  onClick={swapOrder}
                  className="flex size-7 items-center justify-center text-[#e7e7e7]/40 hover:text-white transition-colors cursor-pointer"
                  title="Swap team assignment"
                >
                  <SwitchSidesIcon className="size-4" />
                </button>

                <div className="flex w-36 flex-col justify-center rounded-lg border border-white/5 bg-[#121417] px-3.5 py-2">
                  <span className="text-[9px] font-medium text-[#e7e7e7]/40 uppercase">TEAM B</span>
                  <span className="truncate text-xs font-semibold text-white">{firstPickTeam === 'TEAM_A' ? teamB?.name : teamA?.name}</span>
                </div>
              </div>
            </div>

            {/* Map Pool Counter */}
            <div className="space-y-2">
              <span className="text-[11px] font-semibold tracking-wider text-[#e7e7e7]/40 uppercase">MAP POOL</span>
              <div className="flex h-10 items-center justify-center rounded-lg border border-white/5 bg-[#121417] px-4">
                <span className="text-xs font-semibold text-white/80">{selectedMapIds.length} selected</span>
              </div>
            </div>
          </div>

          {/* ACTIVE COMPETITIVE MAPS (5-column grid) */}
          <div className="space-y-3">
            <h3 className="text-xs font-medium tracking-wider text-[#e7e7e7]/50 uppercase">
              ACTIVE COMPETITIVE MAPS
            </h3>

            <div className="grid grid-cols-5 gap-3.5">
              {compMaps.map(map => {
                const isSelected = selectedMapIds.includes(map.mapId)
                return (
                  <button
                    key={map.mapId}
                    type="button"
                    onClick={() => toggleMapSelection(map.mapId)}
                    className={`group relative aspect-video w-full overflow-hidden rounded-lg transition-all duration-200 cursor-pointer text-left ${
                      isSelected
                        ? 'ring-2 ring-[#3697FF] shadow-[0_0_12px_rgba(54,151,255,0.3)]'
                        : 'opacity-50 ring-1 ring-white/10 hover:opacity-80'
                    }`}
                  >
                    <img
                      src={map.image}
                      alt={map.mapName}
                      className="size-full object-cover brightness-75"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Top-Right Circular Checkmark Badge */}
                    {isSelected && (
                      <div className="absolute top-2.5 right-2.5 z-10 flex size-5 items-center justify-center rounded-full bg-[#3697FF] shadow-md">
                        <Check className="size-3 text-white stroke-3" />
                      </div>
                    )}

                    {/* Center Map Title */}
                    <div className="absolute inset-0 flex items-center justify-center z-5">
                      <span
                        className="font-schabo text-[36px] tracking-wider uppercase text-white"
                        style={{ textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}
                      >
                        {map.mapName}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* OTHER MAPS (Collapsible 5-column grid) */}
          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={() => setOtherMapsOpen(!otherMapsOpen)}
              className="flex w-full items-center justify-between text-xs font-medium tracking-wider text-[#e7e7e7]/50 uppercase hover:text-white transition-colors cursor-pointer"
            >
              <span>OTHER MAPS</span>
              <ChevronDown className={`size-4 transition-transform duration-200 ${otherMapsOpen ? 'rotate-180' : ''}`} />
            </button>

            {otherMapsOpen && (
              <div className="grid grid-cols-5 gap-3.5 pt-1">
                {otherMaps.map(map => {
                  const isSelected = selectedMapIds.includes(map.mapId)
                  return (
                    <button
                      key={map.mapId}
                      type="button"
                      onClick={() => toggleMapSelection(map.mapId)}
                      className={`group relative aspect-video w-full overflow-hidden rounded-lg transition-all duration-200 cursor-pointer text-left ${
                        isSelected
                          ? 'ring-2 ring-[#3697FF] shadow-[0_0_12px_rgba(54,151,255,0.3)]'
                          : 'opacity-40 ring-1 ring-white/10 hover:opacity-70'
                      }`}
                    >
                      <img
                        src={map.image}
                        alt={map.mapName}
                        className="size-full object-cover brightness-75"
                      />
                      <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />

                      {isSelected && (
                        <div className="absolute top-2.5 right-2.5 z-10 flex size-5 items-center justify-center rounded-full bg-[#3697FF] shadow-md">
                          <Check className="size-3 text-white stroke-3" />
                        </div>
                      )}

                      <div className="absolute inset-0 flex items-center justify-center z-5">
                        <span
                          className="font-schabo text-[36px] tracking-wider uppercase text-white"
                          style={{ textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}
                        >
                          {map.mapName}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Bottom Start Veto Button */}
          <div className="flex justify-end pt-6 border-t border-white/5">
            <button
              type="button"
              onClick={startVeto}
              className="flex items-center justify-center rounded-lg bg-white px-8 py-2.5 text-sm font-bold tracking-wider text-black uppercase hover:bg-[#eaeaea] transition-all shadow-lg cursor-pointer"
            >
              START VETO
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PHASE 2: In-Progress Voting Mode (Exact match to map veto after start.png) */}
      {/* ========================================================================= */}
      {isVetoStarted && !isVetoCompleted && (
        <div className="flex gap-8">
          {/* Left Column: Voting Controls + 5-Col Grid */}
          <div className="flex-1 space-y-6">
            {/* Action Bar: Acting Team | Configured Action | Undo */}
            <div className="flex flex-wrap items-center gap-8 border-b border-white/5 pb-4">
              {/* Acting Team */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-[#e7e7e7]/40 uppercase">Acting Team</span>
                <div className="flex items-center gap-1 rounded-lg border border-white/5 bg-[#121417] p-1">
                  <button
                    type="button"
                    onClick={() => setActingTeamOverride('TEAM_A')}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                      actingTeamOverride === 'TEAM_A'
                        ? 'bg-white text-black shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {firstPickTeam === 'TEAM_A' ? teamA?.name : teamB?.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActingTeamOverride('TEAM_B')}
                    className={`rounded-md px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                      actingTeamOverride === 'TEAM_B'
                        ? 'bg-white text-black shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {firstPickTeam === 'TEAM_A' ? teamB?.name : teamA?.name}
                  </button>
                </div>
              </div>

              {/* Configured Action */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-[#e7e7e7]/40 uppercase">Configured Action</span>
                <div className="flex items-center gap-1 rounded-lg border border-white/5 bg-[#121417] p-1">
                  {(['Ban', 'Pick', 'Side pick', 'Decider'] as const).map(action => (
                    <button
                      key={action}
                      type="button"
                      onClick={() => setActionTypeOverride(action)}
                      className={`rounded-md px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                        actionTypeOverride === action
                          ? 'bg-white text-black shadow-sm'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>

              {/* Undo Button */}
              <div className="space-y-1.5 ml-auto">
                <span className="text-[11px] font-semibold opacity-0 uppercase">Undo</span>
                <button
                  type="button"
                  onClick={undoLastStep}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#16171a] px-3.5 py-1 text-xs font-semibold text-white/80 hover:bg-white/10 transition-all cursor-pointer"
                >
                  <Undo2 className="size-3.5" />
                  <span>Undo</span>
                </button>
              </div>
            </div>

            {/* 5-Column Voting Map Grid matching screenshot */}
            <div className="grid grid-cols-5 gap-3.5">
              {poolMaps.map(map => {
                const isBanned = bannedMaps.find((b: { mapId: string }) => b.mapId === map.mapId)
                const isPicked = pickedMaps.find((p: { mapId: string }) => p.mapId === map.mapId)
                const isAvailable = remainingMapIds.includes(map.mapId)
                const isDecider = isPicked?.slot === 'decider'

                return (
                  <button
                    key={map.mapId}
                    disabled={!isAvailable}
                    onClick={() => handleMapClick(map.mapId)}
                    className={`group relative aspect-video w-full overflow-hidden rounded-lg transition-all text-left ${
                      isAvailable
                        ? 'cursor-pointer ring-1 ring-white/15 hover:ring-2 hover:ring-white/60 hover:scale-[1.02]'
                        : 'cursor-not-allowed opacity-50'
                    }`}
                  >
                    <img
                      src={map.image}
                      alt={map.mapName}
                      className={`size-full object-cover ${isBanned ? 'brightness-40 grayscale' : 'brightness-75'}`}
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Center Title */}
                    <div className="absolute inset-0 flex items-center justify-center z-5">
                      <span
                        className="font-schabo text-[36px] tracking-wider uppercase text-white"
                        style={{ textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}
                      >
                        {map.mapName}
                      </span>
                    </div>

                    {/* Banned Overlay */}
                    {isBanned && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/75 backdrop-blur-[2px]">
                        <X className="size-6 text-[#FF3838] mb-0.5" />
                        <span className="text-[10px] font-bold uppercase text-[#FF3838]">Banned</span>
                      </div>
                    )}

                    {/* Picked Overlay */}
                    {isPicked && !isDecider && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/75 backdrop-blur-[2px]">
                        <Check className="size-6 text-[#3DFF5A] mb-0.5" />
                        <span className="text-[10px] font-bold uppercase text-[#3DFF5A]">Picked</span>
                      </div>
                    )}

                    {/* Decider Overlay */}
                    {isDecider && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/75 backdrop-blur-[2px]">
                        <span className="text-[10px] font-bold uppercase text-amber-400">Decider</span>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right Column: Active Session + Animations (matching screenshot) */}
          <div className="w-72 space-y-6 shrink-0">
            {/* Active Session Box */}
            <div className="rounded-2xl border border-white/10 bg-[#16171a] p-4 shadow-xl">
              <div className="flex w-full flex-col gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-[#e7e7e7]">Active Session</h3>
                  <p className="mt-0.5 text-xs text-[#e7e7e7]/40">
                    BO{selectedFormat.replace('BO', '')} - {sequence.length} steps
                  </p>
                </div>
                <div className="flex w-full gap-2">
                  <button
                    type="button"
                    onClick={resetVeto}
                    className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-white px-3 text-xs font-semibold text-black transition-all hover:bg-[#eaeaea] cursor-pointer"
                  >
                    <RotateCcw className="size-3.5" />
                    Restart
                  </button>
                  <button
                    type="button"
                    onClick={exportVetoSummary}
                    className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-[#1e1e1e] border border-white/10 px-3 text-xs font-semibold text-white transition-all hover:bg-[#2a2a2a] cursor-pointer"
                  >
                    <ClipboardList className="size-3.5" />
                    Export
                  </button>
                </div>
                <button
                  type="button"
                  onClick={resetSeries}
                  className="flex h-8 w-full items-center justify-center rounded-lg bg-[#2a1414] border border-[#FF6B35]/30 px-3 text-xs font-semibold text-[#FF6B35] transition-all hover:bg-[#3a1c1c] cursor-pointer"
                >
                  Reset Series (clears map history)
                </button>
              </div>
            </div>

            {/* Captain lobby link */}
            <div className="flex items-center gap-2">
              <div className="flex flex-1 items-center rounded-lg border border-white/10 bg-[#16171a] px-3 py-2">
                <span className="flex-1 truncate text-xs text-[#e7e7e7]/50">
                  Captain lobby link
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/veto/${state.serverCode}`).catch(() => {})
                  showToast('Lobby link copied!')
                }}
                className="flex size-9 items-center justify-center rounded-lg border border-white/10 bg-[#16171a] text-white hover:bg-white/10 cursor-pointer"
                title="Copy Link"
              >
                <Copy className="size-4" />
              </button>
            </div>

            {/* Animations Section */}
            <div className="border-t border-white/10 pt-4 space-y-3">
              <h3 className="text-xs font-semibold text-[#e7e7e7]/60">Animations</h3>
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-1 items-center rounded-lg border border-white/10 bg-[#16171a] px-3 py-2 text-xs text-[#e7e7e7]/60">
                  Replay Team Picks
                </div>
                <button
                  type="button"
                  onClick={() => showToast('Replaying team picks...')}
                  className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-white px-4 text-xs font-bold text-black transition-all hover:bg-[#eaeaea] cursor-pointer"
                >
                  <Play className="size-3 fill-black" />
                  <span className="uppercase">PLAY</span>
                </button>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="relative flex flex-1 items-center">
                  <input
                    type="number"
                    value={animationSpeed}
                    onChange={e => setAnimationSpeed(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-[#16171a] px-3 py-2 pr-8 text-xs text-white outline-none"
                  />
                  <span className="pointer-events-none absolute right-2.5 text-xs text-white/30">ms</span>
                </div>
                <button
                  type="button"
                  onClick={() => showToast(`Playing with ${animationSpeed}ms interval`)}
                  className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-white px-4 text-xs font-bold text-black transition-all hover:bg-[#eaeaea] cursor-pointer"
                >
                  <Play className="size-3 fill-black" />
                  <span className="uppercase">PLAY</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PHASE 3: Completed Summary (Exact match to map veto after sequence.png)   */}
      {/* ========================================================================= */}
      {isVetoCompleted && (
        <div className="flex gap-8">
          {/* Left Column: Stack of Completed Banner Cards */}
          <div className="flex-1 space-y-2.5">
            {sequence.map((step, idx) => {
              const pickData = pickedMaps.find((p: any) => p.sequenceNo === step.sequenceNo)
              const banData = bannedMaps.find((b: any) => b.sequenceNo === step.sequenceNo)
              const mapId = pickData?.mapId || banData?.mapId
              const mapData = mapId ? VAL_MAPS.find(m => m.mapId === mapId) : null
              const isBan = step.type === 'BAN'
              const isPick = step.type === 'PICK'
              const isDecider = step.type === 'DECIDER'

              const teamActorName =
                step.actor === 'TEAM_A'
                  ? teamA?.name || 'TEST'
                  : step.actor === 'TEAM_B'
                  ? teamB?.name || 'TEST1'
                  : 'DECIDER'

              return (
                <div
                  key={idx}
                  className="relative h-20 w-full overflow-hidden rounded-lg bg-[#121417]"
                >
                  {mapData && (
                    <img
                      alt={mapData.mapName}
                      className={`absolute inset-0 size-full object-cover ${isBan ? 'brightness-40 grayscale' : 'brightness-75'}`}
                      src={mapData.image}
                    />
                  )}
                  <div
                    className="absolute inset-0"
                    style={{
                      background: isBan
                        ? 'linear-gradient(90deg, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.6) 50%, rgba(0, 0, 0, 0.8) 100%)'
                        : isDecider
                        ? 'linear-gradient(90deg, rgba(120, 90, 30, 0.2) 0%, rgba(0, 0, 0, 0.5) 40%, rgba(0, 0, 0, 0.5) 60%, rgba(120, 90, 30, 0.2) 100%)'
                        : 'linear-gradient(90deg, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.4) 50%, rgba(0, 0, 0, 0.6) 100%)',
                    }}
                  />
                  <div className="relative z-10 flex h-full items-center justify-between px-6">
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-3">
                        <h2 className="font-schabo text-[36px] leading-none text-white uppercase tracking-wider">
                          {mapData?.mapName || 'MAP'}
                        </h2>
                        <span
                          className={`rounded-xs px-2 py-0.5 text-[9px] font-bold tracking-widest uppercase ${
                            isBan
                              ? 'bg-red-500/20 text-red-400'
                              : isPick
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {step.type}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] font-medium tracking-wider text-white/50 uppercase">
                        {isBan ? `BANNED BY ${teamActorName}` : isPick ? `PICKED BY ${teamActorName}` : 'DECIDER'}
                      </p>
                    </div>

                    {/* Picked Sides: Crossed Swords & Shield Icons */}
                    {isPick && (
                      <div className="flex shrink-0 items-center gap-4">
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] font-semibold text-white/80">{teamA?.name || 'test'}</span>
                            <span className="text-[9px] font-bold tracking-wider text-[#FF4646] uppercase">ATTACK</span>
                          </div>
                          <ValorantAttackIcon className="size-6" />
                        </div>
                        <div className="flex items-center gap-2">
                          <ValorantDefenseIcon className="size-6" />
                          <div className="flex flex-col items-start">
                            <span className="text-[10px] font-semibold text-white/80">{teamB?.name || 'test1'}</span>
                            <span className="text-[9px] font-bold tracking-wider text-[#2FC28F] uppercase">DEFENSE</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Right Column: Active Session + Animations */}
          <div className="w-72 space-y-6 shrink-0">
            {/* Active Session Box */}
            <div className="rounded-2xl border border-white/10 bg-[#16171a] p-4 shadow-xl">
              <div className="flex w-full flex-col gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-[#e7e7e7]">Active Session</h3>
                  <p className="mt-0.5 text-xs text-[#e7e7e7]/40">
                    BO{selectedFormat.replace('BO', '')} - {sequence.length} steps
                  </p>
                </div>
                <div className="flex w-full gap-2">
                  <button
                    type="button"
                    onClick={resetVeto}
                    className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-white px-3 text-xs font-semibold text-black transition-all hover:bg-[#eaeaea] cursor-pointer"
                  >
                    <RotateCcw className="size-3.5" />
                    Restart
                  </button>
                  <button
                    type="button"
                    onClick={exportVetoSummary}
                    className="flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-[#1e1e1e] border border-white/10 px-3 text-xs font-semibold text-white transition-all hover:bg-[#2a2a2a] cursor-pointer"
                  >
                    <ClipboardList className="size-3.5" />
                    Export
                  </button>
                </div>
                <button
                  type="button"
                  onClick={resetSeries}
                  className="flex h-8 w-full items-center justify-center rounded-lg bg-[#2a1414] border border-[#FF6B35]/30 px-3 text-xs font-semibold text-[#FF6B35] transition-all hover:bg-[#3a1c1c] cursor-pointer"
                >
                  Reset Series (clears map history)
                </button>
              </div>
            </div>

            {/* Captain lobby link with copy tooltip */}
            <div className="flex items-center gap-2">
              <div className="flex flex-1 items-center rounded-lg border border-white/10 bg-[#16171a] px-3 py-2">
                <span className="flex-1 truncate text-xs text-[#e7e7e7]/50">
                  Captain lobby link
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/veto/${state.serverCode}`).catch(() => {})
                  showToast('Lobby link copied!')
                }}
                className="relative flex size-9 items-center justify-center rounded-lg border border-white/10 bg-[#16171a] text-white hover:bg-white/10 cursor-pointer"
                title="Copy Link"
              >
                <Copy className="size-4" />
              </button>
            </div>

            {/* Animations Section */}
            <div className="border-t border-white/10 pt-4 space-y-3">
              <h3 className="text-xs font-semibold text-[#e7e7e7]/60">Animations</h3>
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-1 items-center rounded-lg border border-white/10 bg-[#16171a] px-3 py-2 text-xs text-[#e7e7e7]/60">
                  Replay Team Picks
                </div>
                <button
                  type="button"
                  onClick={() => showToast('Replaying team picks animation...')}
                  className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-white px-4 text-xs font-bold text-black transition-all hover:bg-[#eaeaea] cursor-pointer"
                >
                  <Play className="size-3 fill-black" />
                  <span className="uppercase">PLAY</span>
                </button>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="relative flex flex-1 items-center">
                  <input
                    type="number"
                    value={animationSpeed}
                    onChange={e => setAnimationSpeed(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-[#16171a] px-3 py-2 pr-8 text-xs text-white outline-none"
                  />
                  <span className="pointer-events-none absolute right-2.5 text-xs text-white/30">ms</span>
                </div>
                <button
                  type="button"
                  onClick={() => showToast(`Playing with ${animationSpeed}ms interval`)}
                  className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-white px-4 text-xs font-bold text-black transition-all hover:bg-[#eaeaea] cursor-pointer"
                >
                  <Play className="size-3 fill-black" />
                  <span className="uppercase">PLAY</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Side Pick Selection Modal */}
      {pendingSidePick && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#16171a] p-6 text-center shadow-2xl space-y-6">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-white">Side Selection</h3>
              <p className="text-xs text-[#e7e7e7]/60">
                {pendingSidePick.choosingSideTeam === 'TEAM_A' ? teamA?.name || 'Left Team' : teamB?.name || 'Right Team'}, choose starting side on{' '}
                <span className="font-bold text-white uppercase">{pendingSidePick.mapId}</span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => handleSidePick('ATTACK')}
                className="group flex flex-col items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-5 transition-all hover:border-red-500/50 hover:bg-red-500/20 cursor-pointer"
              >
                <ValorantAttackIcon className="size-10" />
                <span className="text-sm font-bold tracking-wider text-red-400 uppercase">Attack</span>
              </button>

              <button
                type="button"
                onClick={() => handleSidePick('DEFENSE')}
                className="group flex flex-col items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-5 transition-all hover:border-emerald-500/50 hover:bg-emerald-500/20 cursor-pointer"
              >
                <ValorantDefenseIcon className="size-10" />
                <span className="text-sm font-bold tracking-wider text-emerald-400 uppercase">Defense</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decider Side Selection Modal */}
      {deciderSideOpen && (() => {
        const decider = (state.mapPicks || []).find(p => p.slot === 'decider')
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#16171a] p-6 text-center shadow-2xl space-y-6">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-white">Decider Side Selection</h3>
                <p className="text-xs text-[#e7e7e7]/60">
                  {teamA?.name || 'Left Team'} and {teamB?.name || 'Right Team'} choose starting sides on{' '}
                  <span className="font-bold text-white uppercase">{decider?.mapId || 'the decider map'}</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => handleDeciderSide('ATTACK')}
                  className="group flex flex-col items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-5 transition-all hover:border-red-500/50 hover:bg-red-500/20 cursor-pointer"
                >
                  <ValorantAttackIcon className="size-10" />
                  <span className="text-sm font-bold tracking-wider text-red-400 uppercase">{teamA?.name || 'Left'} Attack</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDeciderSide('DEFENSE')}
                  className="group flex flex-col items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-5 transition-all hover:border-emerald-500/50 hover:bg-emerald-500/20 cursor-pointer"
                >
                  <ValorantDefenseIcon className="size-10" />
                  <span className="text-sm font-bold tracking-wider text-emerald-400 uppercase">{teamA?.name || 'Left'} Defense</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setDeciderSideOpen(false)}
                className="text-xs font-medium text-[#e7e7e7]/50 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
