// THREE COMPLAINTS FROM THE STAND, MEASURED BEFORE ANYTHING IS TOUCHED.
//
//   1. HE LEAVES THE MAN ON THE BALL. A defender engaged with the carrier turns and goes to mark
//      somebody else while the carrier still has it. There is supposed to be a HANDOVER: the man on
//      him does not leave until his replacement is actually there. meDuties re-solves every job from
//      scratch every tick, and the only thing protecting the presser is a 1.45x distance hysteresis
//      that compares a euclidean distance against a time-scaled one. Measured: how often the presser
//      changes hands while the carrier is unchanged, how close the OLD presser was, and how far away
//      the NEW one was at the instant of the switch.
//
//   2. HE DRAGS IT BY HIS SIDE. hitBodies shepherds the ball along _drbA, allowed up to touchOffWide
//      degrees off the line the man is actually running -- 180 at walking pace, tightening to 30 only
//      at 6 m/s. Measured: the angle between the ball and his direction of travel, every carried
//      slice. And the other half of the complaint, men gravitating slowly around the ball: the speed
//      of everybody who is NOT the carrier but is inside 12 m of it.
//
//   3. THROUGH BALLS ARE UNDERSTRUCK OR OVERRUN. Every pass flagged thru is followed from the strike
//      to whoever ends up with it. Understruck is the ball dying short of the aim point; overrun is
//      the receiver crossing it before the ball gets there. Measured along the pass line, in metres.
//
//   node test/handover.mjs
process.env.QUIET = "1";
import { parMap } from "./par.mjs";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meDir, meOther,
        ME_MATCH_TICKS, ME_DT, PITCH_W, STRAT_DEF, meGoalX } = eng;

