/**
 * Overwolf GEP -> runtime-fact formatting, ported from the audited original
 * BLOB `FormattingService` (packages/data-schemas/.../valorant/api.ts).
 * Normalizes Overwolf internal identity keys and shapes them into the keys
 * the fork runtime + desktop projector consume:
 *   kill_feed | scoreboard | roster | round_phase | round_number | map
 */

const AGENT_INTERNAL: Record<string, string> = {
  aggrobot: "Gekko", bountyhunter: "Fade", breach: "Breach", cable: "Deadlock",
  cashew: "Tejo", clay: "Raze", deadeye: "Chamber", grenadier: "KAY/O",
  guide: "Skye", gumshoe: "Cypher", hunter: "Sova", iris: "Miks",
  killjoy: "Killjoy", mage: "Harbor", nox: "Vyse", pandemic: "Viper",
  phoenix: "Phoenix", pine: "Veto", rift: "Astra", sarge: "Brimstone",
  sequoia: "Iso", smonk: "Clove", sprinter: "Neon", stealth: "Yoru",
  terra: "Waylay", thorne: "Sage", vampire: "Reyna", wraith: "Omen",
};

const MAP_INTERNAL: Record<string, string> = {
  ascent: "Ascent", bonsai: "Split", canyon: "Fracture", duality: "Bind",
  foxtrot: "Breeze", hurm_alley: "District", hurm_bowl: "Kasbah",
  hurm_helix: "Drift", hurm_hightide: "Glitch", hurm_yard: "Piazza",
  infinity_: "Abyss", jam: "Lotus", juliett: "Sunset", pitt: "Pearl",
  plummet: "Summit", port: "Icebox", rook: "Corrode", triad: "Haven",
};

const WEAPON_INTERNAL: Record<string, string> = {
  bounty: "Ghost", deployed: "Classic", sheriff: "Sheriff", vandal: "Vandal",
  phantom: "Phantom", bulldog: "Bulldog", guardian: "Guardian",
  operator: "Operator", marshall: "Marshal", spectre: "Spectre",
  stinger: "Stinger", smg: "SMG", judge: "Judge", bucky: "Bucky",
  shorty: "Shorty", "auto-shotgun": "Auto Shotgun", knife: "Knife",
  odin: "Odin", ares: "Ares", classic: "Classic", frenzy: "Frenzy",
};

function displayName(table: Record<string, string>, raw: unknown): string {
  if (typeof raw !== "string" || raw.length === 0) return "";
  const key = raw.trim().toLowerCase();
  return table[key] ?? raw.trim();
}

export const formatAgent = (raw: unknown): string => displayName(AGENT_INTERNAL, raw);
export const formatMap = (raw: unknown): string => displayName(MAP_INTERNAL, raw);
export const formatWeapon = (raw: unknown): string => displayName(WEAPON_INTERNAL, raw);
export function formatName(raw: unknown): { name: string; tagline: string } {
  const v = typeof raw === "string" ? raw : String(raw ?? "");
  const idx = v.indexOf(" #");
  if (idx < 0) return { name: v.trim(), tagline: "" };
  return { name: v.slice(0, idx).trim(), tagline: v.slice(idx + 2).trim() };
}

const toBool = (v: unknown, fallback = false): boolean =>
  typeof v === "boolean" ? v : fallback;
const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function formatRoster(data: Record<string, unknown>): { key: "roster"; value: Record<string, unknown> } {
  return {
    key: "roster",
    value: {
      name: formatName(data.name).name,
      tagline: formatName(data.name).tagline,
      character: formatAgent(data.character ?? data.agent ?? ""),
      player_id: String(data.player_id ?? ""),
      locked: toBool(data.locked),
      position: toNum(data.position),
      team: toNum(data.team),
    },
  };
}

export function formatPlayer(data: Record<string, unknown>): { key: string; value: Record<string, unknown> } {
  return {
    key: "scoreboard",
    value: {
      name: formatName(data.name).name,
      tagline: formatName(data.name).tagline,
      character: formatAgent(data.character ?? data.agent ?? ""),
      weapon: formatWeapon(data.weapon ?? data.weapon_name ?? ""),
      kills: toNum(data.kills),
      deaths: toNum(data.deaths),
      assists: toNum(data.assists),
      credits: toNum(data.money ?? data.credits),
      spentCredits: toNum(data.spent ?? data.spent_money),
      health: toNum(data.health),
      alive: toBool(data.alive, true),
      hasSpike: toBool(data.has_spike ?? data.is_spike_carrier),
      ultPoints: toNum(data.ult_points),
      ultMax: toNum(data.ult_max),
      shield: toNum(data.shield_type ?? data.armor),
      player_id: String(data.player_id ?? ""),
      team: toNum(data.team),
    },
  };
}

export function formatKill(event: Record<string, unknown>): { key: string; value: Record<string, unknown> } {
  return {
    key: "kill_feed",
    value: {
      attacker: formatName(event.killer ?? event.attacker ?? "").name,
      victim: formatName(event.victim ?? "").name,
      weapon: formatWeapon(event.weapon ?? event.weapon_name ?? ""),
      modifier: event.headshot === true ? "headshot" : event.bodyshot === true ? "bodyshot" : null,
      assists: [event.assist1, event.assist2].filter((a): a is string => typeof a === "string" && a.length > 0),
    },
  };
}

export function normalizePhase(raw: unknown): "shopping" | "combat" | "end" | "unknown" {
  if (typeof raw !== "string") return "unknown";
  const v = raw.trim().toLowerCase();
  if (["game_start", "pre_shopping", "shopping", "buy_round"].includes(v)) return "shopping";
  if (v === "combat" || v === "action") return "combat";
  if (v === "end" || v === "game_end" || v === "post_round") return "end";
  return "unknown";
}

export function formatRoundInfo(data: Record<string, unknown>): {
  round_phase: { phase: string } | null;
  round_number: { number: number } | null;
} {
  const phase = normalizePhase(data.phase);
  const number = toNum(data.roundNum ?? data.round_number ?? data.round);
  return {
    round_phase: phase === "unknown" ? null : { phase },
    round_number: number > 0 ? { number } : null,
  };
}