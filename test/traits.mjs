// TRAITS FOR EVERY PLAYER (Moukden and Kirin, 11 October 2026), by the user's rules. Only players rated 75 or more
// carry traits: one at 75-79, two at 80-89, three from 90. Bronze unlocks at 75, silver at 80, gold at 85, and a man's
// best trait comes from the top tier his rating unlocks (one of it at most), the rest from the tiers below. A keeper
// carries Shot Stopper or Commanding, the two split evenly at each rating, and from 80 one passing trait: Long Ball,
// Short Passing or Composed. Inside each tier every trait is held by as many men as every other, give or take one.
//
// Which man gets which. A trait can go to any position where it means something in a match (OPEN, either of his two
// positions), not only where it was measured (NATURAL, test/specs/badges.mjs): the first run kept each trait to its
// natural positions and every position came out a stereotype -- 93% of centre-backs rated 80-84 Disciplined, 82% of
// wingers Crosser -- and the user's own picks for the men rated 90 or more crossed positions freely (an attacking
// midfielder Strong and a Tackler, central midfielders Rapid), "There should be distinctness all around" (11 October
// 2026). A natural trait is a little likelier; and inside each rating band and position the n-th man to take a trait
// pays more for it the further past his group's fair share it is (SPREAD), so a position spreads over everything it
// can take. Among those his record decides: his career a game off the season boards, as the radar on his page draws
// it (goals, assists, chances created, defensive actions, average rating; saves for a keeper), measured against men of
// his own position at his own rating, with his age as a lean for the traits no figure shows. A man who already
// carries traits keeps them, and they count in the totals. The choice is one min-cost flow: every man his count, the
// equal totals, then as many top-tier traits as fit, then variety, then the best fits.
//
//   node test/traits.mjs                 prints what it would give, tier by tier
//   node test/traits.mjs write           writes the traits into src/data/players.json
//   node test/traits.mjs list <file>     writes the review list, club by club, as TSV
//   ... redo ...                         gives everyone rated under 90 his traits again (the 90s are the user's own)
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, statSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIR = mkdtempSync(join(tmpdir(), "traits-")), ENTRY = join(DIR, "e.js"), OUT = join(DIR, "o.mjs");
writeFileSync(ENTRY, ["data/badges.js", "data/icclock.js"].map(f => `export * from ${JSON.stringify(join(ROOT, "src", f))};`).join("\n")
  + `\nexport { dumpRecords } from ${JSON.stringify(join(ROOT, "src/data/draft.js"))};\n`);
execFileSync(join(ROOT, "node_modules/.bin/esbuild"), [ENTRY, "--bundle", "--format=esm", "--platform=node", `--outfile=${OUT}`, "--log-level=error"]);
const { BADGES, badgeOrder, icNow, yearsBetween, dumpRecords } = await import(pathToFileURL(OUT).href);

const read = (f) => JSON.parse(readFileSync(join(ROOT, "src/data", f), "utf8"));
const players = read("players.json"), teams = read("teams.json");
const TIER = Object.fromEntries(BADGES.map(b => [b.id, b.tier])), NAME = Object.fromEntries(BADGES.map(b => [b.id, b.name]));

