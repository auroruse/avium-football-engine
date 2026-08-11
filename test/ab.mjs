// Which Phase-3 mechanism is hurting? CFG is live, so switch each off in place and measure.
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { run } = await import("./mecal.mjs");
const base = { ...eng.CFG };
const CASES = [
  ["all on", {}],
  ["trap off", { trapStart: 0, trapStartOff: 0 }],
  ["mark component off", { defK: 0 }],
  ["hunt off", { huntBase: -100 }],
  ["all three off", { trapStart: 0, trapStartOff: 0, defK: 0, huntBase: -100 }],
];
console.log("case                shots H/A   goals H/A   pass%");
for (const [label, over] of CASES) {
  Object.assign(eng.CFG, base, over);
  const r = run(75, 75, 12);
  console.log(`${label.padEnd(20)}${r.shotsH.toFixed(1)}/${r.shotsA.toFixed(1)}   ${r.goalsH.toFixed(2)}/${r.goalsA.toFixed(2)}   ${r.passPct.toFixed(0)}%`);
}
Object.assign(eng.CFG, base);
