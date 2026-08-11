// Fouls and cards to real rates: about eleven fouls and 1.8 yellows a side, a red every fifteen to
// twenty matches. A foul stops play, so the relationship is not quite linear in foulBase -- more
// fouls means fewer slices in which to commit the next one.
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, ME_MATCH_TICKS, STRAT_DEF, CFG } = eng;
const sq = (o) => buildSquad("4-3-3", null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, offTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0},
  fouls:{home:0,away:0}, passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0,
  blocked:0, woodwork:0, shotDist: new Array(10).fill(0), xg: 0 });
const N = +(process.env.N || 16);
function cell({ fb, cy }) {
  CFG.foulBase = fb; CFG.cardYellow = cy;
  let fo = 0, ye = 0, re = 0, g = 0, sh = 0, ip = 0;
  for (let seed = 1; seed <= N; seed++) {
    const s = createMatchState();
    s.players.home = sq(75); s.players.away = sq(75);
    s.formations = { home: "4-3-3", away: "4-3-3" };
    s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
    s.possession = "home"; meInit(s, pitchSlots);
    const out = blank(), rng = new RNG(seed);
    for (let k = 0; k < ME_MATCH_TICKS; k++) meTick(s, rng, out);
    fo += out.fouls.home + out.fouls.away;
    ye += (out.yellows?.home || 0) + (out.yellows?.away || 0);
    re += (out.reds?.home || 0) + (out.reds?.away || 0);
    g += out.goals.home + out.goals.away; sh += out.shots.home + out.shots.away;
    ip += out.inplay;
  }
  const d = N * 2;
  return { fo: fo/d, ye: ye/d, re: re/d, g: g/d, sh: sh/d, ip: 100*ip/(N*ME_MATCH_TICKS) };
}
const CELLS = [];
for (const fb of [0.010, 0.016, 0.022, 0.030]) for (const cy of [0.16, 0.24]) CELLS.push({ fb, cy });
const res = await parMap(CELLS, cell);
if (!res) process.exit(0);
const f2 = (x) => x.toFixed(2);
console.log(`\n${N} matches per cell. Per side per match.\n`);
console.log(`  foulBase  cardYel    fouls   yellows    reds     goals   shots   ball in play`);
CELLS.forEach((c, i) => { const r = res[i];
  const ok = r.fo >= 9 && r.fo <= 13 && r.ye >= 1.4 && r.ye <= 2.2;
  console.log(`  ${c.fb.toFixed(3).padStart(8)}  ${c.cy.toFixed(2).padStart(7)}   ${f2(r.fo).padStart(6)}` +
    `  ${f2(r.ye).padStart(7)}  ${f2(r.re).padStart(6)}   ${f2(r.g).padStart(7)} ${f2(r.sh).padStart(7)}` +
    `   ${r.ip.toFixed(0).padStart(9)}%${ok ? "  <==" : ""}`); });
console.log(`\n  real:                        ~11      ~1.8    ~0.05      1.40   12-13          58-72%`);
