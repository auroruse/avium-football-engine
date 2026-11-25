// LONG-SHOT TAKERS (25 November 2026, the user: "Midfielders are obviously gonna take more long shots than strikers").
// Every Avium side, the collegiate field aside, plays LSP_M matches at home against its own league; every strike from
// outside the box is put to the man who hit it, with the minutes he was on. One JSON line per player per shard.
//   SHARD=i/n node test/lsplayers.mjs           this shard's matches over this machine's cores
//   node test/lsplayers.mjs merge <files...>    per-player totals, ranked
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { cpus } from "node:os";
import { fileURLToPath } from "node:url";

if (process.argv[2] === "merge") {
  const P = new Map();
  for (const f of process.argv.slice(3)) for (const l of readFileSync(f, "utf8").split("\n")) { if (!l.startsWith("{")) continue; const r = JSON.parse(l);
    const o = P.get(r.id) || { ...r, mt: 0, n: 0, g: 0, on: 0, dsum: 0, sksum: 0, apps: 0 };
    for (const k of ["mt", "n", "g", "on", "dsum", "sksum", "apps"]) o[k] += r[k] || 0; if (r.club) o.club = r.club; if (r.nat) o.nat = r.nat; P.set(r.id, o); }
  const all = [...P.values()].filter(o => o.mt >= 20 * 90);
  const by = (pos) => { const a = all.filter(o => o.line === pos), s = (k) => a.reduce((q, o) => q + o[k], 0); const m = s("mt") / 90;
    return `${pos}: ${a.length} men, ${(s("n") / m).toFixed(2)} long shots a 90, ${(s("g") / m).toFixed(3)} long-shot goals a 90, conv ${(100 * s("g") / s("n")).toFixed(1)}%`; };
  console.log(["DEF", "MID", "FWD"].map(by).join("\n"));
  const rows = all.map(o => ({ ...o, n90: o.n / (o.mt / 90), g90: o.g / (o.mt / 90), conv: o.g / Math.max(1, o.n) }));
  const show = (title, list) => { console.log("\n" + title); console.log("name                       ovr pos     club nat   90s  shots/90 goals/90 conv%  on%  avg m  finish  traits");
    for (const o of list) console.log([o.name.padEnd(26), String(o.ovr).padStart(3), o.pos.padEnd(7), (o.club || "-").padEnd(4), (o.nat || "-").padEnd(4), (o.mt / 90).toFixed(0).padStart(4),
      o.n90.toFixed(2).padStart(8), o.g90.toFixed(3).padStart(8), (100 * o.conv).toFixed(1).padStart(5), (100 * o.on / Math.max(1, o.n)).toFixed(0).padStart(4), (o.dsum / Math.max(1, o.n)).toFixed(1).padStart(6),
      (o.sksum / Math.max(1, o.n)).toFixed(3).padStart(7), o.tr].join(" ")); };
  show("BY LONG-SHOT GOALS A 90", [...rows].sort((a, b) => b.g90 - a.g90).slice(0, 40));
  show("BY LONG SHOTS A 90", [...rows].sort((a, b) => b.n90 - a.n90).slice(0, 25));
  process.exit(0);
}

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const M = +(process.env.LSP_M || 40), SH = (process.env.SHARD || "0/1").match(/^(\d+)\/(\d+)$/), CHILD = process.env.LSP_CHILD;
const W = +(process.env.LSP_W || cpus().length);
if (CHILD == null) {
  await Promise.all(Array.from({ length: W }, (_, i) => new Promise(done => {
    const c = spawn(process.execPath, [fileURLToPath(import.meta.url)], { env: { ...process.env, LSP_CHILD: `${i}/${W}` }, stdio: ["ignore", "pipe", "inherit"] });
    let buf = ""; c.stdout.on("data", b => { buf += b; const j = buf.lastIndexOf("\n"); if (j < 0) return; process.stdout.write(buf.slice(0, j + 1)); buf = buf.slice(j + 1); });
    c.on("exit", done); })));
  process.exit(0);
}
const E = await import(ROOT + "test/engine.mjs");
const teams = E.PRESET_CATALOG.filter(t => t.league !== "All-Nichirin Collegiate Championship" && t.squad?.length);
const leagues = {}; for (const t of teams) (leagues[t.league] ||= []).push(t);
const jobs = []; for (const t of teams) { const L = leagues[t.league]; if (L.length < 2) continue; for (let m = 0; m < M; m++) jobs.push([t, L, m]); }
const LINE = { GK: "GK", DEF: "DEF", MID: "MID", FWD: "FWD" };
const tally = new Map();
const rec = (p, t) => { const id = p.rid || p.fullName || p.name; let o = tally.get(id);
  if (!o) tally.set(id, o = { id, name: p.fullName || p.name, ovr: p.ovr, pos: (p.own || [p.spos || p.pos]).join("/"), line: LINE[p.pos] || p.pos,
    tr: (p.badges || []).filter(b => /^(longshot|finisher|trickster|poacher|composed|pressresistant|greedy)/.test(b)).join(" "), mt: 0, n: 0, g: 0, on: 0, dsum: 0, sksum: 0, apps: 0 });
  if (t.league === "Avium International") o.nat = t.code; else o.club = t.code; return o; };
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
  const T = E.ME_MATCH_TICKS + E.meAdded(st), team = { home: hT, away: aT }, mine = new Map(), seen = new Set();
  // who struck each shot, read off the pitch as it is struck (the shooter is on it then)
  let done = 0; const shooter = [];
  for (let t = 0; t < T; t++) {
    out.min = E.meMinute(t); out.add = E.meAddedMin(t); E.meTick(st, rng, out);
    if (t % 30 === 0) for (const sd of ["home", "away"]) for (const q of st.players[sd]) if (q && !q.off) { const key = sd + (q.rid || q.name);
      const o = rec(q, team[sd]); o.mt += 30 * 90 / T; if (!seen.has(key)) { seen.add(key); o.apps++; } }
    const S = globalThis.__shots;
    for (; done < S.length; done++) { const r = S[done]; let who = null;
      for (const sd of ["home", "away"]) for (const q of st.players[sd]) if (q && (q.fullName || q.name) === r.nm) who = [q, sd];
      shooter[done] = who; }
  }
  globalThis.__shots.forEach((r, i) => { const w = shooter[i]; if (!w || r.hdr || !(r.d >= 16.5) || w[0].pos === "GK") return;
    const o = rec(w[0], team[w[1]]); o.n++; o.dsum += r.d; o.sksum += r.sk || 0; if (r.out === "goal") o.g++; if (r.fr) o.on++; });
}
for (const o of tally.values()) process.stdout.write(JSON.stringify(o) + "\n");
