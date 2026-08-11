// The calibration pass for conversion. Shots are already right at ~10-12 a side, so this is not
// about taking fewer -- it is about them going in less often, which means the funnel: more off
// target, more blocked, and the keeper already correct at ~31% of what reaches him.
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meGoalX,
        ME_MATCH_TICKS, STRAT_DEF, ME_HALF_W, CFG } = eng;
const squad = (o) => buildSquad("4-3-3", null).map((p, i) => ({ ...p, name: p.pos + i, ovr: o,
  stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, offTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0},
  fouls:{home:0,away:0}, passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0,
  blocked:0, woodwork:0, shotDist: new Array(10).fill(0), xg: 0 });
const N = +(process.env.N || 14);
function cell({ aim, elev }) {
  CFG.shotAimSkill = aim; CFG.shotElevErr = elev;
  let g = 0, sh = 0, bl = 0, sv = 0, wd = 0, ok = 0, tot = 0;
  for (let seed = 1; seed <= N; seed++) {
    const s = createMatchState();
    const hs = squad(75), as = squad(75);
    s.players.home = hs.filter(p => !p.bench); s.bench.home = hs.filter(p => p.bench);
    s.players.away = as.filter(p => !p.bench); s.bench.away = as.filter(p => p.bench);
    s.formations = { home: "4-3-3", away: "4-3-3" };
    s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
    s.possession = "home"; meInit(s, pitchSlots);
    const out = blank(), rng = new RNG(seed);
    for (let t = 0; t < ME_MATCH_TICKS; t++) meTick(s, rng, out);
    g += out.goals.home + out.goals.away; sh += out.shots.home + out.shots.away;
    bl += out.blocked; sv += out.saves.home + out.saves.away; wd += out.woodwork;
    ok += out.passOk; tot += out.passOk + out.passFail;
  }
  const S = sh || 1;
  return { g: g/N/2, sh: sh/N/2, conv: 100*g/S, bl: 100*bl/S, sv: 100*sv/S, wd: 100*wd/S,
           cmp: 100*ok/(tot||1) };
}
const CELLS = [];
for (const aim of [0.42, 0.55]) for (const elev of [1.8, 3.5, 5.0, 6.5]) CELLS.push({ aim, elev });
const res = await parMap(CELLS, cell);
if (!res) process.exit(0);
const f1 = (x) => x.toFixed(1);
console.log(`\n${N} matches per cell.  want: conversion 8-14%, goals ~1.4, blocked ~27%, saved ~24%\n`);
console.log(`  aimSkill  elevErr    conv   goals/side  shots/side   blocked   saved   woodwork  completion`);
CELLS.forEach((c, i) => { const r = res[i];
  const ok2 = r.conv >= 8 && r.conv <= 15 && r.g <= 2.2;
  console.log(`  ${c.aim.toFixed(2).padStart(8)}  ${c.elev.toFixed(1).padStart(7)}  ${f1(r.conv).padStart(5)}%` +
    `  ${f1(r.g).padStart(10)}  ${f1(r.sh).padStart(10)}   ${f1(r.bl).padStart(6)}%  ${f1(r.sv).padStart(5)}%` +
    `   ${f1(r.wd).padStart(7)}%  ${f1(r.cmp).padStart(9)}%${ok2 ? "  <==" : ""}`); });
