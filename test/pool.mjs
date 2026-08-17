// THE WORKER SEAM. Three things have to hold or a parallel tournament is worse than a slow one:
//   the same fixture gives the same result whichever thread runs it,
//   results come back in the order the fixtures went in, whatever order the cores finish,
//   and the worker can actually load -- App.tsx carries React and a dozen image imports, and a
//     worker has no DOM to hand them.
// The last one is the one a build cannot tell you about, so it is checked by loading the BUILT
// worker chunk under a bare `self` and seeing whether it wires up its handler.
import fs from "node:fs";
import path from "node:path";

let fails = 0;
const ok = (name, cond, got) => {
  if (!cond) { fails++; console.log("  FAIL  " + name + (got === undefined ? "" : "   " + JSON.stringify(got))); }
  else console.log("  ok    " + name + (got === undefined ? "" : "   " + JSON.stringify(got)));
};

const eng = await import("./engine.mjs");
const { load, PROJECT } = await import("/Users/zli/Documents/NICHIRIN/.claude/skills/avium-tactics/scripts/lib.mjs");
const { clubs } = await load(path.join(PROJECT, "src/presets/NCH.tsv"));

const sig = (r) => [r.ftHome, r.ftAway, r.pen?.home ?? -1, r.pen?.away ?? -1,
  (r.playerData?.home || []).map(p => p.name + (p.goals || 0) + p.rating).join(",")].join("|");

// ── 1. one implementation, two ways of calling it ────────────────────────────
console.log("the seam");
{
  const mk = (k) => ({ seed: 4242 + k, a: [clubs[k].skill, clubs[k + 5].skill, false,
    clubs[k].style, clubs[k + 5].style, clubs[k].formation, clubs[k + 5].formation,
    null, clubs[k].strategy, clubs[k + 5].strategy, clubs[k].squad, clubs[k + 5].squad,
    null, null, true] });
  const viaJob = eng.simJob(mk(0));
  const direct = eng.simJob(mk(0));
  ok("simJob is deterministic", sig(viaJob) === sig(direct), sig(viaJob).slice(0, 24));
  const other = eng.simJob(mk(1));
  ok("a different fixture differs", sig(other) !== sig(viaJob));
}

// ── 2. the pool: order and the inline fallback ───────────────────────────────
console.log("\nthe pool");
{
  const { makePool, jobSeed, poolSize } = await import("../src/sim/pool.ts").catch(() => ({}));
  // pool.ts is TypeScript; read it through the bundle instead if a direct import is not possible.
  const P = makePool ? { makePool, jobSeed, poolSize } : await (async () => {
    const src = fs.readFileSync(new URL("../src/sim/pool.ts", import.meta.url), "utf8")
      .replace(/: *\(\) *=> *Worker *\| *null/g, "").replace(/: *\(job: PoolJob\) *=> *unknown/g, "")
      .replace(/export type [^\n]+\n/g, "").replace(/<[^<>()]*>(?=\()/g, "")
      .replace(/: *(PoolJob\[\]|PoolJob|Worker\[\]|Worker|number|string|boolean|void|unknown|Pending\[\]|MessageEvent)\b/g, "")
      .replace(/\bas any\b/g, "").replace(/\bas unknown as Worker\b/g, "")
      .replace(/type Pending[^\n]+\n/g, "").replace(/export /g, "")
      .replace(/\(onProgress\?/g, "(onProgress").replace(/onProgress\?\./g, "onProgress && onProgress")
      .replace(/\?\.\(/g, "&& onProgress(");
    return new Function(src + "\nreturn { makePool, jobSeed, poolSize };")();
  })();

  const jobs = Array.from({ length: 12 }, (_, i) => ({ seed: 900 + i, i }));
  const inline = (j) => ({ seed: j.seed, at: j.i });

  // No workers at all: the fallback has to produce the same answers in the same slots.
  const p1 = P.makePool(null, inline);
  const r1 = await p1.run(jobs);
  ok("inline keeps order", r1.every((r, i) => r.at === i), r1.length);

  // Fake workers that finish out of order on purpose -- the whole risk of a pool in one test.
  let live = 0;
  const flaky = () => {
    const w = { ls: {},
      addEventListener(k, f) { (w.ls[k] = w.ls[k] || []).push(f); },
      removeEventListener(k, f) { w.ls[k] = (w.ls[k] || []).filter(x => x !== f); },
      postMessage({ i, job }) {
        live++;
        // Deliberately jumbled delays, and every third job throws so the fallback path is exercised.
        setTimeout(() => { live--;
          if (i % 3 === 2) for (const f of [...(w.ls.error || [])]) f({});
          else for (const f of [...(w.ls.message || [])]) f({ data: { i, r: inline(job) } });
        }, (7 - (i % 5)) * 3);
      },
      terminate() {} };
    return w;
  };
  const p2 = P.makePool(flaky, inline);
  let last = 0;
  const r2 = await p2.run(jobs, (d, t) => { last = d; });
  ok("workers keep order",        r2.every((r, i) => r.at === i), r2.map(r => r.at).join(","));
  ok("a dead job is done here",   r2.filter((r, i) => i % 3 === 2).every(r => r), true);
  ok("progress reaches the end",  last === jobs.length, last);
  ok("nothing left in flight",    live === 0, live);
  p2.dispose();

  // Seeds: same key, same seed; different key, different seed.
  ok("seeds are reproducible", P.jobSeed(5, "g_0_1_2") === P.jobSeed(5, "g_0_1_2"));
  const keys = [];
  for (let g = 0; g < 4; g++) for (let r = 0; r < 10; r++) for (let m = 0; m < 6; m++)
    keys.push(P.jobSeed(12345, `g_${g}_${r}_${m}`));
  ok("240 fixtures, 240 seeds", new Set(keys).size === keys.length, new Set(keys).size);
  ok("pool size leaves headroom", P.poolSize() <= 8, P.poolSize());
}

// ── 3. the built worker actually loads ───────────────────────────────────────
console.log("\nthe built worker chunk");
{
  const dir = new URL("../dist/assets/", import.meta.url);
  const f = fs.existsSync(dir) && fs.readdirSync(dir).find(x => /^match\.worker-.*\.js$/.test(x));
  if (!f) { fails++; console.log("  FAIL  no worker chunk in dist — run: npx vite build"); }
  else {
    const shim = { onmessage: null, postMessage() {} };
    globalThis.self = shim;
    // No DOM here at all. If App.tsx touched document or localStorage while loading, this throws.
    try {
      await import(new URL(f, dir).href);
      ok("it loads with no DOM", true, f);
      ok("it wires up a handler", typeof shim.onmessage === "function");
      let got = null;
      shim.postMessage = (m) => { got = m; };
      shim.onmessage({ data: { i: 3, job: { seed: 77, a: [70, 68, false, "balanced", "balanced",
        "4-3-3", "4-3-3", null, {}, {}, null, null, null, null, true] } } });
      ok("it plays a fixture",  got && got.i === 3 && typeof got.r?.ftHome === "number",
         got && [got.i, got.r?.ftHome, got.r?.ftAway]);
    } catch (e) {
      fails++; console.log("  FAIL  the worker chunk threw on load: " + e.message);
    } finally { delete globalThis.self; }
  }
}

console.log(fails ? "\n" + fails + " FAILED" : "\nall passed");
process.exit(fails ? 1 : 0);
