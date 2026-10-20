import { useState, useRef, useEffect } from 'react'
import { Check, ClipboardCopy, Settings, X } from 'lucide-react'
import { useAppStore } from '../store/AppContext'
import Dropdown from '../components/Dropdown'
import { AgentSelectScene } from '../components/scenes/AgentSelectScene'
import { BuyRoundScene } from '../components/scenes/BuyRoundScene'
import { IngameHudScene } from '../components/scenes/IngameHudScene'
import { MapBanScene } from '../components/scenes/MapBanScene'
import { PostgameScene } from '../components/scenes/PostgameScene'
import { TimeoutOverlay } from '../components/scenes/TimeoutOverlay'
import { buildMapHistoryItems, VAL_MAPS } from './MapVeto'

// ===== SCENE & COMPONENT DEFINITIONS (Matching original bundle definitions) =====
type FieldType = 'checkbox' | 'toggle' | 'color' | 'slider' | 'text' | 'image' | 'multi-selector' | 'timer-to-date' | 'label' | 'mapSelector'

interface ComponentField {
  name: string
  label: string
  type: FieldType
  value?: any
  defaultValue?: any
  colSpan?: number
  min?: number
  max?: number
  condition?: { field: string; value: any }
}

interface SceneComponent {
  id: string
  name: string
  defaultToggled?: boolean
  fields: Record<string, ComponentField>
}

interface SceneConfig {
  id: string
  name: string
  defaultColors?: Record<string, string>
  components: Record<string, SceneComponent>
}

export const VAL_SCENES: Record<string, SceneConfig> = {
  'agent-select': {
    id: 'agent-select',
    name: 'Agent Select',
    defaultColors: { '1': '#1DCD9B', '2': '#FF4848' },
    components: {
      background: {
        id: 'background',
        name: 'Background',
        defaultToggled: true,
        fields: {
          'background-animation': { name: 'background-animation', label: 'Animation', type: 'checkbox', defaultValue: true },
        },
      },
      'map-name': { id: 'map-name', name: 'Map Name', defaultToggled: true, fields: {} },
      'team-lineup': { id: 'team-lineup', name: 'Team Lineup', defaultToggled: true, fields: {} },
    },
  },
  'buy-round': {
    id: 'buy-round',
    name: 'Buy Round (Part of HUD)',
    components: {
      'buy-round': {
        id: 'buy-round',
        name: 'Buy Round',
        defaultToggled: true,
        fields: {
          'display-sponsors': { name: 'display-sponsors', label: 'Sponsors', type: 'checkbox', defaultValue: true },
          'small-variant': { name: 'small-variant', label: 'Small Variant', type: 'checkbox', defaultValue: false },
        },
      },
    },
  },
  default: {
    id: 'default',
    name: 'Ingame HUD',
    defaultColors: { '1': '#28D091', '2': '#FF3549' },
    components: {
      alive: { id: 'alive', name: 'Players Alive', defaultToggled: true, fields: {} },
      'game-events': {
        id: 'game-events',
        name: 'Game Events',
        defaultToggled: true,
        fields: {
          'game-events-individual-uploads': { name: 'game-events-individual-uploads', label: 'Individual Uploads', type: 'toggle', defaultValue: false, colSpan: 2 },
          'game-events-bg-round-winner': { name: 'game-events-bg-round-winner', label: 'Round Win', type: 'image', defaultValue: null },
          'game-events-bg-ace': { name: 'game-events-bg-ace', label: 'Ace', type: 'image', defaultValue: null, condition: { field: 'game-events-individual-uploads', value: true } },
          'game-events-bg-clutch': { name: 'game-events-bg-clutch', label: 'Clutch', type: 'image', defaultValue: null, condition: { field: 'game-events-individual-uploads', value: true } },
          'game-events-bg-flawless': { name: 'game-events-bg-flawless', label: 'Flawless', type: 'image', defaultValue: null, condition: { field: 'game-events-individual-uploads', value: true } },
          'game-events-bg-team-ace': { name: 'game-events-bg-team-ace', label: 'Team Ace', type: 'image', defaultValue: null, condition: { field: 'game-events-individual-uploads', value: true } },
          'game-events-bg-thrifty': { name: 'game-events-bg-thrifty', label: 'Thrifty', type: 'image', defaultValue: null, condition: { field: 'game-events-individual-uploads', value: true } },
          'game-events-bg-color': { name: 'game-events-bg-color', label: 'Bg Color', type: 'color', defaultValue: '#161f2a', colSpan: 2 },
          'game-events-highlight-color': { name: 'game-events-highlight-color', label: 'Highlight Color', type: 'color', defaultValue: '#0eb297', colSpan: 2 },
        },
      },
      'map-history': {
        id: 'map-history',
        name: 'Map History',
        defaultToggled: true,
        fields: {
          'map-history': { name: 'map-history', label: 'Map Scores', type: 'mapSelector', defaultValue: { game: 'VAL' } },
        },
      },
      'score-line': {
        id: 'score-line',
        name: 'Score Line',
        defaultToggled: true,
        fields: {
          'score-line-background-image': { name: 'score-line-background-image', label: 'Background', type: 'image', defaultValue: null, colSpan: 1 },
          'score-line-bomb-timer': { name: 'score-line-bomb-timer', label: 'Timer', type: 'checkbox', defaultValue: true },
          'score-line-logos': { name: 'score-line-logos', label: 'Logos', type: 'checkbox', defaultValue: true },
          'score-line-series': { name: 'score-line-series', label: 'Series Score', type: 'checkbox', defaultValue: true },
          'score-line-small': { name: 'score-line-small', label: 'Small Variant', type: 'checkbox', defaultValue: false },
          'score-line-left-color': { name: 'score-line-left-color', label: 'Left (title, score)', type: 'color', defaultValue: { score: '#DADBE3', title: '#DADBE3' } },
          'score-line-right-color': { name: 'score-line-right-color', label: 'Right (title, score)', type: 'color', defaultValue: { score: '#DADBE3', title: '#DADBE3' } },
          'score-line-size': { name: 'score-line-size', label: 'Info Size', type: 'slider', defaultValue: 3, min: 1, max: 9 },
          'score-line-timer-color': { name: 'score-line-timer-color', label: 'Timer', type: 'color', defaultValue: '#DADBE3', colSpan: 2 },
        },
      },
      sponsors: {
        id: 'sponsors',
        name: 'Sponsors',
        defaultToggled: true,
        fields: {
          'sponsors-animated-watermark': { name: 'sponsors-animated-watermark', label: 'Animated Advertisement Watermark', type: 'toggle', defaultValue: false, colSpan: 2 },
        },
      },
      'team-stats': {
        id: 'team-stats',
        name: 'Team Stats',
        defaultToggled: true,
        fields: {
          'team-stats-assists': { name: 'team-stats-assists', label: 'Assists', type: 'checkbox', defaultValue: true, colSpan: 2 },
          'team-stats-deaths': { name: 'team-stats-deaths', label: 'Deaths', type: 'checkbox', defaultValue: true },
          'team-stats-kills': { name: 'team-stats-kills', label: 'Kills', type: 'checkbox', defaultValue: true },
          'team-stats-left-color': { name: 'team-stats-left-color', label: 'Left Color', type: 'color', defaultValue: '#EFF1FF' },
          'team-stats-player-eco': { name: 'team-stats-player-eco', label: 'Player Ecos', type: 'checkbox', defaultValue: true },
          'team-stats-right-color': { name: 'team-stats-right-color', label: 'Right Color', type: 'color', defaultValue: '#EFF1FF' },
          'team-stats-ults': { name: 'team-stats-ults', label: 'Ultimates', type: 'checkbox', defaultValue: true },
        },
      },
      webcam: { id: 'webcam', name: 'Webcam', defaultToggled: true, fields: {} },
    },
  },
  'map-ban': {
    id: 'map-ban',
    name: 'Map Ban',
    components: {
      card: {
        id: 'card',
        name: 'Card',
        defaultToggled: true,
        fields: {
          'show-title': { name: 'show-title', label: 'Title', type: 'checkbox', defaultValue: true },
          'show-side-labels': { name: 'show-side-labels', label: 'Side Labels', type: 'checkbox', defaultValue: true },
          'show-footer': { name: 'show-footer', label: 'Footer', type: 'checkbox', defaultValue: true },
        },
      },
    },
  },
  'post-game': {
    id: 'post-game',
    name: 'Postgame',
    components: {
      card: { id: 'card', name: 'Card', defaultToggled: true, fields: {} },
      sponsors: { id: 'sponsors', name: 'Sponsors', defaultToggled: true, fields: {} },
    },
  },
}

