// THE ALEMANNIAN RECORD THE RE-SIM STARTS FROM (13 October 2026): every Oberliga table on file from 1899/1900 to
// 1932/33 (tables only), the two seasons after it with results, the 36 clubs of both leagues as the records hold them,
// when each was founded, the Club World Cup's Alemannian entrants each year, and the shape the re-sim lands on: the
// Oberliga's eighteen of 1933/34 and the 2. Liga's eighteen of 1934/35 (nobody moved in the summer of 1934).
//
//   node test/hist/ale/data.mjs <out.json>
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

const P = "public/avium/pstats/";
const rows = (txt) => txt.split("\n").map(l => l.split("|").map(x => x.trim())).filter(p => p.length > 4 && /^\d+$/.test(p[1]));
const clean = (s) => s.replace(/\*/g, "").trim();
// A season's final table, its columns found by name.
function table(file) {
  const txt = readFileSync(file, "utf8").split("## Final Table").pop().split("\n## ")[0];
  const head = txt.split("\n").find(l => /^\|\s*#\s*\|/.test(l)).split("|").map(x => x.trim());
  const col = (k) => head.indexOf(k);
  return rows(txt).map(p => ({ club: clean(p[2]), P: +p[col("P")], W: +p[col("W")], D: +p[col("D")], L: +p[col("L")],
    GD: +String(p[col("GD")]).replace("+", ""), Pts: +p[col("Pts")] }));
}
const ao = {};
for (const f of readdirSync(P + "ao")) if (/^\d{4}\.md$/.test(f)) ao[+f.slice(0, 4)] = table(P + "ao/" + f);
const seasons = Object.keys(ao).map(Number).filter(y => y <= 1933).sort((a, b) => a - b);
const l2_1935 = table(P + "2ao/1935.md");

// The clubs, keyed by their trimmed names (the records hold "HVC Grunnen " with a trailing space).
const recs = JSON.parse(readFileSync("src/data/teams.json", "utf8")).filter(t => t && t.file === "ALE");
const clubs = {};
for (const t of recs) {
  const name = t.name.trim();
  // Founded: a four-digit year anywhere in the name, or two digits at its end ("Magdelstein 95", "Fortuna Hammersburg 01").
  const y4 = name.match(/(?:^|\s)(1[89]\d\d)(?:\s|$)/), y2 = name.match(/\s(\d\d)$/);
  const founded = y4 ? +y4[1] : y2 ? (+y2[1] < 50 ? 1900 : 1800) + +y2[1] : null;
  clubs[name] = { name, code: t.code, style: t.style || "Balanced", formation: String(t.formation || "4-4-2").trim(), ovr: +t.ovr,
    group: t.group, founded, start: Math.max(seasons[0], founded ?? 0) };
}
for (const y of [...seasons, 1934, 1935]) for (const r of ao[y]) if (!clubs[r.club]) throw new Error(`${y}: ${r.club} has no record`);
for (const r of l2_1935) if (!clubs[r.club]) throw new Error(`2. Liga 1935: ${r.club} has no record`);

// The Club World Cup's Alemannian entrants: the clubs of both leagues its report for the year names.
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cwc = {};
for (const y of seasons) {
  let txt; try { txt = readFileSync(`${P}cwc/${y}.md`, "utf8"); } catch { continue; }
  cwc[y] = Object.keys(clubs).filter(c => new RegExp(`(^|[^\\p{L}])${esc(c)}([^\\p{L}]|$)`, "u").test(txt));
}

// The shape to land on, and the size of the Oberliga each season as the record has it.
const t34 = ao[1934].map(r => r.club), t35 = ao[1935].map(r => r.club);
if (t34.length !== t35.length || t34.some(c => !t35.includes(c))) throw new Error("the Oberliga changed between 1933/34 and 1934/35");
const target = { ao: t34, l2: l2_1935.map(r => r.club) };
const size = Object.fromEntries([...seasons, 1934].map(y => [y, ao[y].length]));
const titles = Object.fromEntries(Object.keys(ao).map(Number).sort().map(y => [y, ao[y][0].club]));
writeFileSync(process.argv[2], JSON.stringify({ seasons, ao: Object.fromEntries(Object.keys(ao).map(y => [y, ao[y]])), clubs, cwc, target, size, titles }, null, 1));
console.log(`seasons ${seasons.length} (${seasons[0]}-${seasons[seasons.length - 1]}), clubs ${Object.keys(clubs).length}, sizes ${[...new Set(Object.values(size))].join("/")}`);
console.log("founded later:", Object.values(clubs).filter(c => c.start > seasons[0]).map(c => `${c.name} ${c.start}`).join(", "));
console.log("CWC entrants a year:", Object.entries(cwc).map(([y, e]) => `${y}:${e.length}`).join(" "));