// ── THE RULES ──
const countOf = (o) => (o >= 90 ? 3 : o >= 80 ? 2 : o >= 75 ? 1 : 0);
const unlocked = (o) => (o >= 85 ? ["gold", "silver", "bronze"] : o >= 80 ? ["silver", "bronze"] : o >= 75 ? ["bronze"] : []);
const topTier = (o) => unlocked(o)[0] || null;
const KIND = { GK: "GK", CB: "CB", LB: "FB", RB: "FB", LWB: "FB", RWB: "FB", DM: "DM", CM: "CM", AM: "AM", LM: "W", RM: "W", LW: "W", RW: "W", ST: "ST" };
const kinds = (o) => Object.fromEntries(Object.entries(o).map(([b, k]) => [b, k === "ALL" ? ["CB", "FB", "DM", "CM", "AM", "W", "ST"] : k.split(" ")]));
// Where each trait was measured, and the first run's additions for forwards and for full-backs and central midfielders.
const NATURAL = kinds({
  finisher: "ST AM", interceptor: "CB DM", rapid: "ST CB FB W", aerial: "CB ST", quickstep: "ST W AM", blocker: "CB FB", strong: "ST",
  relentless: "FB DM CM AM W ST", trickster: "W AM ST", vision: "DM CM AM", incisive: "CM AM", disciplined: "CB FB DM CM",
  longshot: "CM AM ST W", firsttouch: "DM CM AM ST",
  crosser: "FB W", tikitaka: "CB DM CM", deadball: "DM CM AM ST W FB", composed: "ALL", tackler: "CB DM FB CM", longball: "CB DM CM",
});
// Everywhere a trait means something in a match. Left out only where the habit has nothing to act on: a centre-back
// who finishes, crosses, beats men or shoots from range; a forward or winger who sits in the passing lane or throws
// himself at shots; a striker who crosses or goes long, a winger who goes long.
const OPEN = kinds({
  finisher: "ST AM W CM", interceptor: "CB FB DM CM AM", rapid: "ALL", aerial: "ALL", quickstep: "ALL", blocker: "CB FB DM CM", strong: "ALL",
  relentless: "ALL", trickster: "FB DM CM AM W ST", vision: "ALL", incisive: "ALL", disciplined: "ALL",
  longshot: "FB DM CM AM W ST", firsttouch: "ALL",
  crosser: "FB DM CM AM W", tikitaka: "ALL", deadball: "ALL", composed: "ALL", tackler: "ALL", longball: "CB FB DM CM AM",
});
const SUITS = OPEN;
for (const b in NATURAL) if (NATURAL[b].some(k => !OPEN[b].includes(k))) throw new Error(`${b}: natural somewhere it is not open`);
const KEEPER = ["shotstopper", "commanding"], KEEPER_PASS = ["longball", "tikitaka", "composed"];
const EXCL = [["shotstopper", "commanding"], ["tackler", "disciplined"], ["tikitaka", "longball"]];
const OUTFIELD = Object.keys(SUITS);
if (OUTFIELD.length + KEEPER.length !== BADGES.length || BADGES.some(b => !SUITS[b.id] && !KEEPER.includes(b.id))) throw new Error("SUITS does not cover the badge table");

// ── HIS RECORD: the season boards, added up the way the player page adds them (App.tsx uxCareers) ──
const fold = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
function parseStatBoards(text) {   // as App.tsx parseStatBoards
  const rows = text.replace(/\r\n/g, "\n").split("\n").filter(r => r.trim()).map(r => r.split("\t"));
  const head = rows[0] || [], boards = {}, KNOWN = { POS: "pos", TEAM: "team", GP: "gp", ST: "st", MIN: "min" };
  head.forEach((h, i) => {
    if (h !== "PLAYER") return;
    const col = {}; let j = i + 1;
    for (; j < head.length && KNOWN[head[j]]; j++) col[KNOWN[head[j]]] = j;
    const stat = head[j] === "S" ? "SV" : head[j]; if (!stat) return;
    boards[stat] = rows.slice(1).filter(r => r[i]).map(r => ({ player: r[i], gp: +r[col.gp] || 0, v: +r[j] || 0 }));
  });
  return boards;
}
const PS = join(ROOT, "public/avium/pstats"), careers = new Map();
for (const d of readdirSync(PS)) {
  if (!statSync(join(PS, d)).isDirectory()) continue;
  for (const f of readdirSync(join(PS, d))) {
    if (!/^(\d{2}-\d{2}|\d{4})\.tsv$/.test(f)) continue;
    const seen = new Map();
    for (const [k, list] of Object.entries(parseStatBoards(readFileSync(join(PS, d, f), "utf8")))) for (const e of list) {
      const id = fold(e.player); let x = seen.get(id); if (!x) seen.set(id, x = { gp: 0 }); x.gp = Math.max(x.gp, e.gp); x[k] = e.v; }
    for (const [id, x] of seen) {
      let c = careers.get(id); if (!c) careers.set(id, c = { gp: 0, G: 0, A: 0, CC: 0, DC: 0, SV: 0, rs: 0, rg: 0 });
      c.gp += x.gp; for (const k of ["G", "A", "CC", "DC", "SV"]) c[k] += x[k] || 0;
      if (x.RTG != null) { c.rs += x.RTG * x.gp; c.rg += x.gp; }
    }
  }
}
const named = new Map(); for (const r of players) named.set(fold(r.name), (named.get(fold(r.name)) || 0) + 1);
const careerOf = (r) => { const c = named.get(fold(r.name)) === 1 ? careers.get(fold(r.name)) : null; return c?.gp ? c : null; };
const rateOf = (c, k) => (k === "RTG" ? (c.rg ? c.rs / c.rg : null) : c[k] / c.gp);
const kindsOf = (r) => [...new Set((r.pos || []).map(p => KIND[p]).filter(Boolean))];

