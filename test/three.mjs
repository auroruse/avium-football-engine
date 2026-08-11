process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meDecide, meShotP, meShotGeom,
        meOther, meGoalX, meDir, ME_MATCH_TICKS, STRAT_DEF, CFG, ME_DT, ME_HALF_W, meSpeed, meAttrs } = eng;
const sq = (o) => buildSquad("4-3-3", null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0 });

const N = 8;
const sd = new Array(10).fill(0), sxg = new Array(10).fill(0), sgo = new Array(10).fill(0);
let gkAway = 0, gkTow = 0, gkSlices = 0, gkDeep = 0;
let rcvSlices = 0, rcvSlow = 0, rcvTight = 0, rcvTightSlow = 0, rcvSpdSum = 0;

for (let seed = 1; seed <= N; seed++) {
  const s = createMatchState();
  s.players.home = sq(75); s.players.away = sq(75);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  let pend = null;
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos;
    // ---- shots: bin the one about to be taken
    if (mp.idx >= 0 && !mp.sp) {
      const side = mp.side, p = s.players[side][mp.idx];
      const act = meDecide(s, rng, side, mp.idx, 9);
      if (act && act.k === "shot") {
        const b = Math.min(9, Math.floor(meShotGeom(side, p.x, p.y).d / 5));
        sd[b]++; sxg[b] += act.p;
      }
    }
    // ---- keeper: while the ball is loose/live in or near his box, is he closing on it or backing off?
    for (const side of ["home","away"]) {
      const gk = s.players[side].find(q => q.pos === "GK"); if (!gk || mp.sp) continue;
      const own = meGoalX(meOther(side));
      const bDep = Math.abs(mp.bx - own);
      if (mp.idx >= 0 || bDep > 18) continue;                 // only a LOOSE ball in his own box
      // THE PATHOLOGY, precisely: the ball is rolling at his goal, nobody else is near it, and he
      // is going the other way. Being goal-side of a ball is what a keeper is FOR -- that was a bad
      // metric -- but retreating from a ball only he can reach is not.
      const closing = ((mp.bx - own) * (mp.bvx) + (mp.by - ME_HALF_W) * (mp.bvy)) < 0;
      let nearest = Infinity;
      for (const q of s.players[meOther(side)]) if (q.pos !== "GK")
        nearest = Math.min(nearest, Math.hypot(q.x - mp.bx, q.y - mp.by));
      const bsp = Math.hypot(mp.bvx, mp.bvy);
      if (!closing || nearest < 6 || bsp < 0.5 || bsp > 6) continue;   // ROLLING, not a shot
      const dNow = Math.hypot(mp.bx - gk.x, mp.by - gk.y);
      const dWant = Math.hypot(mp.bx - (gk._tx ?? gk.x), mp.by - (gk._ty ?? gk.y));
      gkSlices++;
      if (dWant < dNow - 0.15) gkTow++; else if (dWant > dNow + 0.15) gkAway++;
      if (dWant > dNow + 0.15 && dNow < 14) gkDeep++;
    }
    // ---- receiver: is he coming to meet a contested ball, and how hard?
    if (mp.passPending && mp.fj >= 0 && mp.flight) {
      const q = s.players[mp.fside][mp.fj];
      if (q) {
        const mine = q._ttbMs ?? 9999, rival = mp.ttbBest[meOther(mp.fside)] ?? 9999;
        const spd = Math.hypot(q.vx || 0, q.vy || 0) / ME_DT, top = meSpeed(meAttrs(q), q.stamina);
        rcvSlices++; rcvSpdSum += spd / top;
        const slow = spd < top * 0.75;
        if (slow) rcvSlow++;
        if (rival - mine < 250) { rcvTight++; if (slow) rcvTightSlow++; }   // a real race
      }
    }
    meTick(s, rng, out);
  }
  for (let b = 0; b < 10; b++) sgo[b] += out.shotDist[b];
}
const pc = (a,b) => (100*a/(b||1)).toFixed(0) + "%";
const tot = sd.reduce((a,b)=>a+b,0);
console.log("\nSHOTS THE DECISION WANTS TO TAKE, by distance");
console.log("  range        n     share    mean xG");
for (let b = 0; b < 10; b++) if (sd[b])
  console.log(`  ${String(b*5).padStart(2)}-${String(b*5+5).padEnd(2)} m ${String(sd[b]).padStart(7)}   ${pc(sd[b],tot).padStart(5)}    ${(sxg[b]/sd[b]).toFixed(3)}`);
const gt = sgo.reduce((a,b)=>a+b,0);
console.log("\nSHOTS ACTUALLY STRUCK IN PLAY, by distance");
for (let b = 0; b < 10; b++) if (sgo[b])
  console.log(`  ${String(b*5).padStart(2)}-${String(b*5+5).padEnd(2)} m ${String(sgo[b]).padStart(7)}   ${pc(sgo[b],gt).padStart(5)}`);
console.log(`  outside 15 m: ${pc(sgo[3]+sgo[4]+sgo[5]+sgo[6]+sgo[7]+sgo[8]+sgo[9], gt)}   outside 25 m: ${pc(sgo[5]+sgo[6]+sgo[7]+sgo[8]+sgo[9], gt)}`);

console.log(`\nKEEPER: loose ball rolling AT his goal, nearest opponent 6 m+ away  (${gkSlices} slices)`);
console.log(`  moving TOWARD the ball        ${pc(gkTow, gkSlices)}`);
console.log(`  moving AWAY from it           ${pc(gkAway, gkSlices)}`);
console.log(`  ...and it was inside 14 m of him ${pc(gkDeep, gkSlices)}   <- backing off a ball only he can reach`);

console.log(`\nPASS RECIPIENT while the ball is in the air  (${rcvSlices} slices)`);
console.log(`  mean effort                      ${pc(rcvSpdSum, rcvSlices)} of top speed`);
console.log(`  below three-quarter pace         ${pc(rcvSlow, rcvSlices)}`);
console.log(`  ...and it is a real race (<250ms) ${rcvTight} slices, of which ${pc(rcvTightSlow, rcvTight)} below three-quarter pace`);
