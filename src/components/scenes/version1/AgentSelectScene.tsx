import React, { useEffect, useState, useRef } from 'react'
import { resolveAgent as resolveAgentMeta, preloadAgentPortraits, type AgentMeta } from '../../../data/valAgentMeta'
import { fitScaleFor, contentWidth, refitAfterFonts } from '../../../lib/autoFit'

const BLANK_IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAALSURBVBhXY2AAAgAABQABqtXIUQAAAABJRU5ErkJggg=='

/** Auto-fit team name: scales down ONLY when overflowing its header box. */
function FitTeamName({ name, origin, className }: { name: string; origin: 'left' | 'right'; className: string }) {
  const ref = useRef<HTMLHeadingElement | null>(null)
  const [scale, setScale] = useState(1)
  React.useLayoutEffect(() => {
    const el = ref.current
    const box = el?.parentElement
    if (!el || !box) return
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
      style={{
        transform: `scale(${scale})`,
        transformOrigin: origin === 'left' ? 'left center' : 'right center',
        whiteSpace: 'nowrap',
        width: 'fit-content',
      }}
    >
      {name}
    </h1>
  )
}

export interface AgentSelectSceneProps {
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
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 597 598" className="scale-[1.15] w-full text-white/15">
        <path fill="currentColor" fillRule="evenodd" d="M300.423 37.384 482.859 329.77H273.256l136.726 205.897c88.487-41.895 149.706-132.119 149.706-236.664 0-143.848-115.901-260.582-259.265-261.618m-91.796 15.893 120.592 191.849H114.124l204.598 314.729c-6.674.512-13.418.772-20.222.772-144.25 0-261.187-117.133-261.187-261.625 0-112.859 71.341-209.027 171.314-245.725" clipRule="evenodd" />
      </svg>
    )
  }
  if (role === 'sentinel') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 597 598" className="scale-[1.15] w-full text-white/15">
        <path fill="currentColor" fillRule="evenodd" d="M336.081 560.571C462.526 542.227 559.688 432.7 559.688 300.325c0-33.028-6.049-64.635-17.091-93.757zm-74.884.041C134.617 542.388 37.313 432.797 37.313 300.325c0-34.052 6.428-66.591 18.13-96.456zM87.922 144.734l416.838-5.748C456.97 77.152 382.349 37.375 298.5 37.375c-86.419 0-163.036 42.254-210.578 107.359" clipRule="evenodd" />
        <path fill="currentColor" d="M421.309 230.71H175.485l122.912 216.547z" />
      </svg>
    )
  }
  if (role === 'controller') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 597 598" className="scale-[1.15] w-full text-white/15">
        <path fill="currentColor" fillRule="evenodd" d="M508.521 454.562c32.152-43.48 51.167-97.296 51.167-155.562 0-53.749-16.183-103.714-43.932-145.27L361.209 307.751zm-63.894 61.318L298.5 370.248 152.373 515.88c41.704 28.248 91.992 44.745 146.127 44.745s104.423-16.497 146.127-44.745M88.479 454.562C56.327 411.082 37.313 357.266 37.313 299c0-53.749 16.181-103.714 43.93-145.27l154.548 154.021zM142.135 89.42 298.5 245.255 454.865 89.42C411.273 56.734 357.144 37.375 298.5 37.375S185.728 56.735 142.135 89.42" clipRule="evenodd" />
      </svg>
    )
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 597 598" className="scale-[1.15] w-full text-white/15">
      <path fill="currentColor" d="M298.5 37.375L454.865 193.74L298.5 350.105L142.135 193.74Z" />
    </svg>
  )
}

