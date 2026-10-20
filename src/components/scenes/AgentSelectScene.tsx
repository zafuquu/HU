import React, { useEffect, useState } from 'react'
const BLANK_IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAALSURBVBhXY2AAAgAABQABqtXIUQAAAABJRU5ErkJggg=='
import { resolveAgent as resolveAgentMeta, preloadAgentPortraits, type AgentMeta } from '../../data/valAgentMeta'
import { fitScaleFor, contentWidth, refitAfterFonts } from '../../lib/autoFit'

/** Auto-fit team name: measures the rendered text and scales down ONLY when
 *  it overflows its box (e.g. "HAVOC UNLEASH") — short names render at 100%. */
function FitTeamName({ name, origin, className }: { name: string; origin: 'left' | 'right'; className: string }) {
  const ref = React.useRef<HTMLHeadingElement | null>(null)
  const [scale, setScale] = React.useState(1)
  React.useLayoutEffect(() => {
    const el = ref.current
    const box = el?.parentElement
    if (!el || !box) return
    // Canvas-based measure (layout-independent) against the box's CONTENT
    // width — the previous scrollWidth/clientWidth pair silently returned
    // "fits" because the wrapper grew with the text (flex min-width:auto).
    const fit = () => setScale(fitScaleFor(name, el, contentWidth(box), 0.35))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(box)
    ro.observe(el)
    refitAfterFonts(el, fit)
    return () => ro.disconnect()
  }, [name])
  return (
    <h1
      ref={ref}
      className={className}
      style={{ transform: `scale(${scale})`, transformOrigin: origin === 'left' ? 'left center' : 'right center', whiteSpace: 'nowrap', width: 'fit-content' }}
    >
      {name}
    </h1>
  )
}

interface AgentSelectSceneProps {
  leftTeamName?: string
  rightTeamName?: string
  leftTeamColor?: string
  rightTeamColor?: string
  leftTeamLogo?: string | null
  rightTeamLogo?: string | null
  mapName?: string
  mapImage?: string
  leftTeamPlayers?: { id: string; alias: string; riotId: string; avatarUrl?: string | null; photoUrl?: string | null; agentName?: string | null; agent?: string | null; character?: string | null; role?: string | null }[]
  rightTeamPlayers?: { id: string; alias: string; riotId: string; avatarUrl?: string | null; photoUrl?: string | null; agentName?: string | null; agent?: string | null; character?: string | null; role?: string | null }[]
  activeComponentId?: string | null
  onSelectComponent?: (id: string) => void
  isToggled?: (componentId: string) => boolean
}


function RoleIcon({ role }: { role: string }) {
  if (role === 'initiator') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 597 598" className="scale-[1.15] w-full text-[#3C3C3C]">
        <path fill="currentColor" fillRule="evenodd" d="M300.423 37.384 482.859 329.77H273.256l136.726 205.897c88.487-41.895 149.706-132.119 149.706-236.664 0-143.848-115.901-260.582-259.265-261.618m-91.796 15.893 120.592 191.849H114.124l204.598 314.729c-6.674.512-13.418.772-20.222.772-144.25 0-261.187-117.133-261.187-261.625 0-112.859 71.341-209.027 171.314-245.725" clipRule="evenodd" />
      </svg>
    )
  }
  if (role === 'sentinel') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 597 598" className="scale-[1.15] w-full text-[#3C3C3C]">
        <path fill="currentColor" fillRule="evenodd" d="M336.081 560.571C462.526 542.227 559.688 432.7 559.688 300.325c0-33.028-6.049-64.635-17.091-93.757zm-74.884.041C134.617 542.388 37.313 432.797 37.313 300.325c0-34.052 6.428-66.591 18.13-96.456zM87.922 144.734l416.838-5.748C456.97 77.152 382.349 37.375 298.5 37.375c-86.419 0-163.036 42.254-210.578 107.359" clipRule="evenodd" />
        <path fill="currentColor" d="M421.309 230.71H175.485l122.912 216.547z" />
      </svg>
    )
  }
  if (role === 'controller') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 597 598" className="scale-[1.15] w-full text-[#3C3C3C]">
        <path fill="currentColor" fillRule="evenodd" d="M508.521 454.562c32.152-43.48 51.167-97.296 51.167-155.562 0-53.749-16.183-103.714-43.932-145.27L361.209 307.751zm-63.894 61.318L298.5 370.248 152.373 515.88c41.704 28.248 91.992 44.745 146.127 44.745s104.423-16.497 146.127-44.745M88.479 454.562C56.327 411.082 37.313 357.266 37.313 299c0-53.749 16.181-103.714 43.93-145.27l154.548 154.021zM142.135 89.42 298.5 245.255 454.865 89.42C411.273 56.734 357.144 37.375 298.5 37.375S185.728 56.735 142.135 89.42" clipRule="evenodd" />
      </svg>
    )
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 597 598" className="scale-[1.15] w-full text-[#3C3C3C]">
      <path fill="currentColor" d="M298.5 37.375L454.865 193.74L298.5 350.105L142.135 193.74Z" />
    </svg>
  )
}

