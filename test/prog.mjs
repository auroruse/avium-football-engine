// WHAT IS TWENTY METRES WORTH AGAINST SIMPLY KEEPING IT?
//
// The gradient problem came down to progression: a move that reaches the final third produces a shot
// at the same rate wherever it began, and only a tenth of moves starting deep ever get there against
// a real fifth. It is not shape -- a man on the ball in his own third has 5.8 team-mates ahead of him
// and 2.3 of them free, which is close to the real 6.5 and 3. He turns back anyway, 59% of the time,
// and the average pass in this engine goes 0.4 m BACKWARDS.
//
// It is the score, and decide.ts already says why in its own comment: the value surface is nearly
// flat through midfield, so twelve metres of progress is worth 0.007 while merely still having the
// ball is worth CFG.keep at 0.030. Holding wins by four to one before risk is even considered, and
// the two ad-hoc nudges that were added to fight it -- fwdPull at 0.0010 a metre and roomFwd at
// 0.003 -- cannot close a gap that size: twenty metres of progress buys 0.020 against 0.030 for
// passing it sideways to a free man.
//
// So this sweeps the trade directly, against what it is supposed to fix rather than against taste.
//
//   node test/prog.mjs
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

const N = +(process.env.N || 14);

// fwdPull is worth per metre gained; roomFwd the same again but only into space. Against keep, the
// flat reward for still having it at all. The cells walk the ratio rather than one number, because
// it is the ratio the passer is actually comparing.
const CELLS = [
  ["as it stands     .0010 / .0030",      {}],
  ["pull x2          .0020 / .0030",      { fwdPull: 0.0020 }],
  ["pull x2 room 1.5 .0020 / .0045",      { fwdPull: 0.0020, roomFwd: 0.0045 }],
  ["pull 1.5 room x2 .0015 / .0060",      { fwdPull: 0.0015, roomFwd: 0.0060 }],
  ["pull x2 room x2  .0020 / .0060",      { fwdPull: 0.0020, roomFwd: 0.0060 }],
  ["room x2 only     .0010 / .0060",      { roomFwd: 0.0060 }],
  ["room x2, softer loss",                { roomFwd: 0.0060, loss: 0.15 }],
];

function play([label, over]) {
  const saved = {};
  for (const k in over) { saved[k] = CFG[k]; CFG[k] = over[k]; }
  const A = { n: 0, np: [0,0,0], xg: [0,0,0], reach: [0,0,0],
              fwdM: 0, fwdN: 0, back: 0, g: 0, sh: 0, cmp: 0, cmpN: 0, inplay: 0 };
  for (const SIDE of ["home", "away"]) {
  for (let seed = 1; seed <= N; seed++) {
    const s = createMatchState(), OTH = SIDE === "home" ? "away" : "home";
    s.players.home = sq(75, "4-3-3"); s.players.away = sq(75, "4-3-3");
    s.formations = { home: "4-3-3", away: "4-3-3" };
    s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
    s.possession = "home"; meInit(s, pitchSlots);
    const out = blank(), rng = new RNG(seed);
    const dir = meDir(SIDE);
    const ax = (x) => dir > 0 ? x : PITCH_L - x;
    const band = (x) => x < PITCH_L / 3 ? 0 : x < PITCH_L * 2 / 3 ? 1 : 2;
    let cur = null;
    const close = () => { if (!cur) return;
      A.np[cur.b]++; A.xg[cur.b] += cur.xg;
      if (cur.far > PITCH_L * 2 / 3) A.reach[cur.b]++; cur = null; };
    for (let t = 0; t < ME_MATCH_TICKS; t++) {
      const mp = s.mePos;
      const ctrl = mp.idx >= 0 ? mp.side : null;
      if (ctrl === SIDE && !cur) { const x = ax(mp.bx); cur = { b: band(x), far: x, xg: 0 }; }
      else if (ctrl === OTH) close();
      const had = mp.passPending, xg0 = out.xgS[SIDE];
      meTick(s, rng, out);
      if (cur) { cur.xg += out.xgS[SIDE] - xg0; cur.far = Math.max(cur.far, ax(mp.bx)); }
      if (!had && mp.passPending && mp.passPending.side === SIDE && Number.isFinite(mp.passPending.d)) {
        const sp = Math.hypot(mp.bvx, mp.bvy);
        if (sp > 0.01) { const f = mp.passPending.d * (mp.bvx / sp) * dir;
                         A.fwdM += f; A.fwdN++; if (f < -1) A.back++; }
      }
    }
    close();
    A.g += out.goals[SIDE]; A.sh += out.shots[SIDE]; A.inplay += out.inplay;
    A.cmp += out.passOk; A.cmpN += out.passOk + out.passFail; A.n++;
  }
  }
  for (const k in saved) CFG[k] = saved[k];
  return { label, ...A };
}

const res = await parMap(CELLS, play);
if (!res) process.exit(0);

const f1 = (x) => x.toFixed(1), f2 = (x) => x.toFixed(2), f3 = (x) => x.toFixed(3);
console.log(`\nProgression against retention. ${N} matches per cell per side, 75 v 75, 4-3-3, no instructions.\n`);
console.log(`  cell                                   pass m   back%   deep->f3   xG/poss deep:mid:high` +
            `        goals  shots  cmp%`);
console.log(`  target                                   +2.0   45-50      ~22%   0.43 : 1 : 2.6` +
            `             ~1.4    ~12   78-86`);
console.log(`  ${"-".repeat(38)}   ------  ------  --------   ----------------------` +
            `      -----  -----  -----`);
for (const r of res) {
  const per = [0,1,2].map(b => r.xg[b] / Math.max(1, r.np[b]));
  console.log(`  ${r.label.padEnd(38)}   ${f1(r.fwdM / Math.max(1, r.fwdN)).padStart(6)}  ` +
    `${f1(100 * r.back / Math.max(1, r.fwdN)).padStart(5)}%  ` +
    `${f1(100 * r.reach[0] / Math.max(1, r.np[0])).padStart(7)}%   ` +
    `${(per[0] / Math.max(1e-9, per[1])).toFixed(2)} : 1 : ${(per[2] / Math.max(1e-9, per[1])).toFixed(2)}`.padStart(22) +
    `      ${f1(r.g / r.n).padStart(5)}  ${f1(r.sh / r.n).padStart(5)}  ` +
    `${f1(100 * r.cmp / Math.max(1, r.cmpN)).padStart(5)}`);
}
console.log(``);
