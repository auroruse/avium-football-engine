// PLAN THE HISTORY (13 October 2026): who is in NL1, NL2 and neither every season from 1888/89, and who goes up, down
// and out, ending exactly on 1931/32's shape with Spartak and Dynamo holding at most 18 of the 37 titles re-simmed.
// Thousands of histories run side by side on the engine's stand-in (model.mjs); after each season the ones that can no
// longer reach 1931/32's shape are dropped and the rest copied up to strength again. One of those that land is the plan;
// the engine then plays each season of it (test/hist/real.mjs).
//
//   node test/hist/plan.mjs <data.json> <model.json> <out.json> [particles] [seed]
//
// The league's rules, from the record and the user's answers (13 October 2026):
//   to 1899/00  NL1 alone. Its clubs that fold (merged away) leave; as many others as the record lost that summer drop
//               out from the foot of the table; the clubs the record brought in come in, the strongest club outside
//               taking the place of one already in.
//   1900/01     NL2 starts with the ten strongest clubs outside NL1.
//   from 1901/02  three up and three down (four in 1920/21, after the war); NL2's last club leaves the league and the
//               strongest club outside takes its place. A club exists from four seasons before it first appears on
//               record (from its election, before 1900) and the merged clubs fold after their last season on record.
import { readFileSync, writeFileSync } from "node:fs";
import { ratingsOf, lambdas, hash } from "./model.mjs";

const [df, mf, out, pArg, sArg] = process.argv.slice(2);
const D = JSON.parse(readFileSync(df, "utf8")), M = JSON.parse(readFileSync(mf, "utf8"));
const P = +pArg || 20000;
let seed = (+sArg || 1) >>> 0;
const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };

const recs = JSON.parse(readFileSync("src/data/teams.json", "utf8")).filter(t => t && t.file === "NCH");
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const A = mean(recs.filter(t => t.group === "Nichirin League One").map(t => +t.ovr));
const B2 = mean(recs.filter(t => D.target.nl2.includes(t.name)).map(t => +t.ovr));
const ord = [...D.seasons, 1932, 1933];
// The tables after 1930/31 count too: a club relegated in 1931/32 carries that season's rating into NL2.
const Dx = { ...D, seasons: [...D.seasons, 1932, 1933], nl1: { ...D.nl1, 1932: D.late[1932], 1933: D.late[1933] } };
const B0 = B2 - 4;
const R = ratingsOf(Dx, M, A, B2, ord, new Set(D.target.out), B0);
const names = Object.keys(D.clubs), N = names.length, ix = new Map(names.map((n, i) => [n, i]));
const SD = new Set([ix.get("Spartak Kanagawa"), ix.get("Dynamo Mizuhara")]);
const CAP = 18;

// When each club exists.
const pos = (y) => ord.indexOf(y);
const start = names.map(n => { const f = D.clubs[n].first; return f <= 1900 ? f : ord[Math.max(0, pos(f) - 4)]; });
const fold = names.map(n => D.clubs[n].fold ?? 9999);
const exists = (c, y) => y >= start[c] && y <= fold[c];

// The stand-in's means for every pair, a season at a time, and how often it turns a decided match into a draw.
const lam = {}, conv = {};
const pois = (l, k) => { let p = Math.exp(-l); for (let i = 1; i <= k; i++) p *= l / i; return p; };
for (const y of ord) {
  const L = new Float64Array(N * N * 2), C = new Float64Array(N * N);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (i !== j) {
    const [lh, la] = lambdas(M, R[names[i]][y], R[names[j]][y]); L[(i * N + j) * 2] = lh; L[(i * N + j) * 2 + 1] = la;
    let d = 0; for (let k = 0; k < 12; k++) d += pois(lh, k) * pois(la, k);
    C[i * N + j] = Math.max(0, (M.drawK - 1) * d / (1 - d));
  }
  lam[y] = L; conv[y] = C;
}
const poisDraw = (l) => { const L = Math.exp(-l); let k = 0, p = rnd(); while (p > L) { k++; p *= rnd(); } return k; };
// A season on the stand-in: the clubs in their order on the table, best first.
function play(y, clubs) {
  const n = clubs.length, pts = new Float64Array(n), gd = new Float64Array(n), gf = new Float64Array(n), L = lam[y], C = conv[y];
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) if (a !== b) {
    const i = clubs[a], j = clubs[b], o = (i * N + j) * 2;
    let hg = poisDraw(L[o]), ag = poisDraw(L[o + 1]);
    if (hg !== ag && rnd() < C[i * N + j]) { hg = ag = Math.min(hg, ag); }
    gf[a] += hg; gf[b] += ag; gd[a] += hg - ag; gd[b] += ag - hg;
    if (hg > ag) pts[a] += 3; else if (hg < ag) pts[b] += 3; else { pts[a]++; pts[b]++; }
  }
  const k = [...Array(n).keys()].map(a => [a, rnd()]);
  k.sort((x, z) => pts[z[0]] - pts[x[0]] || gd[z[0]] - gd[x[0]] || gf[z[0]] - gf[x[0]] || x[1] - z[1]);
  return k.map(([a]) => clubs[a]);
}
const strongest = (pool, y, n) => [...pool].sort((a, b) => R[names[b]][y] - R[names[a]][y]).slice(0, n);

