// WHAT A MAN IS WORTH OUT OF POSITION (Moukden and Kirin, 11 October 2026), as the app shows it: POS_DROP in
// src/data/positions.js, rewritten by this script between its markers.
//
// Out of position the engine plays a man on his own position's skills, each no better than the slot's
// (src/engine/attributes.ts meAttrs). What that costs him is the skills his own position lacks for this place, each
// worth what it is worth to a man in the place's line. WEIGHTS is that worth, in rating points a skill point: how
// much a side's results move when its men in a line gain a point of one skill, over how much they move when the same
// men gain a point of rating. It is measured by test/specs/positions.mjs (every match gives each line of one side a
// random push up or down in every skill and in rating, and a regression reads each one's worth off the results).
//
//   node test/posdrop.mjs            prints the table
//   node test/posdrop.mjs write      writes it into src/data/positions.js
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIR = mkdtempSync(join(tmpdir(), "posdrop-")), ENTRY = join(DIR, "e.js"), OUT = join(DIR, "o.mjs");
writeFileSync(ENTRY, `export * from ${JSON.stringify(join(ROOT, "src/engine/attributes.ts"))};\nexport * from ${JSON.stringify(join(ROOT, "src/engine/formations.ts"))};\n`
  + `export { CFG } from ${JSON.stringify(join(ROOT, "src/engine/config.ts"))};\n`);
execFileSync(join(ROOT, "node_modules/.bin/esbuild"), [ENTRY, "--bundle", "--format=esm", "--platform=node", `--outfile=${OUT}`, "--log-level=error"]);
const E = await import(pathToFileURL(OUT).href);

// Rating points a skill point, by the kind of slot a man plays in. MEASURED twice on Nichirin League One, each fixture
// pushing a side's skills eight points and its rating four, both ways at random, and fitting goal difference (not
// expected goals, which cannot see finishing: by xG a striker's shooting looked a sixth of what it is):
//   by line (lab/positions, GitHub run 38098352381, 40,000 matches), then
//   by kind of slot (lab/positions2, run 38101243006, 60,000 matches), because a line was too coarse: its shooting
//   belonged to its attacking men, not its holding ones.
// The kinds are used where they are sharp (a weight's standard error 0.02 to 0.07): centre-backs, full-backs, central
// midfielders, wide men, strikers. Holding and attacking midfielders' slots are too few in the league to read (0.12 to
// 0.14), so they take the midfield line's. A negative weight is noise and counts as none. Strength is pushed with
// heading (one tilt makes both), so `air` carries nothing of its own. Positioning is most of what a man is worth
// anywhere; passing almost nothing.
const MID_LINE = { pace: 0.189, pass: 0.027, shoot: 0.213, tackle: 0.171, position: 0.573, strength: 0.158, air: 0, touch: 0.210 };
export const WEIGHTS = {
  CB: { pace: 0.001, pass: 0.013, shoot: 0.006, tackle: 0.109, position: 0.489, strength: 0.132, air: 0, touch: 0.125 },
  FB: { pace: 0.051, pass: 0, shoot: 0, tackle: 0.091, position: 0.545, strength: 0.122, air: 0, touch: 0.133 },
  DM: MID_LINE,
  CM: { pace: 0.195, pass: 0.074, shoot: 0.169, tackle: 0.201, position: 0.648, strength: 0.155, air: 0, touch: 0.285 },
  AM: MID_LINE,
  W: { pace: 0.132, pass: 0, shoot: 0.330, tackle: 0.256, position: 0.588, strength: 0.048, air: 0, touch: 0.211 },
  ST: { pace: 0.031, pass: 0.057, shoot: 0.448, tackle: 0.137, position: 0.444, strength: 0.145, air: 0, touch: 0.232 },
};
export const WEIGHTS_SOURCE = "measured, lab/positions2 run 38101243006 and lab/positions run 38098352381";

