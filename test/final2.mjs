process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { run } = await import("./mecal.mjs");
eng.CFG.holdBase = 13; eng.CFG.carryAdv = 8;
console.log("worth  shots/side goals/side  <8m/<16m/16m+  passes pass%  onT corners fouls in-play");
for (const w of [1.8, 2.6, 3.6]) {
  eng.CFG.shotWorth = w;
  const r = run(75, 75, 10);
  const d = r.dist, near = d[0]+d[1], mid = d[2]+d[3], far = d.slice(4).reduce((a,b)=>a+b,0);
  console.log(`${w}    ${((r.shotsH+r.shotsA)/2).toFixed(1)}      ${((r.goalsH+r.goalsA)/2).toFixed(2)}     ${near.toFixed(0)}%/${mid.toFixed(0)}%/${far.toFixed(0)}%  ${r.passes.toFixed(0)}  ${r.passPct.toFixed(0)}%  ${r.onT.toFixed(1)}  ${r.corners.toFixed(1)}  ${r.fouls.toFixed(1)}  ${r.inplay.toFixed(0)}m`);
}
