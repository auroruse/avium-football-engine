// THE TACTICS LAB. What does a tactical setting DO? Every club in a league plays a fixed set of fixtures
// under each ARM of an experiment -- an arm is a way of setting a side up -- and opponent, venue and seed
// are functions of the club and the fixture number alone, so every arm plays the same matches and an arm's
// effect is a paired difference against the base arm. For every match it records how the side PLAYED
// (possession and where, passing by kind and length, how high it wins the ball back and how soon after
// losing it, the height and width of its block, how far it runs, shots by where they came from) and how it
// DID (points, goals, xG). A claim about a style or an instruction is a measurement, not a reading of the
// tables.
//
//   node test/lab.mjs <spec.mjs> [workers=10] [out.jsonl]
//
// A spec is a module exporting { field, clubs?, n, chunk?, base, opp?(t, E, H), arms: [{ name, team?(t, E, H),
// opp?(t, E, H), bundle?, cfg?, mt? }] }. `team` and `opp` take a preset team and return the side to play (default: as
// the sheet has it), with the engine and these helpers (H.stamp) to hand -- a spec must not import this file,
// which is still loading it; `bundle` plays the arm on another engine build, which is how a fix is A/B'd. One
// record a match goes to out.jsonl (default $TMPDIR/lab.jsonl) as it arrives; at the end every metric's
// mean prints for the base arm, and each arm's paired difference from it with its standard error.
import { fork } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = fileURLToPath(import.meta.url);
const ENGINE = resolve(HERE, "../engine.mjs");
const PL = 105;
const SIDES = ["home", "away"];
const other = (sd) => sd === "home" ? "away" : "home";
const dep = (sd, x) => sd === "home" ? x : PL - x;           // metres from his own goal line
const fwdOf = (sd, dx) => sd === "home" ? dx : -dx;

// A side set up in a style the way the app sets one up: STRAT_DEF, the style's identity keys over it, then
// `over` -- and the XI re-slotted, not relabelled, when the formation changes.
export function stamp(E, t, style, over = {}, formation) {
  const strategy = { ...E.STRAT_DEF };
  for (const k of E.IDENTITY_KEYS) strategy[k] = E.STYLE_PRESET[style]?.[k] ?? 0;
  Object.assign(strategy, over);
  const f = formation || t.formation;
  return { ...t, style, strategy, formation: f, squad: f === t.formation ? t.squad : E.refitAs(t.squad, f) };
}

const H = { stamp };

// ---- one match, watched -------------------------------------------------------------------------
const KIND = { feet: "feet", through: "thru", space: "thru", long: "long", switch: "sw", over: "over",
               cross: "cross", throw: "gk", punt: "gk", flick: "flick" };
const KS = ["feet", "thru", "long", "sw", "over", "cross", "gk", "flick"];
const passBook = () => ({ n: 0, ok: 0, d: 0, fwd: 0, long: 0, back: 0, high: 0, own60: 0, set: 0,
  kn: Object.fromEntries(KS.map(k => [k, 0])), kok: Object.fromEntries(KS.map(k => [k, 0])) });
const ORG = ["feet", "thru", "long", "cross", "hdr", "solo", "set"];
const shotBook = () => ({ n: 0, xg: 0, d: 0, hdr: 0, fast: 0, xgFast: 0,
  org: Object.fromEntries(ORG.map(k => [k, 0])), oxg: Object.fromEntries(ORG.map(k => [k, 0])) });
const r4 = (v) => Number.isFinite(v) ? Math.round(v * 1e4) / 1e4 : 0;

