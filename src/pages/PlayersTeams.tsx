import { useState } from 'react'
import { Search, Plus, Trash2, Copy, Upload, ChevronDown } from 'lucide-react'
import { useAppStore, type Player } from '../store/AppContext'
import ConfirmDialog from '../components/ConfirmDialog'
import WebcamSourcePopover from '../components/WebcamSourcePopover'

const CstmPenIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg" className="fill-current scale-110" color="currentColor">
    <path d="M7.73833 0.333008C7.82656 0.333027 7.91119 0.368029 7.97366 0.430342L9.85966 2.31634C9.92215 2.37885 9.95725 2.46362 9.95725 2.55201C9.95725 2.6404 9.92215 2.72517 9.85966 2.78768L3.73099 8.91568C3.68913 8.95748 3.6369 8.98739 3.57966 9.00234L1.02766 9.66901C0.971405 9.68368 0.912293 9.68338 0.856189 9.66815C0.800086 9.65292 0.748941 9.62327 0.707834 9.58217C0.666726 9.54106 0.637084 9.48992 0.62185 9.43381C0.606616 9.37771 0.606321 9.31859 0.620992 9.26234L1.28766 6.71034C1.30261 6.6531 1.33252 6.60087 1.37433 6.55901L7.50233 0.430342C7.53334 0.399407 7.57014 0.374888 7.61064 0.358187C7.65113 0.341486 7.69452 0.33293 7.73833 0.333008ZM0.666992 10.833C0.534384 10.833 0.407207 10.8857 0.313439 10.9795C0.219671 11.0732 0.166992 11.2004 0.166992 11.333C0.166992 11.4656 0.219671 11.5928 0.313439 11.6866C0.407207 11.7803 0.534384 11.833 0.666992 11.833H10.667C10.7996 11.833 10.9268 11.7803 11.0205 11.6866C11.1143 11.5928 11.167 11.4656 11.167 11.333C11.167 11.2004 11.1143 11.0732 11.0205 10.9795C10.9268 10.8857 10.7996 10.833 10.667 10.833H0.666992Z" />
  </svg>
)

const HairlineDivider = ({ className = '' }: { className?: string }) => (
  <div className={`inline-flex h-0.5 w-full flex-col items-start justify-start ${className}`}>
    <div className="relative h-px w-full bg-[#101214]" />
    <div className="relative h-px w-full bg-[#e4e2e7]/5" />
  </div>
)

