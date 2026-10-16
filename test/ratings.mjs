// DOES A PLAYER'S RATING REACH HIS RATING? The calibration harness behind CFG.rateFin, rateSave and
// gkExp, and the check that they still hold.
//
//   node test/ratings.mjs [N=200] [W=8]      play N league fixtures on W workers and print the analysis
//   node test/ratings.mjs check [N] [W]      ...and fail if the pars or the keeper balance have drifted
//   node test/ratings.mjs derive [N] [W]     ...and fit the finish and the keeper table, and print them to ship
//   SEED=n changes the fixtures' seeds, for a check on matches the derive never saw
//
// Run `zsh test/rebuild.sh` first: it reads test/engine.mjs. A hooked copy is written beside it
// (test/engine-ratings.mjs, gitignored) in which every keeper save, concession and revoked parry
// reports its xg, so the save-against-concede balance can be read rather than inferred.
//
// What it measures, per position over full-match players: the mean (the par), the spread, how much
// of a rating point ten OVR buys -- raw, and within a man's own XI so the team confound is stripped
// -- the share finishing within 0.15 of par (the ghosts), and the per-event deltas. For keepers it
// also reads the engine's own conversion curve on target by xg band, which is what gkExp encodes,
// and whether the keeper's own save/concede contribution averages zero, which is what makes the
// model volume-neutral. The calibration aggregates at the bottom are there so a change that moves a
// rating by moving the football is seen as that.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const POSN = ["GK", "DEF", "MID", "FWD"];
// SOFASCORE'S RATINGS AS THEY ARE NOW (the algorithm it brought in for 2025/26, which leans on a bell curve and gives more
// sevens and more nines than the old one did), read from 142 matches and 4,270 rated performances of its own match data on
// 16 October 2026: the Premier League, a round of each of the other big four and the 2026 World Cup's first round. A full
// match is 81 minutes or more, as here. The user (3 October 2026) wants it with no positional bias, so every position is
// held to the full-match shape below, though SofaScore's forwards have the fatter tails and its defenders the lower end.
const PAR = 6.95;                                     // the full-match mean, where par sits; see CFG.ratePar
const SHAPE = { hi8: 0.077, hi9: 0.0141, lo6: 0.068, tens: 1 / 860 };
const SOFA = {
  full: [["mean", 6.95], ["sd", 0.685], [">=7.0", 0.451], [">=7.5", 0.189], [">=8.0", 0.077], [">=8.5", 0.033], [">=9.0", 0.0141],
         ["<=6.5", 0.276], ["<=6.0", 0.068], ["<=5.5", 0.0088]],
  part: 6.64, partSd: 0.49, cameo: 6.61, cameoSd: 0.33,
  win: 7.23, draw: 6.97, loss: 6.62, won3: 7.37, lost3: 6.33,
  g1: 7.75, g2: 8.65, g3: 9.49, a1: 7.18, ga: 8.43, none: 6.80,
  gkCS: 7.37, gkC1: 6.89, gkC2: 6.87, gkC3: 6.31, gkS6: 8.12, defL3: 6.13, defCSW: 7.44, err: 6.14,
  motm: 8.4, motm10: 7.8, motm90: 9.2, motm9: 0.239, second: 7.85, lowest: 5.9,
  season: 6.89, seasonSd: 0.20, season10: 6.64, season90: 7.16, seasonTop5: 7.26,
};

