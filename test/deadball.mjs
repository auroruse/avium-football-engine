// DOES THE DEAD-BALL THEATRE ACTUALLY HAPPEN?
//
// Three things were added and all three are invisible to the regression, because none of them is
// supposed to change a single count: the ball is FETCHED to the spot instead of teleported onto it,
// a goal is CELEBRATED before anybody walks to a kickoff, and every restart rolls one of three
// routines with scatter on top so two corners are never the same corner.
//
// Invisible to the regression is exactly why this exists. It checks the mechanisms fire, and it
// checks the one thing that would be a real bug: that the ball is on the spot by the time somebody
// is allowed to strike it.
//
//   node test/deadball.mjs
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meAdded,
        ME_MATCH_TICKS, STRAT_DEF, CFG } = eng;

const sq = (o, f) => buildSquad(f, null).map((p, i) => ({ ...p, name: p.pos + i, ovr: o,
  stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0, xgS: { home: 0, away: 0 } });

const N = +(process.env.N || 24);

function run(seed) {
  const s = createMatchState();
  const hs = sq(75, "4-3-3"), as = sq(75, "4-3-3");
  s.players.home = hs.filter(p => !p.bench); s.bench.home = hs.filter(p => p.bench);
  s.players.away = as.filter(p => !p.bench); s.bench.away = as.filter(p => p.bench);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  const A = { td: [], fetchD: [], teleport: 0, offSpot: 0, taken: 0, celeb: 0, goals: 0,
              variant: [0, 0, 0], corners: [], mark: {} };
  let watch = null;
  for (let t = 0; t < ME_MATCH_TICKS + 400; t++) {
    const mp = s.mePos, wasSp = mp.sp;
    const bx0 = mp.bx, by0 = mp.by;
    meTick(s, rng, out);
    const sp = mp.sp;
    if (sp && sp !== wasSp) {                                    // a restart has just begun
      A.variant[sp.v]++;
      A.fetchD.push(Math.hypot(sp.x - sp.fx, sp.y - sp.fy));
      // Did the ball JUMP onto the spot in the slice the whistle went? NOT measured against the
      // pre-tick position -- the ball moves under its own physics in that same slice, and at pass
      // speed that is five metres, so comparing the two calls every hard pass a teleport. sp.fx/fy
      // is where meSPBegin found it, so the ball should still be sitting there.
      if (!sp.quick && Math.hypot(mp.bx - sp.fx, mp.by - sp.fy) > 0.3) { A.teleport++; A.mark[sp.kind]=(A.mark[sp.kind]||0)+1; (A.td=A.td||[]).push(+Math.hypot(mp.bx-sp.fx,mp.by-sp.fy).toFixed(2)); }
      if (sp.celeb) A.celeb++;
      watch = sp;
      // Where the attacking side stood at this corner, so two corners can be compared.
      if (sp.kind === "corner") A.corners.push(sp.v);
    }
    if (watch && sp !== watch) {                                 // ...and has just been taken
      A.taken++;
      // The ball has to be ON the spot by now: meSPTake strikes from sp.x/sp.y, so anything else
      // would be a visible jump at the moment of the kick.
      if (Math.hypot(bx0 - watch.x, by0 - watch.y) > 0.5) A.offSpot++;
      watch = null;
    }
    if (t >= ME_MATCH_TICKS + meAdded(s)) break;
  }
  A.goals = out.goals.home + out.goals.away;
  return A;
}

const res = await parMap(Array.from({ length: N }, (_, i) => i + 1), run);
if (!res) process.exit(0);
const S = (k) => res.reduce((a, r) => a + r[k], 0);
const f1 = (x) => x.toFixed(1), f2 = (x) => x.toFixed(2);
const fetchD = res.flatMap(r => r.fetchD);
const V = [0, 1, 2].map(i => res.reduce((a, r) => a + r.variant[i], 0));
const vT = V[0] + V[1] + V[2] || 1;

console.log(`\n${N} matches.\n`);
console.log(`  FETCHING THE BALL`);
console.log(`    restarts                       ${f1(vT / N)} a match`);
console.log(`    median distance it was brought ${f1([...fetchD].sort((a, b) => a - b)[fetchD.length >> 1] || 0)} m`);
const MK={}; for(const r of res) for(const[k,v] of Object.entries(r.mark)) MK[k]=(MK[k]||0)+v;
const TD=res.flatMap(r=>r.td||[]).sort((a,b)=>a-b);
console.log(`    teleported onto the spot       ${S("teleport")}      must be 0   ${JSON.stringify(MK)}`);
console.log(`    displacement p50/p90/max        ${TD.length?TD[TD.length>>1]:0} / ${TD.length?TD[Math.floor(TD.length*0.9)]:0} / ${TD.length?TD[TD.length-1]:0} m`);
console.log(`    struck from off the spot       ${S("offSpot")} of ${S("taken")}   must be 0`);
console.log(`\n  THE CELEBRATION`);
console.log(`    goals                          ${f1(S("goals") / N)} a match`);
console.log(`    kickoffs that celebrated first ${f1(S("celeb") / N)} a match`);
console.log(`\n  THE ROUTINES`);
console.log(`    variant 0 / 1 / 2              ${f1(100 * V[0] / vT)}% / ${f1(100 * V[1] / vT)}% / ${f1(100 * V[2] / vT)}%`);
console.log(`    (a fair roll is 33 / 33 / 33; a stuck one is 100 / 0 / 0)`);
console.log(`\n  Every count in the match is meant to be untouched by all of this. The regression is`);
console.log(`  what proves that; this only proves the mechanisms are running at all.`);
