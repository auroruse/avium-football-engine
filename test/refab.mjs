// THE REFEREE, OLD AGAINST NEW (24 November 2026; DESIGN.md "The referee, the touchlines and injuries"). Every ordered
// pair of League One clubs with the listed home side as host, on the same seeds in every arm:
//   old    the referee as he was: one roll a foul, the crowd on every roll (globalThis.__refOff)
//   new    the referee on the pitch, with advantage
//   noadv  the referee on the pitch, advantage off (globalThis.__advOff)
//   new7   new, with the home side's edge in a duel at 0.072 (REFAB_ARMS picks the arms)
// One row a match: arm, fixture, then host and visitor for goals, xG, fouls, yellows, reds, penalties conceded, fouls
// not given, soft fouls, advantage played (to the side fouled) and brought back, knocks, men lost hurt.
//   LAB_TEST=refab.mjs on the cloud (SHARD=i/n, each shard on all its cores)   REFAB_N fixtures an arm (1520)
//   node test/refab.mjs merge <dir>   the table, from the downloaded rows
import { spawn } from "node:child_process";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const ARMS = (process.env.REFAB_ARMS || "old,new,new7").split(","), N = +(process.env.REFAB_N || 1520);

if (process.argv[2] === "merge") {
  const dir = process.argv[3], files = fs.readdirSync(dir, { recursive: true }).filter(f => String(f).endsWith(".jsonl")).map(f => path.join(dir, String(f)));
  const rows = files.flatMap(f => fs.readFileSync(f, "utf8").split("\n").filter(l => l.startsWith("[")).map(l => JSON.parse(l)));
  const K = ["goals", "xg", "fouls", "yellows", "reds", "pens", "missed", "soft", "adv", "back", "knocks", "hurt"];
  console.log(`${rows.length} rows from ${files.length} files`);
  for (const arm of ARMS) {
    const R = rows.filter(r => r[0] === arm); if (!R.length) continue;
    const n = R.length, gd = R.map(r => r[2] - r[3]), m = gd.reduce((a, b) => a + b, 0) / n, se = Math.sqrt(gd.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1) / n);
    const w = gd.filter(v => v > 0).length, d = gd.filter(v => v === 0).length;
    console.log(`\n${arm}: ${n} matches. host goal difference ${m >= 0 ? "+" : ""}${m.toFixed(3)} (se ${se.toFixed(3)}), ${(100 * w / n).toFixed(1)}/${(100 * d / n).toFixed(1)}/${(100 * (n - w - d) / n).toFixed(1)}`);
    K.forEach((k, i) => { const h = R.reduce((a, r) => a + r[2 + i * 2], 0) / n, v = R.reduce((a, r) => a + r[3 + i * 2], 0) / n;
      const tot = R.map(r => r[2 + i * 2] + r[3 + i * 2]), tm = h + v, ts = Math.sqrt(tot.reduce((a, b) => a + (b - tm) ** 2, 0) / (n - 1) / n);
      console.log(`  ${k.padEnd(8)} host ${h.toFixed(3)}  visitor ${v.toFixed(3)}  a match ${tm.toFixed(3)} (se ${ts.toFixed(3)})`); });
    const X = 2 + K.length * 2, m1 = (j) => (R.reduce((a, r) => a + (r[X + j] || 0), 0) / n).toFixed(3);
    if (R[0].length > X) console.log(`  hurt by cause, a match: foul ${m1(0)}, tackle ${m1(1)}, air ${m1(2)}, pull ${m1(3)}; lost: foul ${m1(4)}, tackle ${m1(5)}, air ${m1(6)}, pull ${m1(7)}; treated off the field ${m1(8)}, playing on hurt ${m1(9)}`);
  }
  process.exit(0);
}

const [si, sn] = (process.env.SHARD || "0/1").split("/").map(Number);
const mine = []; for (let k = 0; k < N; k++) if (k % sn === si) mine.push(k);

if (process.env.REFAB_CHILD != null) {
  const [ci, cn] = process.env.REFAB_CHILD.split("/").map(Number);
  const { PRESET_CATALOG, runPositionalMatch, ME_HOME_ADV } = await import("./engine.mjs");
  const DUEL = ME_HOME_ADV.duel;
  const nl1 = PRESET_CATALOG.filter(t => t.league === "Nichirin League One"), pairs = [];
  for (let a = 0; a < nl1.length; a++) for (let b = 0; b < nl1.length; b++) if (a !== b) pairs.push([a, b]);
  // A penalty is charged to the side that conceded it (the engine's own harness list of every one awarded, and why).
  const pen = (o, sd) => globalThis.__penWhy.filter(e => e.side !== sd).length;
  mine.forEach((k, j) => { if (j % cn !== ci) return;
    const [a, b] = pairs[k % pairs.length];
    for (const arm of ARMS) {
      globalThis.__refOff = arm === "old" ? 1 : 0; globalThis.__advOff = arm === "noadv" ? 1 : 0;
      ME_HOME_ADV.duel = arm === "new7" ? 0.072 : DUEL;      // new7: the home-advantage dial a notch up, to see what it buys
      globalThis.__penWhy = []; globalThis.__hurt = [];
      const o = runPositionalMatch(nl1[a], nl1[b], 77e5 + k * 7919 + 13, "home").out, S = ["home", "away"];
      const two = (f) => S.map(f);
      console.log(JSON.stringify([arm, k, ...two(sd => o.goals[sd]), ...two(sd => +(o.xgS?.[sd] || 0).toFixed(3)), ...two(sd => o.fouls?.[sd] || 0),
        ...two(sd => o.yellows?.[sd] || 0), ...two(sd => o.sendOff?.[sd]?.length || 0), ...two(sd => pen(o, sd)), ...two(sd => o.refMiss?.[sd] || 0),
        ...two(sd => o.refSoft?.[sd] || 0), ...two(sd => o.advantage?.[sd] || 0), ...two(sd => o.advBack?.[sd] || 0),
        ...two(sd => (o.injuries?.[sd] || 0) - (o.injured?.[sd]?.length || 0)), ...two(sd => o.injured?.[sd]?.length || 0),
        // then, for the new game: men hurt by cause (foul, tackle, air, pull), men lost by cause, men treated, added slices
        ...["foul", "tackle", "air", "pull"].map(c => globalThis.__hurt.filter(h => h.cause === c).length),
        ...["foul", "tackle", "air", "pull"].map(c => globalThis.__hurt.filter(h => h.cause === c && h.lvl === "off").length),
        (o.treated?.home || 0) + (o.treated?.away || 0), globalThis.__hurt.filter(h => h.lvl === "hurt").length]));
    } });
  process.exit(0);
}

const W = Math.max(1, +(process.env.REFAB_W || availableParallelism()));
await Promise.all(Array.from({ length: W }, (_, i) => new Promise((res, rej) => {
  const c = spawn("node", [fileURLToPath(import.meta.url)], { env: { ...process.env, REFAB_CHILD: `${i}/${W}` }, stdio: ["ignore", "pipe", "inherit"] });
  c.stdout.on("data", (b) => process.stdout.write(b));
  c.on("exit", (code) => code === 0 ? res() : rej(new Error("child " + i + " exit " + code)));
})));
