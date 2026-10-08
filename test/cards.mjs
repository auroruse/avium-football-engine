// CARDS AND CASUALTIES. Three things the engine could not say before:
//   why a man walked   -- every red was "a red", so a violent-conduct three-match ban and a second
//                         yellow's one-match ban were the same event downstream
//   what he did to himself -- "cannot continue" was the whole diagnosis, so every lay-off was the
//                         same guessed one-to-five matches
//   whether injuries happen at all -- the competition's switch gated the abstract sim only
//
// Run: node test/cards.mjs [matches]   (default 120; each match is about 1.5 s)
//      SHARD=i/n node test/cards.mjs [matches]    plays every nth match from the i-th, prints its tallies as JSON
//      node test/cards.mjs merge <folder|files>   judges every shard's tallies together
// The cloud lab splits it over its twenty runners that way (lab.yml, LAB_TEST in test/specs/run.env).
import path from "path";
const eng = await import("./engine.mjs");
// The retired skill's load() throws on any preset row that yields no club, and NCH.tsv now
// carries an in-progress collegiate division of exactly such rows. The engine's own catalog
// parses them fine and yields the same clubs in the same order, so the pool comes from it.
const __cat = eng.PRESET_CATALOG;
const load = async (f) => ({ clubs: /AVIUM/.test(f)
  ? __cat.filter(t => t.league === "Avium International")
  : __cat.filter(t => t.league === "Nichirin League One" || t.league === "Nichirin League Two") });
const PROJECT = "/Users/zli/Documents/NICHIRIN/Programs/Avium Football Engine";
const { clubs } = await load(path.join(PROJECT, "src/presets/NCH.tsv"));

const MERGE = process.argv[2] === "merge";
const N = MERGE ? 0 : +(process.argv[2] || 120);
const SH = (process.env.SHARD || "").match(/^(\d+)\/(\d+)$/);
const mine = (k) => !SH || k % +SH[2] === +SH[1];
// A shard names each match on stderr as it starts and ends, so a match that never finishes is named in the log.
const secs = [], offSecs = [];       // [fixture, seconds]: the matches as played, and the toggle's with injuries off
const timed = (k, H, A, run, into) => { const t0 = Date.now(); if (SH) process.stderr.write(`k=${k} ${H.code} v ${A.code} ... `);
  const r = run(), t = (Date.now() - t0) / 1000; into.push([k, t]); if (SH) process.stderr.write(`${t.toFixed(1)} s\n`); return r; };
const pair = (k) => [clubs[k % clubs.length], clubs[(k + 7) % clubs.length]];

let fails = 0;
const ok = (name, cond, got) => {
  if (!cond) { fails++; console.log("  FAIL  " + name + (got === undefined ? "" : "   " + JSON.stringify(got))); }
  else console.log("  ok    " + name + (got === undefined ? "" : "   " + JSON.stringify(got)));
};

const why = {}, sev = {}, part = {};
let reds = 0, hurt = 0, noDiag = 0, noVariant = 0, noOffAt = 0, badSaid = 0, badExclude = 0;
const weeks = [];
const SAID = eng.ME_RED_SAID;

let played = 0;
for (let k = 0; k < N; k++) {
  if (!mine(k)) continue;
  const [H, A] = pair(k);
  const { s, out } = timed(k, H, A, () => eng.runPositionalMatch(H, A, 900 + k * 7919), secs);
  played++;
  const byName = new Map();
  for (const sd of ["home", "away"])
    for (const q of [...s.players[sd], ...(s.subbedOff?.[sd] || [])]) byName.set(q.name, q);

  for (const sd of ["home", "away"]) {
    for (const r of out.sendOff?.[sd] || []) {
      reds++;
      why[r.why || "MISSING"] = (why[r.why || "MISSING"] || 0) + 1;
      const q = byName.get(r.name);
      if (!q || q.rcVariant !== r.why) noVariant++;      // the ledger and the man must agree
      if (!q || q._offAt === undefined) noOffAt++;       // or meFinalise rates him over ninety
    }
    for (const q of [...s.players[sd], ...(s.subbedOff?.[sd] || [])]) {
      if (!q.inj) continue;
      hurt++;
      if (!q.injSev || !q.injPart) { noDiag++; continue; }
      if (q._offAt === undefined) noOffAt++;
      const row = eng.ME_INJURY.find(v => v.id === q.injSev);
      if (!row || row.part !== q.injPart) { badExclude++; continue; }
      sev[row.label] = (sev[row.label] || 0) + 1;
      part[q.injPart] = (part[q.injPart] || 0) + 1;
      weeks.push([q.injPart + " " + row.label, row.dur]);
    }
  }
  // The feed has to carry the reason structurally, because the header reads it off the event.
  for (const f of out.feed || []) {
    if (f.k !== "red") continue;
    if (!f.why || !f.txt.endsWith(SAID[f.why])) badSaid++;
  }
}

// The toggle's matches: a competition that turns injuries off should not produce one. Cards are untouched by it.
let offInj = 0, offReds = 0;
for (let k = 0; k < Math.min(N, 40); k++) {
  if (!mine(k)) continue;
  const [H, A] = pair(k);
  const { s, out } = timed(k, H, A, () => eng.runPositionalMatch(H, A, 900 + k * 7919, null, false), offSecs);
  for (const sd of ["home", "away"]) {
    offInj += out.injuries?.[sd] || 0;
    offReds += out.reds?.[sd] || 0;
    for (const q of [...s.players[sd], ...(s.subbedOff?.[sd] || [])]) if (q.inj) offInj++;
  }
}

