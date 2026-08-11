// The presser was not standing where he was told because he was slower than the man he chased.
// Three attempts at repositioning him measured as nothing before that turned up, so: ask the same
// question of EVERY duty before rewriting any of them. Who arrives, who does not, and how fast is
// each of them allowed to run.
//
// And at the moment a shot is struck, how many bodies are actually in the corridor it travels down.
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meOther, meGoalX,
        ME_MATCH_TICKS, ME_DT, STRAT_DEF, ME_HALF_W, CFG } = eng;

const sq = (o, f = "4-3-3") => buildSquad(f, null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, offTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0},
  fouls:{home:0,away:0}, passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0,
  blocked:0, woodwork:0, shotDist: new Array(10).fill(0), xg: 0 });

const N = +(process.env.N || 12);
function run(seed) {
  const s = createMatchState();
  s.players.home = sq(75); s.players.away = sq(75);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  const duty = {};                       // per duty: n, arrived, gap, speed
  const lanes = [];                      // per shot: bodies in the corridor
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos, b4 = mp.shot, bx = mp.bx, by = mp.by;
    // who is defending, and are they where they were sent
    if (mp.idx >= 0) {
      for (const q of s.players[meOther(mp.side)]) {
        const d = q._duty || "none";
        const e = duty[d] || (duty[d] = { n: 0, at: 0, gap: 0, spd: 0 });
        const g = Math.hypot(q.x - (q._tx ?? q.x), q.y - (q._ty ?? q.y));
        e.n++; e.gap += g; if (g < 1.0) e.at++;
        e.spd += Math.hypot(q.vx || 0, q.vy || 0) / ME_DT;
      }
    }
    meTick(s, rng, out);
    // a shot: count the bodies between it and the goal
    if (!b4 && mp.shot) {
      const side = mp.shot.side, gx = meGoalX(side);
      const lx = gx - bx, ly = ME_HALF_W - by, ll = Math.hypot(lx, ly) || 1;
      let inLane = 0, goalSide = 0;
      for (const q of s.players[meOther(side)]) {
        if (q.pos === "GK") continue;
        const rx = q.x - bx, ry = q.y - by;
        const along = (rx * lx + ry * ly) / ll;              // how far down the corridor he is
        if (along <= 0.2 || along >= ll) continue;           // behind the shooter, or past the goal
        goalSide++;
        const off = Math.abs(rx * (-ly / ll) + ry * (lx / ll));   // and how far off the line
        if (off < CFG.cutReach + 0.5) inLane++;
      }
      lanes.push({ inLane, goalSide, d: ll });
    }
  }
  return { duty, lanes };
}

const res = await parMap(Array.from({ length: N }, (_, i) => i + 1), run);
if (!res) process.exit(0);

const duty = {};
for (const r of res) for (const [k, v] of Object.entries(r.duty)) {
  const e = duty[k] || (duty[k] = { n: 0, at: 0, gap: 0, spd: 0 });
  e.n += v.n; e.at += v.at; e.gap += v.gap; e.spd += v.spd;
}
const lanes = res.flatMap(r => r.lanes);
const f2 = (x) => x.toFixed(2);

console.log(`\n${N} matches.  Every defending player, every slice, by the job he was given.\n`);
console.log(`  duty          share    standing on his target    mean gap    mean speed`);
const tot = Object.values(duty).reduce((a, e) => a + e.n, 0);
for (const [k, e] of Object.entries(duty).sort((a, b) => b[1].n - a[1].n))
  console.log(`  ${k.padEnd(12)}  ${(100 * e.n / tot).toFixed(0).padStart(4)}%` +
    `             ${(100 * e.at / e.n).toFixed(0).padStart(4)}%` +
    `           ${f2(e.gap / e.n).padStart(5)} m      ${f2(e.spd / e.n).padStart(5)} m/s`);

console.log(`\n  ${lanes.length} shots. Bodies between the ball and the goal when it was struck:\n`);
console.log(`    goal-side of the shooter at all   ${f2(lanes.reduce((a, l) => a + l.goalSide, 0) / lanes.length)} men`);
console.log(`    actually IN the corridor          ${f2(lanes.reduce((a, l) => a + l.inLane, 0) / lanes.length)} men` +
            `   (within ${(CFG.cutReach + 0.5).toFixed(2)} m of the line)`);
const none = lanes.filter(l => l.inLane === 0).length;
console.log(`    shots with NOBODY in the way      ${(100 * none / lanes.length).toFixed(0)}%`);
console.log(`\n    real football blocks 25-30% of all shots, so about a third should have a body in the corridor.`);
