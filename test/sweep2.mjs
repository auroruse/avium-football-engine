// Calibration sweep over live CFG. Targets: 13/13 shots, 1.40/1.40 goals, 80% passing.
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { run } = await import("./mecal.mjs");
const base = { ...eng.CFG };
const grid = [];
for (const blockK of [0.5, 0.8, 1.1]) for (const shotWorth of [1.0, 0.78, 0.6])
  grid.push({ blockK, shotWorth });
console.log("blockK worth   shots H/A   goals H/A  pass%  onT");
for (const g of grid) {
  Object.assign(eng.CFG, base, g);
  const r = run(75, 75, 10);
  console.log(`${g.blockK}    ${g.shotWorth}   ${r.shotsH.toFixed(1)}/${r.shotsA.toFixed(1)}   ${r.goalsH.toFixed(2)}/${r.goalsA.toFixed(2)}  ${r.passPct.toFixed(0)}%  ${r.onT.toFixed(1)}`);
}
Object.assign(eng.CFG, base);