export function play(E, hT, aT, seed) {
  const st = E.createMatchState();
  st.brain = 2; st.homeAdv = null; st.injuriesOn = false;
  st.players.home = E.meSide(hT); st.players.away = E.meSide(aT);
  st.bench = { home: E.meBench(hT), away: E.meBench(aT) };
  st.subCap = { home: st.bench.home.length >= 11 ? 5 : 3, away: st.bench.away.length >= 11 ? 5 : 3 };
  st.formations = { home: hT.formation || "4-3-3", away: aT.formation || "4-3-3" };
  st.strategy = { home: E.meStrategyFor(hT), away: E.meStrategyFor(aT) };
  st.fit = { home: E.meFitFor(hT), away: E.meFitFor(aT) };
  st.mgmt = { home: hT.mgmt ?? null, away: aT.mgmt ?? null };
  st.styles = { home: hT.style || "balanced", away: aT.style || "balanced" };
  st.teamSkill = { home: hT.skill, away: aT.skill };
  st.possession = "home";
  // A side may arrive with its own plan (src/engine/plan.ts); otherwise meInit gives it its style's.
  if (hT.plan || aT.plan) st.plan = { home: hT.plan, away: aT.plan };
  const rng = new E.RNG(seed >>> 0 || 7);
  E.meInit(st, E.pitchSlots, rng);
  const out = E.meFreshOut(), mp = st.mePos;
  const P = { home: passBook(), away: passBook() };
  globalThis.__pass = (pp, okSide) => {
    const sd = pp.side, S = P[sd];
    if (!S) return;
    if (pp.sx === undefined) { S.set++; return; }                 // a restart's delivery
    const ok = okSide === sd, k = KIND[pp.k] || "feet";
    S.n++; if (ok) S.ok++;
    S.kn[k]++; if (ok) S.kok[k]++;
    const d = pp.d ?? 0;
    S.d += d; if (d > 30) S.long++; if (pp.high) S.high++;
    const f = fwdOf(sd, (pp.ax ?? pp.sx) - pp.sx);
    S.fwd += f; if (f < -2) S.back++;
    if (dep(sd, pp.sx) < 63) S.own60++;
  };
  globalThis.__shots = [];
  // Goals by what made them, for calibrating the recorder against the physics: the engine reports only the
  // origin, so the scorer is whichever side's count has just gone up.
  const GF = { home: {}, away: {} }; let lastG = { home: 0, away: 0 };
  globalThis.__gfrom = { push(f) { const sd = out.goals.away > lastG.away ? "away" : "home"; lastG = { ...out.goals };
    const k = f === "header" ? "hdr" : f === "penalty" ? "pen" : f === "no shot" || f === "set piece" ? "other" : "foot";
    GF[sd][k] = (GF[sd][k] || 0) + 1; } };
  const O = { last: null, sp: true, lost: { home: -999, away: -999 },
    own: { home: 0, away: 0 }, fin: { home: 0, away: 0 }, reg: { home: [], away: [] },
    def: { home: [0, 0, 0, 0], away: [0, 0, 0, 0] }, atk: { home: [0, 0, 0], away: [0, 0, 0] },
    run: { home: 0, away: 0 }, prev: new Map() };
  for (let t = 0; t < E.ME_MATCH_TICKS + E.meAdded(st); t++) {
    out.min = E.meMinute(t); out.add = E.meAddedMin(t);
    E.meTick(st, rng, out);
    if (mp.sp) { O.sp = true; O.prev.clear(); continue; }
    // How far everyone runs in open play.
    for (const sd of SIDES) for (const p of st.players[sd]) {
      if (!p || p.off || p.pos === "GK") continue;
      const q = O.prev.get(p);
      if (q) O.run[sd] += Math.hypot(p.x - q[0], p.y - q[1]);
      O.prev.set(p, [p.x, p.y]);
    }
    // Whose ball: the man on it, or the side whose pass is travelling.
    const own = mp.idx >= 0 ? mp.side : mp.passPending ? mp.passPending.side : null;
    if (!own) continue;
    if (own !== O.last) {
      if (O.last) {
        O.lost[O.last] = mp.tick;
        if (!O.sp) O.reg[own].push([dep(own, mp.bx), mp.tick - O.lost[own]]);
      }
      O.last = own;
    }
    O.sp = false;
    const D = other(own), bd = dep(own, mp.bx);
    O.own[own]++; if (bd > 70) O.fin[own]++;
    let mn = 999, mx = -999, y0 = 99, y1 = -99;
    for (const p of st.players[D]) {
      if (!p || p.off || p.pos === "GK") continue;
      const d = dep(D, p.x);
      if (d < mn) mn = d; if (d > mx) mx = d; if (p.y < y0) y0 = p.y; if (p.y > y1) y1 = p.y;
    }
    const a = O.def[D]; a[0] += mn; a[1] += mx - mn; a[2] += y1 - y0; a[3]++;
    let z0 = 99, z1 = -99, ah = 0;
    for (const p of st.players[own]) {
      if (!p || p.off || p.pos === "GK") continue;
      if (p.y < z0) z0 = p.y; if (p.y > z1) z1 = p.y; if (dep(own, p.x) > bd) ah++;
    }
    const b = O.atk[own]; b[0] += z1 - z0; b[1] += ah; b[2]++;
  }
  E.meFinalise(st);
  const SH = { home: shotBook(), away: shotBook() };
  for (const r of globalThis.__shots) {
    const S = SH[r.side]; if (!S) continue;
    S.n++; S.xg += r.xg; S.d += r.d; if (r.hdr) S.hdr++;
    if ((r.pt ?? -1) >= 0 && r.pt < 40) { S.fast++; S.xgFast += r.xg; }
    const f = r.hdr ? "hdr" : (r.from || "-");
    const g = f === "hdr" ? "hdr" : f === "cross" ? "cross" : f === "through" || f === "space" || f === "over" ? "thru"
            : f === "feet" ? "feet" : f === "long" || f === "switch" ? "long" : f === "-" ? "solo" : "set";
    S.org[g]++; S.oxg[g] += r.xg;
  }
  globalThis.__pass = null; globalThis.__shots = null; globalThis.__gfrom = null;
  const res = {};
  const pt = out.poss.home + out.poss.away || 1;
  for (const sd of SIDES) {
    const op = other(sd), S = P[sd], H = SH[sd], g = out.goals[sd], ga = out.goals[op];
    const all = [...st.players[sd], ...(st.subbedOff?.[sd] || [])].filter(Boolean);
    const sum = (k) => all.reduce((t, p) => t + (p[k] || 0), 0);
    const on = st.players[sd].filter(p => p && !p.off && p.pos !== "GK");
    const reg = O.reg[sd], dfs = O.def[sd], ats = O.atk[sd];
    const reg42 = reg.filter(r => r[0] > 42).length;
    res[sd] = {
      pts: g > ga ? 3 : g === ga ? 1 : 0, w: +(g > ga), d: +(g === ga), gf: g, ga, xgf: r4(out.xgS?.[sd] ?? 0), xga: r4(out.xgS?.[op] ?? 0),
      poss: r4(out.poss[sd] / pt), terr: r4((out.possX?.[sd] ?? 0) / (out.poss[sd] || 1)), tilt: r4(O.fin[sd] / (O.own[sd] || 1)),
      pass: S.n, cmp: r4(S.ok / (S.n || 1)), plen: r4(S.d / (S.n || 1)), pfwd: r4(S.fwd / (S.n || 1)),
      plong: r4(S.long / (S.n || 1)), pback: r4(S.back / (S.n || 1)), phigh: r4(S.high / (S.n || 1)), setp: S.set,
      ...Object.fromEntries(KS.map(k => ["k_" + k, S.kn[k]])),
      cFeet: r4(S.kok.feet / (S.kn.feet || 1)), cThru: r4(S.kok.thru / (S.kn.thru || 1)),
      cLong: r4((S.kok.long + S.kok.sw + S.kok.over) / ((S.kn.long + S.kn.sw + S.kn.over) || 1)), cCross: r4(S.kok.cross / (S.kn.cross || 1)),
      carry: out.carriesSide?.[sd] ?? 0, drib: sum("dribbles"), tko: sum("takeOns"), disp: sum("duelLost"), aer: sum("aerials"),
      sh: out.shots[sd], sot: out.onTarget[sd], xgps: r4(H.xg / (H.n || 1)), shd: r4(H.d / (H.n || 1)), hdr: r4(H.hdr / (H.n || 1)),
      fast: H.fast, xgFast: r4(H.xgFast), g_hdr: GF[sd].hdr || 0, g_pen: GF[sd].pen || 0, g_foot: GF[sd].foot || 0, g_oth: GF[sd].other || 0,
      ...Object.fromEntries(ORG.map(k => ["o_" + k, H.org[k]])), ...Object.fromEntries(ORG.map(k => ["x_" + k, r4(H.oxg[k])])),
      tkTry: out.tackleTrySide?.[sd] ?? 0, tkWon: out.tackleWonSide?.[sd] ?? 0,
      reg: reg.length, regD: r4(reg.reduce((t, r) => t + r[0], 0) / (reg.length || 1)),
      regH: reg.filter(r => r[0] > 52.5).length, regF: reg.filter(r => r[0] > 70).length, regCP: reg.filter(r => r[1] <= 20).length,
      ppda: r4(P[op].own60 / (reg42 || 1)),
      line: r4(dfs[0] / (dfs[3] || 1)), blen: r4(dfs[1] / (dfs[3] || 1)), dwid: r4(dfs[2] / (dfs[3] || 1)),
      awid: r4(ats[0] / (ats[2] || 1)), ahead: r4(ats[1] / (ats[2] || 1)),
      run: r4(O.run[sd] / 10), stam: r4(on.reduce((t, p) => t + (p.stamina ?? 100), 0) / (on.length || 1)),
      fouls: out.fouls[sd], yel: out.yellows?.[sd] ?? 0, red: out.reds?.[sd] ?? 0, cor: out.corners[sd],
    };
  }
  return res;
}

