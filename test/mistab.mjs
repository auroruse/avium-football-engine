// THE MISTAKES, BY SITUATION (24 November 2026). The same fixtures on the same seeds under each set of mistake settings,
// counted by what the man on the ball was facing rather than as one completion figure: how close the nearest opponent
// was to the passer and to the man he played to, whether the ball was played first time, what kind of ball it was, and
// whether the first touch held. Half the fixtures are League One, half the sixteen strongest national sides.
//   LAB_TEST=mistab.mjs on the cloud (SHARD=i/n, each shard on all its cores)
//   MIS_ARMS  which versions (default all)      MIS_N  fixtures a version (800)
//   MIS_LENS  match lengths to play each version at, e.g. "16,17,18" (needs a build that reads SIM_MIN; lab branch only)
//   node test/mistab.mjs merge <dir>   the table, from the downloaded rows
import { spawn } from "node:child_process";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

// What the settings were before the round of 22 November, and what they are in the working tree now.
const BEFORE = { passNoisePress: 2.5, passNoiseSkill: 6.8, powerNoiseSkill: 0.11, execNoiseDeg: 7, execPow: 0.10, execSkillLoss: 0.55,
  execShotLoss: 0.45, execSkill: 0.6, ftDp: 0.30, judgeErr: 0.06, ttbAnticip: 0.50, cutAntLo: 0.404, cutAntW: 0.80, "MT.scanLo": 0.14,
  pressQLo: 1, pressQHi: 1, pressMind: 0 };
const NOW = { passNoisePress: 6.5, passNoiseSkill: 8, powerNoiseSkill: 0.13, execNoiseDeg: 11, execPow: 0.145, execSkillLoss: 0.62,
  execShotLoss: 0.68, execSkill: 0.45, ftDp: 0.45, judgeErr: 0.082, ttbAnticip: 0.90, cutAntLo: 0.27, cutAntW: 1.0, "MT.scanLo": 0.11,
  pressQLo: 0.4, pressQHi: 1.45, pressMind: 0.35 };
const pick = (ks) => Object.fromEntries(ks.map(k => [k, BEFORE[k]]));
const ALL = {
  now: {},
  before: BEFORE,
  // halfway on every setting, the quality-weighted pressure kept
  mid: { ...Object.fromEntries(Object.keys(BEFORE).map(k => [k, +((BEFORE[k] + NOW[k]) / 2).toFixed(4)])), pressQLo: 0.4, pressQHi: 1.45, pressMind: 0.35 },
  // the proposal: nothing unforced (choice, awareness and the unpressed strike as before), pressure felt only from close
  // (4 m, not 6), a first-time ball dearer than before but the best passers spared more of it
  p1: { judgeErr: 0.06, "MT.scanLo": 0.14, passNoiseSkill: 6.8, powerNoiseSkill: 0.11, ftDp: 0.38,
        execNoiseDeg: 9, execPow: 0.12, execSkill: 0.6, execSkillLoss: 0.58 },
  // THE SECOND RUN. c1: what nobody forced goes back (choice, awareness, the unpressed strike), the touch under a man
  // eased; c2: the same with a free man's touch surer still. snap is the engine of 22 November 13:52 (a bundle built
  // from lab/eafc-nl1, test/engine-snap.mjs, on the lab branch only) and nb plays without traits, which it never had.
  c1: { judgeErr: 0.06, "MT.scanLo": 0.14, passNoiseSkill: 6.8, powerNoiseSkill: 0.11, ftDp: 0.36 },
  c2: { judgeErr: 0.06, "MT.scanLo": 0.14, passNoiseSkill: 6.8, powerNoiseSkill: 0.11, ftDp: 0.36, ftFree: 0.7 },
  snap: { __eng: "snap", __nb: 1 },
  nowNB: { __nb: 1 },
  beforeNB: { ...BEFORE, __nb: 1 },
  // one group at a time put back to what it was, everything else as now
  k_press: pick(["passNoisePress"]),
  k_qual: pick(["pressQLo", "pressQHi", "pressMind"]),
  k_skill: pick(["passNoiseSkill", "powerNoiseSkill"]),
  k_exec: pick(["execNoiseDeg", "execPow", "execSkillLoss", "execSkill"]),
  k_shot: pick(["execShotLoss"]),
  k_touch: pick(["ftDp"]),
  k_mind: pick(["judgeErr", "MT.scanLo"]),
  k_cut: pick(["ttbAnticip", "cutAntLo", "cutAntW"]),
};
if (process.env.MIS_EXTRA) Object.assign(ALL, JSON.parse(process.env.MIS_EXTRA));     // more versions without a new file
const ARMS = (process.env.MIS_ARMS || Object.keys(ALL).join(",")).split(","), N = +(process.env.MIS_N || 800);
// MIS_PLAN="16:c1;17:c1,c2;18:c1,snap": which versions at which match length (in place of MIS_ARMS and MIS_LENS)
const PLAN = (process.env.MIS_PLAN || "").split(";").filter(Boolean).map(x => x.split(":"));
const LENS = PLAN.length ? PLAN.map(x => x[0]) : (process.env.MIS_LENS || "").split(",").filter(Boolean);

