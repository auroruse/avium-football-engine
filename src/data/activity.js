// THE ACTIVITY LOG (DESIGN.md, The Editor, redesigned): every save and answer that put something live, who and what, kept in
// src/data/activity.json, newest first, and the Undo that takes one back. An entry carries what it changed, field by field
// from and to, and the records it added, so it can be undone without the draft that made it: each field goes back to what
// it was, and each added record is dropped. It undoes only while nothing has touched those fields or records since.
import { applyDraft, draftChanges, draftWith, idOf, teamKey } from "./draft.js";
import { squadProblems } from "./rules.js";

export const ACTIVITY_FILE = "src/data/activity.json";
// The log keeps its newest entries; older saves stay in the git history.
export const ACTIVITY_KEEP = 400;
const KINDS = ["players", "managers", "teams", "leagues"];
const keyOf = (k, r) => (k === "teams" ? teamKey(r) : r.id);

// One entry: what `apply` changed in `rec`. `what` is a line for the log ("Save", "Accepted 3 Requests"); `undoes` the
// entry an undo takes back. Null when nothing changed.
export function activityEntry(rec, apply, { id, by, at, what, undoes = null }) {
  if (!apply) return null;
  const changes = draftChanges(rec, apply).map(c => ({ kind: c.kind, id: c.id, name: c.name, field: c.field, from: c.from ?? null, to: c.to ?? null }));
  const added = Object.fromEntries(KINDS.map(k => [k, (apply.add?.[k] || []).map(r => ({ id: keyOf(k, r), name: r.name }))]).filter(([, l]) => l.length));
  const dropped = Object.fromEntries(KINDS.map(k => [k, (apply.drop?.[k] || []).map(x => { const r = (rec[k] || []).find(y => keyOf(k, y) === x); return r ? { id: x, rec: r } : null; }).filter(Boolean)]).filter(([, l]) => l.length));
  if (!changes.length && !Object.keys(added).length && !Object.keys(dropped).length) return null;
  return { id, by, at, what, changes, ...(Object.keys(added).length ? { added } : null), ...(Object.keys(dropped).length ? { dropped } : null), ...(undoes ? { undoes } : null) };
}

// How many things an entry changed: a field each, a record added or dropped each; a man's squad move counts once.
export const activitySize = (e) => (e?.changes || []).length + KINDS.reduce((n, k) => n + (e?.added?.[k]?.length || 0) + (e?.dropped?.[k]?.length || 0), 0);

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const fieldNow = (rec, c) => { const rows = rec[c.kind] || [], r = rows.find(x => keyOf(c.kind, x) === c.id); if (!r) return undefined;
  const v = r[c.field];
  return c.field === "squad" ? (v || []).map(x => idOf(x) ?? null) : c.field === "manager" ? idOf(v) ?? null : v ?? null; };
const padTo = (x, n) => { const out = [...(x || [])]; while (out.length < n) out.push(null); return out; };
const sameField = (f, a, b) => (f === "squad" ? same(padTo(a, Math.max(a?.length || 0, b?.length || 0)), padTo(b, Math.max(a?.length || 0, b?.length || 0)))
  : f === "retired" || f === "removed" ? !!a === !!b : same(a, b));

// THE UNDO: { errors } or { apply } (a draft over `rec` that takes the entry back). Refused when an entry was already
// undone, when a field it set reads otherwise now, when a record it added was changed or moved since, or when what it
// leaves would not add up.
export function undoPlan(rec, entry, h) {
  if (!entry) return { errors: ["No such entry"] };
  if (entry.undone) return { errors: ["Already undone"] };
  const errors = [];
  let d = { v: 1, players: {} };
  const addedIds = new Set(KINDS.flatMap(k => (entry.added?.[k] || []).map(x => k + ":" + x.id)));
  for (const c of entry.changes || []) {
    const now = fieldNow(rec, c);
    if (now === undefined) { if (!addedIds.has(c.kind + ":" + c.id)) errors.push(`${c.name} is gone`); continue; }
    if (!sameField(c.field, now, c.to)) { errors.push(`${c.name} has changed since`); continue; }
    d = draftWith(d, rec, c.id, { [c.field]: c.from }, c.kind);
  }
  // A record it added goes, unless a later save has changed it (a man moved to another club, his rating changed).
  const drop = {};
  for (const k of KINDS) for (const x of entry.added?.[k] || []) {
    const r = (rec[k] || []).find(y => keyOf(k, y) === x.id);
    if (!r) continue;
    (drop[k] = drop[k] || []).push(x.id);
  }
  // A record it dropped (an undo's undo) comes back as it was.
  const add = {};
  for (const k of KINDS) for (const x of entry.dropped?.[k] || []) if (!(rec[k] || []).some(y => keyOf(k, y) === x.id)) (add[k] = add[k] || []).push(x.rec);
  if (Object.keys(drop).length) d = { ...d, drop };
  if (Object.keys(add).length) d = { ...d, add };
  if (errors.length) return { errors: [...new Set(errors)] };
  const next = applyDraft(rec, d);
  // Nobody dropped may still stand in a squad or a dugout: a later save put him somewhere this undo does not reach.
  const gone = new Set((drop.players || []).concat(drop.managers || []));
  for (const t of next.teams) {
    const held = [...(t.squad || []).map(v => idOf(v)), idOf(t.manager)].filter(id => id && gone.has(id));
    for (const id of held) errors.push(`${(rec.players.find(p => p.id === id) || rec.managers.find(m => m.id === id))?.name || id} is at ${t.name.trim()} now`);
  }
  if (errors.length) return { errors: [...new Set(errors)] };
  const keys = new Set([...(entry.changes || []).filter(c => c.kind === "teams" && c.field === "squad").map(c => c.id)].filter(k => next.teams.some(t => teamKey(t) === k)));
  const probs = squadProblems(rec, next, keys, h);
  return probs.length ? { errors: probs } : { errors: [], apply: d };
}

// The log with an entry put first, its oldest beyond the keep let go.
export const logWith = (log, entry) => (entry ? [entry, ...(log || [])].slice(0, ACTIVITY_KEEP) : log || []);
// The log with an entry marked undone, by whom and when.
export const markUndone = (log, id, by, at) => (log || []).map(e => (e.id === id ? { ...e, undone: { by, at } } : e));
export const dumpActivity = (log) => JSON.stringify(log || [], null, 1) + "\n";
// Several entries as one (an approval answering many requests): a field changed twice reads from its first `from` to its
// last `to`, and one back where it started drops out.
export function mergeEntries(list, meta) {
  const es = (list || []).filter(Boolean);
  if (!es.length) return null;
  const byKey = new Map();
  for (const e of es) for (const c of e.changes || []) { const k = c.kind + ":" + c.id + ":" + c.field, was = byKey.get(k);
    byKey.set(k, was ? { ...was, to: c.to } : c); }
  const changes = [...byKey.values()].filter(c => !sameField(c.field, c.from, c.to));
  const added = {}, dropped = {};
  for (const e of es) for (const k of KINDS) { if (e.added?.[k]) added[k] = [...(added[k] || []), ...e.added[k]]; if (e.dropped?.[k]) dropped[k] = [...(dropped[k] || []), ...e.dropped[k]]; }
  return { ...meta, changes, ...(Object.keys(added).length ? { added } : null), ...(Object.keys(dropped).length ? { dropped } : null) };
}
