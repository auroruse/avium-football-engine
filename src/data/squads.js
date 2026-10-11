// SQUAD MOVES, as the record editor makes them. A squad is its slots in order (a man's ID or null): eleven starters,
// then the bench. `labels` names each slot's position (the formation's, then each bench place's group), and `fit(a, b)`
// is how far a man who plays `a` (a position or his list of them) is from slot `b` (the app's posFitCost). `posOf(id)`,
// where given, is a man's own positions; without it a man is judged by the place he stands in. Club squads stay at
// sixteen and national ones at twenty-two, so a man comes in only where a place is open.

// A man leaving. A starting place he leaves goes to the bench player who fits it best (then the higher rated), whose
// bench place stays open; a bench place he leaves simply opens.
export function vacate(squad, i, labels, fit, ovrOf, posOf) {
  const sq = [...squad];
  sq[i] = null;
  if (i >= 11) return sq;
  let best = -1, bestCost = Infinity, bestOvr = -Infinity;
  for (let j = 11; j < sq.length; j++) {
    if (!sq[j]) continue;
    const own = posOf?.(sq[j]), c = fit(own && own.length ? own : labels[j], labels[i]), o = ovrOf(sq[j]);
    if (c < bestCost - 1e-9 || (Math.abs(c - bestCost) < 1e-9 && o > bestOvr)) { best = j; bestCost = c; bestOvr = o; }
  }
  if (best >= 0) { sq[i] = sq[best]; sq[best] = null; }
  return sq;
}

// Where a man coming in goes: an open starting place first (the one his position fits best), else the open bench
// place that fits him best. -1 when the squad is full.
export function placeFor(squad, labels, fit, pos) {
  const open = squad.map((v, i) => (v ? -1 : i)).filter(i => i >= 0);
  if (!open.length) return -1;
  const xi = open.filter(i => i < 11), pool = xi.length ? xi : open;
  return pool.reduce((b, i) => (fit(pos, labels[i]) < fit(pos, labels[b]) ? i : b), pool[0]);
}

// A squad with this man taken out of it, wherever he stands (and the bench filling in behind him).
export const without = (squad, id, labels, fit, ovrOf, posOf) => {
  const i = squad.indexOf(id);
  return i < 0 ? squad : vacate(squad, i, labels, fit, ovrOf, posOf);
};

// THE BENCH IN ITS PLACES (Moukden and Kirin, 11 October 2026: a bench place keeps its group). After a man comes or
// goes, the substitutes are put in the places their own positions fit -- as many as the bench allows, a man who fits
// where he stands staying there -- and the rest keep the order they had. `fits(own, label)` is positions.js fitsPlace;
// `posOf(v)` a man's positions, for an ID or a new man.
export function arrangeBench(squad, labels, posOf, fits) {
  const sq = [...squad], idx = [];
  for (let i = 11; i < sq.length; i++) idx.push(i);
  if (!posOf || !fits || !idx.some(i => sq[i])) return sq;
  const ok = (m, i) => fits(posOf(m), labels[i]);
  const manAt = new Map(), placeOf = new Map();
  for (const i of idx) { const m = sq[i]; if (m && ok(m, i)) { manAt.set(i, m); placeOf.set(m, i); } }
  const take = (m, seen) => {
    for (const i of idx) { if (seen.has(i) || !ok(m, i)) continue; seen.add(i);
      const o = manAt.get(i); if (o === undefined || take(o, seen)) { manAt.set(i, m); placeOf.set(m, i); return true; } }
    return false; };
  for (const i of idx) { const m = sq[i]; if (m && !placeOf.has(m)) take(m, new Set()); }
  const out = [...sq.slice(0, 11), ...idx.map(() => null)];
  for (const [i, m] of manAt) out[i] = m;
  for (const i of idx) { const m = sq[i]; if (!m || placeOf.has(m)) continue;
    const at = out[i] == null ? i : idx.find(j => out[j] == null); if (at != null) out[at] = m; }
  return out;
}
