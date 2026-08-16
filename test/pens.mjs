// Penalties must resolve to their own kinds, never to plain goal/save/miss, and the permanent
// records must agree with the events. Cholismo vs Gegenpress fouls enough to see plenty.
import { load, PROJECT } from "/Users/zli/Documents/NICHIRIN/.claude/skills/avium-tactics/scripts/lib.mjs";
import path from "path";
const eng = await import("./deng.mjs");
const { clubs } = await load(path.join(PROJECT, "src/presets/AVIUM.tsv"));
const pool = clubs.slice(0, 12);
let steps = 0, pen = 0, penmiss = 0, leakedGoal = 0, recScored = 0, recMissed = 0;
for (let k = 0; k < 40; k++) {
  const H = { ...pool[k % 12], style: "cholismo", strategy: { ...eng.STYLE_PRESET.cholismo } };
  const A = { ...pool[(k + 5) % 12], style: "gegenpress", strategy: { ...eng.STYLE_PRESET.gegenpress } };
  eng.DIAG.evt = [];
  const { out } = eng.runPositionalMatch(H, A, 7300 + k * 7919);
  for (const [t, kind, , , , txt] of eng.DIAG.evt) {
    if (kind === "shot" && txt && /steps up/.test(txt)) steps++;
    if (kind === "pen") pen++;
    if (kind === "penmiss") penmiss++;
  }
  for (const sd of ["home", "away"]) {
    recScored += (out.scorers?.[sd] || []).filter(g => g.pen).length;
    recMissed += (out.penMiss?.[sd] || []).length;
  }
}
console.log(`\n40 matches: ${steps} penalties taken -> ${pen} scored + ${penmiss} missed  (events)`);
console.log(`records: ${recScored} scored with pen flag, ${recMissed} in penMiss`);
console.log(`taken vs resolved: ${steps} vs ${pen + penmiss}${steps === pen + penmiss ? "  -- every penalty accounted for" : "  MISMATCH"}`);
process.exit(steps !== pen + penmiss || recScored !== pen || recMissed !== penmiss ? 1 : 0);
