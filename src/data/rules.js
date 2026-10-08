// THE REGISTRY'S RULES: who may change what, and what a saved cart becomes. The registry server (server/worker.js)
// enforces them, and it is the only place that counts; the app reads the same rules to show each person what they can
// touch. `h` is how squads are judged: h.labels(team) its slot positions, h.fit(a, b) the position cost, h.ovr(id) a
// man's rating.
import { applyDraft, draftChanges, draftWith, idOf, teamKey } from "./draft.js";
import { without } from "./squads.js";
import { STYLE_LBL } from "./styles.js";
import { FORMATIONS } from "../engine/formations.ts";

export const NATIONAL = new Set(["AVIUM", "ARTERRA"]);
const lc = (s) => String(s || "").toLowerCase();
export const isNational = (t) => NATIONAL.has(t.file);
// A team's nation: a national side is its own code, a club the nation it belongs to.
export const nationOf = (t) => (isNational(t) ? t.code : t.nation);

// Someone's standing: the overseer has every right; an editor has the nations listed against their GitHub name.
export function scopeOf(editors, login) {
  const l = lc(login);
  const overseer = (editors?.overseers || []).some(o => lc(o) === l);
  const nations = Object.entries(editors?.editors || {}).filter(([u]) => lc(u) === l).flatMap(([, n]) => n);
  return { login: String(login || ""), role: overseer ? "overseer" : nations.length ? "editor" : "viewer", nations };
}
export const owns = (scope, t) => scope.role === "overseer" || (scope.role === "editor" && scope.nations.includes(nationOf(t)));
// The people who answer for a team: its nation's editors (the overseer can answer for any).
export const ownersOf = (editors, t) => Object.entries(editors?.editors || {}).filter(([, n]) => n.includes(nationOf(t))).map(([u]) => u);

// What an editor may change on a team of their own. Ratings, nationality, badges, retiring a man, a manager's rating and
// a national side's code are the overseer's.
const EDITOR_TEAM_FIELDS = new Set(["name", "code", "home", "away", "stadium", "location", "formation", "style", "manager", "squad"]);
const PLAYER_FIELD = { ovr: "rating", nat: "nationality", badges: "badges", retired: "retirement" };
const squadIds = (t) => t.squad.map(v => idOf(v) ?? null);
const world = (t) => (t.file === "ARTERRA" ? "arterra" : "avium");

// Whether each changed value can go into the records and the sheets written from them. A sheet is tab-separated, so a
// tab or a line break in a name would break every tool that reads it. A code names one team in its world. (Badges and
// retirement need no check: the records keep only the badges the table knows, and retired is yes or no.)
const TEXT = /^[^\u0000-\u001f\u007f]*$/;
const text = (v, max, empty) => typeof v === "string" && v === v.trim() && v.length <= max && TEXT.test(v) && (empty || v.length > 0);
const rating = (v) => Number.isInteger(v) && v >= 25 && v <= 99;
const STYLE_NAMES = new Set(Object.values(STYLE_LBL));
const TEAM_VALUE = {
  name: (v) => text(v, 40), code: (v) => typeof v === "string" && /^[A-Z0-9]{2,3}$/.test(v),
  home: (v) => typeof v === "string" && /^#[0-9A-Fa-f]{6}$/.test(v), away: (v) => typeof v === "string" && /^#[0-9A-Fa-f]{6}$/.test(v),
  stadium: (v) => text(v, 60, true), location: (v) => text(v, 60, true),
  formation: (v) => FORMATIONS.includes(v), style: (v) => STYLE_NAMES.has(v),
};
const TEAM_FIELD = { name: "name", code: "code", home: "home colour", away: "away colour", stadium: "stadium", location: "city",
                     formation: "formation", style: "style", manager: "manager", squad: "squad" };
function valueProblems(rec, next, changes) {
  const out = [], mgrs = new Set(rec.managers.map(m => m.id)), nextBy = new Map(next.teams.map(t => [teamKey(t), t]));
  for (const c of changes) {
    const bad = (what) => out.push(`${c.name}: ${what}`);
    if (c.kind === "players") {
      if (c.field === "ovr" && !rating(c.to)) bad("a rating is a whole number from 25 to 99");
      if (c.field === "nat" && !(typeof c.to === "string" && /^[A-Z]{2,4}$/.test(c.to))) bad("not a nationality");
    }
    if (c.kind === "managers" && c.field === "ovr" && !rating(c.to)) bad("a rating is a whole number from 25 to 99");
    if (c.kind !== "teams") continue;
    if (TEAM_VALUE[c.field] && !TEAM_VALUE[c.field](c.to)) bad(`not a usable ${TEAM_FIELD[c.field]}`);
    if (c.field === "manager" && c.to != null && !mgrs.has(c.to)) bad("no such manager");
    if (c.field === "code" && TEAM_VALUE.code(c.to)) {
      const t = nextBy.get(c.id), clash = next.teams.find(x => x !== t && x.code === c.to && world(x) === world(t));
      if (clash) bad(`${clash.name.trim()} already has the code ${c.to}`);
    }
  }
  return out;
}

