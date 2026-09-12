import React from 'react'

interface PostGameSceneProps {
  leftTeamName?: string
  rightTeamName?: string
  leftTeamColor?: string
  rightTeamColor?: string
  leftTeamLogo?: string | null
  rightTeamLogo?: string | null
  tournamentLogo?: string | null
  scoreLeft?: number
  scoreRight?: number
  showFooter?: boolean
  leftTeamPlayers?: Array<Record<string, any>>
  rightTeamPlayers?: Array<Record<string, any>>
  activeComponentId?: string | null
  onSelectComponent?: (id: string) => void
  isToggled?: (componentId: string) => boolean
}

export function PostGameScene(props: PostGameSceneProps) {
  const {
    leftTeamName = 'LEFT',
    rightTeamName = 'RIGHT',
    leftTeamColor = '#1DCD9B',
    rightTeamColor = '#FF4848',
    leftTeamLogo = null,
    rightTeamLogo = null,
    tournamentLogo = null,
    scoreLeft = 0,
    scoreRight = 0,
    activeComponentId,
    onSelectComponent,
    isToggled = () => true,
    leftTeamPlayers = [],
    rightTeamPlayers = [],
  } = props
  void isToggled
  void activeComponentId
  const leftWon = scoreLeft >= scoreRight
  const stat = (p: any, k: string) => (p && (p as any)[k] != null ? String((p as any)[k]) : '—')
  const Row = ({ p, side }: { p: any; side: 'left' | 'right' }) => (
    <div className="flex items-center justify-between gap-2 rounded-sm px-2 py-1 text-[15px]" style={{ background: 'rgba(255,255,255,0.04)' }}>
      <span className="font-baijam font-bold uppercase text-white/90 truncate">{String(p?.alias ?? p?.name ?? '').slice(0, 16)}</span>
      <span className="flex shrink-0 items-center gap-2 font-baijam text-[13px] text-white/70">
        <span className="text-[#4ea3fe]">{stat(p, 'kills')}</span>
        <span>/</span>
        <span className="text-[#FF3549]">{stat(p, 'deaths')}</span>
        <span>/</span>
        <span>{stat(p, 'assists')}</span>
        <span className={'ml-1 size-2 rounded-full ' + (p?.isAlive === false ? 'bg-white/20' : 'bg-emerald-400')} title={p?.isAlive === false ? 'dead' : 'alive'} data-dead={side === 'left' ? undefined : undefined} />
      </span>
    </div>
  )
  return (
    <div
      className="scene-root relative size-full min-h-full bg-[#1B1D1F]"
      style={{
        width: 1920,
        height: 1080,
        '--left-team-color': leftTeamColor,
        '--right-team-color': rightTeamColor,
      } as React.CSSProperties}
    >
      <div
        className="clickable-component absolute inset-0 flex cursor-pointer flex-col items-center justify-center gap-8"
        data-component-id="card"
        onClick={(e) => { e.stopPropagation(); onSelectComponent?.('card') }}
      >
        {/* Header: tournament logo + MATCH COMPLETE */}
        <div className="flex flex-col items-center gap-2">
          <img alt="" src={tournamentLogo || '/sponsor/Banner Tournament.png'} className="object-contain" style={{ maxHeight: 54 }} />
          <p className="font-schabo text-[26px] tracking-[6px] text-white/60 uppercase">Match Complete</p>
        </div>

        {/* Scoreboard: team blocks + final score */}
        <div className="flex items-center justify-center gap-10">
          <div className="flex w-[420px] flex-col items-center gap-3 rounded-md border-b-4 px-8 py-6" style={{ borderColor: leftTeamColor, background: `linear-gradient(180deg, ${leftTeamColor}22, rgba(0,0,0,0.4))` }}>
            {leftTeamLogo && <img alt="" src={leftTeamLogo} className="max-h-[110px] max-w-[170px] object-contain" />}
            <p className="font-schabo text-[30px] uppercase tracking-wide text-white">{leftTeamName}</p>
            <p className="font-schabo text-[84px] leading-none" style={{ color: leftWon ? leftTeamColor : '#DADBE3' }}>{scoreLeft}</p>
            {leftWon && <p className="font-baijam text-[13px] font-bold tracking-[4px] text-emerald-400 uppercase">Winner</p>}
          </div>
          <div className="flex flex-col items-center">
            <p className="font-schabo text-[42px] text-white/40">VS</p>
          </div>
          <div className="flex w-[420px] flex-col items-center gap-3 rounded-md border-b-4 px-8 py-6" style={{ borderColor: rightTeamColor, background: `linear-gradient(180deg, ${rightTeamColor}22, rgba(0,0,0,0.4))` }}>
            {rightTeamLogo && <img alt="" src={rightTeamLogo} className="max-h-[110px] max-w-[170px] object-contain" />}
            <p className="font-schabo text-[30px] uppercase tracking-wide text-white">{rightTeamName}</p>
            <p className="font-schabo text-[84px] leading-none" style={{ color: !leftWon ? rightTeamColor : '#DADBE3' }}>{scoreRight}</p>
            {!leftWon && <p className="font-baijam text-[13px] font-bold tracking-[4px] text-emerald-400 uppercase">Winner</p>}
          </div>
        </div>

        {/* Player stats (live snapshot data when available) */}
        {(leftTeamPlayers.length > 0 || rightTeamPlayers.length > 0) && (
          <div className="flex items-start justify-center gap-10">
            <div className="flex w-[420px] flex-col gap-1.5">
              {leftTeamPlayers.slice(0, 5).map((p, i) => <Row key={p?.id ?? i} p={p} side="left" />)}
            </div>
            <div className="w-[70px]" />
            <div className="flex w-[420px] flex-col gap-1.5">
              {rightTeamPlayers.slice(0, 5).map((p, i) => <Row key={p?.id ?? i} p={p} side="right" />)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PostGameScene
export const PostgameScene = PostGameScene
