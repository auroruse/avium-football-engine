// Shootouts in isolation, the same trick as test/pensim.mjs -- four a season is not a sample.
// Real: about 75% of kicks are scored, and a shootout runs 9-11 kicks.
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meShootout, STRAT_DEF } = eng;
const sq = (o) => buildSquad("4-3-3", null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, offTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0},
  fouls:{home:0,away:0}, passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0,
  blocked:0, woodwork:0, shotDist: new Array(10).fill(0), xg: 0 });
const T = +(process.env.TRIALS || 150);
function run(k0) {
  let kicks = 0, sc = 0, undecided = 0, n = 0, matchGoals = 0, matchShots = 0;
  for (let k = k0; k < k0 + T; k++) {
    const s = createMatchState();
    s.players.home = sq(75); s.players.away = sq(75);
    s.formations = { home: "4-3-3", away: "4-3-3" };
    s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
    s.possession = "home"; meInit(s, pitchSlots);
    const out = blank(), rng = new RNG(k + 1);
    const r = meShootout(s, rng, out);
    kicks += r.kicks; sc += r.home + r.away; if (!r.winner) undecided++; n++;
    matchGoals += out.goals.home + out.goals.away;
    matchShots += out.shots.home + out.shots.away;
  }
  return { kicks, sc, undecided, n, matchGoals, matchShots };
}
const res = await parMap([0, T, 2*T, 3*T], run);
if (!res) process.exit(0);
const S = res.reduce((a, r) => ({ kicks: a.kicks+r.kicks, sc: a.sc+r.sc, undecided: a.undecided+r.undecided,
  n: a.n+r.n, matchGoals: a.matchGoals+r.matchGoals, matchShots: a.matchShots+r.matchShots }));
console.log(`\n${S.n} shootouts.\n`);
console.log(`  kicks per shootout   ${(S.kicks/S.n).toFixed(1)}      real 9-11`);
console.log(`  conversion           ${(100*S.sc/S.kicks).toFixed(1)}%    real ~75%`);
console.log(`  undecided            ${S.undecided}`);
console.log(`\n  leaked into the match scoreline: ${S.matchGoals} goals, ${S.matchShots} shots   (must be 0)`);
