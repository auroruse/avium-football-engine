// ONE JOB OF A SIDE'S TACTICS SEARCH: a (style, formation) cell played over the fixtures k in
// [k0, k0+n). Opponent, venue and seed are functions of k alone, so every cell plays the same
// matches (paired) and a later round that continues from a cell's last k never replays one.
//
//   node test/nt-job.mjs <CODE> <style> <formation> <k0> <n> [league]  -> one JSON line on stdout
//
// ...or a whole queue of them through ntPool(W): W processes that each load the engine once and play
// job after job. A fresh process a job paid about 0.1 s to load the engine and 1.3 s for the JIT to
// warm up again, which is why jobs were made big, and big jobs left cores idle at the end of every
// round. A match is a function of its fixture alone, so a warm worker returns exactly what a fresh
// process prints.
//
// The side is built the way the app builds it when you change its style: STRAT_DEF, then the
// row's own three editables, then every identity key overwritten by the style stamp. The
// editables are not part of the search -- they are stylistic and measure inert -- so a club keeps
// the character its sheet gives it and the national sides, whose three are zero, are unaffected.
// The XI is re-slotted into the formation through refitLineup rather than relabelled.
//
// The field is the opposition the side would actually meet: for a league, every other club in it;
// for the international pool, every side within 15 OVR (at least the 16 nearest). Both ways round.
import { fork } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PRESET_CATALOG, STRAT_DEF, STYLE_PRESET, IDENTITY_KEYS, refitAs, runPositionalMatch } from "./engine.mjs";

export function ntJob(CODE, style, formation, k0, n, LEAGUE = "Avium International") {
  const K0 = +k0, N = +n;
  const intl = PRESET_CATALOG.filter(t => t.league === LEAGUE);
  const base = intl.find(t => t.code === CODE);
  if (!base) throw new Error(`no such side ${CODE}`);
  const self = Number(base.skill), gap = (t) => Math.abs(Number(t.skill) - self);
  let field = intl.filter(t => t.code !== CODE);
  if (LEAGUE === "Avium International") {
    field = field.filter(t => gap(t) <= 15);
    if (field.length < 16) field = intl.filter(t => t.code !== CODE).sort((a, b) => gap(a) - gap(b)).slice(0, 16);
  }
  const F = field.length;

  const strategy = { ...STRAT_DEF, timeWasting: base.strategy.timeWasting, gkDist: base.strategy.gkDist, dlBehavior: base.strategy.dlBehavior };
  for (const k of IDENTITY_KEYS) strategy[k] = STYLE_PRESET[style]?.[k] ?? 0;
  const T = { ...base, style, formation, strategy,
    squad: formation === base.formation ? base.squad : refitAs(base.squad, formation) };
  let pts = 0, w = 0, d = 0, gf = 0, ga = 0, xf = 0, xa = 0;
  for (let k = K0; k < K0 + N; k++) {
    const opp = field[k % F], home = Math.floor(k / F) % 2 === 0;
    const r = runPositionalMatch(home ? T : opp, home ? opp : T, 90e5 + (k * 131 + 7) * 7919, null, false).out;
    const f = home ? r.goals.home : r.goals.away, a = home ? r.goals.away : r.goals.home;
    if (f > a) { pts += 3; w++; } else if (f === a) { pts += 1; d++; }
    gf += f; ga += a;
    xf += (home ? r.xgS?.home : r.xgS?.away) ?? 0; xa += (home ? r.xgS?.away : r.xgS?.home) ?? 0;
  }
  return { code: CODE, style, formation, k0: K0, n: N, F, pts, w, d, gf, ga, xf, xa };
}

// W worker processes, each loading the engine once; run(args) queues a job, args as on the command
// line, and resolves with what the command line would print. close() when the queue is done.
export function ntPool(W) {
  const queue = [], free = [], all = [];
  const give = (c) => {
    if (!queue.length) { free.push(c); return; }
    c.job = queue.shift(); c.send(c.job.a);
  };
  for (let i = 0; i < W; i++) {
    const c = fork(fileURLToPath(import.meta.url), ["--worker"], { stdio: ["ignore", "ignore", "inherit", "ipc"] });
    c.on("message", (m) => { const j = c.job; c.job = null; m.err ? j.rej(new Error(`job ${j.a.join(" ")}: ${m.err}`)) : j.res(m.r); give(c); });
    c.on("exit", (code) => { if (c.job) c.job.rej(new Error(`job ${c.job.a.join(" ")}: worker exit ${code}`)); });
    all.push(c); free.push(c);
  }
  return {
    run: (a) => new Promise((res, rej) => { queue.push({ a, res, rej }); if (free.length) give(free.pop()); }),
    close: () => all.forEach(c => c.connected && c.disconnect()),
  };
}

if (process.argv[2] === "--worker" && process.send) {
  process.on("message", (a) => {
    let m;
    try { m = { r: ntJob(...a) }; } catch (e) { m = { err: String(e?.stack || e) }; }
    process.send(m);
  });
  process.on("disconnect", () => process.exit(0));
} else if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [CODE, style, formation, k0S, nS, leagueS] = process.argv.slice(2);
  try { console.log(JSON.stringify(ntJob(CODE, style, formation, k0S, nS, leagueS || undefined))); }
  catch (e) { console.error(e.message); process.exit(2); }
}