// Against men of his own position at his own rating: each figure on rating, by his first position, over every man with
// ten games; how far he sits off that line in its spread, drawn in toward nothing when his games are few.
const STATS = ["G", "A", "CC", "DC", "RTG"], LINE = {};
for (const kind of ["CB", "FB", "DM", "CM", "AM", "W", "ST", "GK"]) for (const k of kind === "GK" ? ["SV"] : STATS) {
  const pts = players.filter(r => kindsOf(r)[0] === kind).map(r => [r.ovr, careerOf(r)]).filter(([, c]) => c && c.gp >= 10 && rateOf(c, k) != null).map(([o, c]) => [o, rateOf(c, k)]);
  const n = pts.length, mx = pts.reduce((a, p) => a + p[0], 0) / n, my = pts.reduce((a, p) => a + p[1], 0) / n;
  const b = pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0) / Math.max(1e-9, pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0)), a = my - b * mx;
  const sd = Math.sqrt(pts.reduce((s, p) => s + (p[1] - (a + b * p[0])) ** 2, 0) / Math.max(1, n - 2)) || 1;
  LINE[kind + k] = { a, b, sd, n };
}
const SHRINK = 15;
function figures(r) {
  const c = careerOf(r), kind = kindsOf(r)[0], z = {}, at = {};
  for (const k of kind === "GK" ? ["SV"] : STATS) {
    const L = LINE[kind + k], v = c ? rateOf(c, k) : null;
    at[k] = { his: v, peers: L.a + L.b * r.ovr };
    z[k] = v == null ? 0 : ((v - at[k].peers) / L.sd) * (c.gp / (c.gp + SHRINK));
  }
  return { c, z, at };
}
const NOW = icNow();
const ageOf = (r) => (r.born ? yearsBetween(r.born, NOW) : 27);

