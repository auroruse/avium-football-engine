// THE FULL-TIME SUMMARY MUST NOT LOSE EARLY GOALS. out.feed is a rolling 60-entry buffer, so a
// busy match drops its opening goals off the tail long before the whistle -- a 6-0 summarised as
// three second-half goals. The report now reads out.scorers and out.sendOff, which are permanent.
// This asserts they stay complete: scorers must equal the scoreline, and reds must equal out.reds.
import { load, PROJECT } from "/Users/zli/Documents/NICHIRIN/.claude/skills/avium-tactics/scripts/lib.mjs";
import path from "path";
const eng = await import("./deng.mjs");
const { clubs } = await load(path.join(PROJECT, "src/presets/AVIUM.tsv"));
const pool = clubs.slice(0, 12);
let n = 0, badG = 0, badR = 0, feedLost = 0, worst = 0, reds = 0;
for (let k = 0; k < 40; k++) {
  const H = { ...pool[k % 12], style: "gegenpress", strategy: { ...eng.STYLE_PRESET.gegenpress } };
  const A = { ...pool[(k + 5) % 12], style: "parkthebus", strategy: { ...eng.STYLE_PRESET.parkthebus } };
  const { out } = eng.runPositionalMatch(H, A, 5150 + k * 7919);
  n++;
  for (const sd of ["home", "away"]) {
    const sc = (out.scorers?.[sd] || []).length, gl = out.goals[sd];
    if (sc !== gl) { badG++; if (Math.abs(sc - gl) > worst) worst = Math.abs(sc - gl); }
    const so = (out.sendOff?.[sd] || []).length, rd = (out.reds?.[sd] || 0);
    reds += rd;
    if (so !== rd) badR++;
  }
  // how much the OLD approach would have lost
  const inFeed = (out.feed || []).filter(f => f.k === "goal").length;
  const total = out.goals.home + out.goals.away;
  if (inFeed < total) feedLost += total - inFeed;
}
console.log(`\n${n} matches.`);
console.log(`  scorers vs scoreline mismatches: ${badG}${worst ? ` (worst off by ${worst})` : ""}`);
console.log(`  sendOff vs reds mismatches:      ${badR}   (${reds} reds seen)`);
console.log(`  goals the ROLLING FEED had lost by full time: ${feedLost}`);
process.exit(badG + badR ? 1 : 0);
