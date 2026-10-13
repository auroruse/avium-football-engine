// THE COLLEGE DRAFT (DESIGN.md, The ANCC, The draft; Moukden and Kirin, 13 October 2026). One round after the NL season,
// each pick a number and the club holding it: made by hand where an editor answers for the club, and at once, by the
// season's match ratings, everywhere else and wherever the two hours a pick run out. The registry server (server/worker.js)
// makes the picks and the app (src/App.tsx) shows the board, both judging a pick here.
//
// A draft, as src/data/drafts.json keeps them: { id, league (its ID), year (the season it ends, which is the draft its
// final-year men enter), window (seconds a pick), status ("waiting", "running", "paused" or "done"), stats (the season's
// player-stats file, for the automatic picks), started, ended, clock ({ n, until } running, { n, left } paused, else
// null), picks: [{ n, club, player, from, at, by, auto, out }] }. A pick's club is a team ID, null before the draft starts
// for one the tables will give; the rest is there once it is made (`from` the college he came from, `by` who picked him,
// "auto" or "clock" for the automatic picks, `out` the man who made way for him, if anyone did).
import { idOf, teamKey } from "./draft.js";
import { arrangeBench, placeFor, without } from "./squads.js";
import { fitsPlace, posList } from "./positions.js";

export const DRAFT_FILE = "src/data/drafts.json";
const NATIONAL = new Set(["AVIUM", "ARTERRA"]);
const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

// The file's text: a draft's own fields on one line, a pick a line.
export function dumpDrafts(list) {
  return "[\n" + (list || []).map(d => { const { picks, ...rest } = d;
    return JSON.stringify(rest).slice(0, -1) + ',"picks":[\n' + (picks || []).map(p => JSON.stringify(p)).join(",\n") + "\n]}"; }).join(",\n") + "\n]\n";
}
// The draft being run, or the newest.
export const currentDraft = (list) => (list || []).find(d => d.status !== "done") || (list || [])[(list || []).length - 1] || null;
// The pick due: the first not yet made, or null once all are.
export const pickDue = (d) => (d?.picks || []).find(p => !p.player) || null;

// The men a draft can take: every final-year man (his course ends the draft's year) at a club of its league, not taken
// already, each with his college's key.
export function draftPool(rec, d) {
  const lg = (rec.leagues || []).find(l => l.id === d.league), P = new Map(rec.players.map(p => [p.id, p]));
  const taken = new Set((d.picks || []).map(p => p.player).filter(Boolean)), out = new Map();
  if (!lg) return out;
  for (const t of rec.teams) {
    if (t.group !== lg.name || NATIONAL.has(t.file) || t.removed) continue;
    for (const v of t.squad || []) { const id = idOf(v), p = id ? P.get(id) : null;
      if (p && p.grad === d.year && !p.retired && !taken.has(id)) out.set(id, teamKey(t)); }
  }
  return out;
}

// The season's player-stats file's average-rating board, in the file's own order (the men with a sixth of the most
// minutes first, best first, then the rest): [{ name, team, rtg }].
export function ratingBoard(tsv) {
  const rows = String(tsv || "").replace(/\r\n/g, "\n").split("\n").filter(r => r.trim()).map(r => r.split("\t")), head = rows[0] || [];
  for (let i = 0; i < head.length; i++) {
    if (head[i] !== "PLAYER") continue;
    let j = i + 1; const col = {};
    for (; j < head.length && ["POS", "TEAM", "GP", "ST", "MIN"].includes(head[j]); j++) col[head[j]] = j;
    if (head[j] !== "RTG") continue;
    return rows.slice(1).filter(r => (r[i] || "").trim()).map(r => ({ name: r[i].trim(), team: (r[col.TEAM] || "").trim(), rtg: +r[j] || 0 }));
  }
  return [];
}
// Who the automatic pick takes, best first: the board's men still in the pool, in its order, then the pool's men it does
// not have, the higher rated first. A man is found by his name and his college's code.
export function autoOrder(rec, pool, board) {
  const P = new Map(rec.players.map(p => [p.id, p])), code = new Map(rec.teams.map(t => [teamKey(t), t.code]));
  const at = new Map(), out = [], seen = new Set();
  for (const [id, k] of pool) at.set(fold(P.get(id)?.name) + "|" + code.get(k), id);
  for (const r of board || []) { const id = at.get(fold(r.name) + "|" + r.team); if (id && !seen.has(id)) { seen.add(id); out.push(id); } }
  const rest = [...pool.keys()].filter(id => !seen.has(id)).sort((a, b) => (P.get(b)?.ovr ?? 0) - (P.get(a)?.ovr ?? 0) || a.localeCompare(b));
  return [...out, ...rest];
}

