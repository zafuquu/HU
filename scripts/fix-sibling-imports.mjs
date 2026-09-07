// Rewrites sibling imports inside the ported valorant modules (the original
// data-schemas files imported each other relatively).
import fs from "node:fs";
import path from "node:path";

const dir = "C:/Users/Ryuho/Projects/havoc-unleash/services/game-data-runtime/src/valorant";
const rewrites = [
  [/from "\.\/killfeed"/g, 'from "./valorant-killfeed"'],
  [/from "\.\/prices"/g, 'from "./valorant-prices"'],
  [/from "\.\/ranks"/g, 'from "./valorant-ranks"'],
  [/from "\.\/shared"/g, 'from "./valorant-shared"'],
  [/from "\.\/weapons"/g, 'from "./valorant-weapons"'],
  [/from "\.\/agent-ult-points"/g, 'from "./valorant-agent-ult-points"'],
  [/from "\.\/api"/g, 'from "./valorant-api"'],
  [/from "\.\/ocr"/g, 'from "./valorant-ocr"'],
];
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
  const p = path.join(dir, file);
  let text = fs.readFileSync(p, "utf8");
  let changed = false;
  for (const [re, to] of rewrites) {
    if (re.test(text)) {
      text = text.replace(re, to);
      changed = true;
    }
  }
  if (changed) fs.writeFileSync(p, text);
}
console.log("sibling imports rewritten");
