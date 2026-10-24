import {
  type PostgamePlayer,
  type PostGameSceneProps,
} from '../classic/PostgameScene'
import { agentBust, agentIcon, agentPortrait, agentMasteryPortrait } from '../broadcastKit'
import { resolveAgent } from '../../../data/valAgentMeta'

/**
 * Broadcast kit — post-game scene (exact replication of C:\Users\erna\Documents\KHALZ\Havoc Unleash\images\post game.png):
 * - Perfectly centered and symmetrical layout in 1920x1080 canvas
 * - Left block: X = 330px to 780px (width 450px)
 * - Center column: X = 880px to 1040px (width 160px, center = 960px)
 * - Right block: X = 1140px to 1590px (width 450px, 330px from right margin)
 * - Top score headers aligned directly above player columns
 * - 4 regular player rows (Rows 1-4) with repeated center KD / ACS labels
 * - Bottom MVP section (Row 5) with glowing MVP badge and stats
 * - Upper-body agent bust art framed in bottom corners
 */

function hexRgba(hex: string, alpha: number): string {
  if (!hex) return `rgba(255, 255, 255, ${alpha})`
  let c = hex.replace('#', '')
  if (c.length === 3) c = c.split('').map(x => x + x).join('')
  const num = parseInt(c, 16)
  if (isNaN(num)) return `rgba(255, 255, 255, ${alpha})`
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function isDark(hex: string): boolean {
  if (!hex) return false
  let c = hex.replace('#', '')
  if (c.length === 3) c = c.split('').map(x => x + x).join('')
  const num = parseInt(c, 16)
  if (isNaN(num)) return false
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  return (r * 299 + g * 587 + b * 114) / 1000 < 140
}

const DEMO_PLAYERS_LEFT: PostgamePlayer[] = [
  { id: 'l1', alias: 'ZEKKEN', agentName: 'Jett', kills: 18, deaths: 14, assists: 6, acs: 246 },
  { id: 'l2', alias: 'ZEKKEN', agentName: 'Jett', kills: 18, deaths: 14, assists: 5, acs: 246 },
  { id: 'l3', alias: 'ZEKKEN', agentName: 'Jett', kills: 18, deaths: 14, assists: 4, acs: 246 },
  { id: 'l4', alias: 'ZEKKEN', agentName: 'Jett', kills: 18, deaths: 14, assists: 7, acs: 246 },
  { id: 'l5', alias: 'ZEKKEN', agentName: 'Neon', kills: 18, deaths: 14, assists: 8, acs: 246 },
]

const DEMO_PLAYERS_RIGHT: PostgamePlayer[] = [
  { id: 'r1', alias: 'WALKEMDOWNBUFORD', agentName: 'Fade', kills: 18, deaths: 14, assists: 8, acs: 246 },
  { id: 'r2', alias: 'ZEKKEN', agentName: 'Jett', kills: 18, deaths: 14, assists: 4, acs: 246 },
  { id: 'r3', alias: 'ZEKKEN', agentName: 'Jett', kills: 18, deaths: 14, assists: 6, acs: 246 },
  { id: 'r4', alias: 'ZEKKEN', agentName: 'Jett', kills: 18, deaths: 14, assists: 3, acs: 246 },
  { id: 'r5', alias: 'ZEKKEN', agentName: 'Jett', kills: 18, deaths: 14, assists: 7, acs: 246 },
]

export function BroadcastPostgameScene(props: PostGameSceneProps) {
  const {
    leftTeamName = 'SENTINELS',
    rightTeamName = 'SENTINELS',
    leftTeamColor = '#1DCD9B',
    rightTeamColor = '#FF3549',
    leftTeamLogo = null,
    rightTeamLogo = null,
    scoreLeft = 12,
    scoreRight = 13,
    leftTeamPlayers = [],
    rightTeamPlayers = [],
    allowDemo = true,
    activeComponentId,
    onSelectComponent,
  } = props

  const totalRounds = Math.max(1, (scoreLeft ?? 0) + (scoreRight ?? 0))

  const getPlayerAcs = (p: any): number => {
    if (!p) return 0
    if (typeof p.acs === 'number' && p.acs > 0) return p.acs
    if (typeof p.score === 'number' && p.score > 0) return Math.round(p.score / totalRounds)
    const k = Number(p.kills ?? 0)
    const fb = Number(p.firstBloods ?? p.firstKills ?? 0)
    const a = Number(p.assists ?? 0)
    if (k === 0 && fb === 0 && a === 0) return 0
    return Math.round((k * 140 + fb * 70 + a * 25) / totalRounds)
  }

  const getPlayerFirstKills = (p: any): number => {
    if (!p) return 0
    return Number(p.firstKills ?? p.firstBloods ?? p.first_blood ?? 0)
  }

  const pickMvp = (arr: PostgamePlayer[]): PostgamePlayer | null => {
    if (arr.length === 0) return null
    const sorted = [...arr].sort(
      (a, b) =>
        getPlayerAcs(b) - getPlayerAcs(a) ||
        (b.kills ?? 0) - (a.kills ?? 0) ||
        (a.deaths ?? 0) - (b.deaths ?? 0) ||
        (b.assists ?? 0) - (a.assists ?? 0),
    )
    return sorted[0]
  }

  // Populate list with demo data if rosters are empty
  const rawLeft = leftTeamPlayers && leftTeamPlayers.length > 0 ? leftTeamPlayers : (allowDemo ? DEMO_PLAYERS_LEFT : [])
  const rawRight = rightTeamPlayers && rightTeamPlayers.length > 0 ? rightTeamPlayers : (allowDemo ? DEMO_PLAYERS_RIGHT : [])

  const leftMvp = pickMvp(rawLeft)
  const rightMvp = pickMvp(rawRight)

  // Remaining 4 players for the top 4 rows
  const leftRows = rawLeft.filter(p => p !== leftMvp).slice(0, 4)
  const rightRows = rawRight.filter(p => p !== rightMvp).slice(0, 4)

  // Pad to 4 if needed
  while (leftRows.length < 4) {
    leftRows.push({ id: `pad-l-${leftRows.length}`, alias: `PLAYER ${leftRows.length + 1}`, agentName: 'Neon', kills: 0, deaths: 0, acs: 0 })
  }
  while (rightRows.length < 4) {
    rightRows.push({ id: `pad-r-${rightRows.length}`, alias: `PLAYER ${rightRows.length + 1}`, agentName: 'Neon', kills: 0, deaths: 0, acs: 0 })
  }

  const leftWon = scoreLeft > scoreRight
  const rightWon = scoreRight > scoreLeft

  return (
    <div
      className={`clickable-component scene-root relative size-full select-none overflow-hidden font-barlowCond ${
        activeComponentId === 'card' || activeComponentId === 'background' ? 'selected' : ''
      }`}
      data-component-id="card"
      onClick={() => onSelectComponent?.('card')}
      style={{
        width: 1920,
        height: 1080,
        background: '#090D14',
      }}
    >
      {/* Background radial gradient glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(1100px 650px at 50% 42%, rgba(26, 36, 52, 0.5), transparent 75%)',
        }}
      />

      {/* Background Cyber Circuit Traces (centered at X=960, matching post game.png) */}
      <svg
        className="pointer-events-none absolute inset-x-0 top-0 h-[650px] w-full opacity-25"
        viewBox="0 0 1920 650"
        fill="none"
      >
        <path d="M 960 0 V 100 L 920 140 V 310 L 880 350 H 760" stroke="#38BDF8" strokeWidth="1.5" strokeOpacity="0.45" />
        <path d="M 960 0 V 100 L 1000 140 V 310 L 1040 350 H 1160" stroke="#38BDF8" strokeWidth="1.5" strokeOpacity="0.45" />
        <path d="M 920 50 L 840 130 V 270 L 790 320 H 720" stroke="#38BDF8" strokeWidth="1.5" strokeOpacity="0.3" />
        <path d="M 1000 50 L 1080 130 V 270 L 1130 320 H 1200" stroke="#38BDF8" strokeWidth="1.5" strokeOpacity="0.3" />
        <path d="M 960 140 V 240 L 935 265 V 360 L 900 395 H 850" stroke="#38BDF8" strokeWidth="1" strokeOpacity="0.25" />
        <path d="M 960 140 V 240 L 985 265 V 360 L 1020 395 H 1070" stroke="#38BDF8" strokeWidth="1" strokeOpacity="0.25" />
        <circle cx="760" cy="350" r="3" fill="#38BDF8" />
        <circle cx="1160" cy="350" r="3" fill="#38BDF8" />
        <circle cx="720" cy="320" r="3" fill="#38BDF8" />
        <circle cx="1200" cy="320" r="3" fill="#38BDF8" />
      </svg>

      {/* Staggered entrance animation: Team headers top-to-bottom -> Non-MVP inward -> MVP bottom-to-top */}
      <style>{`
        @keyframes postgameTopDown {
          0% {
            opacity: 0;
            transform: translateY(-55px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes postgameInwardLeft {
          0% {
            opacity: 0;
            transform: translateX(-80px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes postgameInwardRight {
          0% {
            opacity: 0;
            transform: translateX(80px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes postgameFadeCenter {
          0% {
            opacity: 0;
            transform: scale(0.88);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes postgameBottomUp {
          0% {
            opacity: 0;
            transform: translateY(90px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes postgameBustFadeIn {
          0% {
            opacity: 0;
            transform: scale(0.94) translateY(60px);
          }
          100% {
            opacity: 0.95;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>

      {/* =========================================================================
          TOP SCORE HEADERS (top: 72px) - Transition 1: Top to Bottom
          Left Header starts at X = 330px
          Right Header ends at X = 1590px (right: 330px)
         ========================================================================= */}
      <div
        className="pointer-events-none absolute inset-x-0 top-[72px] h-[52px]"
        style={{ animation: 'postgameTopDown 550ms cubic-bezier(0.16, 1, 0.3, 1) both' }}
      >
        {/* Left Team Header: Logo -> Team Name -> Score -> Vertical Tallies */}
        <div
          className="pointer-events-auto absolute flex items-center gap-3.5"
          style={{ left: 330 }}
        >
          {leftTeamLogo ? (
            <img src={leftTeamLogo} alt="" className="size-[42px] object-contain drop-shadow" />
          ) : (
            <div className="grid size-[38px] place-items-center rounded-full" style={{ background: leftTeamColor }}>
              <span className="font-schabo text-[20px] text-black">{(leftTeamName || 'A').slice(0, 1)}</span>
            </div>
          )}
          <span className="font-barlowCond text-[44px] font-black uppercase tracking-wider text-white leading-none">
            {leftTeamName}
          </span>
          <span
            className="font-barlowCond text-[44px] font-bold leading-none tabular-nums ml-1"
            style={{ color: leftWon ? '#FFFFFF' : '#5A6270' }}
          >
            {scoreLeft}
          </span>
          {/* 4 Vertical Tally Marks */}
          <div className="flex flex-col gap-[3px] ml-3 opacity-30">
            <div className="h-[6px] w-[16px] rounded-[1px] border border-white/60 bg-white/10" />
            <div className="h-[6px] w-[16px] rounded-[1px] border border-white/60 bg-white/10" />
            <div className="h-[6px] w-[16px] rounded-[1px] border border-white/60 bg-white/10" />
            <div className="h-[6px] w-[16px] rounded-[1px] border border-white/60 bg-white/10" />
          </div>
        </div>

        {/* Right Team Header: Vertical Tallies -> Score -> Team Name -> Logo */}
        <div
          className="pointer-events-auto absolute flex items-center gap-3.5"
          style={{ right: 330 }}
        >
          {/* 4 Vertical Tally Marks */}
          <div className="flex flex-col gap-[3px] mr-3 opacity-30">
            <div className="h-[6px] w-[16px] rounded-[1px] border border-white/60 bg-white/10" />
            <div className="h-[6px] w-[16px] rounded-[1px] border border-white/60 bg-white/10" />
            <div className="h-[6px] w-[16px] rounded-[1px] border border-white/60 bg-white/10" />
            <div className="h-[6px] w-[16px] rounded-[1px] border border-white/60 bg-white/10" />
          </div>
          <span
            className="font-barlowCond text-[44px] font-bold leading-none tabular-nums mr-1"
            style={{ color: rightWon ? '#FFFFFF' : '#5A6270' }}
          >
            {scoreRight}
          </span>
          <span className="font-barlowCond text-[44px] font-black uppercase tracking-wider text-white leading-none">
            {rightTeamName}
          </span>
          {rightTeamLogo ? (
            <img src={rightTeamLogo} alt="" className="size-[42px] object-contain drop-shadow" />
          ) : (
            <div className="grid size-[38px] place-items-center rounded-full" style={{ background: rightTeamColor }}>
              <span className="font-schabo text-[20px] text-black">{(rightTeamName || 'B').slice(0, 1)}</span>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          ROWS 1 TO 4: REGULAR PLAYERS (top: 200px, 295px, 390px, 485px)
          Left Block:  X = 330px to 780px (width 450px)
          Center:      X = 880px to 1040px (width 160px, center = 960px)
          Right Block: X = 1140px to 1590px (width 450px)
         ========================================================================= */}
      {Array.from({ length: 4 }).map((_, i) => {
        const lp = leftRows[i]
        const rp = rightRows[i]
        const rowTop = 200 + i * 95

        const lAgentName = (resolveAgent(lp)?.name || lp?.agentName || lp?.agent || 'NEON').toUpperCase()
        const lPlayerName = (lp?.alias || lp?.name || lp?.riotId || 'ZEKKEN').toUpperCase()

        const rAgentName = (resolveAgent(rp)?.name || rp?.agentName || rp?.agent || 'NEON').toUpperCase()
        const rPlayerName = (rp?.alias || rp?.name || rp?.riotId || 'ZEKKEN').toUpperCase()

        return (
          <div
            key={i}
            className="pointer-events-none absolute inset-x-0 h-[62px]"
            style={{ top: rowTop }}
          >
            {/* Left Block (330px to 780px, width 450px) - Transition 2: Outward to Inward */}
            <div
              className="pointer-events-auto absolute flex h-full items-center justify-between"
              style={{
                left: 330,
                width: 450,
                animation: 'postgameInwardLeft 500ms cubic-bezier(0.16, 1, 0.3, 1) both',
                animationDelay: `${0.35 + i * 0.08}s`,
              }}
            >
              {/* Player Card: Icon + Agent/Player Names with Team Color Gradient to Transparent */}
              <div
                className="relative flex items-center gap-3 rounded-[3px] py-1 pl-2 pr-7"
                style={{
                  background: `linear-gradient(90deg, ${hexRgba(leftTeamColor, 0.44)} 0%, ${hexRgba(leftTeamColor, 0.16)} 45%, transparent 100%)`,
                }}
              >
                <img
                  src={agentIcon(lp)}
                  alt=""
                  className="size-[46px] shrink-0 object-contain drop-shadow"
                  onError={e => {
                    ;(e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
                  }}
                />
                <div className="flex flex-col items-start leading-none">
                  <span className="font-baijam text-[10px] font-bold uppercase tracking-[0.2em] text-[#8E96A6]">
                    {lAgentName}
                  </span>
                  <span className="mt-1 font-barlowCond text-[20px] font-black uppercase tracking-wider text-white">
                    {lPlayerName}
                  </span>
                </div>
              </div>

              {/* Left Stats: Right-aligned at the end of left block */}
              <div className="flex flex-col items-end leading-none">
                <span className="font-barlowCond text-[22px] font-bold text-white tabular-nums">
                  {lp?.kills ?? 0} / {lp?.deaths ?? 0}
                </span>
                <span className="mt-1 font-barlowCond text-[22px] font-bold text-white tabular-nums">
                  {getPlayerAcs(lp)}
                </span>
              </div>
            </div>

            {/* Center Column: KD / ACS (880px to 1040px, width 160px) */}
            <div
              className="pointer-events-auto absolute flex h-full flex-col items-center justify-center text-center leading-none"
              style={{
                left: 880,
                width: 160,
                animation: 'postgameFadeCenter 450ms ease-out both',
                animationDelay: `${0.42 + i * 0.08}s`,
              }}
            >
              <span className="font-baijam text-[11px] font-bold tracking-widest text-[#6E7687] uppercase">
                KD
              </span>
              <span className="mt-2.5 font-baijam text-[11px] font-bold tracking-widest text-[#6E7687] uppercase">
                ACS
              </span>
            </div>

            {/* Right Block (1140px to 1590px, width 450px) - Transition 2: Outward to Inward */}
            <div
              className="pointer-events-auto absolute flex h-full items-center justify-between"
              style={{
                left: 1140,
                width: 450,
                animation: 'postgameInwardRight 500ms cubic-bezier(0.16, 1, 0.3, 1) both',
                animationDelay: `${0.35 + i * 0.08}s`,
              }}
            >
              {/* Right Stats: Left-aligned at the start of right block */}
              <div className="flex flex-col items-start leading-none">
                <span className="font-barlowCond text-[22px] font-bold text-white tabular-nums">
                  {rp?.kills ?? 0} / {rp?.deaths ?? 0}
                </span>
                <span className="mt-1 font-barlowCond text-[22px] font-bold text-white tabular-nums">
                  {getPlayerAcs(rp)}
                </span>
              </div>

              {/* Player Card: Agent/Player Names + Icon with Team Color Gradient to Transparent (flipped order) */}
              <div
                className="relative flex items-center gap-3 rounded-[3px] py-1 pr-2 pl-7"
                style={{
                  background: `linear-gradient(270deg, ${hexRgba(rightTeamColor, 0.44)} 0%, ${hexRgba(rightTeamColor, 0.16)} 45%, transparent 100%)`,
                }}
              >
                <div className="flex flex-col items-end leading-none">
                  <span className="font-baijam text-[10px] font-bold uppercase tracking-[0.2em] text-[#8E96A6] text-right">
                    {rAgentName}
                  </span>
                  <span className="mt-1 font-barlowCond text-[20px] font-black uppercase tracking-wider text-white text-right">
                    {rPlayerName}
                  </span>
                </div>
                <img
                  src={agentIcon(rp)}
                  alt=""
                  className="size-[46px] shrink-0 object-contain drop-shadow"
                  onError={e => {
                    ;(e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
                  }}
                />
              </div>
            </div>
          </div>
        )
      })}

      {/* =========================================================================
          ROW 5: BOTTOM MVP HIGHLIGHT (bottom: 75px) - Transition 3: Bottom to Top
          Left Block:  X = 330px to 780px (width 450px)
          Center:      X = 880px to 1040px (width 160px, center = 960px)
          Right Block: X = 1140px to 1590px (width 450px)
         ========================================================================= */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-[75px] z-20 h-[100px]"
        style={{
          animation: 'postgameBottomUp 700ms cubic-bezier(0.16, 1, 0.3, 1) both',
          animationDelay: '0.85s',
        }}
      >
        {/* Left MVP Block */}
        {leftMvp && (
          <div
            className="pointer-events-auto absolute flex h-full items-end justify-between"
            style={{ left: 330, width: 450 }}
          >
            {/* MVP Identity */}
            <div className="flex flex-col items-start leading-none">
              <span className="font-baijam text-[13px] font-bold uppercase tracking-[0.22em] text-[#8A94A6]">
                {(resolveAgent(leftMvp)?.name || leftMvp.agentName || leftMvp.agent || 'NEON').toUpperCase()}
              </span>
              <span className="mt-1 font-barlowCond text-[46px] font-black uppercase text-white leading-none tracking-wide drop-shadow-[0_4px_12px_rgba(0,0,0,0.95)]">
                {(leftMvp.alias || leftMvp.name || leftMvp.riotId || 'ZEKKEN').toUpperCase()}
              </span>
              {/* Glowing Team-Color MVP Badge with Trailing Line */}
              <div className="mt-2.5 flex items-center gap-2">
                <span
                  className="rounded-[2px] px-2.5 py-0.5 font-baijam text-[11px] font-black uppercase tracking-wider"
                  style={{
                    background: leftTeamColor,
                    color: isDark(leftTeamColor) ? '#FFFFFF' : '#0A0D14',
                    boxShadow: `0 0 14px ${hexRgba(leftTeamColor, 0.75)}`,
                  }}
                >
                  MVP
                </span>
                <div
                  className="h-[2px] w-24"
                  style={{ background: `linear-gradient(90deg, ${leftTeamColor}, transparent)` }}
                />
              </div>
            </div>

            {/* Left MVP Stats (Right-aligned) */}
            <div className="flex flex-col items-end leading-none pb-0.5">
              <span className="font-barlowCond text-[26px] font-bold text-white tabular-nums">
                {leftMvp.kills ?? 0} / {leftMvp.deaths ?? 0}
              </span>
              <span className="mt-2 font-barlowCond text-[26px] font-bold text-white tabular-nums">
                {getPlayerAcs(leftMvp)}
              </span>
              <span className="mt-2 font-barlowCond text-[26px] font-bold text-white tabular-nums">
                {getPlayerFirstKills(leftMvp)}
              </span>
            </div>
          </div>
        )}

        {/* Center MVP Stat Legend */}
        <div
          className="pointer-events-auto absolute flex h-full flex-col items-center justify-end text-center leading-none pb-1"
          style={{ left: 880, width: 160 }}
        >
          <span className="font-baijam text-[11px] font-bold tracking-widest text-[#6E7687] uppercase">
            KD
          </span>
          <span className="mt-3.5 font-baijam text-[11px] font-bold tracking-widest text-[#6E7687] uppercase">
            ACS
          </span>
          <span className="mt-3.5 font-baijam text-[11px] font-bold tracking-widest text-[#6E7687] uppercase whitespace-nowrap">
            FIRST KILLS
          </span>
        </div>

        {/* Right MVP Block */}
        {rightMvp && (
          <div
            className="pointer-events-auto absolute flex h-full items-end justify-between"
            style={{ left: 1140, width: 450 }}
          >
            {/* Right MVP Stats (Left-aligned) */}
            <div className="flex flex-col items-start leading-none pb-0.5">
              <span className="font-barlowCond text-[26px] font-bold text-white tabular-nums">
                {rightMvp.kills ?? 0} / {rightMvp.deaths ?? 0}
              </span>
              <span className="mt-2 font-barlowCond text-[26px] font-bold text-white tabular-nums">
                {getPlayerAcs(rightMvp)}
              </span>
              <span className="mt-2 font-barlowCond text-[26px] font-bold text-white tabular-nums">
                {getPlayerFirstKills(rightMvp)}
              </span>
            </div>

            {/* MVP Identity (Right-aligned) */}
            <div className="flex flex-col items-end leading-none">
              <span className="font-baijam text-[13px] font-bold uppercase tracking-[0.22em] text-[#8A94A6] text-right">
                {(resolveAgent(rightMvp)?.name || rightMvp.agentName || rightMvp.agent || 'NEON').toUpperCase()}
              </span>
              <span className="mt-1 font-barlowCond text-[44px] font-black uppercase text-white leading-none tracking-wide text-right drop-shadow-[0_4px_12px_rgba(0,0,0,0.95)]">
                {(rightMvp.alias || rightMvp.name || rightMvp.riotId || 'WALKEMDOWNBUFORD').toUpperCase()}
              </span>
              {/* Glowing Team-Color MVP Badge with Trailing Line */}
              <div className="mt-2.5 flex items-center justify-end gap-2">
                <div
                  className="h-[2px] w-24"
                  style={{ background: `linear-gradient(270deg, ${rightTeamColor}, transparent)` }}
                />
                <span
                  className="rounded-[2px] px-2.5 py-0.5 font-baijam text-[11px] font-black uppercase tracking-wider"
                  style={{
                    background: rightTeamColor,
                    color: isDark(rightTeamColor) ? '#FFFFFF' : '#0A0D14',
                    boxShadow: `0 0 14px ${hexRgba(rightTeamColor, 0.75)}`,
                  }}
                >
                  MVP
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          BACKGROUND UPPER-BODY BUST ART IN CORNERS
         ========================================================================= */}
      {leftMvp && <MvpBustArt player={leftMvp} side="left" />}
      {rightMvp && <MvpBustArt player={rightMvp} side="right" />}
    </div>
  )
}

/** Background Upper-body agent art confined to bottom corner (post game.png). */
function MvpBustArt({
  player,
  side,
}: {
  player: PostgamePlayer
  side: 'left' | 'right'
}) {
  const isRight = side === 'right'
  const mastery = agentMasteryPortrait(player)
  const bust = agentBust(player)
  const portrait = agentPortrait(player)
  const artSrc = player.photoUrl || (player as any).avatarUrl || (player as any).avatar || mastery || bust || portrait

  return (
    <div
      className={`pointer-events-none absolute bottom-0 z-10 h-[560px] w-[540px] overflow-hidden ${
        isRight ? 'right-0' : 'left-0'
      }`}
      style={{
        animation: 'postgameBustFadeIn 800ms cubic-bezier(0.16, 1, 0.3, 1) both',
        animationDelay: '0.92s',
      }}
    >
      <img
        src={artSrc}
        alt=""
        className="size-full object-cover object-top"
        style={{
          transform: `${isRight ? 'scaleX(-1) ' : ''}scale(1.22) translateY(6%)`,
          transformOrigin: 'top center',
          maskImage:
            'linear-gradient(to top, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 15%, rgba(0,0,0,1) 85%, rgba(0,0,0,0) 100%), linear-gradient(' +
            (isRight ? 'to left' : 'to right') +
            ', rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%)',
          WebkitMaskImage:
            'linear-gradient(to top, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 15%, rgba(0,0,0,1) 85%, rgba(0,0,0,0) 100%), linear-gradient(' +
            (isRight ? 'to left' : 'to right') +
            ', rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%)',
          maskComposite: 'intersect',
          WebkitMaskComposite: 'destination-in',
          opacity: 0.95,
        }}
        onError={e => {
          if (artSrc !== bust && bust) {
            ;(e.currentTarget as HTMLImageElement).src = bust
          } else if (artSrc !== portrait && portrait) {
            ;(e.currentTarget as HTMLImageElement).src = portrait
          } else {
            ;(e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
          }
        }}
      />
    </div>
  )
}

export default BroadcastPostgameScene

