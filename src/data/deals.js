// DEALS (user, 11 October 2026): every move of a man between clubs, made on the Editor's Trades page, between any number
// of clubs ("What about multi team swaps?"). A deal is its clubs and the men moving between them --
//   { sides: [<team key>, ...], moves: [{ kind: "player" | "manager", id, to: <team key> | null }] }
// -- `sides[0]` the club it is made for. A man goes from where he stands (one of the clubs, or free agency) to another club
// in the deal, or to free agency (to: null): released, or making way for a man coming in. A deal written as { side, other }
// reads as those two. src/data/rules.js turns a deal into what goes live or an offer the other clubs answer.
//
// dealPlan works a deal out on the records (a cart's draft laid over them): a man coming in takes the place of a man
// leaving, the one that fits him best (starters first), never a keeper's place for an outfielder or the other way round;
// a starting place left with nobody coming in is filled from the bench, the man who fits it best (then the higher rated);
// any man still coming in takes an open place; the bench is then sorted into its groups.
// A side may not end with more men than places, or with two managers: `need` says which side must pick who makes way.
// `h` judges squads as rules.js does: h.labels(team), h.fit(own, label), h.ovr(id), h.pos(id).
import { applyDraft, draftWith, idOf, teamKey } from "./draft.js";
import { arrangeBench } from "./squads.js";
import { fitsPlace, posList } from "./positions.js";

const isNat = (t) => t.file === "AVIUM" || t.file === "ARTERRA";
const ids = (t) => t.squad.map(v => idOf(v) ?? null);

// A deal's clubs, each once, the one it is made for first.
export const dealSides = (deal) => [...new Set((Array.isArray(deal?.sides) ? deal.sides : [deal?.side, deal?.other]).filter(Boolean))];
// The men a deal holds, as a request locks them.
export const dealLocks = (deal) => (deal?.moves || []).map(m => (m.kind === "manager" ? "m:" : "p:") + m.id);