// The kinds of slot the second measurement (test/specs/positions2.mjs) weighs separately.
export const KIND_OF = { CB: "CB", LB: "FB", RB: "FB", LWB: "FB", RWB: "FB", DM: "DM", CM: "CM", AM: "AM", LM: "W", RM: "W", LW: "W", RW: "W", ST: "ST" };
const lineOf = (f) => { const d = f.split("-").map(Number), g = ["GK"];
  for (let i = 0; i < d[0]; i++) g.push("DEF");
  for (let k = 1; k < d.length - 1; k++) for (let i = 0; i < d[k]; i++) g.push("MID");
  for (let i = 0; i < d[d.length - 1]; i++) g.push("FWD");
  return g; };
// How often each position plays in each line, over every shape.
const share = {};
for (const f of E.FORMATIONS) { const s = E.sposFor(f), g = lineOf(f);
  s.forEach((p, i) => { const e = (share[p] ||= {}); e[g[i]] = (e[g[i]] || 0) + 1; }); }
for (const p in share) { const n = Object.values(share[p]).reduce((a, b) => a + b, 0); for (const g in share[p]) share[p][g] /= n; }

// A man's skills on a profile, at a rating of 70 (the engine's midpoint, where no skill touches its floor or ceiling).
const skills = (prof) => { const t = prof.tilt, aw = Math.min(1, Math.max(0, prof.atkW / 40)) - 0.45, o = 70;
  return { pace: o + t.pace, pass: o + t.pass, shoot: o + t.shoot + aw * E.CFG.shootAtkW, tackle: o + t.tackle - aw * 12,
           position: o + t.position, strength: o + t.strength, air: o + t.strength, touch: o + t.touch }; };
const POS = ["GK", "LB", "CB", "RB", "LWB", "RWB", "DM", "CM", "AM", "LM", "RM", "LW", "RW", "ST"];
export function dropTable() {
  const T = {};
  for (const own of POS) {
    if (own === "GK") continue;
    const row = {};
    for (const place of POS) {
      if (place === "GK" || place === own) continue;
      const a = skills(E.ME_OWN[place]), b = skills(E.ME_OWN[own]);
      let d = 0;
      // Weights by the kind of slot where they are measured that way (KIND_OF), else by the lines the place plays in.
      const wk = WEIGHTS[KIND_OF[place]];
      if (wk) for (const k in wk) d += wk[k] * Math.max(0, a[k] - b[k]);
      else for (const [g, fr] of Object.entries(share[place])) {
        if (!WEIGHTS[g]) continue;
        for (const k in WEIGHTS[g]) d += fr * WEIGHTS[g][k] * Math.max(0, a[k] - b[k]);
      }
      row[place] = Math.round(d);
    }
    T[own] = row;
  }
  return T;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const T = dropTable();
  const cols = POS.filter(p => p !== "GK");
  console.log("own\\place " + cols.map(c => c.padStart(4)).join(""));
  for (const o of cols) console.log(o.padEnd(10) + cols.map(c => (o === c ? "  ." : String(T[o][c]))).map(v => v.padStart(4)).join(""));
  if (process.argv[2] === "write") {
    const f = join(ROOT, "src/data/positions.js"), src = readFileSync(f, "utf8");
    const body = "export const POS_DROP = {\n" + cols.map(o => `  ${o}: ${JSON.stringify(T[o]).replace(/"/g, "").replace(/,/g, ", ").replace(/:/g, ": ")},`).join("\n") + "\n};";
    const a = src.indexOf("// POS_DROP BEGIN"), b = src.indexOf("// POS_DROP END");
    if (a < 0 || b < 0) throw new Error("markers missing in positions.js");
    const out = src.slice(0, a) + `// POS_DROP BEGIN (test/posdrop.mjs write, weights ${WEIGHTS_SOURCE})\n` + body + "\n" + src.slice(b);
    writeFileSync(f, out);
    console.log("written to src/data/positions.js");
  }
}
