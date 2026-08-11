// WHAT DOES THIS INSTRUCTION MAKE THE TEAM LOOK LIKE?
//
// The previous sweep scored goals and shots, which measures the bug: an instruction that raises your
// goals is not a tactic, it is a buff with a tactical label on it. A tactic changes a team's
// PLAYSTYLE -- where it has the ball, how far it hits it, how quickly it moves it, how wide it
// stands, where it wins it back -- and leaves how GOOD it is alone.
//
// So the shape numbers are the measurement and the outcome numbers are the CONTROL. An instruction
// passes when the shape moves hard and the scoreline does not.
//
//   node test/shape.mjs                 every instruction
//   node test/shape.mjs defLine         one of them
//   N=20 node test/shape.mjs            more matches
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meDir, meGoalX,
        ME_MATCH_TICKS, ME_DT, STRAT_DEF, PITCH_L, PITCH_W, ME_HALF_W } = eng;

const sq = (o, f) => buildSquad(f, null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0, xgS: { home: 0, away: 0 } });

// Everything is measured for HOME, in HOME's attacking frame: x runs 0 at his own goal line to
// PITCH_L at the one he is shooting at, whichever way he happens to be kicking.
const N = +(process.env.N || 12);
// NAME THE KNOBS YOU ACTUALLY NEED. The full board is 31 configurations; confirming one row is 4,
// and at the sample size that resolves a 0.5 threshold that is three minutes against twenty-two.
//   node test/shape.mjs                       the whole board
//   N=60 node test/shape.mjs defLine dribbling   just those two, properly resolved
const ONLY = process.argv.slice(2).filter(a => !a.startsWith("-"));

