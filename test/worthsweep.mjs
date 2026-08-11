process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { run } = await import("./mecal.mjs");
console.log("worth  shots/side  goals/side  onT  <8m/<16m/16m+  pass%");
for (const w of [0.75, 1.2, 1.8, 2.6]) {
  eng.CFG.shotWorth = w;
  const r = run(75, 75, 10);
  const d = r.dist, near = d[0]+d[1], mid = d[2]+d[3], far = d.slice(4).reduce((a,b)=>a+b,0);
  console.log(`${w}    ${((r.shotsH+r.shotsA)/2).toFixed(1)}       ${((r.goalsH+r.goalsA)/2).toFixed(2)}      ${r.onT.toFixed(1)}  ${near.toFixed(0)}%/${mid.toFixed(0)}%/${far.toFixed(0)}%  ${r.passPct.toFixed(0)}%`);
}
