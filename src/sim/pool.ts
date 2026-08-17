// A POOL OF ENGINES, ONE PER CORE.
//
// A positional match is about 1.3 s of solid arithmetic and it cannot be made parallel with itself
// -- tick N needs tick N-1. What IS parallel is a matchday: every fixture in a round is played at
// the same time, against the same suspension list, and nothing one of them decides is read by
// another until the round is over. So a round fans out and barriers, which is exactly what a pool
// is for.
//
// Measured on a ten-core M2 Pro, twenty fixtures, results identical at every size:
//   serial 24.0 s | 2 workers 1.83x | 4 workers 3.44x | 8 workers 4.17x | 10 workers 4.28x
// It flattens past four because six of those cores are performance cores and four are efficiency
// cores, and this workload gets almost nothing from the latter.
//
// The pool knows nothing about football. It is handed plain job objects and a function that can do
// one inline, and it guarantees two things: the results come back in the order the jobs went in,
// and a job that a worker cannot do gets done on this thread instead rather than lost.

export type PoolJob = { seed: number; [k: string]: unknown };

const HW = (() => {
  try { return (globalThis as any).navigator?.hardwareConcurrency || 0; } catch { return 0; }
})();

// Leave a core for the interface and whatever else the machine is doing. One worker is pointless --
// it is the main thread's work moved sideways with a serialisation charge on top -- so below two
// usable cores the pool declines to exist and everything runs inline.
export const poolSize = () => Math.max(0, Math.min(8, (HW || 1) - 2));

type Pending = { resolve: (v: unknown) => void; reject: (e: unknown) => void; i: number };

export function makePool(makeWorker: (() => Worker) | null, inline: (job: PoolJob) => unknown) {
  let workers: Worker[] = [];
  let broken = false;

  const spin = (n: number) => {
    if (!makeWorker || broken) return;
    while (workers.length < n) {
      try { workers.push(makeWorker()); }
      catch { broken = true; for (const w of workers) w.terminate(); workers = []; return; }
    }
  };

  // Kept warm between rounds: a worker costs a bundle parse to start, and a 38-round season would
  // otherwise pay that 38 times.
  const dispose = () => { for (const w of workers) w.terminate(); workers = []; };

  const runInline = async (jobs: PoolJob[], onProgress?: (d: number, t: number) => void) => {
    const out = new Array(jobs.length);
    for (let i = 0; i < jobs.length; i++) {
      out[i] = inline(jobs[i]);
      onProgress?.(i + 1, jobs.length);
      // Hand the frame back so a progress bar can actually paint. Without this the "parallel"
      // fallback is the old frozen tab with extra steps.
      if (i % 2 === 1) await new Promise((r) => setTimeout(r, 0));
    }
    return out;
  };

  const run = async (jobs: PoolJob[], onProgress?: (d: number, t: number) => void) => {
    if (!jobs.length) return [];
    const want = Math.min(poolSize(), jobs.length);
    if (want < 2) return runInline(jobs, onProgress);
    spin(want);
    if (!workers.length) return runInline(jobs, onProgress);

    const out = new Array(jobs.length);
    let next = 0, done = 0;
    const total = jobs.length;

    await new Promise<void>((resolve) => {
      const feed = (w: Worker) => {
        if (next >= total) { if (done >= total) resolve(); return; }
        const i = next++;
        const onMsg = (e: MessageEvent) => {
          if ((e.data as any)?.i !== i) return;
          w.removeEventListener("message", onMsg);
          w.removeEventListener("error", onErr);
          out[i] = (e.data as any).r;
          onProgress?.(++done, total);
          if (done >= total) resolve(); else feed(w);
        };
        // A worker that dies takes its job with it. Do that one here rather than drop a fixture --
        // a missing result is a tournament with a hole in it, which is far worse than a slow one.
        const onErr = () => {
          w.removeEventListener("message", onMsg);
          w.removeEventListener("error", onErr);
          out[i] = inline(jobs[i]);
          onProgress?.(++done, total);
          if (done >= total) resolve(); else feed(w);
        };
        w.addEventListener("message", onMsg);
        w.addEventListener("error", onErr);
        w.postMessage({ i, job: jobs[i] });
      };
      for (const w of workers) feed(w);
    });
    return out;
  };

  return { run, dispose, size: () => workers.length };
}

// Fixture seeds. The bulk sim used to thread ONE generator through a whole round, so which numbers
// a fixture got depended on the order it happened to be played in -- which is not a thing that can
// survive being run on eight threads at once. Each fixture derives its own from its key instead,
// which is reproducible in a way the old shared generator never was, since that was seeded off the
// clock. Same match, same key, same run: same result, whatever core it lands on.
export const jobSeed = (base: number, key: string) => {
  let h = base >>> 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0);
  return (h || 7) >>> 0;
};
