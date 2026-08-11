// He saves 69% now, and the rebounds go in: goals from a tracked shot fell to 47% of all goals, so
// the other half are second balls. gkCatchDive was set when `dive` meant "distance to the nearest
// bit of him", which for a capsule is nearly zero; measured from his CENTRE it now makes almost
// every save a parry back into a box with nobody in it. How much he should HOLD.
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, ME_MATCH_TICKS, STRAT_DEF, CFG } = eng;
const sq = (o, f = "4-3-3") => buildSquad(f, null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, offTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0},
  fouls:{home:0,away:0}, passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0,
  blocked:0, woodwork:0, shotDist: new Array(10).fill(0), xg: 0 });
const N = +(process.env.N || 14);
function cell({ cd, push }) {
  CFG.gkCatchDive = cd; CFG.gkParryPush = push;
  let sh = 0, g = 0, sv = 0, held = 0;
  for (let seed = 1; seed <= N; seed++) {
    const s = createMatchState();
    s.players.home = sq(75); s.players.away = sq(75);
    s.formations = { home: "4-3-3", away: "4-3-3" };
    s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
    s.possession = "home"; meInit(s, pitchSlots);
    const out = blank(), rng = new RNG(seed);
    for (let k = 0; k < ME_MATCH_TICKS; k++) { meTick(s, rng, out); if (s.mePos.held) held++; }
    sh += out.shots.home + out.shots.away; g += out.goals.home + out.goals.away;
    sv += out.saves.home + out.saves.away;
  }
  return { conv: 100 * g / (sh || 1), gpm: g / N / 2, spm: sh / N / 2,
           svp: 100 * sv / (sv + g || 1), hold: held / N };
}
const CELLS = [];
for (const cd of [0.12, 0.35, 0.55, 0.80]) for (const push of [6.5, 11, 16]) CELLS.push({ cd, push });
const res = await parMap(CELLS, cell);
if (!res) process.exit(0);
const f1 = (x) => x.toFixed(1);
console.log(`\n${N} matches per cell.   want: conversion 8-14%, goals ~1.4 a side, saves ~69%\n`);
console.log(`  catchDive  parryPush     conv   goals/side   shots/side   saves%   slices holding`);
CELLS.forEach((c, i) => { const r = res[i];
  console.log(`  ${c.cd.toFixed(2).padStart(8)}  ${String(c.push).padStart(8)}   ${f1(r.conv).padStart(6)}%` +
    `   ${f1(r.gpm).padStart(9)}   ${f1(r.spm).padStart(9)}   ${f1(r.svp).padStart(5)}%   ${f1(r.hold).padStart(9)}` +
    `${r.conv <= 16 ? "  <==" : ""}`); });