// A man who ends up on no team keeps the position he last played, for whoever signs him; a man back on a team drops it.
function withPositions(rec, d, h) {
  const before = new Map(), next = applyDraft(rec, d), on = new Set();
  for (const t of rec.teams) { const lab = h.labels(t); squadIds(t).forEach((id, i) => {
    if (id && (!before.has(id) || !isNational(t))) before.set(id, lab[i]); }); }
  for (const t of next.teams) for (const id of squadIds(t)) if (id) on.add(id);
  const byId = new Map(rec.players.map(r => [r.id, r]));
  let out = d;
  for (const [id, pos] of before) if (!on.has(id) && !byId.get(id)?.pos) out = draftWith(out, rec, id, { pos }, "players");
  for (const id of on) if (byId.get(id)?.pos) out = draftWith(out, rec, id, { pos: null }, "players");
  return out;
}

// Whether a set of changed teams still adds up: squads the same size, no man twice in one squad or at two clubs, eleven
// starters each, nobody retired.
function squadProblems(rec, next, keys) {
  const out = [], base = new Map(rec.teams.map(t => [teamKey(t), t])), retired = new Set(next.players.filter(r => r.retired).map(r => r.id));
  const known = new Set(next.players.map(r => r.id));
  const clubs = new Map();
  for (const t of next.teams) if (!isNational(t)) for (const id of squadIds(t)) if (id) clubs.set(id, [...(clubs.get(id) || []), t.name.trim()]);
  for (const t of next.teams.filter(t => keys.has(teamKey(t)))) {
    const sq = squadIds(t), was = base.get(teamKey(t)), name = t.name.trim();
    if (sq.length !== was.squad.length) out.push(`${name}: the squad must keep ${was.squad.length} places`);
    if (sq.slice(0, 11).some(v => !v)) out.push(`${name}: the starting XI has an empty place`);
    const seen = new Set();
    for (const id of sq.filter(Boolean)) {
      if (!known.has(id)) { out.push(`${name}: no such player`); continue; }
      if (seen.has(id)) out.push(`${name}: a player is listed twice`);
      seen.add(id);
      if (retired.has(id)) out.push(`${name}: a retired player is in the squad`);
      if (!isNational(t) && clubs.get(id)?.length > 1) out.push(`${name}: a player would be at two clubs (${clubs.get(id).join(", ")})`);
    }
  }
  return [...new Set(out)];
}

