/**
 * Riot identity layer — LCU + GLZ + PD. The endpoint flow is verified from the
 * original runtime's own request logs (runtime.jsonl), not guessed:
 *
 *   local (lockfile basic-auth riot:<password>, self-signed TLS):
 *     GET /entitlements/v1/token          -> accessToken + entitlementsToken
 *     GET /chat/v1/session                -> local session
 *     GET /riotclient/region-locale       -> region (+ shard)
 *     GET /product-session/v1/external-sessions
 *     GET /chat/v4/presences              -> per-player presence (match id)
 *   glz (https://glz-<region>-1.<shard>.a.pvp.net):
 *     GET /pregame/v1/matches/:id         -> agent-select roster
 *     GET /core-game/v1/matches/:id       -> live roster (agents, teams, tiers)
 *   pd (https://pd.<shard>.a.pvp.net):
 *     PUT /name-service/v2/players        -> display names for player UUIDs
 *
 * Auth headers (recovered from the audited binary): Bearer <accessToken>,
 * X-Riot-Entitlements-JWT, X-Riot-ClientPlatform, X-Riot-ClientVersion.
 *
 * Agent UUID -> internal key/name tables are the original's own
 * (valorant/identities: VALORANT_AGENT_RIOT_IDS / VALORANT_AGENT_NAMES).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import https from "node:https";

export type IdentitySink = (fact: { kind: string; key: string; value: unknown }) => void;

/** The original's own agent tables (valorant/identities). */
const AGENT_RIOT_IDS: Record<string, string> = {
  aggrobot: "e370fa57-4757-3604-3648-499e1f642d3f",
  bountyhunter: "dade69b4-4f5a-8528-247b-219e5a1facd6",
  breach: "5f8d3a7f-467b-97f3-062c-13acf203c006",
  cable: "cc8b64c8-4b25-4ff9-6e7f-37b4da43d235",
  cashew: "b444168c-4e35-8076-db47-ef9bf368f384",
  clay: "f94c3b30-42be-e959-889c-5aa313dba261",
  deadeye: "22697a3d-45bf-8dd7-4fec-84a9e28c69d7",
  grenadier: "601dbbe7-43ce-be57-2a40-4abd24953621",
  guide: "6f2a04ca-43e0-be17-7f36-b3908627744d",
  gumshoe: "117ed9e3-49f3-6512-3ccf-0cada7e3823b",
  hunter: "320b2a48-4d9b-a075-30f1-1f93a9b638fa",
  iris: "7c8a4701-4de6-9355-b254-e09bc2a34b72",
  killjoy: "1e58de9c-4950-5125-93e9-a0aee9f98746",
  mage: "95b78ed7-4637-86d9-7e41-71ba8c293152",
  nox: "efba5359-4016-a1e5-7626-b1ae76895940",
  pandemic: "707eab51-4836-f488-046a-cda6bf494859",
  phoenix: "eb93336a-449b-9c1b-0a54-a891f7921d69",
  pine: "92eeef5d-43b5-1d4a-8d03-b3927a09034b",
  rift: "41fb69c1-4189-7b37-f117-bcaf1e96f1bf",
  sarge: "9f0d8ba9-4140-b941-57d3-a7ad57c6b417",
  sequoia: "0e38b510-41a8-5780-5e8f-568b2a4f2d6c",
  smonk: "1dbf2edd-4729-0984-3115-daa5eed44993",
  sprinter: "bb2a4828-46eb-8cd1-e765-15848195d751",
  stealth: "7f94d92c-4234-0a36-9646-3a87eb8b5c89",
  terra: "df1cb487-4902-002e-5c17-d28e83e78588",
  thorne: "569fdd95-4d10-43ab-ca70-79becc718b46",
  vampire: "a3bfb853-43b2-7238-a4f1-ad90e9e46bcc",
  wraith: "8e253930-4c05-31dd-1b6c-968525494517",
  wushu: "add6443a-41bd-e414-f6ad-e58d267f4e95",
};
const AGENT_BY_UUID = new Map(Object.entries(AGENT_RIOT_IDS).map(([k, v]) => [v, k]));

