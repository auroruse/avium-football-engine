// EVERY SIDE'S BEST ELEVEN, AND ITS BENCH IN ORDER (Moukden and Kirin, 14 October 2026: "optimizes EVERY single team's
// starting XI and then reorganizes the bench properly"). The user's answers: clubs and nations alike (the colleges
// left alone); the best eleven is the one whose ratings add up highest in the places they play, out-of-position drops
// counted (positions.js ovrAt); every side keeps its formation; a club's bench keeps its places by group, each filled by
// men of that group, strongest first, and a national bench covers its eleven slot for slot, each place the best man left
// for that starter's position.
//
//   node test/lineups.mjs          report what would change, side by side
//   node test/lineups.mjs write    write it into src/data/teams.json (then node test/records.mjs export)
//   node test/lineups.mjs nations [write]
//                                  NATIONAL SELECTION instead (the user, 14 October 2026: "the same thing, but for
//                                  optimizing national team selections"): every Avium national side's 22 picked afresh
//                                  from every man of its nationality at a club or a free agent, never a college man
//                                  (the user, 14 October 2026: "don't call college players up"; Arterra's sides carry
//                                  exactly their 22 and are left alone). Its best eleven in its own
//                                  formation as above, then each bench place the best man left for the starter it covers;
//                                  pure best, a man already called up winning only a tie.
//
// The eleven is one optimal assignment of the whole squad to the formation's eleven places: rating as played first, then,
// among equal ratings, the man nearest his own position (posFitCost), then the man already in that place.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIR = mkdtempSync(join(tmpdir(), "lineups-")), ENTRY = join(DIR, "entry.js"), OUT = join(DIR, "lineups.mjs");
writeFileSync(ENTRY, `export * from ${JSON.stringify(join(ROOT, "src/data/positions.js"))};\n`
  + `export { sposFor } from ${JSON.stringify(join(ROOT, "src/engine/formations.ts"))};\n`
  + `export { meHungarian } from ${JSON.stringify(join(ROOT, "src/engine/assignment.ts"))};\n`
  + `export { dumpRecords } from ${JSON.stringify(join(ROOT, "src/data/draft.js"))};\n`);
execFileSync(join(ROOT, "node_modules/.bin/esbuild"), [ENTRY, "--bundle", "--format=esm", "--platform=node", `--outfile=${OUT}`, "--log-level=error"]);
const { ovrAt, posFitCost, posList, fitsPlace, slotLabels, sposFor, meHungarian, dumpRecords } = await import(pathToFileURL(OUT).href);

const read = (f) => JSON.parse(readFileSync(join(ROOT, "src/data", f), "utf8"));
const players = new Map(read("players.json").map(p => [p.id, p]));
const teams = read("teams.json"), leagues = read("leagues.json");
const COLLEGE = new Set(leagues.filter(l => l.college).map(l => l.name));
const NATIONAL = new Set(["AVIUM", "ARTERRA"]);
const atCollege = new Set(teams.filter(t => COLLEGE.has(t.group) && !NATIONAL.has(t.file)).flatMap(t => (t.squad || []).map(v => (v && typeof v === "object" ? v.id : v)).filter(Boolean)));
const idOf = (v) => (v && typeof v === "object" ? v.id : v) || null;
const own = (v) => posList(players.get(idOf(v))?.pos);
const ovr = (v) => players.get(idOf(v))?.ovr ?? 0;
const at = (v, place) => ovrAt(ovr(v), own(v), place);
const nm = (v) => { const p = players.get(idOf(v)); return p ? `${p.name.split(" ").pop()} ${p.ovr}` : "?"; };

// An optimal assignment of men to places, best score first: rows the places, columns the men, padded square.
function assign(places, men, score) {
  const n = Math.max(places.length, men.length);
  if (!n || !men.length) return places.map(() => null);
  const a = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i < places.length && j < men.length ? -score(i, men[j]) : 0)));
  const res = meHungarian(a, n);
  return places.map((_, i) => (res[i] >= 0 && res[i] < men.length ? men[res[i]] : null));
}

