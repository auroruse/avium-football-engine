// Shots cannot go over the bar: 0.3% against a real ~15%. Sweep the elevation error and the aim
// cone together, scoring the PROJECTED unobstructed shot (which isolates accuracy from blocks and
// saves) and the actual conversion the match ends up with.
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meGoalX,
        ME_MATCH_TICKS, STRAT_DEF, ME_HALF_W, ME_GOAL_W, CFG } = eng;
const sq = (o, f = "4-3-3") => buildSquad(f, null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, offTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0},
  fouls:{home:0,away:0}, passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0,
  blocked:0, woodwork:0, shotDist: new Array(10).fill(0), xg: 0 });
const HALF = ME_GOAL_W / 2, BAR = 2.44, N = +(process.env.N || 14);
function cell({ elev, aim }) {
  CFG.shotElevErr = elev; CFG.shotAimSkill = aim;
  let on = 0, wide = 0, over = 0, n = 0, sh = 0, g = 0;
  for (let seed = 1; seed <= N; seed++) {
    const s = createMatchState();
    s.players.home = sq(75); s.players.away = sq(75);
    s.formations = { home: "4-3-3", away: "4-3-3" };
    s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
    s.possession = "home"; meInit(s, pitchSlots);
    const out = blank(), rng = new RNG(seed);
    for (let t = 0; t < ME_MATCH_TICKS; t++) {
      const b4 = s.mePos.shot;
      meTick(s, rng, out);
      const mp = s.mePos;
      if (b4 || !mp.shot) continue;
      const gx = meGoalX(mp.shot.side), v0 = Math.hypot(mp.bvx, mp.bvy);
      if (v0 < 1) continue;
      const ux = mp.bvx / v0, uy = mp.bvy / v0, need = gx - mp.bx;
      if (need * ux <= 0) continue;
      const path = need / ux, tt = (Math.exp(CFG.ballDrag * path) - 1) / (CFG.ballDrag * v0);
      const off = Math.abs(mp.by + uy * path - ME_HALF_W);
      const z = mp.bz + mp.bvz * tt - 4.905 * tt * tt;
      n++;
      if (off >= HALF) wide++; else if (z >= BAR) over++; else if (z > 0) on++;
    }
    sh += out.shots.home + out.shots.away; g += out.goals.home + out.goals.away;
  }
  return { on: 100 * on / (n || 1), wide: 100 * wide / (n || 1), over: 100 * over / (n || 1),
           conv: 100 * g / (sh || 1), gpm: g / N / 2, spm: sh / N / 2 };
}
const CELLS = [];
for (const elev of [1.6, 1.9, 2.2]) for (const aim of [0.55, 0.42, 0.30]) CELLS.push({ elev, aim });
const res = await parMap(CELLS, cell);
if (!res) process.exit(0);
const f1 = (x) => x.toFixed(1);
console.log(`\n${N} matches per cell. "projected" = where an unobstructed shot would arrive.\n`);
console.log(`  elevErr  aimSkill   projected: on-tgt   wide    over      conv   goals/side  shots/side`);
CELLS.forEach((c, i) => { const r = res[i];
  const good = r.conv >= 8 && r.conv <= 15;
  console.log(`  ${c.elev.toFixed(1).padStart(7)}  ${c.aim.toFixed(2).padStart(8)}   ${f1(r.on).padStart(14)}%` +
    ` ${f1(r.wide).padStart(6)}% ${f1(r.over).padStart(6)}%   ${f1(r.conv).padStart(6)}%` +
    ` ${f1(r.gpm).padStart(10)} ${f1(r.spm).padStart(11)}${good ? "  <==" : ""}`); });
console.log(`\n  real:                              ~45%    ~25%    ~15%    8-14%       1.40       12-13`);
