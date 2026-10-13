// THE RE-SIM'S MODEL (13 October 2026). The engine is too slow to search with, so the planner uses a stand-in fitted
// to it: each side's goals a Poisson draw whose mean moves with the two ratings (calib.json, test/hist/fit.mjs). With it:
// every club's rating in every season, fitted from the table on record where the club was in NL1 that season and carried
// from its nearest NL1 seasons where it was not; and each club's style and shape a season, drawn from its own and the
// engine's neighbours (ME_STYLE_ADJ, meFormAdj).

// ---- the stand-in -----------------------------------------------------------------------------------------------
export const lambdas = (M, h, a) => {
  const d = h - a, m = (h + a) / 2 - M.mid;
  return [Math.exp(M.h[0] + M.h[1] * d + M.h[2] * m), Math.exp(M.a[0] - M.a[1] * d + M.a[2] * m)];
};
const pois = (l, k) => { let p = Math.exp(-l); for (let i = 1; i <= k; i++) p *= l / i; return p; };
// Expected points for the home side and the away side.
export function expPts(M, h, a) {
  const [lh, la] = lambdas(M, h, a), K = 11;
  const ph = Array.from({ length: K }, (_, k) => pois(lh, k)), pa = Array.from({ length: K }, (_, k) => pois(la, k));
  let w = 0, d = 0, l = 0;
  for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) { const p = ph[i] * pa[j]; if (i > j) w += p; else if (i === j) d += p; else l += p; }
  d *= M.drawK; const s = w + d + l; w /= s; d /= s; l /= s;
  return [3 * w + d, 3 * l + d];
}

// ---- ratings from a table -------------------------------------------------------------------------------------------
// The ratings under which each club's expected points over the season's double round robin are its points on record,
// their mean held at `mean`. Newton on each club in turn, the derivative taken numerically.
export function fitTable(M, rows, mean) {
  const n = rows.length, s = rows.map(() => mean);
  const E = (i, si) => { let e = 0; for (let j = 0; j < n; j++) if (j !== i) { e += expPts(M, si, s[j])[0] + expPts(M, s[j], si)[1]; } return e; };
  // The record's points against the stand-in's: scaled to the same total, so a season with more draws than the
  // stand-in plays does not push every rating one way.
  const tot = rows.reduce((a, r) => a + r.Pts, 0);
  for (let it = 0; it < 60; it++) {
    let ex = 0; for (let i = 0; i < n; i++) ex += E(i, s[i]);
    const k = ex / tot;
    let move = 0;
    for (let i = 0; i < n; i++) {
      const e0 = E(i, s[i]), e1 = E(i, s[i] + 0.5), slope = (e1 - e0) / 0.5;
      const step = Math.max(-4, Math.min(4, (rows[i].Pts * k - e0) / slope));
      s[i] += step; move = Math.max(move, Math.abs(step));
    }
    const mu = s.reduce((a, b) => a + b, 0) / n; for (let i = 0; i < n; i++) s[i] += mean - mu;
    if (move < 0.01) break;
  }
  return s;
}

// ---- a club's rating in any season ------------------------------------------------------------------------------
// In NL1 on record: the fitted rating. Otherwise its nearest NL1 rating on record, drifting towards the second tier's
// level the further off it is (a quarter of the gap left after each season away), and lifted to the level of NL1's
// lower half the season it won promotion on record. A club the record has outside both leagues in 1931/32 drifts after
// its last NL1 season towards the level outside them (B0) instead: the record says it ended up below NL2.
export function ratingsOf(D, M, A, B2, ord, out = new Set(), B0 = B2) {
  const fit = {};
  for (const y of D.seasons) { const s = fitTable(M, D.nl1[y], A); D.nl1[y].forEach((r, i) => { (fit[r.club] ||= {})[y] = s[i]; }); }
  const idx = new Map(ord.map((y, i) => [y, i])), R = {};
  for (const c of Object.keys(D.clubs)) {
    R[c] = {};
    const mine = fit[c] || {}, ys = Object.keys(mine).map(Number);
    for (const y of ord) {
      if (y in mine) { R[c][y] = mine[y]; continue; }
      if (!ys.length) { R[c][y] = B2; continue; }
      let best = null, bd = 1e9;
      for (const z of ys) { const dd = Math.abs(idx.get(z) - idx.get(y)); if (dd < bd) { bd = dd; best = z; } }
      const base = out.has(c) && y > Math.max(...ys) ? B0 : B2;
      let r = base + (mine[best] - base) * Math.pow(0.75, bd);
      const up = D.changes[nextOf(ord, y)]?.into?.includes(c);
      if (up && y >= 1901) r = Math.max(r, A - 3 + (D.nl2won[y] === c ? 1.5 : 0));
      R[c][y] = r;
    }
  }
  return R;
}
export const nextOf = (ord, y) => ord[ord.indexOf(y) + 1];

// ---- style and shape a season -----------------------------------------------------------------------------------
export function hash(...xs) {
  let h = 2166136261;
  for (const ch of xs.join("|")) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; return (h >>> 0) / 4294967296;
}
export function setupOf(E, club, y, labelToId) {
  const styles = Object.keys(E.STYLE_PRESET), forms = E.FORMATIONS;
  // A club the records no longer hold gets a style and shape of its own once, then moves among its neighbours.
  const base = club.style ? (labelToId[club.style] || club.style) : styles[Math.floor(hash("style", club.name) * styles.length)];
  const fbase = club.formation && forms.includes(club.formation) ? club.formation : forms[Math.floor(hash("form", club.name) * forms.length)];
  const sp = [base, ...(E.ME_STYLE_ADJ[base] || [])], fp = [fbase, ...E.meFormAdj(fbase)];
  return { style: sp[Math.floor(hash("s", club.name, y) * sp.length)], formation: fp[Math.floor(hash("f", club.name, y) * fp.length)] };
}