// ---- the experiment ---------------------------------------------------------------------------
const engines = new Map();
const engineAt = async (path) => {
  const p = path ? resolve(path) : ENGINE;
  if (!engines.has(p)) engines.set(p, await import(pathToFileURL(p).href));
  return engines.get(p);
};

// Opponent, venue and seed from the club and the fixture number alone. Each club starts its run through the
// field at a different place and home and away alternate, so a short run is a fair draw: taken in list order,
// six fixtures a club was the six strongest clubs in the league every time, all at home, and even a side
// playing its opponents' own style measured -0.8 xG a match.
const fixture = (clubs, ci, k) => {
  const field = clubs.filter((_, j) => j !== ci), F = field.length;
  return { opp: field[(k + ci * 7) % F], home: (k + Math.floor(k / F)) % 2 === 0, seed: (90e5 + (k * 131 + 7) * 7919 + ci * 104729) >>> 0 };
};

async function runJob(spec, a, ci, k0, n) {
  const arm = spec.arms[a];
  const E = await engineAt(arm.bundle);
  // An arm may set engine constants (arm.cfg into CFG, arm.mt into MT) for its own matches; they are put
  // back before the worker takes its next job, which may be another arm's.
  const saved = [];
  for (const [tab, over] of [[E.CFG, arm.cfg], [E.MT, arm.mt]]) for (const [k, v] of Object.entries(over || {})) { saved.push([tab, k, tab[k]]); tab[k] = v; }
  try { return await runJobIn(E, spec, arm, ci, k0, n); } finally { for (const [tab, k, v] of saved.reverse()) tab[k] = v; }
}
async function runJobIn(E, spec, arm, ci, k0, n) {
  const E0 = await engineAt(null);
  const clubs = clubList(spec, E0).map(c => E.PRESET_CATALOG.find(t => t.league === spec.field && t.code === c.code));
  const rows = [];
  for (let k = k0; k < k0 + n; k++) {
    const fx = fixture(clubs, ci, k);
    // The fixture is passed too ({ k, ci }), so a spec can give each fixture's opponent its own style: a mixed field.
    const me = (arm.team || spec.team || ((t) => t))(clubs[ci], E, H, { k, ci });
    const op = (arm.opp || spec.opp || ((t) => t))(fx.opp, E, H, { k, ci });
    // arm.seed replays the same fixtures on other dice: replicates of a base arm average its own luck away.
    const sd = (fx.seed + (arm.seed || 0) * 2654435761) >>> 0;
    const r = fx.home ? play(E, me, op, sd) : play(E, op, me, sd);
    const S = fx.home ? r.home : r.away, O = fx.home ? r.away : r.home;
    rows.push({ arm: arm.name, club: clubs[ci].code, k, opp: fx.opp.code, home: fx.home, S, O });
  }
  return rows;
}