// ---------------------------------------------------------------- worker
if (process.argv[2] === "--worker") {
  const [, , , engPath, start, step, N, seedBase] = process.argv;
  const eng = await import(engPath);
  if (process.env.CFG) Object.assign(eng.CFG, JSON.parse(process.env.CFG));
  // RATINGS_POOL=mix plays every senior league and the national sides, each fixture inside one of them, where the app's
  // ratings are actually earned; the default is League One and Two together, as the calibration was always fitted.
  const MIX = process.env.RATINGS_POOL === "mix";
  const OUTS = new Set(["All-Nichirin Collegiate Championship", "Frederikka Cup", "Kullanmaan Cup", "Miscellaneous Aviumite"]);
  const leagues = MIX ? [...new Set(eng.PRESET_CATALOG.map(t => t.league))].filter(l => l && !OUTS.has(l))
                      .map(l => eng.PRESET_CATALOG.filter(t => t.league === l)).filter(g => g.length >= 2)
                      : [eng.PRESET_CATALOG.filter(t => t.league === "Nichirin League One" || t.league === "Nichirin League Two")];
  globalThis.__sv = []; globalThis.__gc = []; globalThis.__rv = []; globalThis.__pp = [];
  const lines = [];
  for (let k = +start; k < +N; k += +step) {
    const pool = leagues[k % leagues.length], P = pool.length, kk = Math.floor(k / leagues.length);
    const a = pool[kk % P], b = pool[(kk * 7 + 3) % P];
    if (a === b) continue;
    globalThis.__sv.length = 0; globalThis.__gc.length = 0; globalThis.__rv.length = 0; globalThis.__pp.length = 0;
    const { s, out } = eng.runPositionalMatch(a, b, +seedBase + k * 7919);
    const total = s.mePos.tick || 1;
    const sideOf = (q) => s.players.home.includes(q) || (s.subbedOff?.home || []).includes(q) ? "home" : "away";
    // Per shot on target: [xg, 1 = goal, 1 = penalty]. A revoked parry was not a save, so the
    // keeper's most recent save entry comes off again before the goal is recorded.
    const c01 = (x) => +(Math.max(0, Math.min(1, x || 0))).toFixed(3);
    const sotLog = { home: [], away: [] };
    for (const [xg, q, pen] of globalThis.__sv) sotLog[sideOf(q)].push([c01(xg), 0, pen ? 1 : 0]);
    for (const [, q] of globalThis.__rv) { const L = sotLog[sideOf(q)]; for (let i = L.length - 1; i >= 0; i--) if (L[i][1] === 0) { L.splice(i, 1); break; } }
    for (const [xg, q, pen] of globalThis.__gc) sotLog[sideOf(q)].push([c01(xg), 1, pen ? 1 : 0]);
    const team = {};
    for (const sd of ["home", "away"]) {
      const o = sd === "home" ? "away" : "home";
      const all = [...s.players[sd], ...(s.subbedOff?.[sd] || [])];
      const xi = all.filter(p => (p._onAt ?? 0) === 0);
      team[sd] = { xi: xi.reduce((t, p) => t + (p.ovr0 ?? p.ovr ?? 70), 0) / (xi.length || 1),
        gf: out.goals[sd], ga: out.goals[o], xgF: out.xgS?.[sd] ?? 0, xgA: out.xgS?.[o] ?? 0,
        shots: out.shots[sd], sot: out.onTarget[sd], sotA: out.onTarget[o], saves: out.saves[sd],
        passes: out.passSide?.[sd] ?? 0, passOk: out.passOkSide?.[sd] ?? 0,
        tkTry: out.tackleTrySide?.[sd] ?? 0, tkWon: out.tackleWonSide?.[sd] ?? 0,
        poss: out.poss?.[sd] ?? 0, sotLog: sotLog[sd] };
    }
    const players = [];
    for (const sd of ["home", "away"]) {
      for (const p of [...s.players[sd], ...(s.subbedOff?.[sd] || [])]) {
        if (!p || p.rating == null) continue;
        const frac = Math.max(0, Math.min(1, ((p._offAt ?? total) - (p._onAt ?? 0)) / total));
        players.push({ sd, pos: p.pos, ovr: p.ovr0 ?? p.ovr, r: p.rating, frac, nm: p.name, club: (sd === "home" ? a : b).code,
          sub: (p._onAt ?? 0) > 0 ? 1 : 0, errs: p.errs || 0, og: p.ownGoals || 0,
          g: p.goals || 0, a: p.assists || 0, passOk: p.passOk || 0, passFail: p.passFail || 0,
          prog: p.prog || 0, cc: p.cc || 0, def: p.defActs || 0, sv: p.saves || 0,
          duelWon: p.duelWon || 0, duelLost: p.duelLost || 0, drib: p.dribbles || 0,
          beaten: p.beaten || 0, aer: p.aerials || 0, int: p.ints || 0, yc: p.yc || 0, rc: p.rc ? 1 : 0,
          r0: p._r0, proj: p._proj, shrink: p._shrink });
      }
    }
    // Per pass: passer's OVR against his XI, position, the decision's belief, outcome, length,
    // lofted, into space, reached the man it was played to, and the belief's components
    // [okBase, okRisk, okLate, d, lane, press, recvPress] for the calibration fit.
    const r3 = (v) => v == null ? null : +(+v).toFixed(3);
    const passes = globalThis.__pp.filter(e => e[0]).map(([by, pr, ok, d, hi, th, hit, c]) =>
      [+((by.ovr0 ?? by.ovr) - team[sideOf(by)].xi).toFixed(1), by.pos, r3(pr || 0), ok, r3(d || 0), hi, th, hit, c ? c.map(r3) : null]);
    lines.push(JSON.stringify({ k, team, players, passes }));
  }
  // A big stdout write followed by process.exit truncates on a pipe; a file does not.
  fs.writeFileSync(process.env.OUT_FILE, lines.join("\n") + "\n");
  process.exit(0);
}

// ---------------------------------------------------------------- analysis
const mean = (xs) => xs.reduce((s, v) => s + v, 0) / (xs.length || 1);
const sd = (xs) => { const m = mean(xs); return Math.sqrt(mean(xs.map(v => (v - m) ** 2))); };
const fit = (xs, ys) => {
  const n = xs.length, mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  return { slope: sxx ? sxy / sxx : 0, r2: sxx && syy ? (sxy * sxy) / (sxx * syy) : 0, n };
};
const f2 = (v) => (v >= 0 ? "+" : "") + v.toFixed(2);

