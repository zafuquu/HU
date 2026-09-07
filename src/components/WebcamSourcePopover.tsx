import { useState } from 'react'
import { Link, X } from 'lucide-react'

interface WebcamSourcePopoverProps {
  playerName?: string
  currentSource: 'Internal Webcam' | 'External Webcam' | 'None'
  streamUrl?: string
  onSave: (source: 'Internal Webcam' | 'External Webcam' | 'None', streamUrl?: string) => void
  onClose: () => void
}

export function WebcamSourcePopover({
  playerName,
  currentSource,
  streamUrl = '',
  onSave,
  onClose,
}: WebcamSourcePopoverProps) {
  const [activeTab, setActiveTab] = useState<'Internal' | 'External'>(
    currentSource === 'External Webcam' ? 'External' : 'Internal'
  )
  const [url, setUrl] = useState(streamUrl)

  const handleTabChange = (tab: 'Internal' | 'External') => {
    setActiveTab(tab)
    onSave(tab === 'Internal' ? 'Internal Webcam' : 'External Webcam', url)
  }

  const handleUrlChange = (val: string) => {
    setUrl(val)
    onSave('External Webcam', val)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="relative z-50 w-80 rounded-md border border-[#202224] bg-[#16171a] p-0 text-[#e7e7e7] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-full">
          {/* Header */}
          <div className="p-4 pb-2">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-medium text-[#e7e7e7]">
                Webcam Source {playerName ? `· ${playerName}` : ''}
              </h4>
              <button
                type="button"
                onClick={onClose}
                className="text-[#e7e7e7]/40 hover:text-white transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Tablist */}
            <div
              role="tablist"
              className="h-10 w-full grid grid-cols-2 items-center justify-center rounded-md bg-[#121417] p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'Internal'}
                onClick={() => handleTabChange('Internal')}
                className={`inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium transition-all cursor-pointer ${
                  activeTab === 'Internal'
                    ? 'bg-[#202224] text-white shadow-sm font-semibold'
                    : 'text-[#e7e7e7]/50 hover:text-[#e7e7e7]'
                }`}
              >
                Internal
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'External'}
                onClick={() => handleTabChange('External')}
                className={`inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium transition-all cursor-pointer ${
                  activeTab === 'External'
                    ? 'bg-[#202224] text-white shadow-sm font-semibold'
                    : 'text-[#e7e7e7]/50 hover:text-[#e7e7e7]'
                }`}
              >
                External
              </button>
            </div>
          </div>

          {/* Hairline Divider */}
          <div className="inline-flex h-0.5 w-full flex-col items-start justify-start">
            <div className="relative h-px w-full bg-[#101214]" />
            <div className="relative h-px w-full bg-[#e4e2e7]/5" />
          </div>

          {/* Tab Panel Content */}
          <div className="space-y-4 p-4">
            {activeTab === 'Internal' ? (
              <div className="rounded-md bg-[#2A2D31]/50 p-3">
                <p className="text-xs text-[#e7e7e7]/70">
                  The player will connect via the team invite link.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-xs font-medium text-[#e7e7e7]/70">
                    <Link className="size-3 text-[#e7e7e7]/60" />
                    Stream/Video URL
                  </label>
                  <div className="relative w-full">
                    <input
                      className="w-full rounded-md border border-white/10 bg-[#121417] px-3 py-2 text-xs text-white placeholder:text-white/30 outline-none focus:border-[#4ea3fe]"
                      placeholder="e.g. https://vdo.ninja"
                      value={url}
                      onChange={e => handleUrlChange(e.target.value)}
                    />
                  </div>
                </div>

                <div className="rounded-md border border-yellow-500/20 bg-yellow-500/10 p-3">
                  <p className="text-xs text-yellow-200/80">
                    Note: Artificial delays are not supported for external sources.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
export default WebcamSourcePopover