// EVERY CONFIGURATION IS PLAYED FROM BOTH ENDS. It used to be measured only as home, which left the
// whole sweep resting on an assumption nobody had checked -- that the two ends of the pitch are the
// same. They may not be: home kicks off with the ball. Running the instruction as away as well and
// pooling costs one more match per seed and removes the question, along with any interaction between
// the side and the instruction. It also doubles the sample, which is the thing being fought for here.
function play(cfg, seed0 = 0, f = "4-3-3", ovr = 75) {
  const A = { pd: [], fwd: [], thru: 0, high: 0, np: 0, setp: 0, // passes
              third: [0, 0, 0], flank: [0, 0, 0], np2: 0,        // where he has it
              rec: [], runT: [], runN: [], wide: [], deep: [],   // recovery, tempo, shape
              sd: [], sbox: 0, scen: 0, ns: 0,                   // shots
              sh: 0, cmp: 0, cmpN: 0,
              // ONE ENTRY PER MATCH, not a running total. The control is a difference between two
              // configurations and its error bar can only be computed from the individual matches,
              // which the old aggregate threw away -- so the noise floor was a formula rather than
              // a measurement, and five instructions were sitting under it unreadably.
              gg: [], cc: [], xx: [], xc: [] };
  for (const SIDE of ["home", "away"]) {
  for (let seed = seed0 + 1; seed <= seed0 + N; seed++) {
    const s = createMatchState();
    s.players.home = sq(ovr, f); s.players.away = sq(ovr, f);
    s.formations = { home: f, away: f };
    s.strategy = { home: { ...STRAT_DEF, ...(SIDE === "home" ? cfg : {}) },
                   away: { ...STRAT_DEF, ...(SIDE === "away" ? cfg : {}) } };
    s.possession = "home"; meInit(s, pitchSlots);
    const out = blank(), rng = new RNG(seed);
    const dir = meDir(SIDE), gx = meGoalX(SIDE);
    const ax = (x) => dir > 0 ? x : PITCH_L - x;              // 0 = own line, 105 = his target
    const ay = (y) => dir > 0 ? y : PITCH_W - y;
    let held = null, runT = 0, runN = 0, lastIdx = -1, lastSide = null;

    for (let t = 0; t < ME_MATCH_TICKS; t++) {
      const mp = s.mePos;
      const b4x = mp.bx, b4y = mp.by, b4pend = mp.passPending, b4shot = mp.shot;
      const ctrl = mp.idx >= 0 ? mp.side : null;

      // ---- where he has it, and what he looks like while he has it
      if (ctrl === SIDE) {
        const px = ax(mp.bx);
        A.third[px < PITCH_L / 3 ? 0 : px < PITCH_L * 2 / 3 ? 1 : 2]++;
        const py = ay(mp.by);
        A.flank[py < PITCH_W / 3 ? 0 : py < PITCH_W * 2 / 3 ? 1 : 2]++;
        A.np2++;
        if (t % 4 === 0) {                                   // his SHAPE, not the ball's position
          const of = s.players[SIDE].filter(p => p.pos !== "GK");
          const my = of.reduce((a, p) => a + p.y, 0) / of.length;
          A.wide.push(Math.sqrt(of.reduce((a, p) => a + (p.y - my) ** 2, 0) / of.length));
          A.deep.push(Math.max(...of.map(p => p.x)) - Math.min(...of.map(p => p.x)));
        }
      }
      // ---- possession runs and where he wins it back
      if (ctrl) {
        if (ctrl !== held) {
          if (held === SIDE) { A.runT.push(runT); A.runN.push(runN); }
          if (ctrl === SIDE) { A.rec.push(ax(mp.bx)); runT = 0; runN = 0; }
          held = ctrl;
        }
        if (ctrl === SIDE) { runT++; if (mp.idx !== lastIdx || mp.side !== lastSide) runN++; }
      }
      lastIdx = mp.idx; lastSide = mp.side;

      meTick(s, rng, out);

      // ---- a pass was struck this slice. Its length is carried on the pending record; its
      // direction is simply the way the ball left, which needs no engine internals at all.
      // A set-piece delivery is not a pass and carries no length (setpiece.ts:294 records only the
      // side), so it is counted apart rather than silently averaged in as a zero.
      if (!b4pend && mp.passPending && mp.passPending.side === SIDE) {
        const pp = mp.passPending, sp = Math.hypot(mp.bvx, mp.bvy);
        if (!Number.isFinite(pp.d)) A.setp++;
        else {
          A.pd.push(pp.d); A.np++;
          if (pp.thru) A.thru++; if (pp.high) A.high++;
          if (sp > 0.01) A.fwd.push(pp.d * (mp.bvx / sp) * dir); // forward metres this ball gains
        }
      }
      // ---- and a shot
      if (!b4shot && mp.shot && mp.shot.side === SIDE) {
        A.sd.push(Math.hypot(gx - b4x, ME_HALF_W - b4y)); A.ns++;
        if (Math.abs(gx - b4x) < 16.5 && Math.abs(b4y - ME_HALF_W) < 20.2) A.sbox++;
        if (Math.abs(b4y - ME_HALF_W) < 9.16) A.scen++;
      }
    }
    const OTH = SIDE === "home" ? "away" : "home";
    A.gg.push(out.goals[SIDE]); A.cc.push(out.goals[OTH]);
    A.xx.push(out.xgS[SIDE]);   A.xc.push(out.xgS[OTH]);
    A.sh += out.shots[SIDE];
    A.cmp += out.passOk; A.cmpN += out.passOk + out.passFail;
  }
  }
  const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  const pc = (a, b) => 100 * a / (b || 1);
  return {
    passLen:  mean(A.pd),
    passShort: pc(A.pd.filter(d => d < 12).length, A.np),
    passLong: pc(A.pd.filter(d => d > 25).length, A.np),
    lofted:   pc(A.high, A.np),
    through:  pc(A.thru, A.np),
    fwdM:     mean(A.fwd),
    backPc:   pc(A.fwd.filter(d => d < -1).length, A.fwd.length),
    ownThird: pc(A.third[0], A.np2), finThird: pc(A.third[2], A.np2),
    wingPc:   pc(A.flank[0] + A.flank[2], A.np2),
    recovX:   mean(A.rec),
    possSec:  mean(A.runT) * ME_DT,
    possTch:  mean(A.runN),
    width:    mean(A.wide),
    depth:    mean(A.deep),
    shotDist: mean(A.sd),
    shotBox:  pc(A.sbox, A.ns), shotCen: pc(A.scen, A.ns),
    _goals: mean(A.gg), _conc: mean(A.cc), _xg: mean(A.xx), _xc: mean(A.xc),
    _shots: A.sh / A.gg.length, _cmp: pc(A.cmp, A.cmpN),
    _open: A.np / A.gg.length, _setp: A.setp / A.gg.length,
    _rG: A.gg, _rC: A.cc, _rX: A.xx, _rXc: A.xc,   // per match, for the error bars
  };
}