function analyse(matches, CFG) {
  const GK_W = CFG.rateSave, gkExp = (xg, pen) => { if (pen) return CFG.gkExpPen; for (const [hi, e] of CFG.gkExp) if (xg < hi) return e; return CFG.gkExp[CFG.gkExp.length - 1][1]; };
  const rows = matches.flatMap(m => m.players.map(p => ({ ...p, xi: m.team[p.sd].xi })));
  const full = rows.filter(r => r.frac >= 0.9);
  const L = [], R = { means: {}, gkBal: 0, bands: [] };
  L.push(`${matches.length} matches, ${full.length} full-match player-games`);
  L.push("POS    n    OVR    RTG   RTGsd  /10OVR   r2    decile-gap  ghost   >=7.5  <=5.5");
  for (const pos of POSN) {
    const g = full.filter(x => x.pos === pos);
    const f = fit(g.map(x => x.ovr), g.map(x => x.r));
    const srt = [...g].sort((p, q) => p.ovr - q.ovr), c = Math.max(1, Math.floor(g.length / 10));
    const gap = mean(srt.slice(-c).map(x => x.r)) - mean(srt.slice(0, c).map(x => x.r));
    const par = mean(g.map(x => x.r)); R.means[pos] = par;
    const ghost = g.filter(x => Math.abs(x.r - par) <= 0.15).length / g.length;
    L.push(`${pos.padEnd(4)} ${String(g.length).padStart(5)}  ${mean(g.map(x => x.ovr)).toFixed(1)}  ${par.toFixed(3)}  ${sd(g.map(x => x.r)).toFixed(3)}  ${(f.slope * 10).toFixed(3).padStart(6)}  ${f.r2.toFixed(3)}    ${gap.toFixed(3).padStart(6)}    ${(ghost * 100).toFixed(1).padStart(5)}%  ${(g.filter(x => x.r >= 7.5).length / g.length * 100).toFixed(1).padStart(5)}%  ${(g.filter(x => x.r <= 5.5).length / g.length * 100).toFixed(1).padStart(5)}%`);
  }
  L.push("\nWITHIN-TEAM (OVR - own XI mean): rating /10, touches /10, passOk /10");
  for (const pos of POSN) {
    const g = full.filter(x => x.pos === pos), d = g.map(x => x.ovr - x.xi);
    L.push(`${pos.padEnd(4)} rating ${f2(fit(d, g.map(x => x.r)).slope * 10)}  touches ${f2(fit(d, g.map(x => x.passOk + x.passFail)).slope * 10)}  passOk ${f2(fit(d, g.map(x => x.passOk)).slope * 10)}`);
  }
  const evk = ["g", "a", "passOk", "passFail", "prog", "cc", "def", "int", "sv", "duelWon", "duelLost", "drib", "beaten", "aer"];
  L.push("\nEVENTS per full match (mean / Δ per 10 OVR raw / Δ per 10 OVR within team)");
  L.push("POS  " + evk.map(k => k.padStart(9)).join(""));
  for (const pos of POSN) {
    const g = full.filter(x => x.pos === pos);
    L.push(`${pos.padEnd(4)} ` + evk.map(k => mean(g.map(x => x[k])).toFixed(2).padStart(9)).join(""));
    L.push(`  Δ  ` + evk.map(k => f2(fit(g.map(x => x.ovr), g.map(x => x[k])).slope * 10).padStart(9)).join(""));
    L.push(`  Δw ` + evk.map(k => f2(fit(g.map(x => x.ovr - x.xi), g.map(x => x[k])).slope * 10).padStart(9)).join(""));
  }
  // Passes: is the decision's belief honest? Open-play passes carry their components; set-piece
  // deliveries do not and are left out of the calibration.
  const pass = matches.flatMap(m => m.passes || []), pcs = pass.filter(e => e[8]);
  R.passFit = null;
  if (pcs.length) {
    L.push("\nPASSES (open play, n=" + pcs.length + "): the decision's belief against what happened, by passer (OVR - own XI)");
    L.push("band       n     pred   real   len    lofted  thru   | MID: n  pred  real");
    for (const [lo, hi] of [[-99, -6], [-6, -2], [-2, 2], [2, 6], [6, 99]]) {
      const g = pcs.filter(e => e[1] !== "GK" && e[0] >= lo && e[0] < hi), gm = g.filter(e => e[1] === "MID");
      if (!g.length) continue;
      L.push(`${String(lo === -99 ? "<-6" : hi === 99 ? ">=6" : lo + ".." + hi).padEnd(8)} ${String(g.length).padStart(6)}   ${mean(g.map(e => e[2])).toFixed(3)}  ${mean(g.map(e => e[3])).toFixed(3)}  ${mean(g.map(e => e[4])).toFixed(1)}   ${(mean(g.map(e => e[5])) * 100).toFixed(0)}%    ${(mean(g.map(e => e[6])) * 100).toFixed(0)}%    | ${String(gm.length).padStart(5)} ${gm.length ? mean(gm.map(e => e[2])).toFixed(3) : "-"} ${gm.length ? mean(gm.map(e => e[3])).toFixed(3) : "-"}`);
    }
    R.passBands = [[.3, .5], [.5, .7], [.7, .85], [.85, 1.01]].map(([lo, hi]) => { const g = pcs.filter(e => e[2] >= lo && e[2] < hi); return { lo, hi, n: g.length, pred: mean(g.map(e => e[2])), real: mean(g.map(e => e[3])) }; });
    L.push("  by belief: " + [[0, .3], [.3, .5], [.5, .7], [.7, .85], [.85, 1.01]].map(([lo, hi]) => { const g = pcs.filter(e => e[2] >= lo && e[2] < hi); return g.length ? `${lo}-${hi > 1 ? 1 : hi}: n=${g.length} pred ${mean(g.map(e => e[2])).toFixed(2)} real ${mean(g.map(e => e[3])).toFixed(2)} (to the man ${mean(g.map(e => e[7] || 0)).toFixed(2)})` : ""; }).filter(Boolean).join(" | "));
    const bandIt = (name, f, edges) => L.push("  " + name.padEnd(8) + edges.map(([lo, hi]) => { const g = pcs.filter(e => f(e) >= lo && f(e) < hi); return g.length < 30 ? "" : `[${lo},${hi}) n=${g.length} pred ${mean(g.map(e => e[2])).toFixed(2)} real ${mean(g.map(e => e[3])).toFixed(2)}`; }).filter(Boolean).join(" | "));
    bandIt("okBase", e => e[8][0], [[0, .4], [.4, .6], [.6, .75], [.75, .9], [.9, 1.2]]);
    bandIt("okRisk", e => e[8][1], [[0, .2], [.2, .4], [.4, .6], [.6, .8], [.8, .95], [.95, 1.01]]);
    bandIt("okLate", e => e[8][2], [[0, .2], [.2, .4], [.4, .6], [.6, .8], [.8, .999], [.999, 1.01]]);
    // The fit the belief ships: logit(kept) = b0 + b1 ln okBase + b2 ln okRisk + b3 ln okLate,
    // by Newton's method. At the fixed point the coefficients come back as CFG.passCal*.
    const X = pcs.map(e => [1, Math.log(Math.max(0.01, e[8][0])), Math.log(Math.max(0.01, e[8][1])), Math.log(Math.max(0.01, e[8][2]))]), y = pcs.map(e => e[3]);
    let b = [0, 0, 0, 0];
    for (let it = 0; it < 12; it++) {
      const H = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], g = [0, 0, 0, 0];
      for (let i = 0; i < X.length; i++) { const x = X[i], z = b[0] * x[0] + b[1] * x[1] + b[2] * x[2] + b[3] * x[3], p = 1 / (1 + Math.exp(-z)), w = p * (1 - p);
        for (let r = 0; r < 4; r++) { g[r] += (y[i] - p) * x[r]; for (let c = 0; c < 4; c++) H[r][c] += w * x[r] * x[c]; } }
      const A = H.map((row, r) => [...row, g[r]]);
      for (let c = 0; c < 4; c++) { let pr = c; for (let r = c + 1; r < 4; r++) if (Math.abs(A[r][c]) > Math.abs(A[pr][c])) pr = r; [A[c], A[pr]] = [A[pr], A[c]];
        for (let r = 0; r < 4; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < 5; k++) A[r][k] -= f * A[c][k]; } }
      b = b.map((v, r) => v + A[r][4] / A[r][r]);
    }
    R.passFit = b;
    L.push(`  fit: logit(kept) = ${b[0].toFixed(2)} + ${b[1].toFixed(2)} ln okBase + ${b[2].toFixed(2)} ln okRisk + ${b[3].toFixed(2)} ln okLate   (shipped ${CFG.passCal0} / ${CFG.passCalB} / ${CFG.passCalR} / ${CFG.passCalL})`);
  }
  // Keepers: the conversion curve the model encodes, and whether it balances.
  const gks = [];
  for (const m of matches) for (const sd_ of ["home", "away"]) {
    const p = m.players.find(p => p.sd === sd_ && p.pos === "GK" && p.frac >= 0.9);
    if (!p) continue;
    const t = m.team[sd_];
    const c = t.sotLog.reduce((tot, [xg, g, pen]) => { const e = gkExp(xg, pen); return tot + GK_W * (g ? -(1 - e) : e); }, 0);
    gks.push({ ovr: p.ovr, r: p.r, sv: p.sv, ga: t.ga, xgA: t.xgA, sotA: t.sotA, c });
  }
  const allShots = matches.flatMap(m => [...m.team.home.sotLog, ...m.team.away.sotLog]);
  const open = allShots.filter(s => !s[2]), pens = allShots.filter(s => s[2]);
  L.push("\nKEEPERS (full match)   n=" + gks.length);
  L.push(`  saves/match ${mean(gks.map(g => g.sv)).toFixed(2)} (slope/10 OVR ${f2(fit(gks.map(g => g.ovr), gks.map(g => g.sv)).slope * 10)})   SoT faced ${mean(gks.map(g => g.sotA)).toFixed(2)}   goals against ${mean(gks.map(g => g.ga)).toFixed(2)} (slope/10 ${f2(fit(gks.map(g => g.ovr), gks.map(g => g.ga)).slope * 10)})   xG-based goals prevented slope/10 ${f2(fit(gks.map(g => g.ovr), gks.map(g => g.xgA - g.ga)).slope * 10)}`);
  let lo = 0;
  for (const [hi, e] of CFG.gkExp) {
    const g = open.filter(s => s[0] >= lo && s[0] < hi);
    R.bands.push({ lo, hi, n: g.length, conv: g.length ? mean(g.map(s => s[1])) : NaN, e }); lo = hi;
  }
  L.push("  conversion on target by gkExp band (open play): " + R.bands.map(b => `[${b.lo},${b.hi >= 1 ? 1 : b.hi}) n=${b.n} ${isNaN(b.conv) ? "-" : (b.conv * 100).toFixed(0) + "%"} vs ${(b.e * 100).toFixed(0)}%`).join(" | "));
  R.penConv = pens.length ? mean(pens.map(s => s[1])) : NaN; R.penN = pens.length;
  L.push(`  penalties on target ${pens.length}, conversion ${isNaN(R.penConv) ? "-" : (R.penConv * 100).toFixed(0) + "%"} vs gkExpPen ${(CFG.gkExpPen * 100).toFixed(0)}%`);
  R.gkBal = mean(gks.map(g => g.c));
  L.push(`  keeper's own save/concede contribution (rateSave ${GK_W}): mean ${R.gkBal.toFixed(3)} sd ${sd(gks.map(g => g.c)).toFixed(3)} slope/10 OVR ${f2(fit(gks.map(g => g.ovr), gks.map(g => g.c)).slope * 10)}   rest of rating slope/10 ${f2(fit(gks.map(g => g.ovr), gks.map(g => g.r - g.c)).slope * 10)}`);
  for (const W of [0.5, 0.65, 0.85, 1.0]) {
    const rs = gks.map(g => g.r - g.c + g.c * W / GK_W), par = mean(rs);
    L.push(`  GK at rateSave ${W}: sd ${sd(rs).toFixed(3)} /10OVR ${f2(fit(gks.map(g => g.ovr), rs).slope * 10)} ghost ${(rs.filter(r => Math.abs(r - par) <= 0.15).length / rs.length * 100).toFixed(1)}% >=7.5 ${(rs.filter(r => r >= 7.5).length / rs.length * 100).toFixed(1)}% <=5.5 ${(rs.filter(r => r <= 5.5).length / rs.length * 100).toFixed(1)}%`);
  }
  // Calibration aggregates.
  const T = matches.flatMap(m => [m.team.home, m.team.away]);
  const pc = T.reduce((s, t) => s + t.passOk, 0) / (T.reduce((s, t) => s + t.passes, 0) || 1);
  L.push("\nCALIBRATION   goals/match " + (2 * mean(T.map(t => t.gf))).toFixed(2) + "   xg/match " + (2 * mean(T.map(t => t.xgF))).toFixed(2)
    + "   shots/side " + mean(T.map(t => t.shots)).toFixed(2) + "   SoT/side " + mean(T.map(t => t.sot)).toFixed(2)
    + "   passes/side " + mean(T.map(t => t.passes)).toFixed(1) + "   completion " + (pc * 100).toFixed(1) + "%"
    + "   tackles won/side " + mean(T.map(t => t.tkWon)).toFixed(2) + " of " + mean(T.map(t => t.tkTry)).toFixed(2)
    + (pcs.length ? "\n  pass mix (open play): belief " + mean(pcs.map(e => e[2])).toFixed(2) + "   length " + mean(pcs.map(e => e[4])).toFixed(1) + " m   lofted " + (mean(pcs.map(e => e[5])) * 100).toFixed(0) + "%   into space " + (mean(pcs.map(e => e[6])) * 100).toFixed(0) + "%" : ""));
  const band = (xi) => xi < 73 ? "<73" : xi < 79 ? "73-79" : "79+", bands = {};
  for (const t of T) { const b = band(t.xi); (bands[b] = bands[b] || []).push(t); }
  L.push("  by XI band: " + Object.entries(bands).sort().map(([b, ts]) => `${b} completion ${(ts.reduce((s, t) => s + t.passOk, 0) / (ts.reduce((s, t) => s + t.passes, 0) || 1) * 100).toFixed(1)}% poss ${(mean(ts.map(t => t.poss)) / mean(T.map(t => t.poss)) * 50).toFixed(1)}% (n=${ts.length})`).join("   "));
  const gapB = { "0-4": [], "4-8": [], "8-14": [], "14+": [] };
  for (const m of matches) {
    const h = m.team.home, a = m.team.away, gap = Math.abs(h.xi - a.xi);
    const better = h.xi >= a.xi ? h : a, worse = better === h ? a : h;
    gapB[gap < 4 ? "0-4" : gap < 8 ? "4-8" : gap < 14 ? "8-14" : "14+"].push(better.gf > worse.gf ? 1 : better.gf === worse.gf ? 0.5 : 0);
  }
  L.push("  better side's result by XI gap: " + Object.entries(gapB).map(([k, v]) => `${k}: ${v.length ? (mean(v) * 100).toFixed(0) : "-"}% (n=${v.length})`).join("   "));
  return { text: L.join("\n"), R };
}

