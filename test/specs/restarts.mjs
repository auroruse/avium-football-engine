// THE RESTART'S BELIEF (16 October 2026, after the user's "throw-ins and goal kicks ... don't account for opponents between
// the ball and receivers at all"). Every throw, goal kick and deep free kick the taker plays to a man (mind/decide.ts
// mindRestart) is recorded with the components of its belief -- [okBase, okRisk, okLate, in the air] -- and whether his side
// still had the ball five seconds later: nobody of theirs on it in the twenty slices after the kick, and any dead ball in
// that time a restart of his side's. Kept on each match row as X; CFG.passCalS* is the logistic fit of the one on the
// other (scratch fit, pure arithmetic over the merged rows). Five seconds rather than the first touch: a restart is almost
// never cut out on its way (98% reached a team-mate), and what a press takes is the ball the man receives under it.
//   FIX_FIELD=nt the strongest national sides instead of League One.   LAB_SPEC=restarts.mjs, MINI_N fixtures a side.
const NT = process.env.FIX_FIELD === "nt";
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
  field: NT ? "Avium International" : "Nichirin League One",
  clubs: NT ? ["NCH", "ALE", "ESU", "ASK", "ARV", "HOL", "VIC", "ELV", "KAR", "SKJ", "AUR", "RUD"] : "all",
  n: +(process.env.MINI_N || 60), chunk: 15, base: "base",
  arms: [{ name: "base" }],
};
