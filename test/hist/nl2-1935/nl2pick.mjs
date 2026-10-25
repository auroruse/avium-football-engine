// NL2 1935 RE-SIM, THE PICK (26 Oct 2026): one played result a fixture from the pool, chosen so the season's top ten
// finish as published (the top three, and places 3-10 that make up the promotion playoff), then the season written
// with the app's own buildSeasonMd and buildSeasonStatsTsv. The playoff section is kept as published.
//   node test/nl2pick.mjs <season.md> <pool dir> [out dir]
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const E = await import("./engine.mjs");
const [mdF, poolD, outD] = process.argv.slice(2);
const md = readFileSync(mdF, "utf8");
const fx = []; { let r = 0; for (const line of md.split("\n")) { const h = line.match(/^## Round (\d+)/); if (h) { r = +h[1]; continue; }
  if (/^## (Final Table|Promotion)/.test(line)) break; const m = line.match(/^\| (.+?) vs (.+?) \| \d+-\d+ \|$/); if (m && r) fx.push([r, m[1], m[2]]); } }
const finalRows = md.slice(md.indexOf("## Final Table")).split("\n").filter(l => /^\| \d+ \|/.test(l)).map(l => l.split("|")[2].trim());
const TOP = finalRows.slice(0, 10);
const pool = fx.map(() => []);
for (const f of readdirSync(poolD, { recursive: true }).filter(f => /\.jsonl$/.test(f)))
  for (const l of readFileSync(join(poolD, f), "utf8").split("\n")) if (l.startsWith("{")) { const r = JSON.parse(l); pool[r.f].push(r); }
for (const p of pool) p.sort((a, b) => a.k - b.k);
const teams = [...new Set(fx.flatMap(x => [x[1], x[2]]))], ix = new Map(teams.map((t, i) => [t, i]));
const H = fx.map(x => ix.get(x[1])), A = fx.map(x => ix.get(x[2]));
// A standings key good enough to search on (points, goal difference, goals); the app's own tiebreakers check the result.
const tally = (ch) => { const pts = new Float64Array(teams.length), gd = new Float64Array(teams.length), gf = new Float64Array(teams.length);
  ch.forEach((c, f) => { const r = pool[f][c], h = H[f], a = A[f];
    gf[h] += r.hg; gf[a] += r.ag; gd[h] += r.hg - r.ag; gd[a] += r.ag - r.hg;
    if (r.hg > r.ag) pts[h] += 3; else if (r.hg < r.ag) pts[a] += 3; else { pts[h]++; pts[a]++; } });
  return teams.map((_, i) => pts[i] * 1e6 + gd[i] * 1e3 + gf[i]); };
const top = TOP.map(t => ix.get(t)), rest = teams.map((_, i) => i).filter(i => !top.includes(i));
const cost = (v) => { let c = 0; for (let i = 0; i + 1 < top.length; i++) c += Math.max(0, v[top[i + 1]] - v[top[i]] + 1);
  const last = v[top[top.length - 1]]; for (const j of rest) c += Math.max(0, v[j] - last + 1); return c; };
let seed = 20261026; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
// Start from the pool's first sample everywhere (an unbiased season), then change one fixture at a time while it helps.
let ch = pool.map(() => 0), cur = cost(tally(ch)), steps = 0;
const T0 = 2e6;
for (let it = 0; it < 400000 && cur > 0; it++) {
  const f = Math.floor(rnd() * fx.length), was = ch[f], c = Math.floor(rnd() * pool[f].length); if (c === was) continue;
  ch[f] = c; const nc = cost(tally(ch)), temp = T0 * (1 - it / 400000);
  if (nc <= cur || rnd() < Math.exp((cur - nc) / Math.max(1, temp))) { cur = nc; steps++; } else ch[f] = was;
}
const changed = ch.filter(c => c !== 0).length;
console.error(`pool ${pool.reduce((n, p) => n + p.length, 0)} matches; cost ${cur}; ${changed} of ${fx.length} fixtures moved off sample 0`);
if (cur > 0) process.exit(1);
// The season as the app holds it, then its own writers.
const cat = new Map(E.PRESET_CATALOG.filter(t => t.league === "Nichirin League Two").map(t => [t.name.trim(), t]));
const rounds = [...new Set(fx.map(x => x[0]))].sort((a, b) => a - b);
const group = { teams: teams.map(t => cat.get(t)), schedule: rounds.map(r => fx.map((x, f) => [x, f]).filter(([x]) => x[0] === r)
  .map(([x, f]) => ({ home: cat.get(x[1]), away: cat.get(x[2]), result: { ftHome: pool[f][ch[f]].hg, ftAway: pool[f][ch[f]].ag } }))) };
const tb = ["gd", "gf", "h2h", "wins"];
const order = E.recalcStandings(group, tb).map(s => s.name.trim());
const ok = TOP.every((t, i) => order[i] === t);
console.error("top ten as published:", ok); if (!ok) { console.error(order.slice(0, 10)); process.exit(1); }
let out = E.buildSeasonMd({ title: "Tournament", groups: [group], ko: null, tiebreakers: tb, koLegs: 1, stages: null });
out = out.replace(/\n+$/, "\n") + "\n" + md.slice(md.lastIndexOf("---\n\n## Promotion Playoff"));
const stats = {};
fx.forEach((x, f) => { const r = pool[f][ch[f]];
  for (const [side, rows] of [[x[1], r.ph], [x[2], r.pa]]) { const t = cat.get(side);
    for (const [name, full, pos, ovr, sub, mins, g, a, rtg, cc, dc, sv] of rows) {
      const k = t.name + "|" + name, e = stats[k] ??= { name, fullName: full, team: t.name, code: t.code || "", pos, ovr, goals: 0, assists: 0, matches: 0, subApp: 0, mins: 0, totalRating: 0, cc: 0, defActs: 0, saves: 0 };
      if (sub) e.subApp++; else e.matches++; e.mins += mins; e.goals += g; e.assists += a; e.totalRating += rtg; e.cc += cc; e.defActs += dc; e.saves += sv; } } });
const tsv = E.buildSeasonStatsTsv(stats);
const gpm = fx.reduce((s, x, f) => s + pool[f][ch[f]].hg + pool[f][ch[f]].ag, 0) / fx.length;
console.error(`goals a match ${gpm.toFixed(2)} (pool ${(pool.flat().reduce((s, r) => s + r.hg + r.ag, 0) / pool.flat().length).toFixed(2)})`);
if (outD) { writeFileSync(join(outD, "1935.md"), out); writeFileSync(join(outD, "1935.tsv"), tsv); console.error("written to " + outD); }
