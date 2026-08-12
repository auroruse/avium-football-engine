// DOES THE KEEPER GET WORSE AT THE RIGHT RATE?
//
// Both sides are identical flat-75 outfields, so every shot faced is drawn from the same
// distribution. ONE keeper's OVR is varied; the other is pinned at 75 as the in-match control.
// Whatever separates the two goals-against columns is the keeper and nothing else.
//
// His channels, for reference: positioning width (gkPanic), the read on the strike (gkRead*),
// reaction + dive speed (gkReact/gkDive), come-out judgement (pace), distribution (meTech now).
// The catch-vs-parry split and parry firmness are pure geometry -- and meGkSkill is computed in
// the parry branch and read by nothing, which this harness exists to price.
//
// What "right" looks like: across a whole league a keeper is worth roughly 0.15-0.25 goals a match
// between the best and worst at the same level; across THREE leagues of span (90 down to 45) more
// like half a goal to a goal. Save percentage should visibly move: an elite keeper sits near 75%,
// a bad one nearer 60%.
//
//   node test/gkband.mjs
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meAdded, meGkSkill, meAttrs,
        ME_MATCH_TICKS, STRAT_DEF } = eng;

const sq = (o, f) => buildSquad(f, null).map((p, i) => ({ ...p, name: p.pos + i, ovr: o,
  stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0, xgS: { home: 0, away: 0 } });

const N = +(process.env.N || 24);
const GKS = [90, 75, 60, 45];

function play([gkOvr, seed]) {
  const s = createMatchState();
  const hs = sq(75, "4-3-3"), as = sq(75, "4-3-3");
  s.players.home = hs.filter(p => !p.bench); s.bench.home = hs.filter(p => p.bench);
  s.players.away = as.filter(p => !p.bench); s.bench.away = as.filter(p => p.bench);
  // The subject: home's keeper. The control: away's, left at 75.
  const gk = s.players.home.find(p => p.pos === "GK");
  gk.ovr = gkOvr; gk._att = null;
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  for (let t = 0; t < ME_MATCH_TICKS + 400; t++) {
    meTick(s, rng, out);
    if (t >= ME_MATCH_TICKS + meAdded(s)) break;
  }
  // Goals AGAINST the subject are away's goals; on-target he faced are away's on-target.
  return { gkOvr, sk: meGkSkill(meAttrs(gk)),
           subjGA: out.goals.away, subjOT: out.onTarget.away, subjXG: out.xgS.away,
           ctrlGA: out.goals.home, ctrlOT: out.onTarget.home, ctrlXG: out.xgS.home,
           subjSaves: out.saves.home, ctrlSaves: out.saves.away };
}

const jobs = [];
for (const g of GKS) for (let k = 0; k < N; k++) jobs.push([g, k + 1]);
const res = await parMap(jobs, play);
if (!res) process.exit(0);
const f2 = (x) => x.toFixed(2);
const pc = (n, d) => (100 * n / (d || 1)).toFixed(1) + "%";

console.log(`\n${N} matches a cell. 75-flat outfields both sides; only the SUBJECT keeper varies.`);
console.log(`Goals against him vs the identical control keeper at the other end.\n`);
console.log(`  GK ovr  gkSkill   conceded   control   diff      save%    ctrl     xG faced -> in`);
for (const g of GKS) {
  const c = res.filter(r => r.gkOvr === g);
  const S = (k) => c.reduce((a, r) => a + r[k], 0);
  console.log(`    ${String(g).padStart(2)}     ${f2(c[0].sk)}      ` +
    `${f2(S("subjGA") / N).padStart(5)}     ${f2(S("ctrlGA") / N).padStart(5)}   ` +
    `${(S("subjGA") / N - S("ctrlGA") / N >= 0 ? "+" : "") + f2(S("subjGA") / N - S("ctrlGA") / N)}   ` +
    `${pc(S("subjSaves"), S("subjOT")).padStart(7)}  ${pc(S("ctrlSaves"), S("ctrlOT")).padStart(6)}   ` +
    `${f2(S("subjXG") / N)} -> ${f2(S("subjGA") / N)}`);
}
console.log(`\n  diff is the keeper's whole worth per match at that rating. save% is his against the`);
console.log(`  control's, same shot pool. Real: ~0.15-0.25 goals between league-best and league-worst;`);
console.log(`  roughly half a goal to a goal across this whole span. Save% ~75% elite, ~60% poor.`);
