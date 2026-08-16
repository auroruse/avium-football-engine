// Dismissals: the record must carry a full name and a reason, and the live caption must parse.
import { load, PROJECT } from "/Users/zli/Documents/NICHIRIN/.claude/skills/avium-tactics/scripts/lib.mjs";
import path from "path";
const eng = await import("./deng.mjs");
const { clubs } = await load(path.join(PROJECT, "src/presets/AVIUM.tsv"));
const pool = clubs.slice(0, 12);
let n = 0, noFull = 0, abbrev = 0, unparsed = 0, second = 0;
const RE = /^(.*?) is sent off(?:,\s*(.+))?$/;
for (let k = 0; k < 34; k++) {
  const H = { ...pool[k % 12], style: "gegenpress", strategy: { ...eng.STYLE_PRESET.gegenpress } };
  const A = { ...pool[(k + 5) % 12], style: "cholismo", strategy: { ...eng.STYLE_PRESET.cholismo } };
  eng.DIAG.evt = [];
  const { out } = eng.runPositionalMatch(H, A, 1500 + k * 7919);
  for (const sd of ["home", "away"]) for (const r of (out.sendOff?.[sd] || [])) {
    n++; if (!r.full) noFull++;
    if (/\p{Lu}\.\s?\p{Lu}/u.test(r.full || r.name)) abbrev++;
    if (r.second) second++;
  }
  for (const [, kind, , , , txt] of eng.DIAG.evt)
    if (kind === "red" && txt && !RE.exec(txt)) { unparsed++; console.log("  unparsed: " + txt); }
}
console.log(`\n${n} dismissals over 34 matches (${second} second yellows, ${n - second} straight)`);
console.log(`  missing a full name: ${noFull}`);
console.log(`  still abbreviated:   ${abbrev}`);
console.log(`  captions the feed cannot parse: ${unparsed}`);
process.exit(noFull + abbrev + unparsed ? 1 : 0);
