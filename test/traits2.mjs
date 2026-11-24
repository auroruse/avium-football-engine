// THE TRAITS DEALT AGAIN, BY LEVEL (Moukden and Kirin, 22 November 2026). test/traits.mjs gave every man his first traits
// under the old tiers; this deals them again under levels, with the traits added since and the flaws. Asked and
// answered that day: one point at 70 to 74; everyone is dealt again, the 90s too ("90s can be changed if there's more
// fitting stuff"), each man keeping the one trait he is best known for; a flaw on about one man in five.
//
//   EVERYBODY AFRESH (the user, shown the first list, which kept each man's best-known trait: "You can reallocate all
//   traits mate"). Nothing a man carried is kept, except by the 90s he has not named (below) and under KEEP_SIG=1.
//   A FLAW for about one man in five rated 70 to 89, the men whose records point to one most, inside each rating band
//   and position; at level one, and at two the quarter of each flaw's men it fits most (nobody under 75). It gives its level back in points. Never one that
//   contradicts his signature (FLAW_EXCL), never on a 90.
//   HIS SHAPE. His points as levels (three is 3, 2+1 or 1+1+1), each band and position split evenly between the
//   shapes its men can hold, the signature taking the highest place.
//   THE REST. Every other place by one min-cost flow, as the first deal was: a trait suits his position (OPEN, either of
//   his two), a natural one is likelier, his record leans him (LEAN), the n-th man of a band and position to take a
//   trait pays more for it (SPREAD), and every trait is held by as many men as every other, the keeper's own among
//   keepers and the rest among everyone, give or take one, as high as that can go. The better he fits a trait, the
//   higher the level of his it takes.
//   PICKS. test/traits-picks.json, if it is there, is the user's own word: { "<player id or exact name>": ["vision:3",
//   ...] }. Those men are written exactly so and count in the totals.
//
//   node test/traits2.mjs                 prints what it would give
//   node test/traits2.mjs list <file>     writes the review list, club by club, as TSV
//   node test/traits2.mjs write           writes the traits into src/data/players.json
//   node test/traits2.mjs picks           writes only the men in test/traits-picks.json, as the file has them
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, statSync, mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIR = mkdtempSync(join(tmpdir(), "traits-")), ENTRY = join(DIR, "e.js"), OUT = join(DIR, "o.mjs");
writeFileSync(ENTRY, ["data/badges.js", "data/icclock.js"].map(f => `export * from ${JSON.stringify(join(ROOT, "src", f))};`).join("\n")
  + `\nexport { dumpRecords } from ${JSON.stringify(join(ROOT, "src/data/draft.js"))};\n`);
execFileSync(join(ROOT, "node_modules/.bin/esbuild"), [ENTRY, "--bundle", "--format=esm", "--platform=node", `--outfile=${OUT}`, "--log-level=error"]);
const { BADGES, BADGE_BY_ID, LEVEL_NAME, badgeOrder, icNow, yearsBetween, dumpRecords, budgetOf, traitCost, traitId, traitLv, traitKey, traitsProblem } = await import(pathToFileURL(OUT).href);

const read = (f) => JSON.parse(readFileSync(join(ROOT, "src/data", f), "utf8"));
const players = read("players.json"), teams = read("teams.json");
const NAME = Object.fromEntries(BADGES.map(b => [b.id, b.name]));

