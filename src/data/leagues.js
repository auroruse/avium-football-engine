// THE LEAGUES (Moukden and Kirin, 11 October 2026). src/data/leagues.json keeps a record a league: the name its clubs
// carry (a club's `group`), its nation, its tier (0 for none) and the cup its clubs enter. A league's editor renames it,
// moves its tier and changes its cup freely; a new one is a request with its founding clubs (src/data/rules.js).
// A rename keeps the old name in `formerly`, so whatever finds a league by name still finds it: the archive's folders,
// its badge, and the clubs a saved tournament names (a club's ID is its league's first name and its code). A league made
// in the Editor is `listed`: it stands as a league of its own from its first club, where one from before still needs six.

// HOW MANY GO UP AND DOWN (Moukden and Kirin, 11 October 2026): `up` and `down` are the places a season sends to the
// division above and below outright; a playoff its report records settles any place besides (seasonMoves in App.tsx).
// A league's CONFERENCES (the ANCC, Moukden and Kirin, 12 October 2026): its clubs split into named groups, in the order its
// playoff crosses them, each { name, clubs: [team IDs] }. A college league (`college`, src/data/colleges.js) is the
// overseer's to mark. One league record in the file's own key order; up, down, listed, formerly, college and conferences
// only when they say something.
export const leagueRecord = (l) => ({ id: l.id, name: l.name, nation: l.nation, tier: l.tier, cup: l.cup || null,
  ...(l.up ? { up: l.up } : null), ...(l.down ? { down: l.down } : null),
  ...(l.listed ? { listed: true } : null), ...(l.formerly?.length ? { formerly: l.formerly } : null),
  ...(l.college ? { college: true } : null),
  ...(l.conferences?.length ? { conferences: l.conferences.map(c => ({ name: c.name, clubs: [...(c.clubs || [])] })) } : null) });

// What is wrong with a league's conferences, or null: two to eight, each a name of its own and clubs of the league
// (`clubIds`, its clubs' team IDs), no club in two.
export function conferencesProblem(confs, clubIds) {
  if (confs == null) return null;
  if (!Array.isArray(confs) || confs.length < 2 || confs.length > 8) return "a league has two to eight conferences, or none";
  const names = new Set(), seen = new Set();
  for (const c of confs) {
    const n = typeof c?.name === "string" ? c.name : "";
    if (!n || n !== n.trim() || n.length > 40 || /[\u0000-\u001f\u007f]/.test(n)) return "a conference needs a name";
    if (names.has(n.toLowerCase())) return `two conferences are called ${n}`;
    names.add(n.toLowerCase());
    if (!Array.isArray(c.clubs)) return `${n} has no clubs`;
    for (const id of c.clubs) {
      if (!clubIds.has(id)) return `${n} names a club outside the league`;
      if (seen.has(id)) return "a club is in two conferences";
      seen.add(id);
    }
  }
  return null;
}

// Everything the app looks a league up by, from the records: its tier, cup and nation by name, the name it carries now
// for any name it had, the name its clubs' IDs were made with, its old names newest first, and the leagues listed early.
export function leagueMaps(leagues) {
  const tier = new Map(), cup = new Map(), nation = new Map(), now = new Map(), first = new Map(), former = new Map(), listed = new Set();
  const up = new Map(), down = new Map();
  for (const l of leagues || []) {
    tier.set(l.name, l.tier); nation.set(l.name, l.nation);
    if (l.up) up.set(l.name, l.up);
    if (l.down) down.set(l.name, l.down);
    if (l.cup) cup.set(l.name, l.cup);
    if (l.listed) listed.add(l.name);
    const was = (l.formerly || []).filter(f => f !== l.name);
    for (const f of was) now.set(f, l.name);
    if (was.length) { first.set(l.name, was[0]); former.set(l.name, [...was].reverse()); }
  }
  return { tier, cup, nation, now, first, former, listed, up, down };
}

// Whether a name is free for a league: no league carries it now or carried it before, but the one being renamed.
export const leagueNameFree = (leagues, name, self) => { const f = String(name || "").trim().toLowerCase();
  return !(leagues || []).some(l => l.id !== self && [l.name, ...(l.formerly || [])].some(n => n.toLowerCase() === f)); };
