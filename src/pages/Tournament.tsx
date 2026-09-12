import { useState } from 'react'
import { Plus, Trash2, ChevronDown, Upload, Maximize2 } from 'lucide-react'
import { useAppStore } from '../store/AppContext'
import ConfirmDialog from '../components/ConfirmDialog'

const TEAM_COUNT_OPTIONS = ['2 Teams', '4 Teams', '8 Teams', '16 Teams', '32 Teams']
const FORMAT_OPTIONS = ['Single Elimination', 'Double Elimination', 'Round Robin', 'Swiss']

const CstmPenIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg" className="fill-current scale-110" color="currentColor">
    <path d="M7.73833 0.333008C7.82656 0.333027 7.91119 0.368029 7.97366 0.430342L9.85966 2.31634C9.92215 2.37885 9.95725 2.46362 9.95725 2.55201C9.95725 2.6404 9.92215 2.72517 9.85966 2.78768L3.73099 8.91568C3.68913 8.95748 3.6369 8.98739 3.57966 9.00234L1.02766 9.66901C0.971405 9.68368 0.912293 9.68338 0.856189 9.66815C0.800086 9.65292 0.748941 9.62327 0.707834 9.58217C0.666726 9.54106 0.637084 9.48992 0.62185 9.43381C0.606616 9.37771 0.606321 9.31859 0.620992 9.26234L1.28766 6.71034C1.30261 6.6531 1.33252 6.60087 1.37433 6.55901L7.50233 0.430342C7.53334 0.399407 7.57014 0.374888 7.61064 0.358187C7.65113 0.341486 7.69452 0.33293 7.73833 0.333008ZM0.666992 10.833C0.534384 10.833 0.407207 10.8857 0.313439 10.9795C0.219671 11.0732 0.166992 11.2004 0.166992 11.333C0.166992 11.4656 0.219671 11.5928 0.313439 11.6866C0.407207 11.7803 0.534384 11.833 0.666992 11.833H10.667C10.7996 11.833 10.9268 11.7803 11.0205 11.6866C11.1143 11.5928 11.167 11.4656 11.167 11.333C11.167 11.2004 11.1143 11.0732 11.0205 10.9795C10.9268 10.8857 10.7996 10.833 10.667 10.833H0.666992Z" />
  </svg>
)

const HairlineDivider = () => (
  <div className="inline-flex h-0.5 w-full flex-col items-start justify-start">
    <div className="relative h-px w-full bg-[#101214]" />
    <div className="relative h-px w-full bg-[#e4e2e7]/5" />
  </div>
)

