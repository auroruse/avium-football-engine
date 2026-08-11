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
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meDir, meGoalX,
        ME_MATCH_TICKS, ME_DT, STRAT_DEF, PITCH_L, PITCH_W, ME_HALF_W } = eng;

const sq = (o, f) => buildSquad(f, null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0 });

// Everything is measured for HOME, in HOME's attacking frame: x runs 0 at his own goal line to
// PITCH_L at the one he is shooting at, whichever way he happens to be kicking.
const N = +(process.env.N || 12), ONLY = process.argv[2] || null;
const SIDE = "home";

function play(hStrat, aStrat, f = "4-3-3", ovr = 75) {
  const A = { pd: [], fwd: [], thru: 0, high: 0, np: 0, setp: 0, // passes
              third: [0, 0, 0], flank: [0, 0, 0], np2: 0,        // where he has it
              rec: [], runT: [], runN: [], wide: [], deep: [],   // recovery, tempo, shape
              sd: [], sbox: 0, scen: 0, ns: 0,                   // shots
              g: 0, ga: 0, sh: 0, xg: 0, cmp: 0, cmpN: 0 };
  for (let seed = 1; seed <= N; seed++) {
    const s = createMatchState();
    s.players.home = sq(ovr, f); s.players.away = sq(ovr, f);
    s.formations = { home: f, away: f };
    s.strategy = { home: { ...STRAT_DEF, ...hStrat }, away: { ...STRAT_DEF, ...aStrat } };
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
    A.g += out.goals[SIDE]; A.ga += out.goals[SIDE === "home" ? "away" : "home"];
    A.sh += out.shots[SIDE]; A.xg += out.xg || 0;
    A.cmp += out.passOk; A.cmpN += out.passOk + out.passFail;
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
    _goals: A.g / N, _conc: A.ga / N, _shots: A.sh / N, _cmp: pc(A.cmp, A.cmpN),
    _open: A.np / N, _setp: A.setp / N,
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
const KNOBS = [["passingDir",-2,2],["chanceCreation",-1,1],["pressingLOE",-2,2],["defLine",-2,2],
  ["possWon",-1,1],["approachPlay",-1,1],["dribbling",-1,1],["creativity",-1,1],["setPieces",-1,1],
  ["timeWasting",-1,1],["possLost",-1,1],["gkDist",-1,1],["dlBehavior",-1,1],["tackling",-2,2]];

const f1 = (x) => x.toFixed(1);
const base = play({}, {});
console.log(`\n${N} matches per configuration, 75 v 75, 4-3-3 both sides. Everything is HOME's, in HOME's attacking frame.\n`);
console.log(`NEUTRAL  ` + SHAPE.map(([k, l]) => `${l} ${f1(base[k])}`).join("  "));
console.log(`         goals ${f1(base._goals)}-${f1(base._conc)}  shots ${f1(base._shots)}  completion ${f1(base._cmp)}%` +
            `   [${f1(base._open)} open-play passes a match measured, ${f1(base._setp)} set-piece deliveries excluded]\n`);
console.log(`${"".padEnd(16)} STYLE  POWER   the shape numbers that actually moved (low -> high)`);
console.log(`${"".padEnd(16)} -----  -----   ---------------------------------------------------`);

const rows = [];
for (const [k, lo, hi] of KNOBS) {
  if (ONLY && k !== ONLY) continue;
  const a = play({ [k]: lo }, {}), b = play({ [k]: hi }, {});
  // STYLE: how far the team's shape moved, as a fraction of each metric's plausible span.
  // POWER: how far its STRENGTH moved. The first should be large and the second should not.
  const moves = SHAPE.map(([m, lbl, span]) => ({ m, lbl, d: (b[m] - a[m]) / span, a: a[m], b: b[m] }))
                     .sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
  const style = moves.reduce((s, x) => s + Math.abs(x.d), 0) / moves.length * 100;
  const power = Math.abs(b._goals - a._goals) + Math.abs(b._conc - a._conc);
  const shown = moves.filter(x => Math.abs(x.d) > 0.12).slice(0, 4)
    .map(x => `${x.lbl} ${f1(x.a)}->${f1(x.b)}`).join(", ") || "nothing";
  rows.push({ k, style, power, shown, a, b });
}
rows.sort((x, y) => y.style - x.style);
for (const r of rows)
  console.log(`${r.k.padEnd(16)} ${f1(r.style).padStart(5)}  ${r.power.toFixed(2).padStart(5)}   ${r.shown}`);

console.log(`\nSTYLE  mean movement across 18 shape metrics, as % of each one's plausible span. Higher is more distinctive.`);
console.log(`POWER  goals scored plus goals conceded that the instruction moved. This is the CONTROL and it should be near zero.`);
console.log(`       At ${N} matches a POWER under about ${(1.2 * Math.sqrt(12 / N)).toFixed(1)} is indistinguishable from noise -- read it as flat.`);
console.log(`\na good instruction is high STYLE, low POWER. high POWER is a buff wearing a tactic's name.`);