const AGENT_NAMES: Record<string, string> = {
  aggrobot: "Gekko", bountyhunter: "Fade", breach: "Breach", cable: "Deadlock",
  cashew: "Tejo", clay: "Raze", deadeye: "Chamber", grenadier: "KAY/O",
  guide: "Skye", gumshoe: "Cypher", hunter: "Sova", iris: "Miks",
  killjoy: "Killjoy", mage: "Harbor", nox: "Vyse", pandemic: "Viper",
  phoenix: "Phoenix", pine: "Veto", rift: "Astra", sarge: "Brimstone",
  sequoia: "Iso", smonk: "Clove", sprinter: "Neon", stealth: "Yoru",
  terra: "Waylay", thorne: "Sage", vampire: "Reyna", wraith: "Omen",
  wushu: "Jett",
};

/** Riot's standard client platform header value. */
const CLIENT_PLATFORM = JSON.stringify({
  platformType: "PC",
  platformOS: "Windows",
  platformOSVersion: "10.0.19042.1.256.64bit",
  platformChipset: "Unknown",
});

function readLockfile(): { port: string; password: string } | null {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return null;
  const path = join(localAppData, "Riot Games", "Riot Client", "Config", "lockfile");
  try {
    if (!existsSync(path)) return null;
    const parts = readFileSync(path, "utf8").trim().split(":");
    if (parts.length >= 4) return { port: parts[2]!, password: parts[3]! };
  } catch { /* unreadable -> retry next poll */ }
  return null;
}

function lcuGet(port: string, password: string, endpoint: string, timeoutMs = 4000): Promise<unknown> {
  const auth = Buffer.from(`riot:${password}`).toString("base64");
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: "127.0.0.1",
        port,
        path: endpoint,
        method: "GET",
        timeout: timeoutMs,
        headers: { Authorization: `Basic ${auth}` },
        rejectUnauthorized: false,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          if ((res.statusCode ?? 500) >= 300) {
            reject(new Error(`lcu ${endpoint} -> ${res.statusCode}`));
            return;
          }
          try {
            resolve(text ? (JSON.parse(text) as unknown) : null);
          } catch {
            reject(new Error(`lcu ${endpoint} bad json`));
          }
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

/** Client version from the newest VALORANT log (the original's "log" source). */
function readClientVersionFromLogs(): string | null {
  const base = join(process.env.LOCALAPPDATA ?? "", "VALORANT", "Saved", "Logs", "ShooterGame");
  try {
    if (!existsSync(base)) return null;
    const files = readdirSync(base).filter((f) => f.startsWith("ShooterGame") && f.endsWith(".log"));
    if (files.length === 0) return null;
    files.sort((a, b) => b.localeCompare(a));
    for (const f of files.slice(0, 3)) {
      const text = readFileSync(join(base, f), "utf8");
      const m = text.match(/CI server version: ([\w.-]+)/);
      if (m) return m[1]!;
    }
  } catch { /* ignore */ }
  return null;
}

interface RiotContext {
  port: string;
  password: string;
  accessToken: string;
  entitlementsToken: string;
  region: string;
  shard: string;
  clientVersion: string;
  selfPuuid: string | null;
}

async function resolveContext(prev: RiotContext | null): Promise<RiotContext> {
  const lockfile = readLockfile();
  if (!lockfile) throw new Error("lockfile_missing");
  const port = lockfile.port;

  const entitlements = (await lcuGet(port, lockfile.password, "/entitlements/v1/token")) as {
    accessToken?: string;
    entitlementsToken?: string;
  };
  const accessToken = entitlements?.accessToken ?? "";
  const entitlementsToken = entitlements?.entitlementsToken ?? "";
  if (!accessToken || !entitlementsToken) throw new Error("entitlements_missing");

  let region = prev?.region ?? "";
  let shard = prev?.shard ?? "";
  try {
    const rl = (await lcuGet(port, lockfile.password, "/riotclient/region-locale")) as {
      region?: string;
    };
    if (rl?.region) {
      region = String(rl.region);
      shard = String(rl.region);
    }
  } catch { /* keep previous */ }
  if (!region) throw new Error("region_missing");

  const clientVersion = readClientVersionFromLogs() ?? prev?.clientVersion ?? "";
  if (!clientVersion) throw new Error("client_version_missing");

  return {
    port,
    password: lockfile.password,
    accessToken,
    entitlementsToken,
    region,
    shard,
    clientVersion,
    selfPuuid: prev?.selfPuuid ?? null,
  };
}

function glzRequest(
  ctx: RiotContext,
  path: string,
  method: "GET" | "PUT",
  body?: unknown,
  timeoutMs = 6000,
): Promise<unknown> {
  const headers: Record<string, string | number> = {
    Authorization: `Bearer ${ctx.accessToken}`,
    "X-Riot-Entitlements-JWT": ctx.entitlementsToken,
    "X-Riot-ClientPlatform": CLIENT_PLATFORM,
    "X-Riot-ClientVersion": ctx.clientVersion,
    "Content-Type": "application/json",
  };
  const payload = body === undefined ? undefined : JSON.stringify(body);
  if (payload !== undefined) headers["Content-Length"] = Buffer.byteLength(payload);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: `glz-${ctx.region}-1.${ctx.shard}.a.pvp.net`,
        path,
        method,
        headers,
        timeout: timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          if ((res.statusCode ?? 500) >= 300) {
            reject(new Error(`glz ${path} -> ${res.statusCode}`));
            return;
          }
          try {
            resolve(text ? (JSON.parse(text) as unknown) : null);
          } catch {
            reject(new Error(`glz ${path} bad json`));
          }
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    if (payload !== undefined) req.write(payload);
    req.end();
  });
}