export default function Tournament() {
  const { state, setState, addSponsor, deleteSponsor, updateSponsor, showToast } = useAppStore()
  const [confirmDeleteSponsorId, setConfirmDeleteSponsorId] = useState<string | null>(null)
  const [autoUpdateRankings, setAutoUpdateRankings] = useState(false)

  const updateRankingsTeam = (idx: number, teamId: string) => {
    setState(prev => {
      const nextRankings = [...prev.rankings]
      if (nextRankings[idx]) {
        nextRankings[idx] = { ...nextRankings[idx], teamId }
      } else {
        nextRankings.push({ teamId, rank: idx + 1, wins: 0, losses: 0 })
      }
      return { ...prev, rankings: nextRankings }
    })
  }

  const updateRankingsScore = (idx: number, field: 'wins' | 'losses', val: number) => {
    setState(prev => {
      const nextRankings = [...prev.rankings]
      if (nextRankings[idx]) {
        nextRankings[idx] = { ...nextRankings[idx], [field]: val }
      }
      return { ...prev, rankings: nextRankings }
    })
  }

  const removeRankingsRow = (idx: number) => {
    setState(prev => ({
      ...prev,
      rankings: prev.rankings.filter((_, i) => i !== idx),
    }))
    showToast('Ranking row removed')
  }

  const addRankingsRow = () => {
    const used = new Set(state.rankings.map(r => r.teamId))
    const available = state.teams.filter(t => !used.has(t.id))
    const nextTeam = available[0] || state.teams[0]
    if (!nextTeam) return showToast('No teams available')
    setState(prev => ({
      ...prev,
      rankings: [...prev.rankings, { teamId: nextTeam.id, rank: prev.rankings.length + 1, wins: 0, losses: 0 }],
    }))
    showToast('Rankings row added')
  }

  return (
    <div className="size-full overflow-y-auto p-8 text-white" style={{ scrollbarWidth: 'none' }}>
      <div className="max-w-5xl space-y-14">
        {/* Section 1: Tournament Details */}
        <div className="space-y-8">
          <div className="space-y-2">
            <h2 className="text-base font-medium text-[#e7e7e7]">Tournament details</h2>
            <p className="text-sm text-[#e7e7e7]/50">Edit your tournament details that will be visible on the overlay</p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs text-[#e7e7e7]/50 font-medium">Tournament Name</label>
              <div className="relative group squircle-input w-full rounded-lg border border-white/5 bg-[#141618] px-3 py-2 flex items-center shadow-[inset_0px_4px_8px_0px_rgba(0,0,0,0.05)]">
                <input
                  className="w-full bg-transparent text-sm text-[#e7e7e7] outline-none placeholder:opacity-40"
                  placeholder="Tournament name"
                  value={state.tournamentName1}
                  onChange={e => setState(p => ({ ...p, tournamentName1: e.target.value }))}
                />
              </div>
            </div>

            {/* Region */}
            <div className="space-y-1.5">
              <label className="text-xs text-[#e7e7e7]/50 font-medium">Tournament Region</label>
              <div className="relative group squircle-input w-full rounded-lg border border-white/5 bg-[#141618] px-3 py-2 flex items-center shadow-[inset_0px_4px_8px_0px_rgba(0,0,0,0.05)]">
                <input
                  className="w-full bg-transparent text-sm text-[#e7e7e7] outline-none placeholder:opacity-40"
                  placeholder="Tournament Region (e.g. NA, EMEA)"
                  value={state.tournamentRegion || ''}
                  onChange={e => setState(p => ({ ...p, tournamentRegion: e.target.value }))}
                />
              </div>
            </div>

            {/* Language */}
            <div className="space-y-1.5">
              <label className="text-xs text-[#e7e7e7]/50 font-medium">Language</label>
              <div className="relative group squircle-input w-full rounded-lg border border-white/5 bg-[#141618] px-3 py-2 flex items-center shadow-[inset_0px_4px_8px_0px_rgba(0,0,0,0.05)]">
                <input
                  className="w-full bg-transparent text-sm text-[#e7e7e7] outline-none placeholder:opacity-40"
                  placeholder="Language of Tournament/Broadcast"
                  value={state.tournamentLanguage}
                  onChange={e => setState(p => ({ ...p, tournamentLanguage: e.target.value }))}
                />
              </div>
            </div>

            {/* Number of Teams */}
            <div className="space-y-1.5">
              <label className="text-xs text-[#e7e7e7]/50 font-medium">Number of Teams</label>
              <div className="relative">
                <select
                  className="w-full appearance-none rounded-lg border border-white/5 bg-[#141618] px-3 py-2 text-sm text-[#e7e7e7] outline-none"
                  value={`${state.teamCount} Teams`}
                  onChange={e => setState(p => ({ ...p, teamCount: parseInt(e.target.value) || 2 }))}
                >
                  {TEAM_COUNT_OPTIONS.map(opt => (
                    <option key={opt} value={opt} className="bg-[#181a1d] text-white">
                      {opt}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-white/40" />
              </div>
            </div>

            {/* Format */}
            <div className="space-y-1.5">
              <label className="text-xs text-[#e7e7e7]/50 font-medium">Tournament format</label>
              <div className="relative">
                <select
                  className="w-full appearance-none rounded-lg border border-white/5 bg-[#141618] px-3 py-2 text-sm text-[#e7e7e7] outline-none"
                  value={state.tournamentFormat}
                  onChange={e => setState(p => ({ ...p, tournamentFormat: e.target.value }))}
                >
                  {FORMAT_OPTIONS.map(opt => (
                    <option key={opt} value={opt} className="bg-[#181a1d] text-white">
                      {opt}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-white/40" />
              </div>
            </div>
          </div>
        </div>

        <HairlineDivider />

        {/* Section 2: Tournament Logos */}
        <div className="space-y-8">
          <div className="space-y-2">
            <h2 className="text-base font-medium text-[#e7e7e7]">Tournament logos</h2>
            <p className="text-sm text-[#e7e7e7]/50">HAVOC UNLEASH will automatically use the primary logo for any empty uploads</p>
          </div>

          <div className="grid grid-cols-4 gap-6">
            {['Primary', 'Secondary', 'Tertiary', 'Outline'].map((label, i) => {
              const currentUrl = state.tournamentLogoUrls[i] || ''
              return (
                <label
                  key={label}
                  className="group relative flex h-[242px] cursor-pointer flex-col items-center justify-center gap-6 rounded-3xl p-6 shadow transition-all duration-300 hover:bg-white/[0.03]"
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
                        // Persist as a compressed data URL — blob: URLs die on refresh
                        // ("uploaded the tournament logo, refreshed, it's gone").
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
                              setState(p => {
                                const urls = [...p.tournamentLogoUrls]
                                urls[i] = dataUrl
                                return { ...p, tournamentLogoUrls: urls }
                              })
                              showToast(`${label} logo uploaded`)
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
                  {/* Dashed background overlay */}
                  <div
                    className="pointer-events-none absolute inset-0 rounded-3xl border-2 border-dashed border-[#2B2D2E] transition-colors group-hover:border-[#4EA3FE]"
                  />

                  {currentUrl ? (
                    <div className="relative z-10 flex size-full items-center justify-center p-4">
                      <img src={currentUrl} alt="" className="max-h-full max-w-full object-contain" />
                      <button
                        type="button"
                        onClick={e => {
                          e.preventDefault()
                          setState(p => {
                            const urls = [...p.tournamentLogoUrls]
                            urls[i] = ''
                            return { ...p, tournamentLogoUrls: urls }
                          })
                        }}
                        className="absolute top-2 right-2 rounded-full bg-black/70 p-1 text-xs text-white hover:bg-red-500"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="pointer-events-none relative z-10 flex flex-col items-center gap-4 text-center">
                      <div className="flex size-11 items-center justify-center rounded-full bg-[#16181b] p-3 transition-transform group-hover:scale-110">
                        <Upload className="size-5 text-[#e7e7e7]/50 group-hover:text-white" />
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="text-base font-medium tracking-wide text-[#e7e7e7]">{label}</div>
                        <div className="mt-1 text-xs text-[#e7e7e7]/50">Click to browse, paste, or drop</div>
                      </div>
                    </div>
                  )}
                </label>
              )
            })}
          </div>
        </div>

        <HairlineDivider />

        {/* Section 3: Tournament Sponsors */}
        <div className="space-y-8 pb-0">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <h2 className="text-base font-medium text-[#e7e7e7]">Tournament sponsors</h2>
              <p className="text-sm text-[#e7e7e7]/50">Sponsors will appear in the sponsor sections of the designs</p>
            </div>
            <button
              type="button"
              onClick={() => {
                addSponsor()
                showToast('Sponsor added')
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-[#e7e7e7] transition-colors hover:bg-white/10"
            >
              <Plus className="size-4" />
              Add sponsor
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {state.sponsors.map(sponsor => (
              <div key={sponsor.id} className="space-y-5 rounded-2xl border border-[#e7e7e7]/5 bg-[#121417] p-4">
                {/* Top Row: Thumbnail + Resolution + Default + Delete */}
                <div className="flex items-center justify-between">
                  <div className="relative">
                    <label className="relative flex size-14 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-[#e7e7e7]/5 bg-white/[0.02] p-0.5 transition-opacity hover:opacity-80">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (file) {
                            const fakeUrl = URL.createObjectURL(file)
                            updateSponsor(sponsor.id, { imageUrl: fakeUrl })
                          }
                        }}
                      />
                      {sponsor.imageUrl ? (
                        <img src={sponsor.imageUrl} alt="" className="size-full object-contain" />
                      ) : (
                        <Upload className="size-5 text-[#e7e7e7]/40" />
                      )}
                    </label>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 font-mono text-[10px] text-white">
                      <Maximize2 className="size-3" />
                      1624x873
                    </div>
                    {sponsor.isDefault ? (
                      <span className="rounded-md border border-[#e7e7e7]/10 bg-[#e7e7e7]/5 px-2 py-1 text-xs text-[#e7e7e7]/60">
                        Default
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteSponsorId(sponsor.id)}
                      className="flex size-8 items-center justify-center rounded-lg text-red-400 opacity-60 transition-opacity hover:opacity-100 hover:text-red-300"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>

                {/* Bottom Row: Name input + Sponsor Type Dropdown */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <div className="relative group squircle-input w-full rounded-lg border border-white/5 bg-[#181a1d] px-3 py-2 flex items-center">
                      <input
                        className="w-full bg-transparent text-xs text-[#e7e7e7] outline-none placeholder:opacity-40"
                        placeholder="Sponsor name"
                        value={sponsor.name}
                        onChange={e => updateSponsor(sponsor.id, { name: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="relative w-40">
                    <select
                      className="w-full appearance-none rounded-lg border border-white/5 bg-[#181a1d] px-3 py-2 text-xs text-[#e7e7e7] outline-none"
                      value={sponsor.type}
                      onChange={e => updateSponsor(sponsor.id, { type: e.target.value })}
                    >
                      <option value="Main Sponsor" className="bg-[#181a1d] text-white">Main Sponsor</option>
                      <option value="Secondary Sponsor" className="bg-[#181a1d] text-white">Secondary Sponsor</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-white/40" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <HairlineDivider />

        {/* Section 4: Team Rankings */}
        <div className="space-y-8 pb-0">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <h2 className="text-base font-medium text-[#e7e7e7]">Team Rankings</h2>
              <p className="text-sm text-[#e7e7e7]/50">Update team standings and match results in the tournament</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={addRankingsRow}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-[#e7e7e7] hover:bg-white/10"
              >
                <Plus className="size-3.5" />
                Add team
              </button>
              <div className="flex items-center gap-3 rounded-lg border border-[#2B2D2F] bg-[#E7E7E7]/5 px-3 py-1.5">
                <span className="text-xs text-[#E7E7E7]">Auto Update</span>
                <button
                  type="button"
                  role="switch"
                  onClick={() => setAutoUpdateRankings(!autoUpdateRankings)}
                  className={`relative inline-flex h-5 w-8 items-center rounded-md border border-[#e7e7e7]/5 p-[3px] shadow-inner transition-colors ${
                    autoUpdateRankings ? 'bg-[#4ea3fe]' : 'bg-[#1b1d1f]'
                  }`}
                >
                  <span
                    className={`size-3.5 rounded-[3px] bg-white shadow-sm transition-transform ${
                      autoUpdateRankings ? 'translate-x-3' : '-translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="overflow-hidden rounded-xl border border-[#202224]">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#202224] bg-[#1B1D1F] text-xs font-medium text-[#818283]">
                <tr>
                  <th className="h-10 border-r border-[#202224] px-4 font-medium text-[#e7e7e7]">
                    Team Name<span className="ml-1 text-red-500">*</span>
                  </th>
                  <th className="h-10 w-28 border-r border-[#202224] px-4 font-medium text-[#e7e7e7]">Wins</th>
                  <th className="h-10 w-28 border-r border-[#202224] px-4 font-medium text-[#e7e7e7]">Losses</th>
                  <th className="h-10 w-16 border-r border-[#202224]" />
                  <th className="h-10 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#202224]">
                {state.rankings.map((row, idx) => {
                  const team = state.teams.find(t => t.id === row.teamId) || state.teams[idx]
                  return (
                    <tr key={row.teamId || idx} className="h-[65px] transition-colors hover:bg-white/[0.02]">
                      {/* Team Selector */}
                      <td className="border-r border-[#202224] px-3">
                        <div className="relative flex items-center gap-2">
                          <div
                            className="flex size-9 shrink-0 items-center justify-center rounded-md text-xs font-bold text-[#16181a]"
                            style={{ backgroundColor: team?.color || 'rgb(255, 76, 79)' }}
                          >
                            {(team?.tag || team?.name || 'TEM').substring(0, 3).toLowerCase()}
                          </div>
                          <div className="relative flex-1">
                            <select
                              className="w-full appearance-none rounded-lg border-0 bg-transparent px-2 py-1 text-sm font-medium text-[#e7e7e7] outline-none"
                              value={row.teamId}
                              onChange={e => updateRankingsTeam(idx, e.target.value)}
                            >
                              {state.teams.map(t => (
                                <option key={t.id} value={t.id} className="bg-[#181a1d] text-white">
                                  {t.name}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-white/40" />
                          </div>
                        </div>
                      </td>

                      {/* Wins Input */}
                      <td className="border-r border-[#202224] p-0">
                        <input
                          type="number"
                          min="0"
                          value={row.wins ?? 0}
                          onChange={e => updateRankingsScore(idx, 'wins', parseInt(e.target.value) || 0)}
                          className="size-full bg-transparent px-4 py-3 text-sm text-[#e7e7e7] outline-none transition-colors hover:bg-white/5 focus:bg-white/5"
                        />
                      </td>

                      {/* Losses Input */}
                      <td className="border-r border-[#202224] p-0">
                        <input
                          type="number"
                          min="0"
                          value={row.losses ?? 0}
                          onChange={e => updateRankingsScore(idx, 'losses', parseInt(e.target.value) || 0)}
                          className="size-full bg-transparent px-4 py-3 text-sm text-[#e7e7e7] outline-none transition-colors hover:bg-white/5 focus:bg-white/5"
                        />
                      </td>

                      {/* Delete Row Button */}
                      <td className="border-r border-[#202224] p-0 text-center">
                        <button
                          type="button"
                          onClick={() => removeRankingsRow(idx)}
                          className="flex size-full items-center justify-center text-red-500 hover:bg-white/5"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>

                      {/* Pen Edit Button */}
                      <td className="p-0 text-center">
                        <button
                          type="button"
                          className="flex size-full items-center justify-center hover:bg-white/5"
                        >
                          <div className="flex size-[26px] items-center justify-center rounded-[4px] bg-[#0F1112] text-white/60 hover:border hover:border-[#4EA3FE]/20 hover:bg-[#4EA3FE]/10 hover:text-[#4EA3FE]">
                            <CstmPenIcon />
                          </div>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Delete Sponsor Modal */}
      {confirmDeleteSponsorId && (
        <ConfirmDialog
          open={!!confirmDeleteSponsorId}
          title="Delete Sponsor?"
          message="Are you sure you want to remove this sponsor?"
          onConfirm={() => {
            deleteSponsor(confirmDeleteSponsorId)
            setConfirmDeleteSponsorId(null)
            showToast('Sponsor removed')
          }}
          onCancel={() => setConfirmDeleteSponsorId(null)}
          destructive
        />
      )}
    </div>
  )
}
