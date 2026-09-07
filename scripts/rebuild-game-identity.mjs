// Rebuild game-identity.ts cleanly from the recovered identities + session files.
import fs from "node:fs";

const ident = fs.readFileSync(
  "C:/Users/Ryuho/AppData/Local/Temp/havoc-src/472.js/@havoc-platform_desktop_.._.._src_valorant_identities.ts",
  "utf8",
);
const session = fs.readFileSync(
  "C:/Users/Ryuho/AppData/Local/Temp/havoc-src/472.js/@havoc-platform_desktop_.._.._src_valorant_session.ts",
  "utf8",
);

// Session file: strip its import block (it imports from ./identities which is
// this same module now) — everything it needs is defined above it.
const sessionBody = session
  .replace(/^import[\s\S]*?from "\.\/identities";\r?\n/m, "")
  .replace(/^import \{ z \} from "zod";\r?\n/m, "");

const out =
  'import { z } from "zod";\n\n' +
  ident.replace(/^import \{ z \} from "zod";\r?\n/m, "") +
  "\n" +
  sessionBody +
  "\n" +
  '/** Game identity tag used across the runtime (recovered from @havoc-game-data/contracts usage). */\n' +
  'export type GameIdentity = "VAL" | "CS" | "RL";\n\n' +
  '/** Provider game id for VALORANT (recovered from the original\'s runtime logs: gameId 21640). */\n' +
  "export const VALORANT_PROVIDER_GAME_ID = 21640;\n";

fs.writeFileSync(
  "C:/Users/Ryuho/Projects/havoc-unleash/services/game-data-runtime/src/valorant/game-identity.ts",
  out,
);
console.log("rebuilt game-identity.ts:", out.length, "chars");
