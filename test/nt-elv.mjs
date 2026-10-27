// A lab run's entry (test/specs/run.env LAB_TEST) and a local runner: Elvester's style, shape and selection search of 27
// October 2026. Each shape gets the eleven and bench the national selector (pickNationalSquad) picks for it from every
// Elvester national, built through the records the way the app builds the side; nt-app.mjs then plays the cell.
//
//   node test/nt-elv.mjs [jobs.json] [workers] [out.jsonl]        SHARD=i/n takes every nth job; jobs default test/elv-jobs.json
import { fork } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import { PRESET_CATALOG, RECORDS, buildPlayerIndex, pickNationalSquad, presetsFromRecords } from "./engine.mjs";

const CODE = "ELV";
const idByName = new Map(RECORDS.players.map(p => [p.name.toLowerCase(), p.id]));
const index = buildPlayerIndex(PRESET_CATALOG);
const built = new Map();
// The side as it would stand in this shape: the selector's 22, the records rebuilt, the catalog row taken whole.
export function elvIn(formation) {
  if (built.has(formation)) return built.get(formation);
  const teams = PRESET_CATALOG.map(t => t.code === CODE && t.league === "Avium International" ? { ...t, formation } : t);
  const r = pickNationalSquad(index, teams, CODE);
  const squad = r.players.map(p => { if (!p) return null; const id = idByName.get(p.fullName.toLowerCase()) ?? idByName.get(`${p.fullName.split(" ").slice(0, -1).join(" ")} ${p.fullName.split(" ").pop().toUpperCase()}`.toLowerCase());
    if (!id) throw new Error(`no record for ${p.fullName}`); return id; });
  const rec = { ...RECORDS, teams: RECORDS.teams.map(t => t.code === CODE && t.file === "AVIUM" ? { ...t, formation, squad } : t) };
  const row = presetsFromRecords(rec).find(t => t.code === CODE && t.league === "Avium International");
  built.set(formation, { row, squad });
  return built.get(formation);
}

const base = PRESET_CATALOG.find(t => t.code === CODE && t.league === "Avium International");
const orig = { formation: base.formation, squad: base.squad, skill: base.skill };
const { ntAppJob } = await import("./nt-app.mjs");
// A job [CODE, style, formation, k0, n, league, sel]: sel "pick" plays the selector's side in that shape, "cur" the sheet as it is.
export function elvJob(code, style, formation, k0, n, league, sel = "pick") {
  if (sel === "pick") { const { row } = elvIn(formation); Object.assign(base, { formation, squad: row.squad }); }
  else Object.assign(base, orig);
  base.skill = orig.skill;                                  // the same opposition field for every cell
  return { ...ntAppJob(code, style, formation, k0, n, league), sel };
}

const me = fileURLToPath(import.meta.url);
if (process.argv[2] === "--elv-worker" && process.send) {
  process.on("message", (a) => {
    let m;
    try { m = { r: elvJob(...a) }; } catch (e) { m = { err: String(e?.stack || e) }; }
    process.send(m);
  });
  process.on("disconnect", () => process.exit(0));
} else if (process.argv[1] === me) {
  const [jobsF, wS, outF] = process.argv.slice(2);
  let jobs = JSON.parse(readFileSync(jobsF ? jobsF : fileURLToPath(new URL("./elv-jobs.json", import.meta.url)), "utf8"));
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
      const c = fork(me, ["--elv-worker"], { stdio: ["ignore", "ignore", "inherit", "ipc"] });
      const give = () => { if (next >= jobs.length) { c.disconnect(); if (--live === 0) done(); return; } c.job = jobs[next++]; c.send(c.job); };
      c.on("message", (m) => { if (m.err) { failed++; console.error(`job ${c.job.join(" ")}: ${m.err}`); } else emit(m.r); give(); });
      c.on("exit", (code) => { if (code) { failed++; console.error(`worker exit ${code} on ${c.job?.join(" ")}`); if (--live === 0) done(); } });
      live++; give();
    }
  });
  console.error(`shard ${si}/${sn}: ${jobs.length} jobs on ${W} workers in ${((Date.now() - t0) / 60000).toFixed(1)} min, ${failed} failed`);
}
