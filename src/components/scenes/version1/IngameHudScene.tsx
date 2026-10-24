import React from 'react'
import {
  getWeaponImg,
  useSpikeBlink,
  type IngameHudSceneProps,
} from '../classic/IngameHudScene'
import { Version1RoundCeremony } from './GameEventsScene'
import { MatchHistoryGrid, KitBuyCard, TEAM_INCOME_SIDE } from './BuyRoundScene'
import { EconomyTracker } from '../EconomyTracker'
import {
  BLANK_IMG,
  abilityImg,
  agentBust,
  agentIcon,
  agentMasteryPortrait,
  agentPortrait,
  aliveOf,
  armorOf,
  creditsOf,
  getMaxAbilityCharges,
  getAbilityCurrentCharges,
  hexRgba,
  hpOf,
  isDurationUltAgent,
  incomeEstimate,
  kdaOf,
  ultMaxOf,
  ultPointsOf,
  ultReadyOf,
} from '../broadcastKit'
import { resolveAgent } from '../../../data/valAgentMeta'

/** Broadcast kit — VCT-style ingame HUD (player panels, scorebug, 1v1 duel mode). */

const KIT_CSS = `
@keyframes kitFlame {
  0% { box-shadow: 0 0 8px 2px rgba(255,110,40,0.55); }
  100% { box-shadow: 0 0 16px 5px rgba(255,150,60,0.92); }
}
@keyframes kitBlink { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
@keyframes kitGeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes v1ScorelineEnter {
  0% { transform: translate(-50%, -100%); opacity: 0; }
  100% { transform: translate(-50%, 0); opacity: 1; }
}
@keyframes v1InwardLeft {
  0% { transform: translateX(-80px); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
}
@keyframes v1InwardRight {
  0% { transform: translateX(80px); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
}
@keyframes ultGlowPulse {
  0%, 100% {
    box-shadow: 0 0 14px 2px rgba(250, 204, 21, 0.75), inset 0 0 8px rgba(250, 204, 21, 0.3);
    border-color: #FACC15;
  }
  50% {
    box-shadow: 0 0 24px 6px rgba(250, 204, 21, 0.95), inset 0 0 14px rgba(250, 204, 21, 0.5);
    border-color: #FEF08A;
  }
}
@keyframes ultIconPulse {
  0%, 100% { transform: scale(1); filter: brightness(1) drop-shadow(0 0 6px rgba(255,255,255,0.7)); }
  50% { transform: scale(1.1); filter: brightness(1.2) drop-shadow(0 0 14px rgba(255,255,255,0.95)); }
}
@keyframes v1UltSlideInLeft {
  0% { transform: translateX(-105%); }
  100% { transform: translateX(0); }
}
@keyframes v1UltSlideInRight {
  0% { transform: translateX(105%); }
  100% { transform: translateX(0); }
}
@keyframes v1UltSlideOutLeft {
  0% { transform: translateX(0); opacity: 1; }
  100% { transform: translateX(-105%); opacity: 0; }
}
@keyframes v1UltSlideOutRight {
  0% { transform: translateX(0); opacity: 1; }
  100% { transform: translateX(105%); opacity: 0; }
}
@keyframes v1UltIconReveal {
  0% { transform: scale(0.2); opacity: 0; filter: brightness(2.2); }
  65% { transform: scale(1.15); opacity: 1; filter: brightness(1.25); }
  100% { transform: scale(1); opacity: 1; filter: brightness(1); }
}
@keyframes v1UltBustRevealLeft {
  0% { transform: translateX(-24px); opacity: 0; }
  100% { transform: translateX(0); opacity: 0.96; }
}
@keyframes v1UltBustRevealRight {
  0% { transform: translateX(24px); opacity: 0; }
  100% { transform: translateX(0); opacity: 0.96; }
}
@keyframes ultEnter {
  0% { transform: scale(0.92); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes ultExit {
  0% { transform: scale(1); opacity: 1; }
  100% { transform: scale(0.92); opacity: 0; }
}
`

const SKULL_SVG = (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2a9 9 0 0 0-9 9c0 3.2 1.6 6 4 7.6V20a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1.4c2.4-1.6 4-4.4 4-7.6a9 9 0 0 0-9-9zm-3 10a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm6 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
  </svg>
)

const EYE_SVG = (
  <svg fill="none" height="9" viewBox="0 0 10 8" width="11">
    <path
      d="M9.97125 3.42679C9.95667 3.39152 9.60375 2.55268 8.81917 1.71205C7.77375 0.591964 6.45333 0 5 0C3.54667 0 2.22625 0.591964 1.18083 1.71205C0.396246 2.55268 0.0416627 3.39286 0.028746 3.42679C0.00979317 3.47246 0 3.52189 0 3.57187C0 3.62186 0.00979317 3.67129 0.028746 3.71696C0.0433294 3.75223 0.396246 4.59063 1.18083 5.43125C2.22625 6.55089 3.54667 7.14286 5 7.14286C6.45333 7.14286 7.77375 6.55089 8.81917 5.43125C9.60375 4.59063 9.95667 3.75223 9.97125 3.71696C9.99021 3.67129 10 3.62186 10 3.57187C10 3.52189 9.99021 3.47246 9.97125 3.42679ZM5 5.35714C4.67036 5.35714 4.34813 5.25241 4.07405 5.0562C3.79997 4.85998 3.58635 4.58109 3.4602 4.25479C3.33405 3.9285 3.30105 3.56945 3.36536 3.22305C3.42967 2.87666 3.5884 2.55847 3.82149 2.30874C4.05458 2.059 4.35155 1.88893 4.67485 1.82003C4.99815 1.75112 5.33326 1.78649 5.63781 1.92164C5.94235 2.0568 6.20265 2.28568 6.38578 2.57934C6.56892 2.873 6.66667 3.21825 6.66667 3.57143C6.66667 4.04503 6.49107 4.49923 6.17851 4.83412C5.86595 5.16901 5.44203 5.35714 5 5.35714Z"
      fill="white"
    />
  </svg>
)

/** Ultimate orb — static ring + team-color glow when fully charged. */
function UltOrb({
  player,
  teamColor,
  onClick,
}: {
  player: any
  teamColor: string
  onClick?: (e: React.MouseEvent) => void
}) {
  const ready = ultReadyOf(player)
  const ultPts = ultPointsOf(player)
  const ultMax = Math.max(1, ultMaxOf(player))

  // Circular segmented progress around the orb (matching player panel ingame hud.png)
  const size = 28
  const center = size / 2
  const radius = 11.5
  const step = 360 / ultMax
  const gap = 16

  const describeArc = (startAngle: number, endAngle: number) => {
    const rad = (deg: number) => ((deg - 90) * Math.PI) / 180.0
    const x1 = center + radius * Math.cos(rad(startAngle))
    const y1 = center + radius * Math.sin(rad(startAngle))
    const x2 = center + radius * Math.cos(rad(endAngle))
    const y2 = center + radius * Math.sin(rad(endAngle))
    const largeArc = endAngle - startAngle > 180 ? 1 : 0
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
  }

  return (
    <div
      className="relative flex size-[28px] shrink-0 items-center justify-center cursor-pointer select-none group"
      onClick={onClick}
      title={`Ult: ${ultPts}/${ultMax} (Click to toggle)`}
    >
      <svg width={size} height={size} className="absolute inset-0 pointer-events-none">
        {Array.from({ length: ultMax }, (_, i) => {
          const isLit = ready || i < ultPts
          const startAngle = i * step + gap / 2
          const endAngle = (i + 1) * step - gap / 2
          return (
            <path
              key={i}
              d={describeArc(startAngle, endAngle)}
              fill="none"
              stroke={ready ? teamColor : isLit ? '#FFFFFF' : 'rgba(255,255,255,0.22)'}
              strokeWidth={isLit ? 2.2 : 1.4}
              strokeLinecap="butt"
              style={
                ready
                  ? {
                      filter: `drop-shadow(0 0 4px ${teamColor}) drop-shadow(0 0 1px #FFFFFF)`,
                    }
                  : isLit
                    ? {
                        filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.9))',
                      }
                    : undefined
              }
            />
          )
        })}
      </svg>

      {/* Inner circular backdrop and ability icon */}
      <div
        className="relative grid size-[21px] place-items-center rounded-full bg-black/85 transition-transform group-hover:scale-105 active:scale-95"
        style={{
          boxShadow: ready ? `0 0 10px 2px ${hexRgba(teamColor, 0.75)}` : undefined,
        }}
      >
        <img
          src={abilityImg(player, 'X')}
          alt=""
          className="size-[14px] object-contain"
          style={{ opacity: ready ? 1 : 0.72 }}
          onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
        />
      </div>
    </div>
  )
}

