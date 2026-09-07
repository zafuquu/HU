// Ports the original's recovered Valorant game-state modules into the fork's
// runtime service (services/game-data-runtime/src/valorant), rewriting
// workspace imports to local relative imports.
import fs from "node:fs";
import path from "node:path";

const SRC = "C:/Users/Ryuho/AppData/Local/Temp/havoc-src/472.js";
const OUT = "C:/Users/Ryuho/Projects/havoc-unleash/services/game-data-runtime/src/valorant";

const files = [
  // data-schemas (game-data/valorant)
  ["@havoc-platform_desktop_.._.._packages_data-schemas_src_game-data_valorant_shared.ts", "valorant-shared.ts"],
  ["@havoc-platform_desktop_.._.._packages_data-schemas_src_game-data_valorant_api.ts", "valorant-api.ts"],
  ["@havoc-platform_desktop_.._.._packages_data-schemas_src_game-data_valorant_killfeed.ts", "valorant-killfeed.ts"],
  ["@havoc-platform_desktop_.._.._packages_data-schemas_src_game-data_valorant_prices.ts", "valorant-prices.ts"],
  ["@havoc-platform_desktop_.._.._packages_data-schemas_src_game-data_valorant_weapons.ts", "valorant-weapons.ts"],
  ["@havoc-platform_desktop_.._.._packages_data-schemas_src_game-data_valorant_agent-ult-points.ts", "valorant-agent-ult-points.ts"],
  // game-state engine
  ["@havoc-platform_desktop_._src_main_games_valorant_game-state_val-round-clock.ts", "val-round-clock.ts"],
  ["@havoc-platform_desktop_._src_main_games_valorant_game-state_val-side-ownership.ts", "val-side-ownership.ts"],
  ["@havoc-platform_desktop_._src_main_games_valorant_game-state_val-standard-score-policy.ts", "val-standard-score-policy.ts"],
  ["@havoc-platform_desktop_._src_main_games_valorant_game-state_val-round-history.ts", "val-round-history.ts"],
  ["@havoc-platform_desktop_._src_main_games_valorant_game-state_val-combat-truth.ts", "val-combat-truth.ts"],
  ["@havoc-platform_desktop_._src_main_games_valorant_game-state_val-round-settlement.ts", "val-round-settlement.ts"],
  ["@havoc-platform_desktop_._src_main_games_valorant_game-state_val-participant-equipment.ts", "val-participant-equipment.ts"],
  ["@havoc-platform_desktop_._src_main_games_valorant_game-state_val-player-combat-authority.ts", "val-player-combat-authority.ts"],
  ["@havoc-platform_desktop_._src_main_games_valorant_game-state_val-round-combat-journal.ts", "val-round-combat-journal.ts"],
  ["@havoc-platform_desktop_._src_main_games_valorant_game-state_skirmish_val-skirmish-round-lifecycle.ts", "val-skirmish-round-lifecycle.ts"],
  ["@havoc-platform_desktop_._src_main_games_valorant_game-state_val-session-roster-projection.ts", "val-session-roster-projection.ts"],
  ["@havoc-platform_desktop_._src_main_games_valorant_game-state_val-observation-normalizer.ts", "val-observation-normalizer.ts"],
  ["@havoc-platform_desktop_._src_main_games_valorant_game-state_val-projection-session.ts", "val-projection-session.ts"],
  // observation processor (data-runtime)
  ["@havoc-platform_desktop_._src_main_games_valorant_data-runtime_val-observation-processor.ts", "val-observation-processor.ts"],
];

const IMPORT_REWRITES = [
  [/from "@havoc-platform\/data-schemas\/game-data\/valorant\/api"/g, 'from "./valorant-api"'],
  [/from "@havoc-platform\/data-schemas\/game-data\/valorant\/shared"/g, 'from "./valorant-shared"'],
  [/from "@havoc-platform\/data-schemas\/game-data\/valorant\/killfeed"/g, 'from "./valorant-killfeed"'],
  [/from "@havoc-platform\/data-schemas\/game-data\/valorant\/ocr"/g, 'from "./valorant-ocr"'],
  [/from "@havoc-platform\/data-schemas\/game-data\/valorant\/prices"/g, 'from "./valorant-prices"'],
  [/from "@havoc-platform\/data-schemas\/game-data\/valorant\/weapons"/g, 'from "./valorant-weapons"'],
  [/from "@havoc-platform\/data-schemas\/game-data\/valorant\/agent-ult-points"/g, 'from "./valorant-agent-ult-points"'],
  [/from "\.\.\/\.\.\/data-schemas\/game-data\/valorant\/shared"/g, 'from "./valorant-shared"'],
  [/from "\.\.\/\.\.\/data-schemas\/game-data\/valorant\/api"/g, 'from "./valorant-api"'],
  [/from "@\/main\/logging\/logger"/g, 'from "./val-logger"'],
  [/from "@havoc-platform\/common-lib\/game-data\/relay-message"/g, 'from "./relay-message"'],
  [/from "@havoc-game-data\/contracts"/g, 'from "./game-identity"'],
  [/from "\.\/skirmish\/val-skirmish-round-lifecycle"/g, 'from "./val-skirmish-round-lifecycle"'],
];

fs.mkdirSync(OUT, { recursive: true });
let skipped = 0;
for (const [src, dest] of files) {
  const srcPath = path.join(SRC, src);
  if (!fs.existsSync(srcPath)) {
    console.log("MISSING SOURCE:", src);
    skipped += 1;
    continue;
  }
  let text = fs.readFileSync(srcPath, "utf8");
  for (const [re, to] of IMPORT_REWRITES) text = text.replace(re, to);
  fs.writeFileSync(path.join(OUT, dest), text);
}
console.log(`ported ${files.length - skipped} files to ${OUT}`);
