// WHY MIDFIELDERS DO NOT SHOOT FROM RANGE (25 November 2026). For each line and each role: how often he has the ball
// 18-30 m from goal (spells on the ball, and spells with nobody within 4 m), how often he shoots from there, and how
// far from goal his time on the ball is spent. Opportunity against willingness.
//   SHARD=i/n node test/lsdiag.mjs            this shard's matches over this machine's cores
//   node test/lsdiag.mjs merge <files...>
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { cpus } from "node:os";
import { fileURLToPath } from "node:url";

const BANDS = [[0, 11], [11, 18], [18, 24], [24, 30], [30, 40], [40, 999]];
if (process.argv[2] === "merge") {
  const VV = {};
  for (const f of process.argv.slice(3)) for (const l of readFileSync(f, "utf8").split("\n")) { if (!l.startsWith("{")) continue; const r = JSON.parse(l);
    const A = (VV[r.v ?? 0] ||= { _h: { m: 0, goals: 0, far: 0, farG: 0, allS: 0, lnN: {}, lnG: {}, vs: "" } });
    if (r.m) { const h = A._h; h.m += r.m; h.vs = r.vs || ""; for (const k of ["goals", "far", "farG", "allS"]) h[k] += r[k] || 0;
      for (const k of ["lnN", "lnG"]) for (const [q, n] of Object.entries(r[k] || {})) h[k][q] = (h[k][q] || 0) + n; continue; }
    const o = (A[r.key] ||= { key: r.key, line: r.line, mt: 0, sp: 0, room: 0, sh: 0, shRoom: 0, g: 0, t: BANDS.map(() => 0), shB: BANDS.map(() => 0) });
    for (const k of ["mt", "sp", "room", "sh", "shRoom", "g"]) o[k] += r[k]; r.t.forEach((v, i) => o.t[i] += v); r.shB.forEach((v, i) => o.shB[i] += v); }
  for (const [vk, A] of Object.entries(VV)) { const H = A._h; delete A._h;
  const row = (name, list) => { const s = (k) => list.reduce((q, o) => q + o[k], 0), sa = (k, i) => list.reduce((q, o) => q + o[k][i], 0), n90 = s("mt") / 90;
    const tt = BANDS.map((_, i) => sa("t", i)), T = tt.reduce((a, b) => a + b, 0);
    return [name.padEnd(10), (s("sp") / n90).toFixed(2).padStart(7), (s("room") / n90).toFixed(2).padStart(7), (s("sh") / n90).toFixed(3).padStart(7),
      (100 * s("sh") / Math.max(1, s("sp"))).toFixed(1).padStart(6), (100 * s("shRoom") / Math.max(1, s("room"))).toFixed(1).padStart(6),
      tt.map(v => (100 * v / T).toFixed(0).padStart(4)).join(""), "  |", BANDS.map((_, i) => (sa("shB", i) / n90).toFixed(2).padStart(6)).join("")].join(" "); };
  const tN = Object.values(H.lnN).reduce((a, b) => a + b, 0), tG = Object.values(H.lnG).reduce((a, b) => a + b, 0);
  console.log(`\n===== variant ${vk}: ${H.vs || "(engine as built)"} | matches ${H.m} | goals ${(H.goals / H.m).toFixed(2)} a match | long shots ${(H.far / H.m).toFixed(1)} a match (${(100 * H.far / Math.max(1, H.allS)).toFixed(0)}% of shots), ${(100 * H.farG / H.far).toFixed(1)}% in, ${(H.farG / H.m).toFixed(2)} long-shot goals a match`);
  console.log("share of long shots  " + ["DEF", "MID", "FWD"].map(L => `${L} ${(100 * (H.lnN[L] || 0) / tN).toFixed(1)}%`).join("  ") + "   | of long-shot goals  " + ["DEF", "MID", "FWD"].map(L => `${L} ${(100 * (H.lnG[L] || 0) / tG).toFixed(1)}%`).join("  ")
    + "   | conversion  " + ["DEF", "MID", "FWD"].map(L => `${L} ${(100 * (H.lnG[L] || 0) / Math.max(1, H.lnN[L] || 0)).toFixed(1)}%`).join("  ")
    + `   | long-shot goals per 100 matches: DEF ${(100 * (H.lnG.DEF || 0) / H.m).toFixed(1)}`);
  console.log("who        spells  room   shots  shot%  room%    ball time by metres from goal: 0-11 11-18 18-24 24-30 30-40 40+  | shots a 90 by band");
  console.log("           18-30 m a 90       a 90   (of spells)");
  const all = Object.values(A);
  for (const L of ["DEF", "MID", "FWD"]) console.log(row(L, all.filter(o => o.line === L)));
  console.log("");
  if (process.env.ROLES) for (const o of all.sort((a, b) => a.line.localeCompare(b.line) || b.mt - a.mt)) if (o.mt > 90 * 200) console.log(row(o.key, [o]));
  }
  process.exit(0);
}

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const M = +(process.env.LSD_M || 10), SH = (process.env.SHARD || "0/1").match(/^(\d+)\/(\d+)$/), CHILD = process.env.LSD_CHILD;
const W = +(process.env.LSD_W || cpus().length);
if (CHILD == null) {
  await Promise.all(Array.from({ length: W }, (_, i) => new Promise(done => {
    const c = spawn(process.execPath, [fileURLToPath(import.meta.url)], { env: { ...process.env, LSD_CHILD: `${i}/${W}` }, stdio: ["ignore", "pipe", "inherit"] });
    let buf = ""; c.stdout.on("data", b => { buf += b; const j = buf.lastIndexOf("\n"); if (j < 0) return; process.stdout.write(buf.slice(0, j + 1)); buf = buf.slice(j + 1); });
    c.on("exit", done); })));
  process.exit(0);
}
const E = await import(ROOT + "test/engine.mjs");
// VARIANTS, one per shard in turn: LSD_VARS="farOn=0,farRoleK=0/farOn=1" sets (a slash: run.env is read by the shell) each arm's CFG.
const VARS = (process.env.LSD_VARS || "").split("/"), VI = +SH[1] % VARS.length;
for (const kv of (VARS[VI] || "").split(",").filter(Boolean)) { const [k, v] = kv.split("="); E.CFG[k] = +v; }
const teams = E.PRESET_CATALOG.filter(t => t.league !== "All-Nichirin Collegiate Championship" && t.squad?.length);
const leagues = {}; for (const t of teams) (leagues[t.league] ||= []).push(t);
const jobs = []; for (const t of teams) { const L = leagues[t.league]; if (L.length < 2) continue; for (let m = 0; m < M; m++) jobs.push([t, L, m]); }
const LINE = { DEF: "DEF", MID: "MID", FWD: "FWD" };
const tally = {}; let played = 0, goals = 0, far = 0, farG = 0, allS = 0; const lnN = {}, lnG = {};
const bucket = (q) => { const line = LINE[q.pos]; if (!line) return null; const key = q._mr || q.spos || line;
  return (tally[line + ":" + key] ||= { key: line + ":" + key, line, mt: 0, sp: 0, room: 0, sh: 0, shRoom: 0, g: 0, t: BANDS.map(() => 0), shB: BANDS.map(() => 0) }); };