// WHAT A SAVED CART BECOMES. Returns { scope, errors, apply, requests, locks }: `apply` is the part that goes live now
// (a draft), `requests` the parts waiting on another owner. A man or manager coming from another owner's club makes a
// request for the receiving team: that team's changes wait with it, and both clubs are locked until it is settled. A
// cart with any error applies nothing.
export function planSave(rec, editors, pending, login, cart, h, now = new Date().toISOString(), newId = () => crypto.randomUUID().slice(0, 8)) {
  const scope = scopeOf(editors, login), over = scope.role === "overseer";
  const none = { scope, errors: [], apply: null, requests: [] };
  if (scope.role === "viewer") return { ...none, errors: ["Not an approved editor"] };
  const group = (g) => g == null || (typeof g === "object" && !Array.isArray(g) && Object.values(g).every(p => p && typeof p === "object" && !Array.isArray(p)));
  if (!cart || typeof cart !== "object" || !["players", "managers", "teams"].every(k => group(cart[k]))
      || Object.values(cart.teams || {}).some(p => "squad" in p && !Array.isArray(p.squad))) return { ...none, errors: ["Not a cart"] };
  // Positions are bookkeeping the server keeps, whatever the cart says.
  const draft = { ...cart, players: Object.fromEntries(Object.entries(cart?.players || {})
    .map(([id, p]) => [id, Object.fromEntries(Object.entries(p).filter(([f]) => f !== "pos"))]).filter(([, p]) => Object.keys(p).length)) };
  const changes = draftChanges(rec, draft);
  if (!changes.length) return none;
  const errors = [], teamBy = new Map(rec.teams.map(t => [teamKey(t), t]));
  const locked = new Set((pending || []).flatMap(r => r.locks || []));
  const clubOf = new Map(), mgrClubOf = new Map();
  for (const t of rec.teams) if (!isNational(t)) {
    for (const id of squadIds(t)) if (id) clubOf.set(id, teamKey(t));
    if (idOf(t.manager)) mgrClubOf.set(idOf(t.manager), teamKey(t));
  }
  const nextAll = applyDraft(rec, draft), nextBy = new Map(nextAll.teams.map(t => [teamKey(t), t]));
  const playerBy = new Map(rec.players.map(r => [r.id, r]));

  // Every man and manager who changes club.
  const moves = [];
  for (const c of changes.filter(c => c.kind === "teams" && c.field === "squad")) {
    const t = teamBy.get(c.id);
    for (const id of c.to.filter(x => x && !c.from.includes(x))) {
      if (isNational(t)) {
        if (!over && playerBy.get(id)?.nat !== t.code) errors.push(`${t.name.trim()}: ${playerBy.get(id)?.name || id} is not a ${t.name.trim()} national`);
        continue;                                                     // a call-up moves nobody
      }
      const from = clubOf.get(id) || null;
      if (from !== c.id) moves.push({ kind: "player", id, from, to: c.id });
    }
  }
  for (const c of changes.filter(c => c.kind === "teams" && c.field === "manager" && c.to)) {
    const t = teamBy.get(c.id), from = mgrClubOf.get(c.to);
    if (!isNational(t) && from && from !== c.id) moves.push({ kind: "manager", id: c.to, from, to: c.id });
  }

  errors.push(...valueProblems(rec, nextAll, changes));

  // What may be touched at all.
  const sellingOnly = new Set();
  for (const c of changes) {
    if (c.kind === "players" && !over) errors.push(`${c.name}: a player's ${PLAYER_FIELD[c.field] || c.field} is the overseer's to change`);
    if (c.kind === "managers" && !over) errors.push(`${c.name}: a manager's rating is the overseer's to change`);
    if (c.kind !== "teams" || over) continue;
    const t = teamBy.get(c.id);
    if (!owns(scope, t)) {
      // Another owner's club, changed only by the men leaving it for this editor's teams: that is the selling side of a
      // request, worked out again when it is accepted, never applied from the cart.
      const leaving = c.field === "squad" ? c.from.filter(x => x && !c.to.includes(x)) : null;
      const isSale = leaving && c.to.filter(x => x && !c.from.includes(x)).length === 0
        && leaving.every(id => moves.some(m => m.kind === "player" && m.id === id && m.from === c.id && owns(scope, teamBy.get(m.to))));
      // ...or left without the manager this editor's club is asking for.
      const losesManager = c.field === "manager" && c.to == null && c.from != null
        && moves.some(m => m.kind === "manager" && m.id === c.from && m.from === c.id && owns(scope, teamBy.get(m.to)));
      if (isSale || losesManager) sellingOnly.add(c.id); else errors.push(`${c.name}: not one of your teams`);
      continue;
    }
    if (locked.has(c.id)) errors.push(`${c.name}: waiting on a request`);
    if (!EDITOR_TEAM_FIELDS.has(c.field)) errors.push(`${c.name}: ${c.field} is the overseer's to change`);
    if (c.field === "code" && isNational(t)) errors.push(`${c.name}: a national side's code is the overseer's to change`);
  }

  // Each move is a free signing, a move between the editor's own clubs (the cart must take him off the old one), or a
  // request to another owner.
  const asks = [];
  for (const m of moves) {
    const who = m.kind === "player" ? playerBy.get(m.id)?.name : rec.managers.find(x => x.id === m.id)?.name;
    if (m.kind === "player" && playerBy.get(m.id)?.retired) { errors.push(`${who} has retired`); continue; }
    if (!m.from) continue;
    const from = teamBy.get(m.from), fromNext = nextBy.get(m.from);
    if (over || owns(scope, from)) {
      if (m.kind === "player" && squadIds(fromNext).includes(m.id)) errors.push(`${who} would be at two clubs: take him out of ${from.name.trim()} too`);
      if (m.kind === "manager" && idOf(fromNext.manager) === m.id) errors.push(`${who} already manages ${from.name.trim()}: change their manager too`);
      continue;
    }
    if (locked.has(m.from)) { errors.push(`${from.name.trim()}: waiting on a request`); continue; }
    asks.push(m);
  }

  // The requests: one per receiving team, holding that team's whole change and every man or manager it wants.
  const requests = [];
  for (const to of [...new Set(asks.map(m => m.to))]) {
    const t = teamBy.get(to), mine = asks.filter(m => m.to === to), patch = draft.teams?.[to] || {};
    requests.push({ id: newId(), by: scope.login, at: now, team: to, teamName: t.name.trim(),
      patch, base: Object.fromEntries(Object.keys(patch).map(f => [f, f === "squad" ? squadIds(t) : f === "manager" ? idOf(t[f]) ?? null : t[f]])),
      moves: mine.map(m => ({ kind: m.kind, id: m.id, from: m.from, fromName: teamBy.get(m.from).name.trim() })),
      needs: Object.fromEntries([...new Set(mine.map(m => m.from))].map(k => [k, ownersOf(editors, teamBy.get(k))])),
      approved: [], locks: [...new Set([to, ...mine.map(m => m.from)])] });
  }

  // What goes live now: the cart less the teams waiting on a request and the selling sides of them.
  const held = new Set([...requests.map(r => r.team), ...sellingOnly]);
  const live = { v: 1, players: draft.players || {}, ...(draft.managers ? { managers: draft.managers } : null),
                 teams: Object.fromEntries(Object.entries(draft.teams || {}).filter(([k]) => !held.has(k))) };
  const touched = new Set(Object.keys(live.teams));
  errors.push(...squadProblems(rec, applyDraft(rec, live), touched));
  if (errors.length) return { ...none, errors: [...new Set(errors)] };
  return { scope, errors: [], apply: withPositions(rec, live, h), requests };
}

