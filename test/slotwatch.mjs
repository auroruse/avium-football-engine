process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meOther, meGoalX, meDir,
        ME_MATCH_TICKS, STRAT_DEF, CFG, ME_DT, meSpeed, meAttrs } = eng;
const sq = (o) => buildSquad("4-3-3", null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0 });
const s = createMatchState();
s.players.home = sq(75); s.players.away = sq(75);
s.formations = { home: "4-3-3", away: "4-3-3" };
s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
s.possession = "home"; meInit(s, pitchSlots);
const out = blank(), rng = new RNG(4);
let shown = 0, watching = -1;
console.log(" t   duty      him(x,y)      slot(sx,sy)   target(tx,ty)  gap   slotMoved  hisStep  spd  track");
for (let t = 0; t < ME_MATCH_TICKS && shown < 24; t++) {
  const mp = s.mePos;
  if (mp.idx >= 0 && !mp.sp) {
    const atk = mp.side, def = meOther(atk), own = meGoalX(atk), dir = meDir(def);
    if ((mp.bx - own) * dir < 24) {
      const us = s.players[def];
      if (watching < 0) { // pick a midfielder far from his slot
        let best = -1, bd = 0;
        for (let i = 0; i < us.length; i++) { const q = us[i]; if (q.pos === "GK") continue;
          const g = Math.hypot(q.x - (q._sx ?? q.x), q.y - (q._sy ?? q.y));
          if (g > bd) { bd = g; best = i; } }
        if (bd > 8) watching = best;
      }
      if (watching >= 0) {
        const q = us[watching];
        const px = q.x, py = q.y, psx = q._sx, psy = q._sy;
        const spd = Math.hypot(q.vx||0, q.vy||0)/ME_DT;
        if (q._pgx !== undefined) {
          const slotMoved = Math.hypot(psx - q._pgx, psy - q._pgy);
          const hisStep = Math.hypot(px - q._ppx, py - q._ppy);
          console.log(`${String(t).padStart(3)} ${String(q._duty).padEnd(9)}` +
            ` ${px.toFixed(1).padStart(5)},${py.toFixed(1).padStart(5)}` +
            ` ${psx.toFixed(1).padStart(6)},${psy.toFixed(1).padStart(5)}` +
            ` ${(q._tx??0).toFixed(1).padStart(7)},${(q._ty??0).toFixed(1).padStart(5)}` +
            ` ${Math.hypot(px-psx,py-psy).toFixed(1).padStart(5)}` +
            ` ${slotMoved.toFixed(2).padStart(10)} ${hisStep.toFixed(2).padStart(8)}` +
            ` ${spd.toFixed(1).padStart(4)}  ${q._track?"Y":"n"}`);
          shown++;
        }
        q._pgx = psx; q._pgy = psy; q._ppx = px; q._ppy = py;
      }
    } else watching = -1;
  } else watching = -1;
  meTick(s, rng, out);
}