// Every shape number, with the span it is allowed to swing over so the knobs are comparable.
// The span is "what a whole match could plausibly differ by", not a standard deviation -- it only
// has to be the same for both ends of the same knob.
const SHAPE = [
  ["passLen",  "pass length m",  8], ["passShort", "short <12m %",  25],
  ["passLong", "long >25m %",   15], ["lofted",    "lofted %",      20],
  ["through",  "through %",      8], ["fwdM",      "fwd m/pass",     5],
  ["backPc",   "backward %",    20], ["ownThird",  "own third %",   25],
  ["finThird", "final third %", 25], ["wingPc",    "wide areas %",  25],
  ["recovX",   "win-back x m",  15], ["possSec",   "poss length s",  4],
  ["possTch",  "touches/poss",   3], ["width",     "team width m",   6],
  ["depth",    "team depth m",  12], ["shotDist",  "shot dist m",    8],
  ["shotBox",  "shots in box %",25], ["shotCen",   "shots central %",25],
];
// The two ends of each knob, and they are THE UI's ends -- App.tsx:713 owns the real ranges and this
// list was guessing at four of them. timeWasting runs 0..2 and was being swept -1..1, so a third of
// its span was an impossible setting and "Constantly" was never measured at all; dlBehavior runs
// -1..2 and the missing 2 is the offside trap, which is the one setting that now has a rule behind
// it; setPieces runs 0..1; tackling runs -1..1 and was being pushed to +-2.
const KNOBS = [["passingDir",-2,2],["chanceCreation",-1,1],["pressingLOE",-2,2],["defLine",-2,2],
  ["possWon",-1,1],["approachPlay",-1,1],["dribbling",-1,1],["creativity",-1,1],
  ["timeWasting",0,2],["possLost",-1,1],["gkDist",-1,1],["dlBehavior",-1,2],["tackling",-1,1]];

// Every configuration up front, so the whole sweep is one parallel map instead of 29 serial runs.
// Nothing is printed before this point: a worker's stray stdout would be relayed as a stray log.
const USE = KNOBS.filter(([k]) => !ONLY.length || ONLY.includes(k));
if (ONLY.length && USE.length !== ONLY.length)
  console.log(`  (no such knob: ${ONLY.filter(k => !KNOBS.some(([x]) => x === k)).join(", ")})`);
// THE NOISE FLOOR OF STYLE ITSELF. STYLE is a mean of ABSOLUTE movements, so noise can only ever
// add to it: two runs of the identical configuration score above zero purely because the matches
// were different ones. Without this number a row reading 4.5 cannot be told from a row reading 0,
// and six instructions currently sit in that band. So the last cell is the neutral configuration
// played again on a fresh set of seeds, and whatever STYLE it scores against itself is the floor.
const CFGS = [{}, ...USE.flatMap(([k, lo, hi]) => [{ [k]: lo }, { [k]: hi }]), {}];
const R = await parMap(CFGS, (c, i) => play(c, i === CFGS.length - 1 ? N : 0));
if (!R) process.exit(0);

const f1 = (x) => x.toFixed(1);
const TARGET = +(process.env.TARGET || 0.5);
const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const stderr = (a) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1) / a.length);
};
const base = R[0];
const XG2G = (base._goals + base._conc) / Math.max(1e-9, base._xg + base._xc);
console.log(`\n${N} matches per configuration, 75 v 75, 4-3-3 both sides. Everything is HOME's, in HOME's attacking frame.\n`);
console.log(`NEUTRAL  ` + SHAPE.map(([k, l]) => `${l} ${f1(base[k])}`).join("  "));
console.log(`         goals ${f1(base._goals)}-${f1(base._conc)}  shots ${f1(base._shots)}  completion ${f1(base._cmp)}%` +
            `   [${f1(base._open)} open-play passes a match measured, ${f1(base._setp)} set-piece deliveries excluded]\n`);
console.log(`${"".padEnd(16)} STYLE   EDGE  +- err   verdict      OPEN    (goals edge)`);
console.log(`${"".padEnd(16)} -----  -----  ------   -------     -----    -----------`);

// One scorer, used for the real knobs and for the null, so the floor is measured the same way the
// thing above it is. Anything else and the comparison is worthless.
function score(a, b) {
  const moves = SHAPE.map(([m, lbl, span]) => ({ m, lbl, d: (b[m] - a[m]) / span, a: a[m], b: b[m] }))
                     .sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
  const style = moves.reduce((s, x) => s + Math.abs(x.d), 0) / moves.length * 100;
  const dz = a._rX.map((_, i) => (b._rX[i] - b._rXc[i]) - (a._rX[i] - a._rXc[i]));
  const dg = a._rG.map((_, i) => (b._rG[i] - b._rC[i]) - (a._rG[i] - a._rC[i]));
  return { style, moves,
           edge: Math.abs(mean(dz)) * XG2G, se: stderr(dz) * XG2G,
           gEdge: Math.abs(mean(dg)), gSe: stderr(dg),
           open: (b._xg + b._xc) - (a._xg + a._xc) };
}

const NULL = score(R[0], R[R.length - 1]);

