process.env.QUIET = "1";
const { CFG } = await import("./engine.mjs");
const { run } = await import("./mecal.mjs");
console.log("markSmooth markLead   shots  goals  onT   pass%  0-5m  5-10m 10-15 15-20");
for (const ms of [0.22, 0.45, 0.7, 1.0]) for (const ml of [0, 1.4]) {
  CFG.markSmooth = ms; CFG.markLead = ml;
  const r = run(75, 75, 14), d = r.dist;
  console.log(`${String(ms).padStart(10)} ${String(ml).padStart(8)}   ${((r.shotsH+r.shotsA)/2).toFixed(1).padStart(5)}  ${((r.goalsH+r.goalsA)/2).toFixed(2).padStart(5)}  ${r.onT.toFixed(1).padStart(4)}  ${r.passPct.toFixed(0).padStart(4)}%  ` +
              d.slice(0,4).map(b=>(b.toFixed(0)+"%").padStart(5)).join(" "));
}
