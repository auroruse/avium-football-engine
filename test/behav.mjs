// THE BEHAVIOUR AUDIT. golden asks "did anything change" and ratings.mjs asks "are the aggregates
// right" -- and every bug of 30 August 2026 passed both: headHoldZ sat at 0 so the drop-wait veto
// never fired once (completion did not move), clearances flew as aimed passes (goals did not move),
// and passes to marked men COMPLETE more often than the decision believes, so the metric that
// should have caught it read healthy. This is the third net: does the engine do football things at
// football rates, and does every gate that is supposed to bite actually bite.
//
//   node test/behav.mjs [matches=30]
//
// A row outside its band prints BAD. A gate at zero is the loudest thing here: it means a term the
// code is written around is dead. Bands are real-football figures where they exist, scaled where
// the sim's own scale differs -- the sim plays 18 compressed minutes, so COUNTING stats (passes,
// tackles, headers, clearances) run at about 1/5 of a real match and are banded at that scale.
// Fast on purpose: these are per-event quantities with thousands of samples in a handful of
// matches, so it runs in seconds and can be run after every engine change.
import fs from "node:fs";

const eng = await import("./engine.mjs");
const N = +(process.argv[2] || 30);
const pool = eng.PRESET_CATALOG.filter(t =>
  t.league === "Nichirin League One" || t.league === "Nichirin League Two");

globalThis.__fire = {};
globalThis.__clr = [];
globalThis.__pmark = [];
globalThis.__rst = {};
globalThis.__sp = {};
globalThis.__shots = [];

const t0 = Date.now();
let matches = 0, goals = 0;
for (let k = 0; k < N; k++) {
  const A = pool[k % pool.length], B = pool[(k * 7 + 3) % pool.length];
  if (A === B) continue;
  const out = eng.runPositionalMatch(A, B, 31e5 + k * 7919, null, false).out;
  matches++; goals += out.goals.home + out.goals.away;
}

const F = globalThis.__fire, CLR = globalThis.__clr, PM = globalThis.__pmark;
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const share = (a, f) => (a.length ? a.filter(f).length / a.length : NaN);
const per = (v) => v / matches;

const rows = [];
// row: label, value, lo, hi, unit, note
const row = (label, v, lo, hi, note) => rows.push({ label, v, lo, hi, note });

// --- heading -------------------------------------------------------------------------------
// Real match: 55-70 headed contacts, and this sim is ~1/5 of a real match's event volume.
// headTry counts every aerial contact ABOVE HEAD HEIGHT that reached the gate; headWait counts
// the ones he let drop instead. Headers actually struck is the difference -- the first cut banded
// headTry itself and read 35.6 against a band of 8-18, which was the metric being wrong rather
// than the engine. Verify the metric first.
row("headers / match", per((F.headTry || 0) - (F.headWait || 0)), 8, 20, "real 55-70 at 1/5 scale");
// The drop-wait veto: of the balls above head height, how many he let drop instead of heading.
row("  aerials let drop", (F.headWait || 0) / Math.max(1, F.headTry || 1),
    0.25, 0.75, "veto dead at 0 -- the 30 Aug bug");
row("  headed in a duel", (F.headDuel || 0) / Math.max(1, F.headTry || 1), 0.05, 0.60,
    "crowd override; keeps corners headed");

// --- clearances ----------------------------------------------------------------------------
row("clearance mean carry (m)", mean(CLR), 34, 52, "a clearance is relief, not a pass");
row("  landing under 25 m", share(CLR, (d) => d < 25), 0, 0.15, "short = it was a pass");

// --- passing into marking ------------------------------------------------------------------
row("passes into <2.6 m marking", share(PM, (d) => d < 2.6), 0, 0.20, "man on his back");
// PROVISIONAL BAND. Set by eye, not measured off a build anyone has agreed is good -- it read
// 10.56 with 0.3% of passes going into tight marking, which is the engine refusing to play into
// any traffic at all. Re-band this against a build the eye test passes.
row("pass arrival separation (m)", mean(PM), 4.0, 12.0, "provisional; nearest opp where it lands");

// --- restarts ------------------------------------------------------------------------------
for (const kind of ["goalkick", "throw", "freekick"]) {
  const a = globalThis.__rst[kind] || [];
  row(`${kind} target separation (m)`, mean(a), 5.5, 40, "played to a FREE man");
}

// --- corners -------------------------------------------------------------------------------
const BX = globalThis.__sp.box || [];
row("corner attackers in box", mean(BX.map((r) => r[0])), 4, 7, "real 4-6");
row("corner defenders in box", mean(BX.map((r) => r[4])), 6.5, 9.5, "real 7-9");
row("corners into <3 attackers", share(BX, (r) => r[0] < 3), 0, 0.08, "the empty-box bug");

// --- keeper --------------------------------------------------------------------------------
row("GK sweeps outside box / match", per(F.gkSweepOut || 0), 0.05, 1.2, "sweeper, not a maniac");
row("  races won but declined", (F.gkSweepHeld || 0) / Math.max(1, (F.gkSweepOut || 0) + (F.gkSweepHeld || 0)),
    0.15, 0.95, "holds the goal when covered");

// --- gates that must bite ------------------------------------------------------------------
// These are counts, not rates. ZERO IS THE BUG: it means the code is written around a term that
// never fires. Every one of these guards something that was broken once and is now load-bearing.
const gates = [
  ["possRevoke", "phantom possession revoked", 1],
  ["hardRelease", "carry hard-released", 1],
  ["runHeld", "run held: carrier pressed", 1],
  ["thruSeen", "man seen as through", 1],
];

const bad = [];
const fmt = (v) => (Number.isNaN(v) ? "  n/a" : Math.abs(v) < 1.5 ? v.toFixed(3) : v.toFixed(2));
console.log(`${matches} matches, ${(goals / matches).toFixed(2)} goals/match, ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
console.log("  " + "metric".padEnd(30) + "value".padStart(8) + "   band".padEnd(16) + "  note");
for (const r of rows) {
  const ok = Number.isNaN(r.v) ? true : r.v >= r.lo && r.v <= r.hi;
  if (!ok) bad.push(r.label.trim());
  console.log("  " + (ok ? " " : "!") + r.label.padEnd(29) + fmt(r.v).padStart(8) +
              `   ${fmt(r.lo)}-${fmt(r.hi)}`.padEnd(16) + "  " + r.note + (ok ? "" : "   BAD"));
}
console.log("\n  gates that must bite (zero is the bug):");
for (const [key, label, min] of gates) {
  const v = F[key] || 0;
  const ok = v >= min;
  if (!ok) bad.push(label);
  console.log("  " + (ok ? " " : "!") + label.padEnd(29) + String(v).padStart(8) + (ok ? "" : "   DEAD"));
}

if (bad.length) { console.log(`\n${bad.length} OUT OF BAND: ${bad.join(", ")}`); process.exit(1); }
console.log("\nall behaviour bands hold");