// ── WHERE A TRAIT MEANS SOMETHING ──
const KIND = { GK: "GK", CB: "CB", LB: "FB", RB: "FB", LWB: "FB", RWB: "FB", DM: "DM", CM: "CM", AM: "AM", LM: "W", RM: "W", LW: "W", RW: "W", ST: "ST" };
const ALLK = ["CB", "FB", "DM", "CM", "AM", "W", "ST"];
const kinds = (o) => Object.fromEntries(Object.entries(o).map(([b, k]) => [b, k === "ALL" ? ALLK : k.split(" ")]));
const NATURAL = kinds({
  finisher: "ST AM", interceptor: "CB DM", rapid: "ST CB FB W", aerial: "CB ST", quickstep: "ST W AM", blocker: "CB FB", strong: "ST",
  relentless: "FB DM CM AM W ST", trickster: "W AM ST", vision: "DM CM AM", incisive: "CM AM", disciplined: "CB FB DM CM",
  longshot: "CM AM ST W", firsttouch: "DM CM AM ST",
  crosser: "FB W", tikitaka: "CB DM CM", deadball: "DM CM AM ST W FB", composed: "ALL", tackler: "CB DM FB CM", longball: "CB DM CM",
  shouldercheck: "DM CM AM", passandmove: "CM AM ST", tempo: "CB DM CM", manon: "CB DM",
  pressresistant: "DM CM AM", ontherun: "W AM ST", disguise: "CM AM", drives: "CB FB DM", drawsfoul: "W AM ST",
  ridestackles: "CM AM W ST", poacher: "ST", squares: "W AM ST", closesdown: "DM CM AM W ST", lastditch: "CB FB", tightmarker: "CB FB DM",
});
const OPEN = kinds({
  finisher: "ST AM W CM", interceptor: "CB FB DM CM AM", rapid: "ALL", aerial: "ALL", quickstep: "ALL", blocker: "CB FB DM CM", strong: "ALL",
  relentless: "ALL", trickster: "FB DM CM AM W ST", vision: "ALL", incisive: "ALL", disciplined: "ALL",
  longshot: "FB DM CM AM W ST", firsttouch: "ALL",
  crosser: "FB DM CM AM W", tikitaka: "ALL", deadball: "ALL", composed: "ALL", tackler: "ALL", longball: "CB FB DM CM AM",
  shouldercheck: "ALL", passandmove: "ALL", tempo: "CB FB DM CM AM", manon: "CB FB DM CM",
  pressresistant: "ALL", ontherun: "FB CM AM W ST", disguise: "DM CM AM W ST", drives: "CB FB DM CM", drawsfoul: "CM AM W ST",
  ridestackles: "ALL", poacher: "ST AM W", squares: "CM AM W ST", closesdown: "ALL", lastditch: "CB FB DM", tightmarker: "CB FB DM CM",
});
const FLAW_AT = kinds({ ballwatcher: "CB FB DM CM", dwells: "ALL", heavytouch: "ALL", givesaway: "ALL", outoflegs: "ALL", greedy: "W AM ST", hothead: "CB FB DM CM", losesman: "CB FB DM" });
const KEEPER = ["shotstopper", "commanding", "safehands", "strongwrists", "quickrelease", "penstopper"], KEEPER_PASS = ["longball", "tikitaka", "composed"];
const KEEPER_FLAW = ["flaps", "spills"];
const OUTFIELD = Object.keys(OPEN);
for (const b in NATURAL) if (NATURAL[b].some(k => !OPEN[b].includes(k))) throw new Error(`${b}: natural somewhere it is not open`);
{ const all = new Set([...OUTFIELD, ...KEEPER, ...Object.keys(FLAW_AT), ...KEEPER_FLAW]); if (all.size !== BADGES.length || BADGES.some(b => !all.has(b.id))) throw new Error("the tables here do not cover the badge table"); }
// Two a man cannot hold together; and the flaw that would contradict a trait.
const EXCL = [["shotstopper", "commanding"], ["tackler", "disciplined"], ["tikitaka", "longball"], ["passandmove", "tempo"]];
const FLAW_EXCL = { ballwatcher: ["shouldercheck", "vision", "interceptor", "tightmarker", "manon"], dwells: ["composed", "pressresistant", "passandmove", "firsttouch", "ridestackles"],
  heavytouch: ["firsttouch", "trickster", "tikitaka", "pressresistant"], givesaway: ["tikitaka", "incisive", "longball", "vision", "disguise", "passandmove"], outoflegs: ["relentless", "closesdown", "rapid", "quickstep"],
  greedy: ["squares", "vision"], hothead: ["disciplined", "composed"], losesman: ["tightmarker", "interceptor", "shouldercheck"], flaps: ["commanding"], spills: ["safehands"] };

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

