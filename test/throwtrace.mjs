// THROW-INS, ONE ROW EACH (24 November 2026). Every throw in the match, snapshotted the slice it is thrown: the receiver's
// space, the nearest opponent to the ball's line and to where it is aimed, how the taker priced it (mindRestart), then how
// it ended (reached him, cut out, dead) and, if it reached him, whether his side still had it three seconds on and if not
// what lost it. Half the fixtures League One, half the sixteen strongest national sides.
//   LAB_TEST=throwtrace.mjs on the cloud (SHARD=i/n)     THR_N fixtures (400)
//   node test/throwtrace.mjs merge <dir>
import { spawn } from "node:child_process";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const N = +(process.env.THR_N || 400);

if (process.argv[2] === "merge") {
  const dir = process.argv[3], files = fs.readdirSync(dir, { recursive: true }).filter(f => String(f).endsWith(".jsonl")).map(f => path.join(dir, String(f)));
  const R = files.flatMap(f => fs.readFileSync(f, "utf8").split("\n").filter(l => l.startsWith("{")).map(l => JSON.parse(l)));
  const pc = (a, b) => b ? (100 * a / b).toFixed(1) + "%" : "-";
  const cnt = (A, f) => A.filter(f).length;
  const show = (lab, A) => {
    const n = A.length; if (!n) return;
    console.log(`\n== ${lab}: ${n} throws`);
    console.log(`  reached him ${pc(cnt(A, r => r.res === "ok"), n)}   cut out ${pc(cnt(A, r => r.res === "int"), n)}   dead ${pc(cnt(A, r => r.res === "dead"), n)}   still theirs 3 s on ${pc(cnt(A, r => r.kept), n)}`);
    const C = A.filter(r => r.res === "ok" && !r.kept), why = {};
    for (const r of C) why[r.why] = (why[r.why] || 0) + 1;
    console.log(`  reached him, lost inside 3 s: ${pc(C.length, n)} of throws; by: ` + Object.entries(why).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", "));
  };
  console.log(`${R.length} throws from ${files.length} files`);
  show("all", R);
  const band = (r) => r.rFree < 2 ? "receiver marked, under 2 m" : r.rFree < 4 ? "receiver 2-4 m" : r.rFree < 6 ? "receiver 4-6 m" : "receiver 6 m+";
  for (const b of ["receiver 6 m+", "receiver 4-6 m", "receiver 2-4 m", "receiver marked, under 2 m"]) show(b, R.filter(r => band(r) === b));
  const I = R.filter(r => r.res === "int");
  console.log(`\n== the ${I.length} cut out`);
  const q = (A, f, ps = [0.25, 0.5, 0.75]) => { const v = A.map(f).filter(x => x != null && !Number.isNaN(x)).sort((a, b) => a - b); return ps.map(p => v[Math.floor(p * (v.length - 1))]?.toFixed(2)).join(" / "); };
  console.log(`  receiver's nearest man at the throw (m), quartiles ${q(I, r => r.rFree)}`);
  console.log(`  throw length (m) ${q(I, r => r.d)}   against all throws ${q(R, r => r.d)}`);
  console.log(`  flight (s) ${q(I, r => r.T)}`);
  console.log(`  the man who cut it out: from the ball's line at the throw (m) ${q(I, r => r.cutLine)}`);
  console.log(`     from the target (m) ${q(I, r => r.cutAim)}   from the receiver (m) ${q(I, r => r.cutRcv)}   was the receiver's nearest man ${pc(cnt(I, r => r.cutIsMarker), I.length)}`);
  console.log(`     along the path when it was cut out (0 = thrower, 1 = target) ${q(I, r => r.frac)}   ball height then (m) ${q(I, r => r.z)}`);
  console.log(`  receiver at the moment it was cut out: from the target (m) ${q(I, r => r.rcvAim)}   from the ball (m) ${q(I, r => r.rcvBall)}`);
  console.log(`  the taker's own price on it: chance it arrives ${q(I, r => r.ok)}   against all throws ${q(R, r => r.ok)}`);
  console.log(`  priced by the taker ${pc(cnt(R, r => r.pr), R.length)} of all throws; the man aimed at the receiver ${pc(cnt(R, r => r.same), R.length)}`);
  const K = {}; for (const r of I) { const k = `${r.cutPos}`; K[k] = (K[k] || 0) + 1; }
  console.log(`  cut out by: ` + Object.entries(K).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", "));
  const A = R.filter(r => r.res === "ok");
  console.log(`\n== the ${A.length} that reached him: first touch lost ${pc(cnt(A, r => r.ftFail), A.length)}; his nearest man when it arrived (m) ${q(A, r => r.rArr)}`);
  process.exit(0);
}

