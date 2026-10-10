// PLAYERS' TRANSFER VALUES, as src/data/value.js works them out, printed for a look at the levels. Writes nothing:
// a value is never stored.
//
//   node test/values.mjs                 the grid by rating and age, the 20 most valuable, the spread, the dearest squads
//   node test/values.mjs squad SPK MOR   those clubs' squads, man by man
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { idOf } from "../src/data/draft.js";
import { valueOf, moneyLabel, trendsOf, valueContext, valueInputs } from "../src/data/value.js";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const load = (f) => JSON.parse(readFileSync(join(ROOT, "src/data", f), "utf8"));
const players = load("players.json"), teams = load("teams.json");
const national = (t) => t.file === "AVIUM" || t.file === "ARTERRA";

// Every man's position, club and league strength (valueContext, the same reading the app makes), with the XI's slots from
// src/presets/Slots.tsv, and what his rating did at the last refreshes (trendsOf, off changelog.tsv).
const slots = new Map(readFileSync(join(ROOT, "src/presets/Slots.tsv"), "utf8").split(/\r?\n/).slice(1).filter(Boolean)
  .map(r => r.split("\t")).map(c => [c[0].replace(/^'/, ""), c.slice(3, 14)]));
const ctx = valueContext(teams, (f) => slots.get(f) || slots.get("4-3-3"), idOf);
const trends = trendsOf(readFileSync(join(ROOT, "public/avium/pstats/changelog.tsv"), "utf8").split(/\r?\n/).slice(1).filter(Boolean)
  .map(r => r.split("\t")).map(c => ({ season: c[0], player: c[2], old: c[5], neu: c[6] })));
const rows = players.map(p => { const inp = valueInputs(p, ctx, trends); return { p, ...inp, value: valueOf(inp) }; });

const pad = (s, n) => String(s).padEnd(n), lpad = (s, n) => String(s).padStart(n);
const show = (r) => `${pad(r.pos || "?", 4)}${pad(r.p.name, 26)}${pad(r.club ? r.club.code : "–", 5)}${lpad(r.age, 3)}${lpad(r.ovr, 4)}${lpad(r.trend ? (r.trend > 0 ? "+" : "") + r.trend : "", 4)}  ${lpad(moneyLabel(r.value), 7)}`;
const [cmd, ...codes] = process.argv.slice(2);
if (cmd === "squad") {
  for (const code of codes) {
    const t = teams.find(x => !national(x) && x.code === code);
    if (!t) { console.log("no club " + code); continue; }
    const ids = t.squad.map(idOf).filter(Boolean), sq = ids.map(id => rows.find(r => r.p.id === id));
    console.log(`\n${t.name.trim()} (${t.group}, league average ${ctx.leagueMean.get(t.group).toFixed(1)}): ${moneyLabel(sq.reduce((a, r) => a + r.value, 0))} in all`);
    for (const r of sq) console.log("  " + show(r));
  }
} else {
  console.log("A central midfielder in a league averaging 78, rating steady:\n");
  const ages = [18, 20, 22, 25, 28, 30, 32, 34];
  console.log("        " + ages.map(a => lpad(a, 8)).join(""));
  for (const o of [60, 65, 70, 75, 80, 85, 90]) console.log(lpad(o, 6) + "  " + ages.map(a => lpad(moneyLabel(valueOf({ ovr: o, age: a, pos: "CM", leagueMean: 78 })), 8)).join(""));
  const top = [...rows].sort((a, b) => b.value - a.value);
  console.log("\nThe 20 most valuable:\n");
  top.slice(0, 20).forEach((r, i) => console.log(lpad(i + 1, 3) + "  " + show(r)));
  const v = top.map(r => r.value).reverse(), q = (f) => moneyLabel(v[Math.floor(f * (v.length - 1))]);
  const over = (x) => rows.filter(r => r.value >= x).length;
  console.log(`\nAll ${rows.length}: median ${q(0.5)}, middle half ${q(0.25)} to ${q(0.75)}; ${over(50e6)} at $50M or more, ${over(10e6)} at $10M+, ${over(1e6)} at $1M+`);
  const sq = teams.filter(t => !national(t)).map(t => ({ t, sum: t.squad.map(idOf).filter(Boolean).reduce((a, id) => a + (rows.find(r => r.p.id === id)?.value || 0), 0) }))
    .sort((a, b) => b.sum - a.sum);
  console.log("\nThe dearest squads: " + sq.slice(0, 6).map(x => `${x.t.code} ${moneyLabel(x.sum)}`).join(", "));
  console.log("The cheapest: " + sq.slice(-4).map(x => `${x.t.code} ${moneyLabel(x.sum)}`).join(", "));
}