// What in his record points to each trait, or to each flaw: weights on his figures against his peers, and on his age.
const LEAN = {
  finisher: { G: 1.0 }, longshot: { G: 0.7, RTG: 0.2 }, aerial: { G: 0.5 }, strong: { G: 0.3, age: 0.1 }, rapid: { G: 0.2, age: -0.4 },
  quickstep: { CC: 0.3, age: -0.4 }, trickster: { CC: 0.8, G: 0.2, age: -0.2 }, crosser: { A: 0.8, CC: 0.4 }, incisive: { A: 0.7, CC: 0.6 },
  vision: { CC: 0.6, A: 0.3, RTG: 0.3, age: 0.2 }, deadball: { A: 0.4, G: 0.3, age: 0.2 }, firsttouch: { RTG: 0.4, CC: 0.2 },
  tikitaka: { RTG: 0.4, CC: 0.2 }, longball: { A: 0.3, age: 0.3 }, composed: { RTG: 0.5, age: 0.4 }, interceptor: { DC: 1.0 },
  tackler: { DC: 0.8, age: -0.2 }, blocker: { DC: 0.8 }, relentless: { DC: 0.8, age: -0.4 }, disciplined: { RTG: 0.5, DC: -0.3, age: 0.3 },
  shouldercheck: { RTG: 0.4, CC: 0.2, age: 0.2 }, passandmove: { CC: 0.4, A: 0.3 }, tempo: { RTG: 0.4, age: 0.4 }, manon: { age: 0.6, RTG: 0.2 },
  pressresistant: { RTG: 0.5, CC: 0.2 }, ontherun: { G: 0.5, A: 0.2, age: -0.2 }, disguise: { A: 0.7, CC: 0.5 }, drives: { CC: 0.4, age: -0.3 },
  drawsfoul: { CC: 0.5, G: 0.2, age: -0.2 }, ridestackles: { RTG: 0.3, age: 0.2 }, poacher: { G: 1.0 }, squares: { A: 0.9 },
  closesdown: { DC: 0.8, age: -0.3 }, lastditch: { DC: 0.8 }, tightmarker: { DC: 0.6, RTG: 0.3 },
  shotstopper: { SV: 1.0 }, safehands: { SV: 0.6, age: 0.2 }, strongwrists: { SV: 0.8 }, commanding: { SV: -0.5, age: -0.2 }, quickrelease: { SV: -0.3, age: -0.3 }, penstopper: { age: 0.2 },
  ballwatcher: { DC: -0.6, RTG: -0.4 }, dwells: { CC: -0.5, RTG: -0.3, age: 0.2 }, heavytouch: { RTG: -0.6, CC: -0.3 }, givesaway: { A: -0.5, RTG: -0.4 },
  outoflegs: { age: 0.9, RTG: -0.2 }, greedy: { G: 0.5, A: -0.8 }, hothead: { DC: 0.3, RTG: -0.5, age: -0.3 }, losesman: { DC: -0.7, RTG: -0.3 },
  flaps: { SV: -0.5 }, spills: { SV: -0.8 },
};
const LEAN_BY_KIND = { aerial: { CB: { G: 1.0 } } };
const NATURAL_LEAN = +(process.env.NATURAL_LEAN || 1.0);
function u01(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d) >>> 0; h ^= h >>> 12; h = Math.imul(h, 0x297a2d39) >>> 0; h ^= h >>> 15; return (h >>> 0) / 4294967296; }
const LABEL = { G: "goals", A: "assists", CC: "chances created", DC: "defensive actions", RTG: "average rating", SV: "saves" };
const PEERS = { CB: "centre-backs", FB: "full-backs", DM: "holding midfielders", CM: "central midfielders", AM: "attacking midfielders", W: "wingers", ST: "strikers", GK: "keepers" };
// His fit for a trait (or how much his record points to a flaw), and the thing that most decided it, in words.
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

