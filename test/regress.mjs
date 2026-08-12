// One command, every invariant that has ever broken silently in this engine.
//
// The scorecard alone is not enough: three separate times a change moved shots and goals in the
// right direction while quietly wrecking something you can only see by watching -- passes that never
// left the passer's feet, a keeper pinned at 30% of his pace, a carrier who could not legally dribble
// forwards. Each of those is a line here now, with the range it has to sit in.
process.env.QUIET = "1";
const eng = await import("./engine.mjs");
const { RNG, buildSquad, createMatchState, pitchSlots, meInit, meTick, meDecide, meOffsideLine,
        meDir, meGoalX, ME_TPM, ME_MATCH_TICKS, STRAT_DEF, CFG, PITCH_L, PITCH_W, ME_HALF_W } = eng;

// The full eighteen, not just the XI: without a bench nobody can be substituted, so a regression
// that filters it out is testing a match that cannot happen.
const squad = (o) => buildSquad("4-3-3", null)
  .map((p, i) => ({ ...p, name: p.pos + i, ovr: o, stamina: 100, rating: 6.5, atkW: p.atkW ?? 0.5, _att: null }));
const sq = (o) => squad(o).filter(p => !p.bench);
const blank = () => ({ poss:{home:0,away:0}, shots:{home:0,away:0}, goals:{home:0,away:0},
  onTarget:{home:0,away:0}, saves:{home:0,away:0}, corners:{home:0,away:0}, fouls:{home:0,away:0},
  passes:0, passOk:0, passFail:0, tackles:0, carries:0, clears:0, inplay:0, blocked:0, woodwork:0,
  shotDist: new Array(10).fill(0), xg: 0 });

const N = +(process.env.N || 6);
const A = {};                                   // accumulators
const add = (k, v) => (A[k] = (A[k] || 0) + v);
const push = (k, v) => ((A["_" + k] = A["_" + k] || []).push(v));

for (let seed = 1; seed <= N; seed++) {
  const s = createMatchState();
  const hs = squad(75), as = squad(75);
  s.players.home = hs.filter(p => !p.bench); s.bench.home = hs.filter(p => p.bench);
  s.players.away = as.filter(p => !p.bench); s.bench.away = as.filter(p => p.bench);
  s.formations = { home: "4-3-3", away: "4-3-3" };
  s.strategy = { home: { ...STRAT_DEF }, away: { ...STRAT_DEF } };
  s.possession = "home"; meInit(s, pitchSlots);
  const out = blank(), rng = new RNG(seed);
  let kicker = null, lastHolder = null, lastDir = null, holdRun = 0;
  let prevRunners = 0;

  for (let t = 0; t < ME_MATCH_TICKS; t++) {
    const mp = s.mePos;

    // ---- on-ball snapshot, taken BEFORE the tick so it reflects what the player was looking at
    if (mp.idx >= 0) {
      const side = mp.side, p = s.players[side][mp.idx], dir = meDir(side), off = meOffsideLine(s, side);
      const opp = s.players[side === "home" ? "away" : "home"];
      add("onball", 1);
      // could he legally dribble forwards at all?
      let fwdTotal = 0, fwdLegal = 0;
      for (let k = 0; k < 8; k++) {
        const ang = k * Math.PI / 4, cx = p.x + Math.cos(ang) * CFG.carryLook, cy = p.y + Math.sin(ang) * CFG.carryLook;
        if ((cx - p.x) * dir <= 0.5) continue;
        fwdTotal++;
        if (cx < 2 || cx > PITCH_L - 2 || cy < 2 || cy > PITCH_W - 2) continue;
        if (CFG.carrierOffside !== false && (cx - off) * dir > 0.4) continue;
        fwdLegal++;
      }
      if (fwdTotal > 0 && fwdLegal === 0) add("fwdBlocked", 1);
      // steering churn while one man keeps it
      const key = `${side}${mp.idx}`, d2 = Math.atan2((p._ty ?? p.y) - p.y, (p._tx ?? p.x) - p.x);
      if (key === lastHolder) {
        add("held", 1); holdRun++;
        if (lastDir !== null && Math.abs(Math.atan2(Math.sin(d2 - lastDir), Math.cos(d2 - lastDir))) > Math.PI / 2) add("flip", 1);
      } else { if (holdRun > 0) push("hold", holdRun); holdRun = 0; }
      lastHolder = key; lastDir = d2;
      // the man about to shoot: how much room has he got?
      const act = meDecide(s, rng, side, mp.idx);
      if (act && act.k === "shot") {
        let near = Infinity;
        for (const q of opp) if (q.pos !== "GK") near = Math.min(near, Math.hypot(q.x - p.x, q.y - p.y));
        push("shooterSpace", near);
      }
    }

    // ---- defensive shape while the ball is near a goal
    if (mp.idx >= 0) {
      const atk = mp.side, def = atk === "home" ? "away" : "home";
      const own = meGoalX(atk), dir = def === "home" ? 1 : -1;
      const depth = (mp.bx - own) * dir;
      if (depth < 28) {
        const ds = s.players[def].filter(p => p.pos !== "GK").map(p => (p.x - own) * dir);
        add("siege", 1);
        push("inBox", ds.filter(d => d < 18).length);
        // THE BLOCK IS THE BACK SEVEN. Measured across all ten outfielders this counted the front
        // three as part of it and read 31 m, which sent me looking for a bug in how forwards track
        // back. There is none: the back seven sit 15.5 m apart with the deepest of them 25.9 m out,
        // and the front three at 36.7 m are exactly where a 4-3-3's forwards stand while it defends
        // deep (real: 35-45 m). A striker is not in the block and never was.
        const bl = s.players[def].filter(p => p.pos === "DEF" || p.pos === "MID")
                                 .map(p => (p.x - own) * dir);
        if (bl.length) push("blockDepth", Math.max(...bl) - Math.min(...bl));
        // every attacker in the area: has anybody got him?
        for (let j = 0; j < s.players[atk].length; j++) {
          const q = s.players[atk][j];
          if (q.pos === "GK" || j === mp.idx || Math.abs(q.x - own) > 18) continue;
          let near = Infinity;
          for (const d2 of s.players[def]) if (d2.pos !== "GK") near = Math.min(near, Math.hypot(d2.x - q.x, d2.y - q.y));
          push("boxManGap", near);
        }
      }
    }

    // ---- runs in progress
    let runners = 0;
    for (const sd of ["home", "away"]) for (const p of s.players[sd]) if ((p._runT ?? 0) > 0) runners++;
    push("runners", runners);
    if (runners > prevRunners) add("runsStarted", runners - prevRunners);
    prevRunners = runners;

    // ---- the tick, then who took the next touch after a kick
    const hadIdx = mp.idx, hadSide = mp.side;
    meTick(s, rng, out);
    if (hadIdx >= 0 && mp.idx < 0 && mp.passPending) kicker = `${hadSide}${hadIdx}`;
    else if (kicker && mp.idx >= 0) {
      add("resolved", 1);
      if (`${mp.side}${mp.idx}` === kicker) add("selfPass", 1);
      kicker = null;
    } else if (kicker && !mp.flight) kicker = null;
  }

  for (const k of ["passes", "passOk", "inplay", "tackles", "clears", "blocked"]) add(k, out[k]);
  A.offside = (A.offside || 0) + (out.offside ? out.offside.home + out.offside.away : 0);
  A.subs = (A.subs || 0) + (s.subs ? s.subs.home + s.subs.away : 0);
  for (const sd of ["home", "away"]) for (const k of ["shots", "goals", "onTarget", "corners", "fouls"]) add(k, out[k][sd]);
  for (let b = 0; b < 10; b++) add("d" + b, out.shotDist[b]);
}