if (process.argv[2] === "merge") {
  const dir = process.argv[3], files = fs.readdirSync(dir, { recursive: true }).filter(f => String(f).endsWith(".jsonl")).map(f => path.join(dir, String(f)));
  const rows = files.flatMap(f => fs.readFileSync(f, "utf8").split("\n").filter(l => l.startsWith("[")).map(l => JSON.parse(l)));
  console.log(`${rows.length} rows from ${files.length} files`);
  const cols = [...new Set(rows.map(r => r[0]))].sort((a, b) => (ARMS.indexOf(a.split("@")[0]) - ARMS.indexOf(b.split("@")[0])) || a.localeCompare(b));
  const base = cols.find(c => c.startsWith("now")) || cols[0];
  const table = (label, R) => {
    if (!R.length) return;
    console.log(`\n=== ${label} ===`);
    const by = Object.fromEntries(cols.map(c => [c, R.filter(r => r[0] === c)]));
    const S = Object.fromEntries(cols.map(c => { const s = {}; for (const r of by[c]) for (const [k, v] of Object.entries(r[5])) s[k] = (s[k] || 0) + v; return [c, s]; }));
    const line = (name, f, dp = 1) => console.log(name.padEnd(40) + cols.map(c => { const v = f(S[c], by[c]); return (v == null || Number.isNaN(v) ? "-" : v.toFixed(dp)).padStart(9); }).join(""));
    console.log("".padEnd(40) + cols.map(c => c.padStart(9)).join(""));
    const pm = (k) => (s, r) => (s[k] || 0) / r.length, pc = (a, b) => (s) => 100 * (s[a] || 0) / (s[b] || NaN);
    const sum = (s, re) => Object.entries(s).filter(([k]) => re.test(k)).reduce((a, [, v]) => a + v, 0);
    const pcr = (reA, reB) => (s) => 100 * sum(s, reA) / (sum(s, reB) || NaN);
    line("matches", (s, r) => r.length, 0);
    line("goals a match", pm("goals"), 2);
    line("  (se)", (s, r) => { const g = r.map(x => x[5].goals || 0), m = g.reduce((a, b) => a + b, 0) / g.length; return Math.sqrt(g.reduce((a, b) => a + (b - m) ** 2, 0) / (g.length - 1) / g.length); }, 2);
    line("  against now, same fixtures", (s, r) => { const m = new Map(by[base].map(x => [x[1], x[5].goals || 0])); const d = r.filter(x => m.has(x[1])).map(x => (x[5].goals || 0) - m.get(x[1])); return d.reduce((a, b) => a + b, 0) / d.length; }, 2);
    line("xG a match", pm("xg"), 2);
    line("shots a match", pm("shots"), 1);
    line("  from 18 m and out", pm("shd_far_n"), 1);
    line("  first-time shots", pm("sh_ft_n"), 1);
    line("  first-time xG", pm("sh_ft_xg"), 2);
    line("pass % (engine's own count)", pc("passOk", "passes"));
    line("passes a match", pm("passes"), 0);
    console.log("-- on the ground, with time on the ball: completion by how close the nearest opponent is to the passer");
    for (const [pcN, lab] of [["free", "6 m or more"], ["loose", "4 to 6 m"], ["near", "2 to 4 m"], ["tight", "under 2 m"]]) {
      line(`  ${lab}: share of passes %`, (s) => 100 * sum(s, new RegExp(`^g_tm_${pcN}_._n$`)) / sum(s, /^g_tm_.*_n$/));
      line(`  ${lab}: completed %`, pcr(new RegExp(`^g_tm_${pcN}_._ok$`), new RegExp(`^g_tm_${pcN}_._n$`)));
      line(`    short (under 15 m) %`, pc(`g_tm_${pcN}_s_ok`, `g_tm_${pcN}_s_n`));
    }
    line("simple ball (short, both men free) %", pc("simple_ok", "simple_n"));
    line("  ...and still theirs 2 s later %", pc("simple_kept", "simple_n"));
    console.log("-- first time");
    line("  first-time share of ground passes %", (s) => 100 * sum(s, /^g_ft_.*_n$/) / sum(s, /^g_(ft|tm)_.*_n$/));
    line("  first-time completed %", pcr(/^g_ft_.*_ok$/, /^g_ft_.*_n$/));
    line("    passer has 4 m or more %", pcr(/^g_ft_(free|loose)_._ok$/, /^g_ft_(free|loose)_._n$/));
    line("    passer has under 4 m %", pcr(/^g_ft_(near|tight)_._ok$/, /^g_ft_(near|tight)_._n$/));
    console.log("-- other balls");
    line("  through balls a match", pm("thru_n"));
    line("  through completed %", pc("thru_ok", "thru_n"));
    line("  through out of play %", pc("thru_out", "thru_n"));
    line("  long high balls completed %", pc("hi_long_ok", "hi_long_n"));
    line("  crosses a match", pm("hi_cross_n"));
    line("  crosses completed %", pc("hi_cross_ok", "hi_cross_n"));
    line("  open-play passes cut out a match", (s, r) => sum(s, /^(g_.*|thru|hi_.*)_int$/) / r.length);
    line("  open-play passes run dead a match", (s, r) => sum(s, /^(g_.*|thru|hi_.*)_dead$/) / r.length);
    console.log("-- first touch (open play): how often it gets away, by the nearest opponent");
    for (const [nc, lab] of [["free", "4 m or more"], ["near", "2 to 4 m"], ["tight", "under 2 m"]]) {
      line(`  ${lab}: lost %`, pc(`ft_op_${nc}_fail`, `ft_op_${nc}_n`), 2);
      line(`  ${lab}: touches a match`, pm(`ft_op_${nc}_n`), 0);
    }
    line("  first touches lost a match", (s, r) => sum(s, /^ft_.*_fail$/) / r.length);
    console.log("-- throw-ins");
    line("  throws a match", (s, r) => ((s.thr_free_n || 0) + (s.thr_mkd_n || 0)) / r.length);
    line("  to a free man (4 m) %", (s) => 100 * (s.thr_free_n || 0) / ((s.thr_free_n || 0) + (s.thr_mkd_n || 0)));
    line("  free man: reaches him %", pc("thr_free_ok", "thr_free_n"));
    line("  free man: cut out %", pc("thr_free_int", "thr_free_n"));
    line("  free man: dead or out %", pc("thr_free_dead", "thr_free_n"));
    line("  free man: still theirs after 3 s %", pc("thr_free_kept", "thr_free_n"));
    line("  marked man: still theirs after 3 s %", pc("thr_mkd_kept", "thr_mkd_n"));
    line("  first touch on a throw lost %", pcr(/^ft_thr_.*_fail$/, /^ft_thr_.*_n$/), 2);
    line("    with 4 m or more %", pc("ft_thr_free_fail", "ft_thr_free_n"), 2);
    console.log("-- final third");
    line("  spells on the ball a match", pm("f3ep_n"));
    line("  seconds on the ball a spell", (s) => 0.25 * (s.f3ep_ticks || 0) / (s.f3ep_n || NaN), 2);
    line("  spells ending with them losing it %", pc("f3ep_lost", "f3ep_n"));
    line("  passes from there completed %", pc("f3p_ok", "f3p_n"));
    line("live turnovers a match", pm("turnover_live"));
    console.log("-- running with the ball: where the ball is");
    line("  in front %", pc("carry_front", "carry_n"));
    line("  at his side %", pc("carry_side", "carry_n"));
    line("  behind him %", pc("carry_behind", "carry_n"));
    line("tackles a match", pm("tackles"));
    console.log("-- the stronger side (4 points or more) against the weaker");
    line("  stronger side pass %", pc("str_ok", "str_n"));
    line("  weaker side pass %", pc("wk_ok", "wk_n"));
    line("  stronger side goals a match", (s) => (s.str_g || 0) / (s.str_m || NaN), 2);
    line("  weaker side goals a match", (s) => (s.wk_g || 0) / (s.str_m || NaN), 2);
  };
  table("ALL", rows); table("LEAGUE ONE", rows.filter(r => r[2] === "NL1")); table("NATIONAL TOP 16", rows.filter(r => r[2] === "NT"));
  process.exit(0);
}