interface PresenceEntry {
  puuid: string;
  matchId: string | null;
  inProgress: boolean;
}

/**
 * Decode VALORANT presences. The `private` field is a base64-encoded payload
 * whose middle JWT segment carries {puuid, matchId, gameInProgress...}.
 * Parsing is defensive: any malformed entry is skipped.
 */
function parsePresences(raw: unknown): PresenceEntry[] {
  const out: PresenceEntry[] = [];
  const presences = (raw as { presences?: unknown[] })?.presences;
  if (!Array.isArray(presences)) return out;
  for (const entry of presences) {
    const rec = entry as { pid?: string; private?: string };
    const puuid = typeof rec?.pid === "string" ? rec.pid : null;
    const priv = typeof rec?.private === "string" ? rec.private : null;
    if (!puuid || !priv) continue;
    try {
      const decoded = Buffer.from(priv, "base64").toString("utf8");
      const parts = decoded.split(".");
      if (parts.length < 2) continue;
      const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as {
        matchId?: string;
        gameInProgress?: boolean;
        product?: string;
      };
      if (payload.product && payload.product !== "valorant") continue;
      out.push({
        puuid,
        matchId: typeof payload.matchId === "string" ? payload.matchId : null,
        inProgress: payload.gameInProgress === true,
      });
    } catch {
      /* malformed presence -> skip */
    }
  }
  return out;
}

interface RosterPlayer {
  puuid: string;
  name: string;
  tagline: string;
  agent: string | null;
  team: number | null;
  tier: number | null;
  teamId: string | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  score: number | null;
}

/** Normalize a pregame/core-game roster into roster players (verified fields). */
function parseRoster(match: unknown): RosterPlayer[] {
  const players = (match as { Players?: unknown[] })?.Players;
  if (!Array.isArray(players)) return [];
  const teamUuids = new Map<string, number>();
  const out: RosterPlayer[] = [];
  for (const p of players) {
    const rec = p as {
      Subject?: string;
      CharacterID?: string;
      TeamID?: string;
      CompetitiveTier?: number;
      CharacterSelectionState?: string;
      PlayerIdentity?: { GameName?: string; TagLine?: string };
    };
    const puuid = typeof rec?.Subject === "string" ? rec.Subject : "";
    if (!puuid) continue;
    const teamId = typeof rec.TeamID === "string" ? rec.TeamID : null;
    let team: number | null = null;
    if (teamId) {
      // "Red"/"Blue" (pregame) map to 1/0; core-game team UUIDs are assigned by
      // first-seen order, matching the original's side-ownership normalization.
      const low = teamId.toLowerCase();
      if (low === "red") team = 1;
      else if (low === "blue") team = 0;
      else {
        if (!teamUuids.has(teamId)) teamUuids.set(teamId, teamUuids.size);
        team = teamUuids.get(teamId)!;
      }
    }
    const agentUuid = typeof rec.CharacterID === "string" ? rec.CharacterID.toLowerCase() : "";
    const internalKey = AGENT_BY_UUID.get(agentUuid) ?? null;
    const selectionState = typeof rec.CharacterSelectionState === "string" ? rec.CharacterSelectionState : "";
    // Agents that are still being selected have the zero UUID — omit them.
    const agent =
      internalKey && selectionState !== "" && agentUuid !== "00000000-0000-0000-0000-000000000000"
        ? AGENT_NAMES[internalKey] ?? internalKey
        : null;
    const stats = (rec as { Stats?: { Kills?: number; Deaths?: number; Assists?: number; Score?: number } })?.Stats;
    const statNum = (v: unknown): number | null => (typeof v === "number" ? v : null);
    out.push({
      puuid,
      name: rec.PlayerIdentity?.GameName ?? "",
      tagline: rec.PlayerIdentity?.TagLine ?? "",
      agent,
      team,
      tier: typeof rec.CompetitiveTier === "number" ? rec.CompetitiveTier : null,
      teamId,
      kills: statNum(stats?.Kills),
      deaths: statNum(stats?.Deaths),
      assists: statNum(stats?.Assists),
      score: statNum(stats?.Score),
    });
  }
  return out;
}