const SCENE_DISPLAY_NAMES: Record<string, string> = {
  'agent-select': 'Agent Select',
  // 'buy-round' intentionally NOT listed: Buy is a HUD *state* (Main | Buy |
  // Timeout tabs on the Ingame HUD scene), not a standalone scene. The
  // sceneKeyMap entry below stays so legacy selectedScene values resolve.
  'default': 'Ingame HUD',
  'map-ban': 'Map Ban',
  'post-game': 'Postgame',
}

// Upload helper for Game Events
function UploadBtn({ label, getVal, setVal }: { label: string; getVal: () => any; setVal: (v: any) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <span style={{ fontSize: 12, color: '#ccc' }}>{label}</span>
      <label style={{ fontSize: 11, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, padding: '4px 10px', color: '#888', display: 'flex', alignItems: 'center', gap: 6 }}>
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { setVal(f.name); } }} />
        {getVal() ? '✓ ' + String(getVal()).slice(0, 20) : 'Upload'}
      </label>
    </div>
  )
}

// ===== MAIN HUD EDITOR =====
export default function HudEditor() {
  const { state, setState, showToast } = useAppStore()
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [activeComponentId, setActiveComponentId] = useState<string | null>(null)
  const [fieldValues, setFieldValues] = useState<Record<string, Record<string, any>>>({})
  const [mapHistoryMode, setMapHistoryMode] = useState<'manual' | 'automatic'>('automatic')

  // Map our scene names to scene keys
  const sceneKeyMap: Record<string, string> = {
    'Agent Select': 'agent-select',
    'Buy Round (Part of HUD)': 'buy-round',
    'Ingame HUD': 'default',
    'Map Ban': 'map-ban',
    'Postgame': 'post-game',
  }

  const selectedSceneName = state.selectedScene
  const selectedSceneKey = sceneKeyMap[selectedSceneName] || 'default'
  const sceneConfig = VAL_SCENES[selectedSceneKey]
  const components = sceneConfig?.components || {}

  // P3: HUD state preview tabs (BLOB Main | Buy | Timeout) — hot-swap the
  // ingame canvas into a state without needing a live game/producer.
  const [hudPreview, setHudPreview] = useState<'Main' | 'Buy' | 'Timeout'>('Main')
  const timeoutPreviewRef = useRef<{ team: 'left' | 'right'; calledAt: number; timeoutType: string } | null>(null)
  const isHudScene = selectedSceneKey === 'default' || selectedSceneKey === 'ingame-hud'

  const leftTeam = state.teams.find(t => t.id === state.leftTeamId) || state.teams[0]
  const rightTeam = state.teams.find(t => t.id === state.rightTeamId) || state.teams[1] || state.teams[0]
  const leftName = leftTeam?.name || ''
  const rightName = rightTeam?.name || ''
  const colorA = state.colorMode === 'Team' ? (leftTeam?.color || '#28D091') : state.customColorA
  const colorB = state.colorMode === 'Team' ? (rightTeam?.color || '#FF3549') : state.customColorB
  const vetoHistoryMaps = buildMapHistoryItems(state.mapPicks, state.mapBans, state.vetoSelectedMapIds)
  const mapBansForScene = vetoHistoryMaps.filter(function(i){ return i.kind === 'ban' }).map(function(i){ return { mapId: i.mapId, mapName: i.mapName, image: ((VAL_MAPS.find(function(m){ return m.mapId === i.mapId }) || {}).image) || '' } })
  const mapPicksForScene = vetoHistoryMaps.filter(function(i){ return i.kind === 'pick' }).map(function(i){ return { mapId: i.mapId, mapName: i.mapName, image: ((VAL_MAPS.find(function(m){ return m.mapId === i.mapId }) || {}).image) || '' } })
  const mapDeciderForScene = vetoHistoryMaps.filter(function(i){ return i.kind === 'decider' }).map(function(i){ return { mapId: i.mapId, mapName: i.mapName, image: ((VAL_MAPS.find(function(m){ return m.mapId === i.mapId }) || {}).image) || '' } })[0] || null
  // Ordered veto display follows the serialized veto steps (real execution order,
  // which reflects the map-veto format and any action overrides). Falls back to
  // the classic BAN, BAN, PICK, PICK, DECIDER row when no steps have run yet.
  const mapSlotsForScene = (function(){
    const steps = state.vetoSteps || []
    const nameOf = (id: string) => ((VAL_MAPS.find(function(m){ return m.mapId === id }) || {}).mapName) || ''
    const imageOf = (id: string) => ((VAL_MAPS.find(function(m){ return m.mapId === id }) || {}).image) || ''
    if (steps.length) {
      const deciderPick = (state.mapPicks || []).find((p: any) => p.slot === 'decider')
      return steps.map(s => {
        const base = {
          mapName: nameOf(s.map),
          image: imageOf(s.map),
          kind: s.action === 'Ban' ? 'ban' : s.action === 'Decider' ? 'decider' : 'pick',
          side: s.side,
          team: s.team,
        }
        if (s.action === 'Decider' && deciderPick?.sideSelection) {
          base.side = deciderPick.sideSelection.TEAM_A === 'ATTACK' ? 'Offense' : 'Defense'
        }
        return base
      })
    }
    const slot = []
    for (let i = 0; i < 2; i++) {
      if (mapBansForScene[i]) slot.push({ mapName: mapBansForScene[i].mapName, image: mapBansForScene[i].image, kind: 'ban', team: i === 0 ? 'TEAM_A' : 'TEAM_B' })
      else slot.push({ mapName: '', image: '', kind: 'ban', team: i === 0 ? 'TEAM_A' : 'TEAM_B' })
    }
    for (let i = 0; i < 2; i++) {
      if (mapPicksForScene[i]) slot.push({ mapName: mapPicksForScene[i].mapName, image: mapPicksForScene[i].image, kind: 'pick', team: i === 0 ? 'TEAM_A' : 'TEAM_B' })
      else slot.push({ mapName: '', image: '', kind: 'pick', team: i === 0 ? 'TEAM_A' : 'TEAM_B' })
    }
    if (mapDeciderForScene) slot.push({ mapName: mapDeciderForScene.mapName, image: mapDeciderForScene.image, kind: 'decider', team: 'DECIDER' })
    else slot.push({ mapName: '', image: '', kind: 'decider', team: 'DECIDER' })
    return slot
  })()
  // The HUD facecam shows the first player that has a camera configured.
  const webcamPlayer = [...(leftTeam?.players || []), ...(rightTeam?.players || [])].find(p => p.webcamSource !== 'None' && state.cameraVisibility?.[p.id] !== false)
  // Demo mode (editor only): pad configured rosters to full 5v5 with demo
  // players so every scene renders completely. Live overlay pages never see
  // these — they render only the real desktop roster.
  const DEMO_POOL: Array<Record<string, any>> = [
    { alias: 'Player 1', agentKey: 'bountyhunter', agentName: 'Fade', kills: 3, deaths: 10, assists: 1, health: 100, isAlive: true, credits: 650, armor: 25, shieldType: 1, weapon: 'Phantom', weaponName: 'Phantom', abilityState: { C: true, Q: true, E: true, X: false }, currUltPoints: 5, maxUltPoints: 8 },
    { alias: 'Player 2', agentKey: 'gumshoe', agentName: 'Cypher', kills: 4, deaths: 12, assists: 0, health: 72, isAlive: true, credits: 0, armor: 50, shieldType: 2, weapon: 'Spectre', weaponName: 'Spectre', abilityState: { C: true, Q: false, E: true, X: false }, currUltPoints: 2, maxUltPoints: 7 },
    { alias: 'Player 3', agentKey: 'cable', agentName: 'Deadlock', kills: 4, deaths: 11, assists: 2, health: 0, isAlive: false, credits: 550, armor: 0, shieldType: 0, weapon: 'Classic', weaponName: 'Classic', abilityState: { C: false, Q: false, E: false, X: false }, currUltPoints: 4, maxUltPoints: 8 },
    { alias: 'Player 4', agentKey: 'deadeye', agentName: 'Chamber', kills: 1, deaths: 7, assists: 1, health: 34, isAlive: true, credits: 50, armor: 25, shieldType: 1, weapon: 'Sheriff', weaponName: 'Sheriff', abilityState: { C: true, Q: true, E: false, X: false }, currUltPoints: 7, maxUltPoints: 8 },
    { alias: 'Player 5', agentKey: 'breach', agentName: 'Breach', kills: 2, deaths: 9, assists: 3, health: 0, isAlive: false, credits: 200, armor: 0, shieldType: 0, weapon: 'Classic', weaponName: 'Classic', abilityState: { C: false, Q: false, E: false, X: false }, currUltPoints: 1, maxUltPoints: 9 },
    { alias: 'Player 6', agentKey: 'clay', agentName: 'Raze', kills: 12, deaths: 6, assists: 2, health: 61, isAlive: true, credits: 1900, armor: 50, shieldType: 2, weapon: 'Vandal', weaponName: 'Vandal', abilityState: { C: true, Q: true, E: true, X: true }, currUltPoints: 8, maxUltPoints: 8 },
    { alias: 'Player 7', agentKey: 'guide', agentName: 'Skye', kills: 6, deaths: 4, assists: 8, health: 18, isAlive: true, credits: 2500, armor: 25, shieldType: 1, weapon: 'Phantom', weaponName: 'Phantom', abilityState: { C: true, Q: false, E: true, X: false }, currUltPoints: 3, maxUltPoints: 7 },
    { alias: 'Player 8', agentKey: 'grenadier', agentName: 'KAY/O', kills: 12, deaths: 1, assists: 3, health: 100, isAlive: true, credits: 7900, armor: 50, shieldType: 3, weapon: 'Odin', weaponName: 'Odin', abilityState: { C: true, Q: true, E: true, X: false }, currUltPoints: 6, maxUltPoints: 8 },
    { alias: 'Player 9', agentKey: 'aggrobot', agentName: 'Gekko', kills: 5, deaths: 8, assists: 4, health: 0, isAlive: false, credits: 1200, armor: 0, shieldType: 0, weapon: 'Ghost', weaponName: 'Ghost', abilityState: { C: false, Q: false, E: false, X: false }, currUltPoints: 0, maxUltPoints: 8 },
    { alias: 'Player 10', agentKey: 'cashew', agentName: 'Tejo', kills: 8, deaths: 4, assists: 2, health: 85, isAlive: true, credits: 3700, armor: 50, shieldType: 2, weapon: 'Vandal', weaponName: 'Vandal', abilityState: { C: true, Q: true, E: false, X: false }, currUltPoints: 5, maxUltPoints: 8 },
  ]
  const padRoster = (arr: any[], side: string) => {
    const out = (arr || []).map((p: any) => ({ ...p, agentKey: p.agentKey ?? (p.agent ? String(p.agent).toLowerCase() : null) }))
    let di = side === 'right' ? 5 : 0
    while (out.length < 5 && di < DEMO_POOL.length) {
      out.push({ ...DEMO_POOL[di], id: `demo-${side}-${di}` })
      di++
    }
    return out.slice(0, 5)
  }
  const leftRoster = padRoster((leftTeam?.players || []).map(function(p){ return { id: p.id, alias: p.alias || p.riotId || '', riotId: p.riotId || '', avatarUrl: p.avatarUrl || null, photoUrl: p.photoUrl || null } }), 'left')
  const rightRoster = padRoster((rightTeam?.players || []).map(function(p){ return { id: p.id, alias: p.alias || p.riotId || '', riotId: p.riotId || '', avatarUrl: p.avatarUrl || null, photoUrl: p.photoUrl || null } }), 'right')

  const isToggled = (compId: string) => state.sceneToggles[compId] !== false
  const toggleComp = (compId: string) => setState(prev => ({ ...prev, sceneToggles: { ...prev.sceneToggles, [compId]: !isToggled(compId) } }))

  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const [canvasScale, setCanvasScale] = useState(1)

  useEffect(() => {
    const updateScale = () => {
      if (canvasContainerRef.current) {
        const width = canvasContainerRef.current.clientWidth
        const height = canvasContainerRef.current.clientHeight
        const scale = Math.min(width / 1920, height / 1080)
        setCanvasScale(scale > 0 ? scale : 1)
      }
    }
    updateScale()
    window.addEventListener('resize', updateScale)
    const ro = new ResizeObserver(updateScale)
    if (canvasContainerRef.current) ro.observe(canvasContainerRef.current)
    return () => {
      window.removeEventListener('resize', updateScale)
      ro.disconnect()
    }
  }, [])



  const getFieldValue = (compId: string, fieldName: string, defaultVal: any) => fieldValues[compId]?.[fieldName] ?? defaultVal
  const setFieldValue = (compId: string, fieldName: string, val: any) => {
    setFieldValues(prev => ({ ...prev, [compId]: { ...prev[compId], [fieldName]: val } }))
  }

  const copyOverlayUrl = () => {
    const url = `${window.location.origin}/overlay/${state.serverCode}/${selectedSceneKey}`
    navigator.clipboard.writeText(url).catch(() => {})
    setCopiedUrl(true)
    showToast('Overlay URL copied!')
    setTimeout(() => setCopiedUrl(false), 2000)
  }

  const swapColors = () => setState(prev => ({ ...prev, customColorA: prev.customColorB, customColorB: prev.customColorA }))

  const activeComponentObj = activeComponentId ? components[activeComponentId] : null

  // Field values getters
  const showBombTimer = getFieldValue('score-line', 'score-line-bomb-timer', true)
  const showLogos = getFieldValue('score-line', 'score-line-logos', true)
  const showSeries = getFieldValue('score-line', 'score-line-series', true)
  const scoreLineSize = getFieldValue('score-line', 'score-line-size', 3)
  const timerColor = getFieldValue('score-line', 'score-line-timer-color', '#DADBE3')

  const showKills = getFieldValue('team-stats', 'team-stats-kills', true)
  const showDeaths = getFieldValue('team-stats', 'team-stats-deaths', true)
  const showAssists = getFieldValue('team-stats', 'team-stats-assists', true)
  const showEco = getFieldValue('team-stats', 'team-stats-player-eco', true)
  const showUlts = getFieldValue('team-stats', 'team-stats-ults', true)

  const eventsBg = getFieldValue('game-events', 'game-events-bg-color', '#161f2a')
  const eventsHighlight = getFieldValue('game-events', 'game-events-highlight-color', '#0eb297')

  return (
    <div className="size-full overflow-y-auto p-8" style={{ scrollbarWidth: 'none', maxWidth: 1280 }} onClick={() => setActiveComponentId(null)}>
      {/* Controls bar */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, marginBottom: 16, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
        {/* Selected Scene */}
        <div>
          <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Selected Scene</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Dropdown
              value={selectedSceneName}
              options={Object.values(SCENE_DISPLAY_NAMES)}
              onChange={v => { setState(prev => ({ ...prev, selectedScene: v })); setActiveComponentId(null); }}
              width={220}
            />
            <button onClick={copyOverlayUrl} title="Copy Overlay URL" style={{ background: 'none', border: '1px solid hsl(var(--border))', borderRadius: 6, color: copiedUrl ? '#22c55e' : 'hsla(var(--muted-foreground))', cursor: 'pointer', padding: '6px 8px' }}>
              {copiedUrl ? <Check size={14} /> : <ClipboardCopy size={14} />}
            </button>
            <button onClick={() => setSettingsOpen(!settingsOpen)} style={{ background: 'none', border: '1px solid hsl(var(--border))', borderRadius: 6, color: 'hsla(var(--muted-foreground))', cursor: 'pointer', padding: '6px 8px' }}>
              <Settings size={14} />
            </button>
          </div>
        </div>

        {/* P3: HUD state preview tabs (ingame scene only) — BLOB's Main | Buy | Timeout */}
        {isHudScene && (
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>HUD State</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', gap: 0, border: '1px solid hsl(var(--border))', borderRadius: 6, overflow: 'hidden' }}>
                {(['Main', 'Buy', 'Timeout'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => {
                      setHudPreview(t)
                      if (t === 'Timeout') timeoutPreviewRef.current = { team: 'left', calledAt: Date.now(), timeoutType: 'tactical' }
                    }}
                    style={{
                      padding: '6px 12px', fontSize: 12, border: 'none', cursor: 'pointer',
                      background: hudPreview === t ? 'hsl(var(--accent))' : 'transparent',
                      color: hudPreview === t ? 'hsl(var(--accent-foreground))' : 'hsla(var(--muted-foreground))',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Colors */}
        <div>
          <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Colors</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', gap: 0, border: '1px solid hsl(var(--border))', borderRadius: 6, overflow: 'hidden' }}>
              {(['Custom', 'Team'] as const).map(mode => (
                <button key={mode} onClick={() => setState(prev => ({ ...prev, colorMode: mode }))} style={{
                  padding: '6px 12px', fontSize: 12, border: 'none', cursor: 'pointer',
                  background: state.colorMode === mode ? 'hsl(var(--foreground))' : 'transparent',
                  color: state.colorMode === mode ? 'hsl(var(--background))' : 'hsl(var(--foreground))',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  {mode === 'Team' && <span style={{ fontSize: 10 }}>🔴🔵</span>}
                  {mode}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {[{ val: colorA, key: 'customColorA' }, { val: colorB, key: 'customColorB' }].map(c => (
                <label key={c.key} style={{ position: 'relative', cursor: state.colorMode === 'Custom' ? 'pointer' : 'default' }}>
                  <div style={{ width: 24, height: 24, borderRadius: 4, background: c.val, border: '2px solid hsla(0,0%,91%,0.2)' }} />
                  {state.colorMode === 'Custom' && (
                    <input type="color" value={c.val} onChange={e => setState(p => ({ ...p, [c.key]: e.target.value }))} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }} />
                  )}
                </label>
              ))}
              {state.colorMode === 'Custom' && (
                <button onClick={swapColors} style={{ background: 'none', border: 'none', color: 'hsla(var(--muted-foreground))', cursor: 'pointer', padding: 2 }} title="Swap">⇄</button>
              )}
            </div>
          </div>
        </div>

        {/* Customise Inline Checkboxes */}
        <div style={{ width: '100%', marginTop: 8 }}>
          <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Customise</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 12 }}>
            {Object.entries(components).map(([key, comp], idx, arr) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: isToggled(key) ? 'hsl(var(--foreground))' : 'hsla(var(--muted-foreground))' }}>
                <input
                  type="checkbox"
                  checked={isToggled(key)}
                  onChange={() => toggleComp(key)}
                  style={{ accentColor: 'hsl(var(--havoc-blue))', cursor: 'pointer' }}
                />
                <span>
                  {comp.name}
                </span>
                {idx < arr.length - 1 && <span style={{ color: 'hsla(var(--border))', marginLeft: 6 }}>|</span>}
              </label>
            ))}
          </div>
        </div>

        {/* Watermark Management (#12) */}
        <div style={{ width: '100%', marginTop: 8, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid hsl(var(--border))' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={state.watermark?.enabled ?? false}
                onChange={e => setState(p => ({ ...p, watermark: { ...p.watermark, enabled: e.target.checked } }))}
                style={{ accentColor: 'hsl(var(--havoc-blue))', cursor: 'pointer' }}
              />
              <span>Tournament Watermark</span>
            </label>

            {state.watermark?.enabled && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 11 }}>
                <input
                  type="text"
                  placeholder="Watermark Image URL"
                  value={state.watermark?.imageUrl || ''}
                  onChange={e => setState(p => ({ ...p, watermark: { ...p.watermark, imageUrl: e.target.value } }))}
                  style={{ background: '#16171a', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '2px 8px', color: '#fff', width: 200, fontSize: 11 }}
                />

                <select
                  value={state.watermark?.position || 'top-right'}
                  onChange={e => setState(p => ({ ...p, watermark: { ...p.watermark, position: e.target.value as any } }))}
                  style={{ background: '#16171a', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '2px 6px', color: '#fff', fontSize: 11 }}
                >
                  <option value="top-right">Top Right</option>
                  <option value="top-left">Top Left</option>
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                </select>

                <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'rgba(255,255,255,0.6)' }}>
                  <span>Opacity:</span>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={Math.round((state.watermark?.opacity ?? 0.8) * 100)}
                    onChange={e => setState(p => ({ ...p, watermark: { ...p.watermark, opacity: Number(e.target.value) / 100 } }))}
                    style={{ width: 60, accentColor: 'hsl(var(--havoc-blue))' }}
                  />
                  <span>{Math.round((state.watermark?.opacity ?? 0.8) * 100)}%</span>
                </label>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, position: 'relative' }}>
        {/* 1920x1080 16:9 Preview Canvas Wrapper */}
        <div
          ref={canvasContainerRef}
          style={{
            flex: 1,
            width: '100%',
            maxHeight: 'calc(100vh - 220px)',
            aspectRatio: '16 / 9',
            background: '#0d0c0e',
            border: '1px solid hsl(var(--border))',
            borderRadius: 8,
            overflow: 'hidden',
            position: 'relative',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Resolution Badge */}
          <div
            style={{
              position: 'absolute',
              bottom: 6,
              right: 8,
              zIndex: 50,
              fontSize: 9,
              color: 'hsla(0,0%,100%,0.3)',
              pointerEvents: 'none',
              fontFamily: 'Consola, monospace',
            }}
          >
            1920 x 1080 (16:9)
          </div>

          {/* Scaled 1920x1080 Authentic Overlay Canvas */}
          <div
            style={{
              width: 1920 * canvasScale,
              height: 1080 * canvasScale,
              position: 'relative',
              flexShrink: 0,
              overflow: 'hidden',
              borderRadius: 32 * canvasScale,
            }}
          >
            <div
              style={{
                width: 1920,
                height: 1080,
                position: 'absolute',
                top: 0,
                left: 0,
                transform: `scale(${canvasScale})`,
                transformOrigin: 'top left',
              }}
            >
            <div style={{ width: 1920, height: 1080, position: "relative", overflow: "hidden" }}>
              <div key={`${selectedSceneKey}:${hudPreview}`} className="scene-enter relative size-full min-h-full bg-[#1B1D1F]" id="huds-havoc-main-overlay" style={{ width: 1920, height: 1080 }}>

                {selectedSceneKey === 'agent-select' && (
                  <AgentSelectScene
                    leftTeamName={leftName}
                    rightTeamName={rightName}
                    leftTeamColor={colorA}
                    rightTeamColor={colorB}
                    mapName={((VAL_MAPS.find(function(m){ return m.mapId === (state.mapPicks && state.mapPicks[0] ? state.mapPicks[0].mapId : (state.vetoSelectedMapIds && state.vetoSelectedMapIds[0])) }) || {}).mapName) || 'Sunset'}
                    mapImage={((VAL_MAPS.find(function(m){ return m.mapId === (state.mapPicks && state.mapPicks[0] ? state.mapPicks[0].mapId : (state.vetoSelectedMapIds && state.vetoSelectedMapIds[0])) }) || {}).image) || '/game/val/maps/juliett/splash-small.png'}
                    leftTeamPlayers={leftRoster}
                    rightTeamPlayers={rightRoster}
                    activeComponentId={activeComponentId}
                    onSelectComponent={setActiveComponentId}
                    isToggled={isToggled}
                  />
                )}
                {(selectedSceneKey === 'buy-round' || (((hudPreview === 'Buy' || hudPreview === 'Timeout') && isHudScene))) && (
                  <BuyRoundScene
                    leftTeamName={leftName}
                    rightTeamName={rightName}
                    leftTeamColor={colorA}
                    rightTeamColor={colorB}
                    showSponsors={getFieldValue('buy-round', 'display-sponsors', true)}
                    smallVariant={getFieldValue('buy-round', 'small-variant', false)}
                    leftTeamPlayers={leftRoster}
                    rightTeamPlayers={rightRoster}
                    activeComponentId={activeComponentId}
                    onSelectComponent={setActiveComponentId}
                    isToggled={isToggled}
                  />
                )}
                {(selectedSceneKey === 'default' || selectedSceneKey === 'ingame-hud') && hudPreview === 'Main' && (
                  <IngameHudScene
                    leftTeamName={leftName}
                    rightTeamName={rightName}
                    leftTeamColor={colorA}
                    rightTeamColor={colorB}
                    scoreLeft={state.scoreA}
                    scoreRight={state.scoreB}
                    timerText="1:40"
                    roundText={state.roundTitle || ''}
                    seriesTitleText={state.seriesTitle || ''}
                    eventTitleText={state.eventTitle || state.tournamentName1 || ''}
                    gameSeriesText={state.gameSeries || ''}
                    leftTeamLogo={(leftTeam?.logoUrl) || null}
                    rightTeamLogo={(rightTeam?.logoUrl) || null}
                    mapHistoryItems={buildMapHistoryItems(state.mapPicks, state.mapBans, state.vetoSelectedMapIds)}
                    webcamPlayerName={webcamPlayer?.alias || ''}
                    webcamPlayerPhoto={webcamPlayer?.avatarUrl || null}
                    webcamActive={!!webcamPlayer}
                    leftTeamPlayers={leftRoster}
                    rightTeamPlayers={rightRoster}
                    timerColor={timerColor}
                    eventsBg={eventsBg}
                    showBombTimer={getFieldValue('score-line', 'score-line-bomb-timer', true)}
                    showLogos={getFieldValue('score-line', 'score-line-logos', true)}
                    showSeries={getFieldValue('score-line', 'score-line-series', true)}
                    scoreLineSmall={getFieldValue('score-line', 'score-line-small', false)}
                    scoreLineSize={getFieldValue('score-line', 'score-line-size', 3)}
                    scoreLineBackgroundImage={getFieldValue('score-line', 'score-line-background-image', null)}
                    scoreLineLeftColor={getFieldValue('score-line', 'score-line-left-color', { title: '#DADBE3', score: '#DADBE3' })}
                    scoreLineRightColor={getFieldValue('score-line', 'score-line-right-color', { title: '#DADBE3', score: '#DADBE3' })}
                    seriesScoreLeft={state.seriesScoreA}
                    seriesScoreRight={state.seriesScoreB}
                    bestOf={state.bestOf || 3}
                    showKills={getFieldValue('team-stats', 'team-stats-kills', true)}
                    showDeaths={getFieldValue('team-stats', 'team-stats-deaths', true)}
                    showAssists={getFieldValue('team-stats', 'team-stats-assists', true)}
                    showEco={getFieldValue('team-stats', 'team-stats-player-eco', true)}
                    showUlts={getFieldValue('team-stats', 'team-stats-ults', true)}
                    teamStatsLeftColor={getFieldValue('team-stats', 'team-stats-left-color', '#EFF1FF')}
                    teamStatsRightColor={getFieldValue('team-stats', 'team-stats-right-color', '#EFF1FF')}
                    activeComponentId={activeComponentId}
                    eventsHighlight={eventsHighlight}
                    gameEventsIndividual={getFieldValue('game-events', 'game-events-individual-uploads', false)}
                    gameEventsUploads={{
                      'game-events-bg-round-winner': getFieldValue('game-events', 'game-events-bg-round-winner', null),
                      'game-events-bg-ace': getFieldValue('game-events', 'game-events-bg-ace', null),
                      'game-events-bg-clutch': getFieldValue('game-events', 'game-events-bg-clutch', null),
                      'game-events-bg-flawless': getFieldValue('game-events', 'game-events-bg-flawless', null),
                      'game-events-bg-team-ace': getFieldValue('game-events', 'game-events-bg-team-ace', null),
                      'game-events-bg-thrifty': getFieldValue('game-events', 'game-events-bg-thrifty', null),
                    }}
                    ceremonyPersistent
                    roundNumber={13}
                    roundEnd={{ winner: 'blue', reason: 'elimination' }}
                    tournamentLogo={state.tournamentLogoUrls?.[0] || null}
                    onSelectComponent={setActiveComponentId}
                    isToggled={isToggled}
                  />
                )}
                {/* P3: Timeout preview = Buy Round scene + tactical banner
                    (user spec: the timeout lives with the buy-round HUD state). */}
                {isHudScene && hudPreview === 'Timeout' && timeoutPreviewRef.current && (
                  <TimeoutOverlay
                    timeout={timeoutPreviewRef.current}
                    leftTeamName={leftName}
                    rightTeamName={rightName}
                    leftTeamColor={colorA}
                    rightTeamColor={colorB}
                    leftTeamLogo={leftTeam?.logoUrl || null}
                    rightTeamLogo={rightTeam?.logoUrl || null}
                  />
                )}
                {selectedSceneKey === 'map-ban' && (
                  <MapBanScene
                    key={`map-ban-${state.vetoReplayRun || 0}`}
                    leftTeamName={leftName}
                    rightTeamName={rightName}
                    leftTeamColor={colorA}
                    rightTeamColor={colorB}
                    showTitle={getFieldValue('card', 'show-title', true)}
                    showSideLabels={getFieldValue('card', 'show-side-labels', true)}
                    showFooter={getFieldValue('card', 'show-footer', true)}
                    mapBans={mapBansForScene}
                    mapPicks={mapPicksForScene}
                    mapDecider={mapDeciderForScene}
                    mapSlots={mapSlotsForScene}
                    leftTeamLogo={(leftTeam?.logoUrl) || null}
                    rightTeamLogo={(rightTeam?.logoUrl) || null}
                    activeComponentId={activeComponentId}
                    onSelectComponent={setActiveComponentId}
                    isToggled={isToggled}
                  />
                )}
                {selectedSceneKey === 'post-game' && (
                  <PostgameScene
                    leftTeamName={leftName}
                    rightTeamName={rightName}
                    leftTeamColor={colorA}
                    rightTeamColor={colorB}
                    scoreLeft={state.scoreA}
                    scoreRight={state.scoreB}
                    showFooter={getFieldValue('card', 'show-footer', true)}
                    leftTeamPlayers={leftRoster}
                    rightTeamPlayers={rightRoster}
                    activeComponentId={activeComponentId}
                    onSelectComponent={setActiveComponentId}
                    isToggled={isToggled}
                  />
                )}

                {/* Watermark Preview (#12) */}
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
              </div>
            </div>
          </div>
        </div>

        {/* Floating Component Settings Popover Modal when an overlay component is clicked */}
        {activeComponentObj && (
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', right: 20, top: 20, zIndex: 100,
              background: '#141518', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8,
              padding: 16, width: 320, boxShadow: '0 12px 32px rgba(0,0,0,0.85)',
            }}
          >
            {/* Header with Title and Reset Icon Button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 10 }}>
              <h4 style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{activeComponentObj.name}</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => setFieldValues(prev => ({ ...prev, [activeComponentObj.id]: {} }))} title="Reset" style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 12 }}>↺</button>
                <button onClick={() => setActiveComponentId(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><X size={16} /></button>
              </div>
            </div>

            {/* Component-Specific Popovers matching project screenshots */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 320, overflowY: 'auto' }}>
              {/* Agent Select — Background */}
              {activeComponentId === 'background' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: '#ccc' }}>Animation</span>
                  <input type="checkbox" checked={getFieldValue('background', 'background-animation', true)} onChange={e => setFieldValue('background', 'background-animation', e.target.checked)} style={{ accentColor: '#3b82f6' }} />
                </div>
              )}
              {/* Agent Select — Map Name */}
              {activeComponentId === 'map-name' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: '#ccc' }}>Map</span>
                  <span style={{ fontSize: 12, color: '#fff', fontWeight: 700 }}>SUNSET</span>
                </div>
              )}
              {/* Agent Select — Team Lineup */}
              {activeComponentId === 'team-lineup' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: '#ccc' }}>Left Team</span>
                    <span style={{ fontSize: 12, color: colorA, fontWeight: 700 }}>{leftName.toUpperCase()}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: '#ccc' }}>Right Team</span>
                    <span style={{ fontSize: 12, color: colorB, fontWeight: 700 }}>{rightName.toUpperCase()}</span>
                  </div>
                </div>
              )}
              {/* Map History Popover */}
              {activeComponentId === 'map-history' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 6, background: '#1c1d22', padding: 3, borderRadius: 6 }}>
                    <button onClick={() => setMapHistoryMode('manual')} style={{ flex: 1, padding: '6px', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 4, cursor: 'pointer', background: mapHistoryMode === 'manual' ? '#3b82f6' : 'transparent', color: '#fff' }}>
                      ✋ Manual
                    </button>
                    <button onClick={() => setMapHistoryMode('automatic')} style={{ flex: 1, padding: '6px', fontSize: 11, fontWeight: 600, border: 'none', borderRadius: 4, cursor: 'pointer', background: mapHistoryMode === 'automatic' ? '#3b82f6' : 'transparent', color: '#fff' }}>
                      🪄 Automatic (Map Ban)
                    </button>
                  </div>
                  {mapHistoryMode === 'automatic' && (
                    <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: 6, padding: 12, textAlign: 'center' }}>
                      <div style={{ color: '#eab308', fontSize: 18, marginBottom: 4 }}>⚠️</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 2 }}>Waiting for Map Veto completion...</div>
                      <div style={{ fontSize: 10, color: '#aaa' }}>Maps will appear here automatically once the veto process is finished.</div>
                    </div>
                  )}
                </div>
              )}

              {/* Score Line Popover */}
              {activeComponentId === 'score-line' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: '#ccc' }}>Background</span>
                    <label style={{ width: 44, height: 44, border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: getFieldValue('score-line', 'score-line-background-image', null) ? '#3b82f6' : '#888', cursor: 'pointer', overflow: 'hidden', position: 'relative' }}>
                      {getFieldValue('score-line', 'score-line-background-image', null) && (
                        <img src={getFieldValue('score-line', 'score-line-background-image', null)} alt="bg" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={e => {
                          const f = e.target.files?.[0]
                          if (f) setFieldValue('score-line', 'score-line-background-image', URL.createObjectURL(f))
                        }}
                      />
                      <span style={{ position: 'relative', zIndex: 1, fontSize: 16 }}>↑</span>
                    </label>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#ccc', cursor: 'pointer' }}>
                      <input type="checkbox" checked={showBombTimer} onChange={e => setFieldValue('score-line', 'score-line-bomb-timer', e.target.checked)} style={{ accentColor: '#3b82f6' }} />
                      Timer
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#ccc', cursor: 'pointer' }}>
                      <input type="checkbox" checked={showLogos} onChange={e => setFieldValue('score-line', 'score-line-logos', e.target.checked)} style={{ accentColor: '#3b82f6' }} />
                      Logos
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#ccc', cursor: 'pointer' }}>
                      <input type="checkbox" checked={showSeries} onChange={e => setFieldValue('score-line', 'score-line-series', e.target.checked)} style={{ accentColor: '#3b82f6' }} />
                      Series Score
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#ccc', cursor: 'pointer' }}>
                      <input type="checkbox" checked={getFieldValue('score-line', 'score-line-small', false)} onChange={e => setFieldValue('score-line', 'score-line-small', e.target.checked)} style={{ accentColor: '#3b82f6' }} />
                      Small Variant
                    </label>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#ccc', marginBottom: 4 }}>
                      <span>Info Size</span>
                      <span style={{ color: '#3b82f6', fontWeight: 700 }}>x{scoreLineSize}</span>
                    </div>
                    <input type="range" min={1} max={9} value={scoreLineSize} onChange={e => setFieldValue('score-line', 'score-line-size', Number(e.target.value))} style={{ width: '100%', accentColor: '#3b82f6' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: '#ccc' }}>Timer Color</span>
                    <input type="color" value={timerColor} onChange={e => setFieldValue('score-line', 'score-line-timer-color', e.target.value)} style={{ border: 'none', background: 'none', cursor: 'pointer', width: 24, height: 24 }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: '#ccc' }}>Left (title, score)</span>
                    <input
                      type="color"
                      value={(getFieldValue('score-line', 'score-line-left-color', { title: '#DADBE3' }) as any).title || '#DADBE3'}
                      onChange={e => setFieldValue('score-line', 'score-line-left-color', { title: e.target.value, score: e.target.value })}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', width: 24, height: 24 }}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: '#ccc' }}>Right (title, score)</span>
                    <input
                      type="color"
                      value={(getFieldValue('score-line', 'score-line-right-color', { title: '#DADBE3' }) as any).title || '#DADBE3'}
                      onChange={e => setFieldValue('score-line', 'score-line-right-color', { title: e.target.value, score: e.target.value })}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', width: 24, height: 24 }}
                    />
                  </div>
                </div>
              )}

              {/* Team Stats Popover */}
              {activeComponentId === 'team-stats' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#ccc', cursor: 'pointer' }}>
                    <input type="checkbox" checked={showAssists} onChange={e => setFieldValue('team-stats', 'team-stats-assists', e.target.checked)} style={{ accentColor: '#3b82f6' }} />
                    Assists
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#ccc', cursor: 'pointer' }}>
                    <input type="checkbox" checked={showKills} onChange={e => setFieldValue('team-stats', 'team-stats-kills', e.target.checked)} style={{ accentColor: '#3b82f6' }} />
                    Kills
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#ccc', cursor: 'pointer' }}>
                    <input type="checkbox" checked={showDeaths} onChange={e => setFieldValue('team-stats', 'team-stats-deaths', e.target.checked)} style={{ accentColor: '#3b82f6' }} />
                    Deaths
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#ccc', cursor: 'pointer' }}>
                    <input type="checkbox" checked={showEco} onChange={e => setFieldValue('team-stats', 'team-stats-player-eco', e.target.checked)} style={{ accentColor: '#3b82f6' }} />
                    Player Ecos
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#ccc', cursor: 'pointer' }}>
                    <input type="checkbox" checked={showUlts} onChange={e => setFieldValue('team-stats', 'team-stats-ults', e.target.checked)} style={{ accentColor: '#3b82f6' }} />
                    Ultimates
                  </label>
                </div>
              )}

              {/* Game Events Popover */}
              {activeComponentId === 'game-events' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: '#ccc' }}>Bg Color</span>
                    <input type="color" value={eventsBg} onChange={e => setFieldValue('game-events', 'game-events-bg-color', e.target.value)} style={{ border: 'none', background: 'none', cursor: 'pointer', width: 24, height: 24 }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: '#ccc' }}>Highlight Color</span>
                    <input type="color" value={eventsHighlight} onChange={e => setFieldValue('game-events', 'game-events-highlight-color', e.target.value)} style={{ border: 'none', background: 'none', cursor: 'pointer', width: 24, height: 24 }} />
                  </div>
                  {/* Round Win upload (always shown) */}
                  <UploadBtn label="Round Win" getVal={() => getFieldValue('game-events', 'game-events-bg-round-winner', null)} setVal={v => setFieldValue('game-events', 'game-events-bg-round-winner', v)} />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: '#ccc' }}>Individual Uploads</span>
                    <input type="checkbox" checked={getFieldValue('game-events', 'game-events-individual-uploads', false)} onChange={e => setFieldValue('game-events', 'game-events-individual-uploads', e.target.checked)} style={{ accentColor: '#3b82f6' }} />
                  </div>
                  {getFieldValue('game-events', 'game-events-individual-uploads', false) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8 }}>
                      {[
                        ['Ace', 'game-events-bg-ace'],
                        ['Clutch', 'game-events-bg-clutch'],
                        ['Flawless', 'game-events-bg-flawless'],
                        ['Round Win', 'game-events-bg-round-winner'],
                        ['Team Ace', 'game-events-bg-team-ace'],
                        ['Thrifty', 'game-events-bg-thrifty'],
                      ].map(([label, field]) => (
                        <UploadBtn key={field} label={label} getVal={() => getFieldValue('game-events', field, null)} setVal={v => setFieldValue('game-events', field, v)} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Sponsors Popover */}
              {activeComponentId === 'sponsors' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: '#ccc' }}>Animated Advertisement Watermark</span>
                  <input type="checkbox" checked={getFieldValue('sponsors', 'sponsors-animated-watermark', false)} onChange={e => setFieldValue('sponsors', 'sponsors-animated-watermark', e.target.checked)} style={{ accentColor: '#3b82f6' }} />
                </div>
              )}

              {/* Buy Round Popover */}
              {activeComponentId === 'buy-round' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#ccc', cursor: 'pointer' }}>
                    <input type="checkbox" checked={getFieldValue('buy-round', 'display-sponsors', true)} onChange={e => setFieldValue('buy-round', 'display-sponsors', e.target.checked)} style={{ accentColor: '#3b82f6' }} />
                    Sponsors
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#ccc', cursor: 'pointer' }}>
                    <input type="checkbox" checked={getFieldValue('buy-round', 'small-variant', false)} onChange={e => setFieldValue('buy-round', 'small-variant', e.target.checked)} style={{ accentColor: '#3b82f6' }} />
                    Small Variant
                  </label>
                </div>
              )}

              {/* Card Popover (Map Ban only — Postgame card has no fields) */}
              {activeComponentId === 'card' && selectedSceneKey === 'map-ban' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#ccc', cursor: 'pointer' }}>
                    <input type="checkbox" checked={getFieldValue('card', 'show-title', true)} onChange={e => setFieldValue('card', 'show-title', e.target.checked)} style={{ accentColor: '#3b82f6' }} />
                    Title
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#ccc', cursor: 'pointer' }}>
                    <input type="checkbox" checked={getFieldValue('card', 'show-side-labels', true)} onChange={e => setFieldValue('card', 'show-side-labels', e.target.checked)} style={{ accentColor: '#3b82f6' }} />
                    Side Labels
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#ccc', cursor: 'pointer' }}>
                    <input type="checkbox" checked={getFieldValue('card', 'show-footer', true)} onChange={e => setFieldValue('card', 'show-footer', e.target.checked)} style={{ accentColor: '#3b82f6' }} />
                    Footer
                  </label>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Settings modal */}
      {settingsOpen && (
        <div className="modal-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600 }}>HUD Settings</h3>
              <button onClick={() => setSettingsOpen(false)} style={{ background: 'none', border: 'none', color: 'hsla(var(--muted-foreground))', cursor: 'pointer' }}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'hsla(var(--muted-foreground))', marginBottom: 4, display: 'block' }}>Resolution</label>
                <Dropdown value="1920x1080" options={['1920x1080', '1280x720', '2560x1440']} onChange={() => {}} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'hsla(var(--muted-foreground))', marginBottom: 4, display: 'block' }}>Framerate</label>
                <Dropdown value="60fps" options={['30fps', '60fps']} onChange={() => {}} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
)
}