// ── EVERY MAN: his signature, his flaw, his shape ──
const isKeeper = (r) => (r.pos || []).includes("GK");
const band = (o) => (o >= 90 ? "90+" : o >= 85 ? "85-89" : o >= 80 ? "80-84" : o >= 75 ? "75-79" : "70-74");
const BANDS = ["70-74", "75-79", "80-84", "85-89", "90+"];
const PICKS = existsSync(join(ROOT, "test/traits-picks.json")) ? JSON.parse(readFileSync(join(ROOT, "test/traits-picks.json"), "utf8")) : {};
const pickOf = (r) => PICKS[r.id] || PICKS[r.name] || null;
const men = [], fixed = new Map();
for (const r of players) {
  if (!(r.ovr >= 70) || r.retired) continue;
  const pk = pickOf(r); if (pk) { fixed.set(r.id, pk); continue; }
  if (!kindsOf(r).length) continue;
  const F = figures(r), keeper = isKeeper(r), ks = kindsOf(r);
  const pool = keeper ? [...KEEPER, ...KEEPER_PASS] : OUTFIELD.filter(b => OPEN[b].some(k => ks.includes(k)));
  const opts = pool.map(b => ({ b, ...fit(r, b, F) }));
  // his signature: of what he carries and may still carry, the highest level, then the best fit
  const have = (r.badges || []).filter(k => BADGE_BY_ID[traitId(k)] && !BADGE_BY_ID[traitId(k)].flaw && pool.includes(traitId(k)))
    .map(k => ({ b: traitId(k), lv: traitLv(k), s: opts.find(o => o.b === traitId(k)).s })).sort((x, y) => y.lv - x.lv || y.s - x.s);
  // (KEEP_SIG=1 keeps every man's signature, as the deal was first proposed. The user, shown that list: "You can
  // reallocate all traits mate". So by default only the 90s he has not named keep what they were given by hand.)
  men.push({ r, F, keeper, ks, opts, sig: (process.env.KEEP_SIG || r.ovr >= 90) ? have[0] || null : null, grp: band(r.ovr) + " " + (keeper ? "GK" : ks[0]), flaw: null, flawLv: 0 });
}
// A FLAW, for the men whose records point to one most: one in five of each band and position under 90.
const FLAW_SHARE = +(process.env.FLAW_SHARE || 0.2), flawCount = {};
{ const groups = new Map(); for (const m of men) if (m.r.ovr < 90) groups.set(m.grp, [...(groups.get(m.grp) || []), m]);
  const chosen = [];
  for (const ms of groups.values()) {
    for (const m of ms) { const pool = m.keeper ? KEEPER_FLAW : Object.keys(FLAW_AT).filter(b => FLAW_AT[b].some(k => m.ks.includes(k)));
      m.fopts = pool.filter(b => !(m.sig && (FLAW_EXCL[b] || []).includes(m.sig.b))).map(b => ({ b, ...fit(m.r, b, m.F) })).sort((x, y) => y.s - x.s);
      m.fs = m.fopts.length ? m.fopts[0].s : -Infinity; }
    const order = ms.filter(m => Number.isFinite(m.fs)).sort((a, b) => b.fs - a.fs || a.r.id.localeCompare(b.r.id)), n = Math.round(ms.length * FLAW_SHARE);
    order.slice(0, n).forEach((m) => { m.flawLv = 1; chosen.push(m); });
  }
  // which flaw: his best fit, less a price that rises with how many already carry it, so the flaws spread
  const fair = Math.max(1, chosen.filter(m => !m.keeper).length / Object.keys(FLAW_AT).length);
  for (const m of chosen.sort((a, b) => b.fs - a.fs || a.r.id.localeCompare(b.r.id))) {
    const best = m.fopts.map(o => ({ ...o, v: o.s - (m.keeper ? 0.9 * (flawCount[o.b] || 0) / Math.max(1, chosen.filter(x => x.keeper).length / 2) : 2.0 * (flawCount[o.b] || 0) / fair) })).sort((x, y) => y.v - x.v)[0];
    m.flaw = best; flawCount[best.b] = (flawCount[best.b] || 0) + 1; }
  // at level two: the quarter of each flaw's men whose records point to it most, and nobody rated under 75
  for (const b of Object.keys(flawCount)) { const ms = chosen.filter(m => m.flaw.b === b && m.r.ovr >= 75).sort((x, y) => y.flaw.s - x.flaw.s || x.r.id.localeCompare(y.r.id));
    ms.slice(0, Math.round(ms.length / 4)).forEach(m => (m.flawLv = 2)); }
}
// HIS SHAPE: his points as levels, highest first. The signature takes the first place and is never lower than he has it.
const partitions = (n, max = 3) => { const out = []; const go = (left, cap, acc) => { if (!left) { out.push(acc); return; } for (let k = Math.min(cap, left); k >= 1; k--) go(left - k, k, [...acc, k]); }; go(n, max, []); return out; };
for (const m of men) { m.B = budgetOf(m.r.ovr) + m.flawLv;
  const excl = new Set(m.flaw ? FLAW_EXCL[m.flaw.b] || [] : []); m.opts = m.opts.filter(o => !excl.has(o.b));
  if (m.sig && excl.has(m.sig.b)) m.sig = null;
  const free = m.opts.filter(o => !m.sig || o.b !== m.sig.b).length;
  m.shapes = partitions(m.B).filter(p => p.length <= 6 && (!m.sig || p[0] >= Math.min(m.sig.lv, 3, m.B)) && p.length - (m.sig ? 1 : 0) <= free); }
{ const groups = new Map(); for (const m of men) groups.set(m.grp + " " + m.B, [...(groups.get(m.grp + " " + m.B) || []), m]);
  for (const ms of groups.values()) { const used = new Map();
    for (const m of ms.sort((a, b) => u01(a.r.id + "shape") - u01(b.r.id + "shape"))) {
      const sh = m.shapes.slice().sort((x, y) => (used.get(x.join()) || 0) - (used.get(y.join()) || 0) || u01(m.r.id + x.join()) - u01(m.r.id + y.join()))[0] || [];
      m.shape = sh; used.set(sh.join(), (used.get(sh.join()) || 0) + 1); m.need = sh.length - (m.sig ? 1 : 0); m.opts = m.opts.filter(o => !m.sig || o.b !== m.sig.b);
      // a pair he cannot hold with his signature
      for (const [a, c] of EXCL) if (m.sig && (m.sig.b === a || m.sig.b === c)) m.opts = m.opts.filter(o => o.b !== (m.sig.b === a ? c : a)); } } }

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
// THE 90s ARE THE USER'S OWN PICKS ("90s can be changed if there's more fitting stuff"): each is dealt by himself, outside
// the flow and its equal counts. After his signature, every trait that suits him is ranked by how well it fits, one he
// already carries counting KEEP more; he takes them in that order until his points are spent, a trait he had at the
// level he had it, a new one at bronze or, where his record points to it strongly, silver. So what he was given by
// hand stays unless something fits him clearly better.
const KEEP = +(process.env.KEEP || 1.5);
for (const m of men) { if (m.r.ovr < 90) continue;
  const had = new Map((m.r.badges || []).map(k => [traitId(k), traitLv(k)])), keys = [], notes = [];
  let left = m.B;
  if (m.sig) { keys.push(traitKey(m.sig.b, m.sig.lv)); notes.push(`${NAME[m.sig.b]}: already his`); left -= m.sig.lv; }
  const ranked = m.opts.map(o => ({ ...o, v: o.s + (had.has(o.b) ? KEEP : 0) })).sort((x, y) => y.v - x.v);
  for (const o of ranked) { if (left < 1) break;
    if (EXCL.some(([a, c]) => (o.b === a && keys.some(k => traitId(k) === c)) || (o.b === c && keys.some(k => traitId(k) === a)))) continue;
    const L = Math.min(left, had.get(o.b) ?? (o.s > 1.6 ? 2 : 1)); keys.push(traitKey(o.b, L)); left -= L;
    notes.push(`${NAME[o.b]}: ${had.has(o.b) ? "already his" : o.text}`); }
  m.direct = { keys, notes }; m.need = 0; m.shape = keys.map(k => traitLv(k)).sort((x, y) => y - x); }
