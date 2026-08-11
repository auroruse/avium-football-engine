process.env.QUIET = "1";
const { CFG } = await import("./engine.mjs");
const { run } = await import("./mecal.mjs");
console.log("noiseDeg/Skill  elev  gkArm/Dive  shots  goals   onT  save%  conv%   0-5  5-10 10-15 15-20  20+");
console.log("real                                13    1.40   4.5    70%    11%   14%  26%   25%   18%  17%");
for (const [nd, nk, el] of [[3.2,7,0.30],[9,12,0.7],[15,18,1.0]])
for (const [arm, dive] of [[0.75,3.9],[1.35,5.2]]) {
  CFG.shotNoiseDeg = nd; CFG.shotNoiseSkill = nk; CFG.shotElevErr = el;
  CFG.gkArm = arm; CFG.gkDiveV = dive;
  const r = run(75, 75, 12), d = r.dist;
  const sh = (r.shotsH + r.shotsA) / 2, go = (r.goalsH + r.goalsA) / 2;
  const sv = r.onT > 0 ? 100 * (1 - go / r.onT) : 0;
  console.log(`${String(nd).padStart(8)}/${String(nk).padEnd(4)} ${String(el).padStart(4)}  ${String(arm).padStart(5)}/${String(dive).padEnd(4)} ${sh.toFixed(1).padStart(5)}  ${go.toFixed(2).padStart(5)}  ${r.onT.toFixed(1).padStart(4)}  ${sv.toFixed(0).padStart(4)}%  ${(100*go/sh).toFixed(0).padStart(4)}%  ` +
    d.slice(0,4).map(b=>(b.toFixed(0)+"%").padStart(4)).join(" ") + " " + (d.slice(4).reduce((a,b)=>a+b,0).toFixed(0)+"%").padStart(4));
}
