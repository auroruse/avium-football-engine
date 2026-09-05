// THE BUILT-FOR-IT TEST. For every real style: take one club, re-shape it into the style's natural
// formation the way the app does, then move rating around INSIDE the eleven along the style's own
// fit curve -- until it suits the style as well (FOR) or as badly (AGAINST) as six points a man
// allow -- with the XI mean held to the decimal. Each arm plays the rest of the division both ways round on paired seeds.
// Suitability pays when FOR beats AGAINST in the same style; the right system wins when FOR beats
// itself playing the rival stamp instead.
//
//   node test/style-builtfor.mjs [base=SHZ] [fixtures=150] [workers=10] [league] [shift=6]
//   NT_OUT=<dir> keeps the arms and results as builtfor.json.
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { PRESET_CATALOG, STRAT_DEF, STYLE_PRESET, IDENTITY_KEYS, STYLE_FIT_SPOS, computeStyleFit, fitRoleW,
         refitAs, runPositionalMatch } from "./engine.mjs";

const SHAPE = { wingplay: "4-3-3", tikitaka: "4-1-2-1-2", possession: "4-1-2-1-2", verticaltiki: "4-2-3-1",
  gegenpress: "4-3-3", lanuestra: "4-3-3", counterattack: "4-4-2", routeone: "4-4-2", secondball: "4-1-2-1-2",
  catenaccio: "5-3-2", zonamista: "5-3-2", parkthebus: "5-3-2", cholismo: "4-4-2" };
const RIVAL = (s) => s === "secondball" ? "verticaltiki" : "secondball";
const ROLES = ["wide", "fb", "fwd", "cmid", "def", "gk", "all"];
const side = (base, squad, style, form) => {
  const strategy = { ...STRAT_DEF, timeWasting: base.strategy.timeWasting, gkDist: base.strategy.gkDist, dlBehavior: base.strategy.dlBehavior };
  for (const k of IDENTITY_KEYS) strategy[k] = STYLE_PRESET[style]?.[k] ?? 0;
  return { ...base, style, formation: form, strategy, squad };
};

if (process.argv[2] === "arm") {
  // One arm: a shaped squad, a style, N fixtures against the field.
  const [file, idx, style, form, nS, code, league] = process.argv.slice(3);
  const all = PRESET_CATALOG.filter(t => t.league === league), base = all.find(t => t.code === code);
  const field = all.filter(t => t.code !== code), F = field.length, N = +nS;
  const T = side(base, JSON.parse(readFileSync(file, "utf8"))[+idx], style, form);
  let pts = 0, gf = 0, ga = 0;
  for (let k = 0; k < N; k++) {
    const opp = field[k % F], home = Math.floor(k / F) % 2 === 0;
    const r = runPositionalMatch(home ? T : opp, home ? opp : T, 90e5 + (k * 131 + 7) * 7919, null, false).out;
    const f = home ? r.goals.home : r.goals.away, a = home ? r.goals.away : r.goals.home;
    if (f > a) pts += 3; else if (f === a) pts += 1;
    gf += f; ga += a;
  }
  console.log(JSON.stringify({ ppm: pts / N, gf: gf / N, ga: ga / N }));
  process.exit(0);
}

