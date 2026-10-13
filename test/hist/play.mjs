// PLAY A LIST OF MATCHES between historical sides (test/hist/side.mjs), split across this machine's cores.
//
//   SHARD=i/n node test/hist/play.mjs <jobs.json> [workers] > out.jsonl
//
// jobs.json is { sides: { key: { name, code, skill, style, formation } }, jobs: [[id, homeKey, awayKey, seed], ...] }.
// A shard takes every nth job from the ith; its workers split that again. One line a match: {"id","hg","ag"}.
import { fork } from "node:child_process";
import { readFileSync } from "node:fs";
import { cpus } from "node:os";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(import.meta.url);
const [file, wArg] = process.argv.slice(2);

if (process.env.HIST_CHILD) {
  const E = await import("../engine.mjs");
  const { sideOf } = await import("./side.mjs");
  const { sides, jobs } = JSON.parse(readFileSync(file, "utf8"));
  const [w, W] = process.env.HIST_CHILD.split("/").map(Number);
  const cache = new Map(), side = (k) => cache.get(k) || (cache.set(k, sideOf(E, sides[k])), cache.get(k));
  for (let i = w; i < jobs.length; i += W) {
    const [id, h, a, seed] = jobs[i];
    let line;
    try { const m = E.runPositionalMatch(side(h), side(a), seed, "home"); line = { id, hg: m.out.goals.home, ag: m.out.goals.away }; }
    catch (e) { line = { id, err: String(e).slice(0, 200) }; }
    process.send(JSON.stringify(line));
  }
  process.exit(0);
}

const all = JSON.parse(readFileSync(file, "utf8")).jobs;
const [s, S] = (process.env.SHARD || "0/1").split("/").map(Number);
const mine = all.filter((_, i) => i % S === s).length;
const W = Math.max(1, Math.min(+wArg || cpus().length, mine || 1));
// The shard's own jobs, re-indexed: each child takes every Wth of them. The child sees the whole file, so a shard's
// jobs are written out as a filtered copy first.
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const src = JSON.parse(readFileSync(file, "utf8"));
const dir = mkdtempSync(join(tmpdir(), "hist-"));
const part = join(dir, "part.json");
writeFileSync(part, JSON.stringify({ sides: src.sides, jobs: src.jobs.filter((_, i) => i % S === s) }));
let done = 0, live = W;
for (let w = 0; w < W; w++) {
  const c = fork(HERE, [part], { env: { ...process.env, HIST_CHILD: w + "/" + W } });
  c.on("message", (m) => { process.stdout.write(m + "\n"); done++; if (done % 200 === 0) process.stderr.write(`${done}/${mine}\n`); });
  c.on("exit", () => { if (--live === 0) process.stderr.write(`done ${done}/${mine}\n`); });
}