/**
 * Polls the Riot client for the live session and emits identity facts:
 *   riot_session   { region, shard, selfPuuid }
 *   match_id       (authoritative match UUID — flips the session to live)
 *   match_map_id   (raw Riot MapID; GEP supplies the map codename separately)
 *   roster         per player: name, tagline, character, team, tier, player_id
 */
export class RiotIdentitySource {
  private timer: NodeJS.Timeout | null = null;
  private ctx: RiotContext | null = null;
  private lastMatchId: string | null = null;
  private lastMatchType: "core" | "pregame" | null = null;
  private stopped = false;

  public constructor(private readonly emit: IdentitySink) {}

  public start(): void {
    if (this.timer) return;
    const tick = async (): Promise<void> => {
      if (this.stopped) return;
      try {
        this.ctx = await resolveContext(this.ctx);
        this.emitSession();
        await this.pollMatch();
      } catch {
        // Client closed / not logged in / mid-restart: reset cached tokens.
        this.ctx = null;
        this.lastMatchId = null;
        this.lastMatchType = null;
      }
      this.timer = setTimeout(() => void tick(), 3_000);
    };
    void tick();
  }

  public stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private emitSession(): void {
    if (!this.ctx) return;
    this.emit({
      kind: "new_info_update",
      key: "riot_session",
      value: { region: this.ctx.region, shard: this.ctx.shard, selfPuuid: this.ctx.selfPuuid },
    });
  }

  private emitRoster(roster: RosterPlayer[], withStats: boolean): void {
    for (const player of roster) {
      this.emit({
        kind: "new_info_update",
        key: "roster",
        value: {
          player_id: player.puuid,
          name: player.name,
          tagline: player.tagline,
          character: player.agent,
          team: player.team,
          position: null,
          locked: true,
          competitiveTier: player.tier,
          // Live stats (GLZ core-game): updated on every poll while in match.
          kills: withStats ? player.kills : undefined,
          deaths: withStats ? player.deaths : undefined,
          assists: withStats ? player.assists : undefined,
          combatScore: withStats ? player.score : undefined,
        },
      });
    }
  }

  private async pollMatch(): Promise<void> {
    if (!this.ctx) return;
    const presences = parsePresences(
      await lcuGet(this.ctx.port, this.ctx.password, "/chat/v4/presences"),
    );
    const self = presences.find((p) => p.inProgress && p.matchId) ?? null;
    if (self) this.ctx.selfPuuid = self.puuid;
    const matchId = self?.matchId ?? null;
    if (!matchId || !self) {
      this.lastMatchId = null;
      this.lastMatchType = null;
      return;
    }

    // Live game first, then agent select. While in a core-game match we poll
    // EVERY tick: the roster facts carry live kills/deaths/assists/score.
    let match: unknown = null;
    let type: "core" | "pregame" = "core";
    try {
      match = await glzRequest(this.ctx, `/core-game/v1/matches/${encodeURIComponent(matchId)}`, "GET");
    } catch {
      try {
        match = await glzRequest(this.ctx, `/pregame/v1/matches/${encodeURIComponent(matchId)}`, "GET");
        type = "pregame";
      } catch {
        return; // match not provisioned on GLZ yet — retry next poll
      }
    }
    if (this.stopped) return;
    const roster = parseRoster(match);
    if (roster.length === 0) return;
    const withStats = type === "core";

    if (matchId !== this.lastMatchId) {
      // New match: authoritative id + map flip the session to live.
      this.emit({ kind: "new_info_update", key: "match_id", value: matchId });
      const mapId = (match as { MapID?: string })?.MapID;
      if (typeof mapId === "string" && mapId) {
        // Raw Riot MapID (GEP supplies the map codename separately).
        this.emit({ kind: "new_info_update", key: "match_map_id", value: mapId });
      }
    }
    this.emitRoster(roster, withStats);
    this.lastMatchId = matchId;
    this.lastMatchType = type;
  }
}
