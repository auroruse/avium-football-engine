// TWO KNOBS, SWEPT AT THE BAND ENDPOINTS.
//
// After meTech, two gradients are still wrong and each has one candidate lever:
//
//   COMPLETION is flat across bands (81/82/81/81) because the new cut-anticipation channel cancels
//   the noise widening -- worse passers against worse cutters. The lever is passNoiseSkill, slope
//   up with the base re-anchored so a 75 keeps his exact noise.
//
//   SHOTS PER ENTRY is collapsed at the bottom (0.55 -> 0.38) because meShotP's finisher slope is
//   an estimate-side skill term: a poor finisher rationally declines. The lever is shotFinSkill,
//   slope DOWN with the base re-anchored -- execution noise now carries the real difference.
//
// Each knob swept alone, 85-band and 55-band flat squads + the 75 anchor.
//
//   KNOB=noise node test/bandsweep2.mjs
//   KNOB=fin   node test/bandsweep2.mjs
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meAdded, meGoalX,
        ME_MATCH_TICKS, STRAT_DEF, CFG } = eng;

const sq = (o, f) => buildSquad(f, null).map((p, i) => ({ ...p, name: p.pos + i, ovr: o,
  stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0, xgS: { home: 0, away: 0 } });

const N = +(process.env.N || 14);
const KNOB = process.env.KNOB || "noise";
// (value applied, label) -- base re-anchored so meTech 0.80 / shoot-99 0.848 keeps today's value.
const CELLS = KNOB === "noise"
  ? [[6, null], [9, null], [12, null], [15, null]].map(([sl]) => ({ sl, deg: 5.7 - 0.2 * sl }))
  : KNOB === "judge"
  ? [[1, null], [0.5, null], [0.25, null], [0, null]].map(([sl]) => ({ sl }))
  : KNOB === "power"
  ? [0, 0.12, 0.2, 0.3].map((sl) => ({ sl, base: 0.08 - 0.2 * sl }))
  : KNOB === "share"
  ? [0.75, 0.85, 0.92, 1.0].map((sl) => ({ sl }))
  : KNOB === "cut"
  ? [0.52, 0.35, 0.20, 0.08].map((sl) => ({ sl, lo: 1 - 0.82 * sl }))
  : [[0.80, null], [0.55, null], [0.35, null], [0.18, null]].map(([sl]) => ({ sl, base: 1.278 - 0.848 * sl }));
const JUDGE0 = CFG.judgeErr;

function play([cell, ovr, seed]) {
  if (KNOB === "noise") { CFG.passNoiseSkill = cell.sl; CFG.passNoiseDeg = cell.deg; }
  else if (KNOB === "judge") CFG.judgeErr = JUDGE0 * cell.sl;
  else if (KNOB === "power") { CFG.powerNoiseSkill = cell.sl; CFG.powerNoise = cell.base; }
  else if (KNOB === "share") CFG.judgeShare = cell.sl;
  else if (KNOB === "cut") { CFG.cutAntW = cell.sl; CFG.cutAntLo = cell.lo; }
  else { CFG.shotFinSkill = cell.sl; CFG.shotFinBase = cell.base; }
  const s = createMatchState();
  const hs = sq(ovr, "4-3-3"), as = sq(ovr, "4-3-3");
  s.players.home = hs.filter(p => !p.bench); s.bench.home = hs.filter(p => p.bench);
  s.players.away = as.filter(p => !p.bench); s.bench.away = as.filter(p => p.bench);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  let entries = 0, inF3 = { home: false, away: false };
  for (let t = 0; t < ME_MATCH_TICKS + 400; t++) {
    const mp = s.mePos;
    meTick(s, rng, out);
    if (!mp.sp && mp.idx >= 0) {
      const inNow = Math.abs(mp.bx - meGoalX(mp.side)) < 35;
      if (inNow && !inF3[mp.side]) entries++;
      inF3[mp.side] = inNow;
      inF3[mp.side === "home" ? "away" : "home"] = false;
    }
    if (t >= ME_MATCH_TICKS + meAdded(s)) break;
  }
  return { pass: out.passes / 2, ok: out.passOk, tot: out.passes,
           shots: (out.shots.home + out.shots.away) / 2,
           goals: (out.goals.home + out.goals.away) / 2, entries: entries / 2 };
}

const OVRS = [85, 75, 55];
const jobs = [];
for (const c of CELLS) for (const o of OVRS) for (let k = 0; k < N; k++) jobs.push([c, o, k + 1]);
const res = await parMap(jobs, play);
if (!res) process.exit(0);
const f1 = (x) => x.toFixed(1), f2 = (x) => x.toFixed(2);
const pc = (x) => (100 * x).toFixed(0) + "%";

console.log(`\nKNOB=${KNOB}, ${N} matches a cell.\n`);
console.log(`  slope    band   compl   shots   sh/entry  goals   conv`);
let i = 0;
for (const c of CELLS) for (const o of OVRS) {
  const g = res.slice(i * N, (i + 1) * N); i++;
  const S = (k) => g.reduce((a, r) => a + r[k], 0) / g.length;
  console.log(`  ${String(c.sl).padStart(5)}    ${o}    ` +
    `${pc(g.reduce((a, r) => a + r.ok, 0) / g.reduce((a, r) => a + r.tot, 0)).padStart(4)}   ` +
    `${f1(S("shots")).padStart(5)}   ${f2(S("shots") / S("entries")).padStart(8)}  ` +
    `${f2(S("goals")).padStart(5)}   ${pc(S("goals") / S("shots"))}`);
}
