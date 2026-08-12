// THE ATTACK FUNNEL, BY RATING BAND.
//
// Three complaints from the real-team fixture run, and they need one diagnosis before any lever
// moves: shots FALL as OVR falls (13 -> 7.6 a side, when real shot counts are nearly flat across
// divisions), pass completion is FLAT across thirty rating points (real football spans ~70-85%),
// and possession barely stretches with a quality gap (53% at a 26-point mismatch, real is 65-75%).
//
// Flat synthetic squads, both sides identical, so the band is the only variable. Cross cells for
// the possession question. Per cell, the funnel: passes -> completion -> final-third entries ->
// shots per entry -> conversion. Where the low bands lose their shots locates the lever; whether
// completion separates locates the second; the gap cells answer the third.
//
//   node test/bandlens.mjs
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meAdded, meDir, meGoalX,
        ME_MATCH_TICKS, ME_DT, PITCH_L, STRAT_DEF } = eng;

const sq = (o, f) => buildSquad(f, null).map((p, i) => ({ ...p, name: p.pos + i, ovr: o,
  stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0, xgS: { home: 0, away: 0 } });

const N = +(process.env.N || 20);
const CELLS = [[85, 85], [75, 75], [65, 65], [55, 55], [85, 60], [80, 70]];

function play([oa, ob, seed]) {
  const s = createMatchState();
  const hs = sq(oa, "4-3-3"), as = sq(ob, "4-3-3");
  s.players.home = hs.filter(p => !p.bench); s.bench.home = hs.filter(p => p.bench);
  s.players.away = as.filter(p => !p.bench); s.bench.away = as.filter(p => p.bench);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  const A = { entries: { home: 0, away: 0 }, spells: [], touches: { home: 0, away: 0 } };
  let spell = 0, spellSide = null, inF3 = { home: false, away: false };
  for (let t = 0; t < ME_MATCH_TICKS + 400; t++) {
    const mp = s.mePos;
    meTick(s, rng, out);
    if (!mp.sp && mp.idx >= 0) {
      if (mp.side === spellSide) spell++;
      else { if (spell > 2 && spellSide) A.spells.push(spell); spell = 1; spellSide = mp.side; }
      A.touches[mp.side]++;
      // A final-third ENTRY: the ball, in this side's possession, crossing into the last 35 m.
      const depth = (mp.bx - meGoalX(mp.side)) * -meDir(mp.side) * -1;
      const inNow = Math.abs(mp.bx - meGoalX(mp.side)) < 35;
      if (inNow && !inF3[mp.side]) A.entries[mp.side]++;
      inF3[mp.side] = inNow;
      inF3[mp.side === "home" ? "away" : "home"] = false;
    }
    if (t >= ME_MATCH_TICKS + meAdded(s)) break;
  }
  if (spell > 2 && spellSide) A.spells.push(spell);
  const pT = out.poss.home + out.poss.away || 1;
  return { oa, ob, pass: out.passes / 2, ok: out.passOk / 2, shots: (out.shots.home + out.shots.away) / 2,
           goals: (out.goals.home + out.goals.away) / 2, hp: out.poss.home / pT,
           hShots: out.shots.home, aShots: out.shots.away, hGoals: out.goals.home, aGoals: out.goals.away,
           hPass: 0, entH: A.entries.home, entA: A.entries.away,
           spellMed: A.spells.sort((a, b) => a - b)[A.spells.length >> 1] || 0,
           tackles: out.tackles, clears: out.clears / 2 };
}

const jobs = [];
for (const [oa, ob] of CELLS) for (let k = 0; k < N; k++) jobs.push([oa, ob, k + 1]);
const res = await parMap(jobs, play);
if (!res) process.exit(0);
const f1 = (x) => x.toFixed(1), f2 = (x) => x.toFixed(2);
const pc = (x) => (100 * x).toFixed(0) + "%";

console.log(`\n${N} matches a cell, flat synthetic squads, identical instructions.\n`);
console.log(`  SAME LEVEL                per side:`);
console.log(`  cell     passes  compl   entries  shots  sh/entry  conv   goals   spell   tackles  clears`);
for (const [oa, ob] of CELLS.filter(c => c[0] === c[1])) {
  const g = res.filter(r => r.oa === oa && r.ob === ob);
  const S = (k) => g.reduce((a, r) => a + r[k], 0) / g.length;
  const ent = g.reduce((a, r) => a + r.entH + r.entA, 0) / g.length / 2;
  console.log(`  ${String(oa).padEnd(6)} ${f1(S("pass")).padStart(6)}  ${pc(S("ok") / S("pass")).padStart(5)}  ` +
    `${f1(ent).padStart(7)}  ${f1(S("shots")).padStart(5)}  ${f2(S("shots") / ent).padStart(8)}  ` +
    `${pc(S("goals") / S("shots")).padStart(4)}  ${f2(S("goals")).padStart(5)}   ` +
    `${f1(g.reduce((a, r) => a + r.spellMed, 0) / g.length * ME_DT).padStart(4)}s  ` +
    `${f1(S("tackles")).padStart(6)}  ${f1(S("clears")).padStart(6)}`);
}
console.log(`\n  GAP CELLS                 strong side first:`);
console.log(`  cell      poss    shots        entries      goals`);
for (const [oa, ob] of CELLS.filter(c => c[0] !== c[1])) {
  const g = res.filter(r => r.oa === oa && r.ob === ob);
  const S = (k) => g.reduce((a, r) => a + r[k], 0) / g.length;
  console.log(`  ${String(oa)}v${String(ob)}   ${pc(S("hp")).padStart(4)}   ` +
    `${f1(S("hShots")).padStart(5)}-${f1(S("aShots")).padEnd(5)}  ` +
    `${f1(S("entH")).padStart(5)}-${f1(S("entA")).padEnd(5)}  ${f2(S("hGoals"))}-${f2(S("aGoals"))}`);
}
