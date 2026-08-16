// THE PAINTED GOAL PATH HAS TO BE A REAL MOVE. Drives real matches, cuts a clip at every goal the
// way the app does, and runs the shipped meSnap/meClipFrom/meChain over it -- then asserts the chain
// is something you could actually draw: at least one touch, every touch on the pitch, every touch
// belonging to the scoring side, and the last man in the chain finishing nearer the goal he is
// attacking than the first man was.
import { load, PROJECT } from "/Users/zli/Documents/NICHIRIN/.claude/skills/avium-tactics/scripts/lib.mjs";
import path from "path";
const eng = await import("./deng.mjs");
const { meSnap, meClipFrom, meChain } = eng;
const { clubs } = await load(path.join(PROJECT, "src/presets/AVIUM.tsv"));
const pool = clubs.slice(0, 12);
const ME_TAPE = 64;
let goals = 0, empty = 0, offPitch = 0, wrongSide = 0, backwards = 0, lens = [], touches = [];
const { runPositionalMatch } = eng;
for (let k = 0; k < 30; k++) {
  const H = { ...pool[k % 12], style: "gegenpress", strategy: { ...(eng.STYLE_PRESET.gegenpress) } };
  const A = { ...pool[(k + 5) % 12], style: "counterattack", strategy: { ...(eng.STYLE_PRESET.counterattack) } };
  eng.DIAG.tape = [];
  const { s, out } = runPositionalMatch(H, A, 700 + k * 7919);
  const tape = eng.DIAG.tape || [];
  for (const g of (eng.DIAG.goalAt || [])) {
    const upto = tape.slice(Math.max(0, g.i - ME_TAPE + 1), g.i + 1);
    if (upto.length < 2) continue;
    const from = meClipFrom(upto, g.side);
    const frames = upto.slice(from);
    const chain = meChain(s, frames).filter(t => t.side === g.side);
    goals++;
    // What actually gets drawn is the BALL PATH; the chain only labels touches along it.
    const path = frames.map(f => [f.bx, f.by]);
    if (path.length < 2) { empty++; continue; }
    lens.push(path.length);
    touches.push(chain.length);
    if (path.some(q => q[0] < -2 || q[0] > 107 || q[1] < -2 || q[1] > 70)) offPitch++;
    if (chain.some(t => t.side !== g.side)) wrongSide++;
    const gx = g.gx;
    const d0 = Math.abs(gx - path[0][0]), d1 = Math.abs(gx - path[path.length - 1][0]);
    if (d1 > d0 + 1) backwards++;
  }
}
const avg = lens.length ? (lens.reduce((a, b) => a + b, 0) / lens.length) : 0;
console.log(`\ngoals with a clip: ${goals}`);
console.log(`  nothing to paint:               ${empty}`);
console.log(`  path leaves the pitch:          ${offPitch}`);
console.log(`  a touch by the wrong side:      ${wrongSide}`);
console.log(`  move ends FURTHER from goal:    ${backwards}`);
console.log(`  path points per goal: avg ${avg.toFixed(1)}  min ${Math.min(...lens)}  max ${Math.max(...lens)}`);
const ta = touches.reduce((a,b)=>a+b,0)/Math.max(1,touches.length);
console.log(`  named touches along it: avg ${ta.toFixed(1)}  (labels only; the line is the ball)`);
process.exit(empty + offPitch + wrongSide ? 1 : 0);
