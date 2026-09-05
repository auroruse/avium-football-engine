// THE TACTICS SEARCH for any side in any league: successive halving over the 13x11 style-by-formation grid
// (Park The Bus left out, it has never once been viable). Rounds of [matches a cell, survivors]:
// every cell plays 30, the top 48 play 50 more, the top 16 play 120 more, the top 8 play 400
// more. A cell's rounds accumulate, so each finalist has been played 600 times against the same
// fixtures and seeds as every other finalist. The side's CURRENT cell is carried into every round
// whatever its rank, topped up to the same k, so the decision is a paired comparison at full n.
//
//   node test/nt-drive.mjs NCH,NKI,NHO,NMZ,NRG [workers=10] [league]
//   node test/nt-drive.mjs NAG,SSK 10 "Nichirin League One"
//
// The league defaults to the international pool. Output goes to $NT_OUT, or the temp dir.
//
// Jobs are chunks of 30 matches pulled from one queue by W workers, so a slow core just takes
// fewer chunks. Progress goes to scratch/nt-progress.log and results to scratch/nt-summary.json,
// one entry a side, written as each side finishes. Nothing is written to src/.
import { spawn } from "node:child_process";
import { writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { PRESET_CATALOG, STRAT_DEF, STYLE_PRESET, IDENTITY_KEYS, refitLineup } from "./engine.mjs";

const S = process.env.NT_OUT || tmpdir();
const [codesS, wS, leagueS] = process.argv.slice(2);
const CODES = (codesS || "NCH").split(","), W = +(wS || 10), LEAGUE = leagueS || "Avium International";
const ROUNDS = [[30, 48], [50, 16], [120, 8], [400, 0]], CHUNK = 30;
const STYLES13 = ["gegenpress", "verticaltiki", "lanuestra", "wingplay", "secondball", "routeone", "balanced",
                  "tikitaka", "possession", "cholismo", "counterattack", "zonamista", "catenaccio"];
const FORMS = ["3-4-1-2", "3-4-3", "3-5-2", "4-1-2-1-2", "4-1-4-1", "4-2-3-1", "4-2-4", "4-3-2-1", "4-3-3", "4-4-2", "5-3-2"];
const log = (m) => { const l = `${new Date().toLocaleTimeString("en-GB")} ${m}`; console.log(l); appendFileSync(`${S}/nt-progress.log`, l + "\n"); };

const job = (args) => new Promise((res, rej) => {
  let out = "", err = "";
  const c = spawn("node", ["test/nt-job.mjs", ...args.map(String)], { stdio: ["ignore", "pipe", "pipe"] });
  c.stdout.on("data", (b) => { out += b; }); c.stderr.on("data", (b) => { err += b; });
  c.on("exit", (code) => code === 0 ? res(JSON.parse(out.trim().split("\n").pop())) : rej(new Error(`job ${args.join(" ")} exit ${code}: ${err.slice(0, 300)}`)));
});
const runQueue = async (jobs) => {
  const results = new Array(jobs.length); let next = 0;
  await Promise.all(Array.from({ length: W }, async () => {
    while (next < jobs.length) { const i = next++; results[i] = await job(jobs[i]); }
  }));
  return results;
};
const ppm = (c) => c.n ? c.pts / c.n : 0;
// the spread of a cell's ppm at its n, from its own win and draw rates; the floor between two
// cells is two of the combined spread, unpaired, so it is conservative
const sd = (c) => Math.sqrt(Math.max(0, 9 * c.w / c.n + c.d / c.n - ppm(c) ** 2) / c.n);
const cellStr = (c) => `${c.style}/${c.formation} ${ppm(c).toFixed(3)} (n=${c.n})`;

const summary = {};
for (const code of CODES) {
  const base = PRESET_CATALOG.find(t => t.league === LEAGUE && t.code === code);
  if (!base) { log(`${code}: no such side`); continue; }
  const strat = { ...STRAT_DEF, timeWasting: base.strategy.timeWasting, gkDist: base.strategy.gkDist, dlBehavior: base.strategy.dlBehavior };
  for (const k of IDENTITY_KEYS) strat[k] = STYLE_PRESET[base.style]?.[k] ?? 0;
  const bad = Object.keys(base.strategy).filter(k => strat[k] !== base.strategy[k]);
  if (bad.length) throw new Error(`${code}: S0 strategy mismatch on ${bad.join(",")}`);
  const refit = refitLineup(base.squad, base.formation === "4-4-2" ? "3-5-2" : "4-4-2");
  const nm = (sq) => sq.map(p => p.name).sort().join("|"), ovr = (sq) => sq.reduce((a, p) => a + Number(p.ovr || 0), 0);
  if (nm(refit) !== nm(base.squad) || Math.abs(ovr(refit) - ovr(base.squad)) > 1e-9) throw new Error(`${code}: S0 refit moved the squad`);
  const t0 = Date.now();
  let cells = STYLES13.flatMap(s => FORMS.map(f => ({ style: s, formation: f, k: 0, n: 0, pts: 0, w: 0, d: 0, gf: 0, ga: 0 })));
  const cur = cells.find(c => c.style === base.style && c.formation === base.formation);
  if (!cur) throw new Error(`${code}: current tactic ${base.style}/${base.formation} is not on the grid`);
  log(`${code} (${base.name}): ${base.style}/${base.formation} now; ${cells.length} cells on ${W} workers`);
  let target = 0;
  for (const [per, keep] of ROUNDS) {
    target += per;
    const jobs = [], owner = [];
    for (const c of cells) for (let left = target - c.k; left > 0; left -= CHUNK) {
      const n = Math.min(CHUNK, left); jobs.push([code, c.style, c.formation, c.k, n, LEAGUE]); owner.push(c); c.k += n;
    }
    const t1 = Date.now();
    const rs = await runQueue(jobs);
    rs.forEach((r, i) => { const c = owner[i]; c.n += r.n; c.pts += r.pts; c.w += r.w; c.d += r.d; c.gf += r.gf; c.ga += r.ga; c.F = r.F; });
    cells.sort((a, b) => ppm(b) - ppm(a));
    const rank = cells.indexOf(cur) + 1;
    log(`${code}: round to n=${target} done in ${((Date.now() - t1) / 60000).toFixed(1)} min (${jobs.length} jobs, field ${cur.F}) -- ${cells.slice(0, 3).map(cellStr).join(", ")}; current ${cellStr(cur)} rank ${rank}/${cells.length}`);
    if (keep) { cells = cells.slice(0, keep); if (!cells.includes(cur)) cells.push(cur); }
  }
  const best = cells[0], floor = 2 * Math.sqrt(sd(best) ** 2 + sd(cur) ** 2);
  const change = best !== cur && ppm(best) - ppm(cur) > floor;
  log(`${code}: DONE in ${((Date.now() - t0) / 60000).toFixed(0)} min -- best ${cellStr(best)} vs current ${cellStr(cur)}: delta ${(ppm(best) - ppm(cur)).toFixed(3)} against floor ${floor.toFixed(3)} -> ${change ? "CHANGE" : "KEEP"}`);
  summary[code] = { current: { style: base.style, formation: base.formation }, best: { style: best.style, formation: best.formation },
    delta: ppm(best) - ppm(cur), floor, change, finalists: cells.map(c => ({ ...c, ppm: ppm(c), sd: sd(c) })) };
  writeFileSync(`${S}/nt-summary.json`, JSON.stringify(summary, null, 1));
}
log("all done");
