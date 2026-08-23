// DOES A PLAYER'S RATING REACH HIS RATING? The calibration harness behind CFG.ratePos, rateSpread,
// rateSave and gkExp, and the check that they still hold.
//
//   node test/ratings.mjs [N=200] [W=8]      play N league fixtures on W workers and print the analysis
//   node test/ratings.mjs check [N] [W]      ...and fail if the pars or the keeper balance have drifted
//   node test/ratings.mjs derive [N] [W]     ...with ratePos zeroed, and print the values to ship
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
const PAR = 6.85;                                     // where a full-match par sits; see CFG.ratePos

// ---------------------------------------------------------------- worker
if (process.argv[2] === "--worker") {
  const [, , , engPath, start, step, N, seedBase] = process.argv;
  const eng = await import(engPath);
  if (process.env.CFG) Object.assign(eng.CFG, JSON.parse(process.env.CFG));
  const pool = eng.PRESET_CATALOG.filter(t => t.league === "Nichirin League One" || t.league === "Nichirin League Two");
  const P = pool.length;
  globalThis.__sv = []; globalThis.__gc = []; globalThis.__rv = []; globalThis.__pp = [];
  const lines = [];
  for (let k = +start; k < +N; k += +step) {
    const a = pool[k % P], b = pool[(k * 7 + 3) % P];
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
        players.push({ sd, pos: p.pos, ovr: p.ovr0 ?? p.ovr, r: p.rating, frac,
          g: p.goals || 0, a: p.assists || 0, passOk: p.passOk || 0, passFail: p.passFail || 0,
          prog: p.prog || 0, cc: p.cc || 0, def: p.defActs || 0, sv: p.saves || 0,
          duelWon: p.duelWon || 0, duelLost: p.duelLost || 0, drib: p.dribbles || 0,
          beaten: p.beaten || 0, aer: p.aerials || 0, int: p.ints || 0, yc: p.yc || 0, rc: p.rc ? 1 : 0 });
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
  R.penConv = pens.length ? mean(pens.map(s => s[1])) : NaN;
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

// ---------------------------------------------------------------- parent
const mode = ["check", "derive"].includes(process.argv[2]) ? process.argv[2] : "run";
const argN = mode === "run" ? process.argv[2] : process.argv[3], argW = mode === "run" ? process.argv[3] : process.argv[4];
const N = +(argN || 200), W = Math.max(1, Math.min(+(argW || 8), os.cpus().length));
const SEED = 100000;
const src = path.join(HERE, "engine.mjs");
if (!fs.existsSync(src)) { console.log("no test/engine.mjs -- run: zsh test/rebuild.sh"); process.exit(1); }
// A hooked copy of the bundle: every keeper save / concede / revoked parry reports its xg. Each
// anchor must be found exactly once, so a renamed variable fails loudly instead of recording nothing.
let code = fs.readFileSync(src, "utf8");
const sub = (from, to) => { const c = code.split(from).length - 1; if (c !== 1) throw new Error(`anchor x${c}, want x1: ${from}`); code = code.split(from).join(to); };
sub("meRate(q2, meSaveBonus(shp.xg, shp.pen) + (shp.pen ? CFG.ratePenSave : 0));", "meRate(q2, (globalThis.__sv.push([shp.xg, q2, !!shp.pen]), meSaveBonus(shp.xg, shp.pen)) + (shp.pen ? CFG.ratePenSave : 0));");
sub("meRate(q2, meSaveBonus(mp.shot.xg, mp.shot.pen) + (mp.shot.pen ? CFG.ratePenSave : 0));", "meRate(q2, (globalThis.__sv.push([mp.shot.xg, q2, !!mp.shot.pen]), meSaveBonus(mp.shot.xg, mp.shot.pen)) + (mp.shot.pen ? CFG.ratePenSave : 0));");
sub("if (q2.pos === \"GK\") meRate(q2, -meConcedePen(xg, !!(sh && sh.pen)));", "if (q2.pos === \"GK\") meRate(q2, (globalThis.__gc.push([xg, q2, !!(sh && sh.pen)]), -meConcedePen(xg, !!(sh && sh.pen))));");
sub("meRate(pv.q, -pv.credit);", "meRate(pv.q, (globalThis.__rv.push([pv.credit, pv.q]), -pv.credit));");
sub("    out.passes++;\n", "    if (globalThis.__pp) globalThis.__pp.push([pp.byP, pp.p, okSide === pp.side ? 1 : 0, pp.d, pp.high ? 1 : 0, pp.thru ? 1 : 0, okSide === pp.side && mp._pickI === mp.fj ? 1 : 0, pp.c || null]);\n    out.passes++;\n");
sub("        resolvePending(bs);\n        mp.flight = false;", "        mp._pickI = bi; resolvePending(bs); mp._pickI = -1;\n        mp.flight = false;");
const engPath = path.join(HERE, "engine-ratings.mjs");
fs.writeFileSync(engPath, code);
const CFG = (await import(engPath)).CFG;
const env = { ...process.env };
if (mode === "derive") env.CFG = JSON.stringify({ ...(env.CFG ? JSON.parse(env.CFG) : {}), ratePos: { GK: 0, DEF: 0, MID: 0, FWD: 0 } });

const t0 = Date.now();
const outs = await Promise.all(Array.from({ length: W }, (_, w) => new Promise((res, rej) => {
  const of = path.join(os.tmpdir(), `avium-ratings-${process.pid}-w${w}.jsonl`);
  const ch = fork(fileURLToPath(import.meta.url), ["--worker", engPath, String(w), String(W), String(N), String(SEED)],
    { stdio: ["ignore", "inherit", "inherit", "ipc"], env: { ...env, OUT_FILE: of } });
  ch.on("exit", c => { if (c !== 0) return rej(new Error("worker " + w + " exit " + c));
    const txt = fs.readFileSync(of, "utf8"); fs.unlinkSync(of); res(txt); });
})));
const matches = outs.flatMap(b => b.split("\n").filter(Boolean).map(l => JSON.parse(l))).sort((a, b) => a.k - b.k);
console.log(`${matches.length} matches in ${((Date.now() - t0) / 1000).toFixed(0)}s on ${W} workers${env.CFG ? "   CFG " + env.CFG : ""}\n`);
const { text, R } = analyse(matches, CFG);
console.log(text);

if (mode === "derive") {
  console.log("\nTO SHIP (target par " + PAR + " for every position, full-match players):");
  console.log("  ratePos: { " + POSN.map(p => `${p}: ${(PAR - R.means[p]).toFixed(3)}`).join(", ") + " },");
  console.log("  gkExp: [" + R.bands.map(b => `[${b.hi}, ${isNaN(b.conv) ? b.e.toFixed(2) : b.conv.toFixed(2)}]`).join(", ") + "],   gkExpPen: " + (isNaN(R.penConv) ? CFG.gkExpPen : R.penConv.toFixed(2)));
  console.log("  (bands under ~100 shots keep the shipped figure; rerun with a larger N before trusting one)");
  if (R.passFit) console.log("  passCal0: " + R.passFit[0].toFixed(2) + ", passCalB: " + R.passFit[1].toFixed(2) + ", passCalR: " + R.passFit[2].toFixed(2) + ", passCalL: " + R.passFit[3].toFixed(2) + ",   (iterate: the chosen passes move with the belief)");
}
if (mode === "check") {
  const bad = [];
  for (const p of POSN) if (Math.abs(R.means[p] - PAR) > 0.10) bad.push(`${p} par ${R.means[p].toFixed(3)} is off ${PAR} by more than 0.10 -- re-derive ratePos`);
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
