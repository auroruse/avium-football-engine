// WHO PUT IT OUT?
//
// "Players sometimes run the ball out of bounds still." Every ball that leaves the pitch is either
// STRUCK out -- a pass behind a man, a clearance into the stand, a shot wide -- or DRIBBLED out, a
// man with it under his feet who ran it over a line he could see coming. Only the second is a bug,
// and the carry search already prices it (outSee / outThrow / outGoalkick / outCorner), so the
// question is how much of it survives that pricing.
//
// The moment the line is crossed, mp.idx >= 0 means somebody still had it: he carried it out.
//
//   node test/whoout.mjs
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meDir, meGoalX,
        ME_MATCH_TICKS, PITCH_W, PITCH_L, STRAT_DEF, CFG } = eng;

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
  // kind -> {carried, struck}, plus where the carrier was when he did it
  const A = { throw: [0, 0], corner: [0, 0], goalkick: [0, 0], depth: [], head: 0, headDeep: 0 };
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos;
    const hadIdx = mp.idx, hadSide = mp.side, wasSp = !!mp.sp;
    const px = mp.idx >= 0 ? s.players[mp.side][mp.idx] : null;
    const pxx = px ? px.x : 0, pxy = px ? px.y : 0;
    meTick(s, rng, out);
    // a header, and how deep he was: everything outside clearDepth of his own goal is being
    // recorded and drawn as a clearance while being nothing of the kind.
    const e = out.evt;
    if (e && e.age === 0 && e.k === "clear" && /heads it/.test(e.text || "")) {
      A.head++;
      const own = meGoalX(e.side === "home" ? "away" : "home");
      if (Math.abs(e.x0 - own) < CFG.clearDepth) A.headDeep++;
    }
    if (!wasSp && mp.sp && A[mp.sp.kind]) {
      const carried = hadIdx >= 0 ? 1 : 0;
      A[mp.sp.kind][carried]++;
      if (carried && px) {
        const dir = meDir(hadSide), own = meGoalX(hadSide === "home" ? "away" : "home");
        A.depth.push([mp.sp.kind, +((pxx - own) * dir).toFixed(0), +Math.min(pxy, PITCH_W - pxy).toFixed(1)]);
      }
    }
  }
  return A;
}

const res = await parMap(Array.from({ length: N }, (_, i) => i + 1), run);
if (!res) process.exit(0);
const f1 = (x) => x.toFixed(1);
const K = ["throw", "corner", "goalkick"];
const S = {}; for (const k of K) S[k] = [0, 0];
let dep = [], head = 0, headDeep = 0;
for (const r of res) { for (const k of K) { S[k][0] += r[k][0]; S[k][1] += r[k][1]; }
                       dep = dep.concat(r.depth); head += r.head; headDeep += r.headDeep; }

console.log(`\n${N} matches.\n`);
console.log(`  restart      per match   struck out   CARRIED OUT`);
console.log(`  ----------   ---------   ----------   -----------`);
let cTot = 0, tot = 0;
for (const k of K) {
  const n = S[k][0] + S[k][1]; tot += n; cTot += S[k][1];
  console.log(`  ${k.padEnd(10)}   ${f1(n / N).padStart(9)}   ${f1(S[k][0] / N).padStart(10)}   ` +
    `${(f1(S[k][1] / N) + `  (${f1(100 * S[k][1] / (n || 1))}%)`).padStart(11)}`);
}
console.log(`  ${"".padEnd(10)}   ${f1(tot / N).padStart(9)}   ${f1((tot - cTot) / N).padStart(10)}   ${f1(cTot / N).padStart(11)}`);
console.log(`\n  A man ran it out ${f1(cTot / N)} times a match. Where he was when he did it:`);
const bins = {};
for (const [k, d, e] of dep) { const b = `${k} @ ${Math.floor(d / 20) * 20}-${Math.floor(d / 20) * 20 + 20} m`;
  bins[b] = (bins[b] || 0) + 1; }
for (const [b, n] of Object.entries(bins).sort((a, b2) => b2[1] - a[1]).slice(0, 8))
  console.log(`    ${b.padEnd(26)} ${f1(n / N).padStart(5)} a match`);
const edge = dep.map(d => d[2]).sort((a, b2) => a - b2);
if (edge.length) console.log(`    median distance from the touchline when he committed: ${f1(edge[edge.length >> 1])} m`);

console.log(`\n  HEADERS RECORDED AS CLEARANCES  ${f1(head / N)} a match, of which only ${f1(headDeep / N)}`);
console.log(`  were struck inside ${CFG.clearDepth} m of his own goal. The rest are knock-downs and flicks`);
console.log(`  in midfield being counted in out.clears, given the clearance rating bonus, and drawn`);
console.log(`  on the pitch as a clearance -- which is the "clearances at halfway" on screen.`);
