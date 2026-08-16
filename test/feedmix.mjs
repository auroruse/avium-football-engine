// WHAT IS ACTUALLY IN THE COMMENTARY. The feed is a rolling 60 and the noisiest kinds crowd the
// real events out of it, so this counts what a match GENERATES rather than what survives: every
// captioned event by kind, and what share of the feed each takes.
import { load, PROJECT } from "/Users/zli/Documents/NICHIRIN/.claude/skills/avium-tactics/scripts/lib.mjs";
import path from "path";
const eng = await import("./deng.mjs");
const { clubs } = await load(path.join(PROJECT, "src/presets/AVIUM.tsv"));
const pool = clubs.slice(0, 12);
const tally = {}, sample = {};
let n = 0, captioned = 0;
for (let k = 0; k < 12; k++) {
  const H = { ...pool[k % 12], style: "gegenpress", strategy: { ...eng.STYLE_PRESET.gegenpress } };
  const A = { ...pool[(k + 5) % 12], style: "counterattack", strategy: { ...eng.STYLE_PRESET.counterattack } };
  eng.DIAG.evt = [];
  const { out } = eng.runPositionalMatch(H, A, 2400 + k * 7919);
  n++;
  for (const [, kind, , , , txt] of eng.DIAG.evt) {
    if (!txt) continue;
    captioned++;
    tally[kind] = (tally[kind] || 0) + 1;
    if (!sample[kind]) sample[kind] = txt;
  }
}
console.log(`\n${n} matches, ${(captioned / n).toFixed(0)} captioned events a match\n`);
console.log("kind        per match   share   example");
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1]))
  console.log(k.padEnd(11) + (v / n).toFixed(1).padStart(8) + (100 * v / captioned).toFixed(0).padStart(7) + "%   "
    + String(sample[k]).slice(0, 46));
