// Under siege, who is actually IN the block and who is still up the pitch? Split by band, so
// "the forwards do not come back" is either true or it is not.
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meOther, meGoalX, meDir,
        ME_MATCH_TICKS, STRAT_DEF, CFG, ME_DT, meSpeed, meAttrs } = eng;
const sq = (o) => buildSquad(process.env.FORM || "4-3-3", null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0 });
const B = [0,1,2].map(() => ({ n:0, depth:0, slot:0, gap:0, spd:0, closing:0, inBox:0, lazy:0 }));
let sieges = 0, allN = 0, allSpd = 0, fast = 0;
for (let seed = 1; seed <= 8; seed++) {
  const s = createMatchState();
  s.players.home = sq(75); s.players.away = sq(75);
  s.formations = { home: "4-3-3", away: process.env.FORM || "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos;
    if (mp.idx >= 0 && !mp.sp) {
      const atk = mp.side, def = meOther(atk);
      const own = meGoalX(atk), dir = meDir(def);
      const ballDepth = (mp.bx - own) * dir;
      if (ballDepth < 26) {
        sieges++;
        const us = s.players[def].filter(p => p.pos !== "GK");
        let mn = Infinity, mx = -Infinity;
        for (const p of us) { if (p._bd0 < mn) mn = p._bd0; if (p._bd0 > mx) mx = p._bd0; }
        for (const p of us) {
          const rel = (p._bd0 - mn) / Math.max(1, mx - mn);
          const b = rel < 0.34 ? 0 : rel < 0.72 ? 1 : 2;
          const o = B[b]; o.n++;
          o.depth += (p.x - own) * dir;
          o.slot  += ((p._bsx ?? p.x) - own) * dir;
          o.gap   += Math.hypot(p.x - (p._bsx ?? p.x), p.y - (p._bsy ?? p.y));
          o.spd   += Math.hypot(p.vx||0, p.vy||0) / ME_DT / meSpeed(meAttrs(p), p.stamina);
          if (p._closing) o.closing++;
          if ((p.x - own) * dir < 18) o.inBox++;
        }
      }
    }
    for (const sd of ["home","away"]) for (const q of s.players[sd]) {
      const v = Math.hypot(q.vx||0, q.vy||0) / ME_DT; allN++; allSpd += v; if (v > 5.5) fast++;
    }
    meTick(s, rng, out);
  }
}
const pc=(a,b)=>(100*a/(b||1)).toFixed(0)+"%";
console.log(`\n${sieges} siege slices (ball inside 26 m of the defending goal)`);
console.log("band          n     where he IS   his SLOT    gap    effort   closing   inside 18 m");
for (let b = 0; b < 3; b++) { const o = B[b];
  console.log(`${["back  ","middle","front "][b]}  ${String(o.n).padStart(7)}` +
    `   ${(o.depth/o.n).toFixed(1).padStart(9)} m ${(o.slot/o.n).toFixed(1).padStart(9)} m` +
    ` ${(o.gap/o.n).toFixed(1).padStart(5)} m  ${pc(o.spd,o.n).padStart(6)}   ${pc(o.closing,o.n).padStart(7)}` +
    `   ${pc(o.inBox,o.n).padStart(10)}`);
}
console.log(`\nwhole pitch: mean player speed ${(allSpd/allN).toFixed(2)} m/s (real ~2), ` +
  `above 5.5 m/s ${(100*fast/allN).toFixed(1)}% (real ~3%)`);
