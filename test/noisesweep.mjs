process.env.QUIET = "1"; process.env.SWEEP = "1";
const { CFG } = await import("./engine.mjs");
const { curve } = await import("./gkcurve.mjs");
console.log("deg skill elev |  conversion at 4m  8m  12m  16m  20m  25m  | on target");
console.log("real            |            70%  35%  18%  10%   7%   4%  |      ~45%");
for (const [d, k, e] of [[3.2,7,0.30],[8,10,0.5],[12,14,0.7],[16,18,0.9],[20,22,1.1]]) {
  CFG.shotNoiseDeg = d; CFG.shotNoiseSkill = k; CFG.shotElevErr = e;
  const res = curve(120);
  const on = res.reduce((a,c)=>a+c.goals+c.saved,0), tot = res.reduce((a,c)=>a+c.shots,0);
  console.log(`${String(d).padStart(3)} ${String(k).padStart(5)} ${String(e).padStart(4)} |  ` +
    res.map(c=>(100*c.goals/c.shots).toFixed(0).padStart(4)+"%").join(" ") + `  |     ${(100*on/tot).toFixed(0)}%`);
}