const BIG = 1e7, PTS = 100, SPREAD = +(process.env.SPREAD || 150);
// The traits in two lots, each held evenly inside itself: the keeper's own among keepers, the rest among everyone.
const LOT = Object.fromEntries([...OUTFIELD.map(b => [b, "all"]), ...KEEPER.map(b => [b, "keeper"])]), LOTS = ["keeper", "all"], TRAITS = Object.keys(LOT);
const have = {}; for (const m of men) { if (m.direct) { for (const k of m.direct.keys) have[traitId(k)] = (have[traitId(k)] || 0) + 1; } else if (m.sig) have[m.sig.b] = (have[m.sig.b] || 0) + 1; }
for (const ks of fixed.values()) for (const k of ks) if (LOT[traitId(k)]) have[traitId(k)] = (have[traitId(k)] || 0) + 1;
const GROUP = new Map();
for (const m of men) { if (!m.need) continue; let x = GROUP.get(m.grp); if (!x) GROUP.set(m.grp, x = { slots: 0, traits: new Set() }); x.slots += m.need; for (const o of m.opts) x.traits.add(o.b); }
function build(q, priced) {
  const g = new Graph(), s = g.node(), t = g.node(), tn = Object.fromEntries(TRAITS.map(b => [b, g.node()])), uses = [], via = new Map();
  const gt = (grp, b) => { const k = grp + "|" + b; let x = via.get(k); if (!x) via.set(k, x = { node: g.node(), grp, b, n: 0 }); x.n++; return x.node; };
  for (const m of men) {
    if (!m.need) continue;
    const u = g.node(); g.edge(s, u, m.need);
    const pairOf = new Map();
    for (const [a, c] of EXCL) if (m.opts.some(o => o.b === a) && m.opts.some(o => o.b === c)) { const p = g.node(); g.edge(u, p, 1); pairOf.set(a, p); pairOf.set(c, p); }
    for (const o of m.opts) uses.push([m, o, g.edge(pairOf.get(o.b) ?? u, gt(m.grp, o.b), 1, priced ? -Math.round(o.s * PTS) : 0)]);
  }
  for (const x of via.values()) { const G = GROUP.get(x.grp), fair = Math.max(1, G.slots / G.traits.size);
    for (let j = 0; j < x.n; j++) g.edge(x.node, tn[x.b], 1, priced ? Math.round(SPREAD * j / fair) : 0); }
  const lo = {}, hi = {};
  for (const b of TRAITS) { const qb = q[LOT[b]] ?? 0, h = have[b] || 0;
    lo[b] = g.edge(tn[b], t, Math.max(0, qb - h), priced ? -BIG : 0); hi[b] = g.edge(tn[b], t, Math.max(0, qb + 1 - Math.max(h, qb)), 0); }
  return { g, s, t, uses, lo, hi };
}
function check(q) {
  const { g, s, t, lo, hi } = build(q, false);
  const need = TRAITS.reduce((a, b) => a + g.cap[lo[b]], 0);
  const saved = TRAITS.map(b => g.cap[hi[b]]); TRAITS.forEach(b => (g.cap[hi[b]] = 0));
  const first = g.maxflow(s, t); if (first < need) return { ok: false };
  TRAITS.forEach((b, i) => (g.cap[hi[b]] = saved[i]));
  return { ok: true, fill: first + g.maxflow(s, t) };
}
const best = (lot, base) => { let lo = 0, hi = 2000; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (check({ ...base, [lot]: m }).ok) lo = m; else hi = m - 1; } return lo; };
const q = { keeper: 0, all: 0 };
for (const l of LOTS) q[l] = best(l, q);
const slots = men.reduce((a, m) => a + m.need, 0), full = check(q).fill;
const { g, s, t, uses } = build(q, true), run = g.mincost(s, t);