const [si, sn] = (process.env.SHARD || "0/1").split("/").map(Number);
const mine = []; for (let k = 0; k < N; k++) if (k % sn === si) mine.push(k);

if (process.env.MIS_CHILD != null) {
  const [ci, cn] = process.env.MIS_CHILD.split("/").map(Number);
  const E = await import("./engine.mjs"), SNAP = ARMS.some(a => ALL[a]?.__eng === "snap") ? await import("./engine-snap.mjs") : null;
  const CFG0 = { ...E.CFG }, MT0 = { ...E.MT };
  // every setting any version touches goes back to the build's own value first, so nothing leaks from one into the next
  const EVERY = [...new Set(Object.values(ALL).flatMap(o => Object.keys(o)).concat(Object.keys(NOW)).filter(k => !k.startsWith("__")))];
  const setArm = (o0) => { const o = Object.fromEntries(Object.entries(o0).filter(([k]) => !k.startsWith("__")));
    for (const k of EVERY) { if (k.startsWith("MT.")) E.MT[k.slice(3)] = MT0[k.slice(3)]; else E.CFG[k] = CFG0[k]; }
    for (const [k, v] of Object.entries(o)) { if (k.startsWith("MT.")) E.MT[k.slice(3)] = v; else E.CFG[k] = v; } };
  const nl1 = E.PRESET_CATALOG.filter(t => t.league === "Nichirin League One");
  const nat = E.PRESET_CATALOG.filter(t => t.league === "Avium International" && t.squad?.length).sort((a, b) => b.skill - a.skill).slice(0, 16);
  const pairsOf = (n) => { const p = []; for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) if (a !== b) p.push([a, b]); return p; };
  const P1 = pairsOf(nl1.length), P2 = pairsOf(nat.length);
  const PL = 105, PW = 68, SET = new Set(["throw", "longthrow", "corner", "freekick", "goalkick", "kickoff", "set"]);
  const tag = process.env.SIM_MIN ? "@" + process.env.SIM_MIN : "";

  const bare = (t) => ({ ...t, squad: t.squad.map(p => ({ ...p, badges: [] })) });
  const play = (E, hT, aT, seed) => {
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
    const out = E.meFreshOut(), c = {}, add = (k, v = 1) => { c[k] = (c[k] || 0) + v; };
    const other = (sd) => sd === "home" ? "away" : "home";
    const nearOpp = (sd, x, y) => { let d = 99; for (const o of st.players[other(sd)]) if (o && !o.off) d = Math.min(d, Math.hypot(o.x - x, o.y - y)); return d; };
    const strong = Math.abs(hT.skill - aT.skill) >= 4 ? (hT.skill > aT.skill ? "home" : "away") : null;
    let tick = 0; const watch = [];
    globalThis.__shots = [];
    globalThis.__strike = (pp) => { pp._dp = nearOpp(pp.side, pp.sx, pp.sy); const q = st.players[pp.side]?.[pp.fj]; pp._dr = q ? nearOpp(pp.side, q.x, q.y) : 99; };
    globalThis.__pass = (pp, okSide, bx, by) => {
      const ok = okSide === pp.side, k = pp.k || "set", res = ok ? "ok" : okSide == null ? "dead" : "int";
      add("k_" + k + "_n"); if (ok) add("k_" + k + "_ok");
      if (strong) { const w = pp.side === strong ? "str" : "wk"; add(w + "_n"); if (ok) add(w + "_ok"); }
      if (k === "throw" || k === "longthrow") { const fr = (pp._dr ?? 99) >= 4 ? "free" : "mkd";
        add(`thr_${fr}_n`); add(`thr_${fr}_${res}`); watch.push({ t: tick + 12, side: pp.side, key: `thr_${fr}_kept` }); return; }
      if (SET.has(k)) return;
      const dp = pp._dp ?? 99, pcN = dp < 2 ? "tight" : dp < 4 ? "near" : dp < 6 ? "loose" : "free";
      if ((pp.side === "home" ? pp.sx > PL * 2 / 3 : pp.sx < PL / 3)) { add("f3p_n"); add("f3p_" + res); }
      if (pp.thru) { add("thru_n"); add("thru_" + res); if (bx < 0 || bx > PL || by < 0 || by > PW) add("thru_out"); return; }
      if (pp.high) { const lc = k === "cross" ? "cross" : pp.d >= 30 ? "long" : "chip"; add(`hi_${lc}_n`); add(`hi_${lc}_${res}`); return; }
      const lc = pp.d < 15 ? "s" : pp.d < 30 ? "m" : "l", ft = pp.ft ? "ft" : "tm";
      add(`g_${ft}_${pcN}_${lc}_n`); add(`g_${ft}_${pcN}_${lc}_${res}`);
      if (!pp.ft && lc === "s" && dp >= 4 && (pp._dr ?? 99) >= 4) { add("simple_n"); add("simple_" + res); if (ok) watch.push({ t: tick + 8, side: pp.side, key: "simple_kept" }); }
    };
    globalThis.__pftk = { push(e) {
      const m = st.mePos; let best = null, bd = 99, bs = null;
      for (const sd of ["home", "away"]) for (const p of st.players[sd]) if (p && !p.off) { const d = Math.hypot(p.x - m.bx, p.y - m.by); if (d < bd) { bd = d; best = p; bs = sd; } }
      const near = best ? nearOpp(bs, best.x, best.y) : 99, nc = near < 2 ? "tight" : near < 4 ? "near" : "free";
      const kk = e.k === "throw" || e.k === "longthrow" ? "thr" : "op";
      add(`ft_${kk}_${nc}_n`); if (!e.ok) add(`ft_${kk}_${nc}_fail`);
    } };
    let prev = null, ep = null;
    for (let t = 0; t < E.ME_MATCH_TICKS + E.meAdded(st); t++) {
      out.min = E.meMinute(t); out.add = E.meAddedMin(t); tick = t;
      E.meTick(st, rng, out);
      const m = st.mePos, cr = m.idx >= 0 && !m.sp ? st.players[m.side][m.idx] : null;
      // where the ball is while he runs with it: in front, at his side, behind
      if (cr && cr.pos !== "GK") { const vx = (cr._pvx ?? cr.vx ?? 0) / E.ME_DT, vy = (cr._pvy ?? cr.vy ?? 0) / E.ME_DT, sp = Math.hypot(vx, vy);
        const gx = m.bx - cr.x, gy = m.by - cr.y, g = Math.hypot(gx, gy);
        if (sp > 2.5 && g > 0.15 && g < 3) { const cs = (vx * gx + vy * gy) / (sp * g); add("carry_n"); add(cs < -0.1 ? "carry_behind" : cs < 0.5 ? "carry_side" : "carry_front"); } }
      const f3 = cr ? (m.side === "home" ? cr.x > PL * 2 / 3 : cr.x < PL / 3) : false;
      if (prev && prev.idx >= 0 && m.idx >= 0 && m.side !== prev.side && !m.sp) add("turnover_live");
      prev = { idx: m.idx, side: m.side };
      for (const w of watch) if (!w.done && t >= w.t) { w.done = 1;
        if (m.sp ? m.sp.side === w.side : m.idx >= 0 ? m.side === w.side : m.lastSide === w.side) add(w.key); }
      const key = cr ? m.side + m.idx : null;
      if (ep && ep.key !== key) { add("f3ep_n"); add("f3ep_ticks", t - ep.t); if (m.idx >= 0 && m.side !== ep.side && !m.sp) add("f3ep_lost"); ep = null; }
      if (cr && !ep && f3) ep = { key, t, side: m.side };
    }
    E.meFinalise(st);
    for (const sh of globalThis.__shots) { const db = sh.d < 11 ? "close" : sh.d < 18 ? "box" : "far";
      add(`shd_${db}_n`); add(`shd_${db}_xg`, sh.xg || 0); if (sh.ft && !sh.hdr) { add("sh_ft_n"); add("sh_ft_xg", sh.xg || 0); } if (sh.hdr) add("sh_hdr_n"); }
    add("goals", out.goals.home + out.goals.away); add("xg", (out.xgS?.home || 0) + (out.xgS?.away || 0));
    add("shots", out.shots.home + out.shots.away); add("passes", out.passes); add("passOk", out.passOk); add("tackles", out.tackles || 0);
    add("fouls", (out.fouls?.home || 0) + (out.fouls?.away || 0));
    if (strong) { add("str_m"); add("str_g", out.goals[strong]); add("wk_g", out.goals[other(strong)]); }
    for (const k of Object.keys(c)) c[k] = +c[k].toFixed(3);
    return c;
  };

  mine.forEach((k, j) => { if (j % cn !== ci) return;
    const lv = k % 2 === 0 ? "NL1" : "NT", h = k >> 1, T = lv === "NL1" ? nl1 : nat, P = lv === "NL1" ? P1 : P2;
    const [a, b] = P[(h * (lv === "NL1" ? 319 : 239)) % P.length];
    for (const arm of ARMS) { const A = ALL[arm] || {}; setArm(A);
      const c = play(A.__eng === "snap" ? SNAP : E, A.__nb ? bare(T[a]) : T[a], A.__nb ? bare(T[b]) : T[b], 91e5 + k * 7919 + 13);
      console.log(JSON.stringify([arm + (A.__eng ? "" : tag), k, lv, T[a].skill, T[b].skill, c])); }
  });
  process.exit(0);
}

const W = Math.max(1, +(process.env.MIS_W || availableParallelism()));
const jobs = (LENS.length ? LENS : [""]).flatMap(L => Array.from({ length: W }, (_, i) => [L, i]));
// every length gets the cores in turn: W children at a time
for (let o = 0; o < jobs.length; o += W) await Promise.all(jobs.slice(o, o + W).map(([L, i]) => new Promise((res, rej) => {
  const c = spawn("node", [fileURLToPath(import.meta.url)], { env: { ...process.env, MIS_CHILD: `${i}/${W}`, ...(L ? { SIM_MIN: L } : {}), ...(PLAN.length ? { MIS_ARMS: PLAN.find(x => x[0] === L)[1] } : {}) }, stdio: ["ignore", "pipe", "inherit"] });
  c.stdout.on("data", (b) => process.stdout.write(b));
  c.on("exit", (code) => code === 0 ? res() : rej(new Error("child " + i + " exit " + code)));
})));
