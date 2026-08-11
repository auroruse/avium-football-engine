process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { run } = await import("./mecal.mjs");
const b = { lo: eng.CFG.tackleLo, hi: eng.CFG.tackleHi };
console.log("tackle band   shots goals  dist(near/mid/far)  passes pass%  corners fouls in-play");
for (const m of [1, 1.8, 2.8]) {
  eng.CFG.tackleLo = b.lo * m; eng.CFG.tackleHi = b.hi * m;
  const r = run(75, 75, 8);
  const d = r.dist, near = d[0]+d[1], mid = d[2]+d[3], far = d.slice(4).reduce((a,b)=>a+b,0);
  console.log(`x${m}          ${((r.shotsH+r.shotsA)/2).toFixed(1)}  ${((r.goalsH+r.goalsA)/2).toFixed(2)}   ${near.toFixed(0)}/${mid.toFixed(0)}/${far.toFixed(0)}          ${r.passes.toFixed(0)}  ${r.passPct.toFixed(0)}%   ${r.corners.toFixed(1)}    ${r.fouls.toFixed(1)}   ${r.inplay.toFixed(0)}m`);
}
