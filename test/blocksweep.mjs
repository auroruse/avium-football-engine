// How far in front of the shooter the body stands. Too far and the ball is past him before it
// spreads; too near and he is behind the strike. Also how deep the behaviour switches on.
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
function cell({ st, zone }) {
  CFG.blockStand = st; CFG.blockZone = zone;
  let sh = 0, g = 0, bl = 0, ok = 0, tot = 0;
  for (let seed = 1; seed <= N; seed++) {
    const s = createMatchState();
    s.players.home = sq(75); s.players.away = sq(75);
    s.formations = { home: "4-3-3", away: "4-3-3" };
    s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
    s.possession = "home"; meInit(s, pitchSlots);
    const out = blank(), rng = new RNG(seed);
    for (let k = 0; k < ME_MATCH_TICKS; k++) meTick(s, rng, out);
    sh += out.shots.home + out.shots.away; g += out.goals.home + out.goals.away;
    bl += out.blocked; ok += out.passOk; tot += out.passOk + out.passFail;
  }
  return { conv: 100 * g / (sh || 1), gpm: g / N / 2, spm: sh / N / 2,
           blp: 100 * bl / (sh || 1), cmp: 100 * ok / (tot || 1) };
}
const CELLS = [];
for (const zone of [20, 30]) for (const st of [0.9, 1.4, 2.0, 2.8]) CELLS.push({ st, zone });
const res = await parMap(CELLS, cell);
if (!res) process.exit(0);
const f1 = (x) => x.toFixed(1);
console.log(`\n${N} matches per cell.   want: conversion 8-14%, goals ~1.4, blocked ~30% of shots\n`);
console.log(`  zone  stand      conv   goals/side   shots/side   blocked   completion`);
CELLS.forEach((c, i) => { const r = res[i];
  console.log(`  ${String(c.zone).padStart(4)}  ${c.st.toFixed(1).padStart(5)}   ${f1(r.conv).padStart(6)}%` +
    `   ${f1(r.gpm).padStart(9)}   ${f1(r.spm).padStart(9)}   ${f1(r.blp).padStart(6)}%   ${f1(r.cmp).padStart(9)}%` +
    `${r.conv <= 16 ? "  <==" : ""}`); });
