// Optimal assignment. Used for man-marking and for formation slots.


// ---- optimal assignment ----------------------------------------------------------------------
// Hungarian / Jonker-Volgenant, O(n^3), which at n = 11 is nothing. Greedy "nearest free man to the
// most dangerous opponent, repeated" is what produced the scrums: each defender is individually the
// closest to the same threat, so the whole back line converges on one spot. A global assignment
// spreads them because it minimises the total, not each pick in turn.
export function meHungarian(a, n) {
  const INF = 1e18;
  const u = new Float64Array(n + 1), v = new Float64Array(n + 1);
  const p = new Int32Array(n + 1), way = new Int32Array(n + 1);
  for (let i = 1; i <= n; i++) {
    p[0] = i; let j0 = 0;
    const minv = new Float64Array(n + 1).fill(INF), used = new Uint8Array(n + 1);
    do {
      used[j0] = 1;
      const i0 = p[j0]; let delta = INF, j1 = 0;
      for (let j = 1; j <= n; j++) if (!used[j]) {
        const cur = a[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const res = new Int32Array(n).fill(-1);
  for (let j = 1; j <= n; j++) if (p[j] > 0) res[p[j] - 1] = j - 1;
  return res;
}
