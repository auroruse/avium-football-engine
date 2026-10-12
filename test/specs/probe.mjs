// CLOUD PROBES, 12 October 2026 (the user: no measuring on the Mac). Run on the lab as LAB_TEST=specs/probe.mjs: every
// shard (SHARD=i/n) plays its share of N League One fixtures the lab's way (test/lab.mjs play) under every arm, with the
// probe named in PROBE watching, and prints one line of tallies an arm; `node test/specs/probe.mjs merge <dir>` adds the
// shards up and prints them, which is arithmetic only.
//   PROBE=byline  every ball over a goal line that is not a goal: corner or goal kick, and what put it there
//   PROBE=blocks  what came of every blocked and every parried shot within three seconds
//   PROBE=crosses where each cross is struck from, and how it ends
//   N fixtures (default 400), ARMS as below.
import fs from "node:fs"; import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ARMSETS = {
  base: [{ name: "base" }],
};
if (process.argv[2] === "merge") {
  const A = {};
  const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p);
    else if (f.endsWith(".jsonl")) for (const l of fs.readFileSync(p, "utf8").split("\n")) { if (!l.trim().startsWith("{")) continue; const r = JSON.parse(l);
      const e = A[r.arm] || (A[r.arm] = { n: 0, t: {} }); e.n += r.n; for (const [k, v] of Object.entries(r.t)) e.t[k] = (e.t[k] || 0) + v; } } };
  walk(process.argv[3]);
  for (const [arm, e] of Object.entries(A)) { console.log(`\n== ${arm}: ${e.n} matches`);
    for (const [k, v] of Object.entries(e.t).sort((a, b) => a[0].localeCompare(b[0]))) console.log("  " + k.padEnd(40) + (v / e.n).toFixed(3) + " a match"); }
  process.exit(0);
}
const E = await import(pathToFileURL(path.join(ROOT, "test/engine.mjs")).href);
const L = await import(pathToFileURL(path.join(ROOT, "test/lab.mjs")).href);
const T = E.PRESET_CATALOG.filter(t => t.league === "Nichirin League One");
const N = +(process.env.N || 400), PROBE = process.env.PROBE || "byline", arms = ARMSETS[process.env.ARMS || "base"];
const [si, sn] = (process.env.SHARD || "0/1").split("/").map(Number);
for (const arm of arms) {
  const saved = []; for (const [tab, over] of [[E.CFG, arm.cfg], [E.MT, arm.mt]]) for (const [k, v] of Object.entries(over || {})) { saved.push([tab, k, tab[k]]); tab[k] = v; }
  const t = {}; const add = (k, v = 1) => { t[k] = (t[k] || 0) + v; };
  let n = 0;
  if (PROBE === "byline") {
    let lastCross = { t: -999 }, lastShot = { t: -999 };
    globalThis.__tick = (st, mp) => { const pp = mp.passPending; if (pp && pp.k === "cross" && pp.sx !== undefined && pp !== lastCross.pp) lastCross = { t: mp.tick, side: pp.side, pp };
      if (mp.shot && mp.shot !== lastShot.sh) lastShot = { t: mp.tick, side: mp.shot.side, sh: mp.shot }; };
    globalThis.__byline = (mp, sh, cross, s) => {
      const corner = cross.conceding === mp.touchSide, att = corner ? (mp.touchSide === "home" ? "away" : "home") : null;
      add(corner ? "=corners" : "=goalkicks");
      if (corner) add(lastCross.side === att && mp.tick - lastCross.t < 16 ? "corner after a cross" : lastShot.side === att && mp.tick - lastShot.t < 16 ? "corner after a shot" : "corner, other");
      const lg = mp.tlog || [], last = lg[lg.length - 1], lp = last ? s.players[last.s]?.[last.i] : null;
      add((corner ? "CORNER " : "goalkick ") + (sh ? (!corner ? "shot wide" : lp?.pos === "GK" ? "shot saved out" : "shot blocked out") : (mp._looseWhy || "ball") + (lp?.pos === "GK" ? " (keeper)" : "")));
    };
  }
  if (PROBE === "crosses") {
    // where each cross is struck from (metres from the goal line, metres off the middle), and how it ends: kept by us,
    // won by them, or dead -- and if dead, which restart
    const live = new Map();
    globalThis.__tick = (st, mp, tk) => {
      const pp = mp.passPending;
      if (pp && pp.k === "cross" && pp.sx !== undefined && !live.has(pp)) {
        const gx = E.meGoalX(pp.side), d = Math.abs(gx - pp.sx);
        live.set(pp, { side: pp.side, t: tk, b: d < 6 ? "0-6" : d < 12 ? "6-12" : d < 18 ? "12-18" : d < 25 ? "18-25" : "25+" });
        add("cross from " + live.get(pp).b);
      }
      for (const [k, c] of live) {
        if (tk === c.t) continue;
        let end = null;
        if (mp.sp) end = mp.sp.kind === "corner" ? "corner" : mp.sp.kind === "throw" ? "throw" : mp.sp.kind === "goalkick" ? "goal kick" : mp.sp.kind === "kickoff" ? "goal" : mp.sp.kind;
        else if (tk - c.t > 16) end = mp.idx >= 0 ? (mp.side === c.side ? "ours" : "theirs") : "loose";
        if (end) { add(c.b + " -> " + end); live.delete(k); }
      }
    };
  }
  if (PROBE === "blocks") {
    let watch = [], nS = 0;
    globalThis.__tick = (st, mp, tk) => { const S = globalThis.__shots || [];
      for (const r of S) if (!r._w && (r.out === "block" || r.out === "parry")) { r._w = 1; watch.push({ t: tk, side: r.side, how: r.out }); }
      for (let i = watch.length - 1; i >= 0; i--) { const w = watch[i]; let end = null;
        if (mp.sp) end = mp.sp.kind === "kickoff" ? "goal" : mp.sp.kind; else if (tk - w.t > 12) end = mp.idx >= 0 ? (mp.side === w.side ? "attackers' ball" : "defenders' ball") : "loose";
        if (end) { add(w.how + " -> " + end); add(w.how); watch.splice(i, 1); } } };
  }
  for (let k = si; k < N; k += sn) {
    const h = T[k % T.length], a = T[(k * 7 + 3) % T.length] === h ? T[(k * 7 + 4) % T.length] : T[(k * 7 + 3) % T.length];
    const r = L.play(E, h, a, (77e5 + k * 7919) >>> 0); n++;
    add("=goals", r.home.gf + r.away.gf); add("=shots", r.home.sh + r.away.sh);
  }
  globalThis.__tick = null; globalThis.__byline = null;
  for (const [tab, k, v] of saved.reverse()) tab[k] = v;
  console.log(JSON.stringify({ arm: arm.name, n, t }));
}