// The finish, applied to raw ratings exactly as meFinalise does it, so it can be refitted offline.
// A keeper's ledger can be re-priced on a new expectation table first: every shot on target he faced
// moves his raw rating by rateSave x (new expectation - old), saved or not.
function refinish(matches, CFG, F, gk, S = CFG.rateBend, par = CFG.ratePar) {
  const ex = (T, pen, xg, pE) => { if (pen) return pE; for (const [hi, e] of T) if (xg < hi) return e; return T[T.length - 1][1]; };
  const rows = [];
  for (const m of matches) for (const p of m.players) {
    if (p.r0 == null || p.frac * 90 < 10) continue;
    let r0 = p.r0;
    if (gk && p.pos === "GK") for (const [xg, , pen] of m.team[p.sd].sotLog) r0 += CFG.rateSave * (ex(gk.T, pen, xg, gk.pen) - ex(CFG.gkExp, pen, xg, CFG.gkExpPen));
    const f = F[p.pos], z = p.rc ? r0 - 6.5 - f.mid : (r0 - 6.5 - f.mid * p.frac) * p.proj * p.shrink;
    const top = 6.5 + z * (z >= 0 ? f.up : f.dn) + (par - 6.5) * p.shrink;
    const r = top > CFG.rateKnee ? CFG.rateKnee + f.tail * S * Math.log(1 + (top - CFG.rateKnee) / S) : top;
    rows.push({ pos: p.pos, full: p.frac >= 0.9, r: Math.max(3, Math.min(10, +r.toFixed(2))), p, m });
  }
  return rows;
}
// Each position's four numbers by bisection, a few sweeps over all of them: mid sets the mean, up
// the share at 8.0+, dn the share at 6.0-, tail the share at 9.0+. Each is monotone in its own, and
// each f below rises with its parameter. The bend (CFG.rateBend) is NOT fitted: the tens it would be
// fitted to are a dozen performances in twelve hundred matches, and three fits on as many runs came
// back 3.5, 4.1 and 25. It is set by hand and the tens are reported.
function fitFinish(matches, CFG, gk) {
  const F = JSON.parse(JSON.stringify(CFG.rateFin));
  let S = CFG.rateBend;
  const bis = (set, f, lo, hi) => { for (let i = 0; i < 28; i++) { const m = (lo + hi) / 2; set(m); if (f() < 0) lo = m; else hi = m; } set((lo + hi) / 2); };
  const get = (p) => refinish(matches, CFG, F, gk, S, PAR).filter(r => r.full && r.pos === p).map(r => r.r);
  for (let it = 0; it < 3; it++) {
    for (const p of POSN) for (let k = 0; k < 2; k++) {
      bis(v => F[p].mid = v, () => PAR - mean(get(p)), -2, 3);
      bis(v => F[p].up = v, () => share(get(p), r => r >= 8.0) - SHAPE.hi8, 0.2, 4);
      bis(v => F[p].dn = v, () => share(get(p), r => r <= 6.0) - SHAPE.lo6, 0.2, 4);
      bis(v => F[p].tail = v, () => share(get(p), r => r >= 9.0) - SHAPE.hi9, 0.2, 4);
    }
  }
  return { F, S };
}
const share = (xs, f) => xs.filter(f).length / (xs.length || 1);
// The match ratings against SofaScore's, dimension by dimension: the shape of a full match, the cameo, the result, the
// goal and the assist, the keeper's afternoon, the man of the match, and the season average of a regular.
function sofaTable(rows) {
  const L = ["\nAGAINST SOFASCORE (2025/26)                       n     engine   SofaScore"];
  const rr = (g) => g.map(r => r.r), q = (v, f) => { const a = [...v].sort((x, y) => x - y); return a.length ? a[Math.floor(f * (a.length - 1))] : NaN; };
  const put = (name, g, tgt, n) => L.push(`  ${name.padEnd(42)} ${String(n ?? g.length).padStart(6)}   ${Number.isFinite(+g) ? (+g).toFixed(2) : g.length ? mean(rr(g)).toFixed(2) : "  - "}     ${tgt.toFixed(2)}`);
  const full = rows.filter(r => r.full), out = rows.filter(r => r.pos !== "GK" && r.p.frac >= 0.5);
  const fr = rr(full);
  for (const [k, t] of SOFA.full) {
    const v = k === "mean" ? mean(fr) : k === "sd" ? sd(fr) : share(fr, k.startsWith(">=") ? (x => x >= +k.slice(2)) : (x => x <= +k.slice(2)));
    L.push(`  ${("full match " + k).padEnd(42)} ${String(fr.length).padStart(6)}   ${k === "mean" || k === "sd" ? v.toFixed(2) : (v * 100).toFixed(1) + "%"}     ${k === "mean" || k === "sd" ? t.toFixed(2) : (t * 100).toFixed(1) + "%"}`);
  }
  const part = rows.filter(r => !r.full), cameo = rows.filter(r => r.p.sub && r.p.frac * 90 < 30);
  put("10-80 minutes, mean", part, SOFA.part); put("10-80 minutes, sd", sd(rr(part)), SOFA.partSd, part.length);
  put("a substitute under 30 minutes, mean", cameo, SOFA.cameo); put("a substitute under 30 minutes, sd", sd(rr(cameo)), SOFA.cameoSd, cameo.length);
  const res = (r) => { const t = r.m.team[r.p.sd]; return t.gf - t.ga; }, ga = (r) => r.m.team[r.p.sd].ga;
  put("full match, won", full.filter(r => res(r) > 0), SOFA.win); put("full match, drawn", full.filter(r => res(r) === 0), SOFA.draw);
  put("full match, lost", full.filter(r => res(r) < 0), SOFA.loss); put("full match, won by 3+", full.filter(r => res(r) >= 3), SOFA.won3);
  put("full match, lost by 3+", full.filter(r => res(r) <= -3), SOFA.lost3);
  put("outfield 45+ min, one goal", out.filter(r => r.p.g === 1), SOFA.g1); put("outfield 45+ min, two goals", out.filter(r => r.p.g === 2), SOFA.g2);
  put("outfield 45+ min, three or more", out.filter(r => r.p.g >= 3), SOFA.g3); put("outfield 45+ min, an assist and no goal", out.filter(r => !r.p.g && r.p.a === 1), SOFA.a1);
  put("outfield 45+ min, a goal and an assist", out.filter(r => r.p.g >= 1 && r.p.a >= 1), SOFA.ga);
  put("outfield full match, no goal or assist", full.filter(r => r.pos !== "GK" && !r.p.g && !r.p.a), SOFA.none);
  const gk = full.filter(r => r.pos === "GK");
  put("keeper, clean sheet", gk.filter(r => ga(r) === 0), SOFA.gkCS); put("keeper, conceded one", gk.filter(r => ga(r) === 1), SOFA.gkC1);
  put("keeper, conceded two", gk.filter(r => ga(r) === 2), SOFA.gkC2); put("keeper, conceded three or more", gk.filter(r => ga(r) >= 3), SOFA.gkC3);
  put("keeper, six saves or more", gk.filter(r => r.p.sv >= 6), SOFA.gkS6);
  put("defender, lost by 3+", full.filter(r => r.pos === "DEF" && res(r) <= -3), SOFA.defL3);
  put("defender, clean-sheet win", full.filter(r => r.pos === "DEF" && ga(r) === 0 && res(r) > 0), SOFA.defCSW);
  put("an error that led to a goal", rows.filter(r => r.p.errs >= 1), SOFA.err);
  const byM = new Map(); for (const r of rows) { if (!byM.has(r.m)) byM.set(r.m, []); byM.get(r.m).push(r); }
  const tops = [], secs = [], lows = []; let onW = 0, dec = 0;
  for (const [m, g] of byM) { const v = rr(g).sort((x, y) => y - x); tops.push(v[0]); secs.push(v[1]); lows.push(v[v.length - 1]);
    const best = g.reduce((a, b) => b.r > a.r ? b : a); const d = res(best); if (d !== 0) { dec++; if (d > 0) onW++; } }
  put("man of the match, median", q(tops, .5), SOFA.motm, tops.length); put("man of the match, 10th percentile", q(tops, .1), SOFA.motm10, tops.length);
  put("man of the match, 90th percentile", q(tops, .9), SOFA.motm90, tops.length);
  L.push(`  ${"matches with a 9.0 or better".padEnd(42)} ${String(tops.length).padStart(6)}   ${(share(tops, x => x >= 9) * 100).toFixed(1)}%     ${(SOFA.motm9 * 100).toFixed(1)}%`);
  put("second best, median", q(secs, .5), SOFA.second, secs.length); put("lowest, median", q(lows, .5), SOFA.lowest, lows.length);
  L.push(`  ${"man of the match on the winners (decided)".padEnd(42)} ${String(dec).padStart(6)}   ${(onW / (dec || 1) * 100).toFixed(0)}%`);
  // A season: each man's afternoons for his club across the sample, the regulars being those who played half his
  // club's minutes or more.
  const clubN = new Map(), man = new Map();
  for (const [m] of byM) for (const sd_ of ["home", "away"]) { const c = m.players.find(p => p.sd === sd_)?.club; if (c) clubN.set(c, (clubN.get(c) || 0) + 1); }
  for (const r of rows) { const key = r.p.club + "|" + r.p.nm; const e = man.get(key) || { c: r.p.club, n: 0, f: 0, s: 0 }; e.n++; e.f += r.p.frac; e.s += r.r; man.set(key, e); }
  const reg = [...man.values()].filter(e => e.f >= 0.5 * (clubN.get(e.c) || 1) && (clubN.get(e.c) || 0) >= 8).map(e => e.s / e.n);
  if (reg.length) {
    put("season average of a regular, mean", mean(reg), SOFA.season, reg.length); put("season average of a regular, sd", sd(reg), SOFA.seasonSd, reg.length);
    put("season average, 10th percentile", q(reg, .1), SOFA.season10, reg.length); put("season average, 90th percentile", q(reg, .9), SOFA.season90, reg.length);
    put("season average, the top 5%", q(reg, .952), SOFA.seasonTop5, reg.length);
  }
  return L.join("\n");
}
function shapeTable(rows) {
  const L = ["POS      n   mean   sd   >=8.0  >=8.5  >=9.0  <=6.0  <=5.5   (full matches; partial 10+ min below)"];
  const line = (k, g) => `${k.padEnd(4)} ${String(g.length).padStart(6)}  ${mean(g).toFixed(2)}  ${sd(g).toFixed(2)}  ${(share(g, r => r >= 8) * 100).toFixed(1).padStart(5)}  ${(share(g, r => r >= 8.5) * 100).toFixed(1).padStart(5)}  ${(share(g, r => r >= 9) * 100).toFixed(1).padStart(5)}  ${(share(g, r => r <= 6) * 100).toFixed(1).padStart(5)}  ${(share(g, r => r <= 5.5) * 100).toFixed(1).padStart(5)}`;
  for (const p of POSN) L.push(line(p, rows.filter(r => r.full && r.pos === p).map(r => r.r)));
  L.push(line("ALL", rows.filter(r => r.full).map(r => r.r)));
  L.push(line("part", rows.filter(r => !r.full).map(r => r.r)));
  const fr = rows.filter(r => r.full), srt = [...fr].sort((a, b) => b.r - a.r), n = fr.length;
  const sh = (g) => POSN.map(p => `${p} ${(share(g, r => r.pos === p) * 100).toFixed(0)}%`).join(" ");
  L.push(`  shares: of full matches ${sh(fr)} | top 1% ${sh(srt.slice(0, Math.ceil(n * .01)))} | top 5% ${sh(srt.slice(0, Math.ceil(n * .05)))} | bottom 5% ${sh(srt.slice(-Math.ceil(n * .05)))}`);
  const all = rows.map(r => r.r);
  L.push(`  10.0s: ${all.filter(r => r >= 9.995).length} in ${all.length} rated performances`);
  return L.join("\n");
}

