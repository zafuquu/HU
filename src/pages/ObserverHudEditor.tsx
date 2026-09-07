import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Save, RotateCcw, Move } from 'lucide-react'

// ===== Valorant Observer HUD layout (mirrors @havoc-platform/data-schemas) =====
const GROUP_IDS = ['scoreline', 'leftPlayerPanel', 'rightPlayerPanel', 'leftMapSide', 'rightMapSide'] as const
type GroupId = (typeof GROUP_IDS)[number]

const GROUP_LABELS: Record<GroupId, string> = {
  scoreline: 'Scoreline',
  leftPlayerPanel: 'Left Player Panel',
  rightPlayerPanel: 'Right Player Panel',
  leftMapSide: 'Left Map Side',
  rightMapSide: 'Right Map Side',
}

const GROUP_COLORS: Record<GroupId, string> = {
  scoreline: '#F6C945',
  leftPlayerPanel: '#28D091',
  rightPlayerPanel: '#FF3549',
  leftMapSide: '#5AB0FF',
  rightMapSide: '#B07CFF',
}

const GROUP_SIZES: Record<GroupId, { w: number; h: number }> = {
  scoreline: { w: 560, h: 120 },
  leftPlayerPanel: { w: 420, h: 260 },
  rightPlayerPanel: { w: 420, h: 260 },
  leftMapSide: { w: 300, h: 200 },
  rightMapSide: { w: 300, h: 200 },
}

const DESIGN = { width: 1920, height: 1080 }

type GroupLayout = { scale: number; visible: boolean; x: number; y: number }
type HudLayout = {
  colors: { attack: string; defense: string; observedPlayer: string }
  groups: Record<GroupId, GroupLayout>
  version: 1
}

const DEFAULT_LAYOUT: HudLayout = {
  colors: { attack: '#FF3549', defense: '#28D091', observedPlayer: '#F6C945' },
  groups: {
    leftMapSide: { scale: 1, visible: true, x: 5, y: 102 },
    leftPlayerPanel: { scale: 1, visible: true, x: 16, y: 768 },
    rightMapSide: { scale: 1, visible: true, x: 470, y: 119 },
    rightPlayerPanel: { scale: 1, visible: true, x: 1514, y: 768 },
    scoreline: { scale: 1, visible: true, x: 960, y: 0 },
  },
  version: 1,
}

const LS_KEY = 'valorant-observer-hud-layout-v1'

function loadLayout(): HudLayout {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return DEFAULT_LAYOUT
    const saved = JSON.parse(raw)
    return {
      ...DEFAULT_LAYOUT,
      ...saved,
      colors: { ...DEFAULT_LAYOUT.colors, ...(saved.colors || {}) },
      groups: Object.fromEntries(
        GROUP_IDS.map(g => [g, { ...DEFAULT_LAYOUT.groups[g], ...(saved.groups?.[g] || {}) }]),
      ) as HudLayout['groups'],
      version: 1,
    }
  } catch {
    return DEFAULT_LAYOUT
  }
}