const [si, sn] = (process.env.SHARD || "0/1").split("/").map(Number);
const mine = []; for (let k = 0; k < N; k++) if (k % sn === si) mine.push(k);

if (process.env.THR_CHILD != null) {
  const [ci, cn] = process.env.THR_CHILD.split("/").map(Number);
  const E = await import("./engine.mjs");
  const nl1 = E.PRESET_CATALOG.filter(t => t.league === "Nichirin League One");
  const nat = E.PRESET_CATALOG.filter(t => t.league === "Avium International" && t.squad?.length).sort((a, b) => b.skill - a.skill).slice(0, 16);
  const pairsOf = (n) => { const p = []; for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) if (a !== b) p.push([a, b]); return p; };
  const P1 = pairsOf(nl1.length), P2 = pairsOf(nat.length);
  const other = (sd) => sd === "home" ? "away" : "home";
  const r2 = (x) => x == null ? null : +x.toFixed(2);

  const play = (hT, aT, seed, lv) => {
    const st = E.createMatchState(); st.brain = 2; st.homeAdv = "home"; st.injuriesOn = true;
    st.players.home = E.meSide(hT); st.players.away = E.meSide(aT);
    st.bench = { home: E.meBench(hT), away: E.meBench(aT) };
    st.subCap = { home: E.subCapFor(st.bench.home), away: E.subCapFor(st.bench.away) };
    st.formations = { home: hT.formation || "4-3-3", away: aT.formation || "4-3-3" };
    st.strategy = { home: E.meStrategyFor(hT), away: E.meStrategyFor(aT) };
    st.fit = { home: E.meFitFor(hT), away: E.meFitFor(aT) };
    st.mgmt = { home: hT.mgmt ?? null, away: aT.mgmt ?? null };
    st.styles = { home: hT.style || "balanced", away: aT.style || "balanced" };
    st.teamSkill = { home: hT.skill, away: aT.skill }; st.possession = "home";
    const rng = new E.RNG(seed >>> 0 || 7); E.meInit(st, E.pitchSlots, rng);
    const out = E.meFreshOut(), mp = () => st.mePos;
    const nearest = (sd, x, y) => { let d = 99, w = null; for (const o of st.players[other(sd)]) if (o && !o.off) { const e = Math.hypot(o.x - x, o.y - y); if (e < d) { d = e; w = o; } } return [d, w]; };
    let lastPick = null, tick = 0, cur = null, ftFailT = -1;
    const live = [];
    globalThis.__shots = [];
    globalThis.__spPick = (sp, pr) => { lastPick = sp.kind === "throw" ? { pr, t: tick } : null; };
    globalThis.__pftk = { push(e) { if (!e.ok) ftFailT = tick; } };
    globalThis.__rx = {};
    globalThis.__pass = (pp, okSide) => { if (cur && pp === cur.pp) { cur.res = okSide === pp.side ? "ok" : okSide == null ? "dead" : "int"; cur.resT = tick; } };
    let prevPP = null, rxT = 0, rxS = 0;
    for (let t = 0; t < E.ME_MATCH_TICKS + E.meAdded(st); t++) {
      out.min = E.meMinute(t); out.add = E.meAddedMin(t); tick = t;
      E.meTick(st, rng, out);
      const m = mp(), pp = m.passPending;
      const tk = (globalThis.__rx.tackle || 0) + (globalThis.__rx.steal || 0), tackled = tk > rxT; rxT = tk;
      // a throw just thrown
      if (pp && pp !== prevPP && pp.rs && pp.k === "throw") {
        const us = st.players[pp.side], q = us[pp.fj];
        const [rFree, mk] = q ? nearest(pp.side, q.x, q.y) : [99, null];
        // the opponent nearest the ball's line, thrower to target
        const lx = pp.ax - pp.sx, ly = pp.ay - pp.sy, L = Math.hypot(lx, ly) || 1;
        let lineD = 99; for (const o of st.players[other(pp.side)]) if (o && !o.off) { const u = Math.max(0, Math.min(1, ((o.x - pp.sx) * lx + (o.y - pp.sy) * ly) / (L * L)));
          lineD = Math.min(lineD, Math.hypot(o.x - (pp.sx + u * lx), o.y - (pp.sy + u * ly))); }
        const pos0 = new Map(); for (const o of st.players[other(pp.side)]) if (o && !o.off) pos0.set(o, [o.x, o.y]);
        cur = { pp, lv, t, d: r2(pp.d), T: r2(E.meLoftT(pp.d, "throw")), rFree: r2(rFree), lineD: r2(lineD), aimOpp: r2(nearest(pp.side, pp.ax, pp.ay)[0]),
                pr: lastPick?.pr ? 1 : 0, ok: r2(lastPick?.pr?.ok), same: lastPick?.pr && lastPick.pr.j === pp.fj ? 1 : 0, rcv: q, mk, pos0, side: pp.side };
      }
      prevPP = pp;
      // how a throw ended, the slice after it resolved: who has it, and where everyone was
      if (cur && cur.res && cur.resT === t && !cur.done1) {
        cur.done1 = 1; const pp0 = cur.pp;
        if (cur.res === "int") {
          const w = m.idx >= 0 && m.side !== cur.side ? st.players[m.side][m.idx] : null, w0 = w ? cur.pos0.get(w) : null;
          const lx = pp0.ax - pp0.sx, ly = pp0.ay - pp0.sy, L = Math.hypot(lx, ly) || 1;
          if (w0) { const u = Math.max(0, Math.min(1, ((w0[0] - pp0.sx) * lx + (w0[1] - pp0.sy) * ly) / (L * L)));
            cur.cutLine = r2(Math.hypot(w0[0] - (pp0.sx + u * lx), w0[1] - (pp0.sy + u * ly))); cur.cutAim = r2(Math.hypot(w0[0] - pp0.ax, w0[1] - pp0.ay));
            const rq = cur.rcv; cur.cutRcv = rq ? r2(Math.hypot(w0[0] - rq.x, w0[1] - rq.y)) : null; cur.cutIsMarker = w === cur.mk ? 1 : 0; cur.cutPos = w.pos; }
          else cur.cutPos = "nobody on it";
          cur.frac = r2(((m.bx - pp0.sx) * lx + (m.by - pp0.sy) * ly) / (L * L)); cur.z = r2(m.bz);
          if (cur.rcv) { cur.rcvAim = r2(Math.hypot(cur.rcv.x - pp0.ax, cur.rcv.y - pp0.ay)); cur.rcvBall = r2(Math.hypot(cur.rcv.x - m.bx, cur.rcv.y - m.by)); }
        }
        if (cur.res === "ok" && cur.rcv) cur.rArr = r2(nearest(cur.side, cur.rcv.x, cur.rcv.y)[0]);
        live.push(cur);
      }
      // three seconds on: still theirs, and if not, the first thing that lost it
      for (const w of live) if (!w.closed) {
        const lost = m.sp ? m.sp.side !== w.side : m.idx >= 0 && m.side !== w.side;
        if (!w.why && w.res === "ok") {
          if (ftFailT === t && t - w.t < 14) { w.ftFail = 1; w.why = "first touch"; }
          else if (lost) w.why = m.sp ? "ball out / foul" : tackled ? "tackle" : (m._looseWhy && m._loose >= w.t) ? m._looseWhy : "his side's next pass cut out";
        }
        if (t - w.t >= 12) { w.closed = 1; w.kept = m.sp ? m.sp.side === w.side : m.idx >= 0 ? m.side === w.side : m.lastSide === w.side; if (w.res === "ok" && !w.kept && !w.why) w.why = "loose, theirs at 3 s"; }
      }
    }
    E.meFinalise(st);
    return live.map(w => { const { pp, rcv, mk, pos0, ...rest } = w; return JSON.stringify(rest); });
  };

  mine.forEach((k, j) => { if (j % cn !== ci) return;
    const lv = k % 2 === 0 ? "NL1" : "NT", h = k >> 1, T = lv === "NL1" ? nl1 : nat, P = lv === "NL1" ? P1 : P2;
    const [a, b] = P[(h * (lv === "NL1" ? 319 : 239)) % P.length];
    for (const line of play(T[a], T[b], 91e5 + k * 7919 + 13, lv)) console.log(line);
  });
  process.exit(0);
}

const W = Math.max(1, +(process.env.THR_W || availableParallelism()));
await Promise.all(Array.from({ length: W }, (_, i) => new Promise((res, rej) => {
  const c = spawn("node", [fileURLToPath(import.meta.url)], { env: { ...process.env, THR_CHILD: `${i}/${W}` }, stdio: ["ignore", "pipe", "inherit"] });
  c.stdout.on("data", (b) => process.stdout.write(b));
  c.on("exit", (code) => code === 0 ? res() : rej(new Error("child " + i + " exit " + code)));
})));
