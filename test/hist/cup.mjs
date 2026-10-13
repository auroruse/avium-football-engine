// THE OLD SEI'I TAI SHOGUN CUPS (13 October 2026), 1888/89 to 1930/31, on the engine, played as 1931/32's was: every
// NL1 and NL2 club and every club outside both (Kyōmei among them from 1893/94), a qualifying round of the lowest-ranked
// when there are more than 32, the rest by byes to the top seeds; seeds drawn against the lower half, one match a tie,
// the weaker side at home, extra time and penalties. The cup winner took one of Nichirin's Club World Cup places, so a
// year whose entrant the league does not explain is a cup that entrant won (each of its ties replayed until it wins, which
// is the cup conditioned on its winning); in every other Club World Cup year the winner is one of the entrants. Then, of a
// few kept cups a year, one each with Spartak and Dynamo holding at most 20 of the 37.
//
//   node test/hist/cup.mjs <data.json> <plan.json> <real2.json> <out.json> [workers] [kept a year]
import { fork } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { fileURLToPath } from "node:url";
import { setupOf, hash } from "./model.mjs";

const HERE = fileURLToPath(import.meta.url);
const [df, pf, rf, out, wArg, cArg] = process.argv.slice(2);
const D = JSON.parse(readFileSync(df, "utf8")), plan = JSON.parse(readFileSync(pf, "utf8")), real = JSON.parse(readFileSync(rf, "utf8"));
const C = +cArg || 3, CAP = 20;
const SD = new Set(["Spartak Kanagawa", "Dynamo Mizuhara"]);
const shown = (c, y) => (c === "Dai-Ichi Sen'ninhara" && y <= 1892 ? "343 Kōkūtai" : c);
const ords = plan.seasons.map(s => s.y);

// Kyōmei never folded (it plays in the record's 1931/32 cup): outside both leagues from 1893/94, at the outside level from
// the moment it left (Moukden and Kirin, 13 October 2026: sinking over a few seasons as the others do, it would have
// edged Metallurg Motohora for NL2's open place in 1901/02 by 0.2, against the history as pushed).
const B0 = plan.B0;
const kyomei = () => B0;

// Who enters each cup, in rank order (NL1, NL2, outside; by rating within), and what its winner has to be.
const all = new Set([...Object.keys(D.clubs)]);
const entrantsOf = (y) => { let txt; try { txt = readFileSync(`public/avium/pstats/cwc/${y}.md`, "utf8"); } catch { return null; }
  return [...all].filter(c => new RegExp(`(^|[^\\p{L}])${c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "u").test(txt)); };
const plans = plan.seasons.map(s => {
  const y = s.y, r = (c) => (c === "Kyōmei" && y > 1893 ? kyomei() : plan.ratings[c][y]);
  const byR = (xs) => [...xs].sort((a, b) => r(b) - r(a));
  const outs = [...s.out, ...(y >= 1894 && !s.out.includes("Kyōmei") ? ["Kyōmei"] : [])];
  const field = [...byR(s.nl1), ...byR(s.nl2 || []), ...byR(outs)];
  const E1 = entrantsOf(y);
  let need = null;
  if (E1) {
    const t = real.seasons[y].nl1.table, k = E1.length, top = t.slice(0, k - 1), f = E1.filter(c => !top.includes(c));
    if (f.length !== 1) throw new Error(`${y}: the league's places are not all entrants`);
    need = t[k - 1] === f[0] ? { any: E1 } : { win: f[0] };
  }
  return { y, field, need, rating: Object.fromEntries(field.map(c => [c, Math.round(r(c) * 10) / 10])) };
});