// What in his record points to each trait: weights on his figures against his peers, and on his age (older is +).
const LEAN = {
  finisher: { G: 1.0 }, longshot: { G: 0.7, RTG: 0.2 }, aerial: { G: 0.5 }, strong: { G: 0.3, age: 0.1 }, rapid: { G: 0.2, age: -0.4 },
  quickstep: { CC: 0.3, age: -0.4 }, trickster: { CC: 0.8, G: 0.2, age: -0.2 }, crosser: { A: 0.8, CC: 0.4 }, incisive: { A: 0.7, CC: 0.6 },
  vision: { CC: 0.6, A: 0.3, RTG: 0.3, age: 0.2 }, deadball: { A: 0.4, G: 0.3, age: 0.2 }, firsttouch: { RTG: 0.4, CC: 0.2 },
  tikitaka: { RTG: 0.4, CC: 0.2 }, longball: { A: 0.3, age: 0.3 }, composed: { RTG: 0.5, age: 0.4 }, interceptor: { DC: 1.0 },
  tackler: { DC: 0.8, age: -0.2 }, blocker: { DC: 0.8 }, relentless: { DC: 0.8, age: -0.4 }, disciplined: { RTG: 0.5, DC: -0.3, age: 0.3 },
  shotstopper: { SV: 1.0 },
};
// A defender's goals are mostly headers from set pieces.
const LEAN_BY_KIND = { aerial: { CB: { G: 1.0 } } };
// A trait natural to one of his positions is a little likelier than one that only crosses into it.
const NATURAL_LEAN = +(process.env.NATURAL_LEAN || 1.0);
function u01(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; h = Math.imul(h, 0x297a2d39) >>> 0; h ^= h >>> 15; return (h >>> 0) / 4294967296; }
const LABEL = { G: "goals", A: "assists", CC: "chances created", DC: "defensive actions", RTG: "average rating", SV: "saves" };
const PEERS = { CB: "centre-backs", FB: "full-backs", DM: "holding midfielders", CM: "central midfielders", AM: "attacking midfielders", W: "wingers", ST: "strikers", GK: "keepers" };
// His fit for a trait, and the thing that most decided it, in words.
function fit(r, b, F) {
  const kind = kindsOf(r)[0], w = { ...LEAN[b], ...(LEAN_BY_KIND[b]?.[kind] || {}) }, y = (ageOf(r) - 27) / 4;
  let s = (NATURAL[b]?.some(k => kindsOf(r).includes(k)) ? NATURAL_LEAN : 0) + 0.4 * (u01(r.id + ":" + b) - 0.5), why = null, most = 0.25;
  for (const [k, wt] of Object.entries(w)) {
    const part = k === "age" ? wt * y : wt * (F.z[k] || 0); s += part;
    if (part > most) { most = part; why = k; }
  }
  const f = (v, k) => (k === "RTG" ? v.toFixed(2) : v.toFixed(2) + " a game");
  const text = !why ? (F.c ? "variety in his position" : "no games on record") : why === "age" ? `age ${ageOf(r)}`
    : `${LABEL[why]} ${f(F.at[why].his, why)}, ${f(F.at[why].peers, why)} for ${PEERS[kind]} at his rating`;
  return { s, text };
}

// ── WHO CARRIES WHAT ──
const isKeeper = (r) => (r.pos || []).includes("GK");
const ARGS = process.argv.slice(2), REDO = ARGS.includes("redo"), KEEP_FROM = 90;
const locked = new Map(players.filter(r => r.badges?.length && (!REDO || r.ovr >= KEEP_FROM)).map(r => [r.id, r.badges]));
const lockedCount = {}; for (const bs of locked.values()) for (const b of bs) lockedCount[b] = (lockedCount[b] || 0) + 1;
const band = (o) => (o >= 90 ? "90+" : o >= 85 ? "85-89" : o >= 80 ? "80-84" : "75-79");
const men = [];
for (const r of players) {
  if (r.ovr < 75 || locked.has(r.id)) continue;
  const F = figures(r), kinds = kindsOf(r), keeper = isKeeper(r);
  if (keeper) { men.push({ r, F, keeper, count: r.ovr >= 80 ? 1 : 0, top: null, opts: r.ovr >= 80 ? KEEPER_PASS.map(b => ({ b, gate: false, ...fit(r, b, F) })) : [] }); continue; }
  const tiers = unlocked(r.ovr), top = r.ovr >= 80 ? topTier(r.ovr) : null;
  let opts = OUTFIELD.filter(b => tiers.includes(TIER[b]) && SUITS[b].some(k => kinds.includes(k))).map(b => ({ b, gate: TIER[b] === top, ...fit(r, b, F) }));
  // A pair that cannot be held together, one through his top-tier gate and one not, keeps the top-tier one: it can be
  // his best trait, and the other has company in its own tier.
  for (const [a, c] of EXCL) { const A = opts.find(o => o.b === a), C = opts.find(o => o.b === c);
    if (A && C && A.gate !== C.gate) opts = opts.filter(o => o !== (A.gate ? C : A)); }
  men.push({ r, F, keeper, count: countOf(r.ovr), top, opts });
}

