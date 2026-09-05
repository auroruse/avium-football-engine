// THE STYLE LADDER. Every club in a league plays every style, held in its own formation with its
// own three editables, against the rest of the division both ways round; only the style varies, so
// each club is its own control, and points are centred on the club's own mean across styles so a
// strong squad cannot outvote a weak one. Prints the ladder, the variance split between style and
// squad-by-style, the clubs' agreement on the order, and the ME_STYLE_PRICE row that levels it.
//
//   node test/style-ladder.mjs [workers=10] [fixtures=30] [league="Nichirin League One"]
//   NT_OUT=<dir> keeps the cells as ladder.json.
//
// Price is measured with ME_STYLE_PRICE zeroed: the row it prints is what the table should hold.
// With the table filled it prints the residual instead, which should sit inside the noise.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { PRESET_CATALOG, computeStyleFit, STYLE_PRESET, ME_STYLE_PRICE } from "./engine.mjs";
const [wS, nS, leagueS] = process.argv.slice(2);
const W = +(wS || 10), N = +(nS || 30), LEAGUE = leagueS || "Nichirin League One", CHUNK = 30;
const STYLES = Object.keys(STYLE_PRESET), REAL = STYLES.filter(s => s !== "balanced");
const clubs = PRESET_CATALOG.filter(t => t.league === LEAGUE);
const cells = clubs.flatMap(c => STYLES.map(s => ({ code: c.code, style: s, formation: c.formation, n: 0, pts: 0, gf: 0, ga: 0,
  fit: computeStyleFit(s, c.squad) })));
const jobs = [];
for (const c of cells) for (let left = N, k = 0; left > 0; left -= CHUNK, k += CHUNK)
  jobs.push([c, [c.code, c.style, c.formation, k, Math.min(CHUNK, left), LEAGUE]]);
const run = (a) => new Promise((res, rej) => {
  let out = "", err = "";
  const p = spawn("node", ["test/nt-job.mjs", ...a.map(String)], { cwd: fileURLToPath(new URL("..", import.meta.url)) });
  p.stdout.on("data", b => out += b); p.stderr.on("data", b => err += b);
  p.on("exit", c => c === 0 ? res(JSON.parse(out.trim().split("\n").pop())) : rej(new Error(err.slice(0, 200))));
});
let next = 0, done = 0;
await Promise.all(Array.from({ length: W }, async () => {
  while (next < jobs.length) {
    const [cell, args] = jobs[next++];
    const r = await run(args); cell.n += r.n; cell.pts += r.pts; cell.gf += r.gf; cell.ga += r.ga;
    if (++done % 50 === 0) console.error(new Date().toLocaleTimeString("en-GB"), done + "/" + jobs.length);
  }
}));
const ppm = c => c.pts / c.n, gd = c => (c.gf - c.ga) / c.n;
const byClub = new Map();
for (const c of cells) { const a = byClub.get(c.code) || []; a.push(c); byClub.set(c.code, a); }
for (const [, a] of byClub) {
  const m = a.reduce((s, c) => s + ppm(c), 0) / a.length, g = a.reduce((s, c) => s + gd(c), 0) / a.length;
  a.forEach(c => { c.rel = ppm(c) - m; c.relGd = gd(c) - g; });
}
// points a game per goal of goal difference, from the cells themselves
let sxy = 0, sxx = 0; for (const c of cells) { sxy += c.relGd * c.rel; sxx += c.relGd * c.relGd; }
const ppmPerGoal = sxy / sxx, GOAL_PER_OVR = 0.092;
const mean = v => v.reduce((a, b) => a + b, 0) / v.length;
const se = v => { const m = mean(v); return Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / (v.length - 1)) / Math.sqrt(v.length); };
const rows = STYLES.map(s => {
  const v = cells.filter(c => c.style === s), rel = v.map(c => c.rel), fit = v.map(c => c.fit);
  const mf = mean(fit); let a = 0, b = 0; v.forEach(c => { a += (c.fit - mf) * c.rel; b += (c.fit - mf) ** 2; });
  return { style: s, rel: mean(rel), se: se(rel), gd: mean(v.map(c => c.relGd)), fit: mf, slope: b ? a / b : 0,
           best: v.filter(c => c.rel === Math.max(...byClub.get(c.code).map(x => x.rel))).length };
}).sort((x, y) => y.rel - x.rel);
// the price row: zero-mean over the real styles, in rating points, with the current table added back
const realMean = mean(rows.filter(r => r.style !== "balanced").map(r => r.rel));
console.log("\n" + LEAGUE + ", " + clubs.length + " clubs x " + STYLES.length + " styles x " + N + " fixtures; "
  + ppmPerGoal.toFixed(2) + " ppm per goal of GD\n");
console.log("style           rel ppm    +/-    rel gd   mean fit  fit->ppm   best   price (rating)");
for (const r of rows) {
  const price = r.style === "balanced" ? 0 : (ME_STYLE_PRICE[r.style] || 0) + (r.rel - realMean) / (ppmPerGoal * GOAL_PER_OVR);
  console.log("  " + r.style.padEnd(14) + (r.rel >= 0 ? "+" : "") + r.rel.toFixed(3) + "  " + r.se.toFixed(3) + "  "
    + (r.gd >= 0 ? "+" : "") + r.gd.toFixed(2) + "   " + r.fit.toFixed(3) + "    " + (r.slope >= 0 ? "+" : "") + r.slope.toFixed(2)
    + "    " + String(r.best).padStart(2) + "     " + (price >= 0 ? "+" : "") + price.toFixed(1));
}
// variance split and agreement, real styles only
const M = [...byClub.values()].map(a => REAL.map(s => a.find(c => c.style === s).rel));
const means = REAL.map((s, j) => mean(M.map(r => r[j])));
let tot = 0, main = 0; M.forEach(r => r.forEach((x, j) => { tot += x * x; main += means[j] ** 2; }));
const rank = a => { const s = a.map((v, i) => [v, i]).sort((x, y) => y[0] - x[0]); const r = []; s.forEach(([, i], k) => r[i] = k); return r; };
const rho = (a, b) => { const ra = rank(a), rb = rank(b), n = a.length; let d = 0; for (let i = 0; i < n; i++) d += (ra[i] - rb[i]) ** 2; return 1 - 6 * d / (n * (n * n - 1)); };
let rs = 0, np = 0; for (let i = 0; i < M.length; i++) for (let j = i + 1; j < M.length; j++) { rs += rho(M[i], M[j]); np++; }
let hit = 0, top3 = 0;
for (const [, a] of byClub) { const real = a.filter(c => c.style !== "balanced");
  const best = real.reduce((x, c) => c.rel > x.rel ? c : x), byFit = [...real].sort((x, y) => y.fit - x.fit);
  if (best === byFit[0]) hit++; if (byFit.slice(0, 3).includes(best)) top3++; }
console.log("\nstyle main effect " + (100 * main / tot).toFixed(0) + "% of variance; mean pairwise rho " + (rs / np).toFixed(2)
  + "; spread " + (Math.max(...means) - Math.min(...means)).toFixed(2) + " ppm; best style = best fit for " + hit + "/" + clubs.length
  + " clubs (in top three fits " + top3 + ")");
writeFileSync((process.env.NT_OUT || tmpdir()) + "/ladder.json", JSON.stringify({ league: LEAGUE, N, ppmPerGoal, cells, rows }, null, 1));