// ── WHAT EACH MAN GOT: his signature at the highest place of his shape, the rest by how well each fits ──
const got = new Map();
for (const [m, o, e] of uses) if (g.cap[e] === 0) got.set(m.r.id, [...(got.get(m.r.id) || []), o]);
const result = new Map(), why = new Map(), problems = [], total = {}, levels = {};
for (const m of men) {
  const picks = (got.get(m.r.id) || []).sort((x, y) => y.s - x.s), lv = m.shape.slice(), keys = m.direct ? m.direct.keys.slice() : [], notes = m.direct ? m.direct.notes.slice() : [];
  if (!m.direct && m.sig) { const L = lv.shift(); keys.push(traitKey(m.sig.b, L)); notes.push(`${NAME[m.sig.b]}: already his${L !== m.sig.lv ? ` (was ${LEVEL_NAME[m.sig.lv]})` : ""}`); }
  if (!m.direct) for (const o of picks) { const L = lv.shift(); if (!L) break; keys.push(traitKey(o.b, L)); notes.push(`${NAME[o.b]}: ${o.text}`); }
  if (m.flaw) { keys.push(traitKey(m.flaw.b, m.flawLv)); notes.push(`${NAME[m.flaw.b]} (flaw): ${m.flaw.text}`); }
  const out = badgeOrder(keys); result.set(m.r.id, out); why.set(m.r.id, notes);
  const bad = traitsProblem(out, m.r.ovr); if (bad) problems.push(`${m.r.name} (${m.r.ovr}): ${bad}`);
  if (traitCost(out) !== budgetOf(m.r.ovr)) problems.push(`${m.r.name} (${m.r.ovr}): ${traitCost(out)} points of ${budgetOf(m.r.ovr)}`);
  for (const [a, c] of EXCL) if (out.some(k => traitId(k) === a) && out.some(k => traitId(k) === c)) problems.push(`${m.r.name}: ${a} with ${c}`);
  if (m.keeper && out.some(k => !KEEPER.includes(traitId(k)) && !KEEPER_PASS.includes(traitId(k)) && !KEEPER_FLAW.includes(traitId(k)))) problems.push(`${m.r.name}: a keeper with an outfielder's trait`);
}
for (const [id, ks] of fixed) { result.set(id, badgeOrder(ks)); why.set(id, ["the user's pick"]); }
for (const ks of result.values()) for (const k of ks) { total[traitId(k)] = (total[traitId(k)] || 0) + 1; const L = traitLv(k); (levels[traitId(k)] = levels[traitId(k)] || [0, 0, 0, 0])[L]++; }
for (const b of TRAITS) { const qb = q[LOT[b]], h = have[b] || 0; if ((total[b] || 0) < Math.min(qb, Math.max(qb, h)) && (total[b] || 0) < qb) problems.push(`${NAME[b]} held ${total[b] || 0} times, ${qb} wanted`); }

