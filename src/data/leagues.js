// THE LEAGUES (Moukden and Kirin, 11 October 2026). src/data/leagues.json keeps a record a league: the name its clubs
// carry (a club's `group`), its nation, its tier (0 for none) and the cup its clubs enter. A league's editor renames it,
// moves its tier and changes its cup freely; a new one is a request with its founding clubs (src/data/rules.js).
// A rename keeps the old name in `formerly`, so whatever finds a league by name still finds it: the archive's folders,
// its badge, and the clubs a saved tournament names (a club's ID is its league's first name and its code). A league made
// in the Editor is `listed`: it stands as a league of its own from its first club, where one from before still needs six.

// One league record in the file's own key order; listed and formerly only when they say something.
export const leagueRecord = (l) => ({ id: l.id, name: l.name, nation: l.nation, tier: l.tier, cup: l.cup || null,
  ...(l.listed ? { listed: true } : null), ...(l.formerly?.length ? { formerly: l.formerly } : null) });

// Everything the app looks a league up by, from the records: its tier, cup and nation by name, the name it carries now
// for any name it had, the name its clubs' IDs were made with, its old names newest first, and the leagues listed early.
export function leagueMaps(leagues) {
  const tier = new Map(), cup = new Map(), nation = new Map(), now = new Map(), first = new Map(), former = new Map(), listed = new Set();
  for (const l of leagues || []) {
    tier.set(l.name, l.tier); nation.set(l.name, l.nation);
    if (l.cup) cup.set(l.name, l.cup);
    if (l.listed) listed.add(l.name);
    const was = (l.formerly || []).filter(f => f !== l.name);
    for (const f of was) now.set(f, l.name);
    if (was.length) { first.set(l.name, was[0]); former.set(l.name, [...was].reverse()); }
  }
  return { tier, cup, nation, now, first, former, listed };
}

// Whether a name is free for a league: no league carries it now or carried it before, but the one being renamed.
export const leagueNameFree = (leagues, name, self) => { const f = String(name || "").trim().toLowerCase();
  return !(leagues || []).some(l => l.id !== self && [l.name, ...(l.formerly || [])].some(n => n.toLowerCase() === f)); };
