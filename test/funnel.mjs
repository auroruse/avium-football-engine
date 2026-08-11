// 36% of shots go in against a real 8-14%. That is one number covering four different things, and
// they want different fixes: too many shots, shots from too good a position, shots too accurate, or
// a keeper too easy to beat. So take the funnel apart.
//
// Real football, per side per match, for comparison:
//   shots 12-13   on target ~4.5 (35%)   blocked ~2.5   off target ~5.5   goals ~1.4
//   goals per shot 11%      goals per shot ON TARGET 31%      keeper saves ~69% of what he faces
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meGoalX, meDir,
        ME_MATCH_TICKS, STRAT_DEF, ME_HALF_W, PITCH_L, CFG } = eng;

const sq = (o, f = "4-3-3") => buildSquad(f, null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, offTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0},
  fouls:{home:0,away:0}, passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0,
  blocked:0, woodwork:0, shotDist: new Array(10).fill(0), xg: 0 });

const N = +(process.env.N || 30);
const BANDS = [[0, 6, "0-6 m"], [6, 11, "6-11 m"], [11, 16.5, "11-16.5 m"],
               [16.5, 25, "16.5-25 m"], [25, 999, "25 m+"]];

function run(seed) {
  const s = createMatchState();
  s.players.home = sq(75); s.players.away = sq(75);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  // Every shot, tagged where it was struck from, then followed until it resolves.
  const shots = [];
  let live = null;
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos;
    const b4 = mp.shot, gx4 = b4 ? meGoalX(b4.side) : 0;
    const bx = mp.bx, by = mp.by, g4 = { home: out.goals.home, away: out.goals.away };
    const sv4 = { home: out.saves.home, away: out.saves.away }, bl4 = out.blocked, wd4 = out.woodwork;
    meTick(s, rng, out);
    if (!b4 && mp.shot) {                            // struck this slice, from where the ball was
      const gx = meGoalX(mp.shot.side);
      live = { d: Math.hypot(gx - bx, ME_HALF_W - by), side: mp.shot.side, t: 0, done: null };
      shots.push(live);
    }
    if (live) {
      live.t++;
      const scored = out.goals[live.side] > g4[live.side];
      const oppSaved = out.saves[live.side === "home" ? "away" : "home"] > sv4[live.side === "home" ? "away" : "home"];
      if (scored) live.done = "goal";
      else if (out.blocked > bl4) live.done = "blocked";
      else if (oppSaved) live.done = "saved";
      else if (out.woodwork > wd4) live.done = "woodwork";
      else if (!mp.shot && b4) live.done = "off";     // shot flag cleared without any of the above
      if (live.done || live.t > 40) { if (!live.done) live.done = "off"; live = null; }
    }
  }
  return { shots, goals: out.goals.home + out.goals.away, sh: out.shots.home + out.shots.away,
           onT: out.onTarget.home + out.onTarget.away, sv: out.saves.home + out.saves.away };
}

const res = await parMap(Array.from({ length: N }, (_, i) => i + 1), (seed) => run(seed));
if (!res) process.exit(0);

const all = res.flatMap(r => r.shots);
const tot = (k) => res.reduce((a, r) => a + r[k], 0);
const cnt = (f) => all.filter(f).length;
const pc = (a, b) => (100 * a / (b || 1)).toFixed(1) + "%";
const per = (a) => (a / N / 2).toFixed(2);

console.log(`\n${N} matches. Per side per match, and what happened to every shot.\n`);
console.log(`  shots        ${per(tot("sh")).padStart(6)}      real 12-13`);
console.log(`  goals        ${per(tot("goals")).padStart(6)}      real ~1.4`);
console.log(`  conversion   ${pc(tot("goals"), tot("sh")).padStart(6)}      real 8-14%\n`);
console.log(`  every shot tracked to its end (${all.length} of them):`);
for (const k of ["goal", "saved", "blocked", "woodwork", "off"])
  console.log(`    ${k.padEnd(9)} ${String(cnt(s => s.done === k)).padStart(5)}   ${pc(cnt(s => s.done === k), all.length)}`);
const onT = cnt(s => s.done === "goal" || s.done === "saved");
console.log(`\n  on target (goal or saved)  ${pc(onT, all.length)}   real ~35%`);
console.log(`  goals per shot ON TARGET   ${pc(cnt(s => s.done === "goal"), onT)}   real ~31%`);
console.log(`  keeper saves what he faces ${pc(cnt(s => s.done === "saved"), onT)}   real ~69%`);

console.log(`\n  by distance struck from:`);
console.log(`    band          shots   share    goal    saved   blocked     off     conversion`);
for (const [lo, hi, lbl] of BANDS) {
  const b = all.filter(s => s.d >= lo && s.d < hi);
  if (!b.length) continue;
  const g = b.filter(s => s.done === "goal").length;
  console.log(`    ${lbl.padEnd(12)} ${String(b.length).padStart(5)}  ${pc(b.length, all.length).padStart(6)}` +
    `  ${pc(g, b.length).padStart(6)}  ${pc(b.filter(s => s.done === "saved").length, b.length).padStart(6)}` +
    `  ${pc(b.filter(s => s.done === "blocked").length, b.length).padStart(8)}` +
    `  ${pc(b.filter(s => s.done === "off").length, b.length).padStart(6)}` +
    `      ${g} in ${b.length}`);
}
console.log(`\n  mean distance struck from: ${(all.reduce((a, s) => a + s.d, 0) / all.length).toFixed(1)} m   (real ~17 m)`);
console.log(`  goal is ${(2 * 3.66).toFixed(2)} m wide; a keeper covers ${(2 * (CFG.bodyR + CFG.ballR)).toFixed(2)} m of it standing still.`);
