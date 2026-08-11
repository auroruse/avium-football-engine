process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { run } = await import("./mecal.mjs");
eng.CFG.holdBase = 13; eng.CFG.shotWorth = 1.8;
console.log("carryAdv  shots/side goals/side  <8m/<16m/16m+  passes");
for (const c of [4.5, 8, 12]) {
  eng.CFG.carryAdv = c;
  const r = run(75, 75, 8);
  const d = r.dist, near = d[0]+d[1], mid = d[2]+d[3], far = d.slice(4).reduce((a,b)=>a+b,0);
  console.log(`  ${String(c).padEnd(7)} ${((r.shotsH+r.shotsA)/2).toFixed(1)}      ${((r.goalsH+r.goalsA)/2).toFixed(2)}     ${near.toFixed(0)}%/${mid.toFixed(0)}%/${far.toFixed(0)}%  ${r.passes.toFixed(0)}`);
}
