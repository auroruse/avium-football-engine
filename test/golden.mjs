// THE SAFETY NET FOR PERFORMANCE WORK. "Faster without losing any complexity" is only a claim you
// can make if you can show the engine still produces the identical match, tick for tick -- so this
// hashes everything a match resolves and compares it against a recorded baseline.
//
//   node test/golden.mjs write   record the current engine as the baseline
//   node test/golden.mjs         check the current engine against it (and time it)
//
// The hash covers the scoreline, the whole event feed with its coordinates, every counter, and
// every man's own numbers. Anything the engine decides differently moves it.
import fs from "node:fs";
import crypto from "node:crypto";
import path from "path";

const eng = await import("./engine.mjs");
const { load, PROJECT } = await import("/Users/zli/Documents/NICHIRIN/.claude/skills/avium-tactics/scripts/lib.mjs");

const BASE = new URL("./golden.json", import.meta.url);
const MODE = process.argv[2] || "check";
const N = +(process.argv[3] || 24);

// A spread of fixtures rather than one repeated: styles differ, so the paths through the engine do.
const { clubs } = await load(path.join(PROJECT, "src/presets/NCH.tsv"));
const { clubs: intl } = await load(path.join(PROJECT, "src/presets/AVIUM.tsv"));
const pool = [...clubs, ...intl];

const round = (v) => (typeof v === "number" ? Math.round(v * 1e6) / 1e6 : v);
const digest = (m) => {
  const { s, out } = m;
  const parts = [];
  parts.push(out.goals.home, out.goals.away, out.shots.home, out.shots.away,
             out.onTarget.home, out.onTarget.away, out.saves.home, out.saves.away,
             out.corners.home, out.corners.away, out.fouls.home, out.fouls.away,
             out.passes, out.passOk, out.passFail, out.tackles, out.carries, out.clears,
             out.blocked, out.inplay, out.min, round(out.xg));
  for (const k of ["passSide", "passOkSide", "possX", "passFwd", "xgS", "poss",
                   "yellows", "reds", "injuries", "tackleWonSide", "tackleTrySide",
                   "blockedSide", "woodworkSide", "tacklesSide", "gkStopSide", "carriesSide"])
    for (const sd of ["home", "away"]) parts.push(k, round(out[k]?.[sd] ?? 0));
  for (const v of out.shotDist || []) parts.push(v);
  // The feed is the narrative: who did what, where, and in what order.
  for (const f of out.feed || []) parts.push(f.min, f.side, f.k, f.txt, f.why || "", f.sev || "", f.part || "");
  for (const sd of ["home", "away"]) {
    for (const g of out.scorers?.[sd] || []) parts.push("G", sd, g.min, g.name, g.assist || "", g.pen ? 1 : 0);
    for (const r of out.sendOff?.[sd] || []) parts.push("R", sd, r.min, r.name, r.why);
    for (const q of out.penMiss?.[sd] || []) parts.push("P", sd, q.min, q.name);
    // Positions to the micron: a change in the physics moves these long before it moves a score.
    for (const p of [...s.players[sd], ...(s.subbedOff?.[sd] || [])])
      parts.push(p.name, p.pos, round(p.x), round(p.y), round(p.ovr), round(p.rating),
                 p.goals || 0, p.assists || 0, p.passOk || 0, p.defActs || 0, p.saves || 0,
                 p.yc || 0, p.rc ? 1 : 0, p.inj ? 1 : 0, p.injSev || "", p.injPart || "",
                 p.rcVariant || "", p.inGoal ? 1 : 0, round(p.stamina), p._onAt ?? -1, p._offAt ?? -1);
  }
  return crypto.createHash("sha256").update(parts.join("")).digest("hex").slice(0, 16);
};

const fixtures = Array.from({ length: N }, (_, k) => [k % pool.length, (k * 7 + 3) % pool.length, 1000 + k * 7919]);

const t0 = process.hrtime.bigint();
const hashes = fixtures.map(([a, b, seed]) => digest(eng.runPositionalMatch(pool[a], pool[b], seed)));
const ms = Number(process.hrtime.bigint() - t0) / 1e6;

console.log(N + " matches in " + (ms / 1000).toFixed(2) + "s   " +
            (ms / N).toFixed(0) + " ms/match   " + (N / (ms / 1000)).toFixed(2) + " matches/s");
console.log("a 380-match season would take " + (ms / N * 380 / 1000 / 60).toFixed(1) + " min");

if (MODE === "write") {
  fs.writeFileSync(BASE, JSON.stringify({ n: N, hashes }, null, 0));
  console.log("\nbaseline written: " + hashes.length + " fixtures");
  process.exit(0);
}

if (!fs.existsSync(BASE)) { console.log("\nno baseline — run: node test/golden.mjs write"); process.exit(1); }
const want = JSON.parse(fs.readFileSync(BASE, "utf8"));
if (want.n !== N) { console.log("\nbaseline holds " + want.n + " fixtures, asked for " + N); process.exit(1); }
const bad = hashes.map((h, i) => [i, h]).filter(([i, h]) => h !== want.hashes[i]);
if (!bad.length) console.log("\nidentical to baseline across all " + N + " matches");
else {
  console.log("\n" + bad.length + " of " + N + " MATCHES DIVERGED");
  for (const [i, h] of bad.slice(0, 6))
    console.log("  fixture " + i + "  " + want.hashes[i] + " -> " + h);
}
process.exit(bad.length ? 1 : 0);
