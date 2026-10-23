import {
  type PostgamePlayer,
  type PostGameSceneProps,
} from '../classic/PostgameScene'
import { agentBust, agentIcon, agentPortrait, hexRgba } from '../broadcastKit'

/**
 * Broadcast kit — post-game scene: side score headers, per-player KO/ACS
 * columns around a center legend, and team-MVP rows with full agent art.
 * Renders ONLY real players (no demo roster — allowDemo is honored as false
 * on live sources, same contract as the classic scene).
 */

export function BroadcastPostgameScene(props: PostGameSceneProps) {
  const {
    leftTeamName = 'TEAM A',
    rightTeamName = 'TEAM B',
    leftTeamColor = '#28D091',
    rightTeamColor = '#FF3549',
    leftTeamLogo = null,
    rightTeamLogo = null,
    scoreLeft = 0,
    scoreRight = 0,
    leftTeamPlayers = [],
    rightTeamPlayers = [],
    allowDemo = false,
  } = props

  const hasAnyAcs = (arr: PostgamePlayer[]) => arr.some(p => p?.acs != null)
  const pickMvp = (arr: PostgamePlayer[]): PostgamePlayer | null => {
    const sorted = [...arr].sort(
      (a, b) =>
        (b.kills ?? 0) - (a.kills ?? 0) ||
        (a.deaths ?? 0) - (b.deaths ?? 0) ||
        (b.assists ?? 0) - (a.assists ?? 0),
    )
    return sorted.length > 0 ? sorted[0] : null
  }
  const leftList = allowDemo ? leftTeamPlayers : leftTeamPlayers || []
  const rightList = allowDemo ? rightTeamPlayers : rightTeamPlayers || []
  const leftMvp = pickMvp(leftList)
  const rightMvp = pickMvp(rightList)
  const leftRows = leftList.filter(p => p !== leftMvp)
  const rightRows = rightList.filter(p => p !== rightMvp)
  const showAcs = hasAnyAcs(leftList) || hasAnyAcs(rightList)
  const showFirstKills = [...leftList, ...rightList].some(p => ((p as any).firstKills ?? null) != null)

  const leftWon = scoreLeft > scoreRight
  const rightWon = scoreRight > scoreLeft

  return (
    <div
      className="relative size-full select-none overflow-hidden font-barlowCond"
      style={{
        width: 1920,
        height: 1080,
        background:
          'radial-gradient(1200px 700px at 50% 44%, rgba(28,38,54,0.55), transparent 70%), linear-gradient(180deg, #0A0E15 0%, #080B11 100%)',
      }}
    >
      {/* ===== Team score headers ===== */}
      <div className="absolute left-[96px] top-[44px] flex items-center gap-4">
        {leftTeamLogo ? (
          <img src={leftTeamLogo} alt="" className="size-[44px] object-contain" />
        ) : (
          <div className="grid size-[40px] place-items-center rounded-full" style={{ background: leftTeamColor }}>
            <span className="font-schabo text-[20px] text-black/80">{(leftTeamName || 'A').slice(0, 1)}</span>
          </div>
        )}
        <span className="font-schabo text-[44px] uppercase leading-none text-white">{leftTeamName}</span>
        <span
          className="font-schabo text-[44px] leading-none tabular-nums"
          style={{ color: leftWon ? '#FFFFFF' : 'rgba(255,255,255,0.38)' }}
        >
          {scoreLeft}
        </span>
      </div>
      <div className="absolute right-[96px] top-[44px] flex items-center gap-4">
        <span
          className="font-schabo text-[44px] leading-none tabular-nums"
          style={{ color: rightWon ? '#FFFFFF' : 'rgba(255,255,255,0.38)' }}
        >
          {scoreRight}
        </span>
        <span className="font-schabo text-[44px] uppercase leading-none text-white">{rightTeamName}</span>
        {rightTeamLogo ? (
          <img src={rightTeamLogo} alt="" className="size-[44px] object-contain" />
        ) : (
          <div className="grid size-[40px] place-items-center rounded-full" style={{ background: rightTeamColor }}>
            <span className="font-schabo text-[20px] text-black/80">{(rightTeamName || 'B').slice(0, 1)}</span>
          </div>
        )}
      </div>

      {/* ===== Center stat legend ===== */}
      <div className="absolute left-1/2 top-[136px] -translate-x-1/2 text-center italic">
        <p className="font-barlowCond text-[15px] font-extrabold uppercase tracking-[0.12em] text-white/45">KO</p>
        {showAcs && <p className="mt-[36px] font-barlowCond text-[15px] font-extrabold uppercase tracking-[0.12em] text-white/45">ACS</p>}
      </div>

      {/* ===== Player rows ===== */}
      <div className="absolute left-0 top-[124px] flex w-full justify-between px-[190px]">
        <div className="flex flex-col gap-[14px]">
          {leftRows.map((p, i) => (
            <PostRow key={p.id ?? i} player={p} side="left" teamColor={leftTeamColor} />
          ))}
        </div>
        <div className="flex flex-col items-end gap-[14px]">
          {rightRows.map((p, i) => (
            <PostRow key={p.id ?? i} player={p} side="right" teamColor={rightTeamColor} />
          ))}
        </div>
      </div>

      {/* ===== Team MVP rows with full agent art ===== */}
      {leftMvp && (
        <MvpBlock player={leftMvp} side="left" teamColor={leftTeamColor} showFirstKills={showFirstKills} />
      )}
      {rightMvp && (
        <MvpBlock player={rightMvp} side="right" teamColor={rightTeamColor} showFirstKills={showFirstKills} />
      )}
    </div>
  )
}