export function AgentSelectScene(props: AgentSelectSceneProps) {
  const {
    leftTeamName = '',
    rightTeamName = '',
    leftTeamColor = '#1DCD9B',
    rightTeamColor = '#FF4848',
    leftTeamLogo = null,
    rightTeamLogo = null,
    // No hardcoded fallback map: the overlay shows the map tile ONLY when the
    // live snapshot (or the veto pick) actually knows it. During agent select
    // of a new match the map is legitimately unknown for a few seconds — the
    // old 'Sunset'/juliett defaults painted the WRONG map there (reported
    // live 2026-10-18).
    mapName,
    mapImage,
    leftTeamPlayers = [],
    rightTeamPlayers = [],
    activeComponentId,
    onSelectComponent,
    isToggled = () => true,
  } = props
  const showBackground = isToggled('background')
  const showMapName = isToggled('map-name')
  const showTeamLineup = isToggled('team-lineup')

  // Preload every agent portrait + the map splash once on mount so OBS
  // browser sources never show images popping in one-by-one on scene switch.
  const [assetsReady, setAssetsReady] = useState(false)
  useEffect(() => {
    preloadAgentPortraits()
    // mapImage is optional now (no hardcoded fallback map) — preload only
    // when the map is actually known.
    const extra = [mapImage].filter((src): src is string => !!src)
    let pending = extra.length
    if (pending === 0) {
      setAssetsReady(true)
      return
    }
    for (const src of extra) {
      const img = new Image()
      img.onload = img.onerror = () => {
        pending -= 1
        if (pending <= 0) setAssetsReady(true)
      }
      img.src = src
    }
    // safety net — never block the scene for more than 3s
    const t = setTimeout(() => setAssetsReady(true), 3000)
    return () => clearTimeout(t)
  }, [mapImage])

  // Resolve each card's agent (portrait + role) from the authoritative meta.
  // NO player photos and NO demo fallback: an unpicked agent renders as a
  // blank neutral card — the portrait appears only after an agent is selected
  // (operator request); the team LOGO lives in the header card instead.
  const resolveCard = (p: any) => {
    const meta: AgentMeta | null = resolveAgentMeta(p)
    const img = meta?.portrait || ''
    const role = meta?.role || p?.role || null
    return { meta, img, role }
  }

  // Live rosters only — an empty side renders NO cards (never demo data).
  const leftRoster = leftTeamPlayers && leftTeamPlayers.length ? leftTeamPlayers : []
  const rightRoster = rightTeamPlayers && rightTeamPlayers.length ? rightTeamPlayers : []

  return (
    <div
      className={`clickable-component scene-root relative size-full min-h-full bg-[#1B1D1F] overflow-hidden select-none${activeComponentId === 'background' ? ' selected' : ''}`}
      data-make-transparent="true"
      data-component-id="background"
      style={{
        width: 1920,
        height: 1080,
        '--left-team-color': leftTeamColor,
        '--right-team-color': rightTeamColor,
      } as React.CSSProperties}
      onClick={(e) => {
        e.stopPropagation()
        onSelectComponent?.('background')
      }}
    >
      {/* Background Gradients */}
      {showBackground && (
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-1/2 h-full opacity-10" style={{ background: `radial-gradient(circle at 20% 50%, ${leftTeamColor}, transparent 70%)` }} />
          <div className="absolute top-0 right-0 w-1/2 h-full opacity-10" style={{ background: `radial-gradient(circle at 80% 50%, ${rightTeamColor}, transparent 70%)` }} />
        </div>
      )}

      {/* Main Bottom Section: Team Lineups + Sunset Map Reveal */}
      {showTeamLineup && (
        <div
          className={`clickable-component absolute bottom-[9px] left-0 w-full z-10 flex items-end justify-center cursor-pointer${activeComponentId === 'team-lineup' ? ' selected' : ''}`}
          data-make-transparent="true"
          data-component-id="team-lineup"
          onClick={(e) => {
            e.stopPropagation()
            onSelectComponent?.('team-lineup')
          }}
        >
          {/* Left Team: Header Card + 5 Agent Cards */}
          <div className="relative flex h-[363px] flex-col items-end">
            {/* Left Team Header Card */}
            <div className="mb-2 flex h-[77px] w-[337px] items-center rounded-[2px] border-[2px] border-[#F5F5F5] bg-[#171717] p-0.5 shadow-xl">
              <div className="relative aspect-square h-full overflow-hidden rounded-[2px] p-1" style={{ background: leftTeamColor }}>
                {leftTeamLogo && <img alt="" src={leftTeamLogo} className="absolute inset-0 size-full object-contain" onError={e => { e.currentTarget.style.display = 'none' }} />}
              </div>
              <div className="flex h-full min-w-0 flex-1 items-center justify-start px-4">
                <FitTeamName name={leftTeamName} origin="left" className="font-schabo text-[48px] leading-none text-white uppercase" />
              </div>
            </div>

            {/* 5 Left Agent Cards */}
            <div className="flex items-end">
              {leftRoster.map(function(c, i){ 
                const { meta, img, role } = resolveCard(c)
                return (
                <div
                  key={i}
                  className="relative h-[286px] w-[168px] -ml-0.5 first:ml-0 bg-[#C9C9C9] p-0.5 overflow-hidden"
                >
                  <div className="relative size-full overflow-hidden bg-[#171717]">
                    {/* Role Watermark — only when an agent is actually picked */}
                    {role && (
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-0 size-full opacity-40">
                        <RoleIcon role={role} />
                      </div>
                    )}

                    {/* Agent Portrait: Head Touching the Top of the Box */}
                    <div className="absolute inset-0 z-10 overflow-hidden flex justify-center">
                      <img
                        src={img || BLANK_IMG}
                        alt={meta?.name || c.alias || ''}
                        loading="eager"
                        decoding="async"
                        className={`w-full h-full object-cover object-top transition-opacity duration-300 ${assetsReady ? 'opacity-100' : 'opacity-0'}`}
                        style={{
                          transform: 'scale(1.85)',
                          transformOrigin: 'top center',
                        }}
                      />
                    </div>

                    {/* Bottom Gradient Overlay */}
                    <div
                      className="absolute bottom-0 left-0 z-20 w-full h-[60%] pointer-events-none"
                      style={{ background: `linear-gradient(to top, ${leftTeamColor}99 0%, transparent 100%)` }}
                    />

                    {/* Player Name - centered on card */}
                    <div className="absolute bottom-5 left-0 right-0 z-30 flex items-center justify-center px-2">
                      <div className="relative flex max-w-full items-center justify-center">
                        <div className="absolute inset-0" style={{ background: leftTeamColor }} />
                        <span className="relative truncate px-2 py-0.5 font-medium font-mussels text-[20px] leading-none text-white uppercase text-center drop-shadow-[0_2px_0_rgba(0,0,0,0.7)]">
                          {c.alias || c.riotId || ''}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );})}
            </div>
          </div>

          {/* Center Map Reveal — rendered only when the map is actually known */}
          {showMapName && mapImage && (
            <div
              className={`clickable-component agentSelectMapReveal relative h-[286px] w-[218px] z-20 mx-[-1px] overflow-hidden border-x-2 border-white/20 bg-black cursor-pointer shadow-2xl flex flex-col items-center justify-end${activeComponentId === 'map-name' ? ' selected' : ''}`}
              data-make-transparent="true"
              data-component-id="map-name"
              onClick={(e) => {
                e.stopPropagation()
                onSelectComponent?.('map-name')
              }}
            >
              <img
                src={mapImage}
                alt={mapName}
                className="absolute inset-0 size-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40" />
              <h1 className="relative z-10 mb-4 font-schabo text-[56px] leading-none text-white uppercase tracking-wider text-center pl-2 w-full drop-shadow-md">
                {mapName}
              </h1>
            </div>
          )}

          {/* Right Team: Header Card + 5 Agent Cards */}
          <div className="relative flex h-[363px] flex-col items-start">
            {/* Right Team Header Card */}
            <div className="mb-2 flex h-[77px] w-[337px] items-center rounded-[2px] border-[2px] border-[#F5F5F5] bg-[#171717] p-0.5 shadow-xl flex-row-reverse">
              <div className="relative aspect-square h-full overflow-hidden rounded-[2px] p-1" style={{ background: rightTeamColor }}>
              {rightTeamLogo && <img alt="" src={rightTeamLogo} className="absolute inset-0 size-full object-contain" onError={e => { e.currentTarget.style.display = 'none' }} />}
            </div>
              <div className="flex h-full min-w-0 flex-1 items-center justify-end px-4">
                <FitTeamName name={rightTeamName} origin="right" className="font-schabo text-[48px] leading-none text-white uppercase" />
              </div>
            </div>

            {/* 5 Right Agent Cards */}
            <div className="flex items-end">
              {rightRoster.map(function(c, i){
                const { meta, img, role } = resolveCard(c)
                return (
                <div
                  key={i}
                  className="relative h-[286px] w-[168px] -ml-0.5 first:ml-0 bg-[#C9C9C9] p-0.5 overflow-hidden"
                >
                  <div className="relative size-full overflow-hidden bg-[#171717]">
                    {/* Role Watermark — only when an agent is actually picked */}
                    {role && (
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 z-0 size-full opacity-40">
                        <RoleIcon role={role} />
                      </div>
                    )}

                    {/* Agent Portrait: Head Touching the Top of the Box */}
                    <div className="absolute inset-0 z-10 overflow-hidden flex justify-center">
                      <img
                        src={img || BLANK_IMG}
                        alt={meta?.name || c.alias || ''}
                        loading="eager"
                        decoding="async"
                        className={`w-full h-full object-cover object-top transition-opacity duration-300 ${assetsReady ? 'opacity-100' : 'opacity-0'}`}
                        style={{
                          transform: 'scale(1.85)',
                          transformOrigin: 'top center',
                        }}
                      />
                    </div>

                    {/* Bottom Gradient Overlay */}
                    <div
                      className="absolute bottom-0 left-0 z-20 w-full h-[60%] pointer-events-none"
                      style={{ background: `linear-gradient(to top, ${rightTeamColor}99 0%, transparent 100%)` }}
                    />

                    {/* Player Name - centered on card */}
                    <div className="absolute bottom-5 left-0 right-0 z-30 flex items-center justify-center px-2">
                      <div className="relative flex max-w-full items-center justify-center">
                        <div className="absolute inset-0" style={{ background: rightTeamColor }} />
                        <span className="relative truncate px-2 py-0.5 font-medium font-mussels text-[20px] leading-none text-white uppercase text-center shadow-[0_2px_0_rgba(0,0,0,0.7)]">
                          {c.alias || c.riotId || ''}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );})}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AgentSelectScene
