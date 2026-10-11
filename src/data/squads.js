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