// { errors, need, moves, parts, sides, d }: `moves` the deal's men with where each comes from; `parts` the clubs a man
// leaves or joins; `sides` by team key, each with
// its squad after the deal, the men coming in (id, the place he takes and whose it was), the men going (id, where to),
// its count against its places, and its manager before and after; `d` the draft with the deal laid over `draft`.
export function dealPlan(rec, draft, deal, h) {
  const next = applyDraft(rec, draft), byKey = new Map(next.teams.map(t => [teamKey(t), t]));
  const keys = dealSides(deal), sides = keys.map(k => byKey.get(k)), nm = (t) => t.name.trim();
  if (!keys.length || sides.some(t => !t)) return { errors: ["A side in the deal is gone"], need: [] };
  if (sides.some(isNat)) return { errors: ["National sides are not traded"], need: [] };
  const clubOf = new Map(), mgrOf = new Map();
  for (const t of next.teams) if (!isNat(t)) {
    for (const id of ids(t)) if (id) clubOf.set(id, teamKey(t));
    const m = idOf(t.manager); if (m) mgrOf.set(m, teamKey(t));
  }
  const pBy = new Map(next.players.map(p => [p.id, p])), mBy = new Map(next.managers.map(m => [m.id, m]));
  const errors = [], moves = [], seen = new Set();
  for (const raw of Array.isArray(deal.moves) ? deal.moves : []) {
    const kind = raw?.kind === "manager" ? "manager" : "player", r = (kind === "manager" ? mBy : pBy).get(raw?.id);
    if (!r) { errors.push(`No such ${kind}`); continue; }
    if (seen.has(kind + raw.id)) { errors.push(`${r.name} is in the deal twice`); continue; }
    seen.add(kind + raw.id);
    if (kind === "player" && r.retired) { errors.push(`${r.name} has retired`); continue; }
    const from = (kind === "manager" ? mgrOf : clubOf).get(raw.id) || null, to = raw.to || null;
    if (from && !keys.includes(from)) { errors.push(`${r.name} is at ${nm(byKey.get(from))}, which is not in the deal`); continue; }
    if (to && !keys.includes(to)) { errors.push(`${r.name} can only go to a side in the deal`); continue; }
    if (from === to) { errors.push(`${r.name} would stay where he is`); continue; }
    moves.push({ kind, id: raw.id, from, to, name: r.name });
  }
  if (!moves.length && !errors.length) errors.push("A deal moves somebody");
  if (errors.length) return { errors, need: [], moves };

  const own = (id, lab, i) => { const p = posList(h.pos?.(id)); return p.length ? p : [lab[i] || "CM"]; };
  const out = {}, need = [];
  let d = draft;
  for (const t of sides) {
    const k = teamKey(t), lab = h.labels(t), sq = ids(t), len = sq.length, name = nm(t);
    const posOf = (id) => own(id, lab, sq.indexOf(id));
    const going = moves.filter(m => m.kind === "player" && m.from === k), coming = moves.filter(m => m.kind === "player" && m.to === k);
    const before = sq.filter(Boolean).length, after = before - going.length + coming.length;
    // The places the men going leave, each with the man who stood there.
    const left = [];
    for (const m of going) { const i = sq.indexOf(m.id); if (i >= 0) { sq[i] = null; left.push({ i, was: m.id }); } }
    // Each man coming in takes a place left (the pair that fits best first, a starting place before a bench one, the
    // better man first), but never a keeper's place for an outfielder or an outfielder's for a keeper (h.fit's 1000).
    const placed = [], wait = [...coming], NO = 1000;
    let pool = left.map(x => x.i);
    for (;;) {
      let best = null;
      for (const m of wait) for (const i of pool) {
        const c = h.fit(own(m.id, lab, i), lab[i]) + (i < 11 ? 0 : 1e-6);
        if (c >= NO) continue;
        if (!best || c < best.c - 1e-9 || (Math.abs(c - best.c) < 1e-9 && h.ovr(m.id) > h.ovr(best.m.id))) best = { m, i, c };
      }
      if (!best) break;
      sq[best.i] = best.m.id; placed.push({ id: best.m.id, i: best.i, was: left.find(x => x.i === best.i).was });
      wait.splice(wait.indexOf(best.m), 1); pool = pool.filter(i => i !== best.i);
    }
    if (after > len) need.push({ side: k, what: "players", over: after - len });
    // A starting place left with nobody coming in: the bench man who fits it best, then the higher rated.
    const up = [];
    for (let i = 0; i < 11 && after <= len; i++) {
      if (sq[i]) continue;
      let best = -1, bc = Infinity, bo = -Infinity;
      for (let j = 11; j < len; j++) {
        if (!sq[j]) continue;
        const c = h.fit(posOf(sq[j]), lab[i]), o = h.ovr(sq[j]);
        if (c < bc - 1e-9 || (Math.abs(c - bc) < 1e-9 && o > bo)) { best = j; bc = c; bo = o; }
      }
      // No bench man for it: a man still coming in takes it, whatever it is.
      if (best < 0) { const m = wait.shift(); if (!m) { errors.push(`${name}: the starting eleven has an empty place`); break; }
        sq[i] = m.id; placed.push({ id: m.id, i, was: left.find(x => x.i === i)?.was || null }); continue; }
      up.push({ id: sq[best], i }); sq[i] = sq[best]; sq[best] = null;
    }
    // Any man still coming in: the open place that fits him best.
    for (const m of after > len ? [] : wait) {
      const open = sq.map((v, i) => (v ? -1 : i)).filter(i => i >= 0);
      if (!open.length) break;
      const at = open.reduce((b, i) => (h.fit(own(m.id, lab, i), lab[i]) < h.fit(own(m.id, lab, b), lab[b]) ? i : b));
      sq[at] = m.id; placed.push({ id: m.id, i: at, was: left.find(x => x.i === at)?.was || null });
    }
    const fin = after > len ? sq : arrangeBench(sq, lab, (id) => posList(h.pos?.(id)), fitsPlace);
    // Managers: one a side. A man coming in takes the dugout and brings his style.
    const mGo = moves.filter(m => m.kind === "manager" && m.from === k), mCome = moves.filter(m => m.kind === "manager" && m.to === k);
    const mWas = idOf(t.manager) ?? null;
    let mgr = mGo.length ? null : mWas;
    if (mCome.length > 1) errors.push(`${name} would have ${mCome.length} managers`);
    else if (mCome.length) { if (mgr) need.push({ side: k, what: "manager", over: 1 }); else mgr = mCome[0].id; }
    const style = mCome.length === 1 && !(mGo.length ? null : mWas)
      ? (mCome[0].from ? byKey.get(mCome[0].from).style : mBy.get(mCome[0].id)?.style) || t.style : null;
    out[k] = { key: k, name, len, before, after, squad: fin, mWas, mgr, style,
               ins: placed.map(p => ({ ...p, i: fin.indexOf(p.id) })), up: up.map(u => ({ ...u, i: fin.indexOf(u.id) })),
               outs: going.map(m => ({ id: m.id, to: m.to })), mIn: mCome.map(m => m.id), mOut: mGo.map(m => ({ id: m.id, to: m.to })) };
  }
  for (const n of need) {
    const s = out[n.side];
    errors.push(n.what === "manager" ? `${s.name} has a manager: pick where ${mBy.get(s.mWas)?.name || "he"} goes`
      : `${s.name} would have ${s.after} men for ${s.len} places: pick who makes way`);
  }
  const parts = keys.filter(k => moves.some(m => m.from === k || m.to === k));
  if (errors.length) return { errors, need, moves, parts, sides: out };
  for (const s of Object.values(out)) {
    const patch = { squad: s.squad };
    if (s.mgr !== s.mWas) patch.manager = s.mgr;
    if (s.style) patch.style = s.style;
    d = draftWith(d, rec, s.key, patch, "teams");
  }
  // A manager let go keeps the style he would bring to a side (draft.js playerRecord).
  for (const m of moves) if (m.kind === "manager" && m.from && !m.to) {
    const st = byKey.get(m.from)?.style; if (st && mBy.get(m.id)?.style !== st) d = draftWith(d, rec, m.id, { style: st }, "managers");
  }
  return { errors: [], need: [], moves, parts, sides: out, d };
}