// Who makes way for a man joining a full squad when nobody is named: the lowest-rated man on the bench who plays his
// position, else the lowest-rated man on the bench.
export function makesWay(rec, squad, man) {
  const P = new Map(rec.players.map(p => [p.id, p])), want = posList(P.get(man)?.pos)[0];
  const bench = (squad || []).slice(11).map(v => idOf(v)).filter(Boolean), ovr = (id) => P.get(id)?.ovr ?? 0;
  const low = (ids) => [...ids].sort((a, b) => ovr(a) - ovr(b) || a.localeCompare(b))[0] || null;
  return low(bench.filter(id => posList(P.get(id)?.pos).includes(want))) || low(bench);
}

// The squads a run of picks changes, as IDs, and the patch over the records they come to (src/data/draft.js).
function squadsOf(rec) {
  const T = new Map(rec.teams.map(t => [teamKey(t), t])), S = new Map();
  return { team: (k) => T.get(k) || null, get: (k) => S.get(k) || (T.get(k)?.squad || []).map(v => idOf(v) ?? null), set: (k, sq) => S.set(k, sq),
           patch: () => (S.size ? { v: 1, players: {}, teams: Object.fromEntries([...S].map(([k, sq]) => [k, { squad: sq }])) } : null) };
}
const tidy = (sq, lab, h) => (h.pos ? arrangeBench(sq, lab, (id) => h.pos(id), fitsPlace) : sq);
// A man taken out of a squad, its bench filling in behind a starter.
function leave(S, k, id, h) {
  const t = S.team(k), lab = h.labels(t);
  S.set(k, tidy(without(S.get(k), id, lab, h.fit, h.ovr, h.pos), lab, h));
}

// A PICK MADE: the man out of his college and into his new club's best open place, or, the squad full, into the room the
// man named to make way leaves (an automatic pick names the one makesWay gives), who goes free. `h` judges squads as the
// rules do (labels, fit, ovr, pos). Returns errors, or nothing and the pick and squads changed.
function makePick(rec, S, pool, d, p, man, out, h, auto) {
  const college = pool.get(man), name = (id) => rec.players.find(x => x.id === id)?.name || id;
  if (!college) return [`${name(man)} cannot be drafted`];
  const k = p.club, t = S.team(k);
  if (!t) return [`Pick ${p.n} belongs to no club`];
  let sq = S.get(k);
  const lab = h.labels(t), pos = h.pos(man);
  if (out != null) {
    if (!sq.includes(out)) return [`${name(out)} is not at ${t.name.trim()}`];
    if (placeFor(sq, lab, h.fit, pos.length ? pos : "CM") >= 0) return [`${t.name.trim()} has an open place: nobody needs to make way`];
  } else if (placeFor(sq, lab, h.fit, pos.length ? pos : "CM") < 0) {
    if (!auto) return [`${t.name.trim()} has no open place: name who makes way`];
    out = makesWay(rec, sq, man);
    if (!out) return [`${t.name.trim()} has no open place and nobody on the bench`];
  }
  leave(S, college, man, h);
  if (out != null) sq = without(sq, out, lab, h.fit, h.ovr, h.pos);
  const i = placeFor(sq, lab, h.fit, pos.length ? pos : "CM");
  if (i < 0) return [`${t.name.trim()} has no open place`];
  sq = [...sq]; sq[i] = man;
  S.set(k, tidy(sq, lab, h));
  pool.delete(man);
  Object.assign(p, { player: man, from: college, out: out ?? null });
  return [];
}

