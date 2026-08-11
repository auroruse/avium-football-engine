// Sweeps are embarrassingly parallel and were using one core of ten. A full match is 4320 ticks at
// 309 us each -- 1.3 s -- so a 24-cell grid at 36 matches a cell is 864 matches and nineteen minutes,
// which is long enough that the sample size gets cut to fit the wait. That is the wrong way round:
// at 36 matches a win rate carries an 8-point standard error and individual cells cannot be read.
//
// A worker is just this same harness re-run with SHARD set. It does every nth cell and writes one
// JSON line per result; the parent collects them back into the original order. No pool, no protocol,
// no dependency -- the whole thing is the twenty lines below.
//
//   const out = await parMap(cells, (c) => play(c));
//   if (!out) process.exit(0);            // a worker has done its slice and must not print
//
// PAR=1 runs it in-process, which is what you want when a sweep misbehaves and you need a stack.
import { fork } from "node:child_process";
import os from "node:os";

export async function parMap(items, job) {
  const sh = process.env.SHARD;
  if (sh) {                                     // ---- worker: my slice, one JSON line each
    const [k, n] = sh.split("/").map(Number);
    for (let i = k; i < items.length; i += n)
      process.stdout.write("\x01" + JSON.stringify([i, await job(items[i], i)]) + "\n");
    return null;
  }
  // Performance cores only. The efficiency cores on this machine are roughly a third the speed, so
  // handing them an equal share of the cells just means everybody waits for them.
  const cores = os.cpus().length >= 10 ? 6 : Math.max(1, os.cpus().length - 2);
  const n = Math.max(1, Math.min(items.length, +(process.env.PAR || cores)));
  if (n === 1) {                                // ---- in-process, for when you need a stack trace
    const out = []; for (let i = 0; i < items.length; i++) out.push(await job(items[i], i));
    return out;
  }
  const out = new Array(items.length);
  await Promise.all(Array.from({ length: n }, (_, k) => new Promise((res, rej) => {
    const c = fork(process.argv[1], process.argv.slice(2),
                   { env: { ...process.env, SHARD: `${k}/${n}` }, silent: true });
    let buf = "";
    c.stdout.on("data", (d) => {
      buf += d;
      for (let j; (j = buf.indexOf("\n")) >= 0; ) {
        const line = buf.slice(0, j); buf = buf.slice(j + 1);
        if (line[0] === "\x01") { const [i, r] = JSON.parse(line.slice(1)); out[i] = r; }
        else if (line.trim()) process.stderr.write(line + "\n");   // a worker's stray log
      }
    });
    c.stderr.pipe(process.stderr);
    c.on("exit", (code) => code === 0 ? res() : rej(new Error(`shard ${k}/${n} exited ${code}`)));
  })));
  return out;
}