// ── THE FLOW ──
class Graph {
  constructor() { this.h = []; this.to = []; this.cap = []; this.cost = []; this.nx = []; this.n = 0; }
  node() { this.h.push(-1); return this.n++; }
  edge(u, v, c, w = 0) { for (const [a, b, k, x] of [[u, v, c, w], [v, u, 0, -w]]) { this.to.push(b); this.cap.push(k); this.cost.push(x); this.nx.push(this.h[a]); this.h[a] = this.to.length - 1; } return this.to.length - 2; }
  maxflow(s, t) {   // Dinic, costs ignored
    let flow = 0; const lv = new Int32Array(this.n), it = new Int32Array(this.n);
    const bfs = () => { lv.fill(-1); lv[s] = 0; const q = [s]; for (let i = 0; i < q.length; i++) { const u = q[i]; for (let e = this.h[u]; e !== -1; e = this.nx[e]) if (this.cap[e] > 0 && lv[this.to[e]] < 0) { lv[this.to[e]] = lv[u] + 1; q.push(this.to[e]); } } return lv[t] >= 0; };
    const dfs = (u, f) => { if (u === t) return f; for (; it[u] !== -1; it[u] = this.nx[it[u]]) { const e = it[u], v = this.to[e]; if (this.cap[e] > 0 && lv[v] === lv[u] + 1) { const d = dfs(v, Math.min(f, this.cap[e])); if (d > 0) { this.cap[e] -= d; this.cap[e ^ 1] += d; return d; } } } return 0; };
    while (bfs()) { for (let i = 0; i < this.n; i++) it[i] = this.h[i]; let f; while ((f = dfs(s, 1e9)) > 0) flow += f; }
    return flow;
  }
  mincost(s, t) {   // successive shortest paths; Bellman-Ford once for the potentials, Dijkstra after
    const n = this.n, pot = new Float64Array(n), dist = new Float64Array(n), pe = new Int32Array(n);
    pot.fill(Infinity); pot[s] = 0;
    for (let round = 0, changed = true; changed && round < n; round++) { changed = false;
      for (let u = 0; u < n; u++) if (pot[u] < Infinity) for (let e = this.h[u]; e !== -1; e = this.nx[e]) if (this.cap[e] > 0 && pot[u] + this.cost[e] < pot[this.to[e]]) { pot[this.to[e]] = pot[u] + this.cost[e]; changed = true; } }
    for (let u = 0; u < n; u++) if (pot[u] === Infinity) pot[u] = 0;
    let flow = 0, total = 0;
    for (;;) {
      dist.fill(Infinity); dist[s] = 0; pe.fill(-1);
      const heap = [[0, s]], push = (x) => { heap.push(x); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
      const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
      while (heap.length) { const [d, u] = pop(); if (d > dist[u]) continue;
        for (let e = this.h[u]; e !== -1; e = this.nx[e]) { if (this.cap[e] <= 0) continue; const v = this.to[e], nd = d + this.cost[e] + pot[u] - pot[v];
          if (nd < dist[v] - 1e-9) { dist[v] = nd; pe[v] = e; push([nd, v]); } } }
      if (dist[t] === Infinity) break;
      for (let u = 0; u < n; u++) if (dist[u] < Infinity) pot[u] += dist[u];
      let f = Infinity; for (let v = t; v !== s; v = this.to[pe[v] ^ 1]) f = Math.min(f, this.cap[pe[v]]);
      for (let v = t; v !== s; v = this.to[pe[v] ^ 1]) { this.cap[pe[v]] -= f; this.cap[pe[v] ^ 1] += f; total += f * this.cost[pe[v]]; }
      flow += f;
    }
    return { flow, total };
  }
}
const BIG = 1e7, MED = 1e4, PTS = 100;
// VARIETY: the men of one rating band and one position (his first; keepers apart) are a group. The n-th of a group to
// take a trait pays SPREAD x n over the group's fair share of it (its places over the traits it can take), so no trait
// becomes a position's habit unless a man's record or position earns it the price.
const SPREAD = +(process.env.SPREAD || 150);
const groupOf = (m) => band(m.r.ovr) + " " + (m.keeper ? "GK" : kindsOf(m.r)[0]);
const GROUP = new Map();
for (const m of men) { if (!m.count || !m.opts.length) continue;
  let x = GROUP.get(groupOf(m)); if (!x) GROUP.set(groupOf(m), x = { slots: 0, traits: new Set() });
  x.slots += m.count; for (const o of m.opts) x.traits.add(o.b); }
// The whole problem as a graph: every man his count, his top tier through a gate of one, pairs he cannot hold together
// through a node of one, each choice through its group's node for that trait (the rising price), and each trait's
// total between q and q + 1 for its tier (the q part priced BIG, so it fills first whenever it can).
function build(q, priced) {
  const g = new Graph(), s = g.node(), t = g.node(), tn = Object.fromEntries(OUTFIELD.map(b => [b, g.node()])), uses = [], via = new Map();
  const gt = (grp, b) => { const k = grp + "|" + b; let x = via.get(k); if (!x) via.set(k, x = { node: g.node(), grp, b, n: 0 }); x.n++; return x.node; };
  for (const m of men) {
    if (!m.count || !m.opts.length) continue;
    const u = g.node(); g.edge(s, u, m.count);
    const gate = m.opts.some(o => o.gate) ? g.node() : null; if (gate != null) g.edge(u, gate, 1);
    const pairOf = new Map();
    for (const [a, c] of EXCL) { const A = m.opts.find(o => o.b === a), C = m.opts.find(o => o.b === c);
      if (A && C && !A.gate && !C.gate) { const p = g.node(); g.edge(u, p, 1); pairOf.set(a, p); pairOf.set(c, p); } }
    for (const o of m.opts) {
      const from = o.gate ? gate : pairOf.get(o.b) ?? u;
      uses.push([m, o, g.edge(from, gt(groupOf(m), o.b), 1, priced ? -(o.gate ? MED : 0) - Math.round(o.s * PTS) : 0)]);
    }
  }
  for (const x of via.values()) { const G = GROUP.get(x.grp), fair = Math.max(1, G.slots / G.traits.size);
    for (let j = 0; j < x.n; j++) g.edge(x.node, tn[x.b], 1, priced ? Math.round(SPREAD * j / fair) : 0); }
  const lo = {}, hi = {};
  for (const b of OUTFIELD) { const qb = q[TIER[b]] ?? 0, have = lockedCount[b] || 0;
    lo[b] = g.edge(tn[b], t, Math.max(0, qb - have), priced ? -BIG : 0); hi[b] = g.edge(tn[b], t, Math.max(0, qb + 1 - Math.max(have, qb)), 0); }
  return { g, s, t, uses, lo, hi };
}
const slots = men.reduce((a, m) => a + (m.opts.length ? m.count : 0), 0);
// Each tier's q: as high as every one of its traits can be held that many times at once, top tier first. Checked in two
// steps, the q parts alone and then the rest on top, which never takes back what the first step put in.
function check(q) {
  const { g, s, t, lo, hi } = build(q, false);
  const need = OUTFIELD.reduce((a, b) => a + g.cap[lo[b]], 0);
  const saved = OUTFIELD.map(b => g.cap[hi[b]]); OUTFIELD.forEach(b => (g.cap[hi[b]] = 0));
  const first = g.maxflow(s, t); if (first < need) return { ok: false };
  OUTFIELD.forEach((b, i) => (g.cap[hi[b]] = saved[i]));
  return { ok: true, fill: first + g.maxflow(s, t) };
}
const best = (tier, base) => { let lo = 0, hi = 1000; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (check({ ...base, [tier]: m }).ok) lo = m; else hi = m - 1; } return lo; };
// The q parts priced, every man his count, then as many top-tier traits as fit, then the best fits.
const solveAt = (q) => { const B = build(q, true), run = B.g.mincost(B.s, B.t);
  const tops = new Set(); for (const [m, o, e] of B.uses) if (B.g.cap[e] === 0 && o.gate) tops.add(m.r.id);
  const ok = OUTFIELD.every(b => B.g.cap[B.lo[b]] === 0);
  return { ...B, run, q, ok, tops: tops.size }; };
