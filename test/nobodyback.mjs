// NOBODY IS TRACKING BACK.
//
// Three complaints that are probably one problem, so all three are measured together:
//
//   NOBODY COMES BACK. A side with seven outfielders camped in the opponent's half while the
//   opponent attacks its goal. meShape's defending branch gives every man his block slot and only
//   press / cover / recover are exempt, so either the branch is not being reached or they are being
//   asked for the slot and not going. The split is the same one that located the marking bug: how
//   far is he from the slot he was ASKED for.
//
//   HE HAS THE GOAL IN FRONT OF HIM AND DOES NOT GO. A carrier with an open lane and nobody within
//   reach who neither shoots nor drives at it.
//
//   HE HEADS IT WHEN HE COULD TAKE A TOUCH. The header branch fires on ball height alone, above
//   headMinZ, whatever the ball is doing -- so a ball dropping gently onto a man's chest is headed
//   away rather than controlled. This counts how many headers were on a ball slow enough to kill.
//
//   node test/nobodyback.mjs
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meDir, meGoalX, meOther,
        meLaneBlock, ME_MATCH_TICKS, PITCH_L, PITCH_W, STRAT_DEF, CFG } = eng;

const sq = (o, f) => buildSquad(f, null).map((p, i) => ({ ...p, name: p.pos + i, ovr: o,
  stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0, xgS: { home: 0, away: 0 }, feed: [], min: 0 });

const N = +(process.env.N || 24);
const ME_HALF_W = PITCH_W / 2;

function run(seed) {
  const s = createMatchState();
  const hs = sq(75, "4-3-3"), as = sq(75, "4-3-3");
  s.players.home = hs.filter(p => !p.bench); s.bench.home = hs.filter(p => p.bench);
  s.players.away = as.filter(p => !p.bench); s.bench.away = as.filter(p => p.bench);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  const A = { def: 0, upfield: 0, offSlot: [], runners: 0, noSlot: 0,
              open: 0, openDrive: 0, openShot: 0,
              head: 0, headSlow: 0, dutyN: {} };
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos;
    const bv0 = Math.hypot(mp.bvx, mp.bvy), bz0 = mp.bz;
    const c0 = out.clears, s0 = out.shots.home + out.shots.away;
    const carrier = mp.idx >= 0 && !mp.sp ? s.players[mp.side][mp.idx] : null;
    const cx0 = carrier ? carrier.x : 0, cy0 = carrier ? carrier.y : 0, cSide = mp.side;
    meTick(s, rng, out);

    // ---- HEADERS. A header on a ball this slow is a choice, not a necessity.
    // THIS COUNTER WAS BROKEN AND ITS NUMBERS ARE VOID. It only looked at the feed on ticks where
    // out.clears or out.shots had moved, so every "heads it on" knock-down -- the majority of all
    // headers -- was invisible. And match.ts emits an ordinary foot shot with txt=null, which never
    // enters the feed, so on every foot shot it read a STALE feed[0] and booked a phantom header
    // carrying the pre-shot ball state: at the shooter's feet, slow and low, therefore scored as
    // "controllable". It reported 13.4 headers a match at 36.0% controllable; the truth is 21.2 and
    // the slow share is about 2 headers a match. The feed is drained every tick now, and a header
    // is counted wherever it appears rather than only alongside a clearance or a shot.
    {
      const f = out.feed[0]; out.feed.length = 0;
      if (f && /heads it/.test(f.txt || "")) {
        A.head++;
        if (bv0 < CFG.headSlowV && bz0 < CFG.headMinZ + 0.55) A.headSlow++;
      }
    }
    if (mp.sp) continue;

    // ---- THE DEFENDING SIDE'S SHAPE
    if (mp.idx >= 0) {
      const def = meOther(mp.side);
      const us = s.players[def];
      const dir = meDir(def);
      A.def++;
      for (const p of us) {
        if (p.off || p.pos === "GK") continue;
        // In the opponent's half while his own side defends.
        if ((p.x - PITCH_L / 2) * dir > 0) A.upfield++;
        A.dutyN[p._duty] = (A.dutyN[p._duty] || 0) + 1;
        if ((p._runT ?? 0) > 0) A.runners++;
        if (p._bsx === undefined) { A.noSlot++; continue; }
        A.offSlot.push(Math.hypot(p.x - p._bsx, p.y - p._bsy));
      }
    }

    // ---- HE HAS IT AND THE GOAL IS OPEN
    if (carrier && cSide === mp.side) {
      const dir = meDir(cSide), gx = meGoalX(cSide);
      const dGoal = Math.hypot(gx - cx0, ME_HALF_W - cy0);
      const them = s.players[meOther(cSide)];
      let near = Infinity;
      for (const q of them) { if (q.off) continue;
        const d = Math.hypot(q.x - cx0, q.y - cy0); if (d < near) near = d; }
      // Inside shooting range, nobody within four metres, and a clear sight of the goal.
      const lane = meLaneBlock(s, cSide, cx0, cy0, gx, ME_HALF_W);
      if (dGoal < 30 && near > 4 && lane < 0.35) {
        A.open++;
        if (out.shots.home + out.shots.away > s0) A.openShot++;
        else {
          const c2 = mp.idx >= 0 ? s.players[mp.side][mp.idx] : null;
          if (c2 && (c2.x - cx0) * dir > 0.12) A.openDrive++;   // he took it forward this slice
        }
      }
    }
  }
  return A;
}

