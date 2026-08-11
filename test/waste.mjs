// DOES TIME-WASTING ACTUALLY WASTE TIME, AND DOES IT COST ANYTHING?
//
// It used to add two slices to a man's touch budget, which in an engine with no scoreboard is a pure
// benefit -- more time to look up, nothing charged for it -- and it measured as a 0.91 goal buff at a
// setting called "Constantly". It is now what it is in the real game: a side in front takes an age
// over every goal kick, throw-in, free kick and corner, and the referee eventually books somebody.
//
// Three things have to be true for that to be a tactic rather than a cheat, and this checks all of
// them: the clock has to actually come down (dead time is only added back at addedFrac, 0.55), the
// bookings have to actually arrive, and the scoreline has to stay flat.
//
//   node test/waste.mjs
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meAdded,
        ME_MATCH_TICKS, ME_TPM, STRAT_DEF } = eng;

const sq = (o, f) => buildSquad(f, null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0, xgS: { home: 0, away: 0 },
  yellows: { home: 0, away: 0 }, reds: { home: 0, away: 0 } });

const N = +(process.env.N || 24);
const VALS = [0, 1, 2];

function play(v) {
  const A = { g: 0, ga: 0, xg: 0, xga: 0, yc: 0, ycOpp: 0, rc: 0, n: 0,
              inplay: 0, added: 0, twYc: 0, ahead: 0 };
  for (const SIDE of ["home", "away"]) {
  for (let seed = 1; seed <= N; seed++) {
    const s = createMatchState(), OTH = SIDE === "home" ? "away" : "home";
    s.players.home = sq(75, "4-3-3"); s.players.away = sq(75, "4-3-3");
    s.formations = { home: "4-3-3", away: "4-3-3" };
    s.strategy = { home: { ...STRAT_DEF, ...(SIDE === "home" ? { timeWasting: v } : {}) },
                   away: { ...STRAT_DEF, ...(SIDE === "away" ? { timeWasting: v } : {}) } };
    s.possession = "home"; meInit(s, pitchSlots);
    const out = blank(), rng = new RNG(seed);
    for (let t = 0; t < ME_MATCH_TICKS; t++) {
      meTick(s, rng, out);
      if (out.goals[SIDE] > out.goals[OTH]) A.ahead++;
    }
    for (let t = 0, add = meAdded(s); t < add; t++) meTick(s, rng, out);
    A.added += meAdded(s);
    A.g += out.goals[SIDE]; A.ga += out.goals[OTH];
    A.xg += out.xgS[SIDE]; A.xga += out.xgS[OTH];
    A.yc += out.yellows[SIDE]; A.ycOpp += out.yellows[OTH]; A.rc += out.reds[SIDE];
    A.inplay += out.inplay; A.twYc += out.wasteYc || 0; A.n++;
  }
  }
  return A;
}

const res = await parMap(VALS, play);
if (!res) process.exit(0);

const f2 = (x) => x.toFixed(2), f1 = (x) => x.toFixed(1);
const LBL = ["Never", "Sometimes", "Constantly"];
console.log(`\ntimeWasting, rebuilt as dawdling over restarts. ${N} matches per setting per side, 75 v 75.\n`);
console.log(`  setting        goals   conc     xG    xGa    xGD      ball in play   added time   yellows   reds`);
console.log(`  -----------   ------  -----  -----  -----  ------     ------------   ----------   -------   ----`);
for (let i = 0; i < VALS.length; i++) {
  const A = res[i], n = A.n;
  console.log(`  ${LBL[i].padEnd(11)}   ${f2(A.g/n).padStart(6)}  ${f2(A.ga/n).padStart(5)}  ` +
    `${f2(A.xg/n).padStart(5)}  ${f2(A.xga/n).padStart(5)}  ${((A.xg-A.xga)/n>=0?"+":"") + f2((A.xg-A.xga)/n)}` +
    `        ${f1(100*A.inplay/(n*ME_MATCH_TICKS)).padStart(6)}%    ` +
    `${f1(A.added/n/ME_TPM).padStart(7)} min   ${f2(A.yc/n).padStart(6)}   ${f2(A.rc/n).padStart(4)}`);
}
console.log(`\n  of those yellows, booked specifically for time-wasting, per match:`);
for (let i = 0; i < VALS.length; i++)
  console.log(`     ${LBL[i].padEnd(11)} ${f2(res[i].twYc / res[i].n).padStart(5)}` +
    `      (in front for ${f1(100 * res[i].ahead / (res[i].n * ME_MATCH_TICKS))}% of the match, which is when it applies)`);
console.log(`\n  xGD is the control: the instruction may burn clock and collect cards, it may not make the`);
console.log(`  side better. Ball in play should FALL and added time should RISE with the setting.`);