/** Ability icon + charge stack rectangle boxes under it (1, 2, or 3 stacks that light up if bought). */
function AbilityCharge({ player, slot, st }: { player: any; slot: 'C' | 'Q' | 'E'; st: any }) {
  const maxCharges = getMaxAbilityCharges(player, slot)
  const currentCharges = getAbilityCurrentCharges(player, slot, st, maxCharges)
  const isAvailable = currentCharges > 0

  return (
    <div className="flex flex-col items-center">
      <img
        src={abilityImg(player, slot)}
        alt=""
        className="size-[17px] object-contain"
        style={{ opacity: isAvailable ? 1 : 0.38 }}
        onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
      />
      {/* Rectangle charge box(es) below the ability icon */}
      <div className="mt-[3px] flex h-[3px] w-[18px] items-center gap-[2px]">
        {Array.from({ length: maxCharges }, (_, i) => {
          const isLit = i < currentCharges
          return (
            <span
              key={i}
              className="h-full flex-1 rounded-[1px] transition-all duration-200"
              style={
                isLit
                  ? {
                      background: '#FFFFFF',
                      boxShadow: '0 0 5px rgba(255,255,255,0.9)',
                    }
                  : {
                      background: 'rgba(255,255,255,0.14)',
                      border: '1px solid rgba(255,255,255,0.22)',
                    }
              }
            />
          )
        })}
      </div>
    </div>
  )
}

/** One player panel: portrait, name/KDA, HP strip, ult orb, ability bars, weapon, credits/shield.
 * Supports special "Using Ult" active state based on using ult.jpg:
 * - Glowing golden border with breathing pulse
 * - Team color covers ~70% with diagonal slant (not totally covering the panel)
 * - Large white pulsing ultimate ability icon in the team-colored area
 * - Agent head/bust portrait prominent on the outer section
 * - Interactive trigger via clicking UltOrb or panel
 */