// ── REPORT ──
const was = new Map(players.map(r => [r.id, badgeOrder((r.badges || []).filter(k => BADGE_BY_ID[traitId(k)]))]));
const changed = [...result].filter(([id, ks]) => ks.join() !== (was.get(id) || []).join()).length;
console.log(`${men.length} players rated 70 or more dealt (${men.filter(m => m.keeper).length} keepers), ${fixed.size} as the user picked; ${slots} places after the signatures, ${run.flow} filled (${full} possible)`);
console.log(`each of the keeper's own traits held ${q.keeper} to ${q.keeper + 1} times, each other trait ${q.all} to ${q.all + 1} (a trait already kept more often than that as a signature gets no more)`);
for (const fam of ["Mind", "Ball", "Body", "Finishing", "Defending", "Keeper"])
  console.log(`${fam.padEnd(10)} ${BADGES.filter(b => b.fam === fam && !b.flaw).map(b => `${b.name} ${total[b.id] || 0} (${(levels[b.id] || [0, 0, 0, 0]).slice(1).join("/")})`).join(", ")}`);
console.log(`flaws      ${BADGES.filter(b => b.flaw).map(b => `${b.name} ${total[b.id] || 0} (${(levels[b.id] || [0, 0, 0]).slice(1, 3).join("/")})`).join(", ")}`);
for (const bd of BANDS) { const ms = men.filter(m => band(m.r.ovr) === bd), by = {}; for (const m of ms) by[m.shape.join("+") || "none"] = (by[m.shape.join("+") || "none"] || 0) + 1;
  console.log(`${bd.padEnd(6)} ${ms.length} men, budget ${budgetOf(ms[0]?.r.ovr || 0)}, ${ms.filter(m => m.flaw).length} with a flaw; shapes ${Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n} x ${k}`).join(", ")}`); }
console.log(`kept his signature: ${men.filter(m => m.sig).length}; lost a trait he had: ${men.filter(m => (m.r.badges || []).some(k => !result.get(m.r.id).some(x => traitId(x) === traitId(k)))).length}; changed in all: ${changed}; unchanged: ${result.size - changed}`);
{ let nat = 0, all = 0; for (const m of men) if (!m.keeper) for (const o of got.get(m.r.id) || []) { all++; if (NATURAL[o.b]?.some(k => m.ks.includes(k))) nat++; }
  console.log(`crossing positions: ${all - nat} of ${all} traits newly given (${Math.round(100 * (all - nat) / Math.max(1, all))}%)`); }
console.log(problems.length ? `PROBLEMS (${problems.length}):\n  ` + problems.slice(0, 30).join("\n  ") : "every rule holds");

const ARGS = process.argv.slice(2), mode = ARGS.find(a => a === "write" || a === "list" || a === "picks");
// ONLY THE PICKS: the named men written as the file has them and nobody else touched. Dealing everyone again for one
// new pick moves seventy others a place each, the even spread closing round the man taken out of it.
if (mode === "picks") {
  let n = 0; for (const r of players) { const ks = fixed.get(r.id); if (ks && badgeOrder(ks).join() !== (r.badges || []).join()) { r.badges = badgeOrder(ks); n++; } }
  writeFileSync(join(ROOT, "src/data/players.json"), dumpRecords(players));
  console.log(`written: ${n} picked players changed, nobody else touched`);
}
const show = (ks) => ks.map(k => `${NAME[traitId(k)]} ${BADGE_BY_ID[traitId(k)].flaw ? "(Flaw " + traitLv(k) + ")" : "(" + LEVEL_NAME[traitLv(k)] + ")"}`).join(", ");
if (mode === "write") {
  if (problems.length) throw new Error("not written: the rules do not all hold");
  for (const r of players) { const ks = result.get(r.id); if (ks) { if (ks.length) r.badges = ks; else delete r.badges; } }
  writeFileSync(join(ROOT, "src/data/players.json"), dumpRecords(players));
  console.log(`written: ${result.size} players' traits into src/data/players.json`);
}
if (mode === "list") {
  const NATIONAL = new Set(["AVIUM", "ARTERRA"]), idOf = (v) => (v == null ? null : typeof v === "string" ? v : v.id ?? null);
  const clubOf = new Map(); for (const tm of teams) if (!NATIONAL.has(tm.file)) for (const v of tm.squad || []) { const id = idOf(v); if (id && !clubOf.has(id)) clubOf.set(id, tm); }
  const rows = players.filter(r => result.has(r.id)).map(r => { const tm = clubOf.get(r.id), ks = result.get(r.id), old = was.get(r.id) || [];
    return [tm?.nation || r.nat, tm ? (tm.group || "") : "No Club", tm ? tm.name.trim() : "", r.name, (r.pos || []).join("/"), r.ovr, ageOf(r), show(old) || "None", show(ks) || "None",
      ks.join() === old.join() ? "" : "changed", (why.get(r.id) || []).join("; ")]; })
    .sort((a, b) => String(a[0]).localeCompare(b[0]) || String(a[1]).localeCompare(b[1]) || String(a[2]).localeCompare(b[2]) || b[5] - a[5]);
  const file = ARGS[ARGS.indexOf("list") + 1] || "traits.tsv";
  writeFileSync(file, ["Nation\tLeague\tClub\tPlayer\tPos\tRating\tAge\tBefore\tAfter\tChanged\tWhy", ...rows.map(r => r.join("\t"))].join("\n") + "\n");
  console.log(`listed ${rows.length} players in ${file}`);
}
