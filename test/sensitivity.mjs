// Does anything the manager controls actually change the match?
//   1. OVR. Put a good side against a bad one and see what the scoreline does.
//   2. TACTICS. Move one instruction to each extreme, everything else held, and see what moves.
// Both are asked the same way: same seeds, one variable, and the answer is the delta.
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick,
        ME_MATCH_TICKS, STRAT_DEF } = eng;

const sq = (o, f) => buildSquad(f, null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0 });

const N = +(process.env.N || 24);
function play(hOvr, aOvr, hStrat, aStrat, f = "4-3-3") {
  const t = { gh:0, ga:0, sh:0, sa:0, ph:0, pa:0, w:0, d:0, l:0, cmp:0, cmpN:0, corn:0, foul:0, poss:0, possN:0 };
  for (let seed = 1; seed <= N; seed++) {
    const s = createMatchState();
    s.players.home = sq(hOvr, f); s.players.away = sq(aOvr, f);
    s.formations = { home: f, away: f };
    s.strategy = { home: { ...STRAT_DEF, ...hStrat }, away: { ...STRAT_DEF, ...aStrat } };
    s.possession = "home"; meInit(s, pitchSlots);
    const out = blank(), rng = new RNG(seed);
    for (let k = 0; k < ME_MATCH_TICKS; k++) meTick(s, rng, out);
    t.gh += out.goals.home; t.ga += out.goals.away;
    t.sh += out.shots.home; t.sa += out.shots.away;
    t.corn += out.corners.home; t.foul += out.fouls.home + out.fouls.away;
    t.cmp += out.passOk; t.cmpN += out.passOk + out.passFail;
    t.poss += out.poss.home; t.possN += out.poss.home + out.poss.away;
    if (out.goals.home > out.goals.away) t.w++; else if (out.goals.home === out.goals.away) t.d++; else t.l++;
  }
  return { gh: t.gh/N, ga: t.ga/N, sh: t.sh/N, sa: t.sa/N, win: 100*t.w/N, drw: 100*t.d/N,
           cmp: 100*t.cmp/(t.cmpN||1), corn: t.corn/N, foul: t.foul/N, poss: 100*t.poss/(t.possN||1) };
}
const f2 = (x) => x.toFixed(2), f0 = (x) => x.toFixed(0);

console.log(`\n=============== 1. DOES OVR DO ANYTHING? (${N} matches each, same seeds) ===============`);
console.log(`  home  away        goals        shots      home win%   draw%`);
for (const [h, a] of [[75,75],[80,70],[85,65],[90,60],[95,55],[99,45]]) {
  const r = play(h, a, {}, {});
  console.log(`   ${h}    ${a}     ${f2(r.gh)} - ${f2(r.ga)}   ${f2(r.sh)} - ${f2(r.sa)}` +
    `      ${f0(r.win).padStart(3)}%    ${f0(r.drw).padStart(3)}%   (gap ${String(h-a).padStart(2)}, GD ${(r.gh-r.ga>=0?"+":"")}${f2(r.gh-r.ga)})`);
}

console.log(`\n=============== 2. DO TACTICS DO ANYTHING? (home instruction only, vs a neutral 75) =====`);
console.log(`  every instruction in STRAT_DEF, driven to each end, everything else held\n`);
const base = play(75, 75, {}, {});
console.log(`  NO INSTRUCTION       goals ${f2(base.gh)}-${f2(base.ga)}  shots ${f2(base.sh)}-${f2(base.sa)}  ` +
            `poss ${f0(base.poss)}%  cmp ${f0(base.cmp)}%  corners ${f2(base.corn)}  fouls ${f2(base.foul)}\n`);
const KNOBS = [["passingDir",-2,2],["chanceCreation",-1,1],["pressingLOE",-2,2],["defLine",-2,2],
  ["possWon",-1,1],["approachPlay",-1,1],["dribbling",-1,1],["creativity",-1,1],["setPieces",-1,1],
  ["timeWasting",-1,1],["possLost",-1,1],["gkDist",-1,1],["dlBehavior",-1,1],["tackling",-2,2]];
const rows = [];
for (const [k, lo, hi] of KNOBS) {
  const a = play(75, 75, { [k]: lo }, {}), b = play(75, 75, { [k]: hi }, {});
  const swing = Math.abs(a.gh - b.gh) + Math.abs(a.sh - b.sh) / 4 + Math.abs(a.poss - b.poss) / 5
              + Math.abs(a.cmp - b.cmp) / 5 + Math.abs(a.corn - b.corn);
  rows.push({ k, lo, hi, a, b, swing });
}
rows.sort((x, y) => y.swing - x.swing);
console.log(`  instruction        low -> high        goals for      shots for      poss%       cmp%     verdict`);
for (const r of rows)
  console.log(`  ${r.k.padEnd(16)} ${String(r.lo).padStart(2)} -> ${String(r.hi).padStart(2)}    ` +
    `${f2(r.a.gh)} -> ${f2(r.b.gh)}   ${f2(r.a.sh).padStart(5)} -> ${f2(r.b.sh).padStart(5)}   ` +
    `${f0(r.a.poss)} -> ${f0(r.b.poss)}   ${f0(r.a.cmp)} -> ${f0(r.b.cmp)}    ` +
    (r.swing < 0.35 ? "DEAD" : r.swing < 0.9 ? "faint" : "works"));
