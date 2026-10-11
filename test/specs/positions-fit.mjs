// Reads a positions.mjs run (the merged lab-*.jsonl) and fits what a point of each skill is worth to each line, against
// a point of rating: a least-squares regression of the tested side's net xG on the signs of its pushes, recomputed
// from (club, fixture, cell). Prints each line's weights in rating points a skill point, ready for test/posdrop.mjs.
//   node test/specs/positions-fit.mjs <merged.jsonl> [gd|xg]
import { readFileSync } from "node:fs";
import { pathToFileURL, fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { CELLS, GROUPS, SKILLS, D_SKILL, D_OVR, signOf } from "./positions.mjs";

const [file, metric = "xg"] = process.argv.slice(2);
const E = await import(pathToFileURL(resolve(fileURLToPath(new URL("..", import.meta.url)), "engine.mjs")).href);
const clubs = E.PRESET_CATALOG.filter(t => t.league === "Nichirin League One").map(t => t.code);
const rows = readFileSync(file, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l));
const y = rows.map(r => (metric === "gd" ? r.S.gf - r.S.ga : r.S.xgf - r.S.xga));
const X = rows.map(r => { const ci = clubs.indexOf(r.club); return [1, ...CELLS.map((_, j) => signOf(ci, r.k, j))]; });
// Normal equations, solved by Gaussian elimination: 25 unknowns.
const p = X[0].length, A = Array.from({ length: p }, () => new Array(p).fill(0)), b = new Array(p).fill(0);
for (let i = 0; i < X.length; i++) for (let a = 0; a < p; a++) { b[a] += X[i][a] * y[i]; for (let c = 0; c < p; c++) A[a][c] += X[i][a] * X[i][c]; }
const M = A.map((r, i) => [...r, b[i]]);
for (let c = 0; c < p; c++) { let piv = c; for (let r = c + 1; r < p; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
  [M[c], M[piv]] = [M[piv], M[c]]; for (let r = 0; r < p; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= p; k++) M[r][k] -= f * M[c][k]; } }
const beta = M.map((r, i) => r[p] / r[i]);
const res = y.map((v, i) => v - X[i].reduce((s, x, j) => s + x * beta[j], 0));
const s2 = res.reduce((s, v) => s + v * v, 0) / (y.length - p), se = Math.sqrt(s2 / y.length);   // the signs are near-orthogonal
console.log(`${rows.length} matches, ${metric}, residual sd ${Math.sqrt(s2).toFixed(3)}, se a coefficient ${se.toFixed(4)}`);
const out = {};
for (const g of GROUPS) {
  const j0 = CELLS.findIndex(([cg, k]) => cg === g && k === "ovr"), bo = beta[1 + j0];
  const line = { ovr: +(bo).toFixed(4) };
  for (const k of SKILLS) { const j = CELLS.findIndex(([cg, kk]) => cg === g && kk === k); line[k] = +(beta[1 + j]).toFixed(4); }
  // Rating points a skill point: (effect of D_SKILL points / D_SKILL) over (effect of D_OVR rating / D_OVR).
  const w = Object.fromEntries(SKILLS.map(k => [k, +((line[k] / D_SKILL) / (bo / D_OVR)).toFixed(3)]));
  out[g] = w;
  console.log(g.padEnd(4), "rating", bo.toFixed(4), "|", SKILLS.map(k => `${k} ${line[k] >= 0 ? "+" : ""}${line[k].toFixed(4)}`).join("  "));
  console.log("     weights", JSON.stringify(w), " (se of a weight about", ((se / D_SKILL) / Math.abs(bo / D_OVR)).toFixed(3) + ")");
}
console.log(JSON.stringify(out));