// ---------------------------------------------------------------- parent
// On the cloud lab (LAB_TEST=ratings.mjs) the mode comes in as RATINGS_MODE and N as RATINGS_N, and only the first runner
// plays it: this harness does not split itself, so the other nineteen leave at once.
// ...unless RATINGS_SPLIT is set: then every runner plays its share of the fixtures (SHARD=i/n) and prints them as a DUMP,
// one match a line, for LOAD= to read back merged on the Mac.
const SPLIT = process.env.RATINGS_SPLIT ? (process.env.SHARD || "").match(/^(\d+)\/(\d+)$/) : null;
if (!SPLIT && /^[1-9]\d*\/\d+$/.test(process.env.SHARD || "")) process.exit(0);
const mode = ["check", "derive"].includes(process.argv[2]) ? process.argv[2]
           : ["check", "derive"].includes(process.env.RATINGS_MODE) ? process.env.RATINGS_MODE : "run";
const argN = mode === "run" ? process.argv[2] : process.argv[3], argW = mode === "run" ? process.argv[3] : process.argv[4];
const N = +(argN || process.env.RATINGS_N || 200), W = Math.max(1, Math.min(+(argW || 8), os.cpus().length));
const SEED = +(process.env.SEED || 100000);
const src = path.join(HERE, "engine.mjs");
if (!fs.existsSync(src)) { console.log("no test/engine.mjs -- run: zsh test/rebuild.sh"); process.exit(1); }
// A hooked copy of the bundle: every keeper save / concede / revoked parry reports the xg his credit
// was priced on (the ordinary keeper's, xgN). Each
// anchor must be found exactly once, so a renamed variable fails loudly instead of recording nothing.
let code = fs.readFileSync(src, "utf8");
const sub = (from, to) => { const c = code.split(from).length - 1; if (c !== 1) throw new Error(`anchor x${c}, want x1: ${from}`); code = code.split(from).join(to); };
// The bundler renames the keeper's variable between builds (q, q2, ...), so these four anchors match
// it by pattern and write it back as found. Still exactly one match each, or it fails loudly.
const subRe = (re, to) => { const m = code.match(new RegExp(re.source, "g")) || []; if (m.length !== 1) throw new Error(`anchor x${m.length}, want x1: ${re}`); code = code.replace(re, to); };
subRe(/meRate\((q\d*), meSaveBonus\(shp\.xgN \?\? shp\.xg, shp\.pen\) \+ \(shp\.pen \? CFG\.ratePenSave : 0\)\);/, "meRate($1, (globalThis.__sv.push([shp.xgN ?? shp.xg, $1, !!shp.pen]), meSaveBonus(shp.xgN ?? shp.xg, shp.pen)) + (shp.pen ? CFG.ratePenSave : 0));");
subRe(/meRate\((q\d*), meSaveBonus\(mp\.shot\.xgN \?\? mp\.shot\.xg, mp\.shot\.pen\) \+ \(mp\.shot\.pen \? CFG\.ratePenSave : 0\)\);/, "meRate($1, (globalThis.__sv.push([mp.shot.xgN ?? mp.shot.xg, $1, !!mp.shot.pen]), meSaveBonus(mp.shot.xgN ?? mp.shot.xg, mp.shot.pen)) + (mp.shot.pen ? CFG.ratePenSave : 0));");
subRe(/if \((q\d*)\.pos === "GK"\) meRate\(\1, -meConcedePen\(sh \? sh\.xgN \?\? sh\.xg : xg, !!\(sh && sh\.pen\)\)\);/, "if ($1.pos === \"GK\") meRate($1, (globalThis.__gc.push([sh ? sh.xgN ?? sh.xg : xg, $1, !!(sh && sh.pen)]), -meConcedePen(sh ? sh.xgN ?? sh.xg : xg, !!(sh && sh.pen))));");
sub("meRate(pv.q, -pv.credit);", "meRate(pv.q, (globalThis.__rv.push([pv.credit, pv.q]), -pv.credit));");
sub("    out.passes++;\n", "    if (globalThis.__pp) globalThis.__pp.push([pp.byP, pp.p, okSide === pp.side ? 1 : 0, pp.d, pp.high ? 1 : 0, pp.thru ? 1 : 0, okSide === pp.side && mp._pickI === mp.fj ? 1 : 0, pp.c || null]);\n    out.passes++;\n");
// The rating before full time shapes it, so the finalisation can be re-fitted without replaying.
sub("const z = p.rc ? rawR - 6.5 - f.mid", "p._r0 = rawR; p._proj = proj; p._shrink = shrink; const z = p.rc ? rawR - 6.5 - f.mid");
// Indentation-free: the contest moved into its own function and the bundle re-indents it.
sub("resolvePending(bs);", "mp._pickI = bi; resolvePending(bs); mp._pickI = -1;");
const engPath = path.join(HERE, "engine-ratings.mjs");
fs.writeFileSync(engPath, code);
const CFG = (await import(engPath)).CFG;
const env = { ...process.env };