function KitPanel({
  player,
  side,
  teamColor,
  isObserved,
  isUsingUltOverride,
  onToggleUlt,
  showKills = true,
  showDeaths = true,
  showAssists = true,
  showEco = true,
  showUlts = true,
  teamStatsColor,
}: {
  player: any
  side: 'left' | 'right'
  teamColor: string
  isObserved: boolean
  isUsingUltOverride?: boolean
  onToggleUlt?: (id: string) => void
  showKills?: boolean
  showDeaths?: boolean
  showAssists?: boolean
  showEco?: boolean
  showUlts?: boolean
  teamStatsColor?: string
}) {
  const [localUltActive, setLocalUltActive] = React.useState(false)
  const isRight = side === 'right'
  const alive = aliveOf(player)
  const hp = hpOf(player)
  const armor = armorOf(player)
  const { k, d, a } = kdaOf(player)
  const credits = creditsOf(player)
  const alias = player.alias || player.name || player.riotId || 'Player'
  const weaponSrc = getWeaponImg(player.weapon || player.weaponName)
  const st = player.abilityState

  const hasSpike = Boolean(player.hasSpike || player.carryingSpike || player.hasBomb || player.isCarrier || player.spike)

  // Persistent timeout ref so snapshot re-renders (every 250ms) NEVER cancel the active timer
  const ultTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const triggerUltAnimation = React.useCallback(() => {
    if (!alive) return
    if (ultTimerRef.current) clearTimeout(ultTimerRef.current)
    setLocalUltActive(true)
    ultTimerRef.current = setTimeout(() => {
      setLocalUltActive(false)
      ultTimerRef.current = null
    }, 3800)
  }, [alive])

  // Cleanup on unmount or cancel immediately if player dies
  React.useEffect(() => {
    return () => {
      if (ultTimerRef.current) clearTimeout(ultTimerRef.current)
    }
  }, [])

  React.useEffect(() => {
    if (!alive) {
      if (ultTimerRef.current) {
        clearTimeout(ultTimerRef.current)
        ultTimerRef.current = null
      }
      setLocalUltActive(false)
      setUltStage('idle')
    }
  }, [alive])

  const isDuration = isDurationUltAgent(player)
  const ready = ultReadyOf(player)
  const ultPts = ultPointsOf(player)
  const ultMax = ultMaxOf(player)

  // Track if player previously held a full ready ultimate
  const hadReadyRef = React.useRef(false)
  React.useEffect(() => {
    if (ready || (ultPts != null && ultMax > 0 && ultPts >= ultMax)) {
      hadReadyRef.current = true
    }
  }, [ready, ultPts, ultMax])

  // Trigger 0: For non-duration agents only, Ult Ready transitions from true to false (consumed ult)
  const prevReadyRef = React.useRef<boolean | null>(null)
  React.useEffect(() => {
    const prevReady = prevReadyRef.current
    prevReadyRef.current = ready
    if (!isDuration && prevReady === true && !ready && alive) {
      triggerUltAnimation()
    }
  }, [ready, alive, isDuration, triggerUltAnimation])

  // Trigger 1: For non-duration agents only, Ult points drop from max/ready (e.g. Sova, Breach, Killjoy, Fade, Gekko)
  const prevUltPts = React.useRef<number | null>(null)
  React.useEffect(() => {
    const prev = prevUltPts.current
    prevUltPts.current = ultPts
    if (!isDuration && prev != null && prev >= ultMax && ultMax > 0 && ultPts < prev && alive) {
      triggerUltAnimation()
    }
  }, [ultPts, ultMax, alive, isDuration, triggerUltAnimation])

  // Trigger 2: Channeled / summoned ultimate weapons (Chamber Tour De Force, Jett Blade Storm, Neon Overdrive, Raze Showstopper)
  const currentWeapon = String(player.weapon || player.weaponName || '')
  const prevWeaponRef = React.useRef<string>(currentWeapon)
  React.useEffect(() => {
    const prevW = prevWeaponRef.current
    prevWeaponRef.current = currentWeapon
    const isUltW = /tour\s*de\s*force|bladestorm|blade\s*storm|overdrive|showstopper|rocket\s*launcher|hunter.*fury/i.test(currentWeapon)
    const wasUltW = /tour\s*de\s*force|bladestorm|blade\s*storm|overdrive|showstopper|rocket\s*launcher|hunter.*fury/i.test(prevW)
    if (isUltW && !wasUltW && alive) {
      triggerUltAnimation()
    }
  }, [currentWeapon, alive, triggerUltAnimation])

  // Trigger 3: Local player abilityState.X turns from true (ready) to false (cast/spent)
  // NEVER trigger on prev === false && abilityX === true (that is reaching 8 points!)
  const abilityX = Boolean(player.abilityState?.X ?? player.abilityState?.x ?? player.abilityState?.ultimate)
  const prevAbilityX = React.useRef<boolean | null>(null)
  React.useEffect(() => {
    const prev = prevAbilityX.current
    prevAbilityX.current = abilityX
    if (prev === true && abilityX === false && alive && hadReadyRef.current) {
      triggerUltAnimation()
      hadReadyRef.current = false
    }
  }, [abilityX, alive, triggerUltAnimation])

  // Trigger 4: Explicit active ult flag from telemetry
  const isUltActiveFlag = Boolean(
    player.isUsingUlt ||
    player.usingUlt ||
    player.ultActive ||
    player.ultimate === 'active' ||
    player.abilityState?.ultimate === 'active' ||
    st?.X === 'active' ||
    st?.X === 2
  )
  const prevUltActiveFlag = React.useRef(isUltActiveFlag)
  React.useEffect(() => {
    const prev = prevUltActiveFlag.current
    prevUltActiveFlag.current = isUltActiveFlag
    if (isUltActiveFlag && !prev && alive) {
      triggerUltAnimation()
    }
  }, [isUltActiveFlag, alive, triggerUltAnimation])

  const isUsingUlt = Boolean(
    alive && (
      isUsingUltOverride ||
      localUltActive ||
      isUltActiveFlag
    )
  )

  const [ultStage, setUltStage] = React.useState<'idle' | 'active' | 'exiting'>('idle')
  const prevUsingUlt = React.useRef(isUsingUlt)

  React.useEffect(() => {
    if (isUsingUlt) {
      setUltStage('active')
    } else if (prevUsingUlt.current && !isUsingUlt) {
      setUltStage('exiting')
      const t = setTimeout(() => setUltStage('idle'), 220)
      return () => clearTimeout(t)
    }
    prevUsingUlt.current = isUsingUlt
  }, [isUsingUlt])

  const handleToggleUlt = (e: React.MouseEvent) => {
    e.stopPropagation()
    setLocalUltActive(prev => !prev)
    onToggleUlt?.(player.id || player.name || alias)
  }

  // === "USING ULT" ACTIVE / EXITING STATE (Matches using ult1.jpg: 54px height, team color block, bust portrait) ===
  if (ultStage === 'active' || ultStage === 'exiting') {
    const headArt = agentBust(player) || agentPortrait(player) || agentMasteryPortrait(player) || agentIcon(player) || BLANK_IMG
    const iconArt = agentIcon(player) || BLANK_IMG
    const isExiting = ultStage === 'exiting'
    return (
      <div
        className="relative cursor-pointer select-none"
        style={{
          width: 300,
          animation: isExiting ? 'ultExit 220ms ease-in forwards' : 'ultEnter 260ms cubic-bezier(0.16,1,0.3,1) forwards',
        }}
        onClick={handleToggleUlt}
        title="Using Ult (Click to toggle)"
      >
        {/* Spike carrier badge on ult card */}
        {hasSpike && (
          <div
            className={`absolute top-[4px] z-30 grid size-[24px] place-items-center rounded-full bg-white shadow-lg ${isRight ? '-right-[8px]' : '-left-[8px]'}`}
          >
            <img src="/game/val/misc/Spike_Icon.svg" alt="spike" className="size-[12px] object-contain" />
          </div>
        )}
        {/* Spectated-row eye badge */}
        {isObserved && (
          <div
            className={`absolute bottom-[4px] z-30 grid size-[20px] place-items-center rounded-full border border-white/40 bg-black/85 ${isRight ? '-right-[8px]' : '-left-[8px]'}`}
          >
            {EYE_SVG}
          </div>
        )}

        {/* Panel body matching using ult1.jpg: h-[54px], rounded-[3px], subtle border */}
        <div
          className="relative h-[54px] overflow-hidden rounded-[3px] border border-white/20 bg-[#0A0D12] shadow-lg"
        >
          {/* Stage 1: Team color block covers ~65% top slanting to ~42% bottom */}
          <div
            className="absolute inset-y-0 z-10 flex items-center overflow-hidden"
            style={{
              [isRight ? 'right' : 'left']: 0,
              width: '100%',
              background: teamColor,
              clipPath: isRight
                ? 'polygon(35% 0%, 100% 0%, 100% 100%, 58% 100%)'
                : 'polygon(0% 0%, 65% 0%, 42% 100%, 0% 100%)',
              animation: isExiting
                ? (isRight ? 'v1UltSlideOutRight 200ms ease-in forwards' : 'v1UltSlideOutLeft 200ms ease-in forwards')
                : (isRight ? 'v1UltSlideInRight 260ms cubic-bezier(0.16,1,0.3,1) forwards' : 'v1UltSlideInLeft 260ms cubic-bezier(0.16,1,0.3,1) forwards'),
            }}
          >
            {/* Stage 2: Large White Ult Icon (matching using ult1.jpg: size ~38px) */}
            <div
              className="relative z-10 flex items-center justify-center"
              style={{
                [isRight ? 'marginRight' : 'marginLeft']: '24px',
                width: '44px',
              }}
            >
              <img
                src={abilityImg(player, 'X')}
                alt="ult"
                className="size-[38px] object-contain brightness-0 invert drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]"
                style={{
                  animation: isExiting
                    ? undefined
                    : 'v1UltIconReveal 260ms cubic-bezier(0.16,1,0.3,1) 120ms both',
                }}
                onError={e => {
                  ;(e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
                }}
              />
            </div>
          </div>

          {/* Stage 3: Agent Bust portrait overlapping the slant on outer side (shoulder to head framed cleanly) */}
          <div
            className="absolute inset-y-0 z-20 overflow-hidden flex items-start justify-center pointer-events-none"
            style={{
              [isRight ? 'left' : 'right']: 0,
              width: '140px',
              animation: isExiting
                ? undefined
                : (isRight ? 'v1UltBustRevealRight 280ms ease-out 180ms both' : 'v1UltBustRevealLeft 280ms ease-out 180ms both'),
            }}
          >
            <img
              src={headArt}
              alt=""
              className="h-[140px] w-auto max-w-none object-cover object-top"
              style={{
                transform: isRight ? 'scaleX(-1)' : undefined,
                marginTop: '-4px',
              }}
              onError={e => {
                const el = e.currentTarget as HTMLImageElement
                if (el.src !== iconArt) el.src = iconArt
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative" style={{ width: alive ? 300 : 200, opacity: alive ? 1 : 0.6 }}>
      {/* Spike carrier badge — small white circle on the panel's outer edge (image 1) */}
      {hasSpike && (
        <div
          className={`absolute top-[6px] z-30 grid size-[26px] place-items-center rounded-full bg-white shadow-lg ${isRight ? '-right-[10px]' : '-left-[10px]'}`}
        >
          <img src="/game/val/misc/Spike_Icon.svg" alt="spike" className="size-[13px] object-contain" />
        </div>
      )}
      {/* Spectated-row eye badge */}
      {isObserved && (
        <div
          className={`absolute bottom-[36px] z-10 grid size-[22px] place-items-center rounded-full border border-white/40 bg-black/85 ${isRight ? '-right-[8px]' : '-left-[8px]'}`}
        >
          {EYE_SVG}
        </div>
      )}
      <div
        className="relative overflow-hidden rounded-[4px]"
        style={{
          background: alive
            ? `linear-gradient(${isRight ? '270deg' : '90deg'}, ${hexRgba(teamColor, 0.16)} 0%, rgba(8,10,14,0) 58%), rgba(8,10,14,0.92)`
            : 'rgba(8,10,14,0.92)',
        }}
      >
        {/* Row 1 — portrait, name + KDA, shield hex, HP */}
        <div className={`flex h-[42px] items-center gap-2 px-1.5 ${isRight ? 'flex-row-reverse' : ''}`}>
          <div className="relative size-[38px] shrink-0 overflow-hidden rounded-[3px]">
            <img
              src={agentIcon(player)}
              alt=""
              className={`size-full object-contain ${alive ? '' : 'grayscale opacity-45'}`}
              style={isRight ? { transform: 'scaleX(-1)' } : undefined}
              onError={e => { (e.currentTarget as HTMLImageElement).src = BLANK_IMG }}
            />
            {!alive && (
              <div className="absolute inset-0 grid place-items-center text-[#FF3549] [&>svg]:size-[15px]">
                {SKULL_SVG}
              </div>
            )}
          </div>
          <h1
            className={`w-full truncate font-barlowCond text-[16px] font-semibold leading-tight ${isRight ? 'text-right' : 'text-left'}`}
            style={{ color: teamStatsColor || '#FFFFFF' }}
          >
            {alias}
          </h1>
          {hasSpike && (
            <img
              src="/game/val/misc/Spike_Icon.svg"
              alt="spike"
              className="h-[14px] w-auto shrink-0 object-contain drop-shadow-[0_0_6px_#FF3549]"
              title="Spike Carrier"
            />
          )}
          {(showKills || showDeaths || showAssists) && (
            <span className="font-barlowCond text-[11px] font-semibold leading-none tabular-nums text-white/55">
              {[
                showKills ? k : null,
                showDeaths ? d : null,
                showAssists ? a : null,
              ].filter(v => v !== null).join('/')}
            </span>
          )}
          <div className={`flex shrink-0 items-center gap-1.5 ${isRight ? 'flex-row-reverse' : ''}`}>
            {showEco && (
              <div
                className="grid size-[21px] place-items-center"
                style={{
                  clipPath: 'polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)',
                  background: armor > 0 ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.14)',
                }}
              >
                <span
                  className="font-barlowCond text-[10px] font-extrabold leading-none"
                  style={{ color: armor > 0 ? '#0A0C11' : 'rgba(255,255,255,0.65)' }}
                >
                  {armor}
                </span>
              </div>
            )}
            <span
              className="font-barlowCond text-[17px] font-bold leading-none tabular-nums"
              style={{ color: alive ? '#fff' : '#8a8f98' }}
            >
              {hp}
            </span>
          </div>
        </div>
        {/* Health strip — team-color fill */}
        <div className="h-[5px] w-full bg-black/70">
          <div
            className={`h-full ${isRight ? 'float-right' : ''}`}
            style={{ width: `${alive ? hp : 0}%`, background: alive ? teamColor : 'transparent' }}
          />
        </div>
        {/* Row 2 — ult orb, ability charge bars, weapon, credits */}
        <div className={`flex h-[32px] items-center gap-2 bg-[#0A0C11] px-2 ${isRight ? 'flex-row-reverse' : ''}`}>
          {showUlts && (
            <>
              <UltOrb player={player} teamColor={teamColor} onClick={handleToggleUlt} />
              <span className="h-[18px] w-px bg-white/10" />
            </>
          )}
          <div className={`flex items-center gap-2 ${isRight ? 'flex-row-reverse' : ''}`}>
            <AbilityCharge player={player} slot="C" st={st} />
            <AbilityCharge player={player} slot="Q" st={st} />
            <AbilityCharge player={player} slot="E" st={st} />
          </div>
          <div className="flex-1" />
          {hasSpike && (
            <div
              title="Spike Carrier"
              className="flex items-center justify-center rounded bg-[#FF3549]/25 px-1.5 py-0.5 border border-[#FF3549]/60 shadow-[0_0_8px_rgba(255,53,73,0.6)]"
            >
              <img src="/game/val/misc/Spike_Icon.svg" alt="spike" className="h-[14px] w-auto object-contain filter drop-shadow" />
            </div>
          )}
          {alive && (
            <img
              src={weaponSrc}
              alt=""
              className={`max-h-[17px] max-w-[74px] object-contain ${isRight ? '' : '-scale-x-100'}`}
              style={{ opacity: 0.92 }}
              onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
            />
          )}
          {showEco && !alive && credits != null && (
            <span
              className="flex items-center gap-1 font-barlowCond text-[13px] font-bold tabular-nums text-white/50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 190 190" className="inline size-3 rotate-45 text-[#F9E4AB]/70">
                <circle cx="94.566" cy="94.574" r="54.425" stroke="currentColor" strokeWidth="22.41" />
                <path fill="currentColor" d="M80.164.12h28.813v32.015H80.164zM80.162 156.996h28.813v32.015H80.162zM32.135 76.965v28.813H.12V76.965zM189.01 76.964v28.813h-32.014V76.964z" />
              </svg>
              {credits}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export interface ScorebugProps {
  leftName: string
  rightName: string
  leftSeed?: number | string
  rightSeed?: number | string
  leftColor: string
  rightColor: string
  scoreLeft: number
  scoreRight: number
  seriesLeft: number
  seriesRight: number
  bestOf?: number
  showSeries?: boolean
  showLogos?: boolean
  showBombTimer?: boolean
  leftLogo?: string | null
  rightLogo?: string | null
  roundLabel?: string
  timerText?: string
  timerColor?: string
  spikeActive?: boolean
  spikeBlinkOn?: boolean
  spikeState?: 'none' | 'planted' | 'defusing' | 'detonated' | 'defused' | null
  seriesTitleText?: string
  gameSeriesText?: string
  eventTitleText?: string
  roundText?: string
  scoreLineSmall?: boolean
  scoreLineSize?: number
  scoreLineBackgroundImage?: string | null
  scoreLineLeftColor?: { title?: string; score?: string }
  scoreLineRightColor?: { title?: string; score?: string }
  activeComponentId?: string | null
  onSelectComponent?: (id: string) => void
}

/** Top-center scorebug: names, seeds, scores, series diamonds, round clock / spike timer. */
export function Scorebug(props: ScorebugProps) {
  const {
    leftName, rightName, leftSeed, rightSeed, leftColor, rightColor,
    scoreLeft, scoreRight, seriesLeft, seriesRight, bestOf,
    showSeries = true,
    showLogos = true,
    showBombTimer = true,
    leftLogo, rightLogo,
    timerText, timerColor = '#DADBE3',
    spikeActive, spikeBlinkOn, spikeState,
    seriesTitleText, gameSeriesText, eventTitleText, roundText,
    scoreLineSmall = false,
    scoreLineSize = 3,
    scoreLineBackgroundImage = null,
    scoreLineLeftColor,
    scoreLineRightColor,
    activeComponentId,
    onSelectComponent,
  } = props

  const toWin = Math.max(1, Math.ceil((bestOf || 3) / 2))
  const diamonds = (won: number, color: string, flip: boolean) => (
    <div className={`flex gap-[5px] ${flip ? 'flex-row-reverse' : ''}`}>
      {Array.from({ length: toWin }, (_, i) => (
        <span
          key={i}
          className="size-[7px] rotate-45 border"
          style={i < won ? { background: color, borderColor: color } : { borderColor: 'rgba(255,255,255,0.45)' }}
        />
      ))}
    </div>
  )

  const teamCell = (side: 'left' | 'right') => {
    const isRight = side === 'right'
    const name = isRight ? rightName : leftName
    const seed = isRight ? rightSeed : leftSeed
    const color = isRight ? rightColor : leftColor
    const score = isRight ? scoreRight : scoreLeft
    const series = isRight ? seriesRight : seriesLeft
    const logo = isRight ? rightLogo : leftLogo
    const customColors = isRight ? scoreLineRightColor : scoreLineLeftColor

    const logoEl = showLogos && logo ? (
      <img
        src={logo}
        alt=""
        className="size-[36px] shrink-0 object-contain"
        onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
      />
    ) : (
      <div className="grid size-[32px] shrink-0 place-items-center rounded-full" style={{ background: color }}>
        <span className="font-schabo text-[15px] leading-none text-black/80">{name.slice(0, 1)}</span>
      </div>
    )

    const nameCol = (
      <div className={`flex min-w-0 flex-1 flex-col gap-0.5 ${isRight ? 'items-end' : 'items-start'}`}>
        {seed != null && seed !== '' && (
          <span className="font-baijam text-[9px] font-bold tracking-[0.14em] text-white/50">#{seed}</span>
        )}
        <span
          className={`w-full truncate font-schabo text-[25px] uppercase leading-none ${isRight ? 'text-right' : 'text-left'}`}
          style={{ color: customColors?.title || '#DADBE3' }}
        >
          {name}
        </span>
        {showSeries && diamonds(series, color, isRight)}
      </div>
    )

    const scoreEl = (
      <span
        className="shrink-0 font-schabo text-[38px] leading-none tabular-nums"
        style={{ color: customColors?.score || '#DADBE3' }}
      >
        {score}
      </span>
    )

    return (
      <div
        className={`flex flex-1 items-center gap-1.5 px-2 ${isRight ? 'flex-row-reverse' : ''}`}
        style={{ borderBottom: `3px solid ${color}` }}
      >
        {logoEl}
        {nameCol}
        {scoreEl}
      </div>
    )
  }

  const bottomBarHeight = Math.max(18, Math.round(18 * (scoreLineSize > 1 ? 1 + scoreLineSize * 0.08 : 1)))

  return (
    <div
      className={`clickable-component absolute top-0 z-20 cursor-pointer ${
        activeComponentId === 'score-line' ? 'selected ring-2 ring-blue-500/70' : ''
      }`}
      style={{
        left: '50%',
        width: scoreLineSmall ? 700 : 812,
        transform: 'translateX(-50%)',
        animation: 'v1ScorelineEnter 450ms cubic-bezier(0.16, 1, 0.3, 1) both',
      }}
      data-component-id="score-line"
      onClick={e => {
        e.stopPropagation()
        onSelectComponent?.('score-line')
      }}
    >
      <div
        className="relative flex h-[64px] items-stretch overflow-hidden rounded-b-[6px] border border-t-0 border-white/25"
        style={{
          background: scoreLineBackgroundImage
            ? `url(${scoreLineBackgroundImage}) center/cover no-repeat, rgba(0,0,0,0.92)`
            : 'rgba(0,0,0,0.92)',
        }}
      >
        {teamCell('left')}

        {/* Center Clock / Spike Timer Slot */}
        <div className="relative flex w-[110px] shrink-0 items-center justify-center">
          {showBombTimer && (
            <div className="flex h-full items-center justify-center">
              {spikeState === 'defused' ? (
                // Defused: red pulsing spike icon turns to solid WHITE (stops pulsing)
                <img
                  src="/game/val/misc/Spike_Icon.svg"
                  alt="spike defused"
                  className="h-[36px] w-auto object-contain brightness-0 invert"
                  style={{
                    filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.95))',
                  }}
                />
              ) : spikeState === 'detonated' ? (
                // Exploded: stops pulsing and stays solid RED
                <img
                  src="/game/val/misc/Spike_Icon.svg"
                  alt="spike detonated"
                  className="h-[36px] w-auto object-contain"
                  style={{
                    filter: 'drop-shadow(0 0 12px #FF3549)',
                  }}
                />
              ) : (spikeActive || spikeState === 'planted' || spikeState === 'defusing') ? (
                // Planted: red pulsing spike icon
                <img
                  src="/game/val/misc/Spike_Icon.svg"
                  alt="spike"
                  className="h-[36px] w-auto object-contain transition-opacity duration-150 animate-[kitBlink_0.8s_ease-in-out_infinite]"
                  style={{
                    filter: 'drop-shadow(0 0 12px #FF3549)',
                    opacity: spikeBlinkOn ? 1 : 0.25,
                  }}
                />
              ) : (
                // Normal / Round Over: clean timer digits only, NEVER any text labels
                <span className="font-schabo text-[36px] leading-none tabular-nums" style={{ color: timerColor }}>
                  {timerText || '0:00'}
                </span>
              )}
            </div>
          )}
        </div>

        {teamCell('right')}
      </div>

      {/* Bottom info bar — series / round / event titles (classic parity) */}
      <div
        className="relative flex items-center justify-between rounded-b-[3px] bg-black/65 px-4 font-mussels uppercase"
        style={{ height: bottomBarHeight, fontSize: 13 }}
      >
        <div className="flex min-w-0 max-w-[300px] items-center gap-1.5">
          {[seriesTitleText, gameSeriesText].filter(Boolean).map((t, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-white/35">|</span>}
              <span className="truncate text-white/80">{t}</span>
            </React.Fragment>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 flex h-full items-center justify-center">
          <span className="whitespace-nowrap font-insatiable text-[15px] tracking-wide text-white/90">
            {(roundText || '').trim()}
          </span>
        </div>
        <div className="flex min-w-0 max-w-[300px] items-center justify-end gap-1.5">
          {eventTitleText ? <span className="truncate text-white/80">{eventTitleText}</span> : null}
        </div>
      </div>
    </div>
  )
}

/** Duel-mode camera card — video when the feed belongs to this side, else fallback art. */
function DuelCamCard(props: {
  survivor: any
  teamColor: string
  teamLogo?: string | null
  showVideo: boolean
  videoStream: MediaStream | null
  videoRef: React.RefObject<HTMLVideoElement | null>
  photo?: string | null
}) {
  const { survivor, teamLogo, showVideo, videoStream, videoRef, photo } = props
  const name = survivor ? String(survivor.alias || survivor.name || survivor.riotId || 'Player') : ''
  const { k, d, a } = kdaOf(survivor || {})
  const fallbackPortrait = agentPortrait(survivor || {})
  return (
    <div className="w-[310px] overflow-hidden rounded-sm border border-white/20 bg-black/95 shadow-2xl">
      <div className="relative h-[164px] bg-[#121417]">
        {showVideo && videoStream ? (
          <video ref={videoRef} autoPlay playsInline muted className="size-full object-cover" />
        ) : photo ? (
          <img src={photo} alt="" className="size-full object-cover" />
        ) : teamLogo ? (
          <img
            src={teamLogo}
            alt=""
            className="size-full object-contain p-5"
            style={{ background: 'radial-gradient(circle at 50% 35%, rgba(255,255,255,0.07), transparent 72%)' }}
          />
        ) : survivor ? (
          <img src={fallbackPortrait} alt="" className="size-full object-cover object-top" />
        ) : (
          <div className="grid size-full place-items-center">
            <div className="text-center">
              <svg className="mx-auto mb-1 w-8 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span className="font-baijam text-[11px] font-bold uppercase tracking-widest text-white/40">CAMERA OFFLINE</span>
            </div>
          </div>
        )}
      </div>
      <div className="flex h-7 items-center justify-between border-t border-white/10 bg-black/90 px-3">
        <span className="font-baijam text-xs font-bold uppercase text-white">{name || 'No camera'}</span>
        {survivor && (
          <span className="font-baijam text-[11px] font-bold tabular-nums text-white/70">{k} / {d} / {a}</span>
        )}
      </div>
    </div>
  )
}

/** Duel-mode death strip: grayed portraits of the fallen, lined up at the corner. */
function DeathStrip({ players, side }: { players: any[]; side: 'left' | 'right' }) {
  if (players.length === 0) return null
  return (
    <div className={`flex gap-1.5 ${side === 'right' ? 'flex-row-reverse' : ''}`}>
      {players.map((p, i) => (
        <div key={p.id || i} className="relative size-[54px] overflow-hidden rounded-[3px] border border-white/10 bg-black/60">
          <img
            src={agentPortrait(p)}
            alt=""
            className="size-full object-cover object-top opacity-65 grayscale"
            onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
          />
          <div className="absolute inset-0 grid place-items-center text-[#FF3549] opacity-90 [&>svg]:size-[18px]">
            {SKULL_SVG}
          </div>
        </div>
      ))}
    </div>
  )
}

export function BroadcastIngameHudScene(props: IngameHudSceneProps & {
  activeScene?: 'ingame-hud' | 'buy-round'
  economy?: any
  roundHistory?: any[]
}) {
  const {
    activeScene = 'ingame-hud',
    economy = null,
    roundHistory = [],
    leftTeamName = 'Left Team',
    rightTeamName = 'Right Team',
    leftTeamSeed,
    rightTeamSeed,
    leftTeamColor = '#28D091',
    rightTeamColor = '#FF3549',
    scoreLeft = 0,
    scoreRight = 0,
    timerText = '1:40',
    roundText = 'Round 1',
    timerColor = '#DADBE3',
    showLogos = true,
    showSeries = true,
    seriesScoreLeft = 0,
    seriesScoreRight = 0,
    bestOf = 3,
    seriesTitleText = '',
    eventTitleText = '',
    gameSeriesText = '',
    leftTeamLogo = null,
    rightTeamLogo = null,
    leftTeamPlayers = [],
    rightTeamPlayers = [],
    mapHistoryItems,
    webcamPlayerName = '',
    webcamPlayerPhoto = null,
    webcamActive = false,
    webcamPlayerStats = null,
    webcamStream = null,
    liveOnly = false,
    roundEnd = null,
    roundNumber = null,
    gameEvent = null,
    winSide = null,
    tournamentLogo = null,
    sponsorImageUrl = null,
    ceremonyText = null,
    ceremonyTrigger = null,
    ceremonyWinner = null,
    activeComponentId,
    onSelectComponent,
    isToggled = () => true,
    currentlyObserving = null,
    localPlayerName = null,
    spectating = false,
    spikeSite: _spikeSite = null,
    spikeState = null,
    spikePlantedAt: _spikePlantedAt = null,
    eventsBg,
    eventsHighlight,
    gameEventsIndividual = false,
    gameEventsUploads,
    ceremonyPersistent = false,
    showBombTimer = true,
    scoreLineSmall = false,
    scoreLineSize = 3,
    scoreLineBackgroundImage = null,
    scoreLineLeftColor,
    scoreLineRightColor,
    showKills = true,
    showDeaths = true,
    showAssists = true,
    showEco = true,
    showUlts = true,
    teamStatsLeftColor,
    teamStatsRightColor,
  } = props

  const isBuyRound = activeScene === 'buy-round'

  // Interactive Ult state for testing / operator trigger
  const [toggledUlts, setToggledUlts] = React.useState<Record<string, boolean>>({})
  const handleToggleUlt = (pKey: string) => {
    setToggledUlts(prev => ({ ...prev, [pKey]: !prev[pKey] }))
  }

  // Game-events / ceremony wiring (classic parity — copied)
  const bannerLeftName = (leftTeamName || '').toUpperCase()
  const bannerRightName = (rightTeamName || '').toUpperCase()
  const roundEndReasonText =
    roundEnd?.reason === 'detonation' ? 'SPIKE DETONATED'
    : roundEnd?.reason === 'defusion' ? 'SPIKE DEFUSED'
    : roundEnd?.winner || roundEnd?.reason ? 'ROUND WIN'
    : null
  const ceremonyReasonText = (ceremonyText || roundEndReasonText || '').trim().toUpperCase()
  const GE_REASON_FIELDS: Record<string, string> = {
    'ROUND WIN': 'game-events-bg-round-winner',
    ACE: 'game-events-bg-ace',
    CLUTCH: 'game-events-bg-clutch',
    FLAWLESS: 'game-events-bg-flawless',
    'TEAM ACE': 'game-events-bg-team-ace',
    THRIFTY: 'game-events-bg-thrifty',
  }
  const ceremonyEventImage =
    (gameEventsIndividual && ceremonyReasonText && GE_REASON_FIELDS[ceremonyReasonText]
      ? (gameEventsUploads?.[GE_REASON_FIELDS[ceremonyReasonText]] ?? null)
      : null) ||
    gameEventsUploads?.['game-events-bg-round-winner'] ||
    null
  const isCeremonyActive = !!(ceremonyTrigger || roundEnd?.winner)

  // Kit never substitutes demo players on live sources.
  const leftRoster = leftTeamPlayers || []
  const rightRoster = rightTeamPlayers || []

  // Economy calculation for buy round view
  const calcEco = (players: any[]) => {
    const creds = players.map(p => Number(p.credits ?? p.money)).filter(v => Number.isFinite(v) && v > 0)
    const total = creds.reduce((a, b) => a + b, 0)
    const avg = creds.length ? Math.round(total / creds.length) : 0
    const ecoType = avg >= 4000 ? 'full-buy' : avg >= 2600 ? 'half-buy' : avg >= 1500 ? 'force-buy' : 'eco'
    return { total, avgCredits: avg, ecoType, playerCount: creds.length || 5 }
  }
  const effectiveEconomy = economy || {
    left: calcEco(leftRoster),
    right: calcEco(rightRoster),
  }
  const incomeLeft = incomeEstimate(roundHistory, TEAM_INCOME_SIDE.left)
  const incomeRight = incomeEstimate(roundHistory, TEAM_INCOME_SIDE.right)

  // Bans should not appear in Ingame HUD map history; only picks and deciders
  const activeMapHistory = (mapHistoryItems || []).filter(i => i.kind !== 'pool' && i.kind !== 'ban')
  const labeledMapHistory = (() => {
    let n = 0
    return activeMapHistory.map(item => {
      if (item.kind === 'decider') return { ...item, label: 'DECIDER:' }
      n += 1
      return { ...item, label: `MAP ${n}:` }
    })
  })()

  const isObservedPlayer = (p: any, side: 'left' | 'right', index: number): boolean => {
    if (spectating && !currentlyObserving) return Boolean(side === 'left' && index === 0)
    if (!currentlyObserving) return Boolean(side === 'left' && index === 0)
    const obs = String(currentlyObserving).toLowerCase().trim()
    const pName = String(p.name || p.alias || p.riotId || p.id || '').toLowerCase().trim()
    const pRiot = String(p.riotId || '').toLowerCase().trim()
    return Boolean(obs === pName || (pRiot && obs === pRiot) || (pName && obs.includes(pName)) || (pName && pName.includes(obs)))
  }

  // Spike clock
  const isRoundOver = Boolean(
    roundEnd != null ||
    (roundEndReasonText && roundEndReasonText.length > 0)
  )
  const isSpikeDetonatedOrDefused = Boolean(
    spikeState === 'detonated' ||
    spikeState === 'defused' ||
    roundEnd?.reason === 'detonation' ||
    roundEnd?.reason === 'defusion' ||
    (typeof spikeState === 'string' && (spikeState.toLowerCase().includes('detonat') || spikeState.toLowerCase().includes('explod') || spikeState.toLowerCase().includes('defus')))
  )
  const isSpikeActive = Boolean(
    !isRoundOver &&
    !isSpikeDetonatedOrDefused &&
    (spikeState === 'planted' ||
      spikeState === 'defusing' ||
      (typeof spikeState === 'string' && (spikeState.toLowerCase().includes('plant') || spikeState.toLowerCase().includes('defus'))))
  )
  const spikeBlinkOn = useSpikeBlink(spikeState === 'planted' && isSpikeActive)

  // Clean timer text: never text strings on the timer (no "ROUND WIN", no "SPIKE DETONATED", no "SPIKE DEFUSED")
  const displayTimerText = isRoundOver ? '0:00' : (timerText || '1:40')
  const displayTimerColor = isSpikeActive || isSpikeDetonatedOrDefused ? '#FF3549' : timerColor

  const showScoreLine = isToggled('score-line')
  const showTeamStats = isToggled('team-stats') || isToggled('alive')
  const showMapHistory = isToggled('map-history')
  const showGameEvents = isToggled('game-events')
  const showSponsors = isToggled('sponsors')
  const showWebcam = isToggled('webcam')

  // Facecam identity chain (classic parity): observed → camera player → local
  const facecamIdentity = (() => {
    const sides = [
      { rows: leftTeamPlayers || [], side: 'left' as const },
      { rows: rightTeamPlayers || [], side: 'right' as const },
    ]
    const norm = (v: any) => String(v ?? '').toLowerCase().split('#')[0].trim()
    const keys = (
      webcamActive
        ? [webcamPlayerName, currentlyObserving]
        : [currentlyObserving, webcamPlayerName, localPlayerName]
    ).filter((k): k is string => !!k && k !== 'No camera' && k.trim() !== '')
    for (const k of keys) {
      for (const { rows, side } of sides) {
        const row = rows.find(
          (r: any) =>
            r &&
            (String(r.playerId ?? '') === String(k) ||
              String(r.name ?? '') === String(k) ||
              norm(r.alias) === norm(k) ||
              norm(r.name) === norm(k)),
        )
        if (row) return { row, side, key: k }
      }
    }
    return keys.length > 0 ? { row: null, side: null, key: keys[0] } : null
  })()
  const facecamName = (() => {
    if (!facecamIdentity) return null
    const r = facecamIdentity.row as any
    const raw = (r && (r.alias || r.name)) || facecamIdentity.key
    return String(raw || '').split('#')[0].trim() || null
  })()
  const facecamFallbackLogo =
    facecamIdentity?.row && facecamIdentity.side
      ? facecamIdentity.side === 'left' ? leftTeamLogo : rightTeamLogo
      : null
  const facecamFallbackPortrait = resolveAgent(facecamIdentity?.row)?.portrait ?? null
  const shouldRenderWebcam =
    showWebcam && (!liveOnly || (webcamActive && (webcamStream || webcamPlayerPhoto)) || !!facecamName)
  const webcamStats =
    webcamPlayerStats ??
    (facecamIdentity?.row
      ? {
          kills: (facecamIdentity.row as any).kills ?? 0,
          deaths: (facecamIdentity.row as any).deaths ?? 0,
          assists: (facecamIdentity.row as any).assists ?? 0,
        }
      : null)
  const webcamVideoRef = React.useRef<HTMLVideoElement | null>(null)
  React.useEffect(() => {
    if (webcamVideoRef.current && webcamStream) {
      webcamVideoRef.current.srcObject = webcamStream
      webcamVideoRef.current.play?.().catch(() => {})
    }
  }, [webcamStream])

  // Duel (1v1) mode: at most one survivor per side, at least one alive
  const leftAlive = leftRoster.filter(aliveOf)
  const rightAlive = rightRoster.filter(aliveOf)
  const duelSurvivorLeft = leftAlive[0] ?? null
  const duelSurvivorRight = rightAlive[0] ?? null
  const duelMode =
    !isBuyRound &&
    leftRoster.length > 0 &&
    rightRoster.length > 0 &&
    leftAlive.length <= 1 &&
    rightAlive.length <= 1 &&
    leftAlive.length + rightAlive.length >= 1
  const duelVideoSide: 'left' | 'right' | null = (() => {
    const norm = (v: any) => String(v ?? '').toLowerCase().split('#')[0].trim()
    if (facecamIdentity?.side === 'left' && duelSurvivorLeft) return 'left'
    if (facecamIdentity?.side === 'right' && duelSurvivorRight) return 'right'
    const wname = norm(webcamPlayerName)
    if (wname) {
      if (duelSurvivorLeft && norm((duelSurvivorLeft as any).alias || (duelSurvivorLeft as any).name) === wname) return 'left'
      if (duelSurvivorRight && norm((duelSurvivorRight as any).alias || (duelSurvivorRight as any).name) === wname) return 'right'
    }
    if (currentlyObserving) {
      if (duelSurvivorLeft && norm((duelSurvivorLeft as any).name || (duelSurvivorLeft as any).alias) === norm(currentlyObserving)) return 'left'
      if (duelSurvivorRight && norm((duelSurvivorRight as any).name || (duelSurvivorRight as any).alias) === norm(currentlyObserving)) return 'right'
    }
    return null
  })()
  const duelVideoRef = React.useRef<HTMLVideoElement | null>(null)
  React.useEffect(() => {
    if (duelVideoRef.current && webcamStream) {
      duelVideoRef.current.srcObject = webcamStream
      duelVideoRef.current.play?.().catch(() => {})
    }
  }, [webcamStream, duelVideoSide])

  return (
    <div
      className="scene-root relative size-full select-none overflow-hidden bg-transparent font-schabo text-[#DADBE3] animate-[kitGeIn_300ms_ease-out]"
      style={
        {
          width: 1920,
          height: 1080,
          '--left-team-color': leftTeamColor,
          '--right-team-color': rightTeamColor,
        } as React.CSSProperties
      }
    >
      <style>{KIT_CSS}</style>

      {/* Round ceremony (game events) — Version 1 official VCT banner design (new gameevent.png) */}
      {(showTeamStats || activeComponentId === 'game-events') && (
        <Version1RoundCeremony
          trigger={
            ceremonyTrigger ||
            (roundEnd?.winner ? 'rd:' + (roundNumber ?? 0) + ':' + roundEnd.winner : (ceremonyPersistent || activeComponentId === 'game-events' ? 'editor-preview' : null))
          }
          reasonText={ceremonyText || roundEndReasonText || 'ROUND WIN'}
          roundNumber={roundNumber ?? 13}
          winSide={winSide || 'defense'}
          winnerName={(ceremonyWinner || roundEnd?.winner) === 'blue' ? bannerLeftName : bannerRightName}
          winnerLogo={((ceremonyWinner || roundEnd?.winner) === 'blue' ? leftTeamLogo : rightTeamLogo) ?? null}
          winnerColor={(ceremonyWinner || roundEnd?.winner) === 'blue' ? leftTeamColor : rightTeamColor}
          winnerFromLeft={(ceremonyWinner || roundEnd?.winner) === 'blue'}
          leftColor={leftTeamColor}
          rightColor={rightTeamColor}
          tournamentLogo={tournamentLogo}
          clutchHighlight={roundEnd?.highlightPlayer ?? null}
          baseColor={eventsBg}
          accentColor={eventsHighlight}
          eventImage={ceremonyEventImage}
          persistent={ceremonyPersistent || activeComponentId === 'game-events'}
          activeComponentId={activeComponentId}
          onSelectComponent={onSelectComponent}
        />
      )}

      {/* Top Map History (classic parity) */}
      {showMapHistory && labeledMapHistory.length > 0 && (
        <div
          className="clickable-component absolute left-4 top-3 z-30 flex cursor-pointer items-center gap-2"
          data-component-id="map-history"
          onClick={e => {
            e.stopPropagation()
            onSelectComponent?.('map-history')
          }}
        >
          <div className="flex h-8 items-center gap-2 rounded-sm border border-white/20 bg-black/90 px-3 shadow-xl backdrop-blur-sm">
            {labeledMapHistory.map((item, i) => (
              <React.Fragment key={item.slot + item.mapId + i}>
                {i > 0 && <span className="text-white/30">|</span>}
                <span className="font-baijam text-[11px] font-bold uppercase text-white/70">{item.label}</span>
                <span
                  className={
                    'font-baijam text-[11px] font-extrabold uppercase ' +
                    (item.kind === 'ban' ? 'text-[#FF4848]' : item.kind === 'decider' ? 'text-white' : 'text-[#1DCD9B]')
                  }
                >
                  {item.mapName}
                </span>
                {item.score ? <span className="px-1 font-baijam text-[11px] font-bold text-white/80">{item.score}</span> : null}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Top Scorebug (remains static and never refreshes when toggling buyround <-> ingamehud) */}
      {showScoreLine && (
        <Scorebug
          leftName={leftTeamName}
          rightName={rightTeamName}
          leftSeed={leftTeamSeed}
          rightSeed={rightTeamSeed}
          leftColor={leftTeamColor}
          rightColor={rightTeamColor}
          scoreLeft={scoreLeft}
          scoreRight={scoreRight}
          seriesLeft={seriesScoreLeft}
          seriesRight={seriesScoreRight}
          bestOf={bestOf}
          showSeries={showSeries}
          showLogos={showLogos}
          showBombTimer={showBombTimer}
          leftLogo={leftTeamLogo}
          rightLogo={rightTeamLogo}
          timerText={displayTimerText}
          timerColor={displayTimerColor}
          spikeActive={isSpikeActive}
          spikeBlinkOn={spikeBlinkOn}
          spikeState={spikeState}
          seriesTitleText={seriesTitleText}
          gameSeriesText={gameSeriesText}
          eventTitleText={eventTitleText}
          roundText={roundText || ''}
          scoreLineSmall={scoreLineSmall}
          scoreLineSize={scoreLineSize}
          scoreLineBackgroundImage={scoreLineBackgroundImage}
          scoreLineLeftColor={scoreLineLeftColor}
          scoreLineRightColor={scoreLineRightColor}
          activeComponentId={activeComponentId}
          onSelectComponent={onSelectComponent}
        />
      )}

      {/* Top Right Sponsors (classic parity) */}
      {showSponsors && (
        <div
          className="clickable-component absolute right-1.5 top-1.5 z-1 flex h-[74px] w-[245px] justify-center"
          data-component-id="sponsors"
          onClick={e => {
            e.stopPropagation()
            onSelectComponent?.('sponsors')
          }}
        >
          <div className="relative size-full overflow-hidden rounded-sm p-1">
            <div className="absolute left-0 top-0 size-full bg-[#000000BD]" />
            <img
              alt="sponsor"
              className="relative z-1 size-full object-contain"
              onError={e => {
                const el = e.currentTarget
                if (!el.dataset.fb) {
                  el.dataset.fb = '1'
                  el.src = '/sponsor/Sponsor-1.png'
                }
              }}
              src={tournamentLogo || sponsorImageUrl || '/sponsor/Sponsor-1.png'}
            />
          </div>
        </div>
      )}

      {/* ===== Normal mode: side roster columns (slides outward when entering buy round, inward on ingame hud) ===== */}
      {!duelMode && showTeamStats && (
        <div
          className={`clickable-component border-0 border-none absolute bottom-0 inset-x-0 z-10 flex justify-between p-[16px] pointer-events-auto ${
            activeComponentId === 'team-stats' ? 'selected ring-2 ring-blue-500/50' : ''
          }`}
          data-component-id="team-stats"
          onClick={e => {
            e.stopPropagation()
            onSelectComponent?.('team-stats')
          }}
        >
          <div
            className="flex flex-col gap-[6px]"
            style={{
              transform: isBuyRound ? 'translateX(-130%)' : 'translateX(0)',
              opacity: isBuyRound ? 0 : 1,
              pointerEvents: isBuyRound ? 'none' : 'auto',
              transition: 'transform 420ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms ease',
            }}
          >
            {leftRoster.map((player: any, idx: number) => {
              const pKey = String(player.id || player.name || player.alias || `left-${idx}`)
              return (
                <KitPanel
                  key={pKey}
                  player={player}
                  side="left"
                  teamColor={leftTeamColor}
                  showKills={showKills}
                  showDeaths={showDeaths}
                  showAssists={showAssists}
                  showEco={showEco}
                  showUlts={showUlts}
                  teamStatsColor={teamStatsLeftColor}
                  isObserved={isObservedPlayer(player, 'left', idx)}
                  isUsingUltOverride={Boolean(toggledUlts[pKey])}
                  onToggleUlt={() => handleToggleUlt(pKey)}
                />
              )
            })}
          </div>
          {rightRoster.length > 0 && (
            <div
              className="flex flex-col items-end gap-[6px]"
              style={{
                transform: isBuyRound ? 'translateX(130%)' : 'translateX(0)',
                opacity: isBuyRound ? 0 : 1,
                pointerEvents: isBuyRound ? 'none' : 'auto',
                transition: 'transform 420ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms ease',
              }}
            >
              {rightRoster.map((player: any, idx: number) => {
                const pKey = String(player.id || player.name || player.alias || `right-${idx}`)
                return (
                  <KitPanel
                    key={pKey}
                    player={player}
                    side="right"
                    teamColor={rightTeamColor}
                    showKills={showKills}
                    showDeaths={showDeaths}
                    showAssists={showAssists}
                    showEco={showEco}
                    showUlts={showUlts}
                    teamStatsColor={teamStatsRightColor}
                    isObserved={isObservedPlayer(player, 'right', idx)}
                    isUsingUltOverride={Boolean(toggledUlts[pKey])}
                    onToggleUlt={() => handleToggleUlt(pKey)}
                  />
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== Buy Round Bottom HUD Stack (slides up from bottom, sponsors & history from sides) ===== */}
      <div
        className="absolute inset-x-0 bottom-2 z-20 flex flex-col items-center gap-1.5 px-0 pointer-events-auto"
        style={{
          transform: isBuyRound ? 'translateY(0)' : 'translateY(115%)',
          opacity: isBuyRound ? 1 : 0,
          pointerEvents: isBuyRound ? 'auto' : 'none',
          transition: 'transform 440ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms ease',
        }}
      >
        {/* Row 1: Left Sponsor Card | Match History Grid | Right Sponsor Card */}
        <div className="flex w-full items-center justify-between px-2 gap-3">
          <div
            className="h-[84px] w-[385px] rounded-[4px] bg-[#1A1A1AE0] overflow-hidden"
            style={{
              transform: isBuyRound ? 'translateX(0)' : 'translateX(-120px)',
              opacity: isBuyRound ? 1 : 0,
              transition: 'transform 420ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms ease',
              visibility: !showSponsors ? 'hidden' : undefined,
            }}
          >
            <div className="sponsors-card relative overflow-hidden p-1 size-full rounded-sm">
              <div className="absolute top-0 left-0 size-full bg-[#292929] opacity-[0.5]" />
              <img
                alt="sponsor"
                className="absolute inset-0 z-1 size-full object-contain p-2"
                src={sponsorImageUrl || tournamentLogo || '/sponsor/Sponsor-1.png'}
              />
            </div>
          </div>

          <div
            style={{
              transform: isBuyRound ? 'translateY(0)' : 'translateY(-24px)',
              opacity: isBuyRound ? 1 : 0,
              transition: 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms ease',
            }}
          >
            <MatchHistoryGrid
              roundHistory={roundHistory}
              leftTeamName={leftTeamName}
              rightTeamName={rightTeamName}
              leftTeamColor={leftTeamColor}
              rightTeamColor={rightTeamColor}
            />
          </div>

          <div
            className="h-[84px] w-[385px] rounded-[4px] bg-[#1A1A1AE0] overflow-hidden"
            style={{
              transform: isBuyRound ? 'translateX(0)' : 'translateX(120px)',
              opacity: isBuyRound ? 1 : 0,
              transition: 'transform 420ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms ease',
              visibility: !showSponsors ? 'hidden' : undefined,
            }}
          >
            <div className="sponsors-card relative overflow-hidden p-1 size-full rounded-sm">
              <div className="absolute top-0 left-0 size-full bg-[#292929] opacity-[0.5]" />
              <img
                alt="sponsor"
                className="absolute inset-0 z-1 size-full object-contain p-2"
                src={sponsorImageUrl || tournamentLogo || '/sponsor/Sponsor-1.png'}
              />
            </div>
          </div>
        </div>

        {/* Economy Tracker */}
        <div className="w-full flex justify-center py-1">
          <EconomyTracker
            economy={effectiveEconomy}
            leftTeamName={leftTeamName}
            rightTeamName={rightTeamName}
            leftTeamColor={leftTeamColor}
            rightTeamColor={rightTeamColor}
          />
        </div>

        {/* Player cards: outward to inward entrance, flush on both sides without outer gaps (px-0), centered agent icons */}
        <div className="flex w-full items-stretch justify-between px-0 gap-3">
          <div
            className="flex min-w-0 flex-1 justify-between gap-1.5"
            style={{
              transform: isBuyRound ? 'translateX(0)' : 'translateX(-80px)',
              opacity: isBuyRound ? 1 : 0,
              transition: 'transform 440ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms ease',
            }}
          >
            {leftRoster.slice(0, 5).map((p: any, i: number) => (
              <KitBuyCard key={p.id || i} player={p} teamColor={leftTeamColor} income={incomeLeft} />
            ))}
          </div>
          <div
            className="flex min-w-0 flex-1 flex-row-reverse justify-between gap-1.5"
            style={{
              transform: isBuyRound ? 'translateX(0)' : 'translateX(80px)',
              opacity: isBuyRound ? 1 : 0,
              transition: 'transform 440ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms ease',
            }}
          >
            {rightRoster.slice(0, 5).map((p: any, i: number) => (
              <KitBuyCard key={p.id || i} player={p} teamColor={rightTeamColor} income={incomeRight} />
            ))}
          </div>
        </div>
      </div>

      {/* ===== Duel (1v1) mode: survivor panel + camera per side, death strips at the corners ===== */}
      {duelMode && showTeamStats && (
        <>
          {duelSurvivorLeft && (
            <div
              className="absolute bottom-[150px] left-[40px] z-10 flex flex-col items-start gap-2"
              style={{ animation: 'v1InwardLeft 460ms cubic-bezier(0.16, 1, 0.3, 1) both' }}
            >
              <KitPanel
                player={duelSurvivorLeft}
                side="left"
                teamColor={leftTeamColor}
                showKills={showKills}
                showDeaths={showDeaths}
                showAssists={showAssists}
                showEco={showEco}
                showUlts={showUlts}
                teamStatsColor={teamStatsLeftColor}
                isObserved={isObservedPlayer(duelSurvivorLeft, 'left', 0)}
                isUsingUltOverride={Boolean(toggledUlts[String(duelSurvivorLeft.id || duelSurvivorLeft.name || duelSurvivorLeft.alias || 'left-0')])}
                onToggleUlt={() => handleToggleUlt(String(duelSurvivorLeft.id || duelSurvivorLeft.name || duelSurvivorLeft.alias || 'left-0'))}
              />
            </div>
          )}
          {duelSurvivorRight && (
            <div
              className="absolute bottom-[150px] right-[40px] z-10 flex flex-col items-end gap-2"
              style={{ animation: 'v1InwardRight 460ms cubic-bezier(0.16, 1, 0.3, 1) both' }}
            >
              <KitPanel
                player={duelSurvivorRight}
                side="right"
                teamColor={rightTeamColor}
                showKills={showKills}
                showDeaths={showDeaths}
                showAssists={showAssists}
                showEco={showEco}
                showUlts={showUlts}
                teamStatsColor={teamStatsRightColor}
                isObserved={isObservedPlayer(duelSurvivorRight, 'right', 0)}
                isUsingUltOverride={Boolean(toggledUlts[String(duelSurvivorRight.id || duelSurvivorRight.name || duelSurvivorRight.alias || 'right-0')])}
                onToggleUlt={() => handleToggleUlt(String(duelSurvivorRight.id || duelSurvivorRight.name || duelSurvivorRight.alias || 'right-0'))}
              />
            </div>
          )}
        </>
      )}

      {/* ===== Duel (1v1) mode: survivor panel + camera per side, death strips at the corners ===== */}
      {duelMode && showTeamStats && (
        <>
          {duelSurvivorLeft && (
            <div
              className="absolute bottom-[150px] left-[40px] z-10 flex flex-col items-start gap-2"
              style={{ animation: 'v1InwardLeft 460ms cubic-bezier(0.16, 1, 0.3, 1) both' }}
            >
              <KitPanel
                player={duelSurvivorLeft}
                side="left"
                teamColor={leftTeamColor}
                isObserved={isObservedPlayer(duelSurvivorLeft, 'left', 0)}
                isUsingUltOverride={Boolean(toggledUlts[String(duelSurvivorLeft.id || duelSurvivorLeft.name || duelSurvivorLeft.alias || 'left-0')])}
                onToggleUlt={() => handleToggleUlt(String(duelSurvivorLeft.id || duelSurvivorLeft.name || duelSurvivorLeft.alias || 'left-0'))}
              />
              <DuelCamCard
                survivor={duelSurvivorLeft}
                teamColor={leftTeamColor}
                teamLogo={leftTeamLogo}
                showVideo={duelVideoSide === 'left'}
                videoStream={webcamStream}
                videoRef={duelVideoRef}
                photo={duelVideoSide === 'left' ? webcamPlayerPhoto : null}
              />
            </div>
          )}
          {duelSurvivorRight && (
            <div
              className="absolute bottom-[150px] right-[40px] z-10 flex flex-col items-end gap-2"
              style={{ animation: 'v1InwardRight 460ms cubic-bezier(0.16, 1, 0.3, 1) both' }}
            >
              <KitPanel
                player={duelSurvivorRight}
                side="right"
                teamColor={rightTeamColor}
                isObserved={isObservedPlayer(duelSurvivorRight, 'right', 0)}
                isUsingUltOverride={Boolean(toggledUlts[String(duelSurvivorRight.id || duelSurvivorRight.name || duelSurvivorRight.alias || 'right-0')])}
                onToggleUlt={() => handleToggleUlt(String(duelSurvivorRight.id || duelSurvivorRight.name || duelSurvivorRight.alias || 'right-0'))}
              />
              <DuelCamCard
                survivor={duelSurvivorRight}
                teamColor={rightTeamColor}
                teamLogo={rightTeamLogo}
                showVideo={duelVideoSide === 'right'}
                videoStream={webcamStream}
                videoRef={duelVideoRef}
                photo={duelVideoSide === 'right' ? webcamPlayerPhoto : null}
              />
            </div>
          )}
          <div className="absolute bottom-[16px] left-[16px] z-10">
            <DeathStrip players={leftRoster.filter((p: any) => !aliveOf(p))} side="left" />
          </div>
          <div className="absolute bottom-[16px] right-[16px] z-10 flex justify-end">
            <DeathStrip players={rightRoster.filter((p: any) => !aliveOf(p))} side="right" />
          </div>
        </>
      )}

      {/* Game-event banner (classic parity) */}
      {(showGameEvents || liveOnly) && gameEvent && !isCeremonyActive && !(roundEnd && (roundEnd.reason === 'detonation' || roundEnd.reason === 'defusion')) && (
        <div
          className="clickable-component absolute left-1/2 top-[190px] z-40 flex -translate-x-1/2 flex-col items-center justify-center overflow-hidden rounded-md border border-white/20 px-12 py-4 shadow-2xl"
          style={{ background: eventsBg || 'rgba(0,0,0,0.9)' }}
          data-component-id="game-events"
          onClick={e => {
            e.stopPropagation()
            onSelectComponent?.('game-events')
          }}
        >
          <style>{`@keyframes geIn { from { opacity: 0; } to { opacity: 1; } } .ge-in { animation: geIn 300ms ease-out; }`}</style>
          {eventsBg && <div className="ge-in pointer-events-none absolute inset-0" style={{ background: 'rgba(0,0,0,0.45)' }} />}
          <img
            alt=""
            src="/sponsor/Game Event.png"
            className="ge-in relative z-1 object-contain"
            style={{ maxHeight: 56, marginBottom: 4 }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
          />
          <h1 className="ge-in relative z-1 font-schabo text-[64px] uppercase leading-none tracking-wider text-white drop-shadow-lg">
            {gameEvent}
          </h1>
        </div>
      )}

      {/* Facecam (normal mode) — classic identity/fallback chain, kit position */}
      {!duelMode && shouldRenderWebcam && (
        <div
          className="clickable-component absolute z-30 flex cursor-pointer flex-col overflow-hidden rounded-sm border border-white/20 bg-black/95 shadow-2xl"
          data-component-id="webcam"
          style={{ left: 476, bottom: 145, width: 310, height: 174 }}
          onClick={e => {
            e.stopPropagation()
            onSelectComponent?.('webcam')
          }}
        >
          <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#121417]">
            {webcamStream ? (
              <video ref={webcamVideoRef} autoPlay playsInline muted className="size-full object-cover" />
            ) : webcamActive && webcamPlayerPhoto ? (
              <img src={webcamPlayerPhoto} alt="" className="size-full object-cover" />
            ) : facecamFallbackLogo ? (
              <img
                src={facecamFallbackLogo}
                alt=""
                className="size-full object-contain p-5"
                style={{ background: 'radial-gradient(circle at 50% 35%, rgba(255,255,255,0.07), transparent 72%)' }}
              />
            ) : facecamFallbackPortrait ? (
              <img src={facecamFallbackPortrait} alt="" className="size-full object-contain p-2" />
            ) : (
              <div className="text-center">
                <svg className="mx-auto mb-1 w-8 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span className="font-baijam text-[11px] font-bold uppercase tracking-widest text-white/40">
                  {webcamActive ? 'CAMERA FEED' : 'CAMERA OFFLINE'}
                </span>
              </div>
            )}
          </div>
          <div className="flex h-7 items-center justify-between border-t border-white/10 bg-black/90 px-3">
            <span className="font-baijam text-xs font-bold uppercase text-white">{facecamName || 'No camera'}</span>
            {webcamStats && (
              <span className="font-baijam text-[11px] font-bold tabular-nums text-white/70">
                {webcamStats.kills ?? 0} / {webcamStats.deaths ?? 0} / {webcamStats.assists ?? 0}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default BroadcastIngameHudScene
