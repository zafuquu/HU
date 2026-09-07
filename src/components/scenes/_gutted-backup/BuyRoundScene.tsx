import React from 'react'

interface BuyRoundPlayer {
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
  spentCredits?: number
  weapon?: string
  ultimate?: number
  ultimateMax?: number
  isUltReady?: boolean
  abilities?: string[]
}

interface BuyRoundSceneProps {
  leftTeamName?: string
  rightTeamName?: string
  leftTeamColor?: string
  rightTeamColor?: string
  showSponsors?: boolean
  smallVariant?: boolean
  leftTeamPlayers?: BuyRoundPlayer[]
  rightTeamPlayers?: BuyRoundPlayer[]
  activeComponentId?: string | null
  onSelectComponent?: (id: string) => void
  isToggled?: (componentId: string) => boolean
}

export function BuyRoundScene(props: BuyRoundSceneProps) {
  const {
    leftTeamName = 'LEFT',
    rightTeamName = 'RIGHT',
    leftTeamColor = '#1DCD9B',
    rightTeamColor = '#FF4848',
    showSponsors = true,
    smallVariant = false,
    leftTeamPlayers = [],
    rightTeamPlayers = [],
    activeComponentId,
    onSelectComponent,
    isToggled = () => true,
  } = props

  void showSponsors
  const showBuyRound = isToggled('buy-round')

  const hexToRgba = (hex: string, alpha: number) => {
    let h = String(hex).replace('#', '')
    if (h.length === 3) h = h.split('').map(c => c + c).join('')
    const r = parseInt(h.slice(0, 2), 16) || 0
    const g = parseInt(h.slice(2, 4), 16) || 0
    const b = parseInt(h.slice(4, 6), 16) || 0
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  const renderPlayerRow = (p: BuyRoundPlayer, idx: number, teamColor: string, isLeft: boolean) => {
    const name = p.alias || p.riotId || `Player ${idx + 1}`
    const agent = (p.agentName || p.agent || p.character || 'bountyhunter').toLowerCase()
    const iconPath = `/game/val/agents/${agent}/icon.png`
    const ultPath = `/game/val/agents/${agent}/abilities/ultimate.png`
    const ab1Path = `/game/val/agents/${agent}/abilities/ability1.png`
    const ab2Path = `/game/val/agents/${agent}/abilities/ability2.png`
    const grPath = `/game/val/agents/${agent}/abilities/grenade.png`
    const kills = p.kills ?? 0
    const deaths = p.deaths ?? 0
    const assists = p.assists ?? 0
    const creds = p.credits ?? 800
    const spent = p.spentCredits ?? 0
    const shieldName = p.armorType === 'Heavy' || (p.armor ?? 0) >= 50 ? 'Heavy_Armor' : (p.armor ? 'Light_Armor' : null)
    const isUltReady = p.isUltReady || (p.ultimate != null && p.ultimate >= (p.ultimateMax || 8))

    return (
      <div
        key={p.id || idx}
        className="font-semibold relative flex h-14 w-[925px] items-center font-barlowSemiCond text-[20px] mb-1 overflow-hidden rounded-[4px]"
        style={{ backgroundColor: 'rgba(21, 21, 21, 0.96)' }}
      >
        <div
          className="absolute top-0 h-full w-[20%]"
          style={{
            background: isLeft
              ? `linear-gradient(90deg, ${hexToRgba(teamColor, 0.65)} 5.57%, ${hexToRgba(teamColor, 0.3)} 22.42%, ${hexToRgba(teamColor, 0)} 37.11%)`
              : `linear-gradient(270deg, ${hexToRgba(teamColor, 0.65)} 5.57%, ${hexToRgba(teamColor, 0.3)} 22.42%, ${hexToRgba(teamColor, 0)} 37.11%)`,
            ...(isLeft ? { left: 0 } : { right: 0 }),
          }}
        />

        {/* Left Side (or Mirrored Right Side): Agent Icon + Name */}
        <div className={`inline-flex h-full items-center gap-2 bg-[rgba(255,255,255,0.08)] ${isLeft ? '' : 'flex-row-reverse'}`}>
          <div className="relative flex h-full w-[90px] items-center justify-center overflow-hidden">
            <img
              className="scale-[1.4] h-full w-auto object-contain"
              src={iconPath}
              onError={(e) => { (e.target as HTMLImageElement).src = '/game/val/agents/bountyhunter/icon.png' }}
              alt=""
            />
          </div>
          <div className="flex h-full w-[150px] flex-col items-center justify-center gap-[3px]">
            <div className="auto-scaler-wrapper relative size-full whitespace-nowrap overflow-hidden">
              <div className="relative text-center leading-normal whitespace-nowrap text-white px-2">
                {name}
              </div>
            </div>
          </div>
        </div>

        {/* Center & Right Details */}
        <div className={`relative flex h-full flex-1 items-center justify-end gap-[3px] ml-[3px] ${isLeft ? '' : 'flex-row-reverse'}`}>
          {/* KDA */}
          <div className="relative flex w-[105px] h-full items-center justify-center bg-[rgba(255,255,255,0.08)]">
            <div className="flex w-full justify-around text-center text-xl text-white">
              <div>{kills}</div>
              <div>{deaths}</div>
              <div>{assists}</div>
            </div>
          </div>

          {/* Abilities */}
          <div className="flex w-[170px] h-full items-center justify-center gap-4 px-2 bg-[rgba(255,255,255,0.08)]">
            <div className="relative size-[32px]">
              <img src={grPath} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} alt="" />
            </div>
            <div className="relative size-[32px]">
              <img src={ab1Path} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} alt="" />
            </div>
            <div className="relative size-[32px]">
              <img src={ab2Path} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} alt="" />
            </div>
          </div>

          {/* Ultimate */}
          <div className="flex h-full w-[70px] items-center justify-center bg-[rgba(255,255,255,0.08)]">
            <div className="relative size-[40px] flex items-center justify-center">
              <div className="absolute inset-0 rounded-full opacity-50 bg-black" />
              <img
                alt="ult"
                className="size-[22px] object-contain drop-shadow z-10"
                src={ultPath}
                onError={(e) => { (e.target as HTMLImageElement).src = '/game/val/agents/bountyhunter/abilities/ultimate.png' }}
              />
              <svg height="40" viewBox="0 0 40 40" width="40" className="absolute inset-0 z-20">
                <circle
                  cx="20"
                  cy="20"
                  r="18"
                  fill="none"
                  stroke={isUltReady ? teamColor : 'rgba(255,255,255,0.3)'}
                  strokeWidth="2"
                  strokeDasharray="110"
                  strokeDashoffset={isUltReady ? 0 : 35}
                />
              </svg>
            </div>
          </div>

          {/* Shield */}
          <div className="flex h-full w-[65px] items-center justify-center px-2 bg-[rgba(255,255,255,0.08)]">
            {shieldName ? (
              <img className="aspect-square size-full object-contain max-h-[34px]" src={`/game/val/shields/${shieldName}.png`} alt="" />
            ) : (
              <span className="text-[#666] text-xs">NONE</span>
            )}
          </div>

          {/* Loadout Weapon */}
          <div className="flex h-full flex-1 items-center justify-center px-2 bg-[rgba(255,255,255,0.08)]">
            <span className="text-white text-base tracking-wider uppercase">{p.weapon || 'Classic'}</span>
          </div>

          {/* Economy (Spent & Remaining) */}
          <div className="flex w-[90px] h-full flex-col items-center justify-center gap-1 bg-[rgba(255,255,255,0.08)]">
            {spent > 0 && (
              <p className="text-xs text-[#F9E4AB] font-barlowSemiCond">
                - {spent}
              </p>
            )}
            <p className="text-sm text-white font-barlowSemiCond font-bold">
              {creds}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="relative size-full min-h-full bg-[#1B1D1F] overflow-hidden select-none cursor-pointer"
      style={{
        width: 1920,
        height: 1080,
        '--left-team-color': leftTeamColor,
        '--right-team-color': rightTeamColor,
      } as React.CSSProperties}
      onClick={() => onSelectComponent?.('buy-round')}
    >
      {showBuyRound && (
        <div
          className={`clickable-component border-0 border-none absolute bottom-2 z-1 w-full px-2${activeComponentId === 'buy-round' ? ' selected' : ''}`}
          data-component-id="buy-round"
          data-make-transparent="true"
          onClick={(e) => {
            e.stopPropagation()
            onSelectComponent?.('buy-round')
          }}
        >
          <div
            className="w-full flex-col gap-5 duration-500 translate-y-0 opacity-100 flex"
            style={smallVariant ? ({ transform: 'scale(0.82)', transformOrigin: 'bottom center' } as React.CSSProperties) : undefined}
          >
            {/* Top Scoreline Header */}
            <div className="flex h-20 justify-between items-center px-4 bg-[#151515] border border-white/10 rounded-sm">
              <div className="flex items-center gap-4">
                <div className="h-8 w-2" style={{ backgroundColor: leftTeamColor }} />
                <h1 className="font-unbounded text-2xl font-extrabold text-white tracking-wider uppercase">
                  {leftTeamName}
                </h1>
              </div>

              <div className="font-mussels text-xl tracking-widest text-white/70 uppercase">
                BUY PHASE
              </div>

              <div className="flex items-center gap-4 flex-row-reverse">
                <div className="h-8 w-2" style={{ backgroundColor: rightTeamColor }} />
                <h1 className="font-unbounded text-2xl font-extrabold text-white tracking-wider uppercase">
                  {rightTeamName}
                </h1>
              </div>
            </div>

            {/* Main Buy Round Table: Left & Right Teams */}
            <div className="flex w-full justify-between gap-6">
              {/* Left Team Roster */}
              <div className="flex-1 flex flex-col items-start">
                <div className="font-semibold flex h-[22px] w-[925px] rounded-[3.27px] font-baijam text-[12px] whitespace-nowrap text-white uppercase bg-[#000000AA] mb-1 px-2 items-center justify-between">
                  <div className="w-[240px]">Player</div>
                  <div className="w-[105px] text-center">K / D / A</div>
                  <div className="w-[170px] text-center">Abilities</div>
                  <div className="w-[70px] text-center">Ult</div>
                  <div className="w-[65px] text-center">Shield</div>
                  <div className="flex-1 text-center">Loadout</div>
                  <div className="w-[90px] text-center">Creds</div>
                </div>

                {leftTeamPlayers.map((player, idx) => renderPlayerRow(player, idx, leftTeamColor, true))}
              </div>

              {/* Right Team Roster */}
              <div className="flex-1 flex flex-col items-end">
                <div className="font-semibold flex h-[22px] w-[925px] rounded-[3.27px] font-baijam text-[12px] whitespace-nowrap text-white uppercase bg-[#000000AA] mb-1 px-2 items-center justify-between flex-row-reverse">
                  <div className="w-[240px] text-right">Player</div>
                  <div className="w-[105px] text-center">K / D / A</div>
                  <div className="w-[170px] text-center">Abilities</div>
                  <div className="w-[70px] text-center">Ult</div>
                  <div className="w-[65px] text-center">Shield</div>
                  <div className="flex-1 text-center">Loadout</div>
                  <div className="w-[90px] text-center">Creds</div>
                </div>

                {rightTeamPlayers.map((player, idx) => renderPlayerRow(player, idx, rightTeamColor, false))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BuyRoundScene
