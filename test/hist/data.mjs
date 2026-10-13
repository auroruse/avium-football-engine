// THE RECORD THE RE-SIM STARTS FROM (13 October 2026): every NL1 table on file from 1888/89 to 1930/31, the NL2
// winners, the clubs (with what the records say of them now), the league's changes season by season, and the shape the
// re-sim has to land on in 1931/32. Writes one JSON for the planner.
//
//   node test/hist/data.mjs <out.json>
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

const P = "public/avium/pstats/";
const rows = (txt) => txt.split("\n").map(l => l.split("|").map(x => x.trim())).filter(p => p.length > 4 && /^\d+$/.test(p[1]));
const clean = (s) => s.replace(/\*/g, "").trim();
// A season's final table: the columns by name, so a file with GF and GA and one without both read.
function table(file, final) {
  let txt = readFileSync(file, "utf8");
  if (final) txt = txt.split("## Final Table").pop().split("\n## ")[0];
  const head = txt.split("\n").find(l => /^\|\s*#\s*\|/.test(l)).split("|").map(x => x.trim());
  const col = (k) => head.indexOf(k);
  return rows(txt).map(p => ({ club: clean(p[2]), P: +p[col("P")], W: +p[col("W")], D: +p[col("D")], L: +p[col("L")],
    GD: +String(p[col("GD")]).replace("+", ""), Pts: +p[col("Pts")] }));
}
const nl1 = {};
for (const f of readdirSync(P + "nl1")) if (/^\d{4}\.md$/.test(f)) { const y = +f.slice(0, 4); nl1[y] = table(P + "nl1/" + f, y >= 1932); }
const nl2won = Object.fromEntries(readFileSync(P + "nl2/winners.tsv", "utf8").trim().split("\n").slice(1).map(l => l.split("\t")).map(([y, w]) => [+y, w]));
const nl2t = { 1934: table(P + "nl2/1934.md", true) };

// 343 Kōkūtai is Dai-Ichi Sen'ninhara's first name (Club Lore lineage): one club, shown under that name to 1891/92.
const ALIAS = { "343 Kōkūtai": "Dai-Ichi Sen'ninhara" };
const ent = (n) => ALIAS[n] || n;
// The clubs the records no longer hold, merged away or gone, with codes of their own for the re-sim.
const OLD = { "Dai-Ichi Konoe": "DKO", "Kurihama Chinjufu": "KUR", "Kyōmei": "KYO", "Sasebo Shuto": "SAS", "Suirai Sentai": "SUI", "Zōsensho": "ZOS" };

const recs = JSON.parse(readFileSync("src/data/teams.json", "utf8")).filter(t => t && t.file === "NCH");
const rec = new Map(recs.map(t => [t.name, t]));
const S1 = Object.keys(nl1).map(Number).filter(y => y <= 1931).sort((a, b) => a - b);
const members = (y) => new Set(nl1[y].map(r => ent(r.club)));

const clubs = {};
for (const y of S1) for (const r of nl1[y]) {
  const n = ent(r.club);
  if (!clubs[n]) { const t = rec.get(n);
    clubs[n] = t ? { name: n, code: t.code, style: t.style || "balanced", formation: String(t.formation || "4-4-2").trim(), ovr: t.ovr ?? null, group: t.group }
                 : { name: n, code: OLD[n], style: null, formation: null, ovr: null, group: null }; }
}
// First season on record (NL1, or the NL2 season before a recorded promotion), and the last for the clubs now gone.
const first = {}, last = {};
for (const y of S1) for (const n of members(y)) { first[n] ??= y; last[n] = y; }
for (const [y, w] of Object.entries(nl2won)) if (+y <= 1931) first[w] = Math.min(first[w] ?? 9999, +y);
for (const n of Object.keys(clubs)) clubs[n].first = first[n];
for (const n of Object.keys(OLD)) clubs[n].fold = last[n];
// Kyōmei never came back after 1892/93; the record's 1893/94 drops it with Kannushi and Sasebo Shuto.

// The league's changes into each season: who came in that had never been in it, who left, and the size.
const changes = {};
for (let i = 1; i < S1.length; i++) {
  const a = members(S1[i - 1]), b = members(S1[i]), y = S1[i];
  changes[y] = { into: [...b].filter(n => !a.has(n)), out: [...a].filter(n => !b.has(n)), size: b.size };
}

// The shape 1931/32 must have: NL1 as nl1/1932.md, NL2 backed out of the closed pyramid of 1931/32-1933/34.
const n32 = new Set(nl1[1932].map(r => r.club)), n33 = new Set(nl1[1933].map(r => r.club)), n34 = new Set(nl1[1934].map(r => r.club));
const nl2_34 = new Set(nl2t[1934].map(r => r.club));
const nl2_33 = new Set([...nl2_34, ...[...n34].filter(c => !n33.has(c))].filter(c => !(n33.has(c) && !n34.has(c))));
const nl2_32 = new Set([...nl2_33, ...[...n33].filter(c => !n32.has(c))].filter(c => !(n32.has(c) && !n33.has(c))));
const alive = Object.keys(clubs).filter(n => !(n in OLD));
const target = { nl1: [...n32], nl2: [...nl2_32], out: alive.filter(n => !n32.has(n) && !nl2_32.has(n)) };
// The two NL2 seasons after it, held to what the record says they did.
const held = {
  1932: { nl2: [...nl2_32], winner: nl2won[1932], up: [...n33].filter(c => !n32.has(c)), down: [...n32].filter(c => !n33.has(c)) },
  1933: { nl2: [...nl2_33], winner: nl2won[1933], up: [...n34].filter(c => !n33.has(c)), down: [...n33].filter(c => !n34.has(c)) },
};
const titles = Object.fromEntries(Object.keys(nl1).map(Number).sort().map(y => [y, ent(nl1[y][0].club)]));
writeFileSync(process.argv[2], JSON.stringify({ seasons: S1, nl1: Object.fromEntries(S1.map(y => [y, nl1[y].map(r => ({ ...r, club: ent(r.club), shown: r.club }))])),
  late: Object.fromEntries([1932, 1933, 1934, 1935].map(y => [y, nl1[y].map(r => ({ ...r, club: ent(r.club) }))])),
  nl2won, clubs, changes, target, held, titles, alias: ALIAS }, null, 1));
console.log("seasons", S1.length, "clubs", Object.keys(clubs).length, "target", target.nl1.length, target.nl2.length, target.out.length, target.out);
console.log("held", JSON.stringify(held));
