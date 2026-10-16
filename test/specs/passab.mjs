// PASSES PLAYED BEHIND THE MAN, A/B (16 October 2026): a ball to feet led across the line of the pass by all of the man's
// run (pass.ts meLeadFeet), a lofted ball led for its own flight (meMeetLoft), the man a long ball or a switch is played to
// meeting it on the law he moves by, and the man a ground ball is played to stretching for the nearest point of it he can
// make instead of chasing the far end of its path (meMeetAir, recvStretch). The engine now against the last commit's
// (test/engine-head.mjs, built from it by git archive and test/rebuild.sh; never commit it), the same fixtures, so each
// metric is a paired difference.
//   FIX_FIELD=nt  the twelve strongest national sides, nl2 League Two;  LAB_SPEC=passab.mjs, MINI_N fixtures a side.
// Every open-play pass, as X: [kind, high, his speed band at the strike (0 under 1.5 m/s, 1 to 4, 2 to 6, 3 over),
// outcome (0 his side kept it through him, 1 a team-mate took it, 2 lost with it inside 0.7 m of him, 3 lost with it
// inside 2 m, 4 lost and never near him, 5 dead), the nearest it came to him in metres].
const NT = process.env.FIX_FIELD === "nt", NL2 = process.env.FIX_FIELD === "nl2";
const DT = 0.25;
let rows = [], cur = null;
const fin = (o) => { if (cur) rows.push([cur.k, cur.high, cur.band, o, +cur.dmin.toFixed(2)]); cur = null; };
globalThis.__strike = (pp) => {
  if (cur) fin(pp.side !== cur.side ? 4 : pp.byP === cur.q ? 0 : 1);   // played on before the slice was out
  if (pp.rs || pp.sx === undefined || !pp.byP) return;
  const st = globalThis.__st; if (!st) return;
  const q = st.players[pp.side]?.[pp.fj]; if (!q) return;
  const v = Math.hypot(q.vx || 0, q.vy || 0) / DT;
  cur = { k: pp.k, high: pp.high ? 1 : 0, band: v < 1.5 ? 0 : v < 4 ? 1 : v < 6 ? 2 : 3, side: pp.side, q, n: 0, dmin: 1e9, pb: null, pq: null };
};
globalThis.__tick = (st, mp) => {
  globalThis.__st = st;
  if (!cur) return;
  const c = cur, q = c.q; c.n++;
  let d = Math.hypot(mp.bx - q.x, mp.by - q.y);
  if (c.pb) { const rx0 = c.pb[0] - c.pq[0], ry0 = c.pb[1] - c.pq[1], ddx = mp.bx - q.x - rx0, ddy = mp.by - q.y - ry0, L2 = ddx * ddx + ddy * ddy;
    const u = L2 > 1e-9 ? Math.max(0, Math.min(1, -(rx0 * ddx + ry0 * ddy) / L2)) : 1;
    d = Math.min(d, Math.hypot(rx0 + ddx * u, ry0 + ddy * u)); }
  c.pb = [mp.bx, mp.by]; c.pq = [q.x, q.y]; if (d < c.dmin) c.dmin = d;
  if (mp.idx >= 0) {
    if (mp.side === c.side) fin(st.players[c.side][mp.idx] === q ? 0 : 1);
    else fin(c.dmin < 0.7 ? 2 : c.dmin < 2 ? 3 : 4);
  } else if (mp.sp) fin(5);
  else if (c.n > 40) fin(4);
};
globalThis.__labRow = () => { const r = rows; rows = []; cur = null; return r; };
export default {
  field: NT ? "Avium International" : NL2 ? "Nichirin League Two" : "Nichirin League One",
  clubs: NT ? ["NCH", "ALE", "ESU", "ASK", "ARV", "HOL", "VIC", "ELV", "KAR", "SKJ", "AUR", "RUD"] : "all",
  n: +(process.env.MINI_N || 150), chunk: 25, base: "now",
  arms: process.env.ABL ? [{ name: "now" }, { name: "noLead", cfg: { abLeadAcross: 0 } }, { name: "noLoft", cfg: { abLoftLead: 0 } },
                           { name: "noLongAir", cfg: { abLongAir: 0 } }, { name: "noStretch", cfg: { recvStretch: 0 } },
                           { name: "before", bundle: "test/engine-head.mjs" }]
    : [{ name: "now" }, { name: "before", bundle: "test/engine-head.mjs" }],
};
