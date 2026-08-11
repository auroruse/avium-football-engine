// THE GRASS IS GLUE.
//
// Chasing why passingDir and timeWasting are buffs ended here. Neither is really about passing or
// about wasting time -- both of them buy field position, and field position is free because the one
// thing that should cost you is broken:
//
//     completion 8-15 m   77.6%  against a real 89%
//     completion 15-22 m  65.8%  against a real 84%
//     completion 30-40 m  64.1%  against a real 62%
//
// Long balls are right. The bread-and-butter pass, 59% of everything played, is cut out at three
// times the real rate -- and it is cut out because it CRAWLS. A 15 m pass takes 1.59 s to arrive
// and a 20 m pass takes 1.90 s, roughly half as fast again as the real thing, which hands every
// defender an extra half-second in the lane.
//
// The cause is in the integrator rather than in any passing code. A rolling ball is decelerated by
// 0.055 v^2 + 2.1, which is 7.6 m/s^2 at 10 m/s where a real ball on grass loses about 2.0. And the
// quadratic half of it is a duplicate: stepOnce already applies ballDrag 0.015 v^2 to the full 3D
// velocity on every substep, and that one is calibrated correctly for air. Rolling resistance is
// very nearly velocity-independent -- C_rr * g, about 0.6-0.9 m/s^2 on grass -- so the v^2 term in
// the rolling block is drag counted a second time and the linear term is roughly 3x too big.
//
//   node test/fric.mjs
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meDir,
        ME_MATCH_TICKS, STRAT_DEF, PITCH_L, CFG } = eng;

const sq = (o, f) => buildSquad(f, null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0, xgS: { home: 0, away: 0 } });

const N = +(process.env.N || 16);
// fric = the quadratic rolling term (drag, already counted once in stepOnce)
// lin  = rolling resistance proper, C_rr * g
const CELLS = [
  ["as it stands      0.055 / 2.10", { ballFric: 0.055, ballFricLin: 2.10 }],
  ["half              0.028 / 1.05", { ballFric: 0.028, ballFricLin: 1.05 }],
  ["no double drag    0.000 / 1.05", { ballFric: 0.000, ballFricLin: 1.05 }],
  ["physical          0.000 / 0.80", { ballFric: 0.000, ballFricLin: 0.80 }],
  ["physical, grass   0.010 / 0.75", { ballFric: 0.010, ballFricLin: 0.75 }],
];

const EDGES = [0, 8, 15, 22, 30, 40, 999];
const REAL  = [93, 89, 84, 76, 62, 48];
const bucket = (d) => { for (let i = 0; i < EDGES.length - 1; i++) if (d < EDGES[i + 1]) return i; return 5; };

function play([label, over]) {
  const saved = {};
  for (const k in over) { saved[k] = CFG[k]; CFG[k] = over[k]; }
  const A = { ok: new Array(6).fill(0), no: new Array(6).fill(0),
              g: 0, sh: 0, inplay: 0, tot: 0, n: 0, np: 0, reach: 0, corn: 0, xg: 0 };
  for (let seed = 1; seed <= N; seed++) {
    const s = createMatchState();
    s.players.home = sq(75, "4-3-3"); s.players.away = sq(75, "4-3-3");
    s.formations = { home: "4-3-3", away: "4-3-3" };
    s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
    s.possession = "home"; meInit(s, pitchSlots);
    const out = blank(), rng = new RNG(seed);
    const dir = meDir("home"), ax = (x) => dir > 0 ? x : PITCH_L - x;
    let pend = null, cur = null, held = null;
    for (let t = 0; t < ME_MATCH_TICKS; t++) {
      const mp = s.mePos;
      const had = mp.passPending, okB = out.passOk, noB = out.passFail;
      const ctrl = mp.idx >= 0 ? mp.side : null;
      // possessions that start in our own third, and whether they ever reach the final third
      if (ctrl === "home" && !cur) { const x = ax(mp.bx); cur = x < PITCH_L / 3 ? { far: x } : null;
                                     if (cur) A.np++; }
      else if (ctrl === "away" && cur) { if (cur.far > PITCH_L * 2 / 3) A.reach++; cur = null; }
      meTick(s, rng, out);
      if (cur) cur.far = Math.max(cur.far, ax(mp.bx));
      if (!had && mp.passPending && Number.isFinite(mp.passPending.d)) pend = mp.passPending.d;
      const dOk = out.passOk - okB, dNo = out.passFail - noB;
      if (pend !== null && (dOk || dNo)) { const b = bucket(pend);
        if (dOk) A.ok[b]++; if (dNo) A.no[b]++; pend = null; }
      held = ctrl ?? held;
    }
    if (cur && cur.far > PITCH_L * 2 / 3) A.reach++;
    A.g += out.goals.home + out.goals.away; A.sh += out.shots.home + out.shots.away;
    A.inplay += out.inplay; A.corn += out.corners.home + out.corners.away;
    A.xg += out.xg || 0; A.n++;
  }
  for (const k in saved) CFG[k] = saved[k];
  return { label, ...A };
}

const res = await parMap(CELLS, play);
if (!res) process.exit(0);

const f1 = (x) => x.toFixed(1);
console.log(`\nBall friction against everything it touches. ${N} matches per cell, 75 v 75, 4-3-3.\n`);
console.log(`  cell                            <8m    8-15   15-22  22-30  30-40   >40    all` +
            `     deep poss    goals  shots  corners  in play`);
console.log(`  real                            93.0   89.0   84.0   76.0   62.0   48.0   ~82` +
            `      ~22%`);
console.log(`  ${"-".repeat(30)}  ${"-----  ".repeat(7)}   ---------    -----  -----  -------  -------`);
for (const r of res) {
  const tot = r.ok.reduce((a, b) => a + b, 0), all = tot + r.no.reduce((a, b) => a + b, 0);
  console.log(`  ${r.label.padEnd(30)}  ` +
    [0,1,2,3,4,5].map(b => f1(100 * r.ok[b] / Math.max(1, r.ok[b] + r.no[b])).padStart(5)).join("  ") +
    `  ${f1(100 * tot / Math.max(1, all)).padStart(5)}` +
    `     ${f1(100 * r.reach / Math.max(1, r.np)).padStart(5)}%    ` +
    ` ${f1(r.g / r.n).padStart(5)}  ${f1(r.sh / r.n).padStart(5)}  ` +
    `${f1(r.corn / r.n).padStart(7)}  ${f1(100 * r.inplay / (r.n * ME_MATCH_TICKS)).padStart(6)}%`);
}
console.log(`\n  "deep poss" is the share of possessions starting in a side's own third that ever reach the`);
console.log(`  final third -- the number that says whether this engine can carry a ball up a pitch at all.`);
