// The keeper, measured: where his reach comes from, whether he holds or spills, whether a parry is
// actually a mirror, and whether the ball is ever drawn inside him.
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meAttrs, meGkSkill,
        meOther, meGoalX, meShotGeom, ME_MATCH_TICKS, STRAT_DEF, CFG, ME_DT } = eng;
const sq = (o) => buildSquad("4-3-3", null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0 });
console.log("reach by rating (flight time -> save range, metres)");
console.log("  ovr   reflex  react   dive cap   0.2s   0.4s   0.6s   0.9s");
for (const ovr of [40, 55, 70, 85, 99]) {
  const gk = { pos: "GK", ovr, stamina: 100, atkW: 0, _att: null };
  const a = meAttrs(gk), k = meGkSkill(a);
  const react = CFG.gkReactSlow + (CFG.gkReactFast - CFG.gkReactSlow) * k;
  const dive = CFG.gkDiveMin + (CFG.gkDiveMax - CFG.gkDiveMin) * k;
  const at = (f) => (CFG.gkWing + Math.min(dive, Math.max(0, f - react) * CFG.gkDiveV)).toFixed(2);
  console.log(`  ${String(ovr).padStart(3)}   ${a.reflex.toFixed(0).padStart(6)}  ${(react*1000).toFixed(0).padStart(4)}ms` +
    `  ${dive.toFixed(2).padStart(8)}   ${at(0.2).padStart(4)}   ${at(0.4).padStart(4)}   ${at(0.6).padStart(4)}   ${at(0.9).padStart(4)}`);
}
let held = 0, insideGk = 0, gkOn = 0, sv = 0, go = 0, sh = 0, ot = 0;
let parries = 0, parryGoalward = 0;
const N = 12, R = CFG.bodyR + CFG.ballR;
for (let seed = 1; seed <= N; seed++) {
  const s = createMatchState();
  s.players.home = sq(75); s.players.away = sq(75);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos;
    if (mp.idx >= 0 && !mp.sp && s.players[mp.side][mp.idx].pos === "GK") {
      const p = s.players[mp.side][mp.idx];
      gkOn++;
      if (mp.held) { held++; if (Math.hypot(mp.bx - p.x, mp.by - p.y) < R - 0.02) insideGk++; }
    }
    const pb = mp.shot ? { x: mp.bx, y: mp.by, s: mp.shot.side } : null;
    const sv0 = out.saves.home + out.saves.away;
    meTick(s, rng, out);
    // a parry just happened: is the ball now heading at the goal he is defending?
    if (pb && out.saves.home + out.saves.away > sv0 && mp.idx < 0) {
      const own = meGoalX(meOther(pb.s === "home" ? "away" : "home"));
      parries++;
      if ((own - mp.bx) * mp.bvx > 0 && Math.abs(mp.bvx) > 0.3) parryGoalward++;
    }
  }
  sv += out.saves.home + out.saves.away; go += out.goals.home + out.goals.away;
  sh += out.shots.home + out.shots.away; ot += out.onTarget.home + out.onTarget.away;
}
const pc = (a,b)=>(100*a/(b||1)).toFixed(0)+"%";
console.log(`\nper match: ${(sh/N/2).toFixed(1)} shots/side, ${(ot/N/2).toFixed(1)} on target, ` +
  `${(sv/N/2).toFixed(1)} saves, ${(go/N/2).toFixed(2)} goals`);
console.log(`  save rate on target                ${pc(sv, ot)}   (real: about 70%)`);
console.log(`  BOOKS: on target ${(ot/N/2).toFixed(2)} = saves ${(sv/N/2).toFixed(2)} + goals-from-shots ${((ot-sv)/N/2).toFixed(2)}` +
  `   (goals ${(go/N/2).toFixed(2)}, so own goals ${((go-(ot-sv))/N/2).toFixed(2)})`);
console.log(`  parries sent back toward his own goal ${pc(parryGoalward, parries)}   (${parries} parries)`);
console.log(`  slices a keeper had the ball        ${gkOn}`);
console.log(`    ...of those, in his HANDS         ${pc(held, gkOn)}`);
console.log(`    ...of those HELD, drawn inside him ${pc(insideGk, held)}   <- must be 0%`);
