// THE TACTICS SEARCH, PLAYED THE WAY THE APP PLAYS A FIXTURE (10 Oct 2026). nt-job builds its sides from the brain-1 style
// stamps and plays them without managers; since the tactics rebuild (8575545) a side's whole instruction sheet is its style
// (meStrategyOf, as parseBulk builds it), and in every real fixture both managers read the opponent before kick-off and may
// start in the style beside their own (simPositionalMatch). This plays a (style, formation) cell exactly that way, and also
// returns the xG and how often the side's own manager set its style aside at kick-off.
//
//   node test/nt-app.mjs <jobs.json> [workers] [out.jsonl]        SHARD=i/n takes every nth job
//
// A job is [CODE, style, formation, k0, n, league]. The fixture for k (opponent, venue slot and seed) is nt-job's, so every
// cell meets the same opposition in the same order. Each result is appended to the output as it finishes, so a run cut off
// part way still leaves everything it played.
import { fork } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import { PRESET_CATALOG, STRAT_DEF, RNG, refitAs, createMatchState, meSide, meBench, meStrategyFor, meFitFor, meStrategyOf,
         meManagersPreMatch, meInit, pitchSlots, meFreshOut, meTick, meMinute, meAddedMin, meAdded, meFinalise,
         ME_MATCH_TICKS } from "./engine.mjs";

// One fixture as simPositionalMatch plays it (neutral ground, a draw allowed), keeping the engine's own tallies.
function playApp(hT, aT, seed) {
  const st = createMatchState();
  st.players.home = meSide(hT); st.players.away = meSide(aT);
  st.bench = { home: meBench(hT), away: meBench(aT) };
  st.subCap = { home: st.bench.home.length >= 11 ? 5 : 3, away: st.bench.away.length >= 11 ? 5 : 3 };
  st.formations = { home: hT.formation, away: aT.formation };
  st.strategy = { home: meStrategyFor(hT), away: meStrategyFor(aT) };
  st.fit = { home: meFitFor(hT), away: meFitFor(aT) };
  st.mgmt = { home: hT.mgmt ?? null, away: aT.mgmt ?? null };
  st.styles = { home: hT.style, away: aT.style };
  st.teamSkill = { home: hT.skill, away: aT.skill };
  st.homeAdv = null;
  st.injuriesOn = true;
  st.possession = "home";
  const seedInt = (seed >>> 0) || 7, r = new RNG(seedInt);
  st.managers = true;
  meManagersPreMatch(st, seedInt);
  meInit(st, pitchSlots, r);
  const out = meFreshOut();
  for (let t = 0; t < ME_MATCH_TICKS + meAdded(st); t++) { out.min = meMinute(t); out.add = meAddedMin(t); meTick(st, r, out); }
  meFinalise(st);
  return { st, out };
}

export function ntAppJob(CODE, style, formation, k0, n, LEAGUE = "Avium International") {
  const K0 = +k0, N = +n;
  const pool = PRESET_CATALOG.filter(t => t.league === LEAGUE);
  const base = pool.find(t => t.code === CODE);
  if (!base) throw new Error(`no such side ${CODE}`);
  const self = Number(base.skill), gap = (t) => Math.abs(Number(t.skill) - self);
  let field = pool.filter(t => t.code !== CODE);
  if (LEAGUE === "Avium International") {
    field = field.filter(t => gap(t) <= 15);
    if (field.length < 16) field = pool.filter(t => t.code !== CODE).sort((a, b) => gap(a) - gap(b)).slice(0, 16);
  }
  const F = field.length;
  // The style is the manager's whole sheet, as the app loads a row; the XI re-slotted into the shape, not relabelled.
  const T = { ...base, style, formation, strategy: { ...STRAT_DEF, ...meStrategyOf(style) },
              squad: formation === base.formation ? base.squad : refitAs(base.squad, formation) };
  let pts = 0, w = 0, d = 0, gf = 0, ga = 0, xf = 0, xa = 0, sw = 0;
  for (let k = K0; k < K0 + N; k++) {
    const opp = field[k % F], home = Math.floor(k / F) % 2 === 0, side = home ? "home" : "away";
    const { st, out: r } = playApp(home ? T : opp, home ? opp : T, 90e5 + (k * 131 + 7) * 7919);
    const f = r.goals[side], a = r.goals[home ? "away" : "home"];
    if (f > a) { pts += 3; w++; } else if (f === a) { pts += 1; d++; }
    gf += f; ga += a;
    xf += r.xgS?.[side] ?? 0; xa += r.xgS?.[home ? "away" : "home"] ?? 0;
    if ((st.preLog?.[side] || []).some(e => e.k === "switch")) sw++;
  }
  return { code: CODE, style, formation, k0: K0, n: N, F, pts, w, d, gf, ga, xf, xa, sw };
}

const me = fileURLToPath(import.meta.url);
if (process.argv[2] === "--worker" && process.send) {
  process.on("message", (a) => {
    let m;
    try { m = { r: ntAppJob(...a) }; } catch (e) { m = { err: String(e?.stack || e) }; }
    process.send(m);
  });
  process.on("disconnect", () => process.exit(0));
} else if (process.argv[1] === me) {
  const [jobsF, wS, outF] = process.argv.slice(2);
  let jobs = JSON.parse(readFileSync(jobsF, "utf8"));
  const [si, sn] = (process.env.SHARD || "0/1").split("/").map(Number);
  jobs = jobs.filter((_, i) => i % sn === si);
  const W = Math.max(1, Math.min(jobs.length, +(wS || 0) || availableParallelism()));
  const OUT = outF || null;
  if (OUT) writeFileSync(OUT, "");
  const emit = (r) => { const l = JSON.stringify(r); if (OUT) appendFileSync(OUT, l + "\n"); else console.log(l); };
  let next = 0, live = 0, failed = 0;
  const t0 = Date.now();
  await new Promise((done) => {
    for (let i = 0; i < W; i++) {
      const c = fork(me, ["--worker"], { stdio: ["ignore", "ignore", "inherit", "ipc"] });
      const give = () => { if (next >= jobs.length) { c.disconnect(); if (--live === 0) done(); return; } c.job = jobs[next++]; c.send(c.job); };
      c.on("message", (m) => { if (m.err) { failed++; console.error(`job ${c.job.join(" ")}: ${m.err}`); } else emit(m.r); give(); });
      // A worker that dies loses its one job; the others carry on with the queue.
      c.on("exit", (code) => { if (code) { failed++; console.error(`worker exit ${code} on ${c.job?.join(" ")}`); if (--live === 0) done(); } });
      live++; give();
    }
  });
  console.error(`shard ${si}/${sn}: ${jobs.length} jobs on ${W} workers in ${((Date.now() - t0) / 60000).toFixed(1)} min, ${failed} failed`);
}