/** Individual Agent Card with staged entrance + pick silhouette -> agent image reveal */
function AgentCard({
  player,
  teamColor,
  index,
  assetsReady,
}: {
  player: any
  teamColor: string
  index: number
  assetsReady: boolean
}) {
  const meta: AgentMeta | null = resolveAgentMeta(player)
  const img = meta?.portrait || ''
  const role = meta?.role || player?.role || null
  const playerName = player.alias || player.riotId || ''

  // Lock-in check: If player only clicked/hovered without locking in, keep only the box frame.
  const isLocked = player?.locked !== false && player?.isLocked !== false && player?.selection !== 'selected'
  const shouldShowPortrait = isLocked && !!img

  // Silhouette transition: when an agent is picked AND locked in, display team-colored
  // silhouette first for 450ms, then reveal the full agent portrait.
  const [stage, setStage] = useState<'none' | 'silhouette' | 'revealed'>(() => {
    return shouldShowPortrait ? 'silhouette' : 'none'
  })
  const prevImgRef = useRef(shouldShowPortrait ? img : '')

  useEffect(() => {
    if (!shouldShowPortrait) {
      setStage('none')
      prevImgRef.current = ''
      return
    }
    // If an agent was newly locked in or changed
    if (img !== prevImgRef.current || stage === 'silhouette') {
      prevImgRef.current = img
      setStage('silhouette')
      const timer = setTimeout(() => {
        setStage('revealed')
      }, 480)
      return () => clearTimeout(timer)
    }
  }, [shouldShowPortrait, img])

  // Card rises up staggered based on index (starting at ~700ms)
  const cardDelayMs = 680 + index * 40
  // Team color accents fade in at ~1020ms
  const colorDelayMs = 1000

  return (
    <div
      className="relative h-[286px] w-[168px] -ml-0.5 first:ml-0 bg-[#252830] p-0.5 overflow-hidden shadow-2xl"
      style={{
        animation: `asCardSlideUp 460ms cubic-bezier(0.16, 1, 0.3, 1) ${cardDelayMs}ms both`,
      }}
    >
      <div className="relative size-full overflow-hidden bg-[#0F1115]">
        {/* Role Watermark */}
        {role && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 z-0 size-full opacity-40 pointer-events-none">
            <RoleIcon role={role} />
          </div>
        )}

        {/* 1st Step: Team Colored Silhouette (only when locked in) */}
        {shouldShowPortrait && stage === 'silhouette' && (
          <div
            className="absolute inset-0 z-15 overflow-hidden flex justify-center pointer-events-none"
            style={{
              animation: 'asSilhouetteIn 460ms ease-out both',
            }}
          >
            <div
              className="w-full h-full"
              style={{
                transform: 'scale(1.85)',
                transformOrigin: 'top center',
                WebkitMaskImage: `url("${img}")`,
                maskImage: `url("${img}")`,
                WebkitMaskSize: 'cover',
                maskSize: 'cover',
                WebkitMaskPosition: 'top center',
                maskPosition: 'top center',
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                backgroundColor: teamColor,
                filter: `drop-shadow(0 0 14px ${teamColor})`,
              }}
            />
          </div>
        )}

        {/* 2nd Step: Full Agent Portrait Image (only when locked in) */}
        {shouldShowPortrait && (
          <div className="absolute inset-0 z-10 overflow-hidden flex justify-center pointer-events-none">
            <img
              src={img || BLANK_IMG}
              alt={meta?.name || playerName}
              loading="eager"
              decoding="async"
              className={`w-full h-full object-cover object-top transition-all duration-500 ${
                stage === 'revealed' && assetsReady ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
              }`}
              style={{
                transform: 'scale(1.85)',
                transformOrigin: 'top center',
              }}
            />
          </div>
        )}

        {/* Team Color Gradient Overlay (appears at Stage 4) */}
        <div
          className="absolute bottom-0 left-0 z-20 w-full h-[65%] pointer-events-none"
          style={{
            background: `linear-gradient(to top, ${teamColor}A0 0%, transparent 100%)`,
            animation: `asTeamColorAppear 450ms ease-out ${colorDelayMs}ms both`,
          }}
        />

        {/* Player Name Pill */}
        <div
          className="absolute bottom-4 left-0 right-0 z-30 flex items-center justify-center px-2"
          style={{
            animation: `asTeamColorAppear 450ms ease-out ${colorDelayMs}ms both`,
          }}
        >
          <div className="relative flex max-w-full items-center justify-center shadow-lg">
            <div
              className="absolute inset-0 rounded-[2px]"
              style={{
                background: teamColor,
                boxShadow: `0 0 10px ${teamColor}50`,
              }}
            />
            <span className="relative truncate px-2.5 py-0.5 font-bold font-baijam text-[17px] tracking-wide leading-none text-white uppercase text-center drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
              {playerName}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Version1AgentSelectScene(props: AgentSelectSceneProps) {
  const {
    leftTeamName = '',
    rightTeamName = '',
    leftTeamColor = '#1DCD9B',
    rightTeamColor = '#FF4848',
    leftTeamLogo = null,
    rightTeamLogo = null,
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

  // Preload portraits + map image
  const [assetsReady, setAssetsReady] = useState(false)
  useEffect(() => {
    preloadAgentPortraits()
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
    const t = setTimeout(() => setAssetsReady(true), 3000)
    return () => clearTimeout(t)
  }, [mapImage])

  const leftRoster = leftTeamPlayers && leftTeamPlayers.length ? leftTeamPlayers : []
  const rightRoster = rightTeamPlayers && rightTeamPlayers.length ? rightTeamPlayers : []

  return (
    <div
      className={`clickable-component scene-root relative size-full min-h-full bg-[#0D0F13] overflow-hidden select-none animate-[v1FadeIn_300ms_ease-out]${
        activeComponentId === 'background' ? ' selected' : ''
      }`}
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
      <style>{`
        @keyframes v1FadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        /* Stage 1: Team name boxes enlarge */
        @keyframes asTeamBoxEnlarge {
          0% {
            transform: scale(0.6);
            opacity: 0;
          }
          70% {
            transform: scale(1.04);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        /* Stage 1b: Logo and team name appear */
        @keyframes asTeamContentFade {
          0% {
            opacity: 0;
            transform: translateY(8px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        /* Stage 2: Center map card slides up from bottom */
        @keyframes asMapSlideUp {
          0% {
            opacity: 0;
            transform: translateY(120%);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        /* Stage 3: Agent cards rise up from bottom */
        @keyframes asCardSlideUp {
          0% {
            opacity: 0;
            transform: translateY(120%);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        /* Stage 4: Team color wash appears */
        @keyframes asTeamColorAppear {
          0% {
            opacity: 0;
            filter: brightness(1.6);
          }
          100% {
            opacity: 1;
            filter: brightness(1);
          }
        }
        /* Stage 5: Team colored silhouette pulse */
        @keyframes asSilhouetteIn {
          0% {
            opacity: 0;
            transform: scale(0.92);
          }
          40% {
            opacity: 1;
            transform: scale(1.03);
          }
          100% {
            opacity: 0.95;
            transform: scale(1);
          }
        }
      `}</style>

      {/* Background Gradients */}
      {showBackground && (
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div
            className="absolute top-0 left-0 w-1/2 h-full opacity-15"
            style={{ background: `radial-gradient(circle at 20% 50%, ${leftTeamColor}, transparent 70%)` }}
          />
          <div
            className="absolute top-0 right-0 w-1/2 h-full opacity-15"
            style={{ background: `radial-gradient(circle at 80% 50%, ${rightTeamColor}, transparent 70%)` }}
          />
        </div>
      )}

      {/* Main Bottom Section: Team Lineups + Sunset Map Reveal */}
      {showTeamLineup && (
        <div
          className={`clickable-component absolute bottom-[9px] left-0 w-full z-10 flex items-end justify-center cursor-pointer${
            activeComponentId === 'team-lineup' ? ' selected' : ''
          }`}
          data-make-transparent="true"
          data-component-id="team-lineup"
          onClick={(e) => {
            e.stopPropagation()
            onSelectComponent?.('team-lineup')
          }}
        >
          {/* Left Team: Header Card + 5 Agent Cards */}
          <div className="relative flex h-[363px] flex-col items-end">
            {/* Stage 1: Left Team Header Box (Enlarges 1st, then logo and name appear) */}
            <div
              className="mb-2 flex h-[77px] w-[337px] items-center rounded-[3px] border border-white/20 bg-[#12151B]/95 p-1 shadow-2xl backdrop-blur-md"
              style={{
                animation: 'asTeamBoxEnlarge 450ms cubic-bezier(0.16, 1, 0.3, 1) 0ms both',
                transformOrigin: 'bottom right',
              }}
            >
              {/* Logo (appears with content) */}
              <div
                className="relative aspect-square h-full overflow-hidden rounded-[2px] p-1 flex items-center justify-center"
                style={{
                  background: leftTeamColor,
                  animation: 'asTeamContentFade 350ms ease-out 320ms both',
                }}
              >
                {leftTeamLogo && (
                  <img
                    alt=""
                    src={leftTeamLogo}
                    className="absolute inset-0 size-full object-contain p-1"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                )}
              </div>
              {/* Team Name (appears with content) */}
              <div
                className="flex h-full min-w-0 flex-1 items-center justify-start px-3.5"
                style={{
                  animation: 'asTeamContentFade 350ms ease-out 350ms both',
                }}
              >
                <FitTeamName name={leftTeamName} origin="left" className="font-schabo text-[46px] leading-none text-white uppercase tracking-wide" />
              </div>
            </div>

            {/* Stage 3: 5 Left Agent Cards */}
            <div className="flex items-end">
              {leftRoster.map((player, idx) => (
                <AgentCard
                  key={player.id || idx}
                  player={player}
                  teamColor={leftTeamColor}
                  index={idx}
                  assetsReady={assetsReady}
                />
              ))}
            </div>
          </div>

          {/* Stage 2: Center Map Reveal (slides up from the bottom — fixed 218px width anchors team boxes) */}
          {showMapName && (
            <div
              className={`clickable-component agentSelectMapReveal relative h-[286px] w-[218px] z-20 mx-[-1px] overflow-hidden border-x border-white/20 bg-black cursor-pointer shadow-2xl flex flex-col items-center justify-end${
                activeComponentId === 'map-name' ? ' selected' : ''
              }`}
              data-make-transparent="true"
              data-component-id="map-name"
              style={{
                animation: 'asMapSlideUp 500ms cubic-bezier(0.16, 1, 0.3, 1) 460ms both',
              }}
              onClick={(e) => {
                e.stopPropagation()
                onSelectComponent?.('map-name')
              }}
            >
              {mapImage ? (
                <>
                  <img
                    src={mapImage}
                    alt={mapName}
                    className="absolute inset-0 size-full object-cover object-center"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-black/40" />
                </>
              ) : (
                <div className="absolute inset-0 bg-[#0E1116] flex flex-col items-center justify-center p-4">
                  <div className="size-12 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-white/30 mb-2">
                    <svg className="size-6 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                  </div>
                  <span className="font-baijam text-[12px] font-semibold text-white/40 uppercase tracking-widest text-center">Loading Map</span>
                </div>
              )}
              {mapName && (
                <h1 className="relative z-10 mb-4 font-schabo text-[54px] leading-none text-white uppercase tracking-wider text-center pl-1 w-full drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)]">
                  {mapName}
                </h1>
              )}
            </div>
          )}

          {/* Right Team: Header Card + 5 Agent Cards */}
          <div className="relative flex h-[363px] flex-col items-start">
            {/* Stage 1: Right Team Header Box (Enlarges 1st, then logo and name appear) */}
            <div
              className="mb-2 flex h-[77px] w-[337px] items-center rounded-[3px] border border-white/20 bg-[#12151B]/95 p-1 shadow-2xl backdrop-blur-md flex-row-reverse"
              style={{
                animation: 'asTeamBoxEnlarge 450ms cubic-bezier(0.16, 1, 0.3, 1) 0ms both',
                transformOrigin: 'bottom left',
              }}
            >
              {/* Logo */}
              <div
                className="relative aspect-square h-full overflow-hidden rounded-[2px] p-1 flex items-center justify-center"
                style={{
                  background: rightTeamColor,
                  animation: 'asTeamContentFade 350ms ease-out 320ms both',
                }}
              >
                {rightTeamLogo && (
                  <img
                    alt=""
                    src={rightTeamLogo}
                    className="absolute inset-0 size-full object-contain p-1"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                )}
              </div>
              {/* Team Name */}
              <div
                className="flex h-full min-w-0 flex-1 items-center justify-end px-3.5"
                style={{
                  animation: 'asTeamContentFade 350ms ease-out 350ms both',
                }}
              >
                <FitTeamName name={rightTeamName} origin="right" className="font-schabo text-[46px] leading-none text-white uppercase tracking-wide" />
              </div>
            </div>

            {/* Stage 3: 5 Right Agent Cards */}
            <div className="flex items-end">
              {rightRoster.map((player, idx) => (
                <AgentCard
                  key={player.id || idx}
                  player={player}
                  teamColor={rightTeamColor}
                  index={idx}
                  assetsReady={assetsReady}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Version1AgentSelectScene
