// Agent metadata mirrored 1:1 from the desktop's @havoc-platform/data-schemas
// (game-data/valorant/agents.ts). Portraits resolve under /game/val/agents/.
export interface AgentMeta { codename: string; name: string; role: string; portrait: string }

const BY_CODENAME: Record<string, AgentMeta> = {
  'aggrobot': { codename: 'aggrobot', name: 'Gekko', role: 'initiator', portrait: '/game/val/agents/aggrobot/portrait.png' },
  'bountyhunter': { codename: 'bountyhunter', name: 'Fade', role: 'initiator', portrait: '/game/val/agents/bountyhunter/portrait.png' },
  'breach': { codename: 'breach', name: 'Breach', role: 'initiator', portrait: '/game/val/agents/breach/portrait.png' },
  'cable': { codename: 'cable', name: 'Deadlock', role: 'sentinel', portrait: '/game/val/agents/cable/portrait.png' },
  'cashew': { codename: 'cashew', name: 'Tejo', role: 'initiator', portrait: '/game/val/agents/cashew/portrait.png' },
  'clay': { codename: 'clay', name: 'Raze', role: 'duelist', portrait: '/game/val/agents/clay/portrait.png' },
  'deadeye': { codename: 'deadeye', name: 'Chamber', role: 'sentinel', portrait: '/game/val/agents/deadeye/portrait.png' },
  'grenadier': { codename: 'grenadier', name: 'KAY/O', role: 'initiator', portrait: '/game/val/agents/grenadier/portrait.png' },
  'guide': { codename: 'guide', name: 'Skye', role: 'initiator', portrait: '/game/val/agents/guide/portrait.png' },
  'gumshoe': { codename: 'gumshoe', name: 'Cypher', role: 'sentinel', portrait: '/game/val/agents/gumshoe/portrait.png' },
  'hunter': { codename: 'hunter', name: 'Sova', role: 'initiator', portrait: '/game/val/agents/hunter/portrait.png' },
  'iris': { codename: 'iris', name: 'Miks', role: 'controller', portrait: '/game/val/agents/iris/portrait.png' },
  'killjoy': { codename: 'killjoy', name: 'Killjoy', role: 'sentinel', portrait: '/game/val/agents/killjoy/portrait.png' },
  'mage': { codename: 'mage', name: 'Harbor', role: 'controller', portrait: '/game/val/agents/mage/portrait.png' },
  'nox': { codename: 'nox', name: 'Vyse', role: 'controller', portrait: '/game/val/agents/nox/portrait.png' },
  'pandemic': { codename: 'pandemic', name: 'Viper', role: 'controller', portrait: '/game/val/agents/pandemic/portrait.png' },
  'phoenix': { codename: 'phoenix', name: 'Phoenix', role: 'duelist', portrait: '/game/val/agents/phoenix/portrait.png' },
  'pine': { codename: 'pine', name: 'Veto', role: 'sentinel', portrait: '/game/val/agents/pine/portrait.png' },
  'rift': { codename: 'rift', name: 'Astra', role: 'controller', portrait: '/game/val/agents/rift/portrait.png' },
  'sarge': { codename: 'sarge', name: 'Brimstone', role: 'controller', portrait: '/game/val/agents/sarge/portrait.png' },
  'sequoia': { codename: 'sequoia', name: 'Iso', role: 'duelist', portrait: '/game/val/agents/sequoia/portrait.png' },
  'smonk': { codename: 'smonk', name: 'Clove', role: 'controller', portrait: '/game/val/agents/smonk/portrait.png' },
  'sprinter': { codename: 'sprinter', name: 'Neon', role: 'duelist', portrait: '/game/val/agents/sprinter/portrait.png' },
  'stealth': { codename: 'stealth', name: 'Yoru', role: 'duelist', portrait: '/game/val/agents/stealth/portrait.png' },
  'terra': { codename: 'terra', name: 'Waylay', role: 'duelist', portrait: '/game/val/agents/terra/portrait.png' },
  'thorne': { codename: 'thorne', name: 'Sage', role: 'sentinel', portrait: '/game/val/agents/thorne/portrait.png' },
  'vampire': { codename: 'vampire', name: 'Reyna', role: 'duelist', portrait: '/game/val/agents/vampire/portrait.png' },
  'wraith': { codename: 'wraith', name: 'Omen', role: 'controller', portrait: '/game/val/agents/wraith/portrait.png' },
  'wushu': { codename: 'wushu', name: 'Jett', role: 'duelist', portrait: '/game/val/agents/wushu/portrait.png' },
}

// Lookup by display name (case-insensitive), e.g. "Chamber" -> deadeye
const BY_NAME: Record<string, AgentMeta> = Object.fromEntries(
  Object.values(BY_CODENAME).map(a => [a.name.toLowerCase(), a]),
)

export function agentByCodename(codename: unknown): AgentMeta | null {
  // GEP emits suffixed variants: Sequoia_PC_C, Clay_PC, Stealth_PC_C ...
  const k = String(codename ?? '').trim().toLowerCase().replace(/_pc(_c)?$/i, '')
  return BY_CODENAME[k] || null
}
export function agentByName(name: unknown): AgentMeta | null {
  const k = String(name ?? '').toLowerCase()
  return BY_NAME[k] || null
}

/** Resolve the agent for a player object from any common field. */
export function resolveAgent(player: any): AgentMeta | null {
  if (!player) return null
  return (
    agentByCodename(player.agentKey) ||
    agentByCodename(player.agentCodename) ||
    agentByName(player.agentName) ||
    agentByCodename(player.agentName) ||
    agentByName(player.agent) ||
    agentByCodename(player.agent) ||
    agentByName(player.character) ||
    agentByCodename(player.character) ||
    null
  )
}

export const ALL_AGENT_PORTRAITS = Object.values(BY_CODENAME).map(a => a.portrait)

/** Preload every agent portrait once so OBS browser sources never pop in. */
export function preloadAgentPortraits() {
  for (const src of ALL_AGENT_PORTRAITS) {
    const img = new Image()
    img.src = src
  }
}
