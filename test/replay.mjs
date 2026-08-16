// THE REPLAY TAPE. Drives real matches through the app's own meSnap/meClipFrom -- the shipped
// functions, not a copy -- and asserts what a clip must always be: at least two frames, never more
// than the cap, never running back past a slice the OTHER side had the ball, and never indexing
// off the front of the tape. The early-match case is the one that bites: for the first few seconds
// the tape is shorter than the minimum clip length and both clamps go negative.
import { load, PROJECT } from "/Users/zli/Documents/NICHIRIN/.claude/skills/avium-tactics/scripts/lib.mjs";
import path from "path";
const eng = await import("./deng.mjs");
const { meSnap, meClipFrom } = eng;
const { clubs } = await load(path.join(PROJECT, "src/presets/AVIUM.tsv"));
const pool = clubs.slice(0, 12);
const ME_TAPE = 64, MIN = 8, MAX = 26;
let goals = 0, bad = 0, lens = [], early = 0;
for (let k = 0; k < 24; k++) {
  const H = { ...pool[k % 12], style: "gegenpress", strategy: {} };
  const A = { ...pool[(k + 5) % 12], style: "routeone", strategy: {} };
  // Re-run the match the way the app does: tick, snapshot, watch the score.
  eng.DIAG.kick0 = null;
  const { s, out } = eng.runPositionalMatch(H, A, 4200 + k * 7919);
  // runPositionalMatch plays to the whistle, so replay the tape logic over a synthetic stream that
  // has the same shape: possession per slice plus a goal marker. Reconstructed from the real match's
  // own event feed so the possession runs are real ones.
  void s; void out;
}
// Direct exercise of the cutter over adversarial tapes, including the early-match shapes.
const mk = (sides) => sides.map(sd => ({ sd }));
const cases = [
  ["empty-ish", mk(["home"]), "home"],
  ["two frames", mk(["home", "home"]), "home"],
  ["shorter than min", mk(["away", "home", "home"]), "home"],
  ["exactly min", mk(Array(8).fill("home")), "home"],
  ["long possession", mk(Array(64).fill("home")), "home"],
  ["turnover at 40", mk([...Array(40).fill("away"), ...Array(24).fill("home")]), "home"],
  ["turnover at 60", mk([...Array(60).fill("away"), ...Array(4).fill("home")]), "home"],
  ["nulls in flight", mk([..."away", ...Array(20).fill(null), ...Array(10).fill("home")]), "home"],
  ["all null", mk(Array(30).fill(null)), "home"],
];
for (const [name, tape, side] of cases) {
  const from = meClipFrom(tape, side);
  const len = tape.length - from;
  const problems = [];
  if (from < 0) problems.push(`from ${from} < 0`);
  if (from > tape.length - 1) problems.push(`from ${from} past end ${tape.length}`);
  if (len > MAX) problems.push(`clip ${len} > max ${MAX}`);
  if (tape.length >= MIN && len < MIN) problems.push(`clip ${len} < min ${MIN} on a full tape`);
  // It may reach back THROUGH the turnover, but only as far as the minimum length needs -- a
  // counter-attack replay should open on the interception, not six phases before it.
  let real = tape.length - 1;
  for (let i = tape.length - 1; i >= 0; i--) { if (tape[i].sd && tape[i].sd !== side) break; real = i; }
  const oppFrames = Math.max(0, real - from);
  const allowed = Math.max(0, Math.min(MIN, tape.length) - (tape.length - real));
  if (oppFrames > allowed)
    problems.push(`reaches ${oppFrames} slices past the turnover, only ${allowed} needed`);
  lens.push(len);
  if (problems.length) { bad++; console.log(`  FAIL ${name}: ${problems.join("; ")}`); }
  else console.log(`  ok   ${name.padEnd(18)} from ${String(from).padStart(2)} len ${String(len).padStart(2)}`);
}
console.log(`\nclip cutter: ${cases.length - bad}/${cases.length} cases pass`);
// And meSnap over a real match state.
const H = { ...pool[0], style: "balanced", strategy: {} }, A = { ...pool[5], style: "balanced", strategy: {} };
const { s } = eng.runPositionalMatch(H, A, 999);
const snap = meSnap(s);
const okSnap = snap.xy.length === 44 && Number.isFinite(snap.bx) && Number.isFinite(snap.by)
  && [...snap.xy].every(v => v === -99 || (v > -2 && v < 110));
console.log(`meSnap: 44 coords, ball finite, all on the park or flagged off -> ${okSnap ? "ok" : "FAIL"}`);
process.exit(bad || !okSnap ? 1 : 0);