// SETTLING A REQUEST. action: "accept" | "decline" | "withdraw". Returns { errors, done, apply, request }: `request` is
// the request as it now stands (null once settled), `apply` the draft to go live when the last owner accepts.
export function settleRequest(rec, editors, request, login, action, h) {
  const scope = scopeOf(editors, login), over = scope.role === "overseer";
  const teamBy = new Map(rec.teams.map(t => [teamKey(t), t]));
  const answersFor = Object.keys(request.needs).filter(k => over || owns(scope, teamBy.get(k)));
  if (action === "withdraw") {
    if (!over && lc(login) !== lc(request.by)) return { errors: ["Only the person who asked can withdraw it"] };
    return { errors: [], done: true, apply: null, request: null };
  }
  if (!answersFor.length) return { errors: ["Not yours to answer"] };
  if (action === "decline") return { errors: [], done: true, apply: null, request: null };
  const approved = [...new Set([...request.approved, ...answersFor])];
  if (Object.keys(request.needs).some(k => !approved.includes(k))) return { errors: [], done: false, apply: null, request: { ...request, approved } };
  // The last answer is in: check nothing moved underneath it, then apply the whole of it.
  const t = teamBy.get(request.team);
  if (!t) return { errors: ["The team is gone"] };
  for (const [f, was] of Object.entries(request.base)) {
    const now = f === "squad" ? squadIds(t) : f === "manager" ? idOf(t[f]) ?? null : t[f];
    if (JSON.stringify(now) !== JSON.stringify(was)) return { errors: [`${t.name.trim()} has changed since the request: ask again`] };
  }
  let d = draftWith(null, rec, request.team, request.patch, "teams");
  for (const m of request.moves) {
    const from = teamBy.get(m.from), cur = applyDraft(rec, d).teams.find(x => teamKey(x) === m.from);
    if (m.kind === "player") {
      if (!squadIds(from).includes(m.id)) return { errors: [`${m.fromName} no longer has that player`] };
      d = draftWith(d, rec, m.from, { squad: without(squadIds(cur), m.id, h.labels(cur), h.fit, h.ovr) }, "teams");
    } else {
      if (idOf(from.manager) !== m.id) return { errors: [`${m.fromName} no longer has that manager`] };
      d = draftWith(d, rec, m.from, { manager: null }, "teams");
    }
  }
  const problems = squadProblems(rec, applyDraft(rec, d), new Set([request.team, ...request.moves.map(m => m.from)]));
  if (problems.length) return { errors: problems };
  return { errors: [], done: true, apply: withPositions(rec, d, h), request: null };
}
