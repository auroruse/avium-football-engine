// SAMPLE GAMES BETWEEN REAL TEAMS, WITHIN AND ACROSS RATING BANDS.
//
// Every team comes from the presets with its own squad, formation and tactical instructions -- these
// are the sides as they are actually set up, not eleven synthetic players at a flat rating. Matches
// run on the POSITIONAL engine, the one the live match uses.
//
// There is no home advantage anywhere in this engine: "home" and "away" are side labels and nothing
// else. So within a band the split should be symmetric, and any asymmetry is noise. Sides are still
// alternated between seeds so that a systematic one would show up if it existed.
//
//   node test/fixtures.mjs            same-level and cross-level, aggregate + sample scorelines
//   BANDS=80,70 node test/fixtures.mjs      restrict to certain bands
//   R=12 P=6 node test/fixtures.mjs         seeds per pairing, pairings per cell
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meAdded,
        PRESET_CATALOG, ME_MATCH_TICKS, STRAT_DEF } = eng;

// The app's own rounding, so a rating printed here and a rating printed in the UI cannot disagree.
const showOvr = (v) => (v == null || v === "" || !isFinite(Number(v))) ? "-" : String(Math.round(Number(v)));

// meSide / meBench / meFreshOut, as App.tsx builds them for a live match.
const meSide = (t) => {
  const xi = (t?.squad || []).filter(p => !p.bench).slice(0, 11);
  const base = xi.length === 11 ? xi : buildSquad(t?.formation || "4-3-3", null).filter(p => !p.bench);
  return base.map((p, i) => ({ ...p, name: p.name || (p.pos + i), ovr: p.ovr ?? t?.skill ?? 70,
    stamina: 100, rating: 6.5, goals: 0, assists: 0, saves: 0, chances: 0, defActs: 0, _att: null }));
};
const meBench = (t) => (t?.squad || []).filter(p => p.bench).slice(0, 12)
  .map((p, i) => ({ ...p, name: p.name || (p.pos + "B" + i), ovr: p.ovr ?? t?.skill ?? 70,
    stamina: 100, rating: 6.5, goals: 0, assists: 0, saves: 0, chances: 0, defActs: 0, _att: null }));
const freshOut = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0, xgS: { home: 0, away: 0 }, evt: null, feed: [], min: 0,
  passSide: { home: 0, away: 0 }, passOkSide: { home: 0, away: 0 } });

function play([hT, aT, seed]) {
  const st = createMatchState();
  st.players.home = meSide(hT); st.players.away = meSide(aT);
  st.bench = { home: meBench(hT), away: meBench(aT) };
  st.subCap = { home: st.bench.home.length >= 11 ? 5 : 3, away: st.bench.away.length >= 11 ? 5 : 3 };
  st.formations = { home: hT.formation || "4-3-3", away: aT.formation || "4-3-3" };
  st.strategy = { home: { ...STRAT_DEF, ...(hT.strategy || {}) },
                  away: { ...STRAT_DEF, ...(aT.strategy || {}) } };
  st.possession = "home";
  const out = freshOut(), rng = new RNG(seed);
  meInit(st, pitchSlots, rng);           // the rng must exist first: meInit draws the toss from it
  for (let t = 0; t < ME_MATCH_TICKS + 400; t++) {
    meTick(st, rng, out);
    if (t >= ME_MATCH_TICKS + meAdded(st)) break;
  }
  const pT = out.poss.home + out.poss.away || 1;
  return { hg: out.goals.home, ag: out.goals.away,
           hs: out.shots.home, as: out.shots.away,
           hp: out.poss.home / pT, xh: out.xgS.home, xa: out.xgS.away,
           pass: out.passes, ok: out.passOk, fouls: out.fouls.home + out.fouls.away,
           hpass: out.passSide.home, hok: out.passOkSide.home,
           apass: out.passSide.away, aok: out.passOkSide.away,
           corners: out.corners.home + out.corners.away,
           hn: hT.name, an: aT.name, hk: xiOvr(hT), ak: xiOvr(aT),
           hsk: hT.skill, ask: aT.skill };
}

