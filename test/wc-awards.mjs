// THE 1936 WORLD CUP, PLAYED OUT MANY TIMES (28 October 2026): who is likeliest to take the Golden Ball, Boot and Glove,
// and where each side tends to finish its group. The drawn groups (Avium Season Preview/wc_draw_result.json) in the 1935
// World Cup's format: groups of four played once on neutral grounds, the top two through, a crossover round of 16 (A1 v
// B2 ...), then single matches to the final, with a third-place match. Every fixture goes through simPositionalMatch as the
// app's tournament plays it; suspensions and injuries do not carry from match to match.
//
//   node test/wc-awards.mjs <n> [workers] [out.jsonl] [first]      SHARD=i/k takes every kth tournament
// One line per tournament: each side's group place, the champion, and the three award winners.
import { fork } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import { PRESET_CATALOG, RNG, simPositionalMatch } from "./engine.mjs";

const GROUPS = JSON.parse(readFileSync(new URL("./wc1936-draw.json", import.meta.url), "utf8")).groups;
const side = (nm) => { const t = PRESET_CATALOG.find(x => x.league === "Avium International" && x.name.trim() === nm);
  if (!t) throw new Error(`no side ${nm}`); return t; };

export function wcRun(idx) {
  const rng = new RNG((1936e6 + idx * 7919) >>> 0), stats = new Map();
  const play = (h, a, ko) => {
    const r = simPositionalMatch(rng, h.skill, a.skill, ko, h.style, a.style, h.formation, a.formation, null, h.strategy, a.strategy,
      h.squad, a.squad, { home: 0, away: 0 }, null, true, { home: h.mgmt ?? null, away: a.mgmt ?? null });
    for (const [sd, t] of [["home", h], ["away", a]]) for (const p of r.playerData[sd]) {
      if (!(p.mins > 0)) continue;
      const k = t.code + "|" + (p.fullName || p.name), s = stats.get(k) || { name: p.fullName || p.name, team: t.code, pos: p.pos, apps: 0, mins: 0, rt: 0, g: 0, sv: 0 };
      s.apps++; s.mins += p.mins; s.rt += p.rating ?? 6.5; s.g += p.goals || 0; s.sv += p.saves || 0; stats.set(k, s);
    }
    const hg = r.ftHome + (r.et?.home || 0), ag = r.ftAway + (r.et?.away || 0);
    const win = hg > ag ? h : ag > hg ? a : r.pen ? (r.pen.home > r.pen.away ? h : a) : null;
    return { hg, ag, win, lose: win === h ? a : win === a ? h : null };
  };
  const place = {}, at = {};
  for (const [L, names] of Object.entries(GROUPS)) {
    const ts = names.map(side), tab = new Map(ts.map(t => [t, { t, pts: 0, gd: 0, gf: 0, r: rng.next() }]));
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      const m = play(ts[i], ts[j], false), A = tab.get(ts[i]), B = tab.get(ts[j]);
      A.gf += m.hg; B.gf += m.ag; A.gd += m.hg - m.ag; B.gd += m.ag - m.hg;
      if (m.hg > m.ag) A.pts += 3; else if (m.ag > m.hg) B.pts += 3; else { A.pts++; B.pts++; }
    }
    const ord = [...tab.values()].sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || x.r - y.r);
    ord.forEach((e, i) => { place[e.t.name.trim()] = i + 1; });
    at[L] = ord.map(e => e.t);
  }
  const Ls = Object.keys(GROUPS);
  let round = [];
  for (let i = 0; i < Ls.length; i += 2) round.push([at[Ls[i]][0], at[Ls[i + 1]][1]]);
  for (let i = 0; i < Ls.length; i += 2) round.push([at[Ls[i + 1]][0], at[Ls[i]][1]]);
  let semiLosers = [];
  while (round.length) {
    const won = round.map(([h, a]) => play(h, a, true));
    if (round.length === 2) semiLosers = won.map(m => m.lose);
    if (round.length === 1) { var champ = won[0].win; break; }
    const nx = []; for (let i = 0; i < won.length; i += 2) nx.push([won[i].win, won[i + 1].win]); round = nx;
  }
  play(semiLosers[0], semiLosers[1], true);
  const all = [...stats.values()], best = (f, ok = () => true) => all.filter(ok).sort((x, y) => f(y) - f(x) || x.mins - y.mins)[0];
  const boot = best(s => s.g), glove = best(s => s.sv);
  // The archive's MVP (seasonMVP): the champions' best average rating among men with half the most minutes anybody played.
  const bar = Math.max(...all.map(s => s.mins)) * 0.5, mine = all.filter(s => s.team === champ.code), pool = mine.filter(s => s.mins >= bar);
  const ball = (pool.length ? pool : mine).sort((x, y) => y.rt / y.apps - x.rt / x.apps || y.g - x.g || y.mins - x.mins)[0];
  const tag = (s, v) => s && { name: s.name, team: s.team, pos: s.pos, v };
  return { idx, place, champ: champ.name.trim(), ball: tag(ball, +(ball.rt / ball.apps).toFixed(2)), boot: tag(boot, boot.g), glove: tag(glove, glove.sv) };
}

const me = fileURLToPath(import.meta.url);
if (process.argv[2] === "--wc-worker" && process.send) {
  process.on("message", (i) => { let m; try { m = { r: wcRun(i) }; } catch (e) { m = { err: String(e?.stack || e) }; } process.send(m); });
  process.on("disconnect", () => process.exit(0));
} else if (process.argv[1] === me) {
  const [nS, wS, outF, firstS] = process.argv.slice(2), N = +nS || 10, first = +firstS || 0;
  const [si, sn] = (process.env.SHARD || "0/1").split("/").map(Number);
  const jobs = Array.from({ length: N }, (_, i) => first + i).filter(i => i % sn === si);
  const W = Math.max(1, Math.min(jobs.length, +(wS || 0) || availableParallelism()));
  if (outF) writeFileSync(outF, "");
  const emit = (r) => { const l = JSON.stringify(r); if (outF) appendFileSync(outF, l + "\n"); else console.log(l); };
  let next = 0, live = 0, failed = 0; const t0 = Date.now();
  await new Promise((done) => {
    for (let i = 0; i < W; i++) {
      const c = fork(me, ["--wc-worker"], { stdio: ["ignore", "ignore", "inherit", "ipc"] });
      const give = () => { if (next >= jobs.length) { c.disconnect(); if (--live === 0) done(); return; } c.job = jobs[next++]; c.send(c.job); };
      c.on("message", (m) => { if (m.err) { failed++; console.error(`tournament ${c.job}: ${m.err}`); } else emit(m.r); give(); });
      c.on("exit", (code) => { if (code) { failed++; console.error(`worker exit ${code} on ${c.job}`); if (--live === 0) done(); } });
      live++; give();
    }
  });
  console.error(`shard ${si}/${sn}: ${jobs.length} tournaments on ${W} workers in ${((Date.now() - t0) / 60000).toFixed(1)} min, ${failed} failed`);
}