if (process.env.CUP_CHILD) {
  const E = await import("../engine.mjs");
  const { sideOf } = await import("./side.mjs");
  globalThis.__noManagers = true;                          // the league seasons were played without managers too
  const labelToId = Object.fromEntries(Object.entries((await import("../../src/data/styles.js")).STYLE_LBL).map(([id, l]) => [l, id]));
  const [w, W] = process.env.CUP_CHILD.split("/").map(Number);
  for (let i = w; i < plans.length; i += W) {
    const P = plans[i], y = P.y;
    const side = (c) => { const cl = D.clubs[c] || { name: c, code: "KYO", style: null, formation: null }, su = setupOf(E, cl, y, labelToId);
      return sideOf(E, { name: shown(c, y), code: cl.code, skill: P.rating[c], style: su.style, formation: su.formation }); };
    const sides = new Map(P.field.map(c => [c, side(c)]));
    let n = 0;
    const play = (h, a, salt) => {
      const H = sides.get(h), A = sides.get(a), adv = H.skill < A.skill ? "home" : H.skill > A.skill ? "away" : null;
      const m = E.simPositionalMatch(new E.RNG(Math.floor(hash("cup", y, h, a, salt) * 2 ** 31) || 7), H.skill, A.skill, true, H.style, A.style,
        H.formation, A.formation, adv, H.strategy, A.strategy, H.squad, A.squad, null, null, true, { home: null, away: null }, null);
      n++;
      const hw = m.pen ? m.pen.home > m.pen.away : m.ftHome + (m.et?.home || 0) > m.ftAway + (m.et?.away || 0);
      return { home: h, away: a, ftHome: m.ftHome, ftAway: m.ftAway, et: m.et, pen: m.pen, win: hw ? h : a };
    };
    // One cup. `must` is a club whose every tie is replayed until it wins.
    const once = (salt, must) => {
      const f = P.field, N = f.length, rounds = [];
      let main = [...f];
      if (N > 32) {
        const q = f.slice(32 - (N - 32)), qs = [...q].sort((a, b) => hash("q", y, salt, a) - hash("q", y, salt, b)), ties = [];
        for (let j = 0; j < qs.length; j += 2) ties.push(tie(qs[j], qs[j + 1], salt, must));
        rounds.push({ name: "Round of 64", matches: ties });
        main = [...f.slice(0, 32 - (N - 32)), ...ties.map(t => t.win)];
      }
      let S = 2; while (S < main.length) S *= 2;
      const top = main.slice(0, S / 2), low = [...main.slice(S / 2)];
      while (low.length < S / 2) low.unshift(null);           // byes go to the top seeds
      const lows = [...low].sort((a, b) => (a === null) - (b === null) || hash("d", y, salt, a) - hash("d", y, salt, b));
      const tops = [...top].sort((a, b) => hash("t", y, salt, a) - hash("t", y, salt, b));
      // The byes fall to the best seeds: pair the strongest seeds with the empty places.
      const byes = lows.filter(x => x === null).length, seedsFirst = [...top].slice(0, byes);
      const pairs = [], restTop = tops.filter(c => !seedsFirst.includes(c)), restLow = lows.filter(x => x !== null);
      for (const c of seedsFirst) pairs.push([c, null]);
      restTop.forEach((c, j) => pairs.push([c, restLow[j]]));
      pairs.sort((a, b) => hash("b", y, salt, a[0]) - hash("b", y, salt, b[0]));
      let cur = pairs, size = S;
      while (true) {
        const name = size === 2 ? "Final" : size === 4 ? "Semi-Finals" : size === 8 ? "Quarter-Finals" : `Round of ${size}`;
        const ties = cur.map(([a, b]) => (b === null ? { bye: a, win: a } : tie(a, b, salt, must)));
        rounds.push({ name, matches: ties.filter(t => !t.bye) });
        if (size === 2) return { rounds, winner: ties[0].win };
        const next = []; for (let j = 0; j < ties.length; j += 2) next.push([ties[j].win, ties[j + 1].win]);
        cur = next; size /= 2;
      }
    };
    const tie = (a, b, salt, must) => {
      if (must !== a && must !== b) return play(a, b, salt);
      for (let r = 0; r < 400; r++) { const t = play(a, b, salt + "/" + r); if (t.win === must) return t; }
      throw new Error("never won");
    };
    const kept = [];
    for (let c = 0, tries = 0; kept.length < C && tries < 60 * C; tries++, c++) {
      try {
        const cup = once("c" + c, P.need?.win);
        if (P.need?.any && !P.need.any.includes(cup.winner)) continue;
        kept.push(cup);
      } catch { continue; }
    }
    process.send(JSON.stringify({ y, kept, matches: n }));
  }
  process.exit(0);
}

const W = Math.max(1, Math.min(+wArg || cpus().length, plans.length));
const got = {};
let live = W;
for (let w = 0; w < W; w++) {
  const c = fork(HERE, process.argv.slice(2), { env: { ...process.env, CUP_CHILD: w + "/" + W } });
  c.on("message", (m) => { const r = JSON.parse(m); got[r.y] = r; process.stderr.write(`${r.y}: ${r.kept.length} kept, ${r.matches} matches${plans.find(p => p.y === r.y).need?.win ? " (won by " + plans.find(p => p.y === r.y).need.win + ")" : ""}\n`); });
  c.on("exit", () => { if (--live === 0) finish(); });
}
function finish() {
  let rs = 20261015;
  const rnd = () => { rs = (rs + 0x6D2B79F5) >>> 0; let t = rs; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const missing = plans.filter(p => !got[p.y]?.kept?.length).map(p => p.y);
  if (missing.length) { console.error("no cup kept for " + missing.join(", ")); process.exit(2); }
  const pick = Object.fromEntries(Object.entries(got).map(([y, r]) => [y, r.kept[Math.floor(rnd() * r.kept.length)]]));
  const sd = () => Object.values(pick).filter(c => SD.has(c.winner)).length;
  let guard = 0;
  while (sd() > CAP && guard++ < 1000) {
    const c = Object.entries(pick).filter(([y, cup]) => SD.has(cup.winner) && got[y].kept.some(k => !SD.has(k.winner)));
    if (!c.length) break;
    const [y] = c[Math.floor(rnd() * c.length)], alt = got[y].kept.filter(k => !SD.has(k.winner));
    pick[y] = alt[Math.floor(rnd() * alt.length)];
  }
  const total = Object.values(got).reduce((a, r) => a + r.matches, 0);
  console.log(`cups ${Object.keys(pick).length}, ${total} matches played; Spartak+Dynamo won ${sd()} of 37 (cap ${CAP})`);
  if (sd() > CAP) { console.error("cap not met"); process.exit(3); }
  writeFileSync(out, JSON.stringify({ sd: sd(), cups: pick, need: Object.fromEntries(plans.map(p => [p.y, p.need])) }));
}
