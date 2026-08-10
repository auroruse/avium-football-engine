// Both halves of the trade in one place: what a uniform team gap is worth, and what a keeper is
// worth. The keeper is measured WITHOUT compensating the outfield -- gkiso pins the XI mean, which
// means a better keeper is paid for with a worse defence that concedes more shots, and the two
// effects cancel. Here the ten in front of him never move, so whatever changes is him.
const { RNG, simInstantMatch, buildSquad } = await import(process.env.ENG || "./engine.mjs");
const sq = (ovr, gk) => buildSquad("4-3-3", null).map((p, i) => ({ ...p, name: p.pos + i, stamina: 100,
  ovr: (p.spos || p.pos) === "GK" ? (gk ?? ovr) : ovr }));
const run = (N, H, A, hGk, aGk) => { const rng = new RNG(11); let w = 0, gd = 0, ga = 0;
  for (let i = 0; i < N; i++) { const r = simInstantMatch(rng, H, A, null, "balanced", "balanced", 0, 0, 0, null, null, sq(H, hGk), sq(A, aGk));
    if (r.ftHome > r.ftAway) w++; gd += r.ftHome - r.ftAway; ga += r.ftAway; }
  return { win: 100 * w / N, gd: gd / N, ga: ga / N }; };
const N = +(process.env.N || 3000);
const g = [8, 16, 29].map(k => { const r = run(N, 80 + k, 80); return `+${k} ${r.win.toFixed(0)}%/${r.gd.toFixed(2)}`; });
const lo = run(N, 70, 70, 50), hi = run(N, 70, 70, 99);
console.log(`${(process.env.TAG||"").padEnd(22)} gap ${g.join("  ")}   |  GK 50->99 GA ${lo.ga.toFixed(3)}->${hi.ga.toFixed(3)} (${(lo.ga-hi.ga).toFixed(2)} saved)`);