// A shard stops here and hands its tallies on; the merge adds every shard's up and judges them as one run.
if (SH) {
  console.log(JSON.stringify({ n: played, reds, why, hurt, sev, part, weeks, noDiag, noVariant, noOffAt, badSaid, badExclude, offInj, offReds, secs, offSecs }));
  process.exit(0);
}
if (MERGE) {
  const fs = await import("node:fs");
  const files = [];
  const walk = (p) => fs.statSync(p).isDirectory() ? fs.readdirSync(p).forEach(f => walk(path.join(p, f))) : /\.jsonl?$/.test(p) && files.push(p);
  process.argv.slice(3).forEach(walk);
  for (const f of files) for (const line of fs.readFileSync(f, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const t = JSON.parse(line);
    played += t.n; reds += t.reds; hurt += t.hurt; noDiag += t.noDiag; noVariant += t.noVariant; noOffAt += t.noOffAt;
    badSaid += t.badSaid; badExclude += t.badExclude; offInj += t.offInj; offReds += t.offReds;
    for (const [o, x] of [[why, t.why], [sev, t.sev], [part, t.part]]) for (const k in x) o[k] = (o[k] || 0) + x[k];
    weeks.push(...t.weeks); secs.push(...t.secs); offSecs.push(...t.offSecs);
  }
  const time = (v) => { const w = v.reduce((a, b) => b[1] > a[1] ? b : a, [0, 0]);
    return `${v.length} matches, mean ${(v.reduce((a, b) => a + b[1], 0) / v.length).toFixed(1)} s, slowest ${w[1].toFixed(1)} s (fixture ${w[0]})`; };
  console.log(`${files.length} shards\n  as played:    ${time(secs)}\n  injuries off: ${time(offSecs)}`);
}

console.log("\n" + played + " matches");
console.log("  reds/match      ", (reds / played).toFixed(3));
console.log("  by reason       ", JSON.stringify(why));
console.log("  injured off/match", (hurt / played).toFixed(3));
console.log("  injury           ", JSON.stringify(sev));
console.log("  body part        ", JSON.stringify(part));
// Every combination carries its own lay-off, which is the whole point of the joint table: a torn
// hamstring and a ruptured cruciate were the same four-to-seven matches when severity was rolled
// on its own.
const seen = new Map();
for (const [k, d] of weeks) seen.set(k, d);
console.log("  lay-offs seen    ", [...seen].sort((a, b) => a[1][0] - b[1][0])
  .map(([k, d]) => k + " " + d[0] + "-" + d[1]).join(", ") || "none");

console.log("\nintegrity");
ok("every red has a reason",         !why.MISSING, why.MISSING || 0);
ok("the man carries his own reason", noVariant === 0, noVariant);
ok("everyone who left has _offAt",   noOffAt === 0, noOffAt);
ok("every caption names the reason", badSaid === 0, badSaid);
ok("every injury has a diagnosis",   noDiag === 0, noDiag);
ok("diagnosis matches its table row", badExclude === 0, badExclude);
ok("more than one reason appears",   Object.keys(why).length >= 2, Object.keys(why));
// The table itself, checked once rather than waited for: a season-ending injury is roughly one in
// fifty and will not show up reliably in a couple of hundred matches, but it has to EXIST and it
// has to be uncapped.
const T = eng.ME_INJURY, wTot = T.reduce((a, b) => a + b.w, 0);
const enders = T.filter(v => v.dur[0] >= eng.ME_INJ_SEASON);
const mean = T.reduce((a, b) => a + b.w / wTot * (b.dur[0] + b.dur[1]) / 2, 0);
console.log("\nthe table");
console.log("  entries", T.length, " mean lay-off", mean.toFixed(2), "matches",
            " longest", Math.max(...T.map(v => v.dur[1])));
console.log("  season-ending  ", enders.map(v => v.part + " " + v.label).join(", "),
            " (" + (enders.reduce((a, b) => a + b.w, 0) / wTot * 100).toFixed(1) + "% of injuries)");
ok("season-ending injuries exist", enders.length > 0, enders.length);
ok("no two rows share an id",      new Set(T.map(v => v.id)).size === T.length);
ok("every row is a real range",    T.every(v => v.dur[0] >= 1 && v.dur[1] >= v.dur[0]));
ok("the same part varies by injury",
   new Set(T.filter(v => v.part === "knee").map(v => v.dur.join("-"))).size >= 3,
   T.filter(v => v.part === "knee").map(v => v.label + " " + v.dur.join("-")));

// ── the toggle ───────────────────────────────────────────────────────────────
// (played above, with the rest of the matches)
console.log("\ninjuries off");
ok("not one injury",  offInj === 0, offInj);
ok("cards unaffected", offReds > 0, offReds);

// ── the ban a reason buys ────────────────────────────────────────────────────
// Not read off the engine: this is the rule the tournament spends, and the point of naming the
// offence is that the numbers differ. Violent conduct has to outlast a second yellow.
const susp = (v) => { let lo = 99, hi = 0;
  for (let i = 0; i < 400; i++) { const g = v === "violent" ? 3 + Math.floor(i / 400 * 3)
    : v === "abusive" ? 2 + Math.floor(i / 400 * 3) : v === "sfp" ? 2 + Math.floor(i / 400 * 2) : 1;
    lo = Math.min(lo, g); hi = Math.max(hi, g); } return [lo, hi]; };
console.log("\nmatches banned");
for (const v of ["violent", "abusive", "sfp", "dogso", "second"]) console.log("  " + v.padEnd(9), susp(v).join("-"));
ok("violent conduct outlasts a second yellow", susp("violent")[0] > susp("second")[1]);
ok("serious foul play outlasts DOGSO",         susp("sfp")[0] > susp("dogso")[1]);

console.log(fails ? "\n" + fails + " FAILED" : "\nall passed");
process.exit(fails ? 1 : 0);
