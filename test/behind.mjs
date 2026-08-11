// 1. While a man is "dribbling", where is the ball relative to the way he is going?
// 2. When the ball goes out of play, what put it there -- and did it cost his side possession?
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meOther,
        ME_MATCH_TICKS, STRAT_DEF, CFG, PITCH_L, PITCH_W } = eng;
const sq = (o) => buildSquad("4-3-3", null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0 });

const N = 8;
const ang = [0,0,0,0,0,0];        // 0-30, 30-60, 60-90, 90-120, 120-150, 150-180 deg off his line
let on = 0, distSum = 0, behind = 0, farBehind = 0;
const dead = {};                   // kind -> count
const cause = {};                  // "kind after action" -> count
const k = (o, key) => (o[key] = (o[key] || 0) + 1);
let lostPoss = 0, keptPoss = 0;

for (let seed = 1; seed <= N; seed++) {
  const s = createMatchState();
  s.players.home = sq(75); s.players.away = sq(75);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  let lastAct = "carry", lastEvt = null;
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos;
    // where is the ball, relative to the man who has it?
    if (mp.idx >= 0 && !mp.sp) {
      const p = s.players[mp.side][mp.idx];
      const bx = mp.bx - p.x, by = mp.by - p.y, bd = Math.hypot(bx, by);
      const vs = Math.hypot(p.vx || 0, p.vy || 0);
      // his LINE is the direction he is taking it, which is what the cone would face
      // Against the way he is ACTUALLY MOVING, not his intended line. _drbA is re-pointed AT the
      // ball whenever it gets behind him, so measuring against it hides the exact case being looked
      // for: every recovery frame reads as "the ball is in front of him".
      const hx = vs > 0.02 ? p.vx / vs : null, hy = vs > 0.02 ? p.vy / vs : 0;
      if (bd > 0.02 && hx !== null && vs / 0.25 > 2.0) {   // only while he is actually running
        const dot = Math.max(-1, Math.min(1, (bx / bd) * hx + (by / bd) * hy));
        const deg = Math.acos(dot) * 180 / Math.PI;
        ang[Math.min(5, Math.floor(deg / 30))]++;
        on++; distSum += bd;
        if (deg > 90) behind++;
        if (deg > 90 && bd > 1.2) farBehind++;
      }
    }
    const evtBefore = out.evt && out.evt.age === 0 ? out.evt.k : null;
    const wasSp = !!mp.sp;
    meTick(s, rng, out);
    if (out.evt && out.evt.age === 0 && ["pass","clear","shot"].includes(out.evt.k)) lastAct = out.evt.k;
    else if (mp.idx >= 0) lastAct = "carry";
    if (!wasSp && mp.sp) {
      k(dead, mp.sp.kind);
      k(cause, `${mp.sp.kind} after ${lastAct}`);
      // did his side keep it? sp.side is who restarts.
      if (mp.sp.kind !== "kickoff" && mp.sp.kind !== "freekick") {
        if (mp.sp.side === mp.lastSide) keptPoss++; else lostPoss++;
      }
    }
  }
}
const pc = (a, b) => (100 * a / (b || 1)).toFixed(0) + "%";
console.log(`\nWHERE THE BALL IS while somebody is running with it  (${on} slices)`);
const lbl = ["  0- 30 deg  in front of him","  30- 60 deg","  60- 90 deg  level with him",
             "  90-120 deg  BEHIND him"," 120-150 deg"," 150-180 deg  straight behind"];
for (let i = 0; i < 6; i++) console.log(`${lbl[i].padEnd(32)} ${pc(ang[i], on).padStart(5)}`);
console.log(`\nmean distance from his feet: ${(distSum / (on || 1)).toFixed(2)} m   (reach ${CFG.reach}, he keeps it out to ${CFG.touchKeep})`);
console.log(`behind him at all: ${pc(behind, on)}      behind him AND over 1.2 m away: ${pc(farBehind, on)}`);

console.log(`\nBALL OUT OF PLAY, per match`);
for (const key of Object.keys(dead).sort()) console.log(`  ${key.padEnd(12)} ${(dead[key] / N).toFixed(1)}`);
console.log(`\n  ...and what put it there`);
for (const key of Object.keys(cause).sort((a, b) => cause[b] - cause[a]))
  console.log(`  ${key.padEnd(28)} ${(cause[key] / N).toFixed(1)} a match`);
console.log(`\nrestarts where the side that touched it last KEPT possession: ${pc(keptPoss, keptPoss + lostPoss)}`);
