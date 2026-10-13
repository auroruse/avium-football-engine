// WRITE THE OLD CUPS (13 October 2026) as the app's own knockout reports (buildSeasonMd), the way stsc/1932.md reads,
// and their winners into stsc/winners.tsv.
//
//   node test/hist/cupwrite.mjs <cups.json>
import { readFileSync, writeFileSync } from "node:fs";
const E = await import("../engine.mjs");
const [cf] = process.argv.slice(2);
const P = process.env.HIST_OUT || "public/avium/pstats/";
const { cups } = JSON.parse(readFileSync(cf, "utf8"));
const shown = (c, y) => (c === "Dai-Ichi Sen'ninhara" && y <= 1892 ? "343 Kōkūtai" : c);
const won = {};
for (const [ys, cup] of Object.entries(cups)) {
  const y = +ys;
  const ko = { rounds: cup.rounds.map(r => ({ name: r.name, matches: r.matches.map(m => ({
    home: { name: shown(m.home, y) }, away: { name: shown(m.away, y) }, result: { ftHome: m.ftHome, ftAway: m.ftAway, et: m.et, pen: m.pen } })) })) };
  writeFileSync(`${P}stsc/${y}.md`, E.buildSeasonMd({ title: `${y} Sei'i Tai Shogun Cup`, ko }));
  won[y] = shown(cup.winner, y);
}
const rows = readFileSync(`${P}stsc/winners.tsv`, "utf8").trim().split("\n");
const keep = rows.slice(1).filter(l => !(+l.split("\t")[0] in won));
const all = [...keep, ...Object.entries(won).map(([y, w]) => `${y}\t${w}`)].sort((a, b) => +a.split("\t")[0] - +b.split("\t")[0]);
writeFileSync(`${P}stsc/winners.tsv`, [rows[0], ...all].join("\n") + "\n");
console.log(`wrote ${Object.keys(won).length} cups`);