function pick(t) {
  const club = !NATIONAL.has(t.file), sq = t.squad, n = sq.length;
  const xiPos = sposFor(String(t.formation || "4-3-3").trim());
  const men = sq.filter(Boolean);
  // The eleven: rating as played, then nearness to his own position, then who stands there now.
  const xi = assign(xiPos, men, (i, v) => at(v, xiPos[i]) * 1000 - posFitCost(own(v), xiPos[i]) * 10 + (sq[i] === v ? 1 : 0));
  const left = men.filter(v => !xi.includes(v));
  // The bench's places, as the sheet labels them once the eleven is set (a national bench takes its starters' groups).
  const labels = slotLabels(sposFor, t.formation, n, club).slice(11);
  let bench;
  if (club) {
    // Men of a place's group in it, strongest first, a man staying out of a place he does not fit wherever he can.
    bench = assign(labels, left, (i, v) => (fitsPlace(own(v), labels[i]) ? 1e6 : 0) + ovr(v) * 100 - i * 0.01 * ovr(v));
    // Within each group the strongest first: re-deal each group's men over its own places in rating order.
    for (const g of new Set(labels)) {
      const idx = labels.map((l, i) => (l === g ? i : -1)).filter(i => i >= 0);
      const got = idx.map(i => bench[i]).filter(Boolean).sort((a, b) => ovr(b) - ovr(a));
      idx.forEach((i, k) => { bench[i] = got[k] ?? null; });
    }
  } else {
    // Each bench place covers the starter in the same slot: the best man left for his position, his group first.
    bench = assign(labels, left, (i, v) => (fitsPlace(own(v), labels[i]) ? 1e6 : 0) + at(v, xiPos[i]) * 100);
  }
  return [...xi, ...bench].slice(0, n).concat(Array(Math.max(0, n - 11 - bench.length)).fill(null)).slice(0, n);
}

// A national side's 22 from its whole nation. The assignment runs over the men who could matter: for each place, the
// best few for it, which keeps Nichirin's 875 to a few hundred.
function select(t) {
  const n = t.squad.length, xiPos = sposFor(String(t.formation || "4-3-3").trim());
  const now = new Map(t.squad.filter(Boolean).map(v => [idOf(v), v]));
  const pool = [...players.values()].filter(p => p.nat === t.nation && !atCollege.has(p.id)).map(p => now.get(p.id) || p.id);
  const short = (places, men, score) => { const keep = new Set();
    places.forEach((_, i) => men.map(v => [score(i, v), v]).sort((a, b) => b[0] - a[0]).slice(0, 24).forEach(([, v]) => keep.add(v)));
    return men.filter(v => keep.has(v)); };
  const tie = (v) => (now.has(idOf(v)) ? 1 : 0);
  const xiScore = (i, v) => at(v, xiPos[i]) * 1000 - posFitCost(own(v), xiPos[i]) * 10 + tie(v);
  const xi = assign(xiPos, short(xiPos, pool, xiScore), xiScore);
  const left = pool.filter(v => !xi.includes(v));
  const labels = slotLabels(sposFor, t.formation, n, false).slice(11);
  const bScore = (i, v) => (fitsPlace(own(v), labels[i]) ? 1e6 : 0) + at(v, xiPos[i]) * 1000 - posFitCost(own(v), xiPos[i]) * 10 + tie(v);
  const bench = assign(labels, short(labels, left, bScore), bScore);
  return [...xi, ...bench, ...Array(Math.max(0, n - 11 - bench.length)).fill(null)].slice(0, n);
}

