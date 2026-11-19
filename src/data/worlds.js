// THE TWO UNIVERSES. Avium and Arterra share this engine and nothing else (Moukden and Kirin, 19 November 2026: "waterproof,
// separating the two universes in one engine"): no side, player, manager, league, match, tournament, transfer or record of
// one is ever seen, picked, searched or changed from the other. The app shows one at a time (App.tsx: a sealed instance a
// universe, built from scopeRecords); the registry server refuses any change that would join them (sealDraft, through
// src/data/rules.js); each keeps its own time (src/data/icclock.js).
//
// WHERE A RECORD BELONGS.
//   A national side: the sheet it is on, AVIUM or ARTERRA.
//   A club or a league: its nation's universe (the nation whose national side has that code). National codes are therefore
//   never shared between the two, which also keeps an editor's rights, given by nation code, in one universe.
//   A player or a manager: his own record says so, `world: "arterra"`; a record without the field is Avium's. It is set
//   when he is made and never changes (no cart can patch it: it is not one of src/data/draft.js's fields).
export const WORLDS = ["avium", "arterra"];
export const WORLD_NAME = { avium: "Avium", arterra: "Arterra" };
export const NT_FILE = { avium: "AVIUM", arterra: "ARTERRA" };
const FILE_WORLD = { AVIUM: "avium", ARTERRA: "arterra" };
const idOf = (v) => (v && typeof v === "object" && "id" in v ? v.id : v);

export const isWorld = (w) => w === "avium" || w === "arterra";
// A man's universe, off his record.
export const manWorld = (r) => (r?.world === "arterra" ? "arterra" : "avium");
// Each nation's universe by its code, from the national sides.
export const nationWorlds = (teams) => new Map((teams || []).filter(t => FILE_WORLD[t.file]).map(t => [t.code, FILE_WORLD[t.file]]));
// A side's universe: a national side's sheet, a club's nation.
export const teamWorld = (t, natW) => FILE_WORLD[t?.file] || natW?.get(t?.nation) || "avium";
export const leagueWorld = (l, natW) => natW?.get(l?.nation) || "avium";

// ONE UNIVERSE'S RECORDS, out of them all: what an instance of the app is built from, so that nothing of the other can
// reach a list, a search, a picker or a page. Sheets keep every header (a sheet with no sides writes its header alone).
export function scopeRecords(rec, world) {
  const natW = nationWorlds(rec.teams);
  return { ...rec,
    players: rec.players.filter(p => manWorld(p) === world),
    managers: rec.managers.filter(m => manWorld(m) === world),
    teams: rec.teams.filter(t => teamWorld(t, natW) === world),
    leagues: (rec.leagues || []).filter(l => leagueWorld(l, natW) === world) };
}

// WHAT WOULD JOIN THE TWO, in these records: a list of problems, empty when they are sealed. Run on the records as a
// change would leave them, by the server before it commits anything and by the app before it sends a cart.
export function worldProblems(rec) {
  const out = [], natW = nationWorlds(rec.teams);
  const seen = new Map();
  for (const t of rec.teams) if (FILE_WORLD[t.file]) {
    const w = FILE_WORLD[t.file], was = seen.get(t.code);
    if (was && was !== w) out.push(`${t.name.trim()}: the code ${t.code} is a nation of ${WORLD_NAME[was]}`);
    seen.set(t.code, w);
  }
  const P = new Map(rec.players.map(p => [p.id, p])), M = new Map(rec.managers.map(m => [m.id, m]));
  for (const t of rec.teams) {
    const w = teamWorld(t, natW), name = t.name.trim();
    for (const v of t.squad || []) { const p = P.get(idOf(v)); if (p && manWorld(p) !== w) out.push(`${name}: ${p.name} belongs to ${WORLD_NAME[manWorld(p)]}`); }
    const m = M.get(idOf(t.manager)); if (m && manWorld(m) !== w) out.push(`${name}: ${m.name} belongs to ${WORLD_NAME[manWorld(m)]}`);
  }
  // A nationality that is a nation of the other universe.
  for (const r of [...rec.players, ...rec.managers]) { const w = natW.get(r.nat);
    if (w && w !== manWorld(r)) out.push(`${r.name}: ${r.nat} is a nation of ${WORLD_NAME[w]}`); }
  const leagues = new Map();
  for (const t of rec.teams) if (!FILE_WORLD[t.file] && t.group) { const w = teamWorld(t, natW), k = t.group, was = leagues.get(k);
    if (was && was !== w) out.push(`${t.group}: a league holds clubs of one universe`); leagues.set(k, w); }
  return [...new Set(out)];
}

// A DRAFT, SEALED: every man it adds is given his universe (his nation's when it is a nation of one; else the side he is
// made for; else Avium), and the records it would leave are checked. Returns { d, problems }; `d` is the draft to apply,
// the same one the server sends back for the app to lay over its own records, so both agree on where each new man is.
export function sealDraft(rec, d, applyDraft) {
  if (!d) return { d, problems: [] };
  let out = d;
  const added = [...(d.add?.players || []), ...(d.add?.managers || [])];
  if (added.some(r => !r.world)) {
    const next = applyDraft(rec, d), natW = nationWorlds(next.teams), at = new Map();
    for (const t of next.teams) { const w = teamWorld(t, natW);
      for (const v of t.squad || []) if (idOf(v)) at.set("p:" + idOf(v), w);
      if (idOf(t.manager)) at.set("m:" + idOf(t.manager), w); }
    const stamp = (kind) => (r) => { if (r.world) return r;
      const w = natW.get(r.nat) || at.get(kind + ":" + r.id) || "avium"; return w === "arterra" ? { ...r, world: "arterra" } : r; };
    out = { ...d, add: { ...d.add, ...(d.add.players ? { players: d.add.players.map(stamp("p")) } : null),
                                    ...(d.add.managers ? { managers: d.add.managers.map(stamp("m")) } : null) } };
  }
  return { d: out, problems: worldProblems(applyDraft(rec, out)) };
}
