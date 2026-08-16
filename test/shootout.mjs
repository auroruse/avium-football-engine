// A PROPER SHOOTOUT: five different takers, the keeper last if it ever gets that far, and not one
// kick arriving with an assist. Also: carries are episodes now, so a match total in the hundreds
// means the counter is broken again.
import { load, PROJECT } from "/Users/zli/Documents/NICHIRIN/.claude/skills/avium-tactics/scripts/lib.mjs";
import path from "path";
const eng = await import("./deng.mjs");
const { clubs } = await load(path.join(PROJECT, "src/presets/AVIUM.tsv"));
const pool = clubs.slice(0, 12);
class RNG { constructor(s){ this.s = (s >>> 0) || 1; } u(){ this.s = (Math.imul(this.s, 1664525) + 1013904223) >>> 0; return this.s / 4294967296; } }
let dup5 = 0, assisted = 0, shoots = 0, kicksTotal = 0, carryTot = 0, n = 0;
for (let k = 0; k < 10; k++) {
  const H = { ...pool[k % 12], style: "catenaccio", strategy: { ...eng.STYLE_PRESET.catenaccio } };
  const A = { ...pool[(k + 5) % 12], style: "parkthebus", strategy: { ...eng.STYLE_PRESET.parkthebus } };
  eng.DIAG.evt = [];
  const { s, out } = eng.runPositionalMatch(H, A, 6060 + k * 7919);
  n++; carryTot += out.carries;
  const mark = eng.DIAG.evt.length;
  const r = eng.meShootout(s, new RNG(99 + k), out, 40);
  shoots++; kicksTotal += r.kicks;
  // the takers, in order, from the steps-up captions
  const takers = { home: [], away: [] };
  for (const [, kind, side, , , txt] of eng.DIAG.evt.slice(mark)) {
    if (kind === "shot" && txt && /steps up/.test(txt)) takers[side].push(txt.replace(" steps up", ""));
    if ((kind === "pen" || kind === "goal") && txt && txt.includes("(")) { assisted++; console.log("  ASSISTED KICK: " + txt); }
  }
  for (const sd of ["home", "away"]) {
    const five = takers[sd].slice(0, 5);
    if (new Set(five).size !== five.length) { dup5++; console.log(`  DUPLICATE in first five (${sd}): ${five.join(", ")}`); }
  }
}
console.log(`\n${shoots} shootouts, ${kicksTotal} kicks`);
console.log(`  duplicate taker inside a side's first five: ${dup5}`);
console.log(`  kicks with an assist: ${assisted}`);
console.log(`  carries a match (open play): ${(carryTot / n).toFixed(0)}   (was ~700-1000 as a heartbeat)`);
process.exit(dup5 + assisted ? 1 : 0);
