// THE ALEMANNIAN MATCHES TO PLAY (13 October 2026): every fixture of every season in the plan, the Oberliga to 1932/33
// and the 2. Liga to 1933/34, each played K times with its own seed. Each season is then put together from one of each
// fixture's K results (real.mjs) as many times as it takes for the right clubs to finish where the plan needs them.
//
//   node test/hist/ale/jobs.mjs <data.json> <plan.json> <jobs.json> [K=8]
import { readFileSync, writeFileSync } from "node:fs";
import { setupOf, hash } from "../model.mjs";
const E = await import("../../engine.mjs");
const [df, pf, out, kArg] = process.argv.slice(2);
const D = JSON.parse(readFileSync(df, "utf8")), plan = JSON.parse(readFileSync(pf, "utf8"));
const K = +kArg || 8;
const labelToId = Object.fromEntries(Object.entries(await import("../../../src/data/styles.js").then(m => m.STYLE_LBL)).map(([id, l]) => [l, id]));
const sides = {}, jobs = [];
const side = (c, y) => {
  const k = y + ":" + D.clubs[c].code;
  if (!sides[k]) { const su = setupOf(E, D.clubs[c], y, labelToId);
    sides[k] = { name: c, code: D.clubs[c].code, skill: plan.ratings[c][y], style: su.style, formation: su.formation }; }
  return k;
};
const league = (y, comp, clubs) => {
  for (const h of clubs) for (const a of clubs) if (h !== a) for (let k = 0; k < K; k++)
    jobs.push([`${y}|${comp}|${h}|${a}|${k}`, side(h, y), side(a, y), Math.floor(hash("ale", y, comp, h, a, k) * 2 ** 31)]);
};
for (const s of plan.seasons) { league(s.y, "ao", s.ao); league(s.y, "l2", s.l2); }
league(plan.held.y, "l2", plan.held.l2);
const bad = Object.entries(sides).filter(([, s]) => !Number.isFinite(s.skill));
if (bad.length) throw new Error("no rating for " + bad.map(([k]) => k).join(", "));
writeFileSync(out, JSON.stringify({ sides, jobs }));
const by = {}; for (const j of jobs) { const c = j[0].split("|")[1]; by[c] = (by[c] || 0) + 1; }
console.log(`${jobs.length} matches (${JSON.stringify(by)}), ${Object.keys(sides).length} sides`);
