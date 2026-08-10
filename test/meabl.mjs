import { run } from "./mecal.mjs";
const r = run(95, 75, 24);
console.log(`GD ${(r.goalsH-r.goalsA).toFixed(2).padStart(5)}   shots ${r.shotsH.toFixed(1)}/${r.shotsA.toFixed(1)}`);
