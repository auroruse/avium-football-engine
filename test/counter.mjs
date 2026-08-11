// WHAT IS A POSSESSION WORTH, BY WHERE IT STARTED?
//
// The first version of this asked what a turnover produced in the eight seconds after it, and read
// 0.000 deep / 0.001 midfield / 0.047 high. That instrument was partly measuring itself: a move that
// begins ninety metres from goal cannot reach a shot inside eight seconds however good it is, so the
// deep number was guaranteed to be near zero before the engine did anything.
//
// So no window. A possession runs from the moment a side takes control to the moment the other side
// takes it, however long that is, and everything it creates is charged to where it BEGAN. That is
// the standard way the question is asked, and it has a published answer to check against:
//
//     started in own third   ~0.015 xG      middle third  ~0.035      attacking third  ~0.09
//
// The ratio is what matters -- roughly 1 : 2 : 5. A high win is worth several times a deep one, which
// is the entire reason pressing exists. If this engine is far steeper than that, then winning it deep
// is worth nothing, moving the ball upfield carries no risk, and both confirmed buffs follow directly.
//
//   node test/counter.mjs
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meDir,
        ME_MATCH_TICKS, ME_DT, STRAT_DEF, PITCH_L, CFG } = eng;

const sq = (o, f) => buildSquad(f, null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0, xgS: { home: 0, away: 0 } });

const N = +(process.env.N || 16);

const CELLS = [
  ["as it stands",              {}],
  ["no transition drop",        { transDrop: 0 }],
  ["runs allowed from deep",    { runMinDepth: 0 }],
  ["both",                      { transDrop: 0, runMinDepth: 0 }],
];

function play([label, over]) {
  const saved = {};
  for (const k in over) { saved[k] = CFG[k]; CFG[k] = over[k]; }
  // per start zone: possessions, xG created, total slices held, metres of ground gained
  const A = { n: 0, np: [0,0,0], xg: [0,0,0], secs: [0,0,0], gain: [0,0,0], shots: [0,0,0],
              reach: [0,0,0], gTot: 0, xgTot: 0,
              // how it ended: taken off the man, cut out in flight, or a dead ball
              endT: [0,0,0], endC: [0,0,0], endD: [0,0,0], fwd: [0,0,0], fwdN: [0,0,0] };
  for (const SIDE of ["home", "away"]) {
  for (let seed = 1; seed <= N; seed++) {
    const s = createMatchState(), OTH = SIDE === "home" ? "away" : "home";
    s.players.home = sq(75, "4-3-3"); s.players.away = sq(75, "4-3-3");
    s.formations = { home: "4-3-3", away: "4-3-3" };
    s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
    s.possession = "home"; meInit(s, pitchSlots);
    const out = blank(), rng = new RNG(seed);
    const dir = meDir(SIDE);
    const ax = (x) => dir > 0 ? x : PITCH_L - x;          // 0 = our goal line, 105 = theirs
    const band = (x) => x < PITCH_L / 3 ? 0 : x < PITCH_L * 2 / 3 ? 1 : 2;
    let held = null, cur = null, prevCtrl = null, prevSp = false;
    const close = () => { if (!cur) return;
      A.np[cur.b]++; A.xg[cur.b] += cur.xg; A.secs[cur.b] += cur.t;
      A.gain[cur.b] += cur.far - cur.x0; A.shots[cur.b] += cur.sh;
      if (cur.far > PITCH_L * 2 / 3) A.reach[cur.b]++;      // got into the final third at all
      cur = null; };
    for (let t = 0; t < ME_MATCH_TICKS; t++) {
      const mp = s.mePos;
      const ctrl = mp.idx >= 0 ? mp.side : null;
      // A possession opens when we take it and closes only when THEY take it. A loose ball in
      // flight belongs to whoever last had it, which is what keeps a shot inside its own move.
      if (ctrl === SIDE && !cur) { const x = ax(mp.bx); cur = { b: band(x), x0: x, far: x, xg: 0, t: 0, sh: 0 }; }
      else if (ctrl === OTH) {
        // charged to how it looked the slice BEFORE they got it: still at our man's feet is a
        // tackle, loose or in flight is a pass cut out, and a set piece is neither.
        if (cur) { if (prevSp || mp.sp) A.endD[cur.b]++;
                   else if (prevCtrl === SIDE) A.endT[cur.b]++;
                   else A.endC[cur.b]++; }
        close();
      }
      held = ctrl ?? held;
      const xg0 = out.xgS[SIDE], sh0 = out.shots[SIDE], bx0 = ax(mp.bx);
      meTick(s, rng, out);
      if (cur) { cur.xg += out.xgS[SIDE] - xg0; cur.sh += out.shots[SIDE] - sh0; cur.t++;
                 cur.far = Math.max(cur.far, ax(mp.bx));
                 // ground the ball actually made this slice, forward only
                 const gain = ax(mp.bx) - bx0; if (gain > 0) { A.fwd[cur.b] += gain; }
                 A.fwdN[cur.b]++; }
      prevCtrl = ctrl; prevSp = !!mp.sp;
    }
    close();
    A.gTot += out.goals[SIDE]; A.xgTot += out.xgS[SIDE]; A.n++;
  }
  }
  for (const k in saved) CFG[k] = saved[k];
  return { label, ...A };
}

const res = await parMap(CELLS, play);
if (!res) process.exit(0);

const f3 = (x) => x.toFixed(3), f2 = (x) => x.toFixed(2), f1 = (x) => x.toFixed(1);
const Z = ["own third", "middle", "attacking"];
console.log(`\nxG per possession, by the third it started in. ${N} matches per cell per side, 75 v 75, 4-3-3.\n`);
for (const r of res) {
  const per = [0,1,2].map(b => r.xg[b] / Math.max(1, r.np[b]));
  console.log(`  ${r.label}`);
  console.log(`     zone        xG/poss   real     poss/match   length   gained   reached f3   shot|reached`);
  for (let b = 0; b < 3; b++)
    console.log(`     ${Z[b].padEnd(11)} ${f3(per[b]).padStart(7)}  ${["~0.015","~0.035","~0.09"][b].padStart(6)}` +
      `   ${f1(r.np[b] / r.n).padStart(8)}   ${f1(r.secs[b] / Math.max(1, r.np[b]) * ME_DT).padStart(5)}s` +
      `   ${f1(r.gain[b] / Math.max(1, r.np[b])).padStart(5)} m   ` +
      `${f1(100 * r.reach[b] / Math.max(1, r.np[b])).padStart(7)}%   ` +
      `${f2(r.shots[b] / Math.max(1, r.reach[b])).padStart(9)}`);
  // Normalised on the MIDDLE third, not the own third -- the deep number is so close to zero that
  // dividing by it turns sampling noise into a headline.
  console.log(`     how the move died:  ` + [0,1,2].map(b => {
    const T = r.endT[b] + r.endC[b] + r.endD[b] || 1;
    return `${Z[b]} ${f1(100*r.endT[b]/T)}% tackled / ${f1(100*r.endC[b]/T)}% cut out`;
  }).join("   "));
  console.log(`     against the middle third   ${(per[0] / Math.max(1e-9, per[1])).toFixed(2)} : 1 : ` +
    `${(per[2] / Math.max(1e-9, per[1])).toFixed(2)}      real is about 0.43 : 1 : 2.6` +
    `      [${f2(r.gTot / r.n)} goals, ${f2(r.xgTot / r.n)} xG a match]\n`);
}