const res = await parMap(Array.from({ length: N }, (_, i) => i + 1), run);
if (!res) process.exit(0);
const S = (k) => res.reduce((a, r) => a + r[k], 0);
const f1 = (x) => x.toFixed(1);
const off = res.flatMap(r => r.offSlot).sort((a, b) => a - b);
const md = (a) => a.length ? a[a.length >> 1] : 0;
const D = {}; for (const r of res) for (const [k, v] of Object.entries(r.dutyN)) D[k] = (D[k] || 0) + v;
const dT = Object.values(D).reduce((a, b) => a + b, 0) || 1;

console.log(`\n${N} matches, ${S("def")} slices with somebody on the ball.\n`);
console.log(`  THE SIDE WITHOUT THE BALL                                     real`);
console.log(`    outfielders in the opponent's half   ${f1(S("upfield") / (S("def") || 1))} of 10        1-3`);
console.log(`    median distance from his block slot  ${f1(md(off))} m`);
console.log(`    90th percentile                      ${f1(off[Math.floor(off.length * 0.9)] || 0)} m`);
console.log(`    men on an active run                 ${f1(S("runners") / (S("def") || 1))} of 10        0-1`);
console.log(`    with no block slot at all            ${S("noSlot")}`);
console.log(`\n    what they were told to do:`);
for (const [k, v] of Object.entries(D).sort((a, b) => b[1] - a[1]))
  console.log(`      ${k.padEnd(10)} ${f1(100 * v / dT).padStart(5)}%`);
console.log(`\n  HE HAS IT, INSIDE 30 m, NOBODY WITHIN 4 m, CLEAR SIGHT OF GOAL`);
console.log(`    slices like that            ${S("open")}`);
console.log(`    he shot                     ${f1(100 * S("openShot") / (S("open") || 1))}%`);
console.log(`    he drove at it              ${f1(100 * S("openDrive") / (S("open") || 1))}%`);
console.log(`    he did NEITHER              ${f1(100 * (S("open") - S("openShot") - S("openDrive")) / (S("open") || 1))}%`);
console.log(`\n  HEADERS`);
console.log(`    per match                   ${f1(S("head") / N)}`);
console.log(`    on a ball slow and low enough to control instead  ${f1(100 * S("headSlow") / (S("head") || 1))}%`);
