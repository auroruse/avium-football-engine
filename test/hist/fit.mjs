// FIT THE STAND-IN to the engine (13 October 2026): each side's goals as a Poisson draw, log mean linear in the rating
// gap and the pair's mean rating, home and away apart; then how much more often the engine draws than two independent
// Poissons say. Prints the fit and how it reads back against the engine.
//
//   node test/hist/fit.mjs <calib.json> <calib.jsonl> <model.json>
import { readFileSync, writeFileSync } from "node:fs";
const [jf, rf, out] = process.argv.slice(2);
const { sides, jobs } = JSON.parse(readFileSync(jf, "utf8"));
const res = new Map(readFileSync(rf, "utf8").trim().split("\n").map(l => JSON.parse(l)).filter(r => r.err == null).map(r => [r.id, r]));
const MID = 76;
const X = [], YH = [], YA = [];
for (const [id, h, a] of jobs) { const r = res.get(id); if (!r) continue;
  const sh = sides[h].skill, sa = sides[a].skill; X.push([1, sh - sa, (sh + sa) / 2 - MID]); YH.push(r.hg); YA.push(r.ag); }
// Poisson regression by Newton's method on a 3-vector.
function poisReg(X, y, sign) {
  let b = [Math.log(y.reduce((a, v) => a + v, 0) / y.length), 0, 0];
  for (let it = 0; it < 50; it++) {
    const g = [0, 0, 0], H = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < X.length; i++) {
      const x = [X[i][0], sign * X[i][1], X[i][2]], mu = Math.exp(b[0] * x[0] + b[1] * x[1] + b[2] * x[2]);
      for (let p = 0; p < 3; p++) { g[p] += (y[i] - mu) * x[p]; for (let q = 0; q < 3; q++) H[p][q] += mu * x[p] * x[q]; }
    }
    const d = solve3(H, g); b = b.map((v, k) => v + d[k]);
    if (Math.max(...d.map(Math.abs)) < 1e-9) break;
  }
  return b;
}
function solve3(A, v) {
  const m = A.map((r, i) => [...r, v[i]]);
  for (let c = 0; c < 3; c++) { let p = c; for (let r = c + 1; r < 3; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    [m[c], m[p]] = [m[p], m[c]]; for (let r = 0; r < 3; r++) if (r !== c) { const f = m[r][c] / m[c][c]; for (let k = c; k < 4; k++) m[r][k] -= f * m[c][k]; } }
  return [0, 1, 2].map(i => m[i][3] / m[i][i]);
}
const bh = poisReg(X, YH, 1), ba = poisReg(X, YA, -1);
const M = { mid: MID, h: bh, a: ba, drawK: 1 };
// The draw rate: the engine's against the model's.
const pois = (l, k) => { let p = Math.exp(-l); for (let i = 1; i <= k; i++) p *= l / i; return p; };
let dm = 0, de = 0, wm = 0, we = 0;
for (let i = 0; i < X.length; i++) {
  const lh = Math.exp(bh[0] + bh[1] * X[i][1] + bh[2] * X[i][2]), la = Math.exp(ba[0] - ba[1] * X[i][1] + ba[2] * X[i][2]);
  let d = 0, w = 0; for (let a = 0; a < 12; a++) for (let b = 0; b < 12; b++) { const p = pois(lh, a) * pois(la, b); if (a === b) d += p; else if (a > b) w += p; }
  dm += d; wm += w; de += YH[i] === YA[i] ? 1 : 0; we += YH[i] > YA[i] ? 1 : 0;
}
M.drawK = de / dm;
const n = X.length;
console.log(`matches ${n}  home goals ${(YH.reduce((a, b) => a + b) / n).toFixed(3)}  away ${(YA.reduce((a, b) => a + b) / n).toFixed(3)}`);
console.log(`home log-mean: ${bh.map(v => v.toFixed(4)).join(", ")}   away: ${ba.map(v => v.toFixed(4)).join(", ")}`);
console.log(`draws engine ${(de / n).toFixed(3)} model ${(dm / n).toFixed(3)} -> drawK ${M.drawK.toFixed(3)};  home wins engine ${(we / n).toFixed(3)} model ${(wm / n).toFixed(3)}`);
// Win rate by gap band, engine against model (after the draw correction).
for (const [lo, hi] of [[-30, -8], [-8, -3], [-3, 3], [3, 8], [8, 30]]) {
  let n2 = 0, ew = 0, mw = 0;
  for (let i = 0; i < n; i++) { const d = X[i][1]; if (d < lo || d >= hi) continue; n2++; ew += YH[i] > YA[i] ? 1 : 0;
    const lh = Math.exp(bh[0] + bh[1] * d + bh[2] * X[i][2]), la = Math.exp(ba[0] - ba[1] * d + ba[2] * X[i][2]);
    let w = 0, dd = 0, l = 0; for (let a = 0; a < 12; a++) for (let b = 0; b < 12; b++) { const p = pois(lh, a) * pois(la, b); if (a > b) w += p; else if (a === b) dd += p; else l += p; }
    dd *= M.drawK; mw += w / (w + dd + l); }
  console.log(`gap ${lo}..${hi}: n ${n2}  home win engine ${(ew / n2).toFixed(3)} model ${(mw / n2).toFixed(3)}`);
}
writeFileSync(out, JSON.stringify(M));
