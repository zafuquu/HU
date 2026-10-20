import { useState } from 'react'
import { Copy, Video, Disc, EyeOff, Eye } from 'lucide-react'
import { useAppStore, type Player } from '../store/AppContext'
import WebcamSourcePopover from '../components/WebcamSourcePopover'

export default function CameraFeed() {
  const { state, setState, updatePlayer, showToast } = useAppStore()
  // P4: delays are persisted workspace state (AppContext `globalDelay` /
  // `teamADelay` / `teamBDelay`) so they follow the room everywhere instead
  // of living in transient component state.
  const globalDelay = String(state.globalDelay ?? 0)
  const setGlobalDelay = (v: string) => setState(p => ({ ...p, globalDelay: Number(v) || 0 }))
  const leftTeamDelay = state.teamADelay ?? ''
  const setLeftTeamDelay = (v: string) => setState(p => ({ ...p, teamADelay: v }))
  const rightTeamDelay = state.teamBDelay ?? ''
  const setRightTeamDelay = (v: string) => setState(p => ({ ...p, teamBDelay: v }))
  const [layoutMode, setLayoutMode] = useState<'stack' | 'grid' | 'clutch'>('stack')
  const [aspectRatio, setAspectRatio] = useState<'16/9' | '4/3' | '1/1'>('16/9')
  const [showTeamGlow, setShowTeamGlow] = useState(true)
  const [activeWebcamPlayer, setActiveWebcamPlayer] = useState<{ teamId: string; player: Player } | null>(null)

  const teamA = state.teams.find(t => t.id === state.teamAId) || state.teams[0]
  const teamB = state.teams.find(t => t.id === state.teamBId) || state.teams[1]

  // Default to 5 players per team to match authentic screenshot if roster is smaller
  const defaultPlayersA: Player[] = teamA?.players && teamA.players.length > 0
    ? teamA.players
    : [
        { id: '12', alias: '12', riotId: '12', webcamSource: 'Internal Webcam', avatarUrl: null },
        { id: '2', alias: '2', riotId: '2', webcamSource: 'Internal Webcam', avatarUrl: null },
        { id: '3', alias: '3', riotId: '3', webcamSource: 'Internal Webcam', avatarUrl: null },
        { id: '4', alias: '4', riotId: '4', webcamSource: 'Internal Webcam', avatarUrl: null },
        { id: '5', alias: '5', riotId: '5', webcamSource: 'Internal Webcam', avatarUrl: null },
      ]

  const defaultPlayersB: Player[] = teamB?.players && teamB.players.length > 0
    ? teamB.players
    : [
        { id: 'test', alias: 'test', riotId: 'test', webcamSource: 'Internal Webcam', avatarUrl: null },
        { id: '1', alias: '1', riotId: '1', webcamSource: 'Internal Webcam', avatarUrl: null },
        { id: '2', alias: '2', riotId: '2', webcamSource: 'Internal Webcam', avatarUrl: null },
        { id: '3', alias: '3', riotId: '3', webcamSource: 'Internal Webcam', avatarUrl: null },
        { id: '4', alias: '4', riotId: '4', webcamSource: 'Internal Webcam', avatarUrl: null },
      ]

  const isVisible = (playerId: string) => state.cameraVisibility[playerId] !== false

  const toggleVisibility = (playerId: string) => {
    setState(prev => ({
      ...prev,
      cameraVisibility: { ...prev.cameraVisibility, [playerId]: !isVisible(playerId) },
    }))
  }

  const copyTeamLinks = (teamName: string, players: Player[], teamId: string) => {
    // P4: real HTTP invite links. One roster URL per team ("click your name"
    // page) plus a direct publisher deep link per player (slotId = player id).
    const base = `${window.location.origin}/webcams/invite/${state.serverCode}/${teamId}`
    const links = [
      `${teamName} roster (click your name): ${base}`,
      ...players.map(p => `${p.riotId || p.alias || 'Player'}: ${base}/${p.id}`),
    ].join('\n')
    navigator.clipboard.writeText(links).catch(() => {})
    showToast(`Copied ${teamName} invite links!`)
  }

  const renderPlayerCard = (player: Player, teamId: string) => {
    const vis = isVisible(player.id)
    const isExternal = player.webcamSource === 'External Webcam'
    const teamColor = teamId === teamA?.id ? (teamA?.color || '#28D091') : (teamB?.color || '#FF3549')
    const aspectClass = aspectRatio === '16/9' ? 'aspect-[16/9]' : aspectRatio === '4/3' ? 'aspect-[4/3]' : 'aspect-square'

    return (
      <article
        key={player.id}
        className={`group relative flex ${aspectClass} w-full min-w-0 flex-col justify-between overflow-hidden rounded-md border border-[#24272b] bg-[#101113] p-3 transition-all hover:border-[#3a3e43]`}
        style={showTeamGlow && vis ? { borderColor: `${teamColor}88`, boxShadow: `0 0 12px ${teamColor}22` } : undefined}
      >
        {/* Top Row: Tag / Alias and Eye icon */}
        <div className="flex items-center justify-between z-10">
          <div className="rounded bg-[#181a1d] px-2 py-0.5 text-xs font-semibold text-white/90">
            {player.riotId || player.alias || 'Player'}
          </div>
          <button
            type="button"
            onClick={() => toggleVisibility(player.id)}
            className="flex size-6 items-center justify-center rounded bg-[#183944] text-[#4ed9b4] hover:bg-[#1e4856] transition-colors cursor-pointer"
            title={vis ? 'Webcam active on overlay' : 'Webcam hidden'}
          >
            {vis ? <Eye className="size-3.5" /> : <Eye className="size-3.5 opacity-40" />}
          </button>
        </div>

        {/* Center: Camera Outline Icon */}
        <div className="relative flex size-full items-center justify-center py-2">
          <Video className="size-8 text-[#5c6570] stroke-[1.5]" />
        </div>

        {/* Bottom Row: Internal/External button (triggers Popover) and Hide buttons */}
        <div className="flex items-center gap-2 z-10">
          <button
            type="button"
            onClick={() => setActiveWebcamPlayer({ teamId, player })}
            className="flex flex-1 items-center justify-center gap-1.5 rounded bg-[#16181b] border border-white/5 py-1 px-2 text-xs font-medium text-[#e7e7e7]/80 hover:bg-[#1f2226] transition-colors cursor-pointer"
          >
            <Disc className="size-3.5 text-[#e7e7e7]/60" />
            <span>{isExternal ? 'External' : 'Internal'}</span>
          </button>

          <button
            type="button"
            onClick={() => toggleVisibility(player.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded py-1 px-2 text-xs font-medium transition-colors cursor-pointer ${
              !vis
                ? 'bg-red-500/20 border border-red-500 text-red-400'
                : 'bg-[#1a1315] border border-red-500/30 text-[#e7e7e7]/80 hover:bg-[#25181a]'
            }`}
          >
            <EyeOff className="size-3.5 text-red-400/80" />
            <span>Hide</span>
          </button>
        </div>
      </article>
    )
  }

  return (
    <div className="size-full overflow-y-auto p-8 text-white" style={{ scrollbarWidth: 'none' }}>
      <div className="flex size-full min-h-0 flex-col gap-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-[#f1f1f1]">Webcam manager</h1>
            <p className="mt-1 text-sm text-[#e7e7e7]/50">
              Monitor current match feeds and manage webcams for your broadcast.
            </p>
          </div>

          {/* Top-right Delay Settings Box */}
          <div className="flex w-fit shrink-0 items-center justify-center gap-4 rounded-md border border-[#24272b] bg-[#101113] px-4 py-3">
            <div className="grid gap-6 md:grid-cols-3">
              {/* Global Delay */}
              <div className="min-w-0 space-y-1">
                <label className="text-xs font-medium text-[#e7e7e7]/60" htmlFor="camera-feed-global-delay">
                  Global Delay
                </label>
                <div className="relative w-32 max-w-full">
                  <input
                    id="camera-feed-global-delay"
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="0"
                    value={globalDelay}
                    onChange={e => setGlobalDelay(e.target.value)}
                    className="w-full rounded border border-white/10 bg-[#16181b] px-2.5 py-1.5 pr-7 text-right text-xs text-white outline-none focus:border-[#65c7ff]"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[10px] text-[#e7e7e7]/45">
                    sec
                  </span>
                </div>
              </div>

              {/* Left Team Delay */}
              <div className="min-w-0 space-y-1">
                <label className="text-xs font-medium text-[#e7e7e7]/60" htmlFor="camera-feed-team-delay-left">
                  {teamA?.name || 'test'} Delay
                </label>
                <div className="relative w-32 max-w-full">
                  <input
                    id="camera-feed-team-delay-left"
                    type="text"
                    placeholder={`Inherits ${globalDelay || '0'}s`}
                    value={leftTeamDelay}
                    onChange={e => setLeftTeamDelay(e.target.value)}
                    className="w-full rounded border border-white/10 bg-[#16181b] px-2.5 py-1.5 pr-7 text-right text-xs text-[#e7e7e7]/70 outline-none focus:border-[#65c7ff]"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[10px] text-[#e7e7e7]/45">
                    sec
                  </span>
                </div>
              </div>

              {/* Right Team Delay */}
              <div className="min-w-0 space-y-1">
                <label className="text-xs font-medium text-[#e7e7e7]/60" htmlFor="camera-feed-team-delay-right">
                  {teamB?.name || 'test2'} Delay
                </label>
                <div className="relative w-32 max-w-full">
                  <input
                    id="camera-feed-team-delay-right"
                    type="text"
                    placeholder={`Inherits ${globalDelay || '0'}s`}
                    value={rightTeamDelay}
                    onChange={e => setRightTeamDelay(e.target.value)}
                    className="w-full rounded border border-white/10 bg-[#16181b] px-2.5 py-1.5 pr-7 text-right text-xs text-[#e7e7e7]/70 outline-none focus:border-[#65c7ff]"
                  />
                  <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[10px] text-[#e7e7e7]/45">
                    sec
                  </span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Layout & Grid Settings Bar (#20) */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#24272b] bg-[#101113] p-3">
          <div className="flex items-center gap-4">
            <span className="text-xs font-semibold text-[#f1f1f1]">Camera Grid Layout:</span>
            <div className="flex items-center gap-1 rounded bg-[#16181b] p-1 border border-white/5">
              <button
                type="button"
                onClick={() => setLayoutMode('stack')}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  layoutMode === 'stack' ? 'bg-[#3697FF] text-white' : 'text-white/60 hover:text-white'
                }`}
              >
                5-Stack Row
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('grid')}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  layoutMode === 'grid' ? 'bg-[#3697FF] text-white' : 'text-white/60 hover:text-white'
                }`}
              >
                Multi-Cam Grid
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('clutch')}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  layoutMode === 'clutch' ? 'bg-[#3697FF] text-white' : 'text-white/60 hover:text-white'
                }`}
              >
                1v1 Duel Focus
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/60">Aspect:</span>
              <select
                value={aspectRatio}
                onChange={e => setAspectRatio(e.target.value as any)}
                className="rounded border border-white/10 bg-[#16181b] px-2 py-1 text-xs text-white outline-none cursor-pointer"
              >
                <option value="16/9">16:9 Widescreen</option>
                <option value="4/3">4:3 Standard</option>
                <option value="1/1">1:1 Square</option>
              </select>
            </div>

            <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
              <input
                type="checkbox"
                checked={showTeamGlow}
                onChange={e => setShowTeamGlow(e.target.checked)}
                className="rounded border-white/20"
              />
              <span>Team Glow</span>
            </label>
          </div>
        </div>

        {/* Scrollable Team Sections */}
        <div className="space-y-8">
          {/* Section 1: Team A */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <div className="size-5 rounded-xs bg-[#2a2e33]" />
                <p className="truncate text-xs font-medium text-[#e7e7e7]/60">
                  {teamA?.name || 'test'} · {defaultPlayersA.length} players
                </p>
              </div>

              <button
                type="button"
                onClick={() => copyTeamLinks(teamA?.name || 'test', defaultPlayersA, teamA?.id || 'team1')}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#2a2d31] bg-[#15171a] px-3 text-xs font-medium text-[#e7e7e7]/70 transition-colors hover:border-[#3a3e43] hover:bg-[#1a1c20] hover:text-[#f1f1f1] cursor-pointer"
              >
                <Copy className="size-3.5" />
                Copy team links
              </button>
            </div>

            {/* Dynamic player grid */}
            <div className={`grid gap-3.5 ${layoutMode === 'clutch' ? 'grid-cols-2' : layoutMode === 'grid' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5' : 'grid-cols-5'}`}>
              {defaultPlayersA.map(p => renderPlayerCard(p, teamA?.id || 'team1'))}
            </div>
          </section>

          {/* Section 2: Team B */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <div className="size-5 rounded-xs bg-[#2a2e33]" />
                <p className="truncate text-xs font-medium text-[#e7e7e7]/60">
                  {teamB?.name || 'test2'} · {defaultPlayersB.length} players
                </p>
              </div>

              {/* P4 parity: Team B gets the same invite-link copy action as Team A */}
              <button
                type="button"
                onClick={() => copyTeamLinks(teamB?.name || 'test2', defaultPlayersB, teamB?.id || 'team2')}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#2a2d31] bg-[#15171a] px-3 text-xs font-medium text-[#e7e7e7]/70 transition-colors hover:border-[#3a3e43] hover:bg-[#1a1c20] hover:text-[#f1f1f1] cursor-pointer"
              >
                <Copy className="size-3.5" />
                Copy team links
              </button>
            </div>

            {/* Dynamic player grid */}
            <div className={`grid gap-3.5 ${layoutMode === 'clutch' ? 'grid-cols-2' : layoutMode === 'grid' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5' : 'grid-cols-5'}`}>
              {defaultPlayersB.map(p => renderPlayerCard(p, teamB?.id || 'team2'))}
            </div>
          </section>
        </div>
      </div>

      {/* Webcam Source Popover Modal */}
      {activeWebcamPlayer && (
        <WebcamSourcePopover
          playerName={activeWebcamPlayer.player.alias || activeWebcamPlayer.player.riotId}
          currentSource={activeWebcamPlayer.player.webcamSource}
          onSave={(source, url) => {
            updatePlayer(activeWebcamPlayer.teamId, activeWebcamPlayer.player.id, {
              webcamSource: source,
              // P4: persist the external stream URL alongside the source toggle
              webcamUrl: source === 'External Webcam' ? (url ?? activeWebcamPlayer.player.webcamUrl ?? null) : null,
            })
            showToast(`Webcam source set to ${source === 'External Webcam' ? 'External' : 'Internal'}`)
          }}
          onClose={() => setActiveWebcamPlayer(null)}
        />
      )}
    </div>
  )
}
