// THE REGISTRY'S RULES: who may change what, and what a saved cart becomes. The registry server (server/worker.js)
// enforces them, and it is the only place that counts; the app reads the same rules to show each person what they can
// touch. `h` is how squads are judged: h.labels(team) its slot positions, h.fit(a, b) the position cost, h.ovr(id) a
// man's rating.
//
// The overseer changes everything. An editor changes their own nation's sides (its national side and its clubs): names
// and kits outright; codes, grounds and cities by request to the overseer; formations, slots, and who plays for and
// manages them, by moving men. A man from another nation's club comes by a trade, which that nation answers (the
// overseer where it has no editor). New players, managers, clubs and leagues are requests the overseer answers, editing
// them first if he likes; a new man's rating may wait for him. A player's or manager's own record (rating, age,
// nationality, traits) is never an editor's. A league's name, tier and cup are its nation's editors' to change outright.
import { applyDraft, draftChanges, draftWith, idOf, teamKey } from "./draft.js";
import { placeFor, without } from "./squads.js";
import { STYLE_LBL } from "./styles.js";
import { POS_ROLE } from "./positions.js";
import { FORMATIONS } from "../engine/formations.ts";
import { birthDateOk } from "./icclock.js";
import { leagueNameFree, leagueRecord } from "./leagues.js";
import { badgeOrder } from "./badges.js";

export const NATIONAL = new Set(["AVIUM", "ARTERRA"]);
const lc = (s) => String(s || "").toLowerCase();
export const isNational = (t) => NATIONAL.has(t.file);
// A team's nation: a national side is its own code, a club the nation it belongs to.
export const nationOf = (t) => (isNational(t) ? t.code : t.nation);
// What stands in a request's needs for the overseer, when only he answers it: a new record, a change of code, ground or
// city.
export const OVERSEER = "@overseer";

// Someone's standing: the overseer has every right; an editor has the nations listed against their GitHub name.
export function scopeOf(editors, login) {
  const l = lc(login);
  const overseer = (editors?.overseers || []).some(o => lc(o) === l);
  const nations = Object.entries(editors?.editors || {}).filter(([u]) => lc(u) === l).flatMap(([, n]) => n);
  return { login: String(login || ""), role: overseer ? "overseer" : nations.length ? "editor" : "viewer", nations };
}
export const owns = (scope, t) => scope.role === "overseer" || (!!t && scope.role === "editor" && scope.nations.includes(nationOf(t)));
// The people who answer for a team: its nation's editors (the overseer can answer for any).
export const ownersOf = (editors, t) => Object.entries(editors?.editors || {}).filter(([, n]) => n.includes(nationOf(t))).map(([u]) => u);

// What an editor may change on a team of their own outright, and what goes to the overseer as a request.
const EDITOR_TEAM_FIELDS = new Set(["name", "home", "away", "formation", "style", "manager", "squad"]);
const BY_REQUEST = new Set(["code", "stadium", "location"]);
const squadIds = (t) => t.squad.map(v => idOf(v) ?? null);
const world = (t) => (t.file === "ARTERRA" ? "arterra" : "avium");

// Whether each changed value can go into the records and the sheets written from them. A sheet is tab-separated, so a
// tab or a line break in a name would break every tool that reads it. A code names one team in its world. (Badges and
// retirement need no check: the records keep only the badges the table knows, and retired is yes or no.)
const TEXT = /^[^\u0000-\u001f\u007f]*$/;
const text = (v, max, empty) => typeof v === "string" && v === v.trim() && v.length <= max && TEXT.test(v) && (empty || v.length > 0);
const rating = (v) => Number.isInteger(v) && v >= 25 && v <= 99;
const nationCode = (v) => typeof v === "string" && /^[A-Z]{2,4}$/.test(v);
const STYLE_NAMES = new Set(Object.values(STYLE_LBL));
const styleName = (v) => STYLE_LBL[v] || (STYLE_NAMES.has(v) ? v : null);
const TEAM_VALUE = {
  name: (v) => text(v, 40), code: (v) => typeof v === "string" && /^[A-Z0-9]{2,3}$/.test(v),
  home: (v) => typeof v === "string" && /^#[0-9A-Fa-f]{6}$/.test(v), away: (v) => typeof v === "string" && /^#[0-9A-Fa-f]{6}$/.test(v),
  stadium: (v) => text(v, 60, true), location: (v) => text(v, 60, true),
  formation: (v) => FORMATIONS.includes(v), style: (v) => STYLE_NAMES.has(v),
};
const TEAM_FIELD = { name: "name", code: "code", home: "home colour", away: "away colour", stadium: "stadium", location: "city",
                     formation: "formation", style: "style", manager: "manager", squad: "squad" };
