// NL2 1935 RE-SIM, THE POOL (26 Oct 2026): every fixture of the published season, home side at home, managers on, played
// K times on today's engine with the clubs as they stood on 11 October (this root's src/data). One line a match.
//   node test/nl2play.mjs <season.md> <k0> <k1> <workers> <out.jsonl | ->     samples k0..k1-1; SHARD=i/n takes every nth match
import { fork } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
const me = fileURLToPath(import.meta.url);
const fixtures = (md) => { const out = []; let r = 0;
  for (const line of md.split("\n")) { const h = line.match(/^## Round (\d+)/); if (h) { r = +h[1]; continue; }
    if (/^## (Final Table|Promotion)/.test(line)) break;
    const m = line.match(/^\| (.+?) vs (.+?) \| \d+-\d+ \|$/); if (m && r) out.push([r, m[1], m[2]]); }
  return out; };
if (process.argv[2] === "--worker") {
  const E = await import("./engine.mjs");
  const by = new Map(E.PRESET_CATALOG.filter(t => t.league === "Nichirin League Two").map(t => [t.name.trim(), t]));
  process.on("message", ([f, k, hn, an]) => {
    try {
      const h = by.get(hn), a = by.get(an);
      const r = E.simPositionalMatch(new E.RNG(((f + 1) * 7919 + (k + 1) * 104729) >>> 0), h.skill, a.skill, false, h.style, a.style, h.formation, a.formation,
        "home", h.strategy, a.strategy, h.squad, a.squad, null, null, true, { home: h.mgmt ?? null, away: a.mgmt ?? null });
      const P = (ps) => (ps || []).map(p => [p.name, p.fullName || null, p.pos, Math.round(p.ovr0 ?? p.ovr ?? 70), (p.sub === "on" || p.sub === true || p._onAt !== undefined) ? 1 : 0,
        p.mins || 0, p.goals || 0, p.assists || 0, p.rating || 6.5, p.cc || 0, p.defActs || 0, p.saves || 0]);
      process.send({ r: { f, k, hg: r.ftHome, ag: r.ftAway, ph: P(r.playerData?.home), pa: P(r.playerData?.away) } });
    } catch (e) { process.send({ err: String(e?.stack || e) }); }
  });
  process.on("disconnect", () => process.exit(0));
} else {
  const [mdF, K0, K1, Ws, OUT] = process.argv.slice(2), W = +Ws || availableParallelism();
  const [si, sn] = (process.env.SHARD || "0/1").split("/").map(Number);
  const fx = fixtures(readFileSync(mdF, "utf8")), all = [];
  for (let k = +K0; k < +K1; k++) fx.forEach(([, h, a], f) => all.push([f, k, h, a]));
  const jobs = all.filter((_, i) => i % sn === si), emit = (l) => (OUT === "-" ? process.stdout.write(l + "\n") : appendFileSync(OUT, l + "\n"));
  if (OUT !== "-") writeFileSync(OUT, ""); console.error(`${fx.length} fixtures, ${jobs.length} matches`);
  let next = 0, live = 0, done = 0, failed = 0; const t0 = Date.now();
  await new Promise((fin) => { for (let i = 0; i < Math.min(W, jobs.length); i++) {
    const c = fork(me, ["--worker"], { stdio: ["ignore", "ignore", "inherit", "ipc"] });
    const give = () => { if (next >= jobs.length) { c.disconnect(); if (--live === 0) fin(); return; } c.job = jobs[next++]; c.send(c.job); };
    c.on("message", (m) => { if (m.err) { failed++; console.error(m.err); } else emit(JSON.stringify(m.r));
      if (++done % 500 === 0) console.error(`${done}/${jobs.length} in ${((Date.now() - t0) / 60000).toFixed(1)} min`); give(); });
    c.on("exit", (code) => { if (code) { failed++; if (--live === 0) fin(); } });
    live++; give(); } });
  console.error(`done: ${done} in ${((Date.now() - t0) / 60000).toFixed(1)} min, ${failed} failed`);
}
