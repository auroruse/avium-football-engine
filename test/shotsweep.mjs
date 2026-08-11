// Nobody shoots from range. Carrying is credited with 8 m of progress per DECISION while the man
// actually covers 1.5 m in a slice, so running at goal always outscores striking it. Sweep the two.
process.env.QUIET = "1";
const { CFG } = await import("./engine.mjs");
const { run } = await import("./mecal.mjs");
console.log("carryAdv  shotWorth  shots  goals  onT  xG/shot   distance bands 0-5 5-10 10-15 15-20 20-25 25+");
for (const ca of [8, 3, 1.5]) for (const sw of [0.6, 1.2, 2.0, 3.0]) {
  CFG.carryAdv = ca; CFG.shotWorth = sw;
  const r = run(75, 75, 14);
  const d = r.dist;
  const far = d.slice(5).reduce((a, b) => a + b, 0);
  console.log(`${String(ca).padStart(7)} ${String(sw).padStart(9)}  ${((r.shotsH+r.shotsA)/2).toFixed(1).padStart(5)}  ${((r.goalsH+r.goalsA)/2).toFixed(2).padStart(5)}  ${r.onT.toFixed(1).padStart(4)}  ${(r.xg/r.shotsH).toFixed(3).padStart(6)}   ` +
              d.slice(0, 5).map(b => (b.toFixed(0) + "%").padStart(5)).join(" ") + " " + (far.toFixed(0) + "%").padStart(5));
}
console.log("real:                     13    1.40   4.5   0.100     ~14%  ~26%  ~25%  ~18%  ~10%   ~7%");
