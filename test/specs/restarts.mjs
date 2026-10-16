// THE RESTART'S BELIEF (16 October 2026, after the user's "throw-ins and goal kicks ... don't account for opponents between
// the ball and receivers at all"). Every throw, goal kick and deep free kick the taker plays to a man (mind/decide.ts
// mindRestart) is recorded with the components of its belief -- [okBase, okRisk, okLate, in the air] -- and whether his side
// still had the ball five seconds later: nobody of theirs on it in the twenty slices after the kick, and any dead ball in
// that time a restart of his side's. Kept on each match row as X; CFG.passCalS* is the logistic fit of the one on the
// other (scratch fit, pure arithmetic over the merged rows). Five seconds rather than the first touch: a restart is almost
// never cut out on its way (98% reached a team-mate), and what a press takes is the ball the man receives under it.
//   FIX_FIELD=nt the strongest national sides instead of League One, nl2 League Two.   LAB_SPEC=restarts.mjs, MINI_N fixtures a side.
//   node test/specs/restarts.mjs fit <dir or .jsonl ...>   the fit, from the merged rows: what to ship as CFG.passCalS*
const NT = process.env.FIX_FIELD === "nt", NL2 = process.env.FIX_FIELD === "nl2";
let live = null, rows = [];
globalThis.__spPick = (sp, pr) => { if (pr && pr.cr) live = { cr: pr.cr, side: sp.side, k: sp.kind, d: pr.d, t0: null, lost: 0 }; };
globalThis.__tick = (st, mp) => {
  if (!live) return;
  if (live.t0 == null) { if (!mp.sp) live.t0 = mp.tick; else return; }
  if (mp.idx >= 0 && mp.side !== live.side) live.lost = 1;
  const dead = mp.sp && mp.tick > live.t0;
  if (dead && mp.sp.side !== live.side) live.lost = 1;
  if (dead || mp.tick - live.t0 >= 20) {
    rows.push([...live.cr.map(v => +(+v).toFixed(4)), live.k, +(+live.d).toFixed(1), live.lost ? 0 : 1, live.side]);
    live = null;
  }
};
globalThis.__labRow = () => { const r = rows; rows = []; live = null; return r; };
export default {
  field: NT ? "Avium International" : NL2 ? "Nichirin League Two" : "Nichirin League One",
  clubs: NT ? ["NCH", "ALE", "ESU", "ASK", "ARV", "HOL", "VIC", "ELV", "KAR", "SKJ", "AUR", "RUD"] : "all",
  n: +(process.env.MINI_N || 60), chunk: 15, base: "base",
  arms: [{ name: "base" }],
};

// ---- the fit -------------------------------------------------------------------------------------------------------
// logit P(kept five seconds) = S0 + SB ln okBase + SR ln okRisk + SL ln okLate + SH (in the air) + SC (contested at all),
// by Newton's method. The contested term is there because any defender who can reach the ball's path costs a restart about
// ten points of retention however small his chance of getting there: on ln okRisk alone the mildly contested ones were
// believed at 0.76 and kept 0.65 (League One, 30,399 restarts).
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop()) && process.argv[2] === "fit") {
  const fs = await import("node:fs"), path = await import("node:path");
  const files = process.argv.slice(3).flatMap(d => fs.statSync(d).isDirectory()
    ? fs.readdirSync(d, { recursive: true }).filter(f => String(f).endsWith(".jsonl")).map(f => path.join(d, String(f))) : [d]);
  const X = [];
  for (const f of files) for (const l of fs.readFileSync(f, "utf8").split("\n")) { if (!l.trim()) continue; for (const x of JSON.parse(l).X || []) X.push(x); }
  const lg = (x) => [1, Math.log(Math.max(0.01, x[0])), Math.log(Math.max(0.01, x[1])), Math.log(Math.max(0.01, x[2])), x[3] ? 1 : 0, x[1] < 0.999 ? 1 : 0];
  const F = X.map(lg), y = X.map(x => x[6]), K = F[0].length;
  let b = new Array(K).fill(0);
  for (let it = 0; it < 16; it++) {
    const H = Array.from({ length: K }, () => new Array(K).fill(0)), g = new Array(K).fill(0);
    for (let i = 0; i < F.length; i++) { const x = F[i]; let z = 0; for (let r = 0; r < K; r++) z += b[r] * x[r];
      const p = 1 / (1 + Math.exp(-z)), w = p * (1 - p);
      for (let r = 0; r < K; r++) { g[r] += (y[i] - p) * x[r]; for (let c = 0; c < K; c++) H[r][c] += w * x[r] * x[c]; } }
    for (let r = 0; r < K; r++) H[r][r] += 1e-9;
    const A = H.map((row, r) => [...row, g[r]]);
    for (let c = 0; c < K; c++) { let pr = c; for (let r = c + 1; r < K; r++) if (Math.abs(A[r][c]) > Math.abs(A[pr][c])) pr = r; [A[c], A[pr]] = [A[pr], A[c]];
      for (let r = 0; r < K; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k <= K; k++) A[r][k] -= f * A[c][k]; } }
    b = b.map((v, r) => v + A[r][K] / A[r][r]);
  }
  const mean = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
  const P = F.map(f => 1 / (1 + Math.exp(-f.reduce((t, v, i) => t + v * b[i], 0))));
  console.log(`${X.length} restarts from ${files.length} files, kept five seconds ${(mean(y) * 100).toFixed(1)}%`);
  for (const k of ["throw", "goalkick", "freekick"]) { const I = X.map((x, i) => x[4] === k ? i : -1).filter(i => i >= 0);
    console.log(`  ${k.padEnd(9)} n=${I.length}  kept ${(mean(I.map(i => y[i])) * 100).toFixed(1)}%  fitted ${(mean(I.map(i => P[i])) * 100).toFixed(1)}%  length ${mean(I.map(i => X[i][5])).toFixed(1)} m  in the air ${(mean(I.map(i => X[i][3])) * 100).toFixed(0)}%`); }
  console.log("  by belief: " + [[0, .5], [.5, .65], [.65, .8], [.8, .9], [.9, 1.01]].map(([lo, hi]) => { const I = P.map((p, i) => p >= lo && p < hi ? i : -1).filter(i => i >= 0);
    return I.length ? `${lo}-${hi > 1 ? 1 : hi}: n=${I.length} pred ${mean(I.map(i => P[i])).toFixed(2)} real ${mean(I.map(i => y[i])).toFixed(2)}` : ""; }).filter(Boolean).join(" | "));
  console.log(`  passCalS0: ${b[0].toFixed(2)}, passCalSB: ${b[1].toFixed(2)}, passCalSR: ${b[2].toFixed(2)}, passCalSL: ${b[3].toFixed(2)}, passCalSH: ${b[4].toFixed(2)}, passCalSC: ${b[5].toFixed(2)},`);
}
