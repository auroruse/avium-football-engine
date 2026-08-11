process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meGoalX, meOther, meDir,
        ME_MATCH_TICKS, STRAT_DEF, CFG, ME_HALF_W, PITCH_W } = eng;
const sq = (o) => buildSquad("4-3-3", null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0 });
let sh=0, bl=0, N=10;
let pw=0, crosses=0, highs=0, allP=0;
for (let seed = 1; seed <= N; seed++) {
  const s = createMatchState();
  s.players.home = sq(75); s.players.away = sq(75);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos, had = mp.passPending;
    const from = mp.idx >= 0 ? { x: s.players[mp.side][mp.idx].x, y: s.players[mp.side][mp.idx].y, s: mp.side } : null;
    meTick(s, rng, out);
    if (!had && mp.passPending && typeof mp.passPending.p === "number" && from) {
      allP++;
      if (mp.passPending.high) highs++;
      // a CROSS: struck from a wide channel in the attacking third, into the box
      const gx = meGoalX(from.s), wide = Math.abs(from.y - ME_HALF_W) > PITCH_W/2 - 16;
      const adv = Math.abs(from.x - gx) < 30;
      const intoBox = Math.abs(mp.fx ?? 0) >= 0;
      const tgt = s.players[from.s][mp.fj];
      if (wide && adv) { pw++; if (tgt && Math.abs(tgt.x - gx) < 18 && Math.abs(tgt.y - ME_HALF_W) < 20) crosses++; }
    }
  }
  sh += out.shots.home + out.shots.away; bl += out.blocked || 0;
}
const pc=(a,b)=>(100*a/(b||1)).toFixed(0)+"%";
console.log(`\nSHOT BLOCKING`);
console.log(`  shots ${(sh/N/2).toFixed(1)}/side, blocked by a defender ${(bl/N/2).toFixed(1)}/side = ${pc(bl,sh)} of all shots`);
console.log(`  real football: about 25-30% of shots are blocked`);
console.log(`  blockReach is ${CFG.blockReach} m against a normal cutReach of ${CFG.cutReach} m`);
console.log(`\nCROSSING`);
console.log(`  passes ${allP}, of which lofted ${pc(highs, allP)}`);
console.log(`  struck from a wide channel in the final 30 m: ${pw} (${pc(pw, allP)})`);
console.log(`  ...of those, aimed at a man in the box: ${crosses} = ${(crosses/N/2).toFixed(1)} per side per match`);
console.log(`  real football: about 15-20 crosses per side per match`);
