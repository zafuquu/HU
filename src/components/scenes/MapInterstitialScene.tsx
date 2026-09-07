import { useEffect, useState } from 'react'

export interface MapInterstitialProps {
  leftTeamName: string
  rightTeamName: string
  leftTeamColor?: string
  rightTeamColor?: string
  leftTeamLogo?: string | null
  rightTeamLogo?: string | null
  /** Series score — e.g. [1, 0] */
  seriesScore: [number, number]
  bestOf: number
  /** Next map name */
  nextMapName: string
  nextMapImage?: string
  /** e.g. "MAP 2 OF 3" */
  mapLabel?: string
}

export function MapInterstitialScene({
  leftTeamName, rightTeamName,
  leftTeamColor = '#28D091', rightTeamColor = '#FF3549',
  leftTeamLogo, rightTeamLogo,
  seriesScore, bestOf,
  nextMapName, nextMapImage,
  mapLabel,
}: MapInterstitialProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(t)
  }, [])

  const totalMaps = bestOf
  const dots = Array.from({ length: totalMaps }, (_, i) => {
    if (i < seriesScore[0]) return 'left'
    if (i < seriesScore[0] + seriesScore[1]) return 'right'
    return 'empty'
  })

  return (
    <div className="relative flex size-full items-center justify-center overflow-hidden bg-[#0a0b0d]">
      {/* Background map image blurred */}
      {nextMapImage && (
        <img
          src={nextMapImage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
          style={{ opacity: visible ? 0.12 : 0, filter: 'blur(40px) saturate(1.5)' }}
        />
      )}

      {/* Grid overlay */}
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.03,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
          backgroundSize: '80px 80px',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* "UP NEXT" label */}
        <div
          className={`transition-all duration-600 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}
          style={{ transitionDelay: '200ms' }}
        >
          <span className="font-mussels text-[14px] tracking-[0.4em] text-white/40 uppercase">Up Next</span>
        </div>

        {/* Map name + image card */}
        <div
          className={`relative overflow-hidden rounded-lg transition-all duration-700 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
          style={{ transitionDelay: '300ms', width: 600, height: 200 }}
        >
          {nextMapImage && (
            <img src={nextMapImage} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.5 }} />
          )}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.3))' }} />
          <div className="relative z-10 flex h-full flex-col items-center justify-end pb-6">
            <h2 className="font-schabo text-[72px] leading-none text-white uppercase tracking-[0.1em]"
              style={{ textShadow: '0 4px 20px rgba(0,0,0,0.8)' }}
            >
              {nextMapName}
            </h2>
            {mapLabel && (
              <span className="mt-1 font-mussels text-[13px] tracking-[0.3em] text-white/50 uppercase">{mapLabel}</span>
            )}
          </div>
          {/* Accent lines */}
          <div className="absolute top-0 left-0 w-full h-[2px]" style={{ background: `linear-gradient(90deg, ${leftTeamColor}, ${rightTeamColor})` }} />
        </div>

        {/* Teams + Series Score */}
        <div
          className={`flex items-center gap-10 transition-all duration-600 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          style={{ transitionDelay: '500ms' }}
        >
          {/* Left team */}
          <div className="flex flex-col items-center gap-2">
            {leftTeamLogo ? (
              <img src={leftTeamLogo} alt="" className="size-14 object-contain" />
            ) : (
              <div className="flex size-14 items-center justify-center rounded-lg" style={{ background: `${leftTeamColor}20`, border: `1px solid ${leftTeamColor}40` }}>
                <span className="font-schabo text-[28px] text-white">{leftTeamName.charAt(0)}</span>
              </div>
            )}
            <span className="font-mussels text-[14px] tracking-[0.15em] text-white uppercase">{leftTeamName}</span>
          </div>

          {/* Series dots */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-3">
              <span className="font-schabo text-[48px] leading-none" style={{ color: leftTeamColor }}>{seriesScore[0]}</span>
              <span className="font-mussels text-[18px] text-white/30">—</span>
              <span className="font-schabo text-[48px] leading-none" style={{ color: rightTeamColor }}>{seriesScore[1]}</span>
            </div>
            <div className="flex gap-2">
              {dots.map((d, i) => (
                <div
                  key={i}
                  className="size-3 rounded-full border transition-all duration-300"
                  style={{
                    background: d === 'left' ? leftTeamColor : d === 'right' ? rightTeamColor : 'transparent',
                    borderColor: d === 'left' ? leftTeamColor : d === 'right' ? rightTeamColor : 'rgba(255,255,255,0.2)',
                    transitionDelay: `${600 + i * 100}ms`,
                    opacity: visible ? 1 : 0,
                  }}
                />
              ))}
            </div>
            <span className="font-mussels text-[11px] tracking-[0.3em] text-white/30 uppercase">Best of {bestOf}</span>
          </div>

          {/* Right team */}
          <div className="flex flex-col items-center gap-2">
            {rightTeamLogo ? (
              <img src={rightTeamLogo} alt="" className="size-14 object-contain" />
            ) : (
              <div className="flex size-14 items-center justify-center rounded-lg" style={{ background: `${rightTeamColor}20`, border: `1px solid ${rightTeamColor}40` }}>
                <span className="font-schabo text-[28px] text-white">{rightTeamName.charAt(0)}</span>
              </div>
            )}
            <span className="font-mussels text-[14px] tracking-[0.15em] text-white uppercase">{rightTeamName}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MapInterstitialScene
