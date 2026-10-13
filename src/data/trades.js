// THE TRADES LOG (Moukden and Kirin, 13 October 2026; DESIGN.md, Trades): every move of a man the registry makes, written
// by the registry server (server/worker.js) as a save or an accepted offer goes live, into public/avium/pstats/trades.tsv,
// a row a man. Trades between clubs, free agent signings, releases, moves between one nation's own clubs and managers
// changing club; never a national call-up, a new man, a man retiring or the men of a club removed. The moves one save or
// accept makes that share a club are one deal, its rows sharing a number. A season runs from one World Cup to the next
// (the user: "After every World Cup"): a move belongs to the year of the latest World Cup on file when it went live.
import { ageOf, icNow } from "./icclock.js";
import { idOf, teamKey } from "./draft.js";
import { posList } from "./positions.js";
import { trendsOf, valueContext, valueInputs, valueOf } from "./value.js";

export const TRADES_FILE = "public/avium/pstats/trades.tsv";
export const TRADE_HEAD = ["DEAL", "SEASON", "DATE", "KIND", "ID", "NAME", "POS", "OVR", "AGE", "VALUE", "FROM", "FROM CLUB", "TO", "TO CLUB", "BY"];
const isNat = (t) => t.file === "AVIUM" || t.file === "ARTERRA";

// Where every man and manager stands: his club's key, or none.
function clubsOf(rec) {
  const man = new Map(), mgr = new Map();
  for (const t of rec.teams || []) {
    if (isNat(t)) continue;
    for (const v of t.squad || []) { const id = idOf(v); if (id) man.set(id, teamKey(t)); }
    const m = idOf(t.manager); if (m) mgr.set(m, teamKey(t));
  }
  return { man, mgr };
}

// The moves between two states of the records: { kind, id, from, to } for every man and manager whose club changed, a
// club's key or null for free agency.
export function tradeMoves(rec, next) {
  const a = clubsOf(rec), b = clubsOf(next), out = [], live = new Set((next.teams || []).map(teamKey));
  const had = new Set(rec.players.map(p => p.id)), hadM = new Set(rec.managers.map(m => m.id));
  const retired = new Set(next.players.filter(p => p.retired).map(p => p.id));
  const take = (kind, A, B, known) => { for (const id of new Set([...A.keys(), ...B.keys()])) {
    const from = A.get(id) || null, to = B.get(id) || null;
    if (from === to || !known.has(id) || (kind === "player" && retired.has(id)) || (from && !live.has(from) && !to)) continue;
    out.push({ kind, id, from, to }); } };
  take("player", a.man, b.man, had); take("manager", a.mgr, b.mgr, hadM);
  return out;
}

// The moves in deals: those sharing a club go together.
export function tradeDeals(moves) {
  const up = new Map(), find = (x) => { while (up.get(x) !== x) { up.set(x, up.get(up.get(x))); x = up.get(x); } return x; };
  for (const m of moves) { for (const c of [m.from, m.to]) if (c && !up.has(c)) up.set(c, c); if (m.from && m.to) up.set(find(m.from), find(m.to)); }
  const by = new Map();
  for (const m of moves) { const k = find(m.from || m.to); (by.get(k) || by.set(k, []).get(k)).push(m); }
  return [...by.values()];
}

// The log's new rows for what `rec` -> `next` moved, numbered on from `first`: each man as he stood before he went (his
// positions, rating and age, a player's transfer value with his club's league and his rating's trend, src/data/value.js)
// and the clubs he left and joined by key and by the name each had. `now` is the real instant; the date is the world's.
export function tradeRows(rec, next, { season, now = new Date(), by = "", first = 1, trends = new Map(), slotsFor }) {
  const deals = tradeDeals(tradeMoves(rec, next));
  if (!deals.length) return [];
  const ctx = valueContext(rec.teams, slotsFor, idOf), P = new Map(rec.players.map(p => [p.id, p])), M = new Map(rec.managers.map(m => [m.id, m]));
  const before = new Map(rec.teams.map(t => [teamKey(t), t])), after = new Map(next.teams.map(t => [teamKey(t), t]));
  const date = icNow(now).toISOString().slice(0, 10), rows = [];
  deals.forEach((d, i) => { for (const m of d) {
    const r = (m.kind === "player" ? P : M).get(m.id), v = m.kind === "player" ? valueOf(valueInputs(r, ctx, trends, now)) : null;
    rows.push({ deal: first + i, season, date, kind: m.kind, id: m.id, name: r.name, pos: m.kind === "player" ? posList(r.pos).join("/") : "",
      ovr: r.ovr ?? "", age: ageOf(r.born, now) ?? "", value: v ?? "", from: m.from || "", fromClub: m.from ? before.get(m.from)?.name.trim() || "" : "",
      to: m.to || "", toClub: m.to ? after.get(m.to)?.name.trim() || "" : "", by }); } });
  return rows;
}

// The log's text and back.
const COLS = ["deal", "season", "date", "kind", "id", "name", "pos", "ovr", "age", "value", "from", "fromClub", "to", "toClub", "by"];
const NUM = new Set(["deal", "season", "ovr", "age", "value"]);
export const dumpTrades = (rows) => [TRADE_HEAD, ...rows.map(r => COLS.map(c => String(r[c] ?? "").replace(/[\t\r\n]/g, " ")))].map(l => l.join("\t")).join("\n") + "\n";
export const parseTrades = (text) => String(text || "").replace(/\r\n/g, "\n").split("\n").slice(1).filter(l => l.trim())
  .map(l => { const c = l.split("\t"); return Object.fromEntries(COLS.map((k, i) => [k, NUM.has(k) ? (c[i] === "" || c[i] == null ? null : +c[i]) : c[i] || ""])); });

// The changelog's rows as value.js reads a trend (public/avium/pstats/changelog.tsv: SEASON, COMPETITION, PLAYER, TEAM,
// POS, OLD, NEW).
export const trendRows = (text) => String(text || "").replace(/\r\n/g, "\n").split("\n").slice(1).filter(l => l.trim())
  .map(l => l.split("\t")).map(c => ({ season: c[0], player: c[2], old: +c[5], neu: +c[6] })).filter(r => r.player && Number.isFinite(r.old) && Number.isFinite(r.neu));
export const trendsFrom = (text) => trendsOf(trendRows(text));

// The season a move goes in: the year of the latest World Cup on file (public/avium/pstats/wc, its season files by year).
export const latestWorldCup = (names) => { const ys = (names || []).map(n => (String(n).match(/^(\d{4})\.(?:md|tsv)$/) || [])[1]).filter(Boolean).map(Number);
  return ys.length ? Math.max(...ys) : null; };
