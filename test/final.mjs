// The full post-calibration scorecard in one run: match stats, spacing, duties, and the rating gap.
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { run } = await import("./mecal.mjs");
const r = run(75, 75, 24);
console.log(`even 75:  shots ${r.shotsH.toFixed(1)}/${r.shotsA.toFixed(1)}  goals ${r.goalsH.toFixed(2)}/${r.goalsA.toFixed(2)}  pass% ${r.passPct.toFixed(0)}  poss ${r.possH.toFixed(0)}%  corners ${r.corners.toFixed(1)}  fouls ${r.fouls.toFixed(1)}  onT ${r.onT.toFixed(1)}  in-play ${r.inplay.toFixed(0)}m  stamina ${r.stam.toFixed(0)}  xG/shot ${(r.xg/((r.shotsH+r.shotsA)/2)).toFixed(3)}`);
console.log("target:   shots 13/13  goals 1.40/1.40  pass% 80  corners 5  fouls 11  onT 4.5  in-play 57m  stamina 70  xG 0.10");
for (const g of [8, 16, 29]) {
  const q = run(75 + g, 75, 12);
  console.log(`gap +${g}:  GD ${(q.goalsH - q.goalsA).toFixed(2)}  shots ${q.shotsH.toFixed(1)}/${q.shotsA.toFixed(1)}   (old engine: +8 1.07, +16 1.98, +29 3.31)`);
}
