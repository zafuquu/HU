import React, { useMemo } from 'react'
import { resolveAgent } from '../../data/valAgentMeta'

export interface PostgamePlayer {
  id: string | number
  name?: string
  alias?: string
  riotId?: string
  agentName?: string | null
  agent?: string | null
  character?: string | null
  kills?: number
  deaths?: number
  assists?: number
  score?: number
  acs?: number
  avatar?: string | null
  photoUrl?: string | null
  avatarUrl?: string | null
  isAlive?: boolean
}

export interface PostGameSceneProps {
  leftTeamName?: string
  rightTeamName?: string
  leftTeamColor?: string
  rightTeamColor?: string
  leftTeamLogo?: string | null
  rightTeamLogo?: string | null
  scoreLeft?: number
  scoreRight?: number
  showFooter?: boolean
  leftTeamPlayers?: PostgamePlayer[]
  rightTeamPlayers?: PostgamePlayer[]
  activeComponentId?: string | null
  onSelectComponent?: (id: string) => void
  isToggled?: (componentId: string) => boolean
}

interface AgentCardConfig {
  image?: string
  rotation: number
  scale: number
  x: string
  xFlipped: string
  y: string
  flipX?: boolean
}

const AGENT_CONFIGS: Record<string, AgentCardConfig> = {
  aggrobot: { rotation: 0, scale: 2, x: '-30%', xFlipped: '30%', y: '22%' },
  bountyhunter: { rotation: 0, scale: 1.6, x: '-30%', xFlipped: '30%', y: '5%' },
  breach: { rotation: -2, scale: 1.7, x: '-25%', xFlipped: '25%', y: '13%' },
  cable: { rotation: 0, scale: 1.8, x: '-35%', xFlipped: '35%', y: '16%' },
  cashew: { rotation: 0, scale: 2, x: '-30%', xFlipped: '30%', y: '25%' },
  clay: { rotation: 5, scale: 2.2, x: '-20%', xFlipped: '15%', y: '25%' },
  clove: { rotation: 0, scale: 2.2, x: '-25%', xFlipped: '25%', y: '20%' },
  deadeye: { flipX: true, rotation: 0, scale: 2.2, x: '-30%', xFlipped: '25%', y: '30%' },
  grenadier: { rotation: -5, scale: 1.7, x: '-15%', xFlipped: '25%', y: '16%' },
  guide: { rotation: 0, scale: 2.2, x: '-30%', xFlipped: '30%', y: '23%' },
  gumshoe: { rotation: 0, scale: 2.5, x: '-20%', xFlipped: '20%', y: '40%' },
  hunter: { rotation: 0, scale: 2, x: '-25%', xFlipped: '25%', y: '25%' },
  iris: { rotation: 0, scale: 2, x: '-25%', xFlipped: '25%', y: '25%' },
  killjoy: { flipX: true, rotation: 0, scale: 2.3, x: '-30%', xFlipped: '30%', y: '28%' },
  mage: { rotation: -5, scale: 2.3, x: '-10%', xFlipped: '20%', y: '33%' },
  nox: { rotation: 0, scale: 2.3, x: '-32%', xFlipped: '32%', y: '38%' },
  pandemic: { rotation: 0, scale: 2.3, x: '-25%', xFlipped: '25%', y: '28%' },
  phoenix: { flipX: true, rotation: 0, scale: 2.3, x: '-25%', xFlipped: '25%', y: '32%' },
  pine: { rotation: 0, scale: 2.7, x: '-20%', xFlipped: '20%', y: '60%' },
  rift: { rotation: -8, scale: 2.2, x: '-20%', xFlipped: '35%', y: '19%' },
  sarge: { rotation: 0, scale: 2, x: '-23%', xFlipped: '23%', y: '23%' },
  sequoia: { flipX: true, rotation: 0, scale: 2, x: '-20%', xFlipped: '20%', y: '20%' },
  smonk: { flipX: true, rotation: 0, scale: 2, x: '-18%', xFlipped: '18%', y: '22%' },
  sprinter: { rotation: 0, scale: 1.7, x: '-20%', xFlipped: '20%', y: '10%' },
  stealth: { flipX: true, rotation: 0, scale: 2.2, x: '-23%', xFlipped: '23%', y: '24%' },
  terra: { flipX: true, rotation: 0, scale: 2.3, x: '-25%', xFlipped: '25%', y: '20%' },
  thorne: { flipX: true, rotation: 0, scale: 2.5, x: '-20%', xFlipped: '20%', y: '32%' },
  vampire: { rotation: 0, scale: 2.3, x: '-30%', xFlipped: '30%', y: '26%' },
  vyse: { rotation: 0, scale: 2.2, x: '-25%', xFlipped: '25%', y: '20%' },
  wraith: { rotation: 0, scale: 2.5, x: '-22%', xFlipped: '22%', y: '30%' },
  wushu: { flipX: true, rotation: 0, scale: 2.9, x: '-20%', xFlipped: '20%', y: '42%' },
}

