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
const N = 14;
let parries = 0, intoNet = 0, goals = 0, gkLast = 0;
for (let seed = 1; seed <= N; seed++) {
  const s = createMatchState();
  s.players.home = sq(75); s.players.away = sq(75);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  let g0 = 0, lastParryTick = -99, parrySide = null;
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos;
    const sv0 = out.saves.home + out.saves.away;
    meTick(s, rng, out);
    if (out.saves.home + out.saves.away > sv0 && mp.idx < 0 && mp.pred) {
      // where does the parried ball actually go? read the forecast for a crossing of HIS goal line.
      parries++;
      const keeperSide = mp.lastSide, own = meGoalX(meOther(keeperSide));
      for (let k = 1; k < mp.pred.length; k++) {
        const a = mp.pred[k-1], b = mp.pred[k];
        if ((a[0] - own) * (b[0] - own) > 0) continue;
        const f = (own - a[0]) / ((b[0] - a[0]) || 1);
        const y = a[1] + (b[1] - a[1]) * f, z = a[2] + (b[2] - a[2]) * f;
        if (Math.abs(y - ME_HALF_W) <= 3.66 && z <= 2.44) intoNet++;
        break;
      }
      lastParryTick = t; parrySide = keeperSide;
    }
    const gnow = out.goals.home + out.goals.away;
    if (gnow > g0) { goals++; if (t - lastParryTick <= 8) gkLast++; g0 = gnow; }
  }
}
const pc=(a,b)=>(100*a/(b||1)).toFixed(0)+"%";
console.log(`\n${parries} parries over ${N} matches`);
console.log(`  forecast to end up IN HIS OWN NET   ${pc(intoNet, parries)}   (${intoNet})`);
console.log(`${goals} goals, of which within 2s of a parry: ${gkLast}  (${pc(gkLast, goals)})`);