export default function PlayersTeams() {
  const { state, addTeam, deleteTeam, updateTeam, addPlayer, deletePlayer, updatePlayer, showToast } = useAppStore()
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(state.teams[0]?.id || null)
  const [searchQuery, setSearchQuery] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'team' | 'player'; teamId: string; playerId?: string } | null>(null)
  const [activeWebcamPlayer, setActiveWebcamPlayer] = useState<{ teamId: string; player: Player } | null>(null)

  const selectedTeam = state.teams.find(t => t.id === selectedTeamId) || state.teams[0]
  const filteredTeams = state.teams.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.tag.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const executeDelete = () => {
    if (!confirmDelete) return
    if (confirmDelete.type === 'team') {
      deleteTeam(confirmDelete.teamId)
      if (selectedTeamId === confirmDelete.teamId) {
        const remaining = state.teams.filter(t => t.id !== confirmDelete.teamId)
        setSelectedTeamId(remaining[0]?.id || null)
      }
      showToast('Team deleted')
    } else if (confirmDelete.type === 'player' && confirmDelete.playerId) {
      deletePlayer(confirmDelete.teamId, confirmDelete.playerId)
      showToast('Player removed')
    }
  }

  const copyWebcamLinks = () => {
    if (!selectedTeam) return
    const links = selectedTeam.players.map(p => `${p.riotId || 'Player'}: webcam://${state.serverCode}/${p.id}`).join('\n')
    navigator.clipboard.writeText(links).catch(() => {})
    showToast('Webcam links copied!')
  }

  return (
    <div className="size-full flex flex-col text-white">
      <div className="flex min-h-0 w-full flex-1">
        {/* Left Column: Teams Navigation */}
        <div className="flex h-full w-74 flex-col border-y-0 border-r-[1px] border-[#e7e7e7]/5 shadow-[1px_0px_0px_0px_rgba(14,13,15,1.00)] shrink-0">
          {/* Search Header */}
          <div className="flex h-21 items-center gap-3 p-6">
            <div className="flex-1">
              <div className="relative">
                <div className="relative group squircle-input w-full md:text-sm h-9 rounded-lg border border-white/5 bg-[#141618] px-3 flex items-center shadow-[inset_0px_4px_8px_0px_rgba(0,0,0,0.05)]">
                  <Search className="lucide lucide-search mr-2 size-4 text-[#e7e7e7]/40 shrink-0" />
                  <input
                    className="placeholder:text-muted-foreground w-full overflow-hidden bg-transparent text-xs text-[#e7e7e7] outline-none placeholder:opacity-40"
                    placeholder="Search..."
                    type="search"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <button
              type="button"
              className="flex aspect-square size-9 items-center justify-center rounded-lg border border-white/5 bg-[#141618] opacity-50 duration-200 hover:opacity-100 hover:bg-white/5"
            >
              <CstmPenIcon />
            </button>
          </div>

          <HairlineDivider />

          {/* Add Team Button */}
          <div className="flex flex-col gap-3 px-6 pt-5 pb-4">
            <button
              type="button"
              onClick={() => {
                if (state.teams.length < 64) {
                  addTeam()
                  showToast('Team added')
                }
              }}
              disabled={state.teams.length >= 64}
              className="flex h-10 w-full items-center justify-between rounded-xl border border-white/5 bg-[#101113] px-3.5 text-sm text-[#e7e7e7] transition-all hover:bg-[#2A2C2E] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                <Plus className="size-4 text-[#e7e7e7]/80" />
                <span className="font-medium">Add team</span>
              </div>
              <span className="font-sf_pro_medium text-xs text-[#e7e7e7]/50">
                {state.teams.length} / 64
              </span>
            </button>
          </div>

          <HairlineDivider />

          {/* Teams Scrollable List */}
          <div className="relative h-full flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
            <div className="flex flex-col">
              {filteredTeams.map(team => {
                const isSelected = selectedTeam?.id === team.id
                const initials = (team.tag || team.name || 'TEM').substring(0, 3).toLowerCase()
                return (
                  <div
                    key={team.id}
                    onClick={() => setSelectedTeamId(team.id)}
                    className={`group relative flex cursor-pointer items-center gap-3 overflow-x-visible border-l-2 px-6 py-4 transition-colors hover:bg-white/5 ${
                      isSelected ? 'border-l-primary bg-white/5' : 'border-transparent'
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div
                        className="flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-bold text-[#16181a]"
                        style={{ backgroundColor: team.color || 'rgb(255, 76, 79)' }}
                      >
                        <span>{initials}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="max-w-40">
                          <div className="truncate text-sm font-medium text-[#e7e7e7]">
                            {team.name || 'Untitled Team'}
                          </div>
                        </div>
                        <div className="truncate text-xs text-[#e7e7e7]/50">
                          {team.tag || 'No Tag'}
                        </div>
                      </div>
                      <div className="ml-auto min-w-5 shrink-0 rounded-md bg-[#1A1C1E] px-1.5 py-0.5 text-center">
                        <span className="text-[10px] font-medium text-[#898989]">
                          {team.players?.length || 0}
                        </span>
                      </div>
                    </div>
                    <div className="inline-flex h-0.5 flex-col items-start justify-start absolute bottom-0 left-0 w-full opacity-50">
                      <div className="relative h-px w-full bg-[#101214]" />
                      <div className="relative h-px w-full bg-[#e4e2e7]/5" />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Selected Team Editor */}
        <div className="flex-1 overflow-y-auto p-8" style={{ scrollbarWidth: 'none' }}>
          {selectedTeam ? (
            <div className="max-w-4xl space-y-8">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-medium text-[#e7e7e7]">
                      {selectedTeam.name || 'Untitled Team'}
                    </h2>
                    <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-[#e7e7e7]/60 uppercase">
                      {selectedTeam.tag || 'NO TAG'}
                    </span>
                  </div>
                  <p className="text-sm text-[#e7e7e7]/50">
                    Configure team identification, colors, broadcast logos, and 5-player roster.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmDelete({ type: 'team', teamId: selectedTeam.id })}
                  className="flex size-9 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 transition-colors hover:bg-red-500/20 hover:text-white"
                  title="Delete Team"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              <HairlineDivider />

              {/* General Details Grid */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium uppercase tracking-wider text-[#e7e7e7]/40">
                  Team Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-[#e7e7e7]/50 font-medium">Team Name</label>
                    <div className="relative group squircle-input w-full rounded-lg border border-white/5 bg-[#141618] px-3 py-2 flex items-center shadow-[inset_0px_4px_8px_0px_rgba(0,0,0,0.05)]">
                      <input
                        className="w-full bg-transparent text-sm text-[#e7e7e7] outline-none placeholder:opacity-40"
                        placeholder="Team Name"
                        value={selectedTeam.name}
                        onChange={e => updateTeam(selectedTeam.id, { name: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Tag */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-[#e7e7e7]/50 font-medium">Team Tag</label>
                    <div className="relative group squircle-input w-full rounded-lg border border-white/5 bg-[#141618] px-3 py-2 flex items-center shadow-[inset_0px_4px_8px_0px_rgba(0,0,0,0.05)]">
                      <input
                        className="w-full bg-transparent text-sm text-[#e7e7e7] outline-none placeholder:opacity-40"
                        placeholder="Tag (e.g. T1)"
                        value={selectedTeam.tag}
                        onChange={e => updateTeam(selectedTeam.id, { tag: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Color 1 */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-[#e7e7e7]/50 font-medium">Primary Color</label>
                    <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-[#141618] p-1.5">
                      <input
                        type="color"
                        value={selectedTeam.color || '#ff4c4f'}
                        onChange={e => updateTeam(selectedTeam.id, { color: e.target.value })}
                        className="size-7 cursor-pointer rounded border-0 bg-transparent"
                      />
                      <input
                        className="w-full bg-transparent font-mono text-xs text-[#e7e7e7] outline-none"
                        value={selectedTeam.color || '#ff4c4f'}
                        onChange={e => updateTeam(selectedTeam.id, { color: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Color 2 */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-[#e7e7e7]/50 font-medium">Secondary Color</label>
                    <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-[#141618] p-1.5">
                      <input
                        type="color"
                        value={selectedTeam.color2 || '#3b82f6'}
                        onChange={e => updateTeam(selectedTeam.id, { color2: e.target.value })}
                        className="size-7 cursor-pointer rounded border-0 bg-transparent"
                      />
                      <input
                        className="w-full bg-transparent font-mono text-xs text-[#e7e7e7] outline-none"
                        value={selectedTeam.color2 || '#3b82f6'}
                        onChange={e => updateTeam(selectedTeam.id, { color2: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <HairlineDivider />

              {/* Logos Section */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-medium uppercase tracking-wider text-[#e7e7e7]/40">
                    Team Logos
                  </h3>
                  <p className="text-xs text-[#e7e7e7]/50">
                    Uploaded logos are rendered in HUD broadcast overlays and camera feed lower thirds.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Primary', key: 'logoUrl', val: selectedTeam.logoUrl },
                    { label: 'Secondary', key: 'logoSecondaryUrl', val: selectedTeam.logoSecondaryUrl },
                    { label: 'Tertiary', key: 'logoTertiaryUrl', val: selectedTeam.logoTertiaryUrl },
                  ].map(item => (
                    <label
                      key={item.label}
                      className="group relative flex h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#2B2D2E] bg-white/[0.02] p-4 transition-colors hover:border-[#4ea3fe] hover:bg-white/[0.04]"
                    >
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (file) {
                            if (file.size > 5_000_000) {
                              showToast('Logo too large — use an image under 5 MB')
                              return
                            }
                            // Store as a compressed data URL (canvas-resized to
                            // ≤512px): blob: URLs die on reload and never resolve
                            // in the OBS popout, and raw base64 of large files
                            // blows the 5MB localStorage quota (logos then never
                            // persist → "broken logos in OBS").
                            const reader = new FileReader()
                            reader.onload = () => {
                              const img = new Image()
                              img.onload = () => {
                                try {
                                  const max = 512
                                  const scale = Math.min(1, max / Math.max(img.width, img.height))
                                  const canvas = document.createElement('canvas')
                                  canvas.width = Math.max(1, Math.round(img.width * scale))
                                  canvas.height = Math.max(1, Math.round(img.height * scale))
                                  canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height)
                                  const dataUrl = canvas.toDataURL('image/png')
                                  updateTeam(selectedTeam.id, { [item.key]: dataUrl })
                                  showToast(`${item.label} logo updated`)
                                } catch {
                                  showToast('Failed to process logo image')
                                }
                              }
                              img.onerror = () => showToast('Failed to read logo file')
                              img.src = String(reader.result)
                            }
                            reader.onerror = () => showToast('Failed to read logo file')
                            reader.readAsDataURL(file)
                          }
                        }}
                      />
                      {item.val ? (
                        <div className="relative flex size-full items-center justify-center p-2">
                          <img src={item.val} alt="" className="max-h-full max-w-full object-contain" />
                          <button
                            type="button"
                            onClick={e => {
                              e.preventDefault()
                              updateTeam(selectedTeam.id, { [item.key]: '' })
                            }}
                            className="absolute top-1 right-1 rounded bg-black/60 p-1 text-xs text-white hover:bg-red-500"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="flex size-9 items-center justify-center rounded-full bg-[#1b1d1f] transition-transform group-hover:scale-110">
                            <Upload className="size-4 text-[#e7e7e7]/60 group-hover:text-white" />
                          </div>
                          <div className="text-center">
                            <div className="text-sm font-medium text-[#e7e7e7]">{item.label}</div>
                            <div className="text-[11px] text-[#e7e7e7]/40">Click to upload</div>
                          </div>
                        </>
                      )}
                    </label>
                  ))}
                </div>
              </div>

              <HairlineDivider />

              {/* Players Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium uppercase tracking-wider text-[#e7e7e7]/40">
                      Roster ({selectedTeam.players.length}/5)
                    </h3>
                    <p className="text-xs text-[#e7e7e7]/50">
                      Manage player Riot IDs, overlay aliases, and webcam assignment.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={copyWebcamLinks}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-[#e7e7e7] hover:bg-white/10"
                    >
                      <Copy className="size-3.5 text-[#e7e7e7]/60" />
                      Copy Webcam Links
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedTeam.players.length < 5) {
                          addPlayer(selectedTeam.id)
                          showToast('Player added')
                        }
                      }}
                      disabled={selectedTeam.players.length >= 5}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#4ea3fe] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#3697ff] disabled:opacity-40"
                    >
                      <Plus className="size-3.5" />
                      Add Player
                    </button>
                  </div>
                </div>

                {/* Player Slots */}
                <div className="space-y-3">
                  {selectedTeam.players.map((player, pIdx) => (
                    <div
                      key={player.id}
                      className="flex items-center gap-3 rounded-xl border border-white/5 bg-[#121417] p-3 shadow-[inset_0px_2px_4px_rgba(0,0,0,0.1)]"
                    >
                      {/* Slot index */}
                      <span className="w-5 text-center font-mono text-xs text-[#e7e7e7]/40">
                        #{pIdx + 1}
                      </span>

                      {/* Avatar box */}
                      <label className="flex size-9 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-[#2B2D2F] bg-white/[0.02] hover:border-[#4ea3fe]">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0]
                            if (file) {
                              const fakeUrl = URL.createObjectURL(file)
                              updatePlayer(selectedTeam.id, player.id, { photoUrl: fakeUrl })
                            }
                          }}
                        />
                        {player.photoUrl ? (
                          <img src={player.photoUrl} alt="" className="size-full object-cover" />
                        ) : (
                          <Upload className="size-3.5 text-[#e7e7e7]/40" />
                        )}
                      </label>

                      {/* Riot ID */}
                      <div className="flex-1">
                        <input
                          className="w-full rounded-lg border border-white/5 bg-[#181a1d] px-3 py-2 text-xs text-[#e7e7e7] outline-none placeholder:text-[#e7e7e7]/30"
                          placeholder="Riot ID / Ingame ID"
                          value={player.riotId}
                          onChange={e => updatePlayer(selectedTeam.id, player.id, { riotId: e.target.value })}
                        />
                      </div>

                      {/* Alias */}
                      <div className="w-32">
                        <input
                          className="w-full rounded-lg border border-white/5 bg-[#181a1d] px-3 py-2 text-xs text-[#e7e7e7] outline-none placeholder:text-[#e7e7e7]/30"
                          placeholder="Alias"
                          value={player.alias}
                          onChange={e => updatePlayer(selectedTeam.id, player.id, { alias: e.target.value })}
                        />
                      </div>

                      {/* Webcam Source Popover Trigger */}
                      <button
                        type="button"
                        onClick={() => setActiveWebcamPlayer({ teamId: selectedTeam.id, player })}
                        className="flex w-36 items-center justify-between rounded-lg border border-white/5 bg-[#181a1d] px-3 py-2 text-xs text-[#e7e7e7] hover:bg-[#202327] transition-colors cursor-pointer"
                      >
                        <span className="truncate">
                          {player.webcamSource === 'External Webcam' ? 'External' : 'Internal'}
                        </span>
                        <ChevronDown className="size-3.5 text-white/40" />
                      </button>

                      {/* Delete Player Button */}
                      <button
                        type="button"
                        onClick={() => setConfirmDelete({ type: 'player', teamId: selectedTeam.id, playerId: player.id })}
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-red-400 opacity-60 transition-opacity hover:opacity-100"
                        title="Remove player"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ))}

                  {selectedTeam.players.length === 0 && (
                    <div className="rounded-xl border border-dashed border-white/5 p-6 text-center text-xs text-[#e7e7e7]/40">
                      No players added yet. Click &quot;Add Player&quot; to assign roster members.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[#e7e7e7]/40">
              Select a team from the left sidebar or click &quot;Add team&quot; to begin.
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <ConfirmDialog
          open={!!confirmDelete}
          title={`Delete ${confirmDelete.type === 'team' ? 'Team' : 'Player'}?`}
          message={`Are you sure you want to delete this ${confirmDelete.type}? This action cannot be undone.`}
          onConfirm={executeDelete}
          onCancel={() => setConfirmDelete(null)}
          destructive
        />
      )}

      {/* Webcam Source Popover */}
      {activeWebcamPlayer && (
        <WebcamSourcePopover
          playerName={activeWebcamPlayer.player.alias || activeWebcamPlayer.player.riotId}
          currentSource={activeWebcamPlayer.player.webcamSource}
          onSave={(source) => {
            updatePlayer(activeWebcamPlayer.teamId, activeWebcamPlayer.player.id, {
              webcamSource: source,
            })
            showToast(`Webcam source set to ${source === 'External Webcam' ? 'External' : 'Internal'}`)
          }}
          onClose={() => setActiveWebcamPlayer(null)}
        />
      )}
    </div>
  )
}