const band = (d) => BANDS.findIndex(([a, b]) => d >= a && d < b);
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
  const T = E.ME_MATCH_TICKS + E.meAdded(st);
  let lastHolder = null, done = 0;
  for (let t = 0; t < T; t++) {
    out.min = E.meMinute(t); out.add = E.meAddedMin(t); E.meTick(st, rng, out);
    const mp = st.mePos;
    if (t % 30 === 0) for (const sd of ["home", "away"]) for (const q of st.players[sd]) if (q && !q.off) { const b = bucket(q); if (b) b.mt += 30 * 90 / T; }
    // the man on the ball, and a new spell whenever it changes hands
    const q = mp && mp.idx >= 0 && !mp.flight && !mp.sp ? st.players[mp.side]?.[mp.idx] : null;
    const holder = q ? mp.side + mp.idx : null;
    if (q && !q.off) { const b = bucket(q);
      if (b) { const d = Math.hypot(E.meGoalX(mp.side) - q.x, E.ME_HALF_W - q.y); b.t[band(d)]++;
        if (holder !== lastHolder && d >= 18 && d < 30) { b.sp++;
          let near = 99; for (const o of st.players[E.meOther(mp.side)]) if (o && !o.off) near = Math.min(near, Math.hypot(o.x - q.x, o.y - q.y));
          if (near > 4) { b.room++; q._lsRoom = 1; } else q._lsRoom = 0; } } }
    lastHolder = holder;
    const S = globalThis.__shots;
    for (; done < S.length; done++) { const r = S[done]; if (r.hdr) continue;
      let who = null; for (const sd of ["home", "away"]) for (const p of st.players[sd]) if (p && (p.fullName || p.name) === r.nm) who = p;
      const b = who && bucket(who); if (!b) continue; r._b = b; r._room = who._lsRoom; b.shB[band(r.d)]++;
      if (r.d >= 18 && r.d < 30) { b.sh++; if (who._lsRoom) b.shRoom++; } }
  }
  for (const r of globalThis.__shots) if (r._b && r.out === "goal" && r.d >= 18 && r.d < 30) r._b.g++;
  played++; goals += out.goals.home + out.goals.away; allS += globalThis.__shots.length;
  for (const r of globalThis.__shots) if (!r.hdr && r.d >= 16.5) { far++; if (r.out === "goal") farG++; }
  for (const r of globalThis.__shots) if (r._b) { const ln = r._b.line; if (!r.hdr && r.d >= 16.5) { lnN[ln] = (lnN[ln] || 0) + 1; if (r.out === "goal") lnG[ln] = (lnG[ln] || 0) + 1; } }
}
process.stdout.write(JSON.stringify({ m: played, v: VI, vs: VARS[VI] || "", goals, far, farG, allS, lnN, lnG }) + "\n");
for (const o of Object.values(tally)) process.stdout.write(JSON.stringify({ ...o, v: VI }) + "\n");
