// An opponent is carrying the ball inside the box. Is the keeper going at it, or backing off?
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meOther, meGoalX,
        ME_MATCH_TICKS, STRAT_DEF, CFG, ME_HALF_W } = eng;
const sq = (o) => buildSquad("4-3-3", null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0 });
let n = 0, toward = 0, away = 0, retreat = 0, gapSum = 0;
for (let seed = 1; seed <= 10; seed++) {
  const s = createMatchState();
  s.players.home = sq(75); s.players.away = sq(75);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos;
    if (mp.idx >= 0 && !mp.sp) {
      const def = meOther(mp.side), gk = s.players[def].find(q => q.pos === "GK");
      const own = meGoalX(mp.side);
      if (gk && Math.hypot(mp.bx - own, mp.by - ME_HALF_W) < CFG.gkBoxR) {
        const dNow = Math.hypot(mp.bx - gk.x, mp.by - gk.y);
        const dWant = Math.hypot(mp.bx - (gk._tx ?? gk.x), mp.by - (gk._ty ?? gk.y));
        n++; gapSum += dNow;
        if (dWant < dNow - 0.15) toward++; else if (dWant > dNow + 0.15) away++;
        // his TARGET is nearer his own goal line than he is: he is stepping backwards
        if (Math.abs((gk._tx ?? gk.x) - own) < Math.abs(gk.x - own) - 0.1) retreat++;
      }
    }
    meTick(s, rng, out);
  }
}
const pc=(a,b)=>(100*a/(b||1)).toFixed(0)+"%";
console.log(`\n${n} slices of an opponent carrying the ball inside the keeper's own area`);
console.log(`  mean gap keeper-to-ball      ${(gapSum/(n||1)).toFixed(1)} m`);
console.log(`  he is closing on the ball    ${pc(toward,n)}`);
console.log(`  he is backing off it         ${pc(away,n)}`);
console.log(`  stepping toward his own line ${pc(retreat,n)}   <- backing into his net`);