const DEMO_PLAYERS_LEFT: PostgamePlayer[] = [
  { id: '1', alias: 'Player 1', agentName: 'clay', kills: 24, deaths: 12, assists: 6, acs: 310 },
  { id: '2', alias: 'Player 2', agentName: 'wushu', kills: 18, deaths: 14, assists: 4, acs: 240 },
  { id: '3', alias: 'Player 3', agentName: 'hunter', kills: 15, deaths: 13, assists: 8, acs: 210 },
  { id: '4', alias: 'Player 4', agentName: 'sarge', kills: 12, deaths: 15, assists: 7, acs: 180 },
  { id: '5', alias: 'Player 5', agentName: 'thorne', kills: 9, deaths: 16, assists: 11, acs: 145 },
]

const DEMO_PLAYERS_RIGHT: PostgamePlayer[] = [
  { id: '6', alias: 'Player 6', agentName: 'deadeye', kills: 22, deaths: 14, assists: 3, acs: 285 },
  { id: '7', alias: 'Player 7', agentName: 'guide', kills: 17, deaths: 15, assists: 9, acs: 230 },
  { id: '8', alias: 'Player 8', agentName: 'aggrobot', kills: 14, deaths: 16, assists: 6, acs: 195 },
  { id: '9', alias: 'Player 9', agentName: 'breach', kills: 11, deaths: 17, assists: 10, acs: 160 },
  { id: '10', alias: 'Player 10', agentName: 'cable', kills: 8, deaths: 16, assists: 5, acs: 130 },
]

interface PlayerCardProps {
  player: PostgamePlayer
  color: string
  isBestPlayer: boolean
  isFlipped: boolean
  isWinningTeam: boolean
}

