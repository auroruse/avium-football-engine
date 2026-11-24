// How the referee and the touchlines actually move, over whole matches (engine/referee.ts, engine/touchline.ts).
import * as eng from "./engine.mjs";
const { createMatchState, meSide, meBench, meStrategyFor, meFitFor, RNG, meInit, pitchSlots, meFreshOut, meTick, meMinute, meAddedMin,
        ME_MATCH_TICKS, meAdded, meTlInit, meTlStep, ME_DT, CFG, PITCH_L } = eng;
import fs from "node:fs";
const pool = JSON.parse(fs.readFileSync(new URL("./golden-teams.json", import.meta.url), "utf8"));
const N = +(process.argv[2] || 6);
const A = { n: 0, dBall: [], dMan: [], sp: [], acc: [], jump: 0, inBox: 0, lane: 0, close: 0, vclose: 0, bclose: 0, open: 0,
            arErr: [], arSp: [], arJump: 0, coJump: 0, coOut: 0, shouts: 0, flags: {}, tags: {} };
for (let k = 0; k < N; k++) {
  const hT = pool[k % pool.length], aT = pool[(k * 7 + 3) % pool.length], st = createMatchState();
  st.brain = 2; st.homeAdv = "home"; st.injuriesOn = true;
  st.players.home = meSide(hT); st.players.away = meSide(aT);
  st.bench = { home: meBench(hT), away: meBench(aT) };
  st.subCap = { home: 5, away: 5 };
  st.formations = { home: hT.formation || "4-3-3", away: aT.formation || "4-3-3" };
  st.strategy = { home: meStrategyFor(hT), away: meStrategyFor(aT) };
  st.fit = { home: meFitFor(hT), away: meFitFor(aT) };
  st.mgmt = { home: hT.mgmt ?? null, away: aT.mgmt ?? null };
  st.styles = { home: hT.style || "balanced", away: aT.style || "balanced" };
  st.teamSkill = { home: hT.skill, away: aT.skill };
  st.possession = "home";
  const rng = new RNG(1000 + k * 7919); meInit(st, pitchSlots, rng);
  const out = meFreshOut(); let tl = null, pv = [0, 0];
  for (let t = 0; t < ME_MATCH_TICKS + meAdded(st); t++) {
    out.min = meMinute(t); out.add = meAddedMin(t); meTick(st, rng, out);
    tl = tl || meTlInit(st, out); meTlStep(st, out, tl);
    const mp = st.mePos, r = mp.ref; A.n++;
    const v = Math.hypot(r.x - r._px, r.y - r._py) / ME_DT; A.sp.push(v);
    A.acc.push(Math.hypot(r.vx - pv[0], r.vy - pv[1]) / ME_DT); pv = [r.vx, r.vy];
    if (v > 8) A.jump++;
    if (!mp.sp) { A.open++; A.dBall.push(Math.hypot(r.x - mp.bx, r.y - mp.by)); }
    let dm = 99; for (const sd of ["home", "away"]) for (const q of st.players[sd]) if (q && !q.off) dm = Math.min(dm, Math.hypot(q.x - r.x, q.y - r.y));
    A.dMan.push(dm); if (dm < 1.2) A.close++; if (dm < 0.8) { A.vclose++; const kk = mp.sp ? mp.sp.kind : "open"; (A.where = A.where || {})[kk] = (A.where[kk] || 0) + 1; }
    { const kk = mp.sp ? mp.sp.kind : "open"; (A.ph = A.ph || {})[kk] = (A.ph[kk] || 0) + 1; }
    if ((mp.bz ?? 0) < 2 && Math.hypot(r.x - mp.bx, r.y - mp.by) < 1.5) A.bclose++;
    if (Math.abs(r.y - 34) < CFG.boxHalfW && (r.x < CFG.gkBoxR || r.x > PITCH_L - CFG.gkBoxR) && mp.sp?.kind !== "penalty") A.inBox++;
    tl.ar.forEach((a, i) => { const atk = (i === 0) === !!mp.h2 ? "home" : "away", line = eng.meOffsideLine(st, atk), tgt = atk === "away" ? Math.min(line, Math.max(0, mp.bx)) : Math.max(line, Math.min(105, mp.bx));
      if (!mp.sp) A.arErr.push(Math.abs(a.x - tgt)); const av = Math.hypot(a.x - a._px, a.y - a._py) / ME_DT; A.arSp.push(av); if (av > 7.2) A.arJump++;
      if (a.fk && a.ft === 10) A.flags[a.fk] = (A.flags[a.fk] || 0) + 1; });
    for (const sd of ["home", "away"]) { const c = tl.co[sd]; if (Math.hypot(c.x - c._px, c.y - c._py) / ME_DT > 2.6) A.coJump++;
      const cx = 52.5 + (sd === "home" ? -1 : 1) * CFG.subEnterX; if (Math.abs(c.x - cx) > 4.4 || c.y < 68.9 || c.y > 69.6) A.coOut++;
      if (c.sh === 11) { A.shouts++; A.tags[c.tag || "(protest)"] = (A.tags[c.tag || "(protest)"] || 0) + 1; } }
  }
}
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1); };
const pct = (n, d) => (100 * n / d).toFixed(2) + "%";
console.log(`matches ${N}, slices ${A.n}`);
console.log(`REFEREE  from the ball in open play: median ${q(A.dBall, .5)} m, 10th ${q(A.dBall, .1)}, 90th ${q(A.dBall, .9)}, furthest ${q(A.dBall, .999)}`);
console.log(`         nearest player: median ${q(A.dMan, .5)} m, 1st pct ${q(A.dMan, .01)}; within 1.2 m ${pct(A.close, A.n)}, within 0.8 m ${pct(A.vclose, A.n)}`);
console.log(`         on top of the ball (1.5 m, ball low): ${pct(A.bclose, A.n)}; in a penalty area: ${pct(A.inBox, A.n)}`);
console.log(`         speed: median ${q(A.sp, .5)} m/s, 90th ${q(A.sp, .9)}, top ${q(A.sp, .9999)}; slices over 8 m/s: ${A.jump}; hardest turn ${q(A.acc, .9999)} m/s2`);
console.log("         within 0.8 m of a man, by phase:", A.where, "slices by phase:", A.ph);
console.log(`ASSISTANTS off the line in open play: median ${q(A.arErr, .5)} m, 90th ${q(A.arErr, .9)}; top speed ${q(A.arSp, .9999)}; slices over 7.2 m/s: ${A.arJump}; flags per match`, Object.fromEntries(Object.entries(A.flags).map(([k, v]) => [k, +(v / N).toFixed(1)])));
console.log(`COACHES  slices over 2.6 m/s: ${A.coJump}; outside his area: ${A.coOut}; shouts per match ${(A.shouts / N).toFixed(1)}`, A.tags);