const rows = [];
USE.forEach(([k, lo, hi], ki) => {
  const a = R[1 + ki * 2], b = R[2 + ki * 2];
  // STYLE: how far the team's shape moved, as a fraction of each metric's plausible span.
  // POWER: how far its STRENGTH moved. The first should be large and the second should not.
  // EDGE is what the manager gains. It is read from xG rather than goals and rescaled into goal
  // units: same question, slightly less noise, and measured rather than assumed -- the error bars
  // printed underneath say how much less, which turned out to be far less than hoped.
  const { style, moves, edge, se, gEdge, gSe, open } = score(a, b);
  const power = edge;
  const shown = moves.filter(x => Math.abs(x.d) > 0.12).slice(0, 4)
    .map(x => `${x.lbl} ${f1(x.a)}->${f1(x.b)}`).join(", ") || "nothing";
  rows.push({ k, style, power, edge, se, gEdge, gSe, open, shown, a, b });
});
rows.sort((x, y) => y.style - x.style);
console.log(`${"(noise floor)".padEnd(16)} ${f1(NULL.style).padStart(5)}  ${NULL.edge.toFixed(2).padStart(5)}  ` +
            `+-${NULL.se.toFixed(2)}   ${"--".padEnd(12)}${(NULL.open >= 0 ? "+" : "") + NULL.open.toFixed(2)}`.padStart(5) +
            `    ${NULL.gEdge.toFixed(2)}`);
console.log(`${"".padEnd(16)} .....  .....  ......   .......     .....    ...........`);
// An instruction is only a buff if it beats the target by more than the error bar can explain.
for (const r of rows) {
  const v = r.edge - 2 * r.se > TARGET ? "BUFF"
          : r.edge + 2 * r.se < TARGET ? "ok" : "unresolved";
  console.log(`${r.k.padEnd(16)} ${f1(r.style).padStart(5)}  ${r.edge.toFixed(2).padStart(5)}  ` +
    `+-${r.se.toFixed(2)}   ${v.padEnd(12)}` +
    `${(r.open >= 0 ? "+" : "") + r.open.toFixed(2)}`.padStart(5) +
    `    ${r.gEdge.toFixed(2)}`);
}
console.log(``);
for (const r of rows) console.log(`  ${r.k.padEnd(16)} ${r.shown}`);

console.log(`\nSTYLE  mean movement across 18 shape metrics, as % of each one's plausible span. Higher is more distinctive.`);
console.log(`       The noise floor is the SAME configuration played on a different set of seeds, scored identically.`);
console.log(`       A row within about ${(NULL.style * 1.5).toFixed(1)} of it has not been shown to change the team's shape at all.`);
console.log(`EDGE   how much xG DIFFERENCE the instruction bought. This is the CONTROL and the target is under ${TARGET}.`);
console.log(`       +- err is the real standard error of that difference over ${2 * N} paired matches, not a formula.`);
console.log(`       BUFF / ok / unresolved compares EDGE against ${TARGET} with two standard errors of room either way.`);
console.log(`OPEN   how much more xG the match produced at BOTH ends. This is a style, not a buff -- it may move freely.`);
console.log(`\nxG CALIBRATION  the proxy is only worth using if it tracks the thing it stands in for.`);
console.log(`   neutral, per side:  ${f1(base._xg)} raw xG for, ${f1(base._xc)} against` +
            `   against  ${f1(base._goals)} goals for, ${f1(base._conc)} against`);
console.log(`   the engine's own shot probability accounts for 1 goal in ${XG2G.toFixed(2)}, so every EDGE`);
console.log(`   above is multiplied by that to put it back in goal units.`);
console.log(`   worst disagreement between the xG edge and the goals edge across the sweep: ` +
            `${Math.max(...rows.map(r => Math.abs(r.edge - r.gEdge))).toFixed(2)}`);
{
  const mSe = mean(rows.map(r => r.se)), mGse = mean(rows.map(r => r.gSe));
  console.log(`\n   error bar on the SAME difference:  ${mSe.toFixed(3)} measured in xG   ` +
              `${mGse.toFixed(3)} measured in goals   (xG is ${(mGse / Math.max(1e-9, mSe)).toFixed(2)}x tighter)`);
  console.log(`   matches per end needed for an error bar of 0.15:  ` +
              `${Math.ceil(2 * N * (mSe / 0.15) ** 2 / 2)} using xG,  ` +
              `${Math.ceil(2 * N * (mGse / 0.15) ** 2 / 2)} using goals`);
}
console.log(`\na good instruction is high STYLE, low POWER. high POWER is a buff wearing a tactic's name.`);