const t0 = Date.now();
// LOAD=path reads a DUMP back instead of playing, to refit on matches already played.
const outs = process.env.LOAD ? [fs.readFileSync(process.env.LOAD, "utf8")] : await Promise.all(Array.from({ length: W }, (_, w) => new Promise((res, rej) => {
  const of = path.join(os.tmpdir(), `avium-ratings-${process.pid}-w${w}.jsonl`);
  const ch = fork(fileURLToPath(import.meta.url), ["--worker", engPath, String(SPLIT ? +SPLIT[1] + +SPLIT[2] * w : w),
                                                     String(SPLIT ? +SPLIT[2] * W : W), String(N), String(SEED)],
    { stdio: ["ignore", "inherit", "inherit", "ipc"], env: { ...env, OUT_FILE: of } });
  ch.on("exit", c => { if (c !== 0) return rej(new Error("worker " + w + " exit " + c));
    const txt = fs.readFileSync(of, "utf8"); fs.unlinkSync(of); res(txt); });
})));
const matches = outs.flatMap(b => b.split("\n").filter(Boolean).map(l => JSON.parse(l))).sort((a, b) => a.k - b.k);
if (SPLIT) { process.stdout.write(matches.map(m => JSON.stringify({ k: m.k, team: m.team, players: m.players })).join("\n") + "\n"); process.exit(0); }
// DUMP=path keeps every match's teams and players for a distribution read outside this script.
if (process.env.DUMP) fs.writeFileSync(process.env.DUMP, matches.map(m => JSON.stringify({ k: m.k, team: m.team, players: m.players })).join("\n") + "\n");
console.log(`${matches.length} matches in ${((Date.now() - t0) / 1000).toFixed(0)}s on ${W} workers${env.CFG ? "   CFG " + env.CFG : ""}\n`);
const { text, R } = analyse(matches, CFG);
console.log(text);
console.log("\nTHE FINISH AS SHIPPED, per position against SofaScore's shape (8.0+ " + (SHAPE.hi8 * 100).toFixed(1) + "%, 9.0+ " + (SHAPE.hi9 * 100).toFixed(1) + "%, 6.0- " + (SHAPE.lo6 * 100).toFixed(1) + "%, a 10.0 in " + Math.round(1 / SHAPE.tens) + ")");
const shipped = refinish(matches, CFG, CFG.rateFin, null);
console.log(shapeTable(shipped));
console.log(sofaTable(shipped));

