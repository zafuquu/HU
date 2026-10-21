import React from 'react'

interface MapSlot {
  mapName: string
  image: string
  kind: string
  side?: 'Defense' | 'Offense'
  team?: string
}

interface MapBanSceneProps {
  leftTeamName?: string
  rightTeamName?: string
  leftTeamColor?: string
  rightTeamColor?: string
  showTitle?: boolean
  showSideLabels?: boolean
  showFooter?: boolean
  mapBans?: { mapId: string; mapName: string; image: string }[]
  mapPicks?: { mapId: string; mapName: string; image: string }[]
  mapDecider?: { mapId: string; mapName: string; image: string }
  mapSlots?: MapSlot[]
  leftTeamLogo?: string | null
  rightTeamLogo?: string | null
  activeComponentId?: string | null
  onSelectComponent?: (id: string) => void
  isToggled?: (componentId: string) => boolean
}

// The classic VAL Map Ban layout is 5 card racks. When a short veto is used we
// only render the constantly-positioned racks that actually hold a resolved
// slot (mapName non-empty) so unused containers stay hidden.
function VetoCard({
  slot,
  index,
  leftTeamLogo,
  rightTeamLogo,
}: {
  slot: MapSlot
  index: number
  leftTeamLogo: string | null
  rightTeamLogo: string | null
}) {
  const isBan = slot.kind === 'ban'
  const isPick = slot.kind === 'pick'
  const isDecider = slot.kind === 'decider'
  const left = 240 + index * 228
  const teamLogo = slot.team === 'TEAM_B' ? rightTeamLogo : leftTeamLogo
  const sideAbbr = slot.side === 'Offense' ? 'ATK' : slot.side === 'Defense' ? 'DEF' : null
  return (
    <div
      style={{
        left: `${left}px`,
        position: 'absolute',
        top: '345px',
        width: '228px',
        // Veto replay: each rack card reveals in veto order (ban → pick →
        // decider) every time the map-ban scene mounts (overlay + editor).
        animation: 'mvCardIn 480ms cubic-bezier(0.22, 1, 0.36, 1) both',
        animationDelay: `${index * 160}ms`,
      } as React.CSSProperties}
    >
      <div className="absolute top-0 flex w-full flex-col items-start px-2" style={{ visibility: 'visible' } as React.CSSProperties}>
        {/* Header */}
        <div className="mb-[7px] flex h-[calc(62px+36px)] w-full flex-col items-start overflow-hidden">
          <div
            className="card-header-text relative mb-0 h-[62px] w-full font-schabo text-[40px] leading-none break-words text-[#F5F5F5] uppercase"
            style={{ opacity: '1', transform: 'translateY(0px)' } as React.CSSProperties}
          >
            <div className="grid size-full translate-y-0 grid-cols-1 grid-rows-1 items-center">
              <div className="header-pending col-start-1 row-start-1 w-full opacity-0" style={{ display: 'none' }}>
                {isDecider ? (
                  <div className="auto-scaler-wrapper size-full" style={{ overflow: 'visible', position: 'relative' } as React.CSSProperties}>
                    <div className="auto-scaler-container" style={{ maxWidth: '100%', overflow: 'visible', width: '100%' } as React.CSSProperties}>
                      <div className="auto-scaler-content min-w-full h-full whitespace-nowrap" style={{ left: '50%', overflow: 'visible', position: 'absolute', top: '50%', transform: 'scale(1) translate(-50%, -50%)', transformOrigin: 'left top' } as React.CSSProperties}>
                        <h1>{slot.mapName}</h1>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="auto-scaler-wrapper flex h-9 w-full items-center justify-around" style={{ overflow: 'visible', position: 'relative' } as React.CSSProperties}>
                    <div className="auto-scaler-container" style={{ maxWidth: '100%', overflow: 'visible', width: '100%' } as React.CSSProperties}>
                      <div className="auto-scaler-content min-w-full h-full whitespace-nowrap" style={{ left: '50%', overflow: 'visible', position: 'absolute', top: '50%', transform: 'scale(1) translate(-50%, -50%)', transformOrigin: 'left top' } as React.CSSProperties}>
                        {teamLogo ? <img alt={slot.team === 'TEAM_B' ? 'right' : 'left'} className="h-full object-contain" src={teamLogo} /> : null}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="header-resolved col-start-1 row-start-1 w-full opacity-100" style={{ opacity: '1', transform: 'translateX(0px)' } as React.CSSProperties}>
                <h1>{slot.mapName}</h1>
              </div>
            </div>
          </div>
          {/* Sub label */}
          <div className="card-sub-text flex h-9 w-full flex-col justify-center" style={{ opacity: '1', transform: 'translateX(0%)' } as React.CSSProperties}>
            <div className="font-medium grid size-full grid-cols-1 grid-rows-1 font-mussels text-[20px] text-[#F5F5F5] uppercase">
              <div className="sub-pending col-start-1 row-start-1 flex w-full items-center opacity-0" style={{ display: 'none' }}>
                <div className="auto-scaler-wrapper size-full whitespace-nowrap" style={{ overflow: 'visible', position: 'relative' } as React.CSSProperties}>
                  <div className="auto-scaler-container" style={{ maxWidth: '100%', overflow: 'visible', width: '100%' } as React.CSSProperties}>
                    <div className="auto-scaler-content relative flex h-full min-w-full items-center justify-start" style={{ left: '50%', overflow: 'visible', position: 'absolute', top: '50%', transform: 'scale(1) translate(-50%, -50%)', transformOrigin: 'left top' } as React.CSSProperties}>
                      <h2>{isBan ? 'BAN' : isDecider ? 'MAP' : 'PICK'}</h2>
                    </div>
                  </div>
                </div>
              </div>
              <div className="sub-resolved col-start-1 row-start-1 flex w-full items-center opacity-100" style={{ opacity: '1', transform: 'translateX(0px)' } as React.CSSProperties}>
                <div className="auto-scaler-wrapper size-full whitespace-nowrap" style={{ overflow: 'visible', position: 'relative' } as React.CSSProperties}>
                  <div className="auto-scaler-container" style={{ maxWidth: '100%', overflow: 'visible', width: '100%' } as React.CSSProperties}>
                    <div className="auto-scaler-content relative flex h-full min-w-full items-center justify-start" style={{ left: '50%', overflow: 'visible', position: 'absolute', top: '50%', transform: 'scale(1) translate(-50%, -50%)', transformOrigin: 'left top' } as React.CSSProperties}>
                      {isDecider ? (
                        <h2>DECIDER</h2>
                      ) : (
                        <h2>
                          <span className="inline-flex items-center gap-1.5">
                            {teamLogo ? <img alt={slot.team === 'TEAM_B' ? 'right' : 'left'} className="h-[1.1em] object-contain" src={teamLogo} /> : null}
                            {isBan ? 'BANS' : 'PICK'}
                          </span>
                        </h2>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Map image + overlays */}
        <div className="relative h-[386px] w-full">
          <div className="card-background-container relative size-full overflow-hidden bg-[#1a1a1a]" style={{ clipPath: 'inset(0% 0px 0px)' } as React.CSSProperties}>
            <img
              alt={slot.mapName.toLowerCase()}
              className={`card-map-image absolute top-0 left-0 z-1 size-full object-cover${isBan ? ' saturate-0' : ''}`}
              src={slot.image}
              style={{ opacity: '1', transform: 'scale(1)' } as React.CSSProperties}
            />
            <div className="card-overlay absolute top-0 left-0 z-2 size-full" style={{ opacity: '1' } as React.CSSProperties}>
              <div className="absolute z-1 size-full opacity-25" style={{ background: 'linear-gradient(to right, rgb(0, 0, 0) 0%, rgba(0, 0, 0, 0.38) 50%, rgb(0, 0, 0) 100%)' } as React.CSSProperties} />
              <div className="absolute z-2 size-full opacity-50" style={{ background: 'linear-gradient(rgb(0, 0, 0) 0%, rgba(0, 0, 0, 0.38) 50%, rgb(0, 0, 0) 100%)' } as React.CSSProperties} />
              <div className="absolute z-3 size-full" style={{ background: 'linear-gradient(rgba(82, 174, 237, 0.2) 0%, rgba(0, 0, 0, 0.7) 100%)' } as React.CSSProperties} />
            </div>
            {isBan && (
              <div className="card-ban-cross absolute z-5 size-full" style={{ opacity: '1', transform: 'scaleY(1)' } as React.CSSProperties}>
                <div style={{ position: 'absolute', top: '50%', left: '50%', width: '8px', height: '70%', transform: 'translate(-50%, -50%) rotate(45deg)', backgroundColor: '#EAB24E', borderRadius: '4px', boxShadow: '0 0 16px rgba(234,178,78,0.9), 0 2px 10px rgba(0,0,0,0.95)', zIndex: 30 }} />
                <div style={{ position: 'absolute', top: '50%', left: '50%', width: '8px', height: '70%', transform: 'translate(-50%, -50%) rotate(-45deg)', backgroundColor: '#EAB24E', borderRadius: '4px', boxShadow: '0 0 16px rgba(234,178,78,0.9), 0 2px 10px rgba(0,0,0,0.95)', zIndex: 30 }} />
              </div>
            )}

            {!isBan && (
              <div className="card-pick-border absolute inset-0 z-5" style={{ opacity: '1', transform: 'scale(1)' } as React.CSSProperties}>
                <div className="absolute inset-[-3px] border-[2px]" style={{ borderImage: 'linear-gradient(to top, rgb(40, 208, 145) 0%, transparent 50%) 1 / 1 / 0 stretch' } as React.CSSProperties} />
                <div className="pointer-events-none absolute bottom-0 left-0 h-1/3 w-full" style={{ background: 'linear-gradient(to top, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0) 100%)' } as React.CSSProperties} />
                {(isPick || (isDecider && sideAbbr)) && (
                  <div className="pointer-events-none absolute bottom-3 left-0 flex h-5 w-full items-center justify-center px-3 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                    <div className="auto-scaler-wrapper size-full whitespace-nowrap" style={{ overflow: 'visible', position: 'relative' } as React.CSSProperties}>
                      <div className="auto-scaler-container" style={{ maxWidth: '100%', overflow: 'visible', width: '100%' } as React.CSSProperties}>
                        <div className="auto-scaler-content relative flex h-full min-w-full items-center justify-center" style={{ left: '50%', overflow: 'visible', position: 'absolute', top: '50%', transform: 'scale(1) translate(-50%, -50%)', transformOrigin: 'left top' } as React.CSSProperties}>
                          <h1 className="m-0 flex items-center gap-1 font-mussels text-[17px] leading-none font-semibold tracking-[0.02em] uppercase">
                            <span className="inline-flex items-center gap-1 text-[#F5F5F5]">
                              {/* Team logo renders once in the card header — the
                                  footer duplicate (logo + PICK over the map
                                  image) was removed as reported. */}
                              PICK
                            </span>
                            {sideAbbr && <span style={{ color: 'rgb(40, 208, 145)' } as React.CSSProperties}>{sideAbbr}</span>}
                          </h1>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function MapBanScene(props: MapBanSceneProps) {
  const {
    leftTeamColor = '#1DCD9B',
    rightTeamColor = '#FF4848',
    activeComponentId,
    onSelectComponent,
    isToggled = () => true,
    showTitle = true,
    showSideLabels = true,
    showFooter = true, mapBans = [], mapPicks = [], mapDecider = null, mapSlots = [], leftTeamLogo = null, rightTeamLogo = null,
  } = props
  void showFooter
  const allCards = (mapSlots && mapSlots.length ? mapSlots : [...(mapBans || []), ...(mapPicks || []), ...(mapDecider ? [mapDecider] : [])])
  // Only render racks that actually hold a resolved veto card (not empty placeholders).
  const usedCards = allCards.filter(c => c && !!c.mapName)
  return (
    <div
      className="scene-root mv-anim relative size-full min-h-full bg-[#1B1D1F]"
      style={{
        width: 1920,
        height: 1080,
        '--left-team-color': leftTeamColor,
        '--right-team-color': rightTeamColor,
      } as React.CSSProperties}
    >
      {/* Broadcast entrance: staggered reveal of the title, card racks and footer */}
      <style>{`
        @keyframes mvIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
        .mv-anim > * { animation: mvIn 420ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        .mv-anim > *:nth-child(1) { animation-delay: 40ms; }
        .mv-anim > *:nth-child(2) { animation-delay: 120ms; }
        .mv-anim > *:nth-child(3) { animation-delay: 200ms; }
        .mv-anim > *:nth-child(4) { animation-delay: 280ms; }
        .mv-anim > *:nth-child(5) { animation-delay: 360ms; }
        .mv-anim > *:nth-child(n+6) { animation-delay: 440ms; }
        @keyframes mvCardIn { from { opacity: 0; transform: translateY(34px) scale(0.96); } to { opacity: 1; transform: none; } }
      `}</style>
      <div className={`clickable-component cursor-pointer transition-opacity relative size-full overflow-hidden text-[#F5F5F5]${activeComponentId === 'card' ? ' selected' : ''}${isToggled('card') ? '' : ' opacity-50 [&>*]:invisible'}`} data-component-id="card" data-make-transparent="true" onClick={(e) => { e.stopPropagation(); onSelectComponent?.('card'); }}>
        {/* Title */}
        <div className="absolute top-[118px] left-60 flex h-[190px] w-[1575px] flex-col justify-center overflow-hidden" style={!showTitle ? ({ display: 'none' } as React.CSSProperties) : undefined}>
          <div className="flex -translate-y-2 gap-4 font-schabo text-[96px] leading-none uppercase">
            <div className="anim-title-teama flex h-25 items-center gap-2" style={{ opacity: '1', transform: 'translate(0px, 0%)' } as React.CSSProperties}>
              <img alt="" data-cache-status="miss" decoding="sync" loading="eager" className="h-full object-contain" src={(leftTeamLogo && leftTeamLogo.length) ? leftTeamLogo : ''} />
              <div className="overflow-hidden"><h1 className="translate-y-2">{(props as any).leftTeamName || ''}</h1></div>
            </div>
            <div className="anim-title-vs overflow-hidden " style={{ opacity: '1', transform: 'translate(0px, 0%)' } as React.CSSProperties}><h1 className="translate-y-2 lowercase">vs</h1></div>
            <div className="anim-title-teamb flex h-25 items-center gap-2 " style={{ opacity: '1', transform: 'translate(0px, 0%)' } as React.CSSProperties}>
              <img alt="" data-cache-status="miss" decoding="sync" loading="eager" className="h-full object-contain" src={(rightTeamLogo && rightTeamLogo.length) ? rightTeamLogo : ''} />
              <div className="overflow-hidden"><h1 className="translate-y-2">{(props as any).rightTeamName || ''}</h1></div>
            </div>
          </div>
        </div>

        {/* TEAM side label */}
        <div className="absolute top-[82px] left-[105px] flex h-[62px] w-36 flex-col justify-center" style={!showSideLabels ? ({ display: 'none' } as React.CSSProperties) : undefined}>
          <span className="anim-label-team block font-schabo text-[32px] uppercase" style={{ opacity: '100', transform: 'translateY(0px)' } as React.CSSProperties}>
            <span style={{ position: 'absolute', overflow: 'hidden', clip: 'rect(0px, 0px, 0px, 0px)', clipPath: 'inset(0% 0px 0px)', width: '1px', height: '1px', whiteSpace: 'nowrap' } as React.CSSProperties}>TEAM</span>
            <span data-word="0" data-line="0" style={{ display: 'inline-block' } as React.CSSProperties} aria-hidden="true">
              <span data-char="0" data-line="0" data-word="0" style={{ display: 'inline-block', opacity: '1', transform: 'translateX(0vw)' } as React.CSSProperties} aria-hidden="true">T</span>
              <span data-char="1" data-line="0" data-word="0" style={{ display: 'inline-block', opacity: '1', transform: 'translateX(0vw)' } as React.CSSProperties} aria-hidden="true">E</span>
              <span data-char="2" data-line="0" data-word="0" style={{ display: 'inline-block', opacity: '1', transform: 'translateX(0vw)' } as React.CSSProperties} aria-hidden="true">A</span>
              <span data-char="3" data-line="0" data-word="0" style={{ display: 'inline-block', opacity: '1', transform: 'translateX(0vw)' } as React.CSSProperties} aria-hidden="true">M</span>
            </span>
          </span>
        </div>

        {/* MAP side label */}
        <div className="absolute top-[345px] left-[105px] flex h-[62px] w-[97px] flex-col justify-center" style={!showSideLabels ? ({ display: 'none' } as React.CSSProperties) : undefined}>
          <span className="anim-label-map block font-schabo text-[32px] uppercase" style={{ opacity: '100', transform: 'translateY(0px)' } as React.CSSProperties}>
            <span style={{ position: 'absolute', overflow: 'hidden', clip: 'rect(0px, 0px, 0px, 0px)', clipPath: 'inset(0% 0px 0px)', width: '1px', height: '1px', whiteSpace: 'nowrap' } as React.CSSProperties}>MAP</span>
            <span data-word="0" data-line="0" style={{ display: 'inline-block' } as React.CSSProperties} aria-hidden="true">
              <span data-char="0" data-line="0" data-word="0" style={{ display: 'inline-block', opacity: '1', transform: 'translateX(0vw)' } as React.CSSProperties} aria-hidden="true">M</span>
              <span data-char="1" data-line="0" data-word="0" style={{ display: 'inline-block', opacity: '1', transform: 'translateX(0vw)' } as React.CSSProperties} aria-hidden="true">A</span>
              <span data-char="2" data-line="0" data-word="0" style={{ display: 'inline-block', opacity: '1', transform: 'translateX(0vw)' } as React.CSSProperties} aria-hidden="true">P</span>
            </span>
          </span>
        </div>

        {/* Cards - render only the racks that actually hold a resolved veto card */}
        {usedCards.map((slot, i) => (
          <VetoCard
            key={i}
            slot={slot as MapSlot}
            index={i}
            leftTeamLogo={leftTeamLogo}
            rightTeamLogo={rightTeamLogo}
          />
        ))}

        {/* Footer */}
        <div className="absolute top-[890px] right-23 left-[105px] flex h-25 items-end justify-between">
          <div className="h-full w-[47%] items-center gap-6 hidden">
            <div className="flex h-full w-[118px] items-center">
              <span className="anim-label-organiser block font-schabo text-[32px] leading-none text-[#F5F5F5] uppercase" style={{ opacity: '100', transform: 'translateY(0px)' } as React.CSSProperties}>
                <span style={{ position: 'absolute', overflow: 'hidden', clip: 'rect(0px, 0px, 0px, 0px)', clipPath: 'inset(0% 0px 0px)', width: '1px', height: '1px', whiteSpace: 'nowrap' } as React.CSSProperties}>ORGANISER</span>
                <span data-word="0" data-line="0" style={{ display: 'inline-block' } as React.CSSProperties} aria-hidden="true">
                  <span data-char="0" data-line="0" data-word="0" style={{ display: 'inline-block', opacity: '1', transform: 'translateX(0vw)' } as React.CSSProperties} aria-hidden="true">O</span>
                  <span data-char="1" data-line="0" data-word="0" style={{ display: 'inline-block', opacity: '1', transform: 'translateX(0vw)' } as React.CSSProperties} aria-hidden="true">R</span>
                  <span data-char="2" data-line="0" data-word="0" style={{ display: 'inline-block', opacity: '1', transform: 'translateX(0vw)' } as React.CSSProperties} aria-hidden="true">G</span>
                  <span data-char="3" data-line="0" data-word="0" style={{ display: 'inline-block', opacity: '1', transform: 'translateX(0vw)' } as React.CSSProperties} aria-hidden="true">A</span>
                  <span data-char="4" data-line="0" data-word="0" style={{ display: 'inline-block', opacity: '1', transform: 'translateX(0vw)' } as React.CSSProperties} aria-hidden="true">N</span>
                  <span data-char="5" data-line="0" data-word="0" style={{ display: 'inline-block', opacity: '1', transform: 'translateX(0vw)' } as React.CSSProperties} aria-hidden="true">I</span>
                  <span data-char="6" data-line="0" data-word="0" style={{ display: 'inline-block', opacity: '1', transform: 'translateX(0vw)' } as React.CSSProperties} aria-hidden="true">S</span>
                  <span data-char="7" data-line="0" data-word="0" style={{ display: 'inline-block', opacity: '1', transform: 'translateX(0vw)' } as React.CSSProperties} aria-hidden="true">E</span>
                  <span data-char="8" data-line="0" data-word="0" style={{ display: 'inline-block', opacity: '1', transform: 'translateX(0vw)' } as React.CSSProperties} aria-hidden="true">R</span>
                </span>
              </span>
            </div>
            <div className="relative h-[2px] flex-1 self-center"><div className="anim-line-organiser absolute top-0 left-0 size-full origin-left bg-white" style={{ transform: 'scaleX(1)' } as React.CSSProperties} /></div>
            <div className="anim-logo-organiser relative h-full w-[205px]" style={{ opacity: '1', transform: 'translateY(0px)' } as React.CSSProperties} />
          </div>
          <div className="flex h-full w-[47%] items-center gap-6">
            <div className="flex h-full w-[118px] items-center">
              <span className="anim-label-sponsor block font-schabo text-[32px] leading-none text-[#F5F5F5] uppercase" style={{ opacity: '100', transform: 'translateY(0px)' } as React.CSSProperties}>
                <span style={{ position: 'absolute', overflow: 'hidden', clip: 'rect(0px, 0px, 0px, 0px)', clipPath: 'inset(0% 0px 0px)', width: '1px', height: '1px', whiteSpace: 'nowrap' } as React.CSSProperties}>SPONSOR</span>
                <span data-word="0" data-line="0" style={{ display: 'inline-block' } as React.CSSProperties} aria-hidden="true">
                  <span data-char="0" data-line="0" data-word="0" style={{ display: 'inline-block', opacity: '1', transform: 'translateX(0vw)' } as React.CSSProperties} aria-hidden="true">S</span>
                  <span data-char="1" data-line="0" data-word="0" style={{ display: 'inline-block', opacity: '1', transform: 'translateX(0vw)' } as React.CSSProperties} aria-hidden="true">P</span>
                  <span data-char="2" data-line="0" data-word="0" style={{ display: 'inline-block', opacity: '1', transform: 'translateX(0vw)' } as React.CSSProperties} aria-hidden="true">O</span>
                  <span data-char="3" data-line="0" data-word="0" style={{ display: 'inline-block', opacity: '1', transform: 'translateX(0vw)' } as React.CSSProperties} aria-hidden="true">N</span>
                  <span data-char="4" data-line="0" data-word="0" style={{ display: 'inline-block', opacity: '1', transform: 'translateX(0vw)' } as React.CSSProperties} aria-hidden="true">S</span>
                  <span data-char="5" data-line="0" data-word="0" style={{ display: 'inline-block', opacity: '1', transform: 'translateX(0vw)' } as React.CSSProperties} aria-hidden="true">O</span>
                  <span data-char="6" data-line="0" data-word="0" style={{ display: 'inline-block', opacity: '1', transform: 'translateX(0vw)' } as React.CSSProperties} aria-hidden="true">R</span>
                </span>
              </span>
            </div>
            <div className="relative h-[2px] flex-1 self-center"><div className="anim-line-sponsor absolute top-0 right-0 size-full origin-left bg-white" style={{ transform: 'scaleX(1)' } as React.CSSProperties} /></div>
            <div className="anim-logo-sponsor relative h-full w-[205px]" style={{ opacity: '1', transform: 'translateY(0px)' } as React.CSSProperties}>
              <div className="sponsors-card relative overflow-hidden size-full p-0"><img alt="sponsor" data-cache-status="hit" decoding="sync" loading="eager" className="relative z-1 size-full object-contain" src="/sponsor/Sponsor-1.png" /></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MapBanScene
