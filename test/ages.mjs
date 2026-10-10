// PLAYERS' DATES OF BIRTH. Every player carries one ("born" in src/data/players.json), aged live by src/data/icclock.js.
// The Talopedia's dates and the ages read off the portraits went in first; this fills every man still without one, from
// his rating, his position and his rating history, the same answer every time for the same man. A date already there
// is never touched.
//
//   node test/ages.mjs report          what a fill would give, as spreads by league and by rating; writes nothing
//   node test/ages.mjs write           fill every player without a date
//   node test/ages.mjs ages <file>     write ages ([{ id, age }], the portrait review) as dates, for men without one
//   node test/ages.mjs managers report|write    the same for the managers (src/data/managers.json)
//
// The shape (the user, 9 Oct 2026): 17 to 36. The better the man, the likelier he is at his peak, 24-29 outfield and
// 27-32 for a keeper; the weaker, the wider he spreads. A rating that rose at the last refreshes makes him younger, one
// that fell older.
//
// Managers (the user, 9 Oct 2026): nobody has a date on record anywhere, so every one is made up, 33 to 66, the better
// manager the likelier he is in his late forties. Two were set by hand on the user's word and are never touched here:
// Josue Alferinho (19 February 1900) and Raiden Kirisaki (13 November 1906).
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dumpRecords, playerRecord, idOf } from "../src/data/draft.js";
import { icNow, yearsBetween, birthDateOk } from "../src/data/icclock.js";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const DATA = join(ROOT, "src/data"), PSTATS = join(ROOT, "public/avium/pstats");
const load = (f) => JSON.parse(readFileSync(join(DATA, f), "utf8"));
const players = load("players.json"), teams = load("teams.json"), managers = load("managers.json");
const fold = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");

// A man's own dice: the same stream every run, whatever else changes.
function rng(id) {
  let h = 2166136261;
  for (const c of "born:" + id) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const normal = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

// A date of birth that makes a man `age` today: a day somewhere in the year before he turned it.
function bornAt(id, age, now = icNow()) {
  const r = rng(id + ":day"), d = new Date(now);
  d.setUTCFullYear(d.getUTCFullYear() - age);
  d.setUTCDate(d.getUTCDate() - 1 - Math.floor(r() * 364));
  const iso = d.toISOString().slice(0, 10);
  if (yearsBetween(iso, now) !== age) throw new Error(`${id}: ${iso} is not ${age}`);
  return iso;
}

// Who keeps goal: a man in a keeper's slot on any sheet (the XI's first and the bench's first, on a club sheet and a
// national one alike, as src/data/positions.js slotLabels has them), or a free agent who last played there.
const keepers = new Set(players.filter(p => p.pos === "GK").map(p => p.id));
const leagueOf = new Map();
for (const t of teams) {
  const national = t.file === "AVIUM" || t.file === "ARTERRA";
  t.squad.forEach((v, i) => { const id = idOf(v); if (!id) return; if (i === 0 || i === 11) keepers.add(id);
    if (!national && !leagueOf.has(id)) leagueOf.set(id, t.group || t.file); });
}
// The last refreshes each man went through: what his rating did, net, in the newest two seasons on file.
const moved = new Map();
{
  const rows = readFileSync(join(PSTATS, "changelog.tsv"), "utf8").split(/\r?\n/).slice(1).filter(Boolean).map(r => r.split("\t"));
  const newest = Math.max(...rows.map(r => parseInt(r[0], 10)).filter(Number.isFinite));
  for (const r of rows) if (parseInt(r[0], 10) >= newest - 1) moved.set(fold(r[2]), (moved.get(fold(r[2])) || 0) + (+r[6] - +r[5]));
}
// How good a man is against everyone: his rating's place in the whole register, 0 to 1.
const sorted = players.map(p => p.ovr).sort((a, b) => a - b);
const rank = (ovr) => { let lo = 0, hi = sorted.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < ovr) lo = m + 1; else hi = m; } return lo / sorted.length; };

function ageFor(p) {
  const r = rng(p.id), gk = keepers.has(p.id);
  const peak = gk ? 29.5 : 26.5, centre = gk ? 27.5 : 25.5, spread = gk ? 6 : 5.6;
  // The better he is, the harder he is pulled into his peak years; a weak man keeps the whole range.
  const pull = Math.pow(rank(p.ovr), 2);
  const net = moved.get(fold(p.name)) || 0, shift = net >= 4 ? -3.5 : net >= 2 ? -2 : net <= -4 ? 3.5 : net <= -2 ? 2 : 0;
  // Drawn again rather than clipped when it lands outside the range, so nobody piles up on 17 or 36.
  for (let i = 0; i < 24; i++) {
    const age = pull * (peak + 2.2 * normal(r)) + (1 - pull) * (centre + spread * normal(r)) + shift;
    if (age >= 16.5 && age < 36.5) return Math.round(age);
  }
  return Math.round(peak);
}

// A manager's age: his rating's place among the managers pulls him toward his late forties; a weak one keeps the range.
const mSorted = managers.map(m => m.ovr).sort((a, b) => a - b);
const mRank = (ovr) => { let lo = 0, hi = mSorted.length; while (lo < hi) { const m = (lo + hi) >> 1; if (mSorted[m] < ovr) lo = m + 1; else hi = m; } return lo / mSorted.length; };
function managerAge(m) {
  const r = rng(m.id), pull = Math.pow(mRank(m.ovr), 2);
  for (let i = 0; i < 24; i++) {
    const age = pull * (49 + 4 * normal(r)) + (1 - pull) * (46 + 7.5 * normal(r));
    if (age >= 32.5 && age < 66.5) return Math.round(age);
  }
  return 48;
}
// Every seat a manager holds, by his ID: the club's league and whether one is a national side.
const seats = new Map();
for (const t of teams) { const id = idOf(t.manager); if (!id) continue; const s = seats.get(id) || { nt: false, league: null };
  if (t.file === "AVIUM" || t.file === "ARTERRA") s.nt = true; else s.league = s.league || t.group || t.file; seats.set(id, s); }