const clubList = (spec, E) => {
  const all = E.PRESET_CATALOG.filter(t => t.league === spec.field);
  return spec.clubs && spec.clubs !== "all" ? all.filter(t => spec.clubs.includes(t.code)) : all;
};

// ---- the pool -------------------------------------------------------------------------------------
function pool(W, specPath, onRows) {
  const queue = [], free = [], all = [];
  const give = (c) => { if (!queue.length) { free.push(c); return; } c.job = queue.shift(); c.send(c.job.a); };
  for (let i = 0; i < W; i++) {
    const c = fork(HERE, ["--worker", specPath], { stdio: ["ignore", "inherit", "inherit", "ipc"] });
    c.on("message", (m) => { const j = c.job; c.job = null; if (m.err) j.rej(new Error(m.err)); else { onRows(m.rows); j.res(); } give(c); });
    c.on("exit", (code) => { if (c.job) c.job.rej(new Error(`worker exit ${code} on ${c.job.a.join(" ")}`)); });
    all.push(c); free.push(c);
  }
  return {
    run: (a) => new Promise((res, rej) => { queue.push({ a, res, rej }); if (free.length) give(free.pop()); }),
    close: () => all.forEach(c => c.connected && c.disconnect()),
  };
}

// ---- the summary ----------------------------------------------------------------------------------
export function summarise(rows, base, armOrder) {
  const by = new Map();
  for (const r of rows) { const m = by.get(r.arm) || new Map(); m.set(r.club + "|" + r.k, r.S); by.set(r.arm, m); }
  const B = by.get(base);
  const keys = Object.keys(rows[0].S);
  const lines = [];
  const mean = (v) => v.reduce((t, x) => t + x, 0) / (v.length || 1);
  const se = (v) => { const m = mean(v); return Math.sqrt(v.reduce((t, x) => t + (x - m) ** 2, 0) / Math.max(1, v.length - 1) / Math.max(1, v.length)); };
  for (const arm of armOrder) {
    const A = by.get(arm); if (!A) continue;
    const o = { arm, n: A.size };
    for (const k of keys) {
      const av = [...A.values()].map(s => s[k]);
      o[k] = mean(av);
      if (arm !== base && B) {
        const d = []; for (const [u, s] of A) { const b = B.get(u); if (b) d.push(s[k] - b[k]); }
        o["d_" + k] = mean(d); o["s_" + k] = se(d);
      }
    }
    lines.push(o);
  }
  return lines;
}

