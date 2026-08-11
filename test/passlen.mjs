// WHAT DOES A LONG PASS COST?
//
// The whole case against passingDir is one line of the ladder: completion runs 77.4% at Much Shorter
// and 75.3% at Much More Direct. Two points. Hitting it forty metres is, in this engine, very nearly
// as safe as a five metre square ball -- so playing direct buys field position for nothing, and that
// is the buff. Real football charges about twenty points for the same trade.
//
// This prices it directly: every open-play pass, bucketed by how far it was hit, against the public
// numbers. Set-piece deliveries carry no length and are excluded rather than averaged in as zero.
//
//   node test/passlen.mjs
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick,
        ME_MATCH_TICKS, STRAT_DEF } = eng;

const sq = (o, f) => buildSquad(f, null).filter(p => !p.bench)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0, xgS: { home: 0, away: 0 } });

const N = +(process.env.N || 24);
const EDGES = [0, 8, 15, 22, 30, 40, 999];
const LBL   = ["under 8 m", "8-15 m", "15-22 m", "22-30 m", "30-40 m", "over 40 m"];
// Roughly what a senior side completes at each range in open play.
const REAL  = ["  ~93%", "  ~89%", "  ~84%", "  ~76%", "  ~62%", "  ~48%"];
const bucket = (d) => { for (let i = 0; i < EDGES.length - 1; i++) if (d < EDGES[i + 1]) return i; return 5; };

function play(seed) {
  const ok = new Array(6).fill(0), no = new Array(6).fill(0);
  const sp = [0, 0];                                      // set-piece deliveries: completed / total
  const s = createMatchState();
  s.players.home = sq(75, "4-3-3"); s.players.away = sq(75, "4-3-3");
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  let pend = null;                                        // the pass currently in the air
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos;
    const had = mp.passPending, okB = out.passOk, noB = out.passFail;
    meTick(s, rng, out);
    // struck this slice: passPending appears carrying the distance it was hit
    // A set-piece delivery is a pass with no length on it -- setpiece.ts records only the side --
    // and regress counts it in the overall completion while passlen never has. That is the whole
    // gap between the two numbers, so measure it rather than infer it.
    if (!had && mp.passPending) pend = Number.isFinite(mp.passPending.d) ? mp.passPending.d : -1;
    const dOk = out.passOk - okB, dNo = out.passFail - noB;
    if (pend !== null && (dOk || dNo)) {
      if (pend < 0) { sp[1]++; if (dOk) sp[0]++; }
      else { const b = bucket(pend); if (dOk) ok[b]++; if (dNo) no[b]++; }
      pend = null;
    }
  }
  return { ok, no, sp };
}

const res = await parMap(Array.from({ length: N }, (_, i) => i + 1), play);
if (!res) process.exit(0);

const f1 = (x) => x.toFixed(1);
const ok = new Array(6).fill(0), no = new Array(6).fill(0); let spOk = 0, spN = 0;
for (const r of res) { for (let b = 0; b < 6; b++) { ok[b] += r.ok[b]; no[b] += r.no[b]; }
                       spOk += r.sp[0]; spN += r.sp[1]; }
const T = ok.reduce((a, b) => a + b, 0) + no.reduce((a, b) => a + b, 0);
console.log(`\nOpen-play pass completion by distance. ${N} matches, 75 v 75, 4-3-3, no instructions.\n`);
console.log(`   range        attempts   share    completed     real      gap`);
console.log(`   ----------   --------   -----    ---------   -------   ------`);
for (let b = 0; b < 6; b++) {
  const n = ok[b] + no[b], pc = 100 * ok[b] / (n || 1);
  const real = +REAL[b].replace(/[^0-9]/g, "");
  console.log(`   ${LBL[b].padEnd(10)}   ${String(n).padStart(8)}   ${f1(100 * n / T).padStart(4)}%    ` +
    `${f1(pc).padStart(7)}%   ${REAL[b]}    ${(pc - real >= 0 ? "+" : "") + f1(pc - real).padStart(5)}`);
}
const opOk = ok.reduce((a,b)=>a+b,0), opN = opOk + no.reduce((a,b)=>a+b,0);
console.log(`\n   open play        ${opN.toString().padStart(6)} passes   ${f1(100*opOk/(opN||1))}% complete`);
console.log(`   set-piece        ${spN.toString().padStart(6)} deliveries ${f1(100*spOk/(spN||1))}% complete   real ~25-30 for a cross`);
console.log(`   the two together ${(opN+spN).toString().padStart(6)}          ${f1(100*(opOk+spOk)/((opN+spN)||1))}% -- this is what regress reports`);
console.log(`\n   A completion curve that barely falls with distance means field position is free, and any`);
console.log(`   instruction that buys field position is a buff rather than a style. The gap column is`);
console.log(`   the size of that free lunch at each range.`);
