process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meDecide, meShotP, meLaneBlock,
        meGoalX, meDir, meOther, ME_MATCH_TICKS, STRAT_DEF, CFG, ME_HALF_W } = eng;
const sq = (o) => buildSquad("4-3-3", null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0 });
const bin = {}, add=(k)=>bin[k]=(bin[k]||0)+1;
let clearRun = 0, backs = 0, sides = 0, sideOk = 0, acts = {};
for (let seed = 1; seed <= 8; seed++) {
  const s = createMatchState();
  s.players.home = sq(75); s.players.away = sq(75);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos;
    if (mp.idx >= 0 && !mp.sp) {
      const side = mp.side, p = s.players[side][mp.idx], dir = meDir(side), gx = meGoalX(side);
      const lane = meLaneBlock(s, side, p.x, p.y, gx, ME_HALF_W);
      const dGoal = Math.abs(gx - p.x);
      // "through": nobody outfield goal-side of him within 6 m of the line to goal
      let blockers = 0;
      for (const q of s.players[meOther(side)]) { if (q.pos === "GK") continue;
        if ((q.x - p.x) * dir > 0 && Math.abs(q.y - p.y) < 12) blockers++; }
      if (blockers === 0 && dGoal < 60) {
        clearRun++;
        const act = meDecide(s, rng, side, mp.idx, 9);
        if (act) acts[act.k] = (acts[act.k]||0)+1;
        if (act && act.k === "pass") {
          const fwd = ((act.ax ?? s.players[side][act.j].x) - p.x) * dir;
          if (fwd >= -3 && fwd < 6) {
            sides++;
            const rq = s.players[side][act.j];
            if (meShotP(s, side, rq, act.ax ?? rq.x, act.ay ?? rq.y) > meShotP(s,side,p,p.x,p.y)) sideOk++;
          }
          if (fwd < -3) { backs++;
            add(`${Math.floor(dGoal/10)*10}-${Math.floor(dGoal/10)*10+10} m  lane ${lane.toFixed(1)}  shotP ${meShotP(s,side,p,p.x,p.y).toFixed(3)}`); }
        }
      }
    }
    meTick(s, rng, out);
  }
}
console.log(`\n${clearRun} slices with the ball and NOBODY outfield goal-side of him`);
console.log(`  of those, he chose a backpass (>3 m): ${backs}  (${(100*backs/(clearRun||1)).toFixed(1)}%)`);
console.log(`  of those, a SQUARE ball (-3 to +6 m): ${sides}  (${(100*sides/(clearRun||1)).toFixed(1)}%)`);
console.log(`    ...of which the receiver had a better sight of goal: ${sideOk}/${sides}`);
console.log(`  what he did instead: ${Object.keys(acts).map(k=>k+" "+(100*acts[k]/(clearRun||1)).toFixed(0)+"%").join("  ")}`);
console.log(`\n  where, and why the no-backpass rule let it through (range ${CFG.noBackRange} m, lane ${CFG.noBackLane}, shotP ${CFG.noBackShot}):`);
for (const k of Object.keys(bin).sort((a,b)=>bin[b]-bin[a]).slice(0,10)) console.log(`    ${String(bin[k]).padStart(3)}x  ${k}`);
