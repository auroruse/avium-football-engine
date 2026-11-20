// THE 1936 WORLD CUP, PLAYED OUT. Each tournament is the whole thing on the engine: the eight groups of the
// Cortesia draw as round robins, the fixed World Cup bracket (winners meet runners-up), extra time and kicks in
// every tie, and the third-place match. One line of JSON per tournament: every group's final order, every tie's
// winner, the final's score before any shootout, and the three Golden awards. The Talopedia scores the pick'em
// entries against each line for its projections (scripts/project-pickem-wc1936.mjs there).
//
//   SHARD=i/n WC_MINUTES=70 node test/wc1936.mjs > out.jsonl
//
// The draw is test/wc1936-draw.json ({ groups: { A: [codes] ... } }). Workers fork one per core and play
// tournaments until WC_MINUTES is up, so a shard's output is whole tournaments however far it got. WC_N caps the
// count per worker instead (a local check). Rules are the app's 1935 World Cup preset: neutral grounds, injuries
// on, groups ranked on points, goal difference, goals scored, head-to-head, wins. Not carried between matches:
// suspensions and injuries (every side picks from its full squad each time).
import { fork } from "node:child_process";
import { readFileSync } from "node:fs";
import { cpus } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";

const HERE = fileURLToPath(import.meta.url);
const GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const R16 = [["1A", "2B"], ["1C", "2D"], ["1E", "2F"], ["1G", "2H"], ["1B", "2A"], ["1D", "2C"], ["1F", "2E"], ["1H", "2G"]];
const FEED = { q0: ["r0", "r1"], q1: ["r2", "r3"], q2: ["r4", "r5"], q3: ["r6", "r7"], s0: ["q0", "q1"], s1: ["q2", "q3"], f: ["s0", "s1"] };
const MVP_MIN_SHARE = 0.5;

// A small seeded generator for the draws of lots and the seeds of the matches (mulberry32).
const lots = (seed) => () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

