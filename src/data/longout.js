// LONG INJURIES, AND THE YEAR THEY ARE COUNTED AGAINST (DESIGN.md "The referee, the touchlines and injuries"; the user,
// 24 November 2026: "really bad injuries causing players to miss the entire year or a set number of tournaments").
//
// A year of football runs, in this order: the World Cup; the leagues, the cups and everything else; the Club World
// Cup and the Club World Shield; the Nations League; the World Cup Qualifiers (the user: "these should have different
// weights"). Each is given a share of the year by its size, twelve units in all, so an injury's length is a stretch
// of that calendar and a league season costs three times what a World Cup does. A competition's season is placed by
// its folder in the archive and its year; the qualifiers lead to the World Cup they are named for, so they close the
// year before it, and a league written across two years (35-36) belongs to the year it starts in.
//
// The length is by injury (config.ts ME_INJURY `long`): "comp" for the middling bad ones, `out` units from the moment
// he was hurt; "year" for the worst three, the rest of the year, and hurt in its second half the World Cup that opens
// the next as well. Everybody who reads a filed season works the same span out of the same row, so nothing but the
// row is stored.
export const LONG_SLOTS = [
  { k: "wc", label: "World Cup", w: 2 },
  { k: "league", label: "League And Cup", w: 6 },
  { k: "cwc", label: "Club World Cup", w: 2 },
  { k: "natl", label: "Nations League", w: 1 },
  { k: "wcq", label: "World Cup Qualifiers", w: 1 },
];
export const LONG_YEAR = LONG_SLOTS.reduce((a, s) => a + s.w, 0);
const START = LONG_SLOTS.map((_, i) => LONG_SLOTS.slice(0, i).reduce((a, s) => a + s.w, 0));
const SLOT_OF_FOLDER = { wc: 0, cwc: 2, cws: 2, natl: 3, western: 4, eastern: 4 };
const pivot = (yy) => (yy >= 50 ? 1800 : 1900) + yy;

// Where a filed season sits: { c: the year it belongs to, slot }. `folder` is its folder in the archive, `season` its
// file name ("1936" or "35-36").
export function longPlaceOfFile(folder, season) {
  const slot = SLOT_OF_FOLDER[String(folder || "").toLowerCase()] ?? 1;
  const two = /^(\d{2})[-/](\d{2})$/.exec(season || ""), one = /^(\d{4})$/.exec(season || "");
  if (!two && !one) return null;
  const y = one ? +one[1] : pivot(+two[1]);
  return { c: slot === 4 ? y - 1 : y, slot };
}
// Where a competition being played sits, from the name it was given ("1936 World Cup", "League One 35-36"); with no
// year in the name, the year it is now.
export function longPlaceOfName(name, yearNow) {
  const n = String(name || "");
  const slot = /qualif/i.test(n) ? 4 : /nations league/i.test(n) ? 3 : /club world/i.test(n) ? 2 : /world cup/i.test(n) ? 0 : 1;
  const two = /(?:^|\D)(\d{2})[-/](\d{2})(?:\D|$)/.exec(n), one = /(?:^|\D)(1[89]\d{2}|20\d{2})(?:\D|$)/.exec(n);
  const y = two ? pivot(+two[1]) : one ? +one[1] : yearNow;
  if (!Number.isFinite(y)) return null;
  return { c: slot === 4 && !two ? y - 1 : y, slot };
}
const hash01 = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; };
const at = (place, f) => place.c * LONG_YEAR + START[place.slot] + Math.max(0, Math.min(1, f || 0)) * LONG_SLOTS[place.slot].w;

// The stretch of the calendar a long injury covers: { from, to } in units, or null if it is not a long one. `sev` is the
// injury's row of the table, `place` where the competition he was hurt in sits, `f` how far through it (0 to 1), `who`
// anything that names him (it settles where in the row's range his own lay-off falls).
export function longSpan(sev, place, f, who) {
  if (!sev?.long || !place) return null;
  const from = at(place, f);
  if (sev.long === "comp") { const [a, b] = sev.out || [2, 3]; return { from, to: from + a + (b - a) * hash01(String(who || "") + sev.id) }; }
  const end = (place.c + 1) * LONG_YEAR;
  return { from, to: from - place.c * LONG_YEAR >= LONG_YEAR / 2 ? end + LONG_SLOTS[0].w : end };
}
// How much of a competition he misses, as a share of it from its start (0: none, 1: all of it).
export function longMiss(span, place) {
  if (!span || !place) return 0;
  const a = at(place, 0), w = LONG_SLOTS[place.slot].w;
  if (span.to <= a || span.from >= a + w) return 0;
  return Math.max(0, Math.min(1, (span.to - a) / w));
}
// When he is back, for a reader: the year and the competition whose share of it the end of his lay-off falls in.
export function longBack(span) {
  if (!span) return null;
  const c = Math.floor(span.to / LONG_YEAR), u = span.to - c * LONG_YEAR;
  let slot = LONG_SLOTS.length - 1;
  for (let i = 0; i < LONG_SLOTS.length; i++) if (u < START[i] + LONG_SLOTS[i].w) { slot = i; break; }
  return { c, slot, label: LONG_SLOTS[slot].label };
}

// THE BLOCK IN A SEASON'S STATS SHEET: beside the leaderboards, under a heading of its own that the leaderboard reader
// does not take for one (it looks for PLAYER). One row a man: his name, position, side, the injury (the table's id),
// how far through the competition he was hurt, and his record's id when there is one.
export const LONG_HEAD = ["#", "INJURED", "POS", "TEAM", "INJURY", "AT", "ID"];
export function parseLongBlock(text) {
  const rows = String(text || "").replace(/\r\n/g, "\n").split("\n").filter(r => r.trim()).map(r => r.split("\t"));
  const i = (rows[0] || []).indexOf("INJURED");
  if (i < 0) return [];
  const out = [];
  for (const r of rows.slice(1)) if (r[i]) out.push({ name: r[i], pos: r[i + 1] || "", team: r[i + 2] || "", sev: r[i + 3] || "", at: +r[i + 4] || 0, id: r[i + 5] || "" });
  return out;
}
