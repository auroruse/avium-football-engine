// Reads a positions-check.mjs run (the merged lab-*.jsonl): each move's cost in rating points, measured (its net-xG
// effect over its line's six-point effect, times six) beside the figure the app shows for it (src/data/positions.js
// POS_DROP); and the league before and after (the head arm against base).
//   node test/specs/positions-check-fit.mjs <merged.jsonl>
import { readFileSync } from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { MOVES } from "./positions-check.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)), "..");
const { summarise } = await import(pathToFileURL(resolve(ROOT, "test/lab.mjs")).href);
const { posDrop } = await import(pathToFileURL(resolve(ROOT, "src/data/positions.js")).href);
const rows = readFileSync(process.argv[2], "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l));
for (const r of rows) { r.S.xgd = r.S.xgf - r.S.xga; r.S.gd = r.S.gf - r.S.ga; }
const arms = [...new Set(rows.map(r => r.arm))];
const L = new Map(summarise(rows, "base", arms).map(o => [o.arm, o]));
const f = (v, d = 3) => (v >= 0 ? "+" : "") + v.toFixed(d);
console.log(`${rows.length} matches, ${L.get("base")?.n} fixtures an arm`);
console.log("\nMOVES (rating points a man; measured is effect / six-point effect x 6, with its standard error)");
const examples = { "CB as CM": ["CM", "CB"], "CM as CB": ["CB", "CM"], "ST as CM": ["CM", "ST"], "CM as ST": ["ST", "CM"], "FB as W": ["LW", "LB"], "W as FB": ["LB", "LW"] };
for (const [name, , , cal] of MOVES) {
  const m = L.get(name), c = L.get(cal); if (!m || !c) continue;
  const est = (m.d_xgd / c.d_xgd) * 6, se = Math.abs(est) * Math.sqrt((m.s_xgd / m.d_xgd) ** 2 + (c.s_xgd / c.d_xgd) ** 2);
  const [own, place] = examples[name];
  console.log(`${name.padEnd(9)} effect ${f(m.d_xgd)} xGD (se ${m.s_xgd.toFixed(3)}), ${cal} ${f(c.d_xgd)} (se ${c.s_xgd.toFixed(3)})  ->  measured ${est.toFixed(1)} +- ${se.toFixed(1)}   shown ${posDrop([own], place)} (${own} at ${place})`);
}
const h = L.get("head");
if (h) {
  console.log("\nTHE LEAGUE BEFORE (head) AGAINST AFTER (base), paired, a side a match");
  for (const k of ["pts", "gf", "ga", "xgf", "xga", "sh", "poss", "pass", "cmp", "fouls", "run"])
    if (h["d_" + k] != null) console.log(`${k.padEnd(6)} after ${L.get("base")[k].toFixed(3)}   before minus after ${f(h["d_" + k])} (se ${h["s_" + k].toFixed(3)})`);
}
