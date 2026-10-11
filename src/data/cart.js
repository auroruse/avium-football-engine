// THE CART'S ITEMS: what the review lists, each with one remove. The draft's changes are grouped by the person or team
// they change, and groups that only make sense together become one item, so removing it never leaves half a move
// behind: a man who left one drafted club and joined another ties the two clubs (a transfer is one item, both sides),
// a manager the same, and a retired man ties to every team he left. A call-up moves nobody, so it ties nothing.
import { draftChanges, teamKey } from "./draft.js";
import { isNational } from "./rules.js";

// [{ key, groups: [{ key, kind, id, name, rows }] }], in the order the draft's changes come; then each trade ({ key,
// trade, groups: [] }) and each new record asked for ({ key, rec, groups: [] }), an item apiece.
export function cartItems(rec, draft) {
  const changes = draftChanges(rec, draft);
  const groups = new Map();
  for (const c of changes) {
    const k = c.kind + ":" + c.id;
    if (!groups.has(k)) groups.set(k, { key: k, kind: c.kind, id: c.id, name: c.name, rows: [] });
    groups.get(k).rows.push(c);
  }
  const up = new Map([...groups.keys()].map(k => [k, k]));
  const root = (k) => { while (up.get(k) !== k) k = up.get(k); return k; };
  const tie = (a, b) => { if (groups.has(a) && groups.has(b) && root(a) !== root(b)) up.set(root(a), root(b)); };
  const teamBy = new Map(rec.teams.map(t => [teamKey(t), t]));
  const left = new Map(), joined = new Map();                 // a man (or "m:" a manager) -> the drafted teams he left or joined
  const note = (m, who, k) => m.set(who, [...(m.get(who) || []), k]);
  for (const c of changes.filter(c => c.kind === "teams")) {
    const k = "teams:" + c.id;
    if (c.field === "squad") {
      for (const id of c.from) if (id && !c.to.includes(id)) note(left, id, k);
      for (const id of c.to) if (id && !c.from.includes(id)) note(joined, id, k);
    }
    if (c.field === "manager") { if (c.from) note(left, "m:" + c.from, k); if (c.to) note(joined, "m:" + c.to, k); }
  }
  const isClub = (k) => { const t = teamBy.get(k.slice("teams:".length)); return !!t && !isNational(t); };
  for (const who of new Set([...left.keys(), ...joined.keys()])) {
    const clubs = [...(left.get(who) || []), ...(joined.get(who) || [])].filter(isClub);
    if ((left.get(who) || []).some(isClub) && (joined.get(who) || []).some(isClub)) clubs.forEach(k => tie(clubs[0], k));
  }
  for (const c of changes.filter(c => c.kind === "players" && c.field === "retired" && c.to))
    for (const k of left.get(c.id) || []) tie("players:" + c.id, k);
  const items = new Map();
  for (const g of groups.values()) {
    const r = root(g.key);
    if (!items.has(r)) items.set(r, { key: r, groups: [] });
    items.get(r).groups.push(g);
  }
  return [...items.values(), ...(draft?.trades || []).map(tr => ({ key: "trade:" + tr.id, trade: tr, groups: [] })),
    ...(draft?.new || []).map(n => ({ key: "new:" + n.id, rec: n, groups: [] }))];
}

// The draft without one item.
export function withoutItem(rec, draft, item) {
  if (item.trade || item.rec) { const k = item.trade ? "trades" : "new", id = (item.trade || item.rec).id, l = (draft[k] || []).filter(x => x.id !== id);
    const d = { ...draft, [k]: l }; if (!l.length) delete d[k]; return d; }
  let d = { ...draft };
  for (const g of item.groups) { const grp = { ...(d[g.kind] || {}) }; delete grp[g.id]; d[g.kind] = grp; }
  for (const k of ["managers", "teams"]) if (d[k] && !Object.keys(d[k]).length) { d = { ...d }; delete d[k]; }
  return d;
}
