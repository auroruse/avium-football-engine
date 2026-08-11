process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { run } = await import("./mecal.mjs");
const base = { ...eng.CFG };
const CASES = [
  ["base            ", {}],
  ["blockK .6       ", { blockK: 0.6 }],
  ["worth .7        ", { shotWorth: 0.7 }],
  ["blk .6 + wrth .7", { blockK: 0.6, shotWorth: 0.7 }],
  ["blk .9 + wrth .6", { blockK: 0.9, shotWorth: 0.6 }],
];
console.log("case              shots H/A   goals H/A  pass%");
for (const [label, over] of CASES) {
  Object.assign(eng.CFG, base, over);
  const r = run(75, 75, 6);
  console.log(`${label}  ${r.shotsH.toFixed(1)}/${r.shotsA.toFixed(1)}   ${r.goalsH.toFixed(2)}/${r.goalsA.toFixed(2)}  ${r.passPct.toFixed(0)}%`);
}
Object.assign(eng.CFG, base);
