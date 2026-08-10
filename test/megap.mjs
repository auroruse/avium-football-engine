// The reason for the whole rewrite: does a rating gap still turn into a rout? Old engine at +29 was
// 95% wins and 3.31 GD, with the gap charged three separate times. Here it is charged nowhere -- it
// only shows up as better players winning more duels.
import { run } from "./mecal.mjs";
console.log("gap   goals H/A      GD    shots H/A     poss%");
for (const g of [0, 4, 8, 12, 16, 20, 29]) {
  const r = run(75 + g, 75, 24);
  console.log(`+${String(g).padEnd(3)} ${r.goalsH.toFixed(2)}/${r.goalsA.toFixed(2)}    ${(r.goalsH-r.goalsA).toFixed(2).padStart(5)}   ${r.shotsH.toFixed(1)}/${r.shotsA.toFixed(1)}    ${r.possH.toFixed(0)}%`);
}