// ---- the target, and how far a state is from it --------------------------------------------------------------------
const T1 = new Set(D.target.nl1.map(n => ix.get(n))), T2 = new Set(D.target.nl2.map(n => ix.get(n))), T0 = new Set(D.target.out.map(n => ix.get(n)));
function needs(st) {
  let b1 = 0, b2 = 0, b4 = 0, b3 = 0, t0in = 0;
  for (const c of st.nl1) if (!T1.has(c)) b1++;
  for (const c of T1) if (!st.nl1.includes(c)) b2 = Math.max(b2, st.nl2.includes(c) ? 1 : 2);
  for (const c of st.out) if (!T0.has(c)) b3++;
  for (const c of T0) { if (st.nl1.includes(c)) { b4 = Math.max(b4, 2); t0in++; } else if (st.nl2.includes(c)) t0in++; }
  return Math.max(Math.ceil(b1 / 3), b2, b3, b4, t0in);
}

// ---- one season's step for one history ----------------------------------------------------------------------------
function step(st, y) {
  const ny = ord[pos(y) + 1];
  const t1 = play(y, st.nl1), rec = { y, nl1: st.nl1, nl2: st.nl2, out: st.out, champ1: t1[0] };
  let nl1 = t1.filter(c => fold[c] !== y), nl2 = st.nl2, outs = st.out.filter(c => fold[c] !== y);
  const born = names.map((_, c) => c).filter(c => start[c] === ny);
  // No NL2 yet: the summers to 1900/01, when it starts.
  if (!st.nl2.length) {
    const ch = D.changes[ny] || { into: [], out: [] };
    const drop = ch.out.filter(n => fold[ix.get(n)] !== y).length;
    const gone = nl1.slice(nl1.length - drop);
    nl1 = nl1.slice(0, nl1.length - drop);
    outs = [...outs, ...gone];
    const into = ch.into.map(n => ix.get(n));
    for (const c of into) {
      if (!nl1.includes(c) && (outs.includes(c) || born.includes(c))) { nl1.push(c); outs = outs.filter(x => x !== c); }
      else { const pool = outs.filter(x => !into.includes(x) && exists(x, ny)); const s = strongest(pool, ny, 1)[0]; if (s != null) { nl1.push(s); outs = outs.filter(x => x !== s); } }
    }
    outs = [...outs, ...born.filter(c => !nl1.includes(c) && !outs.includes(c))];
    rec.left = gone;
    if (ny === 1901) { nl2 = strongest(outs, ny, 10); outs = outs.filter(c => !nl2.includes(c)); }
    return { st: { nl1, nl2, out: outs }, rec };
  }
  const t2 = play(y, st.nl2);
  rec.champ2 = t2[0];
  const k = ny === 1921 ? 4 : 3;
  const f1 = st.nl1.filter(c => fold[c] === y).length, f2 = st.nl2.filter(c => fold[c] === y).length;
  const t2a = t2.filter(c => fold[c] !== y);
  const down = nl1.slice(nl1.length - k), up = t2a.slice(0, k + f1), last = t2a[t2a.length - 1];
  nl1 = [...nl1.slice(0, nl1.length - k), ...up];
  outs = [...outs, last, ...born];
  const keep = t2a.filter(c => !up.includes(c) && c !== last);
  const need = 10 - keep.length - down.length;
  const come = strongest(outs.filter(c => c !== last && exists(c, ny)), ny, need);
  nl2 = [...keep, ...down, ...come];
  outs = outs.filter(c => !come.includes(c));
  rec.down = down; rec.up = up; rec.last = last; rec.come = come;
  return { st: { nl1, nl2, out: outs }, rec };
}

