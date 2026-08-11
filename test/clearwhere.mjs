process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meGoalX, meOther, meDir,
        ME_MATCH_TICKS, STRAT_DEF, CFG } = eng;
const sq = (o) => buildSquad("4-3-3", null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0 });
const bin = new Array(7).fill(0); let tot = 0;
for (let seed = 1; seed <= 10; seed++) {
  const s = createMatchState();
  s.players.home = sq(75); s.players.away = sq(75);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos, c0 = out.clears;
    const who = mp.idx >= 0 ? { s: mp.side, x: s.players[mp.side][mp.idx].x } : null;
    meTick(s, rng, out);
    if (out.clears > c0 && who) {
      const own = meGoalX(meOther(who.s));
      const d = Math.abs(who.x - own);
      bin[Math.min(6, Math.floor(d / 10))]++; tot++;
    }
  }
}
console.log(`\n${tot} clearances over 10 matches (${(tot/10/2).toFixed(1)} per side per match)`);
console.log("distance from HIS OWN goal when he hoofed it:");
for (let b = 0; b < 7; b++) if (bin[b])
  console.log(`  ${String(b*10).padStart(2)}-${b===6?"+":String(b*10+10)} m  ${String(bin[b]).padStart(4)}  ${(100*bin[b]/tot).toFixed(0).padStart(3)}%`);
console.log(`\n(clearDepth is ${CFG.clearDepth} m -- offered anywhere inside that, or under pressure ${CFG.clearPress})`);
