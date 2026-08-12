// HOW MUCH DOES THE SAME FIXTURE VARY?
//
// The complaint is that the same two teams open the match the same way every time. This is the
// measurement that says whether that is true and, after any fix, whether it stopped being true.
// Same teams, N different seeds, and count how much of the opening is actually shared.
//
// Careful about what "varied" means. Two matches diverging is NOT the same as two matches being
// different in a way a viewer would notice: micro-noise in a pass's execution changes every
// coordinate downstream while the match still LOOKS identical -- same man on the ball, same first
// pass, same shape. So this counts things a viewer could name:
//
//   opening N touches   the sequence of (side, player) that touch the ball. Two matches sharing a
//                       prefix of six touches share the whole opening exchange.
//   first pass          who played it and who received it.
//   time to divergence  the first tick at which any player is more than a metre from where he was
//                       in the reference match. A metre is about a stride: below that nobody could
//                       tell the two matches apart by eye.
//   whole-match variety scorelines, and the spread of shots and possession, so a fix can be checked
//                       for not merely reshuffling the opening while the match still converges.
//
//   node test/variety.mjs            N=40 seeds
//   N=80 node test/variety.mjs
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meAdded,
        ME_MATCH_TICKS, ME_DT, STRAT_DEF } = eng;

const sq = (o, f) => buildSquad(f, null).map((p, i) => ({ ...p, name: p.pos + i, ovr: o,
  stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0, xgS: { home: 0, away: 0 } });

const N = +(process.env.N || 40);
const TOUCHES = 8;          // how deep an opening sequence to fingerprint
const TRACK = 240;          // ticks of position history kept for the divergence comparison

function run(seed) {
  const s = createMatchState();
  const hs = sq(78, "4-3-3"), as = sq(76, "4-2-3-1");
  s.players.home = hs.filter(p => !p.bench); s.bench.home = hs.filter(p => p.bench);
  s.players.away = as.filter(p => !p.bench); s.bench.away = as.filter(p => p.bench);
  s.formations = { home: "4-3-3", away: "4-2-3-1" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home";
  const out = blank(), rng = new RNG(seed);
  // FLAT=1 restores the old deterministic kickoff, so the two can be compared on the same seeds.
  meInit(s, pitchSlots, process.env.FLAT ? undefined : rng);

  const touches = [];
  let lastHolder = null;
  const trail = [];                    // per tick: flat array of all 22 x/y, for TRACK ticks
  const start = [];
  for (const sd of ["home", "away"]) for (const p of s.players[sd]) start.push(p.x, p.y);

  for (let t = 0; t < ME_MATCH_TICKS + 400; t++) {
    const mp = s.mePos;
    meTick(s, rng, out);
    if (t < TRACK) {
      const row = [];
      for (const sd of ["home", "away"]) for (const p of s.players[sd]) row.push(p.x, p.y);
      trail.push(row);
    }
    if (!mp.sp && mp.idx >= 0) {
      const who = `${mp.side}:${mp.idx}`;
      if (who !== lastHolder) { if (touches.length < TOUCHES) touches.push(who); lastHolder = who; }
    }
    if (t >= ME_MATCH_TICKS + meAdded(s)) break;
  }
  const pT = out.poss.home + out.poss.away || 1;
  return { seed, start, trail, touches,
           line: `${out.goals.home}-${out.goals.away}`,
           goals: out.goals.home + out.goals.away,
           shots: out.shots.home + out.shots.away,
           poss: out.poss.home / pT };
}

const res = await parMap(Array.from({ length: N }, (_, i) => i * 7919 + 13), run);
if (!res) process.exit(0);

const uniq = (a) => new Set(a).size;
const f1 = (x) => x.toFixed(1), f2 = (x) => x.toFixed(2);
const pc = (n, d) => (100 * n / (d || 1)).toFixed(0) + "%";

// ---- starting shape
let startSame = 0;
for (let i = 1; i < res.length; i++) {
  let same = true;
  for (let k = 0; k < res[0].start.length; k++)
    if (Math.abs(res[0].start[k] - res[i].start[k]) > 1e-9) { same = false; break; }
  if (same) startSame++;
}

// ---- how deep does the shared opening sequence run, pairwise against the first match
const prefix = [];
for (let i = 1; i < res.length; i++) {
  let k = 0;
  while (k < TOUCHES && res[0].touches[k] && res[0].touches[k] === res[i].touches[k]) k++;
  prefix.push(k);
}

// ---- first tick at which anybody is more than a metre from the reference match
const diverge = [];
for (let i = 1; i < res.length; i++) {
  let d = -1;
  const a = res[0].trail, b = res[i].trail;
  for (let t = 0; t < Math.min(a.length, b.length); t++) {
    let worst = 0;
    for (let k = 0; k < a[t].length; k += 2) {
      const dd = Math.hypot(a[t][k] - b[t][k], a[t][k + 1] - b[t][k + 1]);
      if (dd > worst) worst = dd;
    }
    if (worst > 1.0) { d = t; break; }
  }
  diverge.push(d < 0 ? TRACK : d);
}

const med = (arr) => { const b = [...arr].sort((x, y) => x - y); return b.length ? b[b.length >> 1] : 0; };

console.log(`\n${N} matches, same two teams (78 4-3-3 v 76 4-2-3-1), ${N} different seeds.\n`);
console.log(`  THE OPENING`);
console.log(`    starting shape identical to match 1     ${pc(startSame, N - 1)}   want 0%`);
console.log(`    distinct first ball-carriers            ${uniq(res.map(r => r.touches[0]))} of ${N}`);
console.log(`    distinct first-to-second touch pairs    ${uniq(res.map(r => r.touches.slice(0, 2).join(">")))} of ${N}`);
console.log(`    distinct opening ${TOUCHES}-touch sequences      ${uniq(res.map(r => r.touches.join(">")))} of ${N}   want ~${N}`);
console.log(`    shared opening touches with match 1     median ${med(prefix)} of ${TOUCHES}   want 0-1`);
console.log(`    first tick anyone is >1 m adrift        median ${med(diverge)}  (${f2(med(diverge) * ME_DT)} s)   want <8`);
console.log(`\n  THE WHOLE MATCH`);
console.log(`    distinct scorelines                     ${uniq(res.map(r => r.line))} of ${N}`);
console.log(`    shots, spread                           ${f1(Math.min(...res.map(r => r.shots)))} to ${f1(Math.max(...res.map(r => r.shots)))}`);
console.log(`    home possession, spread                 ${pc(Math.min(...res.map(r => r.poss)), 1)} to ${pc(Math.max(...res.map(r => r.poss)), 1)}`);
// A RANGE is the worst possible spread statistic -- it is the max of N draws and grows with N no
// matter what the distribution does, so comparing ranges across two runs says almost nothing.
// Standard deviation is the honest one.
const sd = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length;
  return Math.sqrt(a.reduce((x, y) => x + (y - m) * (y - m), 0) / a.length); };
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
console.log(`    goals per match      mean ${mean(res.map(r => r.goals)).toFixed(2)}  sd ${sd(res.map(r => r.goals)).toFixed(2)}`);
console.log(`    shots per match      mean ${mean(res.map(r => r.shots)).toFixed(1)}  sd ${sd(res.map(r => r.shots)).toFixed(1)}`);
console.log(`    home possession      mean ${pc(mean(res.map(r => r.poss)), 1)}  sd ${(100 * sd(res.map(r => r.poss))).toFixed(1)}pp`);
console.log(`\n  A viewer cannot see a coordinate. He can see who got the ball and where it went, so`);
console.log(`  the opening-sequence row is the one that matters -- divergence in the physics while`);
console.log(`  the same men make the same moves is not variety.`);
