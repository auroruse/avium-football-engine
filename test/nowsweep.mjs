process.env.QUIET="1";
const { CFG } = await import("./engine.mjs");
const { run } = await import("./mecal.mjs");
console.log("shotNowW | shots  goals  conv   0-5  5-10 10-15 15-20 20-25  25m+");
console.log("real          13    1.4   11%   14%   26%   25%   18%   10%    7%");
for (const w of [0, 1.2, 2.4, 4.0, 6.0]) {
  CFG.shotNowW = w;
  const r = run(75, 75, 12), d = r.dist;
  const sh = (r.shotsH + r.shotsA) / 2, go = (r.goalsH + r.goalsA) / 2;
  console.log(`${String(w).padStart(8)} | ${sh.toFixed(1).padStart(5)} ${go.toFixed(2).padStart(6)} ${(100*go/sh).toFixed(0).padStart(4)}%  ` +
    d.slice(0,6).map(b=>(b.toFixed(0)+"%").padStart(5)).join(" "));
}
