// WHERE ON THE LADDER DOES AN INSTRUCTION GO WRONG?
//
// shape.mjs measures an instruction by its two ENDS, which is the right way to ask "is this a buff"
// and the wrong way to ask "why". A knob whose extremes read 1.1-2.8 and 2.0-1.2 could be a low end
// that is broken, a high end that is a cheat, or a smooth slope that is simply too steep -- and the
// three want completely different fixes. So this walks every setting the UI actually offers and
// prints what the side does at each one.
//
// The extra column is the one that matters for both confirmed buffs. Football punishes giving the
// ball away in your own half far more than anywhere else, so an instruction that changes WHERE you
// lose it changes how much you concede without changing how good you are. That is measured directly:
// every time possession flips, the opponent's xG over the next eight seconds is charged to the place
// on the pitch where it was lost.
//
//   node test/ladder.mjs passingDir
//   N=40 node test/ladder.mjs timeWasting
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meDir,
        ME_MATCH_TICKS, ME_DT, STRAT_DEF, PITCH_L } = eng;

const sq = (o, f) => buildSquad(f, null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0, xgS: { home: 0, away: 0 },
  offside: { home: 0, away: 0 } });

// The ranges the UI actually offers (App.tsx:713). Anything not listed is a plain -1/0/+1.
const RANGE = { passingDir: [-2,-1,0,1,2], pressingLOE: [-2,-1,0,1,2], defLine: [-2,-1,0,1,2],
                timeWasting: [0,1,2], dlBehavior: [-1,0,1,2], setPieces: [0,1] };

const KEY = process.argv[2];
if (!KEY) { console.log("usage: node test/ladder.mjs <instruction>"); process.exit(1); }
const VALS = RANGE[KEY] || [-1, 0, 1];
const N = +(process.env.N || 24);
const WIN = +(process.env.WIN || 32);  // how long a turnover stays the turnover's fault, in slices

function play(v) {
  const A = { g: 0, ga: 0, xg: 0, xga: 0, cmp: 0, cmpN: 0, n: 0,
              lost: [0, 0, 0], lostXg: [0, 0, 0],   // own third / middle / final third
              won: [0, 0, 0], holdT: 0, holdN: 0, sh: 0, sha: 0, offFor: 0, offAgainst: 0 };
  for (const SIDE of ["home", "away"]) {
  for (let seed = 1; seed <= N; seed++) {
    const s = createMatchState(), OTH = SIDE === "home" ? "away" : "home";
    s.players.home = sq(75, "4-3-3"); s.players.away = sq(75, "4-3-3");
    s.formations = { home: "4-3-3", away: "4-3-3" };
    s.strategy = { home: { ...STRAT_DEF, ...(SIDE === "home" ? { [KEY]: v } : {}) },
                   away: { ...STRAT_DEF, ...(SIDE === "away" ? { [KEY]: v } : {}) } };
    s.possession = "home"; meInit(s, pitchSlots);
    const out = blank(), rng = new RNG(seed);
    const dir = meDir(SIDE);
    const ax = (x) => dir > 0 ? x : PITCH_L - x;          // 0 = our goal line, 105 = theirs
    const band = (x) => x < PITCH_L / 3 ? 0 : x < PITCH_L * 2 / 3 ? 1 : 2;
    let held = null, open = [];                          // turnover windows still being charged
    for (let t = 0; t < ME_MATCH_TICKS; t++) {
      const mp = s.mePos;
      const ctrl = mp.idx >= 0 ? mp.side : null;
      const xg0 = out.xgS[OTH];
      // a turnover: the ball was ours and is now theirs, in open play
      if (ctrl && ctrl !== held) {
        if (held === SIDE && ctrl === OTH) { const b = band(ax(mp.bx)); A.lost[b]++; open.push([b, WIN]); }
        if (ctrl === SIDE && held === OTH) A.won[band(ax(mp.bx))]++;
        held = ctrl;
      }
      if (ctrl === SIDE) { A.holdT++; }
      meTick(s, rng, out);
      // charge whatever they created back to where we gave it to them
      const d = out.xgS[OTH] - xg0;
      if (d > 0) for (const w of open) A.lostXg[w[0]] += d;
      if (open.length) { for (const w of open) w[1]--; open = open.filter(w => w[1] > 0); }
    }
    A.g += out.goals[SIDE]; A.ga += out.goals[OTH];
    A.xg += out.xgS[SIDE]; A.xga += out.xgS[OTH];
    A.sh += out.shots[SIDE]; A.sha += out.shots[OTH];
    A.cmp += out.passOk; A.cmpN += out.passOk + out.passFail;
    // offsides this side FORCED (the opponent caught) and conceded
    A.offFor += out.offside?.[OTH] || 0; A.offAgainst += out.offside?.[SIDE] || 0;
    A.n++;
  }
  }
  return A;
}

const res = await parMap(VALS, play);
if (!res) process.exit(0);

const f2 = (x) => x.toFixed(2), f1 = (x) => x.toFixed(1);
console.log(`\n${KEY}, every setting the UI offers. ${N} matches per setting per side, 75 v 75, 4-3-3.\n`);
console.log(`  set   goals    conc     xG     xGa    shots  cmp%   offs won  offs conceded    possessions lost, by third`);
console.log(`  ---  ------  ------  ------  ------   -----  ----   --------  -------------    own    mid    final`);
for (let i = 0; i < VALS.length; i++) {
  const A = res[i], n = A.n, L = A.lost[0] + A.lost[1] + A.lost[2];
  console.log(`  ${String(VALS[i]).padStart(3)}  ${f2(A.g/n).padStart(6)}  ${f2(A.ga/n).padStart(6)}  ` +
    `${f2(A.xg/n).padStart(6)}  ${f2(A.xga/n).padStart(6)}   ${f1(A.sh/n).padStart(5)}  ` +
    `${f1(100*A.cmp/(A.cmpN||1)).padStart(4)}   ${f2(A.offFor/n).padStart(8)}  ${f2(A.offAgainst/n).padStart(13)}    ` +
    A.lost.map(x => f1(100*x/(L||1)).padStart(5) + "%").join("  "));
}
console.log(`\n  WHAT IT COSTS TO LOSE IT THERE -- the opponent's xG over the ${(WIN*ME_DT).toFixed(0)}s after each turnover,`);
console.log(`  per turnover, so a setting that simply gives it away more often does not look worse here.`);
console.log(`  set     own third    middle    final third      turnovers/match   conceded xG/match`);
console.log(`  ---    ----------  ----------  -----------      ---------------   -----------------`);
for (let i = 0; i < VALS.length; i++) {
  const A = res[i], n = A.n, L = A.lost[0] + A.lost[1] + A.lost[2];
  console.log(`  ${String(VALS[i]).padStart(3)}    ` +
    [0,1,2].map(b => (A.lostXg[b] / Math.max(1, A.lost[b])).toFixed(3).padStart(9)).join("   ") +
    `        ${f1(L/n).padStart(6)}            ${f2(A.xga/n).padStart(6)}`);
}
console.log(``);