function PlayerCard({ player, color, isBestPlayer, isFlipped, isWinningTeam }: PlayerCardProps) {
  const agentResolved = resolveAgent(player)
  const codename = agentResolved?.codename || 'clay'
  const portraitUrl = agentResolved?.portrait || `/game/val/agents/${codename}/portrait.png`
  const cfg = AGENT_CONFIGS[codename] || {
    rotation: 0,
    scale: 2,
    x: isFlipped ? '25%' : '-25%',
    xFlipped: '25%',
    y: '20%',
    flipX: false,
  }

  const o = cfg.flipX ? -1 : 1
  const scaleMult = isBestPlayer ? 1.25 : 1
  const transformStyle = [
    `translate(${isFlipped ? cfg.xFlipped : cfg.x}, ${cfg.y})`,
    `rotate(${cfg.rotation}deg)`,
    `scaleX(${isFlipped ? cfg.scale * o * scaleMult : -cfg.scale * o * scaleMult})`,
    `scaleY(${cfg.scale * scaleMult})`,
  ].join(' ')

  const playerName = player.alias || player.name || player.riotId || 'Player'
  const kills = player.kills ?? 0
  const deaths = player.deaths ?? 0
  const assists = player.assists ?? 0
  const acs = player.acs ?? player.score ?? null

  return (
    <div
      className={`relative flex w-[590px] overflow-hidden rounded-[5px] border-[2px] border-white transition-all duration-300 ${
        isBestPlayer ? 'h-[219px] shadow-2xl shadow-black/80' : 'h-[105px]'
      }`}
      style={{ '--post-game-card-color': color } as React.CSSProperties}
    >
      {/* Background Gradient Layers */}
      <div className={`absolute top-0 left-0 z-1 size-full ${isWinningTeam ? 'hidden' : ''}`}>
        <div
          className="absolute top-0 left-0 z-1 size-full"
          style={{ backgroundImage: 'linear-gradient(to bottom, var(--post-game-card-color), #000000)' }}
        />
        <div className="absolute top-0 left-0 z-2 size-full bg-black mix-blend-hue" />
        <div
          className="absolute top-0 left-0 z-3 size-full"
          style={{
            backgroundImage: `linear-gradient(${isFlipped ? '20deg' : '30deg'}, var(--post-game-card-color) 0%, rgba(0, 0, 0, 0) 30%)`,
          }}
        />
        <div
          className="absolute top-0 left-0 z-3 size-full"
          style={{
            backgroundImage: `linear-gradient(${isFlipped ? '-30deg' : '-20deg'}, var(--post-game-card-color) 0%, rgba(0, 0, 0, 0) 30%)`,
          }}
        />
        <div
          className="absolute top-0 left-0 z-4 size-full"
          style={{
            backgroundImage: `linear-gradient(${isFlipped ? '-35deg' : '35deg'}, rgb(0, 0, 0) 0%, rgba(0, 0, 0, 0) 30%)`,
          }}
        />
        <div className="absolute top-0 left-0 z-5 size-full bg-black/20" />
        <div
          className="absolute top-0 left-0 z-6 size-full"
          style={{ backgroundImage: 'linear-gradient(to bottom, #00000000, #000000)' }}
        />
      </div>

      <div className={`absolute top-0 left-0 z-1 size-full ${!isWinningTeam ? 'hidden' : ''}`}>
        <div className="absolute top-0 left-0 z-1 size-full bg-black" />
        <div
          className="absolute top-0 left-0 z-2 size-full opacity-25"
          style={{
            backgroundImage: `linear-gradient(to ${isFlipped ? 'right' : 'left'}, var(--post-game-card-color), #000000 50%)`,
          }}
        />
        <div
          className="absolute top-0 left-0 z-3 size-full opacity-20"
          style={{ backgroundImage: 'linear-gradient(to bottom, var(--post-game-card-color) 10%, #000000)' }}
        />
        <div className="absolute top-0 left-0 z-4 size-full bg-[var(--post-game-card-color)] mix-blend-hue" />
        <div
          className="absolute top-0 left-0 z-5 size-full"
          style={{
            backgroundImage: `linear-gradient(${isFlipped ? '-30deg' : '30deg'}, var(--post-game-card-color) 0%, rgba(0, 0, 0, 0) 30%)`,
          }}
        />
        <div className="absolute top-0 left-0 z-6 size-full bg-black/20" />
      </div>

      {/* MVP Text Banner Ribbon */}
      {isBestPlayer && (
        <div
          className={`absolute z-20 w-[80%] pointer-events-none ${isFlipped ? 'left-0' : 'right-0'} -top-2.5`}
        >
          <img
            className="w-full object-contain -translate-y-1/2 drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]"
            src="/overlays/val-classic/post-game/assets/mvp-text.png"
            alt="MVP"
          />
        </div>
      )}

      {/* Card Content */}
      <div className="z-10 flex size-full">
        {/* Left Edge Accent */}
        <div className="z-2 h-full p-0.5">
          <div className="h-full w-[6px] rounded-l-[3px] bg-[var(--post-game-card-color)] shadow-sm" />
        </div>

        {/* Center Area with Agent Portrait & Stats */}
        <div className="relative z-2 flex-1 px-3 overflow-hidden">
          {/* Portrait */}
          <img
            alt={codename}
            className="absolute top-0 right-0 z-2 w-full max-h-[160%] object-contain pointer-events-none select-none"
            src={portraitUrl}
            style={{ transform: transformStyle }}
          />

          {/* Player Name and Stats */}
          <div
            className={`relative z-3 flex size-full flex-col justify-center ${
              isFlipped ? 'items-start pl-2' : 'items-end pr-2'
            } ${isBestPlayer ? 'flex-col-reverse justify-start pt-6' : ''}`}
          >
            {/* Player Name */}
            <div className={`whitespace-nowrap ${isBestPlayer ? 'h-[70px] w-96' : 'h-[50px] w-[260px]'}`}>
              <div className={`flex h-full items-center ${isFlipped ? 'justify-start' : 'justify-end'}`}>
                <h1
                  className={`font-schabo leading-none tracking-wide text-white drop-shadow-md truncate ${
                    isBestPlayer ? 'text-[68px]' : 'text-[44px]'
                  }`}
                >
                  {playerName}
                </h1>
              </div>
            </div>

            {/* KDA & ACS Stats */}
            <div
              className={`flex items-center gap-[12px] font-barlowCond ${
                isBestPlayer ? '-translate-y-1 font-mussels leading-none' : ''
              }`}
            >
              {/* KDA */}
              <div className={`flex items-end gap-1 ${isBestPlayer ? 'gap-1.5' : ''}`}>
                <h1
                  className={`leading-none font-bold text-white drop-shadow-sm ${
                    isBestPlayer ? 'text-[36px]' : 'text-[24px]'
                  }`}
                >
                  {kills}/{deaths}/{assists}
                </h1>
                <span
                  className={`leading-none font-bold text-neutral-400 ${
                    isBestPlayer ? 'text-[16px] mb-1' : 'text-[14px] mb-0.5'
                  }`}
                >
                  KDA
                </span>
              </div>

              {/* ACS */}
              {acs != null && (
                <div className={`flex items-end gap-1 ${isBestPlayer ? 'gap-1.5' : ''}`}>
                  <h1
                    className={`leading-none font-bold text-white drop-shadow-sm ${
                      isBestPlayer ? 'text-[36px]' : 'text-[24px]'
                    }`}
                  >
                    {acs}
                  </h1>
                  <span
                    className={`leading-none font-bold text-neutral-400 ${
                      isBestPlayer ? 'text-[16px] mb-1' : 'text-[14px] mb-0.5'
                    }`}
                  >
                    ACS
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Edge Accent */}
        <div className="z-1 h-full p-0.5">
          <div className="h-full w-[6px] rounded-r-[3px] bg-[var(--post-game-card-color)] shadow-sm" />
        </div>
      </div>
    </div>
  )
}

export function PostGameScene(props: PostGameSceneProps) {
  const {
    leftTeamName = 'LEFT TEAM',
    rightTeamName = 'RIGHT TEAM',
    leftTeamColor = '#1DCD9B',
    rightTeamColor = '#FF4848',
    leftTeamLogo,
    rightTeamLogo,
    scoreLeft = 0,
    scoreRight = 0,
    activeComponentId,
    onSelectComponent,
    isToggled = () => true,
    showFooter = true,
    leftTeamPlayers = [],
    rightTeamPlayers = [],
  } = props

  void showFooter

  // Live match detection: if players are passed from live snapshot, only use live players
  const hasLiveLeft = leftTeamPlayers && leftTeamPlayers.length > 0
  const hasLiveRight = rightTeamPlayers && rightTeamPlayers.length > 0
  const isSoloTesting = hasLiveLeft && !hasLiveRight

  const leftList = hasLiveLeft ? leftTeamPlayers : (hasLiveRight ? [] : DEMO_PLAYERS_LEFT)
  const rightList = hasLiveRight ? rightTeamPlayers : (hasLiveLeft ? [] : DEMO_PLAYERS_RIGHT)

  // Sort by kills descending (MVP at index 0), then by ACS/score
  const sortedLeft = useMemo(() => {
    return [...leftList].sort((a, b) => {
      const aK = a.kills ?? 0
      const bK = b.kills ?? 0
      if (bK !== aK) return bK - aK
      return (b.acs ?? b.score ?? 0) - (a.acs ?? a.score ?? 0)
    })
  }, [leftList])

  const sortedRight = useMemo(() => {
    return [...rightList].sort((a, b) => {
      const aK = a.kills ?? 0
      const bK = b.kills ?? 0
      if (bK !== aK) return bK - aK
      return (b.acs ?? b.score ?? 0) - (a.acs ?? a.score ?? 0)
    })
  }, [rightList])

  const isLeftWinner = scoreLeft >= scoreRight
  const isRightWinner = scoreRight > scoreLeft

  return (
    <div
      className="scene-root pg-anim relative size-full min-h-full bg-[#1B1D1F] overflow-hidden select-none"
      style={{
        width: 1920,
        height: 1080,
        '--left-team-color': leftTeamColor,
        '--right-team-color': rightTeamColor,
      } as React.CSSProperties}
    >
      {/* Broadcast entrance: staggered reveal of the team blocks, score and MVP cards */}
      <style>{`
        @keyframes pgIn { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: none; } }
        .pg-anim > * { animation: pgIn 440ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        .pg-anim > * > *:nth-child(1) { animation: pgIn 440ms cubic-bezier(0.22, 1, 0.36, 1) both; animation-delay: 60ms; }
        .pg-anim > * > *:nth-child(2) { animation: pgIn 440ms cubic-bezier(0.22, 1, 0.36, 1) both; animation-delay: 160ms; }
        .pg-anim > * > *:nth-child(3) { animation: pgIn 440ms cubic-bezier(0.22, 1, 0.36, 1) both; animation-delay: 260ms; }
        .pg-anim > * > *:nth-child(n+4) { animation: pgIn 440ms cubic-bezier(0.22, 1, 0.36, 1) both; animation-delay: 360ms; }
      `}</style>
      <div
        className={`clickable-component relative flex size-full min-h-full flex-col items-center justify-center text-white uppercase ${
          activeComponentId === 'card' ? ' selected' : ''
        }${isToggled('card') ? '' : ' opacity-50 [&>*]:invisible'}`}
        data-component-id="card"
        onClick={(e) => {
          e.stopPropagation()
          onSelectComponent?.('card')
        }}
      >
        {/* Main 2-Column Roster Layout */}
        <div className={`flex w-[1491px] ${isSoloTesting ? 'justify-center' : 'justify-between'} gap-[78px] mt-4`}>
          {/* Left Team Column */}
          <div className="flex flex-1 flex-col items-start">
            {/* Header: Logo & Team Name */}
            <div className="flex h-[73px] w-full items-center justify-start gap-4 px-2">
              <div className="flex size-[76px] items-center justify-center shrink-0">
                {leftTeamLogo ? (
                  <img alt={leftTeamName} className="size-full object-contain drop-shadow-md" src={leftTeamLogo} onError={e => { e.currentTarget.style.display = 'none' }} />
                ) : (
                  <div
                    className="flex size-14 items-center justify-center rounded-md font-schabo text-3xl font-extrabold text-black"
                    style={{ backgroundColor: leftTeamColor }}
                  >
                    {leftTeamName.slice(0, 3).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex flex-col">
                <h1 className="font-schabo text-[64px] leading-none text-white drop-shadow-md tracking-wider">
                  {leftTeamName}
                </h1>
              </div>
              <div className="ml-auto font-schabo text-[56px] text-white/90">
                {scoreLeft}
              </div>
            </div>

            {/* Cards Stack (MVP is index 0) */}
            <div className="mt-8 flex w-full flex-col gap-[16px]">
              {sortedLeft.map((player, idx) => (
                <PlayerCard
                  key={player.id || idx}
                  player={player}
                  color={leftTeamColor}
                  isBestPlayer={idx === 0}
                  isFlipped={false}
                  isWinningTeam={isLeftWinner}
                />
              ))}
            </div>
          </div>

          {/* Right Team Column */}
          {!isSoloTesting ? (
            <div className="flex flex-1 flex-col items-end">
              {/* Header: Team Name & Logo */}
              <div className="flex h-[73px] w-full items-center justify-end gap-4 px-2 flex-row-reverse">
                <div className="flex size-[76px] items-center justify-center shrink-0">
                  {rightTeamLogo ? (
                    <img alt={rightTeamName} className="size-full object-contain drop-shadow-md" src={rightTeamLogo} onError={e => { e.currentTarget.style.display = 'none' }} />
                  ) : (
                    <div
                      className="flex size-14 items-center justify-center rounded-md font-schabo text-3xl font-extrabold text-black"
                      style={{ backgroundColor: rightTeamColor }}
                    >
                      {rightTeamName.slice(0, 3).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end">
                  <h1 className="font-schabo text-[64px] leading-none text-white drop-shadow-md tracking-wider">
                    {rightTeamName}
                  </h1>
                </div>
                <div className="mr-auto font-schabo text-[56px] text-white/90">
                  {scoreRight}
                </div>
              </div>

              {/* Cards Stack (MVP is index 0) */}
              <div className="mt-8 flex w-full flex-col gap-[16px] items-end">
                {sortedRight.map((player, idx) => (
                  <PlayerCard
                    key={player.id || idx}
                    player={player}
                    color={rightTeamColor}
                    isBestPlayer={idx === 0}
                    isFlipped={true}
                    isWinningTeam={isRightWinner}
                  />
                ))}
              </div>
            </div>
          ) : (
            /* Solo match testing notice instead of phantom opponents */
            <div className="flex flex-1 flex-col items-center justify-center border border-dashed border-white/10 rounded-xl p-8 h-[680px] bg-black/20 self-end">
              <div className="flex flex-col items-center justify-center gap-3 text-center">
                <div className="size-16 rounded-full bg-white/5 flex items-center justify-center">
                  <svg className="size-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h2 className="font-schabo text-3xl text-neutral-300 tracking-wider">Solo Match Testing</h2>
                <p className="font-barlowCond text-lg text-neutral-500 max-w-xs">
                  Opponent team is hidden because no enemy players are present in this test session.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export const PostgameScene = PostGameScene
export default PostGameScene
