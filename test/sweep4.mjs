process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { run } = await import("./mecal.mjs");
const base = { ...eng.CFG };
const CASES = [
  ["base               ", {}],
  ["blk .6             ", { blockK: 0.6 }],
  ["blk .6  wrth .75   ", { blockK: 0.6, shotWorth: 0.75 }],
  ["blk .6  xgK .165   ", { blockK: 0.6, xgK: 0.165 }],
  ["blk .6 wrth.75 xgK.165", { blockK: 0.6, shotWorth: 0.75, xgK: 0.165 }],
  ["+ passNoiseDeg 4.5 ", { blockK: 0.6, shotWorth: 0.75, xgK: 0.165, passNoiseDeg: 4.5 }],
];
console.log("case                    shots H/A   goals H/A  pass%  corners onT");
for (const [label, over] of CASES) {
  Object.assign(eng.CFG, base, over);
  const r = run(75, 75, 16);
  console.log(`${label.padEnd(24)}${((r.shotsH+r.shotsA)/2).toFixed(1)}   ${((r.goalsH+r.goalsA)/2).toFixed(2)}   ${r.passPct.toFixed(0)}%  ${r.corners.toFixed(1)}  ${r.onT.toFixed(1)}`);
}
Object.assign(eng.CFG, base);