// THE STRENGTH THAT ACTUALLY TAKES THE FIELD. The preset's `skill` column is a squad-wide average
// and includes the bench, so it sits 1.56 below the mean rating of the eleven the engine fields and
// up to 4.6 below it. Banding on `skill` therefore puts teams in the same band whose real fielded
// strength differs by five points, and that -- not any side bias -- is what made two supposedly
// level sides read 25% wins against 55% losses. Bands and pairings are on the XI; both numbers are
// printed, because the skill column is what the app shows.
const xiOvr = (t) => {
  const xi = (t?.squad || []).filter(p => !p.bench).slice(0, 11);
  if (xi.length !== 11) return t?.skill ?? 70;
  return xi.reduce((a, p) => a + (p.ovr ?? t?.skill ?? 70), 0) / 11;
};

// ---- the teams, by band
const BANDS = (process.env.BANDS || "80,70,60,50").split(",").map(Number);
const R = +(process.env.R || 10);        // seeds per pairing
const P = +(process.env.P || 8);         // pairings per cell
const pool = {};
for (const t of PRESET_CATALOG) {
  if (!t || !isFinite(t.skill)) continue;
  const b = Math.floor(xiOvr(t) / 10) * 10;
  if (!BANDS.includes(b)) continue;
  (pool[b] = pool[b] || []).push(t);
}
for (const b of BANDS) (pool[b] || []).sort((x, y) => xiOvr(y) - xiOvr(x));

// Deterministic spread through each band rather than the top few over and over. WITHIN a band the
// two teams must be genuinely level, so they are drawn ADJACENT in the rating order -- a band is ten
// points wide and pairing across it is a mismatch dressed up as a fair fixture. Striding through the
// list by an index offset did exactly that and made the nominal "A" side the weaker one in five of
// eight pairings, which read as a 28% win rate between supposed equals.
const pick = (list, k, off) => list[(off + k) % list.length];

const CELLS = [];
for (const b of BANDS) if ((pool[b] || []).length >= 2) CELLS.push([b, b]);
for (let i = 0; i < BANDS.length; i++) for (let j = i + 1; j < BANDS.length; j++)
  if ((pool[BANDS[i]] || []).length && (pool[BANDS[j]] || []).length) CELLS.push([BANDS[i], BANDS[j]]);

const jobs = [], meta = [];
for (const [ba, bb] of CELLS) {
  for (let k = 0; k < P; k++) {
    let A, B;
    if (ba === bb) { A = pool[ba][(2 * k) % pool[ba].length]; B = pool[ba][(2 * k + 1) % pool[ba].length]; }
    else { A = pick(pool[ba], k, 0); B = pick(pool[bb], k, 0); }
    if (A === B) B = pool[bb][(pool[bb].indexOf(A) + 1) % pool[bb].length];
    for (let r = 0; r < R; r++) {
      // Alternate ends so a side bias would be visible rather than baked in.
      const swap = r % 2 === 1;
      jobs.push([swap ? B : A, swap ? A : B, k * 131 + r * 7 + 1]);
      meta.push({ ba, bb, swap });
    }
  }
}

const res = await parMap(jobs, play);
if (!res) process.exit(0);

const f1 = (x) => x.toFixed(1), f2 = (x) => x.toFixed(2);
const pc = (n, d) => (100 * n / (d || 1)).toFixed(0) + "%";

