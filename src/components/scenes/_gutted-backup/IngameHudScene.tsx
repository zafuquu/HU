import React, { useEffect, useRef } from 'react'

export interface PlayerData {
  id?: string
  alias?: string
  riotId?: string
  agentName?: string
  agent?: string
  character?: string
  kills?: number
  deaths?: number
  assists?: number
  health?: number
  isAlive?: boolean
  armor?: number
  armorType?: string
  credits?: number
  weapon?: string
  ultimate?: number
  ultimateMax?: number
  isUltReady?: boolean
  avatarUrl?: string | null
  photoUrl?: string | null
  img?: string
}

export interface IngameHudSceneProps {
  leftTeamName?: string
  rightTeamName?: string
  leftTeamScore?: number | string
  rightTeamScore?: number | string
  scoreLeft?: number | string
  scoreRight?: number | string
  seriesScoreLeft?: number | string
  seriesScoreRight?: number | string
  bestOf?: number | string
  leftTeamColor?: string
  rightTeamColor?: string
  roundText?: string
  seriesTitleText?: string
  eventTitleText?: string
  gameSeriesText?: string
  timerText?: string
  leftTeamLogo?: string | null
  rightTeamLogo?: string | null
  mapHistoryItems?: any
  timerColor?: any
  eventsBg?: any
  showBombTimer?: boolean
  showLogos?: boolean
  showSeries?: boolean
  scoreLineSmall?: boolean
  scoreLineSize?: number
  scoreLineBackgroundImage?: string | null
  scoreLineLeftColor?: any
  scoreLineRightColor?: any
  showSponsors?: boolean
  showWebcam?: boolean
  showUlts?: boolean
  showEco?: boolean
  showKills?: boolean
  showDeaths?: boolean
  showAssists?: boolean
  showTeamStats?: boolean
  showScoreboard?: boolean
  activeComponentId?: string | null
  onSelectComponent?: (id: string) => void
  isToggled?: (componentId: string) => boolean
  leftTeamPlayers?: PlayerData[]
  rightTeamPlayers?: PlayerData[]
  gameEvent?: string | null
  webcamStream?: MediaStream | null
  webcamPlayerName?: string
  webcamPlayerPhoto?: string | null
  webcamActive?: boolean
  [key: string]: any
}

