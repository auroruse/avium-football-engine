// He misses by 0.93 m. Under pure hitbox the only honest levers are how early he goes and how fast
// he gets there -- reaction, dive speed, and how often he picks the right side. No reach ring.
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick,
        ME_MATCH_TICKS, STRAT_DEF, CFG } = eng;
const sq = (o, f = "4-3-3") => buildSquad(f, null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, offTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0},
  fouls:{home:0,away:0}, passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0,
  blocked:0, woodwork:0, shotDist: new Array(10).fill(0), xg: 0 });
const N = +(process.env.N || 14);
function cell({ dv, react, read }) {
  CFG.gkDiveVmin = 6.0 * dv; CFG.gkDiveVmax = 9.0 * dv;
  CFG.gkReactSlow = 0.28 * react; CFG.gkReactFast = 0.18 * react;
  CFG.gkReadMin = Math.min(0.97, 0.45 * read); CFG.gkReadMax = Math.min(0.98, 0.82 * read);
  let sh = 0, g = 0, sv = 0;
  for (let seed = 1; seed <= N; seed++) {
    const s = createMatchState();
    s.players.home = sq(75); s.players.away = sq(75);
    s.formations = { home: "4-3-3", away: "4-3-3" };
    s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
    s.possession = "home"; meInit(s, pitchSlots);
    const out = blank(), rng = new RNG(seed);
    for (let k = 0; k < ME_MATCH_TICKS; k++) meTick(s, rng, out);
    sh += out.shots.home + out.shots.away; g += out.goals.home + out.goals.away;
    sv += out.saves.home + out.saves.away;
  }
  return { conv: 100 * g / (sh || 1), gpm: g / N / 2, spm: sh / N / 2, svp: 100 * sv / (sv + g || 1) };
}
const CELLS = [];
for (const dv of [1.0, 1.4, 1.8]) for (const react of [1.0, 0.7]) for (const read of [1.0, 1.25])
  CELLS.push({ dv, react, read });
const res = await parMap(CELLS, cell);
if (!res) process.exit(0);
const f1 = (x) => x.toFixed(1);
console.log(`\n${N} matches per cell. Multipliers on the shipped values.`);
console.log(`TARGET: conversion 8-14%, goals ~1.4 a side, keeper saves ~69% of what reaches him\n`);
console.log(`  dive  react  read     conv   goals/side   saves%`);
CELLS.forEach((c, i) => { const r = res[i];
  console.log(`  ${c.dv.toFixed(1)}x  ${c.react.toFixed(1)}x  ${c.read.toFixed(2)}x   ${f1(r.conv).padStart(5)}%` +
    `   ${f1(r.gpm).padStart(9)}   ${f1(r.svp).padStart(5)}%${r.conv <= 16 ? "   <==" : ""}`); });
console.log(`\nreal:                      8-14%       1.4        69%`);
