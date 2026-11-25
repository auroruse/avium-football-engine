// LONG SHOTS (25 November 2026: goals from 25-35 m going in more often than ones from the edge of the box). Every strike
// in national-side matches, one JSON line each: distance, angle, xG, outcome, the keeper's place, the ball's speed and
// aim, the shooter's execution, and whether he carries the long-shot trait.
//   SHARD=i/n node test/longshots.mjs [matches]   every nth match from the i-th, over this machine's cores
//   node test/longshots.mjs merge <files...>      the bands, judged together
// The cloud lab splits it over its twenty runners (lab.yml, LAB_TEST in test/specs/run.env).
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { cpus } from "node:os";
import { fileURLToPath } from "node:url";

const bands = [[0, 11], [11, 16.5], [16.5, 20], [20, 25], [25, 30], [30, 35], [35, 40], [40, 99]];
if (process.argv[2] === "merge") {
  const ALL = [], MS = [];
  for (const f of process.argv.slice(3)) for (const l of readFileSync(f, "utf8").split("\n")) { if (!l.startsWith("{")) continue; const r = JSON.parse(l);
    if (r.m != null) MS.push(r); else ALL.push(r); }
  for (const vv of [...new Set(MS.map(r => r.vr ?? 0))].sort()) {
  const S = ALL.filter(x => (x.vr ?? 0) === vv), M = { n: 0, g: 0 }; for (const r of MS) if ((r.vr ?? 0) === vv) { M.n++; M.g += r.g; }
  console.log(`\n===== variant ${vv} =====`);
  const goals = S.filter(s => s.out === "goal").length, med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
  console.log(`matches ${M.n} | shots ${(S.length / M.n).toFixed(1)} a match | goals ${(M.g / M.n).toFixed(2)} a match, ${goals} from logged shots`);
  console.log("band      shots  %shots  goals %goals  conv%  xG%  onFrame%  save%(of on frame)  keeper off line (m, median)  ball m/s  trait%  trait conv%");
  for (const [a, b] of bands) { const s = S.filter(x => !x.hdr && x.d >= a && x.d < b); if (!s.length) continue; const g = s.filter(x => x.out === "goal");
    const on = s.filter(x => x.fr), sv = on.filter(x => x.out === "catch" || x.out === "parry"), tr = s.filter(x => x.ls);
    console.log(`${a}-${b}`.padEnd(9), String(s.length).padStart(6), (100 * s.length / S.length).toFixed(1).padStart(7), String(g.length).padStart(6), (100 * g.length / goals).toFixed(1).padStart(6),
      (100 * g.length / s.length).toFixed(1).padStart(6), (100 * s.reduce((q, x) => q + x.xg, 0) / s.length).toFixed(1).padStart(5), (100 * on.length / s.length).toFixed(0).padStart(9),
      (100 * sv.length / Math.max(1, on.length)).toFixed(0).padStart(19), med(s.map(x => x.gkd)).toFixed(1).padStart(28), med(s.map(x => x.v)).toFixed(1).padStart(9),
      (100 * tr.length / s.length).toFixed(0).padStart(7), (100 * tr.filter(x => x.out === "goal").length / Math.max(1, tr.length)).toFixed(1).padStart(12)); }
  // the long goals themselves
  const far = S.filter(x => !x.hdr && x.d >= 25 && x.out === "goal");
  console.log("\ngoals from 25 m and beyond:", far.length, "| angle off centre (m, median)", med(far.map(x => Math.abs(x.y))).toFixed(1), "| keeper off his line (median)", med(far.map(x => x.gkd)).toFixed(1),
    "| keeper out", far.filter(x => x.gko).length, "| speed m/s", med(far.map(x => x.v)).toFixed(1), "| trait", far.filter(x => x.ls).length, "| aimed height", med(far.map(x => x.az ?? 0)).toFixed(2));
  const farAll = S.filter(x => !x.hdr && x.d >= 25);
  console.log("all shots from 25 m and beyond:", farAll.length, "| keeper off his line (median)", med(farAll.map(x => x.gkd)).toFixed(1), "| speed", med(farAll.map(x => x.v)).toFixed(1), "| aimed height", med(farAll.map(x => x.az ?? 0)).toFixed(2));
  const out = (a, b) => { const s = S.filter(x => !x.hdr && x.d >= a && x.d < b); return (100 * s.filter(x => x.out === "goal").length / Math.max(1, s.length)).toFixed(1) + "%"; };
  console.log("outside the box:", out(16.5, 99), "| 16.5-25:", out(16.5, 25), "| 25 and beyond:", out(25, 99), "| goals from outside the box:", (100 * S.filter(x => !x.hdr && x.d >= 16.5 && x.out === "goal").length / goals).toFixed(1) + "% of goals");
  }
  process.exit(0);
}

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const N = +(process.argv[2] || process.env.LS_N || 4000), SH = (process.env.SHARD || "0/1").match(/^(\d+)\/(\d+)$/), CHILD = process.env.LS_CHILD;
const W = +(process.env.LS_W || cpus().length);
if (CHILD == null) {
  // the shard's matches over this machine's cores
  await Promise.all(Array.from({ length: W }, (_, i) => new Promise(done => {
    // each child's lines passed on whole, so two cores never tear one in half
    const c = spawn(process.execPath, [fileURLToPath(import.meta.url), String(N)], { env: { ...process.env, LS_CHILD: `${i}/${W}` }, stdio: ["ignore", "pipe", "inherit"] });
    let buf = ""; c.stdout.on("data", b => { buf += b; const j = buf.lastIndexOf("\n"); if (j < 0) return; process.stdout.write(buf.slice(0, j + 1)); buf = buf.slice(j + 1); });
    c.on("exit", done); })));
  process.exit(0);
}
const E = await import(ROOT + "test/engine.mjs");
// THE VARIANT, by runner (LS_VARIANTS=1 splits them): 0 as the engine stands; 1 the wind-up fading out from 25 m to 38 m;
// 2 that and the long-shot trait's finishing fading out from 28 m to 36 m, its extra range 6 m to 3.
const VAR = process.env.LS_VARIANTS ? +SH[1] % 3 : 0;
if (VAR >= 1) { E.CFG.shotSetFar = 25; E.CFG.shotSetFarFade = 13; }
if (VAR >= 2) { E.CFG.lsFarEnd = 28; E.CFG.lsFarFade = 8; E.ME_BADGES.longshot.range = 3; }
const nat = E.PRESET_CATALOG.filter(t => t.league === "Avium International" && t.squad?.length).sort((a, b) => b.skill - a.skill).slice(0, 32);
const trait = new Map(); for (const t of nat) for (const p of t.squad || []) if ((p.badges || p.traits || []).some(b => String(b).startsWith("longshot"))) trait.set(p.fullName || p.name, 1);
const [ci, cn] = CHILD.split("/").map(Number), [si, sn] = [+SH[1], +SH[2]];
let k2 = 0;
for (let k = 0; k < N; k++) {
  if (k % sn !== si) continue; if ((k2++) % cn !== ci) continue;
  const hT = nat[k % nat.length], aT = nat[(k * 7 + 3) % nat.length]; if (hT === aT) continue;
  const st = E.createMatchState(); st.brain = 2; st.homeAdv = null; st.injuriesOn = true;
  st.players.home = E.meSide(hT); st.players.away = E.meSide(aT);
  st.bench = { home: E.meBench(hT), away: E.meBench(aT) };
  st.subCap = { home: E.subCapFor(st.bench.home), away: E.subCapFor(st.bench.away) };
  st.formations = { home: hT.formation || "4-3-3", away: aT.formation || "4-3-3" };
  st.strategy = { home: E.meStrategyFor(hT), away: E.meStrategyFor(aT) };
  st.fit = { home: E.meFitFor(hT), away: E.meFitFor(aT) };
  st.mgmt = { home: hT.mgmt ?? null, away: aT.mgmt ?? null };
  st.styles = { home: hT.style || "balanced", away: aT.style || "balanced" };
  st.teamSkill = { home: hT.skill, away: aT.skill }; st.possession = "home";
  const rng = new E.RNG((9000 + k * 7919) >>> 0); E.meInit(st, E.pitchSlots, rng);
  const out = E.meFreshOut(); globalThis.__shots = [];
  const T = E.ME_MATCH_TICKS + E.meAdded(st);
  for (let t = 0; t < T; t++) { out.min = E.meMinute(t); out.add = E.meAddedMin(t); E.meTick(st, rng, out); }
  const lines = [JSON.stringify({ m: k, vr: VAR, g: out.goals.home + out.goals.away })];
  for (const s of globalThis.__shots) lines.push(JSON.stringify({ vr: VAR, d: +s.d.toFixed(1), y: +(s.y ?? 0), xg: +(s.xg || 0).toFixed(4), out: s.out || "", hdr: s.hdr ? 1 : 0,
    gkd: +(s.gkd ?? -1).toFixed(1), gko: s.gko ? 1 : 0, v: s.v ?? 0, az: s.az ?? 0, aim: s.aim ?? 0, sk: s.sk ?? 0, fr: s.fr ? 1 : 0, ls: trait.get(s.nm) || 0 }));
  process.stdout.write(lines.join("\n") + "\n");
}
