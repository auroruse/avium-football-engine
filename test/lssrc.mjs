// WHERE LONG SHOTS COME FROM (25 November 2026, the user on defenders: "I think from corners is one of the reasons").
// Every strike from outside the box by line and role, put to the situation it came from: a set piece's second phase
// (the restart kind, if one was taken in the last 40 ticks) or open play by phase. And for defenders, where they are
// in the 15 seconds after their own side's corner: up in the box, on the edge, or back.
//   SHARD=i/n node test/lssrc.mjs           node test/lssrc.mjs merge <files...>
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { cpus } from "node:os";
import { fileURLToPath } from "node:url";

if (process.argv[2] === "merge") {
  const T = { m: 0, src: {}, corner: { n: 0, defUp: 0, defEdgeBall: 0, defBallFar: 0, anyBallFar: 0 } };
  for (const f of process.argv.slice(3)) for (const l of readFileSync(f, "utf8").split("\n")) { if (!l.startsWith("{")) continue; const r = JSON.parse(l);
    T.m += r.m; for (const [k, v] of Object.entries(r.src)) { const o = (T.src[k] ||= { n: 0, g: 0 }); o.n += v.n; o.g += v.g; }
    for (const k of Object.keys(T.corner)) T.corner[k] += r.corner[k] || 0; }
  console.log("matches", T.m);
  for (const L of ["DEF", "MID", "FWD"]) {
    const rows = Object.entries(T.src).filter(([k]) => k.startsWith(L + "|")), N = rows.reduce((a, [, v]) => a + v.n, 0), G = rows.reduce((a, [, v]) => a + v.g, 0);
    console.log(`\n${L}: ${(100 * N / T.m).toFixed(1)} long shots per 100 matches, ${(100 * G / T.m).toFixed(2)} goals per 100`);
    const by = (i) => { const a = {}; for (const [k, v] of rows) { const key = k.split("|")[i]; const o = (a[key] ||= { n: 0, g: 0 }); o.n += v.n; o.g += v.g; }
      return Object.entries(a).sort((x, y) => y[1].n - x[1].n).map(([k, v]) => `${k} ${(100 * v.n / N).toFixed(0)}%${v.g ? ` (${v.g}g)` : ""}`).join(", "); };
    console.log("  situation:", by(1)); console.log("  role:     ", by(2));
  }
  const C = T.corner;
  console.log(`\ncorners ${(C.n / T.m).toFixed(1)} a match | a defender up in the box at the kick ${(100 * C.defUp / C.n).toFixed(0)}% |`
    + ` in the next 15 s, the ball at a defender's feet 18-30 m out: ${(100 * C.defBallFar / C.n).toFixed(1)}% of corners (anyone: ${(100 * C.anyBallFar / C.n).toFixed(1)}%)`);
  process.exit(0);
}
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const M = +(process.env.LSS_M || 10), SH = (process.env.SHARD || "0/1").match(/^(\d+)\/(\d+)$/), CHILD = process.env.LSS_CHILD;
const W = +(process.env.LSS_W || cpus().length);
if (CHILD == null) {
  await Promise.all(Array.from({ length: W }, (_, i) => new Promise(done => {
    const c = spawn(process.execPath, [fileURLToPath(import.meta.url)], { env: { ...process.env, LSS_CHILD: `${i}/${W}` }, stdio: ["ignore", "pipe", "inherit"] });
    let buf = ""; c.stdout.on("data", b => { buf += b; const j = buf.lastIndexOf("\n"); if (j < 0) return; process.stdout.write(buf.slice(0, j + 1)); buf = buf.slice(j + 1); });
    c.on("exit", done); })));
  process.exit(0);
}
const E = await import(ROOT + "test/engine.mjs");
for (const kv of (process.env.LSS_VAR || "").split(",").filter(Boolean)) { const [k, v] = kv.split("="); E.CFG[k] = +v; }
const teams = E.PRESET_CATALOG.filter(t => t.league !== "All-Nichirin Collegiate Championship" && t.squad?.length);
const leagues = {}; for (const t of teams) (leagues[t.league] ||= []).push(t);
const jobs = []; for (const t of teams) { const L = leagues[t.league]; if (L.length < 2) continue; for (let m = 0; m < M; m++) jobs.push([t, L, m]); }
const src = {}, corner = { n: 0, defUp: 0, defBallFar: 0, anyBallFar: 0 }; let played = 0;
const [ci, cn] = CHILD.split("/").map(Number), [si, sn] = [+SH[1], +SH[2]];
let k2 = 0;
for (let j = 0; j < jobs.length; j++) {
  if (j % sn !== si) continue; if ((k2++) % cn !== ci) continue;
  const [hT, L, m] = jobs[j], others = L.filter(t => t !== hT), aT = others[(m * 7 + j) % others.length];
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
  const rng = new E.RNG((7000 + j * 7919) >>> 0); E.meInit(st, E.pitchSlots, rng);
  const out = E.meFreshOut(); globalThis.__shots = [];
  const T = E.ME_MATCH_TICKS + E.meAdded(st), who = [];
  let done = 0, cnr = null, wasCorner = false, lastSd = null;
  for (let t = 0; t < T; t++) {
    out.min = E.meMinute(t); out.add = E.meAddedMin(t); E.meTick(st, rng, out);
    const mp = st.mePos;
    // a corner being taken: who is up, then fifteen seconds (60 ticks) of watching who has it 18-30 m out
    const isC = mp.sp && mp.sp.kind === "corner";
    if (isC) lastSd = mp.sp.side;
    // taken: who is up at the kick
    if (!isC && wasCorner) { const sd = lastSd, gx = E.meGoalX(sd); corner.n++;
      const up = st.players[sd].some(q => q && !q.off && q.pos === "DEF" && Math.hypot(gx - q.x, E.ME_HALF_W - q.y) < 16.5);
      if (up) corner.defUp++; cnr = { sd, t0: t, def: false, any: false }; }
    wasCorner = isC;
    if (cnr && cnr.t0 >= 0) {
      if (t - cnr.t0 > 60) { if (cnr.def) corner.defBallFar++; if (cnr.any) corner.anyBallFar++; cnr = null; }
      else if (mp.idx >= 0 && !mp.flight && mp.side === cnr.sd) { const q = st.players[mp.side][mp.idx], d = q && Math.hypot(E.meGoalX(mp.side) - q.x, E.ME_HALF_W - q.y);
        if (q && d >= 18 && d < 30) { cnr.any = true; if (q.pos === "DEF") cnr.def = true; } } }
    const S = globalThis.__shots;
    for (; done < S.length; done++) { const r = S[done]; let p = null, ps = null; for (const sd of ["home", "away"]) for (const q of st.players[sd]) if (q && (q.fullName || q.name) === r.nm) { p = q; ps = sd; }
      who[done] = p; if (cnr && ps === cnr.sd) r._sit = "corner 2nd phase"; }
  }
  globalThis.__shots.forEach((r, i) => { const p = who[i]; if (!p || r.hdr || !(r.d >= 16.5) || !["DEF", "MID", "FWD"].includes(p.pos)) return;
    const sit = r._sit || (r.spK ? "after " + r.spK : "open " + (r.ph || "-"));
    const o = (src[`${p.pos}|${sit}|${p._mr || "-"}`] ||= { n: 0, g: 0 }); o.n++; if (r.out === "goal") o.g++; });
  played++;
}
process.stdout.write(JSON.stringify({ m: played, src, corner }) + "\n");