const SHOW = ["pts", "gf", "ga", "xgf", "xga", "poss", "terr", "tilt", "pass", "cmp", "plen", "pfwd", "phigh", "k_cross",
  "carry", "drib", "sh", "xgps", "shd", "fast", "reg", "regD", "regCP", "ppda", "line", "blen", "dwid", "awid", "run", "tkTry", "fouls"];
function printTable(lines, base) {
  const fmt = (v) => Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2);
  const head = ["arm".padEnd(22), "n".padStart(5), ...SHOW.map(k => k.padStart(7))].join(" ");
  console.log(head);
  for (const o of lines) {
    const cells = SHOW.map(k => (o.arm === base ? fmt(o[k]) : (o["d_" + k] >= 0 ? "+" : "") + fmt(o["d_" + k])).padStart(7));
    console.log([o.arm.padEnd(22).slice(0, 22), String(o.n).padStart(5), ...cells].join(" "));
  }
}

// ---- entry --------------------------------------------------------------------------------------
if (process.argv[2] === "--worker" && process.send) {
  const spec = (await import(pathToFileURL(resolve(process.argv[3])).href)).default;
  process.on("message", async (a) => {
    let m;
    try { m = { rows: await runJob(spec, ...a) }; } catch (e) { m = { err: String(e?.stack || e) }; }
    process.send(m);
  });
  process.on("disconnect", () => process.exit(0));
} else if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [specS, wS, outS] = process.argv.slice(2);
  if (!specS) { console.error("usage: node test/lab.mjs <spec.mjs> [workers=10] [out.jsonl]"); process.exit(2); }
  const specPath = resolve(specS), W = +(wS || 10), OUT = resolve(outS || `${tmpdir()}/lab.jsonl`);
  const spec = (await import(pathToFileURL(specPath).href)).default;
  const E0 = await engineAt(null);
  const clubs = clubList(spec, E0);
  if (!clubs.length) { console.error("no clubs in", spec.field); process.exit(2); }
  const chunk = spec.chunk || spec.n;
  const jobs = [];
  for (let k0 = 0; k0 < spec.n; k0 += chunk)
    for (let ci = 0; ci < clubs.length; ci++)
      for (let a = 0; a < spec.arms.length; a++) jobs.push([a, ci, k0, Math.min(chunk, spec.n - k0)]);
  // SHARD=i/N plays every Nth job from the i-th, so N machines split one experiment and their records concatenate
  // into exactly the single-machine run: a fixture's opponent, venue and seed belong to the job, not the machine.
  const SH = (process.env.SHARD || "").match(/^(\d+)\/(\d+)$/);
  if (SH) { const mine = jobs.filter((_, j) => j % +SH[2] === +SH[1]); jobs.length = 0; jobs.push(...mine); }
  writeFileSync(OUT, "");
  const rows = [];
  const t0 = Date.now(); let done = 0;
  const p = pool(W, specPath, (rs) => {
    for (const r of rs) { rows.push(r); appendFileSync(OUT, JSON.stringify(r) + "\n"); }
    done++;
    if (done % Math.max(1, Math.round(jobs.length / 40)) === 0 || done === jobs.length) {
      const el = (Date.now() - t0) / 1000, eta = el / done * (jobs.length - done);
      console.error(`${new Date().toLocaleTimeString("en-GB")} ${done}/${jobs.length} jobs, ${rows.length} matches, ${(el / 60).toFixed(1)} min, eta ${(eta / 60).toFixed(1)} min`);
    }
  });
  console.error(`${spec.arms.length} arms x ${clubs.length} clubs x ${spec.n} fixtures = ${spec.arms.length * clubs.length * spec.n} matches on ${W} workers -> ${OUT}`);
  await Promise.all(jobs.map(j => p.run(j)));
  p.close();
  const lines = summarise(rows, spec.base, spec.arms.map(a => a.name));
  writeFileSync(OUT.replace(/\.jsonl$/, "") + ".summary.json", JSON.stringify(lines, null, 1));
  printTable(lines, spec.base);
}