const mean = (k) => { const a = A["_" + k] || []; return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; };
const per = (k) => A[k] / N / 2;                       // per side per match
const rows = [];
const row = (name, val, lo, hi, fmt) => rows.push([name, fmt ? fmt(val) : val.toFixed(2), `${lo}-${hi}`,
  val >= lo && val <= hi ? "ok" : val < lo ? "LOW" : "HIGH"]);

const pct = (v) => v.toFixed(0) + "%";
const m = (v) => v.toFixed(1) + " m";
const sec = (v) => v.toFixed(2) + "s";

row("self-pass rate", 100 * (A.selfPass || 0) / (A.resolved || 1), 0, 1, pct);
row("pass completion", 100 * A.passOk / (A.passes || 1), 78, 86, pct);
row("passes per side", A.passes / N / 2, 40, 120);
row("carrier: forward dribble illegal", 100 * (A.fwdBlocked || 0) / (A.onball || 1), 0, 4, pct);
row("carrier: steering reversed", 100 * (A.flip || 0) / (A.held || 1), 0, 3, pct);
// UNITS. mean("hold") is in SLICES and the range is in SECONDS; only the formatter divided by
// four, so a true 1.49 s was compared as 5.96 against 3.2-6.4 and scored as a pass all session.
// Worse than a wrong number: any change that IMPROVED time on the ball got flagged HIGH for it.
row("carrier: unbroken time on ball", mean("hold") / 4, 3.2, 6.4, sec);
row("defenders inside the box", mean("inBox"), 4.5, 7, (v) => v.toFixed(1) + "/10");
row("block depth under siege", mean("blockDepth"), 18, 26, m);
row("nearest defender to a man in the box", mean("boxManGap"), 0, 3.0, m);
row("space the shooter has", mean("shooterSpace"), 0, 3.5, m);
row("runs begun per side", (A.runsStarted || 0) / N / 2, 40, 120);
row("runners on the pitch at once", mean("runners"), 1.4, 4.0);
console.log("");
row("shots per side", per("shots"), 8, 18);
row("goals per side", per("goals"), 0.8, 3.0);
row("shot conversion", 100 * A.goals / (A.shots || 1), 8, 14, pct);
row("corners per side", per("corners"), 1, 7);
row("fouls per side", per("fouls"), 8, 14);
row("offsides per side", (A.offside || 0) / N / 2, 1.5, 3.5);
row("substitutions per match", (A.subs || 0) / N, 3, 6);
row("ball in play", 100 * A.inplay / (N * ME_MATCH_TICKS), 58, 72, (v) => v.toFixed(0) + "%");
const dt = Array.from({ length: 10 }, (_, b) => A["d" + b] || 0).reduce((x, y) => x + y, 0) || 1;
row("shots from outside 15 m", 100 * (A.d3 + A.d4 + A.d5 + A.d6 + A.d7 + A.d8 + A.d9) / dt, 33, 52, pct);

const w = Math.max(...rows.map(r => r[0].length));
console.log(`${"".padEnd(w)}  ${"actual".padStart(9)}  ${"want".padStart(9)}`);
for (const [n2, v, want, flag] of rows)
  console.log(`${n2.padEnd(w)}  ${String(v).padStart(9)}  ${want.padStart(9)}  ${flag === "ok" ? "" : flag}`);
const bad = rows.filter(r => r[3] !== "ok").length;
console.log(`\n${rows.length - bad}/${rows.length} within range`);
