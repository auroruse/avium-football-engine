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
// one inline, and it guarantees three things: results come back in the order the jobs went in, a
// job a worker cannot do gets done on this thread instead, and IT ALWAYS FINISHES. That last one
// is not a nicety. The first version fed each worker a job, and when a worker failed to load, the
// browser fired one `error` at it and then went quiet forever -- so the run stopped dead on
// exactly poolSize completed jobs with a progress bar that never moved again.

export type PoolJob = { seed: number; [k: string]: unknown };

const HW = (() => {
  try { return (globalThis as any).navigator?.hardwareConcurrency || 0; } catch { return 0; }
})();

// Leave a core for the interface and whatever else the machine is doing. One worker is pointless --
// it is the main thread's work moved sideways with a serialisation charge on top -- so below two
// usable cores the pool declines to exist and everything runs inline.
export const poolSize = () => Math.max(0, Math.min(8, (HW || 1) - 2));

export function makePool(makeWorker: (() => Worker) | null, inline: (job: PoolJob) => unknown) {
  let workers: Worker[] = [];
  const dead = new WeakSet<Worker>();
  let noWorkers = !makeWorker;

  const spin = (n: number) => {
    if (noWorkers) return;
    while (workers.length < n) {
      try { workers.push(makeWorker!()); }
      catch (e) { console.warn("[sim] no workers, running on this thread:", e); noWorkers = true; return; }
    }
  };

  // Kept warm between rounds: a worker costs a bundle parse to start, and a 38-round season would
  // otherwise pay that 38 times.
  const dispose = () => { for (const w of workers) w.terminate(); workers = []; };

  const yieldFrame = () => new Promise((r) => setTimeout(r, 0));

  const run = async (jobs: PoolJob[], onProgress?: (d: number, t: number) => void) => {
    const total = jobs.length;
    if (!total) return [];
    const out = new Array(total);
    let next = 0, done = 0;

    const finish = (i: number, v: unknown) => {
      out[i] = v;
      onProgress?.(++done, total);
    };

    spin(Math.min(poolSize(), total));
    const live = () => workers.filter((w) => !dead.has(w));

    if (live().length >= 2) {
      await new Promise<void>((resolve) => {
        let flying = 0;
        const settle = () => { if (done >= total) resolve(); };
        const feed = (w: Worker) => {
          if (dead.has(w)) { pump(); return; }
          if (next >= total) { settle(); return; }
          const i = next++;
          let over = false;
          const clear = () => {
            w.removeEventListener("message", onMsg);
            w.removeEventListener("error", onErr);
          };
          const onMsg = (e: MessageEvent) => {
            if (over || (e.data as any)?.i !== i) return;
            over = true; clear(); flying--;
            finish(i, (e.data as any).r);
            if (done >= total) return resolve();
            feed(w);
          };
          // A WORKER THAT ERRORS IS GONE. The browser reports a failed script load exactly once, so
          // treating this as "retry the next job on the same worker" is how the run stalls: eight
          // workers report once, eight jobs fall back, and then nobody is left to say anything ever
          // again. Do this job here, strike the worker off, and let pump() find the work a home.
          const onErr = (e: unknown) => {
            if (over) return;
            over = true; clear(); flying--;
            dead.add(w);
            if (live().length === 0 && !reported) {
              reported = true;
              console.warn("[sim] every worker failed; falling back to this thread.", e);
            }
            finish(i, inline(jobs[i]));
            if (done >= total) return resolve();
            pump();
          };
          w.addEventListener("message", onMsg);
          w.addEventListener("error", onErr);
          flying++;
          try { w.postMessage({ i, job: jobs[i] }); }
          catch (e) { onErr(e); }                 // a job that will not clone is a job for this thread
        };
        let reported = false;
        // Whatever happens to the workers, the remaining jobs get done. If any are still alive they
        // are fed; if none are, the rest is drained here, a couple at a time so the bar still moves.
        const pump = () => {
          const ws = live();
          if (ws.length) {
            for (const w of ws) if (flying < ws.length && next < total) feed(w);
            if (flying === 0 && next < total) drain();
            else settle();
            return;
          }
          drain();
        };
        const drain = async () => {
          while (next < total) {
            const i = next++;
            finish(i, inline(jobs[i]));
            if (i % 2 === 1) await yieldFrame();
          }
          settle();
        };
        for (const w of live()) feed(w);
        if (next === 0) drain();                  // nothing got fed at all
      });
      return out;
    }

    // No usable pool: straight through on this thread, handing the frame back often enough that a
    // progress bar can actually paint. Without that the fallback is the old frozen tab.
    for (let i = 0; i < total; i++) {
      finish(i, inline(jobs[i]));
      if (i % 2 === 1) await yieldFrame();
    }
    return out;
  };

  return { run, dispose, size: () => workers.filter((w) => !dead.has(w)).length };
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