const [codeS, nS, wS, leagueS, dS] = process.argv.slice(2);
const CODE = codeS || "SHZ", N = +(nS || 150), W = +(wS || 10), LEAGUE = leagueS || "Nichirin League One", D = +(dS || 6);
const OUT = process.env.NT_OUT || tmpdir(), CWD = fileURLToPath(new URL("..", import.meta.url));
const base = PRESET_CATALOG.find(t => t.league === LEAGUE && t.code === CODE);
if (!base) { console.error("no such side", CODE); process.exit(2); }
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
// Rating moved INSIDE the eleven until the squad fits the style as well (FOR) or as badly (AGAINST)
// as D points a man allow: coordinate ascent on computeStyleFit over zero-sum half-point transfers,
// so the XI mean is untouched to the decimal and nobody moves more than D from his listed rating.
// Shifting along the fit weights was tried first and barely moved fit for the broad styles -- a
// style that leans on midfield, defence AND the keeper loses on the keeper what it gains in
// midfield -- so that version measured what a rating point is worth per role, not suitability.
const shaped = (style, form, sign) => {
  const sq = refitAs(base.squad, form).map(p => ({ ...p })), xi = sq.slice(0, 11), o0 = xi.map(p => Number(p.ovr));
  xi.forEach((p, i) => { p.ovr = o0[i]; });
  // The keeper stays put. He is one man carrying up to 0.30 of a style's weight, so the ascent
  // would spend its whole budget on him for every style with a gk term -- and the engine values a
  // keeper more than any outfield role (measured: +6 on the GK is worth +0.25 goals a game, no
  // outfield group clears the noise), so FOR against AGAINST would be measuring the keeper.
  const gk = xi.findIndex(p => (p.spos || p.pos) === "GK");
  const f = () => sign * computeStyleFit(style, sq);
  let best = f();
  for (let pass = 0, moved = true; pass < 80 && moved; pass++) {
    moved = false;
    for (let i = 0; i < 11; i++) for (let j = 0; j < 11; j++) {
      if (i === j || i === gk || j === gk || xi[i].ovr - o0[i] >= D || o0[j] - xi[j].ovr >= D) continue;
      xi[i].ovr += 0.5; xi[j].ovr -= 0.5;
      const v = f(); if (v > best + 1e-9) { best = v; moved = true; } else { xi[i].ovr -= 0.5; xi[j].ovr += 0.5; }
    }
  }
  if (Math.abs(mean(xi.map(p => p.ovr)) - mean(o0)) > 1e-6) throw new Error("XI mean moved");
  return sq;
};
const STYLES = Object.keys(SHAPE), arms = [], jobs = [], meta = [];
for (const s of STYLES) {
  const F = SHAPE[s], hi = shaped(s, F, 1), lo = shaped(s, F, -1);
  const iHi = arms.push(hi) - 1, iLo = arms.push(lo) - 1;
  meta.push({ style: s, form: F, fitHi: computeStyleFit(s, hi), fitLo: computeStyleFit(s, lo), fitRival: computeStyleFit(RIVAL(s), hi),
              xi: [mean(hi.slice(0, 11).map(p => Number(p.ovr))), mean(lo.slice(0, 11).map(p => Number(p.ovr)))] });
  jobs.push([s, iHi, s, F, "for"], [s, iLo, s, F, "against"], [s, iHi, RIVAL(s), F, "rival"]);
}
const ARMS = OUT + "/builtfor-arms.json";
writeFileSync(ARMS, JSON.stringify(arms));
const run = ([, idx, style, form]) => new Promise((res, rej) => { let o = "", e = "";
  const p = spawn("node", [fileURLToPath(import.meta.url), "arm", ARMS, idx, style, form, N, CODE, LEAGUE], { cwd: CWD });
  p.stdout.on("data", b => o += b); p.stderr.on("data", b => e += b);
  p.on("exit", c => c === 0 ? res(JSON.parse(o.trim().split("\n").pop())) : rej(new Error(e.slice(0, 300)))); });
const out = new Array(jobs.length); let next = 0;
await Promise.all(Array.from({ length: W }, async () => { while (next < jobs.length) { const i = next++; out[i] = await run(jobs[i]); } }));
const g = (s, tag) => out[jobs.findIndex(j => j[0] === s && j[4] === tag)];
console.log("base " + CODE + ", " + N + " fixtures an arm, XI mean held, rating moved up to " + D + " along each style's fit weights\n");
console.log("style          shape      fit FOR/AGN   FOR own  AGN own   pays    FOR rival(fit)     own-rival");
let pays = 0, wins = 0;
for (const m of meta) {
  const a = g(m.style, "for"), b = g(m.style, "against"), c = g(m.style, "rival");
  const dp = a.ppm - b.ppm, dr = a.ppm - c.ppm; if (dp > 0) pays++; if (dr > 0) wins++;
  console.log("  " + m.style.padEnd(13) + m.form.padEnd(10) + m.fitHi.toFixed(3) + "/" + m.fitLo.toFixed(3) + "   " + a.ppm.toFixed(2) + "     " + b.ppm.toFixed(2)
    + "    " + (dp >= 0 ? "+" : "") + dp.toFixed(2) + "    " + c.ppm.toFixed(2) + " " + RIVAL(m.style).padEnd(12) + "(" + m.fitRival.toFixed(2) + ")  " + (dr >= 0 ? "+" : "") + dr.toFixed(2));
}
console.log("\nsuitability pays for " + pays + "/" + meta.length + " styles; the built-for squad prefers its own system to the rival for " + wins + "/" + meta.length
  + " (noise at " + N + " paired fixtures is about " + (0.25 * Math.sqrt(200 / N)).toFixed(2) + " ppm between two arms)");
writeFileSync(OUT + "/builtfor.json", JSON.stringify({ base: CODE, N, D, meta, jobs, out }, null, 1));