/** One post-game stat row: portrait tile, agent label + name pill, KO/ACS lines. */
function PostRow({
  player,
  side,
  teamColor,
}: {
  player: PostgamePlayer
  side: 'left' | 'right'
  teamColor: string
}) {
  const isRight = side === 'right'
  const name = player.alias || player.name || player.riotId || 'Player'
  const agentLabel = String(player.agentName || player.agent || player.character || '').toUpperCase()
  const k = player.kills ?? 0
  const d = player.deaths ?? 0
  const a = player.assists ?? 0
  const art = player.photoUrl || player.avatarUrl || player.avatar || agentIcon(player)
  return (
    <div className={`flex items-center gap-3 ${isRight ? 'flex-row-reverse' : ''}`}>
      {/* Agent icon tile */}
      <div className="relative size-[54px] shrink-0 overflow-hidden rounded-[2px] border border-white/10 bg-black/40">
        <img
          src={art || agentIcon(player)}
          alt=""
          className="size-full object-cover"
          onError={e => { (e.currentTarget as HTMLImageElement).src = agentIcon(player) }}
        />
      </div>
      {/* Name pill */}
      <div
        className={`flex min-w-0 flex-col justify-center rounded-[2px] px-3 py-1 ${isRight ? 'items-end' : 'items-start'}`}
        style={{
          background: `linear-gradient(${isRight ? '270deg' : '90deg'}, ${hexRgba(teamColor, 0.38)} 0%, rgba(10,14,20,0) 100%)`,
        }}
      >
        <span className="font-baijam text-[9px] font-bold uppercase tracking-[0.18em] text-white/50">{agentLabel}</span>
        <span className="truncate font-barlowCond text-[17px] font-extrabold uppercase italic leading-tight text-white">
          {name}
        </span>
      </div>
      {/* Stats toward the center */}
      <div className={`w-[140px] shrink-0 ${isRight ? 'text-left' : 'text-right'}`}>
        <p className="font-barlowCond text-[19px] font-extrabold italic leading-tight tabular-nums text-white">
          {k} / {d} / {a}
        </p>
        <p className="font-barlowCond text-[15px] font-extrabold italic leading-tight tabular-nums text-white/45">
          {player.acs ?? '–'}
        </p>
      </div>
    </div>
  )
}

