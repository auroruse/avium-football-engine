// PLAN THE ALEMANNIAN HISTORY (13 October 2026): who is in the Oberliga and who in the 2. Liga every season from
// 1899/1900 to 1932/33, landing on the Oberliga's eighteen of 1933/34 and the 2. Liga's eighteen of 1934/35. Thousands
// of histories run side by side on the engine's stand-in (../model.mjs); a season that breaks a rule is replayed (up to
// TRY times) and a history that cannot be saved is dropped, the rest copied up to strength again. One that lands is the
// plan; the engine then plays each season of it (real.mjs).
//
//   node test/hist/ale/plan.mjs <data.json> <model.json> <out.json> [particles] [seed]
//
// The rules (Moukden and Kirin, 13 October 2026):
//   - The Oberliga's founding fifteen are the record's; the 2. Liga is every other Alemannian club in being (17, then
//     18). A club with a year in its name is founded that season and starts in the 2. Liga.
//   - Three down and three up every summer. In the three summers the Oberliga grew (to 16, 17, 18) its new place went
//     straight to the club founded that year, as the record has it (Fortuna Hammersburg 01 played the 1901 Club World
//     Cup in its first season). Nobody moves in the summer of 1934, so 1932/33's moves land on 1933/34's eighteen.
//   - Every year the Club World Cup's Alemannian entrants finish in the Oberliga's qualifying places, in any order.
//   - Arminia Berelstein wins at most 12 of the 27 Oberliga titles re-simmed (14 of 29 with 1933/34 and 1934/35), spread
//     over the years rather than spent early.
// Ratings: an Oberliga club's each season is fitted from the table on record (they all played every season from their
// founding); a 2. Liga club has no table on record, so it plays at its rating today, wandering a little from season to
// season. Those are the sides the engine plays. With PLAN_EFF=<eff.json> (eff.mjs) the stand-in plans on each side's
// strength as the engine played it instead, its style and shape priced in; the sides themselves stay as they were.
import { readFileSync, writeFileSync } from "node:fs";
import { fitTable, lambdas, hash } from "../model.mjs";

const [df, mf, out, pArg, sArg] = process.argv.slice(2);
const D = JSON.parse(readFileSync(df, "utf8")), M = JSON.parse(readFileSync(mf, "utf8"));
const P = +pArg || 4000;
let seed = (+sArg || 1) >>> 0;
const rnd = () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

const names = Object.keys(D.clubs), N = names.length, ix = new Map(names.map((n, i) => [n, i]));
const ord = D.seasons, last = ord.length - 1;
const nextY = (y) => (y === ord[last] ? 1934 : ord[ord.indexOf(y) + 1]);
const A = mean(D.target.ao.map(c => D.clubs[c].ovr));

// ---- ratings ----------------------------------------------------------------------------------------------------
const R = Object.fromEntries(names.map(n => [n, {}]));
for (const y of [...ord, 1934, 1935]) { const s = fitTable(M, D.ao[y], A); D.ao[y].forEach((r, i) => { R[r.club][y] = s[i]; }); }
// A 2. Liga club's wander: a quarter of last season's step kept, a step of about one point a season, about its
// rating today; drawn once per club from its name.
const gauss = (...k) => { const u = Math.max(1e-12, hash("u", ...k)), v = hash("v", ...k); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
for (const n of names) {
  if (Object.keys(R[n]).length) continue;
  let w = 0;
  for (const y of [...ord, 1934]) { w = 0.8 * w + gauss(n, y); R[n][y] = D.clubs[n].ovr + w; }
}
for (const n of names) for (const y of [...ord, 1934]) if (R[n][y] == null && y >= D.clubs[n].start) throw new Error(`${n} has no rating for ${y}`);
const EFF = process.env.PLAN_EFF ? JSON.parse(readFileSync(process.env.PLAN_EFF, "utf8")) : null;
const RS = EFF ? Object.fromEntries(names.map(n => [n, Object.fromEntries(Object.keys(R[n]).map(y => [y, EFF[n]?.[y] ?? R[n][y]]))])) : R;

// ---- the stand-in -------------------------------------------------------------------------------------------------
const lam = {}, conv = {};
const pois = (l, k) => { let p = Math.exp(-l); for (let i = 1; i <= k; i++) p *= l / i; return p; };
for (const y of [...ord, 1934]) {
  const L = new Float64Array(N * N * 2), C = new Float64Array(N * N);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (i !== j && RS[names[i]][y] != null && RS[names[j]][y] != null) {
    const [lh, la] = lambdas(M, RS[names[i]][y], RS[names[j]][y]); L[(i * N + j) * 2] = lh; L[(i * N + j) * 2 + 1] = la;
    let d = 0; for (let k = 0; k < 12; k++) d += pois(lh, k) * pois(la, k);
    C[i * N + j] = Math.max(0, (M.drawK - 1) * d / (1 - d));
  }
  lam[y] = L; conv[y] = C;
}
const poisDraw = (l) => { const L = Math.exp(-l); let k = 0, p = rnd(); while (p > L) { k++; p *= rnd(); } return k; };
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

// ---- the rules ----------------------------------------------------------------------------------------------------
const T1 = new Set(D.target.ao.map(n => ix.get(n))), T2 = new Set(D.target.l2.map(n => ix.get(n)));
const ARM = ix.get("Arminia Berelstein"), CAP = 12;
const born = (y) => names.map((_, c) => c).filter(c => D.clubs[names[c]].start === y && y > ord[0]);
const cwcSet = (y) => (D.cwc[y] || []).map(n => ix.get(n));
const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x));
// Arminia's titles so far may run at most two ahead of an even share of the cap.
const allowed = (i) => Math.min(CAP, Math.ceil(CAP * (i + 1) / ord.length) + 2);
// How far a state is from the landing: Oberliga clubs of today still in the 2. Liga, and 2. Liga clubs of today in the
// Oberliga. The last season must hold exactly three of each, the three to go down and the three to come up.
const wrongOf = (st) => [st.ao.filter(c => !T1.has(c)).length, [...T1].filter(c => !st.ao.includes(c)).length];

