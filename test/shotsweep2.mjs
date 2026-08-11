// Conversion is 32% against a real 8-14%, and the error GROWS with range: 2x at 6-11 m, 2.7x at
// 11-16.5, 5x from outside the box. That profile says accuracy, not finishing -- a shot's error is
// angular, so it should widen with distance on its own, and the fact that it does not means the
// error is being clipped before it can.
//
// It is. `g2` is two uniforms summed: a TRIANGLE on [-sigma, +sigma] with no tails at all. At 11 m a
// full-sigma miss is 1.29 m of lateral travel while the aim point sits 1.37 m inside the post, so
// from that range missing the target sideways is not unlikely, it is arithmetically impossible.
//
// CFG is a plain object, so this sweeps without a rebuild.
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meGoalX,
        ME_MATCH_TICKS, STRAT_DEF, ME_HALF_W, CFG } = eng;

const sq = (o, f = "4-3-3") => buildSquad(f, null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, offTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0},
  fouls:{home:0,away:0}, passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0,
  blocked:0, woodwork:0, shotDist: new Array(10).fill(0), xg: 0 });

const N = +(process.env.N || 16);
const BANDS = [[6, 11], [11, 16.5], [16.5, 25]];
const REAL = ["28%", "10%", "3.5%"];

function cell({ deg, skill, elev }) {
  CFG.shotNoiseDeg = deg; CFG.shotNoiseSkill = skill; CFG.shotElevErr = elev;
  let sh = 0, g = 0, sv = 0, n = 0;
  const band = BANDS.map(() => ({ s: 0, g: 0 }));
  for (let seed = 1; seed <= N; seed++) {
    const s = createMatchState();
    s.players.home = sq(75); s.players.away = sq(75);
    s.formations = { home: "4-3-3", away: "4-3-3" };
    s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
    s.possession = "home"; meInit(s, pitchSlots);
    const out = blank(), rng = new RNG(seed);
    let live = null;
    for (let t = 0; t < ME_MATCH_TICKS; t++) {
      const mp = s.mePos, b4 = mp.shot, bx = mp.bx, by = mp.by;
      const g4 = out.goals[b4 ? b4.side : "home"], side4 = b4 ? b4.side : null;
      const gh = out.goals.home, ga = out.goals.away;
      meTick(s, rng, out);
      if (!b4 && mp.shot) {
        const gx = meGoalX(mp.shot.side);
        const d = Math.hypot(gx - bx, ME_HALF_W - by);
        live = { side: mp.shot.side, bi: BANDS.findIndex(([lo, hi]) => d >= lo && d < hi), t: 0 };
        if (live.bi >= 0) band[live.bi].s++;
      }
      if (live) {
        live.t++;
        const scored = (live.side === "home" ? out.goals.home - gh : out.goals.away - ga) > 0;
        if (scored) { if (live.bi >= 0) band[live.bi].g++; live = null; }
        else if (live.t > 40 || !mp.shot) live = null;
      }
    }
    sh += out.shots.home + out.shots.away; g += out.goals.home + out.goals.away;
    sv += out.saves.home + out.saves.away; n++;
  }
  return { conv: 100 * g / (sh || 1), gpm: g / n / 2, spm: sh / n / 2,
           band: band.map(b => 100 * b.g / (b.s || 1)) };
}

const CELLS = [];
for (const deg of [3.2, 6, 9, 13]) for (const elev of [0.30, 0.70, 1.10])
  CELLS.push({ deg, skill: deg * 2.2, elev });        // skill term tracks the base, as it does today
const res = await parMap(CELLS, cell);
if (!res) process.exit(0);

const f1 = (x) => x.toFixed(1);
console.log(`\n${N} matches per cell. shotNoiseSkill tracks shotNoiseDeg at 2.2x, as in the shipped pair (3.2 / 7).`);
console.log(`TARGET: conversion 8-14%, goals ~1.4 a side, and by band ${REAL.join(" / ")}\n`);
console.log(`  noiseDeg  elevErr    conv    goals/side   shots/side    6-11m   11-16.5   16.5-25`);
CELLS.forEach((c, i) => {
  const r = res[i];
  const hit = r.conv >= 8 && r.conv <= 14 ? "  <=="  : "";
  console.log(`  ${f1(c.deg).padStart(6)}  ${c.elev.toFixed(2).padStart(7)}  ${f1(r.conv).padStart(5)}%` +
    `  ${f1(r.gpm).padStart(9)}    ${f1(r.spm).padStart(8)}   ${r.band.map(b => (f1(b) + "%").padStart(7)).join("  ")}${hit}`);
});
console.log(`\nreal:                        8-14%          1.4          12-13      28%      10%      3.5%`);
