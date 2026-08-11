process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { run } = await import("./mecal.mjs");
console.log("holdBase  passes  pass%  shots/side  goals/side  in-play");
for (const h of [5, 9, 13, 17]) {
  eng.CFG.holdBase = h;
  const r = run(75, 75, 8);
  console.log(`   ${String(h).padEnd(6)} ${r.passes.toFixed(0).padStart(5)}   ${r.passPct.toFixed(0)}%   ${((r.shotsH+r.shotsA)/2).toFixed(1)}       ${((r.goalsH+r.goalsA)/2).toFixed(2)}      ${r.inplay.toFixed(0)}m`);
}