export function IngameHudScene(props: IngameHudSceneProps) {
  const {
    leftTeamName = 'LEFT',
    rightTeamName = 'RIGHT',
    leftTeamScore,
    rightTeamScore,
    scoreLeft = 0,
    scoreRight = 0,
    seriesScoreLeft = 0,
    seriesScoreRight = 0,
    leftTeamColor = '#28D091',
    rightTeamColor = '#FF3549',
    roundText = 'Round 1',
    seriesTitleText,
    eventTitleText,
    gameSeriesText,
    timerText,
    showSponsors = true,
    showWebcam = false,
    showUlts = true,
    showEco = true,
    showKills = true,
    showDeaths = true,
    showAssists = true,
    showTeamStats = true,
    showScoreboard = true,
    activeComponentId,
    onSelectComponent,
    isToggled = () => true,
    leftTeamPlayers = [],
    rightTeamPlayers = [],
    gameEvent = null,
    webcamStream = null,
    webcamPlayerName = 'Player',
    webcamPlayerPhoto = '',
    webcamActive = false,
  } = props

  const resolvedScoreLeft = leftTeamScore !== undefined ? leftTeamScore : scoreLeft
  const resolvedScoreRight = rightTeamScore !== undefined ? rightTeamScore : scoreRight

  void isToggled
  void seriesTitleText
  void eventTitleText
  void gameSeriesText
  void timerText

  const webcamVideoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (webcamVideoRef.current && webcamStream) {
      webcamVideoRef.current.srcObject = webcamStream
    }
  }, [webcamStream])

  const renderPlayerStatsCard = (player: PlayerData, idx: number, teamColor: string, isLeft: boolean) => {
    const name = player.alias || player.riotId || `Player ${idx + 1}`
    const agent = (player.agentName || player.agent || player.character || 'bountyhunter').toLowerCase()
    const iconPath = `/game/val/agents/${agent}/icon.png`
    const ultPath = `/game/val/agents/${agent}/abilities/ultimate.png`
    const isAlive = player.isAlive !== false && (player.health ?? 100) > 0
    const healthPercent = isAlive ? Math.min(100, Math.max(0, player.health ?? 100)) : 0
    const kills = player.kills ?? 0
    const deaths = player.deaths ?? 0
    const assists = player.assists ?? 0
    const creds = player.credits ?? 800
    const isUltReady = player.isUltReady || (player.ultimate != null && player.ultimate >= (player.ultimateMax || 8))

    return (
      <div key={player.id || idx} className="w-full">
        <div className={`flex w-full transition-all duration-300 ${isLeft ? 'justify-start' : 'justify-end'}`}>
          <div className={`relative flex h-14 items-end duration-300 ${isAlive ? 'w-full' : 'w-[85%]'}`}>
            <div
              className={`relative z-1 flex h-full flex-1 flex-col items-center justify-center duration-300 p-0.5 ${isLeft ? 'rounded-l-[3px]' : 'rounded-r-[3px]'}`}
              style={{
                background: isAlive
                  ? (isLeft
                      ? 'linear-gradient(rgba(0, 0, 0, 0) 0%, rgba(40, 208, 145, 0.35) 100%), rgba(0, 0, 0, 0.85)'
                      : 'linear-gradient(rgba(0, 0, 0, 0) 0%, rgba(255, 53, 73, 0.35) 100%), rgba(0, 0, 0, 0.85)')
                  : 'rgba(0, 0, 0, 0.85)',
              }}
            >
              {/* Top Name Bar & Health Fill */}
              <div className={`font-semibold relative flex h-6 w-full items-center font-barlowCond ${isLeft ? '' : 'flex-row-reverse'}`}>
                <div
                  className={`absolute top-0 size-full rounded-[3px] duration-300 ${isLeft ? 'left-0' : 'right-0'}`}
                  style={{
                    backgroundColor: isAlive ? teamColor : 'rgba(0, 0, 0, 0.41)',
                    width: `${healthPercent}%`,
                  }}
                />
                <div className="relative h-full w-10">
                  <div className={`absolute bottom-0 ${isLeft ? 'left-0' : 'right-0'} h-10 w-10 overflow-hidden`}>
                    <img
                      className={`size-full object-contain ${isAlive ? '' : 'grayscale'}`}
                      src={iconPath}
                      onError={(e) => { (e.target as HTMLImageElement).src = '/game/val/agents/bountyhunter/icon.png' }}
                      alt=""
                    />
                  </div>
                </div>
                <div className={`h-full flex-1 ${isLeft ? 'pr-1' : 'pl-1'}`}>
                  <div className="relative size-full whitespace-nowrap overflow-hidden">
                    <h1 className={`font-semibold -translate-y-0.5 text-lg ${isLeft ? 'pl-1 text-left' : 'pr-1 text-right'} ${isAlive ? 'text-white' : 'text-[#888]'}`}>
                      {name}
                    </h1>
                  </div>
                </div>
                {showEco && (
                  <div className={`relative z-1 flex h-full items-center ${isLeft ? 'ml-auto pr-1' : 'mr-auto pl-1'}`}>
                    <h1 className={`font-semibold font-barlowSemiCond text-[14px] ${isAlive ? 'text-white' : 'text-[#888]'}`}>
                      {creds}
                    </h1>
                  </div>
                )}
              </div>

              {/* Bottom Stats: KDA, Ult, Weapon */}
              <div className={`relative flex w-full flex-1 items-center px-1 justify-between ${isLeft ? '' : 'flex-row-reverse'}`}>
                {showUlts && (
                  <div className="relative aspect-square size-6 duration-300 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full" style={{ background: isAlive ? (isLeft ? '#061f16' : '#260609') : '#000000' }} />
                    <img
                      alt="ult"
                      className="size-3.5 object-contain drop-shadow z-10"
                      src={ultPath}
                      onError={(e) => { (e.target as HTMLImageElement).src = '/game/val/agents/bountyhunter/abilities/ultimate.png' }}
                    />
                    <svg height="24" viewBox="0 0 24 24" width="24" className="absolute inset-0 z-20">
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        fill="none"
                        stroke={isUltReady ? teamColor : (isAlive ? (isLeft ? '#28D091' : '#FF3549') : '#666')}
                        strokeWidth="1.5"
                        strokeDasharray="60"
                        strokeDashoffset={isUltReady ? 0 : 20}
                      />
                    </svg>
                  </div>
                )}
                <div className={`font-semibold flex items-center gap-1.5 font-barlowCond text-sm ${isAlive ? 'text-white/90' : 'text-white/40'}`}>
                  {showKills && <span>{kills}K</span>}
                  {showDeaths && <span>{deaths}D</span>}
                  {showAssists && <span>{assists}A</span>}
                </div>
                <div className="text-xs uppercase font-barlowCond text-white/70 tracking-wider">
                  {player.weapon || 'Classic'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="relative size-full min-h-full bg-transparent overflow-hidden select-none cursor-pointer"
      style={{
        width: 1920,
        height: 1080,
        '--left-team-color': leftTeamColor,
        '--right-team-color': rightTeamColor,
      } as React.CSSProperties}
      onClick={() => onSelectComponent?.('scoreboard')}
    >
      {/* Top Header / Scoreboard */}
      {showScoreboard && (
        <div
          className={`clickable-component absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center${activeComponentId === 'scoreboard' ? ' selected' : ''}`}
          data-component-id="scoreboard"
          data-make-transparent="true"
          onClick={(e) => {
            e.stopPropagation()
            onSelectComponent?.('scoreboard')
          }}
        >
          <div className="flex items-center gap-2 bg-black/90 px-6 py-2 rounded-md border border-white/20 shadow-2xl backdrop-blur-md">
            {/* Left Team */}
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-7 rounded-sm" style={{ backgroundColor: leftTeamColor }} />
              <div className="flex flex-col items-start">
                <span className="font-unbounded text-lg font-black text-white uppercase tracking-wider">
                  {leftTeamName}
                </span>
                <span className="text-xs text-white/60 font-baijam">
                  Series: {seriesScoreLeft}
                </span>
              </div>
              <span className="font-barlowCond text-3xl font-bold text-white px-3 py-0.5 rounded bg-white/10 ml-2">
                {resolvedScoreLeft}
              </span>
            </div>

            {/* Center Match Status / Round Text */}
            <div className="flex flex-col items-center justify-center px-4 border-x border-white/20 mx-2">
              <span className="font-mussels text-sm uppercase tracking-widest text-white/80 font-bold">
                {roundText}
              </span>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mt-1" />
            </div>

            {/* Right Team */}
            <div className="flex items-center gap-3 flex-row-reverse">
              <div className="w-2.5 h-7 rounded-sm" style={{ backgroundColor: rightTeamColor }} />
              <div className="flex flex-col items-end">
                <span className="font-unbounded text-lg font-black text-white uppercase tracking-wider">
                  {rightTeamName}
                </span>
                <span className="text-xs text-white/60 font-baijam">
                  Series: {seriesScoreRight}
                </span>
              </div>
              <span className="font-barlowCond text-3xl font-bold text-white px-3 py-0.5 rounded bg-white/10 mr-2">
                {resolvedScoreRight}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Top Right Sponsors */}
      {showSponsors && (
        <div
          className={`clickable-component border-0 border-none absolute top-1.5 right-1.5 z-1 flex h-18.5 w-61.25 justify-center${activeComponentId === 'sponsors' ? ' selected' : ''}`}
          data-component-id="sponsors"
          onClick={(e) => {
            e.stopPropagation()
            onSelectComponent?.('sponsors')
          }}
          data-make-transparent="true"
        >
          <div className="size-full">
            <div className="sponsors-card relative overflow-hidden p-1 size-full rounded-sm bg-black/70 border border-white/10 flex items-center justify-center">
              <img
                alt="sponsor"
                decoding="sync"
                loading="eager"
                className="relative z-1 size-full object-contain"
                src="https://huds.blob.productions/common/default-sponsors/sponsor-1.png"
              />
            </div>
          </div>
        </div>
      )}

      {/* Bottom Left & Right Alive Player Stats */}
      {showTeamStats && (
        <div
          className={`clickable-component border-0 border-none absolute bottom-0 left-0 z-1 flex w-full justify-between p-2.5${activeComponentId === 'team-stats' ? ' selected' : ''}`}
          data-component-id="team-stats"
          onClick={(e) => {
            e.stopPropagation()
            onSelectComponent?.('team-stats')
          }}
          data-make-transparent="true"
        >
          <div className="relative flex w-full justify-between items-end">
            {/* Left Team Players */}
            <div className="w-72 flex flex-col justify-end gap-1.5">
              {leftTeamPlayers.map((player, idx) =>
                renderPlayerStatsCard(player, idx, leftTeamColor, true)
              )}
            </div>

            {/* Right Team Players */}
            <div className="w-72 flex flex-col justify-end gap-1.5">
              {rightTeamPlayers.map((player, idx) =>
                renderPlayerStatsCard(player, idx, rightTeamColor, false)
              )}
            </div>
          </div>
        </div>
      )}

      {/* Center Game Event Notification (Spike Plant, Ace, Clutch) */}
      {gameEvent && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 z-30 px-6 py-2 rounded-full bg-red-600/90 text-white font-unbounded text-lg uppercase tracking-widest animate-bounce shadow-2xl border border-white/30">
          {gameEvent}
        </div>
      )}

      {/* Facecam / Webcam Stream */}
      {showWebcam && (
        <div
          className={`clickable-component absolute z-30 flex flex-col cursor-pointer overflow-hidden rounded-sm border border-white/20 bg-black/95 shadow-2xl${activeComponentId === 'webcam' ? ' selected' : ''}`}
          data-component-id="webcam"
          style={{
            left: 476,
            bottom: 145,
            width: 310,
            height: 174,
          }}
          onClick={(e) => {
            e.stopPropagation()
            onSelectComponent?.('webcam')
          }}
        >
          <div className="relative flex-1 bg-[#121417] flex items-center justify-center overflow-hidden">
            {webcamStream ? (
              <video ref={webcamVideoRef} autoPlay playsInline muted className="size-full object-cover" />
            ) : webcamActive && webcamPlayerPhoto ? (
              <img src={webcamPlayerPhoto} alt="" className="size-full object-cover" />
            ) : (
              <div className="text-center">
                <svg className="w-8 h-8 text-white/30 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span className="text-[11px] font-bold uppercase tracking-widest text-white/40 font-baijam">
                  {webcamActive ? 'CAMERA FEED' : 'CAMERA OFFLINE'}
                </span>
              </div>
            )}
          </div>
          <div className="h-7 bg-black/90 px-3 flex items-center justify-between border-t border-white/10">
            <span className="font-baijam text-xs font-bold text-white uppercase">
              {webcamActive ? webcamPlayerName : 'No camera'}
            </span>
            <span className={'flex items-center gap-1.5 text-[10px] font-bold font-baijam ' + (webcamActive ? 'text-emerald-400' : 'text-white/40')}>
              <span className={'size-1.5 rounded-full ' + (webcamActive ? 'bg-emerald-400 animate-pulse' : 'bg-white/30')} />
              {webcamActive ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default IngameHudScene
