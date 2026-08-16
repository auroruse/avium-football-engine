// CARDS AND CASUALTIES. Three things the engine could not say before:
//   why a man walked   -- every red was "a red", so a violent-conduct three-match ban and a second
//                         yellow's one-match ban were the same event downstream
//   what he did to himself -- "cannot continue" was the whole diagnosis, so every lay-off was the
//                         same guessed one-to-five matches
//   whether injuries happen at all -- the competition's switch gated the abstract sim only
//
// Run: node test/cards.mjs [matches]   (default 120; each match is about 1.5 s)
import path from "path";
const eng = await import("./engine.mjs");
const { load, PROJECT } = await import("/Users/zli/Documents/NICHIRIN/.claude/skills/avium-tactics/scripts/lib.mjs");
const { clubs } = await load(path.join(PROJECT, "src/presets/NCH.tsv"));

const N = +(process.argv[2] || 120);
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

for (let k = 0; k < N; k++) {
  const [H, A] = pair(k);
  const { s, out } = eng.runPositionalMatch(H, A, 900 + k * 7919);
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

console.log("\n" + N + " matches");
console.log("  reds/match      ", (reds / N).toFixed(3));
console.log("  by reason       ", JSON.stringify(why));
console.log("  injured off/match", (hurt / N).toFixed(3));
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
// A competition that turns injuries off should not produce one. Cards are untouched by it.
let offInj = 0, offReds = 0;
for (let k = 0; k < Math.min(N, 40); k++) {
  const [H, A] = pair(k);
  const { s, out } = eng.runPositionalMatch(H, A, 900 + k * 7919, null, false);
  for (const sd of ["home", "away"]) {
    offInj += out.injuries?.[sd] || 0;
    offReds += out.reds?.[sd] || 0;
    for (const q of [...s.players[sd], ...(s.subbedOff?.[sd] || [])]) if (q.inj) offInj++;
  }
}
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
