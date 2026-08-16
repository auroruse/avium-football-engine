// THE C AND D COLUMNS HAVE TO CARRY REAL NUMBERS. They were dropped from the report because the
// positional engine populated neither -- it rated a tackle, a block and a clearance and forgot
// them. Now counted per man: this checks they actually accumulate, land on plausible people, and
// that chances created reconciles against shots taken.
import { load, PROJECT } from "/Users/zli/Documents/NICHIRIN/.claude/skills/avium-tactics/scripts/lib.mjs";
import path from "path";
const eng = await import("./deng.mjs");
const { clubs } = await load(path.join(PROJECT, "src/presets/AVIUM.tsv"));
const pool = clubs.slice(0, 12);
let D = 0, C = 0, shots = 0, defByPos = {}, chByPos = {}, n = 0, zeroD = 0, zeroC = 0;
for (let k = 0; k < 20; k++) {
  const H = { ...pool[k % 12], style: "gegenpress", strategy: { ...eng.STYLE_PRESET.gegenpress } };
  const A = { ...pool[(k + 5) % 12], style: "catenaccio", strategy: { ...eng.STYLE_PRESET.catenaccio } };
  const { s, out } = eng.runPositionalMatch(H, A, 6400 + k * 7919);
  n++; shots += out.shots.home + out.shots.away;
  let md = 0, mc = 0;
  for (const sd of ["home", "away"])
    for (const q of [...s.players[sd], ...(s.subbedOff?.[sd] || [])]) {
      D += q.defActs || 0; C += q.chances || 0; md += q.defActs || 0; mc += q.chances || 0;
      defByPos[q.pos] = (defByPos[q.pos] || 0) + (q.defActs || 0);
      chByPos[q.pos] = (chByPos[q.pos] || 0) + (q.chances || 0);
    }
  if (!md) zeroD++; if (!mc) zeroC++;
}
console.log(`\n${n} matches`);
console.log(`  defensive actions: ${(D/n).toFixed(1)} a match   matches with none: ${zeroD}`);
console.log(`  chances created:   ${(C/n).toFixed(1)} a match   matches with none: ${zeroC}`);
console.log(`  shots a match:     ${(shots/n).toFixed(1)}   (chances cannot exceed shots)`);
const pct = (o) => { const t = Object.values(o).reduce((a,b)=>a+b,0) || 1;
  return Object.entries(o).sort((a,b)=>b[1]-a[1]).map(([k,v]) => `${k} ${(100*v/t).toFixed(0)}%`).join("  "); };
console.log(`  D by position: ${pct(defByPos)}`);
console.log(`  C by position: ${pct(chByPos)}`);
console.log(C / n <= shots / n ? "  chances <= shots: ok" : "  CHANCES EXCEED SHOTS -- miscounted");
