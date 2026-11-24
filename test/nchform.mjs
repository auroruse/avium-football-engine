// NICHIRIN'S SHAPE AND ELEVEN (24 November 2026). Route One kept; every formation with its own best eleven (the national
// selector's rule: rating less XI_OOP_PENALTY a step out of position, at most XI_STEP_MAX steps, solved exactly), the
// current eleven, and one-man changes to it, each against the strongest other national sides on the same seeds.
//   LAB_TEST=nchform.mjs (SHARD=i/n)   NF_N matches an arm an opponent (100)   NF_OPP opponents (8)
//   NF_ARMS which arms (default all)   NF_SWAPS extra arms as JSON {name: {f: formation, xi: [11 names]}}
//   node test/nchform.mjs merge <dir>
import { spawn } from "node:child_process";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const N = +(process.env.NF_N || 100), NOPP = +(process.env.NF_OPP || 8), US = "NCH";
const E = await import("./engine.mjs");
const nat = E.PRESET_CATALOG.filter(t => t.league === "Avium International" && t.squad?.length).sort((a, b) => b.skill - a.skill);
const us = nat.find(t => t.code === US), them = nat.filter(t => t.code !== US).slice(0, NOPP);
const all = us.squad.filter(p => p && p.name);
const elig = (p) => p.own?.length ? p.own : [p.natPos || p.spos];
const steps = (p, s) => Math.min(...elig(p).map(e => E.xiSteps(e, s)));
const score = (p, s) => { const k = steps(p, s); return k > E.XI_STEP_MAX ? -Infinity : p.ovr - E.XI_OOP_PENALTY * k; };
// exact assignment: subset DP over the eleven slots
const bestXI = (f) => {
  const slots = E.FORM_SPOS[f], S = 1 << 11, n = all.length;
  let dp = new Float64Array(S).fill(-Infinity); dp[0] = 0; const ch = [];
  for (let i = 0; i < n; i++) { const nd = dp.slice(), c = new Int8Array(S).fill(-1);
    for (let m = 0; m < S; m++) { if (dp[m] === -Infinity) continue;
      for (let s = 0; s < 11; s++) if (!(m & (1 << s))) { const v = dp[m] + score(all[i], slots[s]); if (v > nd[m | (1 << s)]) { nd[m | (1 << s)] = v; c[m | (1 << s)] = s; } } }
    // c[m] = s means player i took slot s to reach m; ties kept the earlier (left out) path
    for (let m = 0; m < S; m++) if (nd[m] === dp[m]) c[m] = -1;
    ch.push(c); dp = nd; }
  const xi = new Array(11); let m = S - 1;
  for (let i = n - 1; i >= 0; i--) { const s = ch[i][m]; if (s >= 0) { xi[s] = all[i].name; m ^= 1 << s; } }
  return xi;
};
const curXI = us.squad.filter(p => !p.bench).map(p => p.name);
const swap = (out, inn) => curXI.map(n => n === out ? inn : n);
const ARMS = { cur: { f: us.formation, xi: curXI } };
for (const f of E.FORMATIONS) ARMS["opt " + f] = { f, xi: bestXI(f) };
for (const [o, i] of [["Y. Shirase", "T. Nakamura"], ["Y. Shirase", "G. Ibusuki"], ["G. Nishigawa", "K. Unagami"], ["G. Nishigawa", "T. Ganzorig"],
  ["K. Hiranuma", "K. Fondo"], ["M. Kishima", "K. Torigoe"], ["S. Itoshi", "S. Akutagawa"], ["T. Shimabukuro", "E. Sato"]])
  ARMS[`cur ${i.split(" ").pop()} for ${o.split(" ").pop()}`] = { f: us.formation, xi: swap(o, i) };
if (process.env.NF_SWAPS) Object.assign(ARMS, JSON.parse(process.env.NF_SWAPS));
const NAMES = (process.env.NF_ARMS || Object.keys(ARMS).join("|")).split("|");
const teamOf = (a) => { const A = ARMS[a], set = new Set(A.xi);
  const sq = [...A.xi.map(n => { const p = { ...all.find(q => q.name === n) }; delete p.bench; return p; }), ...all.filter(p => !set.has(p.name)).map(p => ({ ...p, bench: true }))];
  return { ...us, formation: A.f, squad: E.refitAs(sq, A.f) }; };

