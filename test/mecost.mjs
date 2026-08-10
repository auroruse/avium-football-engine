// What a positional 22-player engine costs in THIS runtime. Not a guess: a realistic inner loop --
// every player scans all 22 for distance (the pressure/marking/passing-lane query every such engine
// needs), scores a handful of candidate actions, and integrates. Deliberately optimistic: flat typed
// arrays, no allocation, no pathfinding, no ball physics beyond one integrate, no AI beyond argmax.
const N = 22, x = new Float64Array(N), y = new Float64Array(N), vx = new Float64Array(N), vy = new Float64Array(N), sk = new Float64Array(N);
for (let i = 0; i < N; i++) { x[i] = (i % 11) * 9; y[i] = (i < 11 ? 25 : 45); sk[i] = 60 + (i % 17); }
let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
function tick() {
  for (let i = 0; i < N; i++) {
    let best = -1e9, bx = 0, by = 0, press = 0;
    for (let j = 0; j < N; j++) {            // the all-pairs scan
      if (j === i) continue;
      const dx = x[j] - x[i], dy = y[j] - y[i], d2 = dx * dx + dy * dy;
      if (d2 < 64) press += 1 / (1 + d2);
      const v = sk[j] / (1 + Math.sqrt(d2)) + rnd() * 0.1;   // candidate score
      if (v > best) { best = v; bx = dx; by = dy; }
    }
    const inv = 1 / (Math.hypot(bx, by) + 1e-6), sp = 0.8 * (1 - 0.3 * press);
    vx[i] = bx * inv * sp; vy[i] = by * inv * sp;
  }
  for (let i = 0; i < N; i++) { x[i] += vx[i]; y[i] += vy[i];
    if (x[i] < 0) x[i] = 0; else if (x[i] > 105) x[i] = 105;
    if (y[i] < 0) y[i] = 0; else if (y[i] > 68) y[i] = 68; }
}
for (let i = 0; i < 200000; i++) tick();          // warm
for (const hz of [2, 5, 10, 25]) {
  const ticks = 90 * 60 * hz, t0 = process.hrtime.bigint();
  for (let i = 0; i < ticks; i++) tick();
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  console.log(`${String(hz).padStart(2)} Hz  ${String(ticks).padStart(6)} ticks/match   ${ms.toFixed(1).padStart(7)} ms/match   380-match season ${(ms*380/1000).toFixed(0).padStart(5)}s   vs current 0.21s`);
}
