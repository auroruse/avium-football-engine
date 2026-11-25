// ŌE'S LONG SHOTS, DIP ON AND OFF (25 November 2026, the user: "Oe is still not a top 5 long shot taker??"). Dynamo
// at home to the rest of League One and Nichirin at home to the international field, OED_M matches each a shard; every
// strike of Ōe's from outside the box (16.5 m+) one JSON line: distance, xG, outcome, on frame, over the bar.
//   SHARD=i/n node test/oedip.mjs               arm OED_VARS[i % arms] ("lsDip=0.25/lsDip=0", slash between arms)
//   node test/oedip.mjs merge <files...>        per arm: shots, conversion against xG, where they went
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { cpus } from "node:os";
import { fileURLToPath } from "node:url";
if (process.argv[2] === "merge") {
  const A = {};
  for (const f of process.argv.slice(3)) for (const l of readFileSync(f, "utf8").split("\n")) { if (!l.startsWith("{")) continue; const r = JSON.parse(l);
    const a = (A[r.v] ||= { m: 0, n: 0, g: 0, xg: 0, fr: 0, over: 0, wide: 0, blk: 0, sv: 0, d: 0, bands: {} });
    if (r.m) { a.m += r.m; continue; }
    a.n++; a.g += r.out === "goal"; a.xg += r.xg; a.fr += r.fr ? 1 : 0; a.over += r.over ? 1 : 0; a.wide += r.out === "wide" && !r.over; a.blk += r.out === "block"; a.sv += r.out === "catch" || r.out === "parry"; a.d += r.d;
    const b = r.d < 20 ? "16-20" : r.d < 25 ? "20-25" : r.d < 30 ? "25-30" : "30+"; const bb = (a.bands[b] ||= { n: 0, g: 0, xg: 0 }); bb.n++; bb.g += r.out === "goal"; bb.xg += r.xg; }
  for (const [v, a] of Object.entries(A)) { const p = (x) => (100 * x / a.n).toFixed(1);
    console.log(`${v} | matches ${a.m} | long shots ${a.n} (${(a.n / a.m).toFixed(2)} a match), avg ${(a.d / a.n).toFixed(1)} m | goals ${a.g} = ${p(a.g)}% against xG ${p(a.xg)}% | on frame ${p(a.fr)}%, saved ${p(a.sv)}%, over the bar ${p(a.over)}%, wide ${p(a.wide)}%, blocked ${p(a.blk)}%`);
    console.log("   " + Object.entries(a.bands).sort().map(([b, x]) => `${b} m: ${x.n} shots, ${(100 * x.g / x.n).toFixed(1)}% in, xG ${(100 * x.xg / x.n).toFixed(1)}%`).join(" | ")); }
  process.exit(0);
}
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SH = (process.env.SHARD || "0/1").split("/").map(Number), M = +(process.env.OED_M || 40), CHILD = process.env.OED_CHILD, W = +(process.env.W || cpus().length);
const VARS = (process.env.OED_VARS || "lsDip=0.25/lsDip=0").split("/"), VN = VARS[SH[0] % VARS.length];
if (CHILD == null) {
  await Promise.all(Array.from({ length: W }, (_, i) => new Promise(done => {
    const c = spawn(process.execPath, [fileURLToPath(import.meta.url)], { env: { ...process.env, OED_CHILD: `${i}/${W}` }, stdio: ["ignore", "inherit", "inherit"] });
    c.on("exit", done); })));
  process.exit(0);
}
const E = await import(ROOT + "test/engine.mjs");
for (const kv of VN.split(",").filter(Boolean)) { const [k, v] = kv.split("="); E.CFG[k] = +v; }
const [ci, cn] = CHILD.split("/").map(Number);
const homes = [E.PRESET_CATALOG.find(t => t.code === "DYM" && t.league !== "Avium International"), E.PRESET_CATALOG.find(t => t.code === "NCH" && t.league === "Avium International")];
let k = 0, m = 0;
for (const hT of homes) { const L = E.PRESET_CATALOG.filter(t => t.league === hT.league && t !== hT && t.squad?.length);
  for (let j = 0; j < M; j++) { if ((k++) % cn !== ci) continue;
    const aT = L[(j * 7 + SH[0] * 3) % L.length];
    const st = E.createMatchState(); st.brain = 2; st.homeAdv = null; st.injuriesOn = true;
    st.players.home = E.meSide(hT); st.players.away = E.meSide(aT);
    st.bench = { home: E.meBench(hT), away: E.meBench(aT) }; st.subCap = { home: E.subCapFor(st.bench.home), away: E.subCapFor(st.bench.away) };
    st.formations = { home: hT.formation || "4-3-3", away: aT.formation || "4-3-3" };
    st.strategy = { home: E.meStrategyFor(hT), away: E.meStrategyFor(aT) }; st.fit = { home: E.meFitFor(hT), away: E.meFitFor(aT) };
    st.mgmt = { home: hT.mgmt ?? null, away: aT.mgmt ?? null }; st.styles = { home: hT.style || "balanced", away: aT.style || "balanced" };
    st.teamSkill = { home: hT.skill, away: aT.skill }; st.possession = "home";
    const rng = new E.RNG((9100 + SH[0] * 104729 + j * 7919 + (hT.code === "NCH" ? 31 : 0)) >>> 0); E.meInit(st, E.pitchSlots, rng);
    const out = E.meFreshOut(); globalThis.__shots = [];
    const T = E.ME_MATCH_TICKS + E.meAdded(st);
    for (let t = 0; t < T; t++) { out.min = E.meMinute(t); out.add = E.meAddedMin(t); E.meTick(st, rng, out); }
    m++;
    for (const r of globalThis.__shots) if (r.nm === "Rui Ōe" && !r.hdr && r.d >= 16.5)
      console.log(JSON.stringify({ v: VN, d: +r.d.toFixed(1), xg: r.xg, out: r.out, fr: r.fr ? 1 : 0, over: r.over ? 1 : 0, dip: r.dip }));
  } }
console.log(JSON.stringify({ v: VN, m }));