const sq = (o, f) => buildSquad(f, null).map((p, i) => ({ ...p, name: p.pos + i, ovr: o,
  stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0, xgS: { home: 0, away: 0 } });

const N = +(process.env.N || 24);

function run(seed) {
  const s = createMatchState();
  const hs = sq(75, "4-3-3"), as = sq(75, "4-3-3");
  s.players.home = hs.filter(p => !p.bench); s.bench.home = hs.filter(p => p.bench);
  s.players.away = as.filter(p => !p.bench); s.bench.away = as.filter(p => p.bench);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  const A = { rel: 0, relEng: 0, relEngGap: [], relEngOld: [], relTo: {}, pressN: 0, pressD: [],
              after: [], drift: [], freed: 0, afterN: 0, relN: {}, relDepth: [], nPress: {},
              recv: 0, recvMk: 0, recvStay: 0, recvOther: 0, recvGap: [], recvTo: {},
              carry: 0, side60: 0, side120: 0, carrySpd: [], ballAng: [],
              near: 0, nearSlow: 0, nearSpd: [],
              thru: 0, thruOwn: 0, thruOpp: 0, thruDead: 0, along: [], miss: [],
              alongOwn: [], alongOpp: [], vAim: [], rcvAt: [], overrun: 0, short: 0, aimD: [] };
  // per side: who was pressing last tick, and who had the ball
  const prev = { home: [], away: [] };
  const watch = [];                                     // releases still being followed
  const mkPrev = { home: [], away: [] };                // who each defender was marking last tick
  const rwatch = [];
  let lastCarrier = null;
  let live = null;                                      // a through ball in flight
  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos;
    const pend0 = mp.passPending;
    meTick(s, rng, out);
    if (mp.sp) { prev.home = []; prev.away = []; lastCarrier = null; live = null; continue; }

    // ---------- 1b. THE MAN WHO WAS MARKING HIM. The carrier is excluded from the threat list, so
    // the instant an attacker receives the ball his marker's _mk is gone and the Hungarian hands
    // him a DIFFERENT attacker. That is the complaint word for word: he left the man with the ball
    // to mark somebody else. Whether it matters depends on whether the press block gives that same
    // defender the ball back, so both are followed for a second.
    const carrier = mp.idx >= 0 ? `${mp.side}:${mp.idx}` : null;
    if (carrier && carrier !== lastCarrier && mp.idx >= 0) {
      const def = meOther(mp.side);
      for (let i = 0; i < s.players[def].length; i++)
        if (mkPrev[def][i] === mp.idx) rwatch.push({ side: def, i, carrier, t: 4,
          d0: Math.hypot(s.players[def][i].x - s.players[mp.side][mp.idx].x,
                         s.players[def][i].y - s.players[mp.side][mp.idx].y) });
      A.recv++;
      if (mkPrev[def].some(v => v === mp.idx)) A.recvMk++;
    }
    for (let w = rwatch.length - 1; w >= 0; w--) {
      const it = rwatch[w];
      if (--it.t > 0) continue;
      rwatch.splice(w, 1);
      if (`${mp.side}:${mp.idx}` !== it.carrier) continue;
      const p2 = s.players[it.side][it.i], c2 = s.players[mp.side][mp.idx];
      if (!p2 || p2.off) continue;
      A.recvTo[p2._duty] = (A.recvTo[p2._duty] || 0) + 1;
      if (p2._duty === "press") A.recvStay++;
      else if (p2._duty === "mark" && p2._mk >= 0) A.recvOther++;
      A.recvGap.push(Math.hypot(p2.x - c2.x, p2.y - c2.y) - it.d0);
    }
    // A HANDOVER IS ONLY GOOD IF SOMEBODY IS STILL ON HIM A SECOND LATER. The instant comparison
    // flatters it: the man who "takes over" may be a marker whose duty flipped and who is running
    // the other way. Each release is followed for four slices.
    for (let w = watch.length - 1; w >= 0; w--) {
      const it = watch[w];
      if (--it.t > 0) continue;
      watch.splice(w, 1);
      if (`${mp.side}:${mp.idx}` !== it.carrier) continue;   // he no longer has it: not our question
      const c2 = s.players[mp.side][mp.idx];
      const p2 = s.players[it.side][it.i];
      let g2 = Infinity;
      for (const q2 of s.players[it.side])
        if (!q2.off && q2.pos !== "GK") g2 = Math.min(g2, Math.hypot(q2.x - c2.x, q2.y - c2.y));
      A.afterN++; A.after.push(g2);
      if (g2 > 4) A.freed++;
      if (p2 && !p2.off) A.drift.push(Math.hypot(p2.x - c2.x, p2.y - c2.y) - it.d0);
    }
    for (const side of ["home", "away"]) {
      const us = s.players[side];
      const now = us.map((p, i) => (p._duty === "press" && !p.off ? i : -1)).filter(i => i >= 0);
      if (carrier && carrier === lastCarrier && mp.side === meOther(side)) {
        const c = s.players[mp.side][mp.idx];
        for (const i of prev[side]) {
          if (now.includes(i)) continue;
          const p = us[i];
          if (!p || p.off || p._beat > 0) continue;      // beaten is a legitimate reason to leave
          A.rel++;
          const dOld = Math.hypot(p.x - c.x, p.y - c.y);
          A.relTo[p._duty] = (A.relTo[p._duty] || 0) + 1;
          // Was he actually ON him? Four metres is jockeying distance.
          if (dOld < 4) {
            A.relEng++;
            // WHY did he lose it? Either the job moved to somebody else (a swap), or the side simply
            // has fewer men on the ball than it did (an extra presser being withdrawn).
            A.relN[`${prev[side].length}->${now.length}`] = (A.relN[`${prev[side].length}->${now.length}`] || 0) + 1;
            A.relDepth.push((mp.bx - meGoalX(mp.side)) * meDir(side) * -1);
            A.relEngOld.push(dOld);
            let g = Infinity;
            for (const j of now) g = Math.min(g, Math.hypot(us[j].x - c.x, us[j].y - c.y));
            A.relEngGap.push(g === Infinity ? 99 : g);
            watch.push({ side, i, carrier, d0: dOld, t: 4 });
          }
        }
        // ...and how close the man on the job actually is, every slice.
        A.nPress[now.length] = (A.nPress[now.length] || 0) + 1;
        if (now.length) {
          A.pressN++;
          let g = Infinity;
          for (const j of now) g = Math.min(g, Math.hypot(us[j].x - c.x, us[j].y - c.y));
          A.pressD.push(g);
        }
      }
      prev[side] = now;
      mkPrev[side] = us.map(p => (p._duty === "mark" ? p._mk : -1));
    }
    lastCarrier = carrier;

    // ---------- 2. THE BALL BY HIS SIDE, AND THE SLOW ORBIT
    if (mp.idx >= 0) {
      const c = s.players[mp.side][mp.idx];
      const vs = Math.hypot(c.vx || 0, c.vy || 0) / ME_DT;
      if (vs > 1.0) {
        const rx = mp.bx - c.x, ry = mp.by - c.y, rd = Math.hypot(rx, ry);
        if (rd > 0.15) {
          const ang = Math.abs(Math.atan2((c.vx / vs / ME_DT) * ry - (c.vy / vs / ME_DT) * rx,
                                          (c.vx / vs / ME_DT) * rx + (c.vy / vs / ME_DT) * ry)) * 180 / Math.PI;
          A.carry++; A.ballAng.push(ang); A.carrySpd.push(vs);
          if (ang > 60) A.side60++;
          if (ang > 120) A.side120++;
        }
      }
      for (const sd of ["home", "away"]) for (let i = 0; i < s.players[sd].length; i++) {
        const q = s.players[sd][i];
        if (q.off || q.pos === "GK" || (sd === mp.side && i === mp.idx)) continue;
        if (Math.hypot(q.x - mp.bx, q.y - mp.by) > 12) continue;
        const v = Math.hypot(q.vx || 0, q.vy || 0) / ME_DT;
        A.near++; A.nearSpd.push(v);
        if (v < 1.5) A.nearSlow++;
      }
    }

    // ---------- 3. THE THROUGH BALL
    if (!pend0 && mp.passPending && mp.passPending.thru) {
      const evt = out.evt;
      live = { side: mp.passPending.side, j: mp.fj, ax: evt ? evt.x1 : mp.bx, ay: evt ? evt.y1 : mp.by,
               x0: mp.bx, y0: mp.by, best: Infinity, nearAim: Infinity, vAim: 0, rcvAt: null };
    }
    if (live) {
      const q = live.j >= 0 ? s.players[live.side][live.j] : null;
      if (q) live.best = Math.min(live.best, Math.hypot(q.x - mp.bx, q.y - mp.by));
      // THE MOMENT THE BALL IS AT THE AIM POINT. That is the appointment the pass was solved for:
      // ball and man are meant to arrive together. How fast it is going then says whether it was
      // struck hard enough, and where the receiver is ALONG the pass line says whether he is still
      // running onto it or has already gone past the spot.
      {
        const dAim = Math.hypot(mp.bx - live.ax, mp.by - live.ay);
        if (dAim < live.nearAim) {
          live.nearAim = dAim;
          live.vAim = Math.hypot(mp.bvx, mp.bvy);
          if (q) {
            const ux = live.ax - live.x0, uy = live.ay - live.y0, ul = Math.hypot(ux, uy) || 1;
            live.rcvAt = ((q.x - mp.bx) * ux + (q.y - mp.by) * uy) / ul;
          }
        }
      }
      const settled = mp.idx >= 0 || !mp.flight;
      if (settled || mp.sp) {
        A.thru++;
        const ux = live.ax - live.x0, uy = live.ay - live.y0, ul = Math.hypot(ux, uy) || 1;
        // Where the ball ended up ALONG the pass line, relative to the aim point.
        const al = ((mp.bx - live.ax) * ux + (mp.by - live.ay) * uy) / ul;
        A.along.push(al);
        A.miss.push(live.best === Infinity ? 99 : live.best);
        A.vAim.push(live.vAim);
        A.aimD.push(ul);
        if (live.rcvAt !== null) {
          A.rcvAt.push(live.rcvAt);
          if (live.rcvAt > 2) A.overrun++;        // he was already 2 m past the ball
          if (live.rcvAt < -4) A.short++;         // still 4 m behind it
        }
        if (mp.sp) A.thruDead++;
        else if (mp.side === live.side) { A.thruOwn++; A.alongOwn.push(al); }
        else { A.thruOpp++; A.alongOpp.push(al); }
        live = null;
      }
    }
  }
  return A;
}