const codeClash = (teams, code, t) => teams.find(x => x !== t && x.code === code && world(x) === world(t));
const tierOk = (v) => Number.isInteger(v) && v >= 0 && v <= 5;
const cupOk = (v, leagues) => text(v, 50) && !(leagues || []).some(l => l.name.toLowerCase() === v.toLowerCase());
const isNew = (v) => !!v && typeof v === "object" && !Array.isArray(v);
function valueProblems(rec, next, changes) {
  const out = [], mgrs = new Set(next.managers.map(m => m.id)), nextBy = new Map(next.teams.map(t => [teamKey(t), t]));
  for (const c of changes) {
    const bad = (what) => out.push(`${c.name}: ${what}`);
    if (c.kind === "players" || c.kind === "managers") {
      if (c.field === "name" && !text(c.to, 60)) bad("not a usable name");
      if (c.field === "ovr" && !rating(c.to)) bad("a rating is a whole number from 25 to 99");
      if (c.field === "nat" && !nationCode(c.to)) bad("not a nationality");
      if (c.field === "born" && c.to != null && !birthDateOk(c.to)) bad("a date of birth is a real date, for a man at least 14");
      if (c.field === "style" && c.to != null && !STYLE_NAMES.has(c.to)) bad("not a style");
    }
    if (c.kind === "leagues") {
      if (c.field === "name") { if (!text(c.to, 50)) bad("not a usable name"); else if (!leagueNameFree(next.leagues, c.to, c.id)) bad(`a league is already called ${c.to}`); }
      if (c.field === "tier" && !tierOk(c.to)) bad("a tier is 1 to 5, or none");
      if (c.field === "cup" && c.to != null && !cupOk(c.to, next.leagues)) bad("not a usable cup");
      continue;
    }
    if (c.kind !== "teams") continue;
    if (TEAM_VALUE[c.field] && !TEAM_VALUE[c.field](c.to)) bad(`not a usable ${TEAM_FIELD[c.field]}`);
    if (c.field === "manager" && c.to != null && !mgrs.has(c.to)) bad("no such manager");
    if (c.field === "code" && TEAM_VALUE.code(c.to)) {
      const clash = codeClash(next.teams, c.to, nextBy.get(c.id));
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
    if (sq.length !== (was ? was.squad.length : isNational(t) ? 22 : 16)) out.push(`${name}: the squad must keep ${was ? was.squad.length : 16} places`);
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

// Who stands where: each player's club and each manager's club, in these records.
function placesOf(rec) {
  const clubOf = new Map(), mgrClubOf = new Map();
  for (const t of rec.teams) if (!isNational(t)) {
    for (const id of squadIds(t)) if (id) clubOf.set(id, teamKey(t));
    if (idOf(t.manager)) mgrClubOf.set(idOf(t.manager), teamKey(t));
  }
  return { clubOf, mgrClubOf };
}

// A TRADE, worked out on whatever the records are now: the men going out leave the side (its bench filling in behind
// them), the men coming in take the places that opens, the best fit first, and the other way round for the other side.
// A manager coming in takes the side's dugout and brings his style; his old side is left without one.
function tradeDraft(rec, d, tr, h) {
  const errors = [], now = () => applyDraft(rec, d), cur = (k) => now().teams.find(t => teamKey(t) === k);
  const A = cur(tr.side), B = cur(tr.other), name = (id) => rec.players.find(p => p.id === id)?.name || id;
  if (!A || !B) return { errors: ["A side in the trade is gone"] };
  const ins = (tr.ins || []).filter(m => m.kind === "player").map(m => m.id), outs = (tr.outs || []).filter(m => m.kind === "player").map(m => m.id);
  const mgrs = (tr.ins || []).filter(m => m.kind === "manager").map(m => m.id);
  let sa = squadIds(A), sb = squadIds(B);
  for (const id of ins) if (!sb.includes(id)) errors.push(`${B.name.trim()} no longer has ${name(id)}`);
  for (const id of outs) if (!sa.includes(id)) errors.push(`${A.name.trim()} no longer has ${name(id)}`);
  for (const id of mgrs) if (idOf(B.manager) !== id) errors.push(`${B.name.trim()} no longer has that manager`);
  if (errors.length) return { errors };
  const la = h.labels(A), lb = h.labels(B), posAt = (sq, lab, id) => lab[sq.indexOf(id)] || "CM";
  const posIn = new Map(ins.map(id => [id, posAt(sb, lb, id)])), posOut = new Map(outs.map(id => [id, posAt(sa, la, id)]));
  for (const id of outs) sa = without(sa, id, la, h.fit, h.ovr);
  for (const id of ins) sb = without(sb, id, lb, h.fit, h.ovr);
  for (const id of ins) { const i = placeFor(sa, la, h.fit, posIn.get(id)); if (i < 0) errors.push(`${A.name.trim()} has no free place for ${name(id)}`); else sa[i] = id; }
  for (const id of outs) { const i = placeFor(sb, lb, h.fit, posOut.get(id)); if (i < 0) errors.push(`${B.name.trim()} has no free place for ${name(id)}`); else sb[i] = id; }
  if (errors.length) return { errors };
  if (ins.length || outs.length) {
    d = draftWith(d, rec, tr.side, { squad: sa }, "teams");
    d = draftWith(d, rec, tr.other, { squad: sb }, "teams");
  }
  for (const id of mgrs) {
    d = draftWith(d, rec, tr.side, { manager: id, style: B.style }, "teams");
    d = draftWith(d, rec, tr.other, { manager: null }, "teams");
  }
  return { errors: [], d };
}

// A NEW RECORD asked for, checked: { what: "players" | "managers" | "teams", ...its fields }. An editor's must be of
// their own nations, a player joining one of their own sides; the overseer's may be anything.
const POSITION = new Set(Object.keys(POS_ROLE));
function newProblems(rec, n, scope, over, h) {
  const out = [], label = n?.name || "A new record", bad = (what) => out.push(`${label}: ${what}`);
  if (!n || !["players", "managers", "teams", "leagues"].includes(n.what)) return ["Not a new record"];
  if (n.what === "leagues") return leagueProblems(rec, n, scope, over);
  if (!text(n.name, n.what === "teams" ? 40 : 60)) bad("not a usable name");
  const mine = (code) => over || scope.nations.includes(code);
  if (n.what !== "teams") {
    if (!nationCode(n.nat)) bad("not a nationality"); else if (!mine(n.nat)) bad("not a nationality of yours");
    if (!(n.born && birthDateOk(n.born))) bad("a date of birth is a real date, for a man at least 14");
    // An editor may leave the rating for the overseer, who sets it to let the man in.
    if (over ? !rating(n.ovr) : n.ovr != null && !rating(n.ovr)) bad("a rating is a whole number from 25 to 99");
  }
  if (n.what === "players") {
    if (!POSITION.has(n.pos)) bad("not a position");
    if (n.side) { const t = rec.teams.find(x => teamKey(x) === n.side);
      if (!t) bad("no such side"); else if (!owns(scope, t)) bad(`${t.name.trim()} is not one of your sides`);
      else if (isNational(t) && t.code !== n.nat) bad(`not a ${t.name.trim()} national`);
      else if (placeFor(squadIds(t), h.labels(t), h.fit, n.pos) < 0) bad(`${t.name.trim()} has no free place`); }
  }
  if (n.what === "managers" && !styleName(n.style)) bad("not a style");
  if (n.what === "teams") {
    const nation = n.nation, clubs = rec.teams.filter(t => !isNational(t) && t.nation === nation);
    if (!clubs.length) bad("a new club belongs to a nation with a league"); else if (!mine(nation)) bad("not a nation of yours");
    if (!TEAM_VALUE.code(n.code)) bad("not a usable code");
    else if (rec.teams.some(t => t.code === n.code && world(t) === (clubs[0]?.file === "ARTERRA" ? "arterra" : "avium"))) bad(`the code ${n.code} is taken`);
    for (const f of ["home", "away", "stadium", "location", "formation"]) if (!TEAM_VALUE[f](n[f])) bad(`not a usable ${TEAM_FIELD[f]}`);
    if (!clubs.some(t => t.group === n.group)) bad("not one of the nation's leagues");
    const { clubOf, mgrClubOf } = placesOf(rec), sq = Array.isArray(n.squad) ? n.squad : [];
    if (sq.length !== 16 || sq.slice(0, 11).some(v => !v)) bad("a new club needs sixteen places, eleven of them filled");
    const seen = new Set();
    for (const id of sq.filter(Boolean)) {
      const p = rec.players.find(x => x.id === id), at = clubOf.get(id);
      if (!p || p.retired) { bad("a man in the squad is not available"); continue; }
      if (seen.has(id)) bad("a player is listed twice"); seen.add(id);
      if (at && !owns(scope, rec.teams.find(t => teamKey(t) === at))) bad(`${p.name} is at another nation's club`);
    }
    if (n.manager) { const m = rec.managers.find(x => x.id === n.manager), at = mgrClubOf.get(n.manager);
      if (!m) bad("no such manager"); else if (at && !owns(scope, rec.teams.find(t => teamKey(t) === at))) bad(`${m.name} manages another nation's club`); }
  }
  return out;
}
// A NEW LEAGUE asked for: { what: "leagues", name, nation, tier, cup, clubs: [{ name, code, home, away, stadium, location,
// formation, manager, squad }] }. A club's manager is a manager's ID, a new manager ({ name, nat, born, style, ovr }) or
// none; each of its sixteen places is empty, a player's ID or a new player ({ name, pos, nat, born, ovr, badges }). An
// editor's is of their own nation, its men of their own sides or free, its new men their own nationals; a new man's
// rating may wait for the overseer, who sets every one before he lets the league in.
function leagueProblems(rec, n, scope, over) {
  const out = [], bad = (who, what) => out.push(`${who}: ${what}`), L = n.name || "A new league";
  if (!text(n.name, 50)) bad(L, "not a usable name"); else if (!leagueNameFree(rec.leagues, n.name)) bad(L, `a league is already called ${n.name}`);
  if (!rec.teams.some(t => t.file === "AVIUM" && t.code === n.nation)) bad(L, "not a nation of Avium");
  else if (!over && !scope.nations.includes(n.nation)) bad(L, "not a nation of yours");
  if (!tierOk(n.tier)) bad(L, "a tier is 1 to 5, or none");
  if (n.cup != null && !cupOk(n.cup, rec.leagues)) bad(L, "not a usable cup");
  const clubs = Array.isArray(n.clubs) ? n.clubs : [];
  if (!clubs.length || clubs.length > 40) bad(L, "a league starts with one to forty clubs");
  const { clubOf, mgrClubOf } = placesOf(rec), codes = new Set(), men = new Set(), mgrs = new Set();
  const ownedAt = (at) => !at || owns(scope, rec.teams.find(t => teamKey(t) === at));
  const newMan = (m, kind, C) => {
    const w = m.name || (kind === "players" ? "A new player" : "A new manager");
    if (!text(m.name, 60)) bad(C, `${w}: not a usable name`);
    if (!nationCode(m.nat)) bad(C, `${w}: not a nationality`); else if (!over && !scope.nations.includes(m.nat)) bad(C, `${w}: not a nationality of yours`);
    if (!(m.born && birthDateOk(m.born))) bad(C, `${w}: a date of birth is a real date, for a man at least 14`);
    if (over ? !rating(m.ovr) : m.ovr != null && !rating(m.ovr)) bad(C, `${w}: a rating is a whole number from 25 to 99`);
    if (kind === "players" && !POSITION.has(m.pos)) bad(C, `${w}: not a position`);
    if (kind === "players" && m.badges?.length && !over) bad(C, `${w}: traits are the overseer's`);
    if (kind === "managers" && !styleName(m.style)) bad(C, `${w}: not a style`);
  };
  for (const c of clubs) {
    if (!isNew(c)) { bad(L, "not a club"); continue; }
    const C = c.name || "A founding club";
    if (!TEAM_VALUE.name(c.name)) bad(C, "not a usable name");
    if (!TEAM_VALUE.code(c.code)) bad(C, "not a usable code");
    else if (codes.has(c.code) || rec.teams.some(t => t.code === c.code && world(t) === "avium")) bad(C, `the code ${c.code} is taken`);
    codes.add(c.code);
    for (const f of ["home", "away", "stadium", "location", "formation"]) if (!TEAM_VALUE[f](c[f])) bad(C, `not a usable ${TEAM_FIELD[f]}`);
    if (!c.stadium) bad(C, "a club needs a ground");
    if (!c.location) bad(C, "a club needs a city");
    const sq = Array.isArray(c.squad) ? c.squad : [];
    if (sq.length !== 16 || sq.slice(0, 11).some(v => !v)) bad(C, "a club needs sixteen places, eleven of them filled");
    for (const v of sq) {
      if (!v) continue;
      if (isNew(v)) { newMan(v, "players", C); continue; }
      const p = typeof v === "string" ? rec.players.find(x => x.id === v) : null;
      if (!p || p.retired) { bad(C, "a man in the squad is not available"); continue; }
      if (men.has(v)) bad(C, `${p.name} is in two of its squads`); men.add(v);
      if (!ownedAt(clubOf.get(v))) bad(C, `${p.name} is at another nation's club`);
    }
    if (isNew(c.manager)) newMan(c.manager, "managers", C);
    else if (c.manager != null) {
      const m = rec.managers.find(x => x.id === c.manager);
      if (!m) bad(C, "no such manager");
      else {
        if (mgrs.has(c.manager)) bad(C, `${m.name} manages two of its clubs`); mgrs.add(c.manager);
        if (!ownedAt(mgrClubOf.get(c.manager))) bad(C, `${m.name} manages another nation's club`);
      }
    }
  }
  return out;
}
// The next free ID of a kind (p0001, m0001, t0001, l0001), counting the records and any added in this draft.
const nextId = (rows, letter) => { const top = rows.reduce((m, r) => Math.max(m, Number(String(r.id).slice(1)) || 0), 0);
  return letter + String(top + 1).padStart(4, "0"); };
// A NEW RECORD put into the records: the player (on his side, or a free agent keeping his position), the manager, or
// the club, its men leaving their old clubs (benches filling in) and its manager his.
function createDraft(rec, d, n, h) {
  const next = applyDraft(rec, d), add = { players: [...(d?.add?.players || [])], managers: [...(d?.add?.managers || [])], teams: [...(d?.add?.teams || [])],
    ...(d?.add?.leagues?.length || n.what === "leagues" ? { leagues: [...(d?.add?.leagues || [])] } : null) };
  let out = { v: 1, players: {}, ...(d || {}) };
  if (n.what === "players") {
    const id = nextId(next.players, "p"), side = n.side ? next.teams.find(t => teamKey(t) === n.side) : null;
    add.players.push({ id, name: n.name, nat: n.nat, ovr: n.ovr, born: n.born, ...(side ? null : { pos: n.pos }), ...(n.badges?.length ? { badges: n.badges } : null) });
    out = { ...out, add };
    if (side) { const sq = squadIds(side), i = placeFor(sq, h.labels(side), h.fit, n.pos);
      if (i < 0) return { errors: [`${side.name.trim()} has no free place for ${n.name}`] };
      sq[i] = id; out = draftWith(out, rec, n.side, { squad: sq }, "teams"); }
    return { errors: [], d: out, id };
  }
  if (n.what === "managers") {
    const id = nextId(next.managers, "m");
    add.managers.push({ id, name: n.name, nat: n.nat, ovr: n.ovr, born: n.born, style: styleName(n.style) });
    return { errors: [], d: { ...out, add }, id };
  }
  if (n.what === "leagues") {
    // The league, then each club with its new men, then the men and managers it takes leaving their old clubs.
    add.leagues.push(leagueRecord({ id: nextId([...(next.leagues || []), ...add.leagues], "l"), name: n.name, nation: n.nation, tier: n.tier,
      cup: n.cup || null, listed: true }));
    const { clubOf, mgrClubOf } = placesOf(next), everyone = () => [...next.players, ...add.players];
    for (const c of n.clubs) {
      const squad = c.squad.map(v => {
        if (!isNew(v)) return v || null;
        const id = nextId(everyone(), "p");
        add.players.push({ id, name: v.name, nat: v.nat, ovr: v.ovr, born: v.born, ...(v.badges?.length ? { badges: badgeOrder(v.badges) } : null) });
        return id;
      });
      let manager = null, style = "Balanced";
      if (isNew(c.manager)) {
        manager = nextId([...next.managers, ...add.managers], "m"); style = styleName(c.manager.style) || "Balanced";
        add.managers.push({ id: manager, name: c.manager.name, nat: c.manager.nat, ovr: c.manager.ovr, born: c.manager.born, style });
      } else if (c.manager) {
        manager = c.manager;
        const side = next.teams.find(t => teamKey(t) === mgrClubOf.get(manager)), m = next.managers.find(x => x.id === manager);
        style = side?.style || styleName(m?.style) || "Balanced";
      }
      const ratings = squad.filter(Boolean).map(pid => everyone().find(p => p.id === pid)?.ovr || 0);
      add.teams.push({ id: nextId([...next.teams, ...add.teams], "t"), file: n.nation, nation: n.nation, at: "", code: c.code, name: c.name,
        ovr: (ratings.reduce((a, b) => a + b, 0) / Math.max(1, ratings.length)).toFixed(1), style, formation: c.formation, timeWasting: "Never",
        gkPassing: "Short", dlBehavior: "No Instruction", manager, squad, home: c.home, away: c.away, location: c.location, stadium: c.stadium, group: n.name });
    }
    out = { ...out, add };
    for (const c of n.clubs) {
      for (const pid of c.squad.filter(v => typeof v === "string")) {
        const at = clubOf.get(pid); if (!at) continue;
        const t = applyDraft(rec, out).teams.find(x => teamKey(x) === at);
        out = draftWith(out, rec, at, { squad: without(squadIds(t), pid, h.labels(t), h.fit, h.ovr) }, "teams");
      }
      if (typeof c.manager === "string" && mgrClubOf.get(c.manager)) out = draftWith(out, rec, mgrClubOf.get(c.manager), { manager: null }, "teams");
    }
    return { errors: [], d: out };
  }
  // A new club goes on the sheet its league's clubs are on.
  const clubs = next.teams.filter(t => !isNational(t) && t.nation === n.nation), file = (clubs.find(t => t.group === n.group) || clubs[0]).file;
  const id = nextId(next.teams, "t");
  const { clubOf, mgrClubOf } = placesOf(next), mgrSide = n.manager ? next.teams.find(t => teamKey(t) === mgrClubOf.get(n.manager)) : null;
  const mgrRec = n.manager ? next.managers.find(m => m.id === n.manager) : null;
  const style = mgrSide?.style || styleName(mgrRec?.style) || "Balanced";
  const ovrs = n.squad.filter(Boolean).map(pid => next.players.find(p => p.id === pid)?.ovr || 0);
  const team = { id, file, nation: n.nation, at: "", code: n.code, name: n.name, ovr: (ovrs.reduce((a, b) => a + b, 0) / Math.max(1, ovrs.length)).toFixed(1),
                 style, formation: n.formation, timeWasting: "Never", gkPassing: "Short", dlBehavior: "No Instruction", manager: n.manager || null,
                 squad: n.squad.map(v => v || null), home: n.home, away: n.away, location: n.location, stadium: n.stadium, group: n.group };
  add.teams.push(team); out = { ...out, add };
  for (const pid of n.squad.filter(Boolean)) { const at = clubOf.get(pid); if (!at) continue;
    const t = applyDraft(rec, out).teams.find(x => teamKey(x) === at);
    out = draftWith(out, rec, at, { squad: without(squadIds(t), pid, h.labels(t), h.fit, h.ovr) }, "teams"); }
  if (mgrSide) out = draftWith(out, rec, teamKey(mgrSide), { manager: null }, "teams");
  return { errors: [], d: out, id };
}

// The men a request holds: locked against every other change until it is settled.
const menLocks = (r) => [...(r.ins || []).map(m => (m.kind === "manager" ? "m:" : "p:") + m.id), ...(r.outs || []).map(m => "p:" + m.id),
  ...(r.rec?.squad || []).filter(v => typeof v === "string").map(id => "p:" + id), ...(typeof r.rec?.manager === "string" ? ["m:" + r.rec.manager] : []),
  ...(r.rec?.clubs || []).flatMap(c => [...(c.squad || []).filter(v => typeof v === "string").map(id => "p:" + id),
    ...(typeof c.manager === "string" ? ["m:" + c.manager] : [])])];

// WHAT A SAVED CART BECOMES. Returns { scope, errors, apply, requests }: `apply` is the part that goes live now (a
// draft), `requests` the parts waiting on someone's answer. A cart with any error applies nothing.
export function planSave(rec, editors, pending, login, cart, h, now = new Date().toISOString(), newId = () => crypto.randomUUID().slice(0, 8)) {
  const scope = scopeOf(editors, login), over = scope.role === "overseer";
  const none = { scope, errors: [], apply: null, requests: [] };
  if (scope.role === "viewer") return { ...none, errors: ["Not an approved editor"] };
  const group = (g) => g == null || (typeof g === "object" && !Array.isArray(g) && Object.values(g).every(p => p && typeof p === "object" && !Array.isArray(p)));
  const list = (l) => l == null || (Array.isArray(l) && l.every(x => x && typeof x === "object" && !Array.isArray(x)));
  if (!cart || typeof cart !== "object" || !["players", "managers", "teams", "leagues"].every(k => group(cart[k])) || !list(cart.trades) || !list(cart.new) || cart.add
      || Object.values(cart.teams || {}).some(p => "squad" in p && !Array.isArray(p.squad))) return { ...none, errors: ["Not a cart"] };
  // Positions are bookkeeping the server keeps, whatever the cart says.
  const draft = { v: 1, ...(cart.managers ? { managers: cart.managers } : null), ...(cart.leagues ? { leagues: cart.leagues } : null), teams: cart.teams || {},
    players: Object.fromEntries(Object.entries(cart.players || {})
      .map(([id, p]) => [id, Object.fromEntries(Object.entries(p).filter(([f]) => f !== "pos"))]).filter(([, p]) => Object.keys(p).length)) };
  const changes = draftChanges(rec, draft), trades = cart.trades || [], news = cart.new || [];
  if (!changes.length && !trades.length && !news.length) return none;
  const errors = [], teamBy = new Map(rec.teams.map(t => [teamKey(t), t])), leagueBy = new Map((rec.leagues || []).map(l => [l.id, l]));
  // What waits on an open request: the men it names, or, for a request filed before men were locked, whole sides.
  const open = (pending || []).filter(r => !r.declined);
  const lockedSides = new Set(open.flatMap(r => (r.locks || []).filter(l => !/^[pm]:/.test(l))));
  const lockedMen = new Set(open.flatMap(r => (r.locks || []).filter(l => /^[pm]:/.test(l))));
  const { clubOf, mgrClubOf } = placesOf(rec);
  const nextAll = applyDraft(rec, draft);
  const playerBy = new Map(rec.players.map(r => [r.id, r])), mgrBy = new Map(rec.managers.map(r => [r.id, r]));
  const who = (k) => (k.startsWith("m:") ? mgrBy.get(k.slice(2))?.name : playerBy.get(k.slice(2))?.name) || k.slice(2);

  // Every man and manager who changes club in the patches, and every man in a changed squad.
  const moves = [];
  for (const c of changes.filter(c => c.kind === "teams" && c.field === "squad")) {
    const t = teamBy.get(c.id), joined = c.to.filter(x => x && !c.from.includes(x)), left = c.from.filter(x => x && !c.to.includes(x));
    for (const id of [...joined, ...left]) if (lockedMen.has("p:" + id)) errors.push(`${who("p:" + id)}: waiting on a request`);
    for (const id of joined) {
      if (isNational(t)) {
        if (!over && playerBy.get(id)?.nat !== t.code) errors.push(`${t.name.trim()}: ${playerBy.get(id)?.name || id} is not a ${t.name.trim()} national`);
        continue;                                                     // a call-up moves nobody
      }
      const from = clubOf.get(id) || null;
      if (from !== c.id) moves.push({ kind: "player", id, from, to: c.id });
    }
  }
  for (const c of changes.filter(c => c.kind === "teams" && c.field === "manager")) {
    for (const id of [c.from, c.to]) if (id && lockedMen.has("m:" + id)) errors.push(`${who("m:" + id)}: waiting on a request`);
    if (!c.to) continue;
    const t = teamBy.get(c.id), from = mgrClubOf.get(c.to);
    if (!isNational(t) && from && from !== c.id) moves.push({ kind: "manager", id: c.to, from, to: c.id });
  }

  errors.push(...valueProblems(rec, nextAll, changes));

  // What may be touched at all, and what an editor sends to the overseer.
  const details = new Map();                                          // team -> { code, stadium, location } asked for
  const mgrStyle = (id) => { const at = mgrClubOf.get(id); return at ? teamBy.get(at).style : mgrBy.get(id)?.style || null; };
  for (const c of changes) {
    // A league's name, tier and cup are its nation's editors' to change outright.
    if (c.kind === "leagues") { if (!over && !scope.nations.includes(leagueBy.get(c.id)?.nation)) errors.push(`${c.name}: not one of your leagues`); continue; }
    if ((c.kind === "players" || c.kind === "managers") && !over) { errors.push(`${c.name}: a ${c.kind === "players" ? "player" : "manager"}'s record is the overseer's to change`); continue; }
    if (c.kind !== "teams" || over) continue;
    const t = teamBy.get(c.id);
    if (!owns(scope, t)) {
      // Another owner's club, changed only by the men leaving it for this editor's clubs within the cart: the selling
      // side of a move made outright. That is a trade's to make now.
      errors.push(`${c.name}: not one of your teams`); continue;
    }
    if (lockedSides.has(c.id)) errors.push(`${c.name}: waiting on a request`);
    if (BY_REQUEST.has(c.field)) {
      if (c.field === "code" && isNational(t)) errors.push(`${c.name}: a national side's code is the overseer's to change`);
      else details.set(c.id, { ...(details.get(c.id) || {}), [c.field]: c.to });
      continue;
    }
    if (!EDITOR_TEAM_FIELDS.has(c.field)) { errors.push(`${c.name}: ${c.field} is the overseer's to change`); continue; }
    // A side's style follows its manager: it changes only with him, to his.
    if (c.field === "style") { const m = idOf(nextAll.teams.find(x => teamKey(x) === c.id)?.manager);
      if (!(m && m !== idOf(t.manager) && c.to === mgrStyle(m))) errors.push(`${c.name}: a side's style follows its manager`); }
  }
  // A man moved outright: a free signing, or between this person's own clubs (the cart must take him off the old one).
  // A man at another nation's club comes by a trade.
  for (const m of moves) {
    const name = m.kind === "player" ? playerBy.get(m.id)?.name : mgrBy.get(m.id)?.name;
    if (m.kind === "player" && playerBy.get(m.id)?.retired) { errors.push(`${name} has retired`); continue; }
    if (!m.from) continue;
    const from = teamBy.get(m.from), fromNext = nextAll.teams.find(t => teamKey(t) === m.from);
    if (!over && !owns(scope, from)) { errors.push(`${name} is at ${from.name.trim()}: ask for him with a trade`); continue; }
    if (m.kind === "player" && squadIds(fromNext).includes(m.id)) errors.push(`${name} would be at two clubs: take him out of ${from.name.trim()} too`);
    if (m.kind === "manager" && idOf(fromNext.manager) === m.id) errors.push(`${name} already manages ${from.name.trim()}: change their manager too`);
  }

  // The part that goes live now: the patches less the changes sent to the overseer.
  let live = { v: 1, players: draft.players, ...(draft.managers ? { managers: draft.managers } : null), ...(draft.leagues ? { leagues: draft.leagues } : null),
               teams: Object.fromEntries(Object.entries(draft.teams).map(([k, p]) => [k, details.has(k) ? Object.fromEntries(Object.entries(p).filter(([f]) => !BY_REQUEST.has(f))) : p])
                 .filter(([, p]) => Object.keys(p).length)) };
  const touched = new Set(Object.keys(live.teams));
  errors.push(...squadProblems(rec, applyDraft(rec, live), touched));

  const requests = [], base = { by: scope.login, at: now, approved: [] };
  for (const [k, patch] of details) {
    const t = teamBy.get(k);
    requests.push({ ...base, id: newId(), kind: "details", team: k, teamName: t.name.trim(), patch, needs: { [OVERSEER]: editors?.overseers || [] }, locks: [] });
  }

  // Trades: the other nation answers; the overseer's go live as they stand.
  const h2 = h;
  for (const tr of trades) {
    const A = teamBy.get(tr.side), B = teamBy.get(tr.other);
    if (!A || !B || !Array.isArray(tr.ins) || !Array.isArray(tr.outs)) { errors.push("Not a trade"); continue; }
    const label = `${A.name.trim()} and ${B.name.trim()}`;
    if (isNational(A) || isNational(B)) { errors.push(`${label}: trades are between clubs`); continue; }
    if (!owns(scope, A)) { errors.push(`${A.name.trim()}: not one of your teams`); continue; }
    if (!over && owns(scope, B)) { errors.push(`${label}: both are yours, so move him outright`); continue; }
    if (!tr.ins.length && !tr.outs.length) { errors.push(`${label}: a trade moves somebody`); continue; }
    const men = menLocks(tr);
    for (const l of men) if (lockedMen.has(l)) errors.push(`${who(l)}: waiting on a request`);
    for (const m of tr.ins) if (m.kind === "player" && playerBy.get(m.id)?.retired) errors.push(`${who("p:" + m.id)} has retired`);
    // Whether it would fit both squads as they will stand once this cart is in.
    const fit = tradeDraft(rec, live, tr, h2);
    if (fit.errors.length) { errors.push(...fit.errors.map(e => `${label}: ${e}`)); continue; }
    if (over) { live = fit.d; for (const k of [tr.side, tr.other]) touched.add(k); continue; }
    requests.push({ ...base, id: newId(), kind: "trade", team: tr.side, teamName: A.name.trim(), other: tr.other, otherName: B.name.trim(),
      ins: tr.ins.map(m => ({ kind: m.kind === "manager" ? "manager" : "player", id: m.id })), outs: tr.outs.map(m => ({ kind: "player", id: m.id })),
      needs: { [tr.other]: ownersOf(editors, B) }, locks: men });
  }

  // New records: the overseer answers an editor's; the overseer's own go straight in.
  for (const n of news) {
    // Checked against the records as they will stand once this cart is in: a place it opens is a place he can take.
    const probs = newProblems(applyDraft(rec, live), n, scope, over, h);
    if (probs.length) { errors.push(...probs); continue; }
    const fields = Object.fromEntries(Object.entries(n).filter(([f]) => f !== "id"));
    if (over) { const made = createDraft(rec, live, fields, h); if (made.errors.length) errors.push(...made.errors);
      else { live = made.d; for (const t of live.add?.teams || []) touched.add(teamKey(t)); } continue; }
    requests.push({ ...base, id: newId(), kind: "new", what: n.what, teamName: n.name, rec: fields, needs: { [OVERSEER]: editors?.overseers || [] }, locks: menLocks({ rec: fields }) });
  }
  if (over) errors.push(...squadProblems(rec, applyDraft(rec, live), touched));
  if (errors.length) return { ...none, errors: [...new Set(errors)] };
  return { scope, errors: [], apply: draftSizeOf(live) ? withPositions(rec, live, h) : null, requests };
}
const draftSizeOf = (d) => ["players", "managers", "teams", "leagues"].reduce((n, k) => n + Object.keys(d[k] || {}).length + (d.add?.[k]?.length || 0), 0);

// SETTLING A REQUEST. action: "accept" | "decline" | "withdraw"; `extra` carries the overseer's edits to a new record
// and the note a decline sends back. Returns { errors, done, apply, request }: `request` is the request as it now stands
// (null once gone; a declined one stays, with its note, until its maker dismisses it), `apply` the draft to go live when
// the last answer is in.
export function settleRequest(rec, editors, request, login, action, h, extra = {}) {
  const scope = scopeOf(editors, login), over = scope.role === "overseer";
  const teamBy = new Map(rec.teams.map(t => [teamKey(t), t]));
  const answersFor = Object.keys(request.needs || {}).filter(k => over || (k !== OVERSEER && owns(scope, teamBy.get(k))));
  if (action === "withdraw") {
    if (!over && lc(login) !== lc(request.by)) return { errors: ["Only the person who asked can withdraw it"] };
    return { errors: [], done: true, apply: null, request: null };
  }
  if (request.declined) return { errors: ["Already declined"] };
  if (!answersFor.length) return { errors: ["Not yours to answer"] };
  if (action === "decline") {
    if (!request.kind) return { errors: [], done: true, apply: null, request: null };
    const note = text(extra.note, 200, true) ? extra.note : "";
    return { errors: [], done: true, apply: null, request: { ...request, declined: { by: scope.login, at: new Date().toISOString(), note } } };
  }
  const approved = [...new Set([...request.approved, ...answersFor])];
  if (Object.keys(request.needs).some(k => !approved.includes(k))) return { errors: [], done: false, apply: null, request: { ...request, approved } };

  if (request.kind === "details") {
    const t = teamBy.get(request.team);
    if (!t) return { errors: ["The team is gone"] };
    const d = draftWith(null, rec, request.team, request.patch, "teams"), next = applyDraft(rec, d);
    const probs = valueProblems(rec, next, draftChanges(rec, d));
    return probs.length ? { errors: probs } : { errors: [], done: true, apply: d, request: null };
  }
  if (request.kind === "trade") {
    const r = tradeDraft(rec, null, { side: request.team, other: request.other, ins: request.ins, outs: request.outs }, h);
    if (r.errors.length) return { errors: r.errors };
    const problems = squadProblems(rec, applyDraft(rec, r.d), new Set([request.team, request.other]));
    return problems.length ? { errors: problems } : { errors: [], done: true, apply: withPositions(rec, r.d, h), request: null };
  }
  if (request.kind === "new") {
    const n = { ...request.rec, ...(over && extra.edits && typeof extra.edits === "object" ? extra.edits : null), what: request.what };
    const probs = newProblems(rec, n, scope, over, h);
    if (probs.length) return { errors: probs };
    const made = createDraft(rec, null, n, h);
    if (made.errors.length) return { errors: made.errors };
    const keys = new Set(Object.keys(made.d.teams || {}).concat((made.d.add?.teams || []).map(teamKey)));
    const problems = squadProblems(rec, applyDraft(rec, made.d), keys);
    return problems.length ? { errors: problems } : { errors: [], done: true, apply: withPositions(rec, made.d, h), request: null };
  }

  // A request filed before trades: the receiving team's whole change, its men from the selling clubs.
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
