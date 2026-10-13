// THE MATCHES TO PLAY (13 October 2026): every fixture of every season in the plan, NL1 to 1930/31 and NL2 to 1932/33,
// each played K times with its own seed. Each season is then put together from one of each fixture's K results
// (test/hist/real.mjs), as many times as it takes for the right clubs to go up, down and out.
//
//   node test/hist/jobs.mjs <data.json> <plan.json> <jobs.json> [K=8]
import { readFileSync, writeFileSync } from "node:fs";
import { setupOf, hash } from "./model.mjs";
const E = await import("../engine.mjs");
const [df, pf, out, kArg] = process.argv.slice(2);
const D = JSON.parse(readFileSync(df, "utf8")), plan = JSON.parse(readFileSync(pf, "utf8"));
const K = +kArg || 8;
const labelToId = Object.fromEntries(Object.entries(await import("../../src/data/styles.js").then(m => m.STYLE_LBL)).map(([id, l]) => [l, id]));
// The name a club played under that season: 343 Kōkūtai until it became Dai-Ichi Sen'ninhara (1892/93).
const shown = (c, y) => (c === "Dai-Ichi Sen'ninhara" && y <= 1892 ? "343 Kōkūtai" : c);
const sides = {}, jobs = [];
const side = (c, y) => {
  const k = y + ":" + D.clubs[c].code;
  if (!sides[k]) { const su = setupOf(E, D.clubs[c], y, labelToId);
    sides[k] = { name: shown(c, y), code: D.clubs[c].code, skill: plan.ratings[c][y], style: su.style, formation: su.formation }; }
  return k;
};
const league = (y, comp, clubs) => {
  for (const h of clubs) for (const a of clubs) if (h !== a) for (let k = 0; k < K; k++)
    jobs.push([`${y}|${comp}|${h}|${a}|${k}`, side(h, y), side(a, y), Math.floor(hash("seed", y, comp, h, a, k) * 2 ** 31)]);
};
for (const s of plan.seasons) { league(s.y, "nl1", s.nl1); if (s.nl2?.length) league(s.y, "nl2", s.nl2); }
for (const y of [1932, 1933]) league(y, "nl2", D.held[y].nl2);
writeFileSync(out, JSON.stringify({ sides, jobs }));
const by = {}; for (const j of jobs) { const c = j[0].split("|")[1]; by[c] = (by[c] || 0) + 1; }
console.log(`${jobs.length} matches (${JSON.stringify(by)}), ${Object.keys(sides).length} sides`);
