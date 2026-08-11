// WHEN YOU HAVE IT DEEP, IS THERE ANYBODY TO PASS IT TO?
//
// Progression is the whole of the gradient problem: once a move reaches the final third it produces
// a shot at the same rate wherever it began (0.36 / 0.40 / 0.47), but only about a tenth of moves
// starting in a side's own third ever get there, against a real fifth. And the shape harness says
// the average pass in this engine goes 1.1 m BACKWARDS with 62.5% of them played backward at all.
//
// Two explanations, opposite fixes. Either the passer is undervaluing the forward ball that is on --
// a scoring problem -- or there is genuinely nobody up there and he is right to turn back, which is
// a SHAPE problem. This counts the options rather than arguing about the score: how many teammates
// are ahead of the ball, and how many of those are actually free.
//
// A side building out from its own box in real football keeps six or seven men ahead of the ball and
// two or three of them free. If this reads two, no amount of tuning the pass score will help.
//
//   node test/outball.mjs
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

const N = +(process.env.N || 12);
const FREE = 5;                      // metres of daylight before a man counts as an option

const CELLS = [
  ["as it stands",                  {}],
  ["siege only when defending",     { _siegeOwn: 1 }],
  ["no siege squeeze at all",       { siegeSpan: 1.0 }],
];

function play([label, over]) {
  const saved = {};
  for (const k in over) { saved[k] = CFG[k]; CFG[k] = over[k]; }
  // by the third the ball is in: slices, men ahead, free men ahead, team depth, front man's x
  const A = { sl: [0,0,0], ahead: [0,0,0], free: [0,0,0], depth: [0,0,0], front: [0,0,0], n: 0,
              fwdM: 0, fwdN: 0, back: 0 };
  for (const SIDE of ["home", "away"]) {
  for (let seed = 1; seed <= N; seed++) {
    const s = createMatchState();
    s.players.home = sq(75, "4-3-3"); s.players.away = sq(75, "4-3-3");
    s.formations = { home: "4-3-3", away: "4-3-3" };
    s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
    s.possession = "home"; meInit(s, pitchSlots);
    const out = blank(), rng = new RNG(seed);
    const dir = meDir(SIDE), OTH = SIDE === "home" ? "away" : "home";
    const ax = (x) => dir > 0 ? x : PITCH_L - x;
    const band = (x) => x < PITCH_L / 3 ? 0 : x < PITCH_L * 2 / 3 ? 1 : 2;
    for (let t = 0; t < ME_MATCH_TICKS; t++) {
      const mp = s.mePos;
      const had = mp.passPending;
      if (mp.idx >= 0 && mp.side === SIDE && !mp.sp && t % 4 === 0) {
        const bx = ax(mp.bx), b = band(bx);
        const us = s.players[SIDE], them = s.players[OTH];
        let ah = 0, fr = 0, mn = Infinity, mx = -Infinity;
        for (const q of us) {
          if (q.pos === "GK" || q.off) continue;
          const qx = ax(q.x);
          if (qx < mn) mn = qx; if (qx > mx) mx = qx;
          if (qx > bx + 2) { ah++;
            let d = Infinity;
            for (const o of them) { if (o.off) continue;
              const dd = Math.hypot(o.x - q.x, o.y - q.y); if (dd < d) d = dd; }
            if (d > FREE) fr++;
          }
        }
        A.sl[b]++; A.ahead[b] += ah; A.free[b] += fr; A.depth[b] += mx - mn; A.front[b] += mx;
      }
      meTick(s, rng, out);
      if (!had && mp.passPending && mp.passPending.side === SIDE && Number.isFinite(mp.passPending.d)) {
        const sp = Math.hypot(mp.bvx, mp.bvy);
        if (sp > 0.01) { const f = mp.passPending.d * (mp.bvx / sp) * dir;
                         A.fwdM += f; A.fwdN++; if (f < -1) A.back++; }
      }
    }
    A.n++;
  }
  }
  for (const k in saved) CFG[k] = saved[k];
  return { label, ...A };
}

const res = await parMap(CELLS, play);
if (!res) process.exit(0);

const f1 = (x) => x.toFixed(1);
const Z = ["own third", "middle", "attacking"];
console.log(`\nWith the ball at his feet, what the man on it can actually see. ${N} matches per cell per side.\n`);
for (const r of res) {
  console.log(`  ${r.label}`);
  console.log(`     ball in      men ahead   of those, FREE   team depth   front man at    real: ahead / free`);
  for (let b = 0; b < 3; b++) {
    const n = Math.max(1, r.sl[b]);
    console.log(`     ${Z[b].padEnd(12)} ${f1(r.ahead[b]/n).padStart(7)}   ${f1(r.free[b]/n).padStart(12)}   ` +
      `${f1(r.depth[b]/n).padStart(8)} m   ${f1(r.front[b]/n).padStart(9)} m    ` +
      `${["    ~6.5 / ~3", "    ~5.0 / ~2", "    ~3.0 / ~1"][b]}`);
  }
  console.log(`     average pass ${f1(r.fwdM / Math.max(1, r.fwdN))} m forward, ` +
    `${f1(100 * r.back / Math.max(1, r.fwdN))}% played backward   (real: about +2 m, 45-50% backward)\n`);
}