const res = await parMap(Array.from({ length: N }, (_, i) => i + 1), run);
if (!res) process.exit(0);
const S = (k) => res.reduce((a, r) => a + r[k], 0);
const cat = (k) => res.flatMap(r => r[k]);
const f1 = (x) => x.toFixed(1);
const q = (a, p) => { const b = [...a].sort((x, y) => x - y);
  return b.length ? b[Math.min(b.length - 1, Math.floor(b.length * p))] : 0; };
const pc = (n, d) => f1(100 * n / (d || 1)) + "%";

console.log(`\n${N} matches.\n`);
console.log(`  1. LEAVING THE MAN ON THE BALL                                    real`);
console.log(`    presser changed hands, same carrier   ${f1(S("rel") / N)} a match`);
console.log(`    ...he was INSIDE 4 m of him           ${f1(S("relEng") / N)} a match      ~0`);
console.log(`       his distance when he left          ${f1(q(cat("relEngOld"), 0.5))} m`);
console.log(`       the REPLACEMENT's distance         ${f1(q(cat("relEngGap"), 0.5))} m   p90 ${f1(q(cat("relEngGap"), 0.9))} m`);
console.log(`       replacement further out than him   ${pc(cat("relEngGap").filter((g, i) => g > cat("relEngOld")[i]).length, cat("relEngGap").length)}`);
console.log(`    what he went off to do:`);
for (const [k, v] of Object.entries(res.reduce((a, r) => {
  for (const [x, y] of Object.entries(r.relTo)) a[x] = (a[x] || 0) + y; return a; }, {}))
  .sort((a, b) => b[1] - a[1]))
  console.log(`      ${k.padEnd(10)} ${pc(v, S("rel"))}`);