export default function ObserverHudEditor() {
  const [searchParams] = useSearchParams()
  const bridgeId = searchParams.get('observerEditorBridgeId') || ''
  const embedded = searchParams.get('embedded') === 'true'

  const [layout, setLayout] = useState<HudLayout>(loadLayout)
  const [selected, setSelected] = useState<GroupId>('scoreline')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const stageRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<{ group: GroupId; startX: number; startY: number; origX: number; origY: number } | null>(null)

  const parentOrigin = useMemo(() => {
    if (window.parent === window) return null
    try {
      return new URL(document.referrer, window.location.href).origin
    } catch {
      return null
    }
  }, [])

  const post = useCallback(
    (messageType: string, messagePayload: unknown) => {
      if (!embedded || !bridgeId) return
      window.parent?.postMessage({ messageType, messagePayload }, parentOrigin || '*')
    },
    [bridgeId, embedded, parentOrigin],
  )

  // 1) tell the desktop we're ready (it replies with OBSERVER_HUD_LAYOUT_INIT)
  useEffect(() => {
    if (!embedded || !bridgeId) return
    post('OBSERVER_HUD_EDITOR_READY', { bridgeId })
  }, [bridgeId, embedded, post])

  // 2) receive layout init / save results from the desktop
  useEffect(() => {
    if (!embedded || !bridgeId) return
    const onMessage = (event: MessageEvent) => {
      if (parentOrigin && event.origin !== parentOrigin) return
      const data = event.data
      if (!data || typeof data !== 'object') return
      const payload = data.messagePayload
      if (!payload || payload.bridgeId !== bridgeId) return

      switch (data.messageType) {
        case 'OBSERVER_HUD_LAYOUT_INIT': {
          const incoming = payload.layout
          if (incoming && typeof incoming === 'object') {
            setLayout(prev => ({
              ...prev,
              ...incoming,
              colors: { ...prev.colors, ...(incoming.colors || {}) },
              groups: Object.fromEntries(
                GROUP_IDS.map(g => [g, { ...prev.groups[g], ...(incoming.groups?.[g] || {}) }]),
              ) as HudLayout['groups'],
              version: 1,
            }))
          }
          break
        }
        case 'OBSERVER_HUD_LAYOUT_SAVE_RESULT': {
          setSaveState(payload.ok ? 'saved' : 'error')
          if (payload.ok && payload.layout) {
            localStorage.setItem(LS_KEY, JSON.stringify(payload.layout))
          }
          setTimeout(() => setSaveState('idle'), 2500)
          break
        }
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [bridgeId, embedded, parentOrigin])

  // 3) persist locally on every change
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(layout))
  }, [layout])

  // ---- interactions ----
  const updateGroup = (group: GroupId, patch: Partial<GroupLayout>) =>
    setLayout(prev => ({ ...prev, groups: { ...prev.groups, [group]: { ...prev.groups[group], ...patch } } }))

  const onStagePointerDown = (e: React.PointerEvent) => {
    const groupEl = (e.target as HTMLElement).closest('[data-group]') as HTMLElement | null
    if (!groupEl || !stageRef.current) return
    const group = groupEl.dataset.group as GroupId
    setSelected(group)
    const rect = stageRef.current.getBoundingClientRect()
    dragRef.current = {
      group,
      startX: e.clientX / (rect.width / DESIGN.width),
      startY: e.clientY / (rect.height / DESIGN.height),
      origX: layout.groups[group].x,
      origY: layout.groups[group].y,
    }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const onStagePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    if (!drag || !stageRef.current) return
    const rect = stageRef.current.getBoundingClientRect()
    const nx = Math.round(drag.origX + (e.clientX / (rect.width / DESIGN.width) - drag.startX))
    const ny = Math.round(drag.origY + (e.clientY / (rect.height / DESIGN.height) - drag.startY))
    updateGroup(drag.group, {
      x: Math.max(-200, Math.min(DESIGN.width + 200, nx)),
      y: Math.max(-100, Math.min(DESIGN.height + 100, ny)),
    })
  }

  const onStagePointerUp = () => {
    dragRef.current = null
  }

  const handleSave = () => {
    setSaveState('saving')
    post('OBSERVER_HUD_LAYOUT_SAVE', { bridgeId, layout })
    localStorage.setItem(LS_KEY, JSON.stringify(layout))
    // when standalone there is no desktop to ack — treat local persist as success
    if (!embedded) {
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2500)
    }
  }

  const resetLayout = () => setLayout(DEFAULT_LAYOUT)

  const sel = layout.groups[selected]

  return (
    <div className="flex h-screen w-screen flex-col bg-[#0d1117] text-white">
      {/* toolbar */}
      <div className="flex items-center gap-3 border-b border-white/10 bg-black/40 px-4 py-2">
        <span className="text-sm font-semibold tracking-wide text-white/80">VALORANT HUD EDITOR</span>
        <div className="mx-2 h-5 w-px bg-white/10" />
        {GROUP_IDS.map(g => (
          <button
            key={g}
            onClick={() => setSelected(g)}
            className={`rounded px-2 py-1 text-xs transition ${
              selected === g ? 'bg-white/20 font-medium' : 'text-white/60 hover:bg-white/10'
            }`}
            style={selected === g ? { boxShadow: `inset 0 -2px 0 ${GROUP_COLORS[g]}` } : undefined}
          >
            {GROUP_LABELS[g]}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={resetLayout}
            className="flex items-center gap-1 rounded px-3 py-1.5 text-xs text-white/60 hover:bg-white/10"
          >
            <RotateCcw size={13} /> Reset
          </button>
          <button
            onClick={handleSave}
            disabled={saveState === 'saving'}
            className="flex items-center gap-1 rounded bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
          >
            <Save size={13} />
            {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved ✓' : saveState === 'error' ? 'Failed ✗' : 'Save'}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* stage */}
        <div className="flex min-w-0 flex-1 items-center justify-center overflow-hidden p-6">
          <div
            ref={stageRef}
            onPointerDown={onStagePointerDown}
            onPointerMove={onStagePointerMove}
            onPointerUp={onStagePointerUp}
            className="relative aspect-video w-full max-h-full shadow-2xl"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px), radial-gradient(circle at 30% 20%, rgba(90,176,255,.08), transparent 60%), linear-gradient(135deg,#1a2233,#10141d)',
              backgroundSize: '96px 54px, 96px 54px, cover, cover',
            }}
          >
            {GROUP_IDS.map(g => {
              const gl = layout.groups[g]
              if (!gl.visible) return null
              const sz = GROUP_SIZES[g]
              return (
                <div
                  key={g}
                  data-group={g}
                  className={`absolute cursor-move rounded-lg border-2 ${selected === g ? 'border-dashed' : ''}`}
                  style={{
                    left: `${(gl.x / DESIGN.width) * 100}%`,
                    top: `${(gl.y / DESIGN.height) * 100}%`,
                    width: sz.w,
                    height: sz.h,
                    borderColor: GROUP_COLORS[g],
                    background: selected === g ? `${GROUP_COLORS[g]}18` : `${GROUP_COLORS[g]}0a`,
                    opacity: selected === g ? 1 : 0.55,
                  }}
                >
                  <span
                    className="absolute -top-5 left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-bold"
                    style={{ background: GROUP_COLORS[g], color: '#000' }}
                  >
                    {GROUP_LABELS[g]}
                  </span>
                  <div className="flex h-full items-center justify-center">
                    <Move size={22} style={{ color: GROUP_COLORS[g] }} />
                  </div>
                </div>
              )
            })}
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />
          </div>
        </div>

        {/* inspector */}
        <aside className="w-72 shrink-0 space-y-5 overflow-y-auto border-l border-white/10 bg-black/30 p-4">
          <div>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-white/50">{GROUP_LABELS[selected]}</h3>
            <label className="mb-1 block text-xs text-white/60">Scale — {sel.scale.toFixed(2)}×</label>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.05}
              value={sel.scale}
              onChange={e => updateGroup(selected, { scale: Number(e.target.value) })}
              className="w-full accent-emerald-400"
            />
          </div>
          <label className="flex items-center justify-between text-sm">
            <span className="text-white/70">Visible</span>
            <input
              type="checkbox"
              checked={sel.visible}
              onChange={e => updateGroup(selected, { visible: e.target.checked })}
              className="h-4 w-4 accent-emerald-400"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs text-white/60">X</label>
              <input
                type="number"
                value={sel.x}
                onChange={e => updateGroup(selected, { x: Number(e.target.value) })}
                className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-sm outline-none focus:border-emerald-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">Y</label>
              <input
                type="number"
                value={sel.y}
                onChange={e => updateGroup(selected, { y: Number(e.target.value) })}
                className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-sm outline-none focus:border-emerald-400"
              />
            </div>
          </div>
          <div className="border-t border-white/10 pt-4">
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-white/50">Colors</h4>
            {(Object.keys(layout.colors) as Array<keyof HudLayout['colors']>).map(c => (
              <label key={c} className="mb-2 flex items-center justify-between text-xs capitalize text-white/70">
                {c.replace(/([A-Z])/g, ' $1').toLowerCase()}
                <input
                  type="color"
                  value={layout.colors[c]}
                  onChange={e => setLayout(prev => ({ ...prev, colors: { ...prev.colors, [c]: e.target.value } }))}
                  className="h-7 w-12 cursor-pointer rounded border border-white/10 bg-transparent"
                />
              </label>
            ))}
          </div>
          {!embedded && (
            <p className="text-[11px] leading-relaxed text-white/40">
              Standalone mode — changes are saved to this browser. Open via the desktop app's "Customize HUD" to sync
              the layout back to the app.
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}