// Fold every match onto the FIRST band of its cell, whichever end it was played at.
function fold(cell) {
  const A = { n: 0, gf: 0, ga: 0, w: 0, d: 0, l: 0, sf: 0, sa: 0, poss: 0, xf: 0, xa: 0,
              pass: 0, ok: 0, fouls: 0, corners: 0, lines: {}, samples: [], kf: 0, ka: 0,
              pf: 0, pof: 0, pa: 0, poa: 0 };
  for (let i = 0; i < res.length; i++) {
    const m = meta[i], r = res[i];
    if (m.ba !== cell[0] || m.bb !== cell[1]) continue;
    // "us" is the first band of the cell
    const usG = m.swap ? r.ag : r.hg, thG = m.swap ? r.hg : r.ag;
    const usS = m.swap ? r.as : r.hs, thS = m.swap ? r.hs : r.as;
    const usX = m.swap ? r.xa : r.xh, thX = m.swap ? r.xh : r.xa;
    A.n++; A.gf += usG; A.ga += thG; A.sf += usS; A.sa += thS; A.xf += usX; A.xa += thX;
    A.poss += m.swap ? 1 - r.hp : r.hp;
    A.kf += m.swap ? r.ak : r.hk; A.ka += m.swap ? r.hk : r.ak;
    A.pf += m.swap ? r.apass : r.hpass; A.pof += m.swap ? r.aok : r.hok;
    A.pa += m.swap ? r.hpass : r.apass; A.poa += m.swap ? r.hok : r.aok;
    A.pass += r.pass; A.ok += r.ok; A.fouls += r.fouls; A.corners += r.corners;
    if (usG > thG) A.w++; else if (usG === thG) A.d++; else A.l++;
    const key = `${usG}-${thG}`;
    A.lines[key] = (A.lines[key] || 0) + 1;
    if (A.samples.length < 400) A.samples.push(r);
  }
  return A;
}

const label = (c) => c[0] === c[1] ? `${c[0]}s v ${c[0]}s` : `${c[0]}s v ${c[1]}s`;

console.log(`\n${res.length} matches on the positional engine. ${P} pairings a cell, ${R} games each,`);
console.log(`ends alternated. No home advantage exists in this engine.\n`);
for (const b of BANDS) {
  const l = pool[b] || [];
  if (!l.length) continue;
  console.log(`  ${b}s  ${String(l.length).padStart(3)} teams, XI ${showOvr(xiOvr(l[0]))} down to ${showOvr(xiOvr(l[l.length - 1]))}` +
              `   (their skill column: ${showOvr(l[0].skill)} down to ${showOvr(l[l.length - 1].skill)})`);
}

const SAME = CELLS.filter(c => c[0] === c[1]), CROSS = CELLS.filter(c => c[0] !== c[1]);
for (const [title, group] of [["SAME LEVEL", SAME], ["DIFFERENT LEVELS", CROSS]]) {
  console.log(`\n\n══ ${title} ═══════════════════════════════════════════════════════════`);
  console.log(`\n  cell          n    ovr     W    D    L    goals      shots       xG        poss   pass%`);
  // pass% is now per side, first band's then the other's
  for (const c of group) {
    const A = fold(c);
    if (!A.n) continue;
    console.log(`  ${label(c).padEnd(12)} ${String(A.n).padStart(3)}  ` +
      `${showOvr(A.kf / A.n)}v${showOvr(A.ka / A.n)}  ` +
      `${pc(A.w, A.n).padStart(4)} ${pc(A.d, A.n).padStart(4)} ${pc(A.l, A.n).padStart(4)}   ` +
      `${f2(A.gf / A.n)}-${f2(A.ga / A.n)}   ` +
      `${f1(A.sf / A.n).padStart(4)}-${f1(A.sa / A.n).padEnd(4)}  ` +
      `${f2(A.xf / A.n)}-${f2(A.xa / A.n)}   ` +
      `${pc(A.poss, A.n).padStart(4)}   ${pc(A.pof, A.pf)}-${pc(A.poa, A.pa)}`);
  }
  console.log(`\n  (W/D/L, goals, shots, xG and possession are all from the FIRST band's point of view)`);
  for (const c of group) {
    const A = fold(c);
    if (!A.n) continue;
    const top = Object.entries(A.lines).sort((a, b) => b[1] - a[1]).slice(0, 6);
    console.log(`\n  ── ${label(c)} — commonest scorelines: ` +
      top.map(([k, v]) => `${k} (${pc(v, A.n)})`).join("  "));
    const seen = new Set(), lines = [];
    for (const r of A.samples) {
      const key = r.hn + r.an;
      if (seen.has(key)) continue;
      seen.add(key); lines.push(r);
      if (lines.length >= 5) break;
    }
    for (const r of lines)
      console.log(`     ${(r.hn + " (" + showOvr(r.hk) + ")").padStart(32)}  ${r.hg} - ${r.ag}  ` +
                  `${"(" + showOvr(r.ak) + ") " + r.an}`);
  }
}