function tournament(E, sides, draw, seed) {
  const rnd = lots(seed), stats = new Map();
  const play = (a, b, ko) => {
    const hT = sides[a], aT = sides[b];
    const r = E.simPositionalMatch(new E.RNG((rnd() * 2 ** 31) >>> 0 || 7), hT.skill, aT.skill, ko, hT.style, aT.style,
      hT.formation, aT.formation, null, hT.strategy, aT.strategy, hT.squad, aT.squad, null, null, true,
      { home: hT.mgmt ?? null, away: aT.mgmt ?? null });
    for (const [sd, code] of [["home", a], ["away", b]]) for (const p of r.playerData[sd]) {
      if (!(p.mins > 0)) continue;
      const k = code + "|" + (p.fullName || p.name);
      const s = stats.get(k) || { team: code, g: 0, min: 0, rt: 0, gp: 0, sv: 0 };
      s.g += p.goals || 0; s.min += p.mins; s.sv += p.saves || 0;
      if (Number.isFinite(p.rating)) { s.rt += p.rating; s.gp++; }
      stats.set(k, s);
    }
    const h = r.ftHome + (r.et?.home || 0), w = r.ftAway + (r.et?.away || 0);
    const win = h > w ? a : w > h ? b : r.pen ? (r.pen.home > r.pen.away ? a : b) : null;
    return { h, w, win };
  };

  const order = {};
  for (const g of GROUPS) {
    const t = draw[g], row = Object.fromEntries(t.map((c) => [c, { pts: 0, gf: 0, ga: 0, w: 0 }])), res = [];
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      const m = play(t[i], t[j], false); res.push([t[i], t[j], m.h, m.w]);
      const A = row[t[i]], B = row[t[j]];
      A.gf += m.h; A.ga += m.w; B.gf += m.w; B.ga += m.h;
      if (m.h > m.w) { A.pts += 3; A.w++; } else if (m.w > m.h) { B.pts += 3; B.w++; } else { A.pts++; B.pts++; }
    }
    const lot = Object.fromEntries(t.map((c) => [c, rnd()]));
    const h2h = (c, set) => res.reduce((s, [x, y, gx, gy]) => !set.has(x) || !set.has(y) ? s
      : s + (x === c ? (gx > gy ? 3 : gx === gy ? 1 : 0) : y === c ? (gy > gx ? 3 : gx === gy ? 1 : 0) : 0), 0);
    const key = (c) => [row[c].pts, row[c].gf - row[c].ga, row[c].gf];
    order[g] = t.slice().sort((x, y) => {
      const kx = key(x), ky = key(y);
      for (let i = 0; i < 3; i++) if (kx[i] !== ky[i]) return ky[i] - kx[i];
      const tied = new Set(t.filter((c) => key(c).every((v, i) => v === kx[i])));
      return (h2h(y, tied) - h2h(x, tied)) || (row[y].w - row[x].w) || (lot[y] - lot[x]);
    });
  }

  const ko = {}, loser = {};
  const seedOf = (s) => order[s[1]][+s[0] - 1];
  const tie = (id, a, b) => { const m = play(a, b, true); ko[id] = m.win; loser[id] = m.win === a ? b : a; return m; };
  R16.forEach(([x, y], i) => tie("r" + i, seedOf(x), seedOf(y)));
  let fin = null;
  for (const id of ["q0", "q1", "q2", "q3", "s0", "s1", "f"]) {
    const [x, y] = FEED[id], a = ko[x], b = ko[y], m = tie(id, a, b);
    if (id === "f") fin = m.win === a ? [m.h, m.w] : [m.w, m.h];
  }
  tie("t", loser.s0, loser.s1);

  // The awards the way the app hands them out: the Golden Boot and the Golden Glove (most saves) to the top of
  // their board, goals breaking a tie, and every man still level shares it; the Golden Ball to the champions'
  // best average rating among those with half the most minutes anyone played.
  const all = [...stats.entries()];
  const top = (v) => { let best = -1, at = []; for (const [k, s] of all) { const x = v(s); if (x > best) { best = x; at = [k]; } else if (x === best) at.push(k); } return best > 0 ? at : []; };
  const bar = Math.max(0, ...all.map(([, s]) => s.min)) * MVP_MIN_SHARE;
  const champ = all.filter(([, s]) => s.team === ko.f && s.gp);
  const pool = champ.filter(([, s]) => s.min >= bar);
  const ball = (pool.length ? pool : champ).reduce((b, e) => {
    if (!b) return e;
    const d = (e[1].rt / e[1].gp - b[1].rt / b[1].gp) || (e[1].g - b[1].g) || (e[1].min - b[1].min);
    return d > 0 ? e : b;
  }, null);
  return { g: order, ko, sc: fin, boot: top((s) => s.g * 1e6), ball: ball ? ball[0] : null, glove: top((s) => s.sv * 1e3 + s.g) };
}

if (process.argv[2] === "worker") {
  const [, , , engine, drawPath, seed0, until, cap] = process.argv;
  const E = await import(pathToFileURL(engine).href);
  const draw = JSON.parse(readFileSync(drawPath, "utf8")).groups;
  const sides = Object.fromEntries(E.PRESET_CATALOG.filter((t) => t.league === "Avium International").map((t) => [t.code, t]));
  for (const c of Object.values(draw).flat()) if (!sides[c]) throw new Error(c + " is not in the international preset");
  for (let k = 0; Date.now() < +until && k < +cap; k++) {
    const t0 = Date.now(), out = tournament(E, sides, draw, (+seed0 + k * 2654435761) >>> 0);
    process.send({ ...out, ms: Date.now() - t0 });
  }
  process.exit(0);
} else {
  const [si, sn] = (process.env.SHARD || "0/1").split("/").map(Number);
  const W = +(process.env.WC_WORKERS || cpus().length), until = Date.now() + +(process.env.WC_MINUTES || 60) * 60e3;
  const cap = +(process.env.WC_N || 1e9);
  const engine = resolve(HERE, "../engine.mjs"), draw = resolve(HERE, "../wc1936-draw.json");
  let live = W;
  for (let w = 0; w < W; w++) {
    const seed = (1936e6 + (si * 997 + w) * 7919 + sn) >>> 0;
    const ch = fork(HERE, ["worker", engine, draw, String(seed), String(until), String(cap)]);
    ch.on("message", (m) => process.stdout.write(JSON.stringify(m) + "\n"));
    ch.on("exit", (code) => { if (code) process.stderr.write(`worker ${w} exited ${code}\n`); if (!--live) process.exit(0); });
  }
}