// ---- the histories --------------------------------------------------------------------------------------------------
const first = { nl1: D.nl1[1889].map(r => ix.get(r.club)), nl2: [], out: [] };
let parts = Array.from({ length: P }, () => ({ st: first, sd: 0, node: null }));
const last = ord.indexOf(1931);
for (let si = 0; si <= last; si++) {
  const y = ord[si], ny = ord[si + 1], left = ord.indexOf(1932) - (si + 1);
  const next = [];
  // From 1921/22 a history replays a season that leaves it unable to reach 1931/32 (up to TRY times) rather than dying
  // at once: the clubs outside in 1931/32 have to leave NL2 one a season, and a history that must wait on chance alone
  // for that almost never lands.
  const TRY = ny >= 1922 ? 400 : 1;
  for (const p of parts) {
    for (let t = 0; t < TRY; t++) {
      const { st, rec } = step(p.st, y);
      const sd = p.sd + (SD.has(rec.champ1) ? 1 : 0);
      if (sd > CAP) continue;
      if (ny >= 1922 && needs(st) > left) continue;
      if (ny === 1932) {
        const ok = st.nl1.length === 20 && st.nl1.every(c => T1.has(c)) && st.nl2.length === 10 && st.nl2.every(c => T2.has(c)) && st.out.every(c => T0.has(c)) && st.out.length === T0.size;
        if (!ok) continue;
      }
      next.push({ st, sd, node: { rec, up: p.node } });
      break;
    }
  }
  process.stderr.write(`${y}: ${next.length}/${parts.length} survive\n`);
  if (process.env.PLAN_DEBUG && ny === 1932) for (const p of [...new Set(parts)].slice(0, 3)) {
    const st = p.st, nm = (c) => names[c] + " " + R[names[c]][1931].toFixed(1) + "/" + R[names[c]][1932].toFixed(1);
    console.error("--- state for 1930/31: NL1 not in target:", st.nl1.filter(c => !T1.has(c)).map(nm).join(", "));
    console.error("    target NL1 clubs in NL2:", [...T1].filter(c => !st.nl1.includes(c)).map(nm).join(", "));
    console.error("    target-out clubs in NL2:", [...T0].filter(c => st.nl2.includes(c)).map(nm).join(", "), "| in NL1:", [...T0].filter(c => st.nl1.includes(c)).map(nm).join(", "));
    console.error("    outside now:", st.out.map(nm).join(", "));
  }
  if (!next.length) { console.error("no history survived " + y); process.exit(2); }
  if (ny === 1932) { parts = next; break; }
  parts = Array.from({ length: P }, () => next[Math.floor(rnd() * next.length)]);
}
// One of the histories that landed.
const pick = parts[Math.floor(rnd() * parts.length)];
const seasons = [];
for (let n = pick.node; n; n = n.up) seasons.unshift(n.rec);
const nm = (c) => names[c], nms = (xs) => (xs || []).map(nm);
const plan = { A, B2, B0, cap: CAP, sd: pick.sd, distinct: new Set(parts.map(p => p.node)).size, seasons: seasons.map(r => ({
  y: r.y, nl1: nms(r.nl1), nl2: nms(r.nl2), out: nms(r.out), champ1: nm(r.champ1), champ2: r.champ2 != null ? nm(r.champ2) : null,
  left: nms(r.left), down: nms(r.down), up: nms(r.up), last: r.last != null ? nm(r.last) : null, come: nms(r.come) })),
  ratings: Object.fromEntries(names.map(n => [n, Object.fromEntries(ord.map(y => [y, Math.round(R[n][y] * 10) / 10]))])) };
writeFileSync(out, JSON.stringify(plan, null, 1));
console.log(`landed: ${parts.length} histories (${plan.distinct} distinct); picked one with Spartak+Dynamo ${pick.sd} of 37 titles (plan)`);