// Gold as common as it can be. Silver and bronze: a higher q spreads more of a tier onto the second traits of the men
// above it, which can cost a man rated 80-84 his silver (the user's rule: his best trait from his top tier). So each
// q is the one that leaves the most men with a trait of their top tier, the highest such q on a tie.
const qg = best("gold", { gold: 0, silver: 0, bronze: 0 }), qsMax = best("silver", { gold: qg, silver: 0, bronze: 0 });
// Every man who has a top-tier trait he could take getting one is the most there can be; the first q that gives it wins.
const MAXTOP = men.filter(m => !m.keeper && m.opts.some(o => o.gate)).length, SLOTS = men.reduce((a, m) => a + (m.opts.length ? m.count : 0), 0);
let pick = null;
scan: for (let qs = qsMax; qs >= Math.max(0, qsMax - 25); qs--) {
  const qbMax = best("bronze", { gold: qg, silver: qs, bronze: 0 });
  for (let qb = qbMax, since = 0; qb >= 0 && since < 6; qb--, since++) {
    const r = solveAt({ gold: qg, silver: qs, bronze: qb });
    if (!r.ok || r.run.flow < SLOTS) continue;
    if (!pick || r.tops > pick.tops) { pick = r; since = 0; }
    if (r.tops === MAXTOP) break scan;
  }
}
const { g, s, t, uses, run, q } = pick, full = check(q).fill;