function step(st, y) {
  const ny = nextY(y), t1 = play(y, st.ao), t2 = play(y, st.l2);
  const nb = born(ny), into = nb.filter(c => D.ao[ny]?.some(r => r.club === names[c])), rest = nb.filter(c => !into.includes(c));
  const down = t1.slice(t1.length - 3), up = t2.slice(0, 3);
  const ao = [...t1.slice(0, t1.length - 3), ...up, ...into], l2 = [...t2.slice(3), ...down, ...rest];
  if (ny !== 1934 && ao.length !== D.size[ny]) throw new Error(`${ny}: the Oberliga would have ${ao.length} clubs, not ${D.size[ny]}`);
  return { st: { ao, l2 }, rec: { y, ao: st.ao, l2: st.l2, t1, t2, champ: t1[0], champ2: t2[0], down, up, into, born: rest } };
}

// ---- the histories ------------------------------------------------------------------------------------------------
const first = { ao: D.ao[ord[0]].map(r => ix.get(r.club)) };
first.l2 = names.map((_, c) => c).filter(c => !first.ao.includes(c) && D.clubs[names[c]].start <= ord[0]);
let parts = Array.from({ length: P }, () => ({ st: first, arm: 0, node: null }));
const TRY = 400;
let tried = 0;
for (let si = 0; si <= last; si++) {
  const y = ord[si], ny = nextY(y), left = last - si;   // seasons still to play after this one
  const E = cwcSet(y), En = ny <= ord[last] ? cwcSet(ny) : [];
  const next = [];
  for (const p of parts) {
    for (let t = 0; t < TRY; t++) {
      tried++;
      const { st, rec } = step(p.st, y);
      if (E.length && !sameSet(rec.t1.slice(0, E.length), E)) continue;
      const arm = p.arm + (rec.champ === ARM ? 1 : 0);
      if (arm > allowed(si)) continue;
      if (En.some(c => !st.ao.includes(c))) continue;
      const [w, m] = wrongOf(st);
      if (left === 1 && !(w === 3 && m === 3)) continue;
      if (left === 0 && !(sameSet(st.ao, [...T1]) && sameSet(st.l2, [...T2]))) continue;
      if (left > 1 && (Math.abs(w - 3) > 3 * (left - 1) || Math.abs(m - 3) > 3 * (left - 1))) continue;
      next.push({ st, arm, node: { rec, up: p.node } });
      break;
    }
  }
  process.stderr.write(`${y}: ${next.length}/${parts.length} survive\n`);
  if (!next.length) { console.error("no history survived " + y); process.exit(2); }
  if (si === last) { parts = next; break; }
  parts = Array.from({ length: P }, () => next[Math.floor(rnd() * next.length)]);
}
const pick = parts[Math.floor(rnd() * parts.length)];
const recs = [];
for (let n = pick.node; n; n = n.up) recs.unshift(n.rec);
const nm = (c) => names[c], nms = (xs) => (xs || []).map(nm);
const plan = { A, cap: CAP, arm: pick.arm, distinct: new Set(parts.map(p => p.node)).size, tried, eff: !!EFF,
  seasons: recs.map(r => ({ y: r.y, ao: nms(r.ao), l2: nms(r.l2), champ: nm(r.champ), champ2: nm(r.champ2), down: nms(r.down), up: nms(r.up), into: nms(r.into), born: nms(r.born) })),
  held: { y: 1934, l2: D.target.l2 },
  ratings: Object.fromEntries(names.map(n => [n, Object.fromEntries(Object.entries(R[n]).map(([y, v]) => [y, Math.round(v * 10) / 10]))])) };
writeFileSync(out, JSON.stringify(plan, null, 1));
console.log(`landed: ${parts.length} histories (${plan.distinct} distinct), ${tried} seasons tried; picked one with Arminia ${pick.arm} of 27 titles`);