console.log(`    A SECOND LATER, still the same carrier:`);
console.log(`      nearest defender of ANY duty to him ${f1(q(cat("after"), 0.5))} m   p90 ${f1(q(cat("after"), 0.9))} m`);
console.log(`      nobody inside 4 m                  ${pc(S("freed"), S("afterN"))}          ~0%`);
console.log(`      the man who left is now this much  ${f1(q(cat("drift"), 0.5))} m further off  p90 ${f1(q(cat("drift"), 0.9))}`);
console.log(`    pressers before -> after, engaged releases:`);
for (const [k, v] of Object.entries(res.reduce((a, r) => { for (const [x, y] of Object.entries(r.relN)) a[x] = (a[x] || 0) + y; return a; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6))
  console.log(`      ${k.padEnd(8)} ${pc(v, S("relEng"))}`);
console.log(`    how many men are on the ball:`);
for (const [k, v] of Object.entries(res.reduce((a, r) => { for (const [x, y] of Object.entries(r.nPress)) a[x] = (a[x] || 0) + y; return a; }, {})).sort())
  console.log(`      ${k} ${pc(v, Object.values(res.reduce((a, r) => { for (const [x, y] of Object.entries(r.nPress)) a[x] = (a[x] || 0) + y; return a; }, {})).reduce((a, b) => a + b, 0))}`);
console.log(`    ball depth at an engaged release      ${f1(q(cat("relDepth"), 0.5))} m`);
console.log(`    THE MAN WHO WAS MARKING THE RECEIVER`);
console.log(`      receptions with a marker on him    ${pc(S("recvMk"), S("recv"))}  (${f1(S("recvMk") / N)} a match)`);
console.log(`      a second later he is pressing him  ${pc(S("recvStay"), S("recvMk"))}`);
console.log(`      ...marking somebody ELSE           ${pc(S("recvOther"), S("recvMk"))}          ~0%`);
console.log(`      his distance to the carrier moved  ${f1(q(cat("recvGap"), 0.5))} m   p90 ${f1(q(cat("recvGap"), 0.9))} m`);
for (const [k, v] of Object.entries(res.reduce((a, r) => { for (const [x, y] of Object.entries(r.recvTo)) a[x] = (a[x] || 0) + y; return a; }, {})).sort((a, b) => b[1] - a[1]))
  console.log(`      ${k.padEnd(10)} ${pc(v, S("recvMk"))}`);
console.log(`    nearest presser to the carrier        ${f1(q(cat("pressD"), 0.5))} m   p90 ${f1(q(cat("pressD"), 0.9))} m   1-3 m`);

console.log(`\n  2. THE BALL BY HIS SIDE`);
console.log(`    angle ball-to-man vs his direction    p50 ${f1(q(cat("ballAng"), 0.5))}°  p90 ${f1(q(cat("ballAng"), 0.9))}°   0-25°`);
console.log(`    beside him  (>60°)                    ${pc(S("side60"), S("carry"))}          <10%`);
console.log(`    behind him  (>120°)                   ${pc(S("side120"), S("carry"))}          ~0%`);
console.log(`    carrier's speed                       ${f1(q(cat("carrySpd"), 0.5))} m/s`);
console.log(`    MEN WITHIN 12 m OF THE BALL`);
console.log(`    their speed                           p50 ${f1(q(cat("nearSpd"), 0.5))}  p90 ${f1(q(cat("nearSpd"), 0.9))} m/s`);
console.log(`    walking (<1.5 m/s)                    ${pc(S("nearSlow"), S("near"))}          20-35%`);

console.log(`\n  3. THROUGH BALLS`);
console.log(`    played                                ${f1(S("thru") / N)} a match`);
console.log(`    reached our own man                   ${pc(S("thruOwn"), S("thru"))}          45-60%`);
console.log(`    theirs                                ${pc(S("thruOpp"), S("thru"))}`);
console.log(`    out of play / stoppage                ${pc(S("thruDead"), S("thru"))}`);
console.log(`    length of the pass                    p50 ${f1(q(cat("aimD"), 0.5))} m`);
console.log(`    ball settled vs the aim point         p10 ${f1(q(cat("along"), 0.1))}  p50 ${f1(q(cat("along"), 0.5))}  p90 ${f1(q(cat("along"), 0.9))} m`);
console.log(`      when OUR man got it                 p10 ${f1(q(cat("alongOwn"), 0.1))}  p50 ${f1(q(cat("alongOwn"), 0.5))}`);
console.log(`      when THEY got it                    p10 ${f1(q(cat("alongOpp"), 0.1))}  p50 ${f1(q(cat("alongOpp"), 0.5))}`);
console.log(`    ball's speed as it passed the aim     p10 ${f1(q(cat("vAim"), 0.1))}  p50 ${f1(q(cat("vAim"), 0.5))} m/s   solved for ${eng.CFG.passArrive}`);
console.log(`    RECEIVER, along the line, at that moment`);
console.log(`      p10 ${f1(q(cat("rcvAt"), 0.1))}   p50 ${f1(q(cat("rcvAt"), 0.5))}   p90 ${f1(q(cat("rcvAt"), 0.9))} m   0 = level with it`);
console.log(`      already past the ball (>2 m)        ${pc(S("overrun"), cat("rcvAt").length)}`);
console.log(`      still trailing it (>4 m behind)     ${pc(S("short"), cat("rcvAt").length)}`);
console.log(`    closest the receiver ever got to it   p50 ${f1(q(cat("miss"), 0.5))}  p90 ${f1(q(cat("miss"), 0.9))} m   0-1 m`);