// ── WHAT EACH MAN GOT ──
const got = new Map();
for (const [m, o, e] of uses) if (g.cap[e] === 0) got.set(m.r.id, [...(got.get(m.r.id) || []), o]);
// Keepers' own trait, at each rating split evenly: the ones who make the most saves for their rating stop shots, the
// others come for the ball.
const keepers = men.filter(m => m.keeper);
for (const bd of ["75-79", "80-84", "85-89", "90+"]) {
  const ks = keepers.filter(m => band(m.r.ovr) === bd).map(m => ({ m, ...fit(m.r, "shotstopper", m.F) })).sort((a, b) => b.s - a.s || a.m.r.id.localeCompare(b.m.r.id));
  const half = ks.length === 1 ? (ks[0].s >= 0 ? 1 : 0) : Math.ceil(ks.length / 2);
  ks.forEach((k, i) => { const b = i < half ? "shotstopper" : "commanding";
    got.set(k.m.r.id, [{ b, text: i < half ? k.text : "fewer saves than his peers" }, ...(got.get(k.m.r.id) || [])]); });
}

// ── CHECKS: every rule the user set, on the result ──
const problems = [];
const total = {}; for (const [id, bs] of locked) for (const b of bs) total[b] = (total[b] || 0) + 1;
for (const m of men) {
  const os = got.get(m.r.id) || [], bs = os.map(o => o.b), want = m.keeper ? 1 + m.count : m.opts.length ? m.count : 0;
  for (const b of bs) total[b] = (total[b] || 0) + 1;
  if (bs.length !== want) problems.push(`${m.r.name} (${m.r.ovr}) has ${bs.length} of ${want}`);
  if (new Set(bs).size !== bs.length) problems.push(`${m.r.name} holds a trait twice`);
  if (!m.keeper && bs.some(b => !unlocked(m.r.ovr).includes(TIER[b]))) problems.push(`${m.r.name}: a tier his rating has not unlocked`);
  if (!m.keeper && m.top && bs.filter(b => TIER[b] === m.top).length > 1) problems.push(`${m.r.name}: two of his top tier`);
  for (const [a, c] of EXCL) if (bs.includes(a) && bs.includes(c)) problems.push(`${m.r.name}: ${a} with ${c}`);
}
for (const [tier, qt] of Object.entries(q)) for (const b of OUTFIELD.filter(x => TIER[x] === tier))
  if ((total[b] || 0) < qt || (total[b] || 0) > qt + 1) problems.push(`${NAME[b]} held ${total[b] || 0} times, ${qt} to ${qt + 1} wanted`);

