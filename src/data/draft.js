// THE OVERSEER'S DRAFT: changes made in the app, kept in his browser until he publishes them. A draft is a patch over
// the records, field by field -- { v: 1, players: { p0001: { ovr: 86, nat: "ESU", badges: ["rapid"] } } } -- so it lays
// over whatever the records are when it is applied: the ones the page was built with, or main as it stands at publish.
import { badgeOrder } from "./badges.js";

export const PLAYER_FIELDS = ["ovr", "nat", "badges"];
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// One player record in the records' own key order; badges only when he has some.
export const playerRecord = (r) => ({ id: r.id, name: r.name, nat: r.nat, ovr: r.ovr, ...(r.badges?.length ? { badges: badgeOrder(r.badges) } : null) });

// The records with the draft laid over them. Nothing in the draft that names a missing record is applied.
export function applyDraft(rec, draft) {
  const ps = draft?.players;
  if (!ps || !Object.keys(ps).length) return rec;
  return { ...rec, players: rec.players.map(r => ps[r.id] ? playerRecord({ ...r, ...ps[r.id] }) : r) };
}

// What the draft actually changes against these records, a row a field: { id, name, field, from, to }.
export function draftChanges(rec, draft) {
  const out = [], byId = new Map(rec.players.map(r => [r.id, r]));
  for (const [id, patch] of Object.entries(draft?.players || {})) {
    const r = byId.get(id);
    if (!r) continue;
    for (const f of PLAYER_FIELDS) if (f in patch) {
      const from = f === "badges" ? badgeOrder(r.badges) : r[f], to = f === "badges" ? badgeOrder(patch[f]) : patch[f];
      if (!same(from, to)) out.push({ id, name: r.name, field: f, from, to });
    }
  }
  return out;
}

// A draft with one player's fields set, dropping any field that is back where the records have it.
export function draftWith(draft, rec, id, fields) {
  const base = rec.players.find(r => r.id === id);
  const cur = { ...(draft?.players?.[id] || {}), ...fields };
  for (const f of Object.keys(cur)) {
    const a = f === "badges" ? badgeOrder(cur[f]) : cur[f], b = f === "badges" ? badgeOrder(base?.[f]) : base?.[f];
    if (same(a, b)) delete cur[f];
  }
  const players = { ...(draft?.players || {}) };
  if (Object.keys(cur).length) players[id] = cur; else delete players[id];
  return { v: 1, players };
}

// The records' file format: one record a line, so a change reads as a change to that line.
export const dumpRecords = (rows) => "[\n" + rows.map(r => JSON.stringify(r)).join(",\n") + "\n]\n";
