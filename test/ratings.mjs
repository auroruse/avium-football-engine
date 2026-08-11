// IS A MATCH RATING SAYING ANYTHING?
//
// Every other number in this engine is checked against something true -- a real completion rate, a
// real xG per possession, a measured noise floor. A rating has no ground truth: there is no correct
// 7.2, and no amount of sampling will produce one. So it cannot be tested for accuracy, and testing
// it for plausibility is how a rating model quietly becomes a random number in a nice range.
//
// Two things CAN be tested, and they are the two ways the model actually fails.
//
//   DISCRIMINATION. If almost everybody finishes on 6.5 the rating is decoration -- it has a scale
//   but no opinion. The tells are the standard deviation and the share of players the match never
//   touched at all.
//
//   BIAS. Ratings are not display-only here: the substitution logic weights a man's chance of being
//   hooked by exp2((teamAvg - his rating) * 0.5), so if strikers systematically outrate centre-backs
//   then defenders get taken off all season for playing their position. The position means have to
//   sit on top of each other, and the gap between the best and worst-rated position is the number
//   that says whether they do.
//
//   node test/ratings.mjs
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meAdded,
        ME_MATCH_TICKS, ME_SIDES, STRAT_DEF } = eng;

const sq = (o, f) => buildSquad(f, null).map((p, i) => ({ ...p, name: p.pos + i, ovr: o,
  stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, offTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0},
  fouls:{home:0,away:0}, passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0,
  blocked:0, woodwork:0, shotDist: new Array(10).fill(0), xg: 0, xgS: { home: 0, away: 0 } });

const N = +(process.env.N || 40);

function run(seed) {
  const s = createMatchState();
  const hs = sq(75, "4-3-3"), as = sq(75, "4-3-3");
  s.players.home = hs.filter(p => !p.bench); s.bench.home = hs.filter(p => p.bench);
  s.players.away = as.filter(p => !p.bench); s.bench.away = as.filter(p => p.bench);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  for (let t = 0; t < ME_MATCH_TICKS; t++) { out.min = Math.floor(t / ME_MATCH_TICKS * 90) + 1; meTick(s, rng, out); }
  for (let t = 0, add = meAdded(s); t < add; t++) meTick(s, rng, out);
  const rows = [], potm = [];
  for (const sd of ME_SIDES) {
    let best = null;
    for (const p of s.players[sd]) {
      rows.push({ pos: p.pos, r: p.rating ?? 6.5, g: p.goals || 0, a: p.assists || 0, sv: p.saves || 0 });
      if (!best || (p.rating ?? 0) > (best.rating ?? 0)) best = p;
    }
    if (best) potm.push({ g: best.goals || 0, a: best.assists || 0, sv: best.saves || 0, pos: best.pos });
  }
  return { rows, potm };
}

const res = await parMap(Array.from({ length: N }, (_, i) => i + 1), run);
if (!res) process.exit(0);
const rows = res.flatMap(r => r.rows), potm = res.flatMap(r => r.potm);

const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
const all = rows.map(r => r.r), f2 = (x) => x.toFixed(2), f1 = (x) => x.toFixed(1);
const q = (p) => { const v = [...all].sort((a, b) => a - b); return v[Math.floor(p * (v.length - 1))]; };

console.log(`\n${N} matches, ${rows.length} player-matches.\n`);
console.log(`  mean            ${f2(mean(all))}      want ~6.5`);
console.log(`  spread (sd)     ${f2(sd(all))}      want 0.55-0.85; under 0.3 and the rating has no opinion`);
console.log(`  range           ${f2(Math.min(...all))} - ${f2(Math.max(...all))}`);
console.log(`  5th / 50th / 95th   ${f2(q(0.05))}  ${f2(q(0.5))}  ${f2(q(0.95))}`);
console.log(`  untouched       ${f1(100 * all.filter(r => Math.abs(r - 6.5) < 0.005).length / all.length)}%   finished on exactly 6.5`);

console.log(`\n  BY POSITION -- these have to sit on top of each other, because the substitution logic`);
console.log(`  hooks whoever is furthest below his team's average.`);
const byPos = {};
for (const r of rows) (byPos[r.pos] = byPos[r.pos] || []).push(r.r);
const order = Object.keys(byPos).sort((a, b) => mean(byPos[b]) - mean(byPos[a]));
for (const k of order)
  console.log(`    ${k.padEnd(4)} n=${String(byPos[k].length).padStart(5)}   mean ${f2(mean(byPos[k]))}   sd ${f2(sd(byPos[k]))}`);
const gap = mean(byPos[order[0]]) - mean(byPos[order[order.length - 1]]);
console.log(`    worst gap between positions: ${f2(gap)}   want under 0.15`);

console.log(`\n  BEST-RATED PLAYER of each side -- a rating that means something puts a man who did`);
console.log(`  something at the top of the sheet.`);
console.log(`    scored or assisted   ${f1(100 * potm.filter(p => p.g || p.a).length / potm.length)}%`);
console.log(`    a keeper             ${f1(100 * potm.filter(p => p.pos === "GK").length / potm.length)}%`);
console.log(`    did none of the three ${f1(100 * potm.filter(p => !p.g && !p.a && !p.sv).length / potm.length)}%`);