// ── REPORT ──
const tiersOrder = ["gold", "silver", "bronze"];
console.log(`${men.length} players rated 75 or more (${keepers.length} keepers); ${slots} places in the flow, ${run.flow} filled (${full} possible)`);
for (const tier of tiersOrder) console.log(`${tier.padEnd(6)} ${OUTFIELD.filter(b => TIER[b] === tier).map(b => `${NAME[b]} ${total[b] || 0}`).join(", ")}`);
console.log(`keeper Shot Stopper ${total.shotstopper || 0}, Commanding ${total.commanding || 0}`);
for (const bd of ["75-79", "80-84", "85-89", "90+"]) {
  const ms = men.filter(m => band(m.r.ovr) === bd && !m.keeper), tops = ms.filter(m => (got.get(m.r.id) || []).some(o => TIER[o.b] === m.top)).length;
  const mix = {}; for (const m of ms) for (const o of got.get(m.r.id) || []) mix[TIER[o.b]] = (mix[TIER[o.b]] || 0) + 1;
  console.log(`${bd.padEnd(6)} ${ms.length} outfield, ${tiersOrder.filter(x => mix[x]).map(x => `${mix[x]} ${x}`).join(", ")}${bd !== "75-79" ? `; ${tops} with one of his top tier` : ""}`);
}
console.log(`top tier: ${pick.tops} of the ${MAXTOP} who could take one; q ${JSON.stringify(q)}`);
{ let nat = 0, all = 0; for (const m of men) if (!m.keeper) for (const o of got.get(m.r.id) || []) { all++; if (NATURAL[o.b]?.some(k => kindsOf(m.r).includes(k))) nat++; }
  console.log(`crossing positions: ${all - nat} of ${all} traits given (${Math.round(100 * (all - nat) / Math.max(1, all))}%)`); }
console.log(problems.length ? `PROBLEMS (${problems.length}):\n  ` + problems.slice(0, 30).join("\n  ") : "every rule holds");

const mode = ARGS.find(a => a === "write" || a === "list");
if (mode === "write") {
  if (problems.length) throw new Error("not written: the rules do not all hold");
  // A man given traits here had none to keep (or, in a redo, had them given again).
  for (const r of players) { const os = got.get(r.id); if (os) r.badges = badgeOrder(os.map(o => o.b)); }
  writeFileSync(join(ROOT, "src/data/players.json"), dumpRecords(players));
  console.log(`written: ${got.size} players' traits into src/data/players.json`);
}
if (mode === "list") {
  const NATIONAL = new Set(["AVIUM", "ARTERRA"]), idOf = (v) => (v == null ? null : typeof v === "string" ? v : v.id ?? null);
  const clubOf = new Map(); for (const tm of teams) if (!NATIONAL.has(tm.file)) for (const v of tm.squad || []) { const id = idOf(v); if (id && !clubOf.has(id)) clubOf.set(id, tm); }
  const rows = players.filter(r => got.has(r.id) || locked.has(r.id)).map(r => {
    const tm = clubOf.get(r.id), os = (got.get(r.id) || []).concat((locked.get(r.id) || []).map(b => ({ b, text: "already his" })));
    const ordered = badgeOrder(os.map(o => o.b)).map(b => os.find(o => o.b === b));
    return [tm?.nation || r.nat, tm ? (tm.group || "") : "No Club", tm ? tm.name.trim() : "", r.name, (r.pos || []).join("/"), r.ovr, ageOf(r),
      ordered.map(o => `${NAME[o.b]} (${TIER[o.b][0].toUpperCase() + TIER[o.b].slice(1)})`).join(", "), ordered.map(o => `${NAME[o.b]}: ${o.text}`).join("; ")];
  }).sort((a, b) => String(a[0]).localeCompare(b[0]) || String(a[1]).localeCompare(b[1]) || String(a[2]).localeCompare(b[2]) || b[5] - a[5]);
  const file = ARGS[ARGS.indexOf("list") + 1] || "traits.tsv";
  writeFileSync(file, ["Nation\tLeague\tClub\tPlayer\tPos\tRating\tAge\tTraits\tWhy", ...rows.map(r => r.join("\t"))].join("\n") + "\n");
  console.log(`listed ${rows.length} players in ${file}`);
}
