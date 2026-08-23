// Recompute every national team's 22 player columns from the player pool, the way the Utilities
// tab's selector used to on screen. Prints a TSV to stdout: one row per nation in AVIUM.tsv's
// order, the code and the formation first, then #1..#11 and SUB #1..#11 in preset cell format --
// paste the player columns over the sheet's. A summary of what moved goes to stderr.
//
//   zsh test/rebuild.sh && node test/natxi.mjs > natxi.tsv
//   node test/natxi.mjs NCH ESU          # just these nations
import { PRESET_CATALOG, buildPlayerIndex, pickNationalSquad, presetCell } from "./engine.mjs";

const only = new Set(process.argv.slice(2).map(s => s.toUpperCase()));
const teams = PRESET_CATALOG;
const nations = teams.filter(t => t.league === "Avium International" && (!only.size || only.has(t.code)));
const index = buildPlayerIndex(teams);
const cols = [...Array(11)].map((_, i) => "#" + (i + 1)).concat([...Array(11)].map((_, i) => "SUB #" + (i + 1)));
console.log(["#", "NATION", "FORMATION", ...cols].join("\t"));
let xiGaps = 0, benchGaps = 0, moved = 0;
for (const t of nations) {
  const r = pickNationalSquad(index, teams, t.code);
  const cells = r.template.map((_, i) => presetCell(r.players[i]));
  const was = (t.squad || []).map(p => presetCell(p));
  const diff = cells.filter((c, i) => c !== (was[i] || "")).length;
  moved += diff;
  const gx = r.template.filter((s, i) => !s.bench && !r.players[i]).length;
  const gb = r.template.filter((s, i) => s.bench && !r.players[i]).length;
  xiGaps += gx; benchGaps += gb;
  if (gx || gb || diff) console.error(`${t.code.padEnd(4)} ${r.formation.padEnd(9)} changed ${String(diff).padStart(2)}/22${gx ? `  XI GAPS ${gx}` : ""}${gb ? `  BENCH GAPS ${gb}` : ""}`);
  console.log([t.code, t.name, r.formation, ...cells].join("\t"));
}
console.error(`${nations.length} nations, ${moved} cells changed, ${xiGaps} XI gaps, ${benchGaps} bench gaps`);
