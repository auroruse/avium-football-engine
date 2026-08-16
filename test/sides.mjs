// THE NEW PER-SIDE COUNTERS HAVE TO ADD UP. Each of tackleWon/tackleTry/blocked/woodwork was a
// match total only; the report now shows them per team, so the two halves must sum to the total
// the engine has always kept. If they drift, the bars are lying.
import { load, PROJECT } from "/Users/zli/Documents/NICHIRIN/.claude/skills/avium-tactics/scripts/lib.mjs";
import path from "path";
const eng = await import("./deng.mjs");
const { clubs } = await load(path.join(PROJECT, "src/presets/AVIUM.tsv"));
const pool = clubs.slice(0, 12);
const PAIRS = [["tackleWon","tackleWonSide"],["tackleTry","tackleTrySide"],
               ["blocked","blockedSide"],["woodwork","woodworkSide"]];
let bad = 0, seen = {};
for (let k = 0; k < 24; k++) {
  const H = { ...pool[k % 12], style: "gegenpress", strategy: { ...eng.STYLE_PRESET.gegenpress } };
  const A = { ...pool[(k + 5) % 12], style: "catenaccio", strategy: { ...eng.STYLE_PRESET.catenaccio } };
  const { out } = eng.runPositionalMatch(H, A, 8800 + k * 7919);
  for (const [tot, side] of PAIRS) {
    const t = out[tot] || 0, o = out[side] || { home: 0, away: 0 };
    const sum = (o.home || 0) + (o.away || 0);
    seen[tot] = (seen[tot] || 0) + t;
    if (sum !== t) { bad++; console.log(`  MISMATCH ${tot}: total ${t} but sides sum to ${sum}`); }
  }
}
console.log(`24 matches. totals seen: ${PAIRS.map(([t]) => `${t}=${seen[t]}`).join("  ")}`);
console.log(bad ? `${bad} mismatches` : "every per-side counter sums to its match total");
process.exit(bad ? 1 : 0);