/** Team MVP block: upper-body agent art confined to the bottom-left / bottom-right corner + name + stats. */
function MvpBlock({
  player,
  side,
  teamColor,
  showFirstKills,
}: {
  player: PostgamePlayer
  side: 'left' | 'right'
  teamColor: string
  showFirstKills: boolean
}) {
  const isRight = side === 'right'
  const name = player.alias || player.name || player.riotId || 'Player'
  const agentLabel = String(player.agentName || player.agent || player.character || '').toUpperCase()
  const k = player.kills ?? 0
  const d = player.deaths ?? 0
  const a = player.assists ?? 0
  const fk = (player as any).firstKills ?? null
  const bust = agentBust(player)
  const portrait = agentPortrait(player)
  const artSrc = player.photoUrl || (player as any).avatarUrl || (player as any).avatar || bust || portrait

  return (
    <div
      className="pointer-events-none absolute bottom-0 z-10 flex h-[360px] w-[580px] items-end"
      style={{ [isRight ? 'right' : 'left']: 0 }}
    >
      {/* Upper-body agent art confined to the corner box (max 320px wide, 360px high) */}
      <div
        className={`absolute bottom-0 h-[360px] w-[320px] overflow-hidden ${
          isRight ? 'right-0' : 'left-0'
        }`}
      >
        <img
          src={artSrc}
          alt=""
          className={`size-full object-cover ${bust ? 'object-center' : 'object-top'}`}
          style={{
            transform: isRight ? 'scaleX(-1)' : undefined,
            maskImage:
              'linear-gradient(to top, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 20%, rgba(0,0,0,1) 75%, rgba(0,0,0,0) 100%), linear-gradient(' +
              (isRight ? 'to left' : 'to right') +
              ', rgba(0,0,0,1) 60%, rgba(0,0,0,0) 100%)',
            WebkitMaskImage:
              'linear-gradient(to top, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 20%, rgba(0,0,0,1) 75%, rgba(0,0,0,0) 100%), linear-gradient(' +
              (isRight ? 'to left' : 'to right') +
              ', rgba(0,0,0,1) 60%, rgba(0,0,0,0) 100%)',
            maskComposite: 'intersect',
            WebkitMaskComposite: 'destination-in',
            opacity: 0.85,
          }}
          onError={e => {
            if (artSrc !== portrait) {
              ;(e.currentTarget as HTMLImageElement).src = portrait
            } else {
              ;(e.currentTarget as HTMLImageElement).style.visibility = 'hidden'
            }
          }}
        />
      </div>

      {/* Name + MVP pill */}
      <div
        className={`relative z-10 mb-8 flex flex-col ${
          isRight ? 'mr-[120px] items-end ml-auto' : 'ml-[120px] items-start mr-auto'
        }`}
      >
        <span className="font-baijam text-[11px] font-bold uppercase tracking-[0.22em] text-white/55">{agentLabel}</span>
        <span
          className="font-schabo text-[52px] uppercase italic leading-none text-white"
          style={{ textShadow: '0 3px 18px rgba(0,0,0,0.8)' }}
        >
          {name}
        </span>
        <span
          className="mt-1.5 rounded-[2px] px-2.5 py-[3px] font-baijam text-[10px] font-extrabold uppercase tracking-[0.24em]"
          style={{ background: teamColor, color: '#08111A' }}
        >
          MVP
        </span>
      </div>

      {/* Stats toward the center */}
      <div
        className={`relative z-10 mb-8 w-[140px] shrink-0 ${
          isRight ? 'text-left pl-4' : 'text-right pr-4'
        }`}
      >
        <p className="h-[30px] font-barlowCond text-[22px] font-extrabold italic leading-[30px] tabular-nums text-white">
          {k} / {d} / {a}
        </p>
        <p className="h-[26px] font-barlowCond text-[17px] font-extrabold italic leading-[26px] tabular-nums text-white/50">
          {player.acs ?? '–'}
        </p>
        {showFirstKills && (
          <p className="h-[26px] font-barlowCond text-[17px] font-extrabold italic leading-[26px] tabular-nums text-white/80">
            {fk ?? 0}
          </p>
        )}
      </div>
    </div>
  )
}

export default BroadcastPostgameScene