if (process.argv[2] === "nations") {
  const write = process.argv[3] === "write";
  let sides = 0, changed = 0, ins = 0, gain = 0;
  const lines = [];
  for (const t of teams) {
    if (t.removed || t.file !== "AVIUM" || !Array.isArray(t.squad) || !t.squad.length) continue;
    sides++;
    const before = t.squad, after = select(t), xiPos = sposFor(String(t.formation || "4-3-3").trim());
    if (after.length !== before.length) throw new Error(`${t.code}: squad length changed`);
    if (new Set(after.filter(Boolean).map(idOf)).size !== after.filter(Boolean).length) throw new Error(`${t.code}: a man twice`);
    const was = new Set(before.filter(Boolean).map(idOf)), is = new Set(after.filter(Boolean).map(idOf));
    const newIn = after.filter(v => v && !was.has(idOf(v))), out = before.filter(v => v && !is.has(idOf(v)));
    const sum = (sq) => sq.slice(0, 11).reduce((s, v, i) => s + (v ? at(v, xiPos[i]) : 0), 0);
    const d = sum(after) - sum(before);
    if (after.every((v, i) => idOf(v) === idOf(before[i]))) continue;
    changed++; ins += newIn.length; gain += d;
    if (newIn.length) lines.push([d, `${t.code.padEnd(4)} ${t.name.slice(0, 18).padEnd(18)} eleven ${d >= 0 ? "+" : ""}${d}  in ${newIn.length}: ${newIn.map(nm).join(", ")}  out: ${out.map(nm).join(", ")}`]);
    if (write) t.squad = after;
  }
  lines.sort((a, b) => b[0] - a[0]).forEach(([, l]) => console.log(l));
  console.log(`\n${sides} Avium national sides; ${changed} change, ${ins} men called up in place of others, elevens ${gain >= 0 ? "+" : ""}${gain} rating points as played`);
  if (write) { writeFileSync(join(ROOT, "src/data/teams.json"), dumpRecords(teams)); console.log("wrote src/data/teams.json"); }
  process.exit(0);
}

const write = process.argv[2] === "write";
let sides = 0, changed = 0, xiChanged = 0, gain = 0, moved = 0;
const report = [];
for (const t of teams) {
  if (t.removed || COLLEGE.has(t.group) || !Array.isArray(t.squad) || !t.squad.length) continue;
  sides++;
  const before = t.squad, after = pick(t);
  if (after.length !== before.length) throw new Error(`${t.code}: squad length changed`);
  const ids = (sq) => sq.map(idOf).filter(Boolean).sort().join();
  if (ids(before) !== ids(after)) throw new Error(`${t.code}: squad membership changed`);
  const xiPos = sposFor(String(t.formation || "4-3-3").trim());
  const sum = (sq) => sq.slice(0, 11).reduce((s, v, i) => s + (v ? at(v, xiPos[i]) : 0), 0);
  const d = sum(after) - sum(before);
  const diff = after.filter((v, i) => idOf(v) !== idOf(before[i])).length;
  if (!diff) continue;
  changed++; moved += diff; gain += d;
  const ins = after.slice(0, 11).filter(v => v && !before.slice(0, 11).map(idOf).includes(idOf(v)));
  if (ins.length) xiChanged++;
  report.push({ t, d, diff, ins, outs: before.slice(0, 11).filter(v => v && !after.slice(0, 11).map(idOf).includes(idOf(v))) });
  if (write) t.squad = after;
}
report.sort((a, b) => b.d - a.d);
for (const r of report.slice(0, 40)) if (r.ins.length)
  console.log(`${r.t.code.padEnd(5)} ${r.t.name.slice(0, 26).padEnd(26)} ${r.t.formation.padEnd(9)} eleven ${r.d >= 0 ? "+" : ""}${r.d} as played`
    + `  in: ${r.ins.map(nm).join(", ")}  out: ${r.outs.map(nm).join(", ")}`);
console.log(`\n${sides} sides; ${changed} change (${xiChanged} their eleven, the rest only places or the bench), ${moved} places, `
  + `elevens ${gain >= 0 ? "+" : ""}${gain} rating points as played in all`);
if (write) { writeFileSync(join(ROOT, "src/data/teams.json"), dumpRecords(teams)); console.log("wrote src/data/teams.json"); }