if (process.argv[2] === "merge" || process.argv[2] === "show") {
  for (const a of NAMES) console.log(a.padEnd(26) + ARMS[a].xi.map((n, i) => E.FORM_SPOS[ARMS[a].f][i] + " " + n.split(" ").pop()).join(", "));
  if (process.argv[2] === "show") process.exit(0);
  const dir = process.argv[3], files = fs.readdirSync(dir, { recursive: true }).filter(f => String(f).endsWith(".jsonl")).map(f => path.join(dir, String(f)));
  const R = files.flatMap(f => fs.readFileSync(f, "utf8").split("\n").filter(l => l.startsWith("[")).map(l => JSON.parse(l)));
  console.log(`\n${R.length} matches from ${files.length} files`);
  const pts = (r) => r[3] > r[4] ? 3 : r[3] === r[4] ? 1 : 0, key = (r) => r[1] + "/" + r[2];
  const base = new Map(R.filter(r => r[0] === "cur").map(r => [key(r), r]));
  const opps = them.map(t => t.code), rows = [];
  for (const a of [...new Set(R.map(r => r[0]))]) { const rs = R.filter(r => r[0] === a), n = rs.length;
    const d = rs.filter(r => base.has(key(r))).map(r => pts(r) - pts(base.get(key(r)))), md = d.reduce((x, y) => x + y, 0) / d.length;
    const se = Math.sqrt(d.reduce((x, y) => x + (y - md) ** 2, 0) / (d.length - 1) / d.length);
    const dx = rs.filter(r => base.has(key(r))).map(r => (r[5] - r[6]) - (base.get(key(r))[5] - base.get(key(r))[6])), mx = dx.reduce((x, y) => x + y, 0) / dx.length;
    const by = opps.map(o => { const q = rs.filter(r => r[1] === o); return q.reduce((x, r) => x + pts(r), 0) / q.length; });
    rows.push([a, n, rs.reduce((x, r) => x + pts(r), 0) / n, md, se, rs.reduce((x, r) => x + r[3] - r[4], 0) / n, rs.reduce((x, r) => x + r[5] - r[6], 0) / n, mx, by]); }
  rows.sort((a, b) => b[2] - a[2]);
  console.log("\n" + "".padEnd(26) + ["n", "ppg", "vs cur", "(se)", "GD", "xGD", "xGD vs"].map(x => x.padStart(8)).join("") + opps.map(o => o.padStart(6)).join(""));
  for (const r of rows) console.log(r[0].padEnd(26) + [r[1], r[2].toFixed(3), (r[3] >= 0 ? "+" : "") + r[3].toFixed(3), r[4].toFixed(3), r[5].toFixed(2), r[6].toFixed(2), (r[7] >= 0 ? "+" : "") + r[7].toFixed(2)].map(x => String(x).padStart(8)).join("") + r[8].map(x => x.toFixed(2).padStart(6)).join(""));
  process.exit(0);
}

const [si, sn0] = (process.env.SHARD || "0/1").split("/").map(Number), sn = +(process.env.NF_SN || sn0);
const jobs = []; for (let k = 0; k < N; k++) for (let o = 0; o < them.length; o++) for (const a of NAMES) jobs.push([a, o, k]);
const mine = jobs.filter((_, j) => j % sn === si);

if (process.env.NF_CHILD != null) {
  const [ci, cn] = process.env.NF_CHILD.split("/").map(Number);
  const T = Object.fromEntries(NAMES.map(a => [a, teamOf(a)]));
  const play = (hT, aT, seed) => {
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
    const rng = new E.RNG(seed >>> 0 || 7); E.meInit(st, E.pitchSlots, rng);
    const out = E.meFreshOut();
    for (let t = 0; t < E.ME_MATCH_TICKS + E.meAdded(st); t++) { out.min = E.meMinute(t); out.add = E.meAddedMin(t); E.meTick(st, rng, out); }
    E.meFinalise(st); return out;
  };
  mine.forEach(([a, o, k], j) => { if (j % cn !== ci) return;
    const first = k % 2 === 0, opp = them[o], [hT, aT] = first ? [T[a], opp] : [opp, T[a]], u = first ? "home" : "away", v = first ? "away" : "home";
    const out = play(hT, aT, +(process.env.NF_SEED || 5e6) + o * 104729 + k * 7919);
    console.log(JSON.stringify([a, opp.code, k, out.goals[u], out.goals[v], +(out.xgS[u] || 0).toFixed(3), +(out.xgS[v] || 0).toFixed(3)])); });
  process.exit(0);
}

const W = Math.max(1, +(process.env.NF_W || availableParallelism()));
await Promise.all(Array.from({ length: W }, (_, i) => new Promise((res, rej) => {
  const c = spawn("node", [fileURLToPath(import.meta.url)], { env: { ...process.env, NF_CHILD: `${i}/${W}` }, stdio: ["ignore", "pipe", "inherit"] });
  c.stdout.on("data", (b) => process.stdout.write(b));
  c.on("exit", (code) => code === 0 ? res() : rej(new Error("child " + i + " exit " + code)));
})));