// A DRAFT RUN ON to the next pick a person has to make: every pick due made at once where its club is not picked by hand
// (`hand(teamKey)`) or its two hours are up, the clock started on the next, and after the last, the final-year men nobody
// took sent to free agency. A person's pick, if given ({ n, player, out, by }), is made first. `board` is the season's
// rating board (ratingBoard). Returns { errors } or { draft, patch (the squads changed, or null), made (the picks made) }.
export function runDraft(rec, d0, { now = new Date(), hand = () => false, board = [], h, pick = null }) {
  const d = JSON.parse(JSON.stringify(d0)), S = squadsOf(rec), pool = draftPool(rec, d), made = [];
  if (d.status !== "running") return pick ? { errors: [d.status === "paused" ? "The draft is paused" : d.status === "done" ? "The draft is over" : "The draft has not started"] } : { draft: d, patch: null, made };
  const iso = now.toISOString(), win = (d.window || 7200) * 1000;
  if (pick) {
    const p = pickDue(d);
    if (!p || p.n !== pick.n) return { errors: [`Pick ${pick.n} is not on the clock`] };
    const errors = makePick(rec, S, pool, d, p, pick.player, pick.out ?? null, h, false);
    if (errors.length) return { errors };
    Object.assign(p, { at: iso, by: pick.by || "", auto: false });
    made.push(p.n); d.clock = null;
  }
  for (let p = pickDue(d); p; p = pickDue(d)) {
    const late = d.clock && d.clock.n === p.n && d.clock.until && Date.parse(d.clock.until) <= now.getTime();
    if (hand(p.club) && !late) {
      if (!d.clock || d.clock.n !== p.n) d.clock = { n: p.n, until: new Date(now.getTime() + win).toISOString() };
      break;
    }
    const man = autoOrder(rec, pool, board).find(id => pool.has(id));
    if (!man) break;
    const errors = makePick(rec, S, pool, d, p, man, null, h, true);
    if (errors.length) return { errors };
    Object.assign(p, { at: iso, by: late ? "clock" : "auto", auto: true });
    made.push(p.n); d.clock = null;
  }
  if (!pickDue(d)) {
    // Every final-year man left goes free.
    for (const [id, k] of [...pool]) { leave(S, k, id, h); pool.delete(id); }
    Object.assign(d, { status: "done", ended: iso, clock: null });
  }
  return { draft: d, patch: S.patch(), made };
}

// STARTING: each pick the tables give (its club null) to the club `order` names at its number (NL2's last first, NL1's
// champion last), the season's figures named for the automatic picks. Errors, or the draft running, ready for runDraft.
export function startDraft(rec, d0, order, stats, now = new Date()) {
  if (d0.status !== "waiting") return { errors: ["The draft has already started"] };
  const d = JSON.parse(JSON.stringify(d0)), ids = new Set(rec.teams.filter(t => !NATIONAL.has(t.file) && !t.removed).map(teamKey)), seen = new Set();
  for (const p of d.picks) {
    if (p.club == null) p.club = (order || [])[p.n - 1] ?? null;
    if (!p.club || !ids.has(p.club)) return { errors: [`Pick ${p.n} has no club`] };
  }
  for (const p of d0.picks) if (p.club == null) { if (seen.has(d.picks[p.n - 1].club)) return { errors: ["A club has two picks from the tables"] }; seen.add(d.picks[p.n - 1].club); }
  if (stats != null && !/^public\/avium\/pstats\/[\w-]+\/[\w-]+\.tsv$/.test(stats)) return { errors: ["Not a season's player stats"] };
  return { draft: { ...d, status: "running", stats: stats || null, started: now.toISOString(), clock: null } };
}

// The overseer's hand on a draft: pause it (the clock keeps what it had left), resume it, or give a pick still to come to
// another club (`club` a team ID; null hands it back to the tables while the draft waits).
export function steerDraft(rec, d0, action, { n, club, now = new Date() } = {}) {
  const d = JSON.parse(JSON.stringify(d0));
  if (action === "pause") {
    if (d.status !== "running") return { errors: ["The draft is not running"] };
    d.status = "paused";
    if (d.clock?.until) d.clock = { n: d.clock.n, left: Math.max(0, Date.parse(d.clock.until) - now.getTime()) };
    return { draft: d };
  }
  if (action === "resume") {
    if (d.status !== "paused") return { errors: ["The draft is not paused"] };
    d.status = "running";
    if (d.clock?.left != null) d.clock = { n: d.clock.n, until: new Date(now.getTime() + d.clock.left).toISOString() };
    return { draft: d };
  }
  if (action === "give") {
    const p = d.picks.find(x => x.n === n);
    if (!p) return { errors: ["No such pick"] };
    if (p.player) return { errors: [`Pick ${n} has been made`] };
    if (club == null && d.status !== "waiting") return { errors: ["A pick goes back to the tables only before the draft starts"] };
    if (club != null && !rec.teams.some(t => teamKey(t) === club && !NATIONAL.has(t.file) && !t.removed)) return { errors: ["No such club"] };
    p.club = club ?? null;
    if (d.clock?.n === n) d.clock = null;                                   // a new holder starts a fresh two hours
    return { draft: d };
  }
  return { errors: ["Unknown action"] };
}