const write = (recs) => writeFileSync(join(DATA, "players.json"), dumpRecords(recs.map(playerRecord)));
const [cmd, arg] = process.argv.slice(2);
if (cmd === "managers" && (arg === "report" || arg === "write")) {
  const open = managers.filter(m => !m.born), now = icNow();
  const ages = new Map(open.map(m => [m.id, managerAge(m)]));
  const all = managers.map(m => ({ m, age: m.born ? yearsBetween(m.born, now) : ages.get(m.id) }));
  const line = (label, xs) => { const a = xs.map(x => x.age).sort((p, q) => p - q), q = (f) => a[Math.min(a.length - 1, Math.floor(f * a.length))];
    return `${label.padEnd(30)} ${String(a.length).padStart(5)}  median ${q(0.5)}  middle half ${q(0.25)}-${q(0.75)}  youngest ${a[0]}  oldest ${a[a.length - 1]}`; };
  console.log(`in-world date ${now.toISOString().slice(0, 10)}; ${open.length} to fill, ${managers.length - open.length} already dated`);
  console.log(line("every manager", all));
  console.log(line("national sides", all.filter(x => seats.get(x.m.id)?.nt)));
  console.log(line("clubs only", all.filter(x => seats.get(x.m.id) && !seats.get(x.m.id).nt)));
  console.log(line("no seat", all.filter(x => !seats.get(x.m.id))));
  console.log("\nby rating");
  for (const [lo, hi] of [[25, 59], [60, 69], [70, 79], [80, 99]]) console.log(line(`  ${lo}-${hi}`, all.filter(x => x.m.ovr >= lo && x.m.ovr <= hi)));
  const hist = {}; for (const { age } of all) hist[age] = (hist[age] || 0) + 1;
  console.log("\nevery age: " + Object.keys(hist).sort((a, b) => a - b).map(a => `${a}:${hist[a]}`).join(" "));
  if (arg === "write") {
    for (const m of open) { m.born = bornAt(m.id, ages.get(m.id), now); if (!birthDateOk(m.born)) throw new Error(`${m.id}: ${m.born}`); }
    writeFileSync(join(DATA, "managers.json"), dumpRecords(managers.map(playerRecord)));
    console.log(`\n${open.length} dates written`);
  }
} else if (cmd === "ages") {
  const want = JSON.parse(readFileSync(arg, "utf8")), by = new Map(players.map(p => [p.id, p]));
  let n = 0;
  for (const { id, age } of want) { const p = by.get(id); if (!p) throw new Error("no player " + id); if (p.born) continue; p.born = bornAt(id, age); n++; }
  write(players);
  console.log(`${n} dates written from ages, ${want.length - n} already had one`);
} else if (cmd === "report" || cmd === "write") {
  const open = players.filter(p => !p.born), now = icNow();
  const ages = new Map(open.map(p => [p.id, ageFor(p)]));
  const all = players.map(p => ({ p, age: p.born ? yearsBetween(p.born, now) : ages.get(p.id) }));
  const line = (label, xs) => { const a = xs.map(x => x.age).sort((m, n) => m - n), q = (f) => a[Math.min(a.length - 1, Math.floor(f * a.length))];
    const pct = (f) => String(Math.round(100 * a.filter(f).length / a.length)).padStart(3) + "%";
    return `${label.padEnd(30)} ${String(a.length).padStart(5)}  median ${q(0.5)}  middle half ${q(0.25)}-${q(0.75)}  under 21 ${pct(x => x < 21)}  over 31 ${pct(x => x > 31)}`; };
  console.log(`in-world date ${now.toISOString().slice(0, 10)}; ${open.length} to fill, ${players.length - open.length} already dated`);
  console.log(line("everyone", all));
  console.log(line("keepers", all.filter(x => keepers.has(x.p.id))));
  console.log(line("rating rose 2+ lately", all.filter(x => (moved.get(fold(x.p.name)) || 0) >= 2)));
  console.log(line("rating fell 2+ lately", all.filter(x => (moved.get(fold(x.p.name)) || 0) <= -2)));
  console.log("\nby rating");
  for (const [lo, hi] of [[35, 59], [60, 69], [70, 79], [80, 86], [87, 99]]) console.log(line(`  ${lo}-${hi}`, all.filter(x => x.p.ovr >= lo && x.p.ovr <= hi)));
  console.log("\nby league");
  const leagues = [...new Set([...leagueOf.values()])].sort();
  for (const l of leagues) { const xs = all.filter(x => leagueOf.get(x.p.id) === l); if (xs.length >= 20) console.log(line("  " + l, xs)); }
  const hist = {}; for (const { age } of all) hist[age] = (hist[age] || 0) + 1;
  console.log("\nevery age: " + Object.keys(hist).sort((a, b) => a - b).map(a => `${a}:${hist[a]}`).join(" "));
  if (cmd === "write") {
    for (const p of open) { p.born = bornAt(p.id, ages.get(p.id), now); if (!birthDateOk(p.born)) throw new Error(`${p.id}: ${p.born}`); }
    write(players);
    console.log(`\n${open.length} dates written`);
  }
} else {
  console.log("node test/ages.mjs report | write | ages <file> | managers report | managers write");
}
