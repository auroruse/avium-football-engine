// DOES A PORTRAIT FILENAME COME OUT RIGHT?
//
// Player names are stored with an UPPERCASE surname and the portrait files are title-cased, so every
// lookup goes through one small function -- and "title case" turned out to be the whole problem.
// A compound surname takes a capital after its hyphen. An apostrophe goes BOTH WAYS in this squad
// list and there is no shortcut: a single letter before it is Irish or Italian and takes the capital,
// anything longer is a transliteration mark and does not.
//
// The function is pulled out of App.tsx rather than copied, so this cannot quietly pass against a
// stale duplicate of a rule that has since changed.
//
//   node test/shotname.mjs
import fs from "node:fs";

const src = fs.readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const m = src.match(/const shotName = \([\s\S]*?;\n/);
if (!m) { console.log("could not find shotName in App.tsx"); process.exit(1); }
const shotName = eval(`(${m[0].replace(/^const shotName = /, "").replace(/;\s*$/, "")})`);

const cases = [
  // the ones that sent me here
  ["Hugo SAINT-LAURENT", "Hugo Saint-Laurent"],
  ["Jean-Pierre SUSILOVIC", "Jean-Pierre Susilovic"],   // the hyphen in a GIVEN name, not a surname
  ["Séamus Ó'DUINNÍN", "Séamus Ó'Duinnín"],
  // ...and the ones that must NOT take the capital, all real entries in the preset files
  ["Jun'ichi TERAOKA", "Jun'ichi Teraoka"],
  ["Shin'ya FUCHIGAMI", "Shin'ya Fuchigami"],
  ["Rabi'u INGAWA", "Rabi'u Ingawa"],
  // single-letter prefixes that must
  ["Attila D'AMBROSI", "Attila D'Ambrosi"],
  ["Émile D'ARTAGNAN", "Émile D'Artagnan"],
  // and the plain ones, which must not have broken on the way
  ["Kōzō FUJISE", "Kōzō Fujise"],
  ["Péter SZABÓ", "Péter Szabó"],
  ["Kenichi MITSUI", "Kenichi Mitsui"],
  ["Yeray BENGOETXEA", "Yeray Bengoetxea"],
];

let bad = 0;
for (const [inp, want] of cases) {
  const got = shotName(inp);
  const ok = got.normalize("NFC") === want.normalize("NFC");
  if (!ok) bad++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${inp.padEnd(24)} -> ${got}${ok ? "" : `   want ${want}`}`);
}

// ...AND THE CHECK THAT ACTUALLY MATTERS: is every portrait on disk reachable by a real player?
// A file nobody can reach looks exactly like "no portrait yet" in the app, which is how the last two
// misses went unnoticed -- a missing accent and a lowercase letter after a hyphen.
const dir = new URL("../public/players/", import.meta.url);
const files = fs.readdirSync(dir).filter(f => f.endsWith(".png"));
const presets = new URL("../src/presets/", import.meta.url);
const names = new Set();
for (const f of fs.readdirSync(presets).filter(f => f.endsWith(".tsv"))) {
  for (const line of fs.readFileSync(new URL(f, presets), "utf8").split("\n")) {
    const c = line.split("\t");
    if (c.length <= 21) continue;
    for (const cell of c.slice(19, 41)) {
      const nm = cell.trim().replace(/\s*\[[*+]\]$/, "").replace(/\s*\[[A-Za-z]{2,4}\]$/, "")
                     .replace(/^\(\d{1,2}\)\s*/, "").trim();
      if (nm && nm.includes(" ") && /\p{L}/u.test(nm)) names.add(nm);
    }
  }
}
// exactly the chain PlayerShot tries
const want = new Map();
for (const n of names) for (const nf of ["NFC", "NFD"]) want.set(shotName(n).normalize(nf), n);
const orphans = files.filter(f => !want.has(f.slice(0, -4)));
console.log(`\n  ${files.length} portraits, ${names.size} player names in the presets.`);
if (orphans.length) {
  console.log(`  ${orphans.length} portrait(s) NO player name can reach:`);
  for (const o of orphans) console.log(`     ${o}`);
} else console.log(`  every portrait is reached by a real player.`);
console.log(bad || orphans.length ? `\n  ${bad} case failure(s), ${orphans.length} orphan(s)` : `\n  all ${cases.length} pass`);
process.exit(bad || orphans.length ? 1 : 0);