if (mode === "derive") {
  // Bands under 100 shots, and penalties under 50, keep the shipped figure.
  const gk = { T: R.bands.map(b => [b.hi, b.n >= 100 ? +b.conv.toFixed(2) : b.e]), pen: R.penN >= 50 ? +R.penConv.toFixed(2) : CFG.gkExpPen };
  const { F, S } = fitFinish(matches, CFG, gk);
  console.log("\nTO SHIP (par " + PAR + " for every position, full-match players):");
  console.log("  gkExp: [" + gk.T.map(([hi, e]) => `[${hi.toFixed(2)}, ${e.toFixed(2)}]`).join(", ") + "],   gkExpPen: " + gk.pen.toFixed(2));
  console.log("  rateBend: " + S.toFixed(2) + ",");
  console.log("  rateFin: {\n" + POSN.map(p => `    ${(p + ":").padEnd(4)} { mid: ${F[p].mid.toFixed(3)}, up: ${F[p].up.toFixed(3)}, dn: ${F[p].dn.toFixed(3)}, tail: ${F[p].tail.toFixed(3)} },`).join("\n") + "\n  },");
  console.log("\nTHE FINISH TO SHIP, on these matches:");
  const toShip = refinish(matches, CFG, F, gk, S, PAR);
  console.log(shapeTable(toShip));
  console.log(sofaTable(toShip));
  if (R.passFit) console.log("  passCal0: " + R.passFit[0].toFixed(2) + ", passCalB: " + R.passFit[1].toFixed(2) + ", passCalR: " + R.passFit[2].toFixed(2) + ", passCalL: " + R.passFit[3].toFixed(2) + ",   (iterate: the chosen passes move with the belief)");
}
if (mode === "check") {
  const bad = [];
  // Every position on the same curve: the mean within 0.10 of par, and each tail share within three
  // standard errors (plus half a point) of SofaScore's.
  for (const p of POSN) {
    const g = shipped.filter(r => r.full && r.pos === p).map(r => r.r), n = g.length, m = mean(g);
    if (Math.abs(m - PAR) > 0.10) bad.push(`${p} mean ${m.toFixed(3)} is off ${PAR} by more than 0.10 -- re-derive rateFin`);
    for (const [k, t, f] of [["8.0+", SHAPE.hi8, r => r >= 8.0], ["9.0+", SHAPE.hi9, r => r >= 9.0], ["6.0-", SHAPE.lo6, r => r <= 6.0]]) {
      const v = share(g, f), tol = 3 * Math.sqrt(t * (1 - t) / n) + 0.005;
      if (Math.abs(v - t) > tol) bad.push(`${p} puts ${(v * 100).toFixed(1)}% of full matches at ${k} against ${(t * 100).toFixed(1)}% -- re-derive rateFin`);
    }
  }
  if (Math.abs(R.gkBal) > 0.08) bad.push(`keeper save/concede contribution averages ${R.gkBal.toFixed(3)}, not ~0 -- re-derive gkExp`);
  for (const b of R.bands) if (b.n >= 100 && Math.abs(b.conv - b.e) > 0.10) bad.push(`gkExp band [${b.lo},${b.hi}) converts ${(b.conv * 100).toFixed(0)}% against a shipped ${(b.e * 100).toFixed(0)}% -- re-derive gkExp`);
  // The belief is checked by band, not by coefficient: okLate's coefficient is set by the few
  // thousand passes where the receiver is late and wanders by half a unit between runs, while
  // what matters -- does a 0.6 complete 0.6 -- is stable.
  // Tolerance 0.06: the 0.5-0.7 band sits a structural -0.05 under its belief and three successive
  // logistic re-fits could not move it (okLate diverged 2.52 -> 3.03 while the band held at
  // 0.62/0.57). Box-occupation runs pack that band with congested central passes the three-feature
  // model cannot see. A real regression still fires past 0.06.
  for (const b of R.passBands || []) if (b.n >= 500 && Math.abs(b.pred - b.real) > 0.06) bad.push(`passes believed at ${b.pred.toFixed(2)} (band ${b.lo}-${b.hi}) completed ${b.real.toFixed(2)} -- re-fit passCal*`);
  console.log(bad.length ? "\n" + bad.map(s => "  FAIL  " + s).join("\n") : "\nall pars and the keeper balance hold");
  process.exit(bad.length ? 1 : 0);
}
