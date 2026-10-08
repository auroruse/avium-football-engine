// THE OVERSEER'S DRAFT: changes made in the app, kept in his browser until he publishes them. A draft is a patch over
// the records, field by field --
//   { v: 1, players: { p0001: { ovr: 86, nat: "ESU", badges: ["rapid"] } },
//           managers: { m0042: { ovr: 81 } },
//           teams: { t0123: { formation: "4-4-2", style: "Gegenpressing", manager: "m0042", squad: ["p0007", ...] } } }
// -- so it lays over whatever the records are when it is applied: the ones the page was built with, or main as it
// stands at publish. A team is keyed by its permanent ID (t0001...); a squad is its slots in order, a man's ID or null.
import { badgeOrder } from "./badges.js";

export const teamKey = (t) => t.id || t.file + "|" + t.code;
const KINDS = {
  // pos is kept only for a man on no team (the position he last played, for whoever signs him); retired takes a man
  // out of play for good while his record stays.
  players: { fields: ["ovr", "nat", "badges", "pos", "retired"], key: (r) => r.id, label: (r) => r.name },
  managers: { fields: ["ovr"], key: (r) => r.id, label: (r) => r.name },
  teams: { fields: ["name", "code", "home", "away", "stadium", "location", "formation", "style", "manager", "squad"], key: teamKey,
           label: (t) => t.name.trim() },
};
export const PLAYER_FIELDS = KINDS.players.fields;
// A cell kept as the sheet wrote it ({ id, tag } or { id, raw }) is still that man.
export const idOf = (v) => v && typeof v === "object" && "id" in v ? v.id : v;
// A field as compared: badges in table order, a squad or a manager as the people it names.
const norm = (f, v) => f === "badges" ? badgeOrder(v) : f === "squad" ? (v || []).map(s => idOf(s) ?? null)
  : f === "manager" ? idOf(v) ?? null : f === "retired" ? !!v : f === "pos" ? v || null : v;
const same = (f, a, b) => JSON.stringify(norm(f, a) ?? null) === JSON.stringify(norm(f, b) ?? null);

// One player (or manager) record in the records' own key order; pos, badges and retired only when they say something.
export const playerRecord = (r) => ({ id: r.id, name: r.name, nat: r.nat, ovr: r.ovr, ...(r.pos ? { pos: r.pos } : null),
  ...(r.badges?.length ? { badges: badgeOrder(r.badges) } : null), ...(r.retired ? { retired: true } : null) });

// How many people and teams a draft touches.
export const draftSize = (d) => ["players", "managers", "teams"].reduce((n, k) => n + Object.keys(d?.[k] || {}).length, 0);

// The records with the draft laid over them. Nothing in the draft that names a missing record is applied.
export function applyDraft(rec, draft) {
  if (!draftSize(draft)) return rec;
  const ps = draft.players || {}, ms = draft.managers || {}, ts = draft.teams || {};
  // A cell kept as the sheet wrote it is written fresh once its man is edited: its text would carry his old rating.
  const fresh = (book) => (v) => v && typeof v === "object" && v.id && book[v.id] ? v.id : v;
  const fp = fresh(ps), fm = fresh(ms);
  return { ...rec,
    players: rec.players.map(r => ps[r.id] ? playerRecord({ ...r, ...ps[r.id] }) : r),
    managers: rec.managers.map(r => ms[r.id] ? playerRecord({ ...r, ...ms[r.id] }) : r),
    teams: rec.teams.map(t => {
      const p = ts[teamKey(t)];
      let n = p ? { ...t, ...Object.fromEntries(KINDS.teams.fields.filter(f => f in p).map(f => [f, p[f]])) } : t;
      if (n.squad.some(v => fp(v) !== v)) n = { ...n, squad: n.squad.map(fp) };
      if (fm(n.manager) !== n.manager) n = { ...n, manager: fm(n.manager) };
      return n;
    }) };
}

// What the draft actually changes against these records, a row a field: { kind, id, name, field, from, to }.
export function draftChanges(rec, draft) {
  const out = [];
  for (const [kind, K] of Object.entries(KINDS)) {
    const patches = draft?.[kind] || {};
    if (!Object.keys(patches).length) continue;
    const by = new Map(rec[kind].map(r => [K.key(r), r]));
    for (const [id, patch] of Object.entries(patches)) {
      const r = by.get(id);
      if (!r) continue;
      for (const f of K.fields) if (f in patch && !same(f, r[f], patch[f]))
        out.push({ kind, id, name: K.label(r), field: f, from: norm(f, r[f]), to: norm(f, patch[f]) });
    }
  }
  return out;
}

// A draft with one record's fields set, dropping any field that is back where the records have it.
export function draftWith(draft, rec, id, fields, kind = "players") {
  const K = KINDS[kind], base = rec[kind].find(r => K.key(r) === id);
  const cur = { ...(draft?.[kind]?.[id] || {}), ...fields };
  for (const f of Object.keys(cur)) if (same(f, cur[f], base?.[f])) delete cur[f];
  const group = { ...(draft?.[kind] || {}) };
  if (Object.keys(cur).length) group[id] = cur; else delete group[id];
  const out = { v: 1, players: {}, ...(draft || {}), [kind]: group };
  for (const k of ["managers", "teams"]) if (out[k] && !Object.keys(out[k]).length) delete out[k];
  return out;
}

// The records' file format: one record a line, so a change reads as a change to that line.
export const dumpRecords = (rows) => "[\n" + rows.map(r => JSON.stringify(r)).join(",\n") + "\n]\n";
