// A WHOLE SEASON, FOR ITS TABLES (LAB_TEST=season.mjs on the cloud lab; 23 November 2026, the user: "I expect season-wide
// stats to be normal"). League One, every club home and away to every other: 380 matches a season. Four runners share a
// season (every fourth fixture each), so twenty runners play five seasons on different dice. One line a match: the score
// and every man who played with his goals, assists, rating and saves. Read back by a scratch script, not judged here.
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const L = await import(pathToFileURL(path.join(HERE, "lab.mjs")).href);
const m = (process.env.SHARD || "0/4").match(/^(\d+)\/(\d+)$/), i = +m[1];
const R = +(process.env.SEASON_RUNNERS || 4), season = Math.floor(i / R), part = i % R;   // SEASON_RUNNERS shares a season wider, for a shorter run
// SEASON_PLAN names what each of the five seasons is played on: "now" (the build), "head" (test/engine-head.mjs, the
// engine as last committed, with the squads it was built with) or "strip" (the build, every man without his traits).
const variant = (process.env.SEASON_PLAN || "").split(",")[season] || "now";
// "pub": the app as published, engine and records both (test/headsnap, a copy of the last commit built there), played the app's way.
const E = await import(pathToFileURL(path.join(HERE, variant === "pub" ? "headsnap/test/engine.mjs" : variant === "head" ? "engine-head.mjs" : "engine.mjs")).href);
const clubs = E.PRESET_CATALOG.filter(t => t.league === (process.env.SEASON_LEAGUE || "Nichirin League One"))
  .map(t => (variant === "strip" || variant === "appstrip" ? { ...t, squad: t.squad.map(p => ({ ...p, badges: [] })) } : t));
let ST = null; globalThis.__tick = (st) => { ST = st; };
let k = 0;
// SEASON_ONLY: "A+B_vs_C+D" plays only the fixtures between a club of the first list and a club of the second, home and
// away; SEASON_REP plays each of them that many times on different dice (the line's r).
const ONLY = (process.env.SEASON_ONLY || "").split("_vs_").map(x => x.split("+").filter(Boolean)), REP = +(process.env.SEASON_REP || 1);
for (let h = 0; h < clubs.length; h++) for (let a = 0; a < clubs.length; a++) for (let rep = 0; rep < REP; rep++) {
  if (h === a) continue;
  // (SEASON_HOME: only the fixtures with the first list's club at home.)
  if (ONLY.length === 2 && !((ONLY[0].includes(clubs[h].code) && ONLY[1].includes(clubs[a].code)) || (!process.env.SEASON_HOME && ONLY[1].includes(clubs[h].code) && ONLY[0].includes(clubs[a].code)))) continue;
  const idx = k++; if (idx % R !== part) continue;
  const seed = (7e6 + (process.env.SEASON_SAME ? 0 : season + +(process.env.SEASON_BASE || 0)) * 100003 + idx * 7919) >>> 0;   // SEASON_SAME: every season on the same dice
  // "app": the match as the app's own season plays it (src/sim/core.ts simPositionalMatch): the home side's advantage,
  // injuries on, the managers reading the opponent before kick-off. (No lay-offs or bans between matches: every man is
  // back for the next one.)
  // SEASON_MT: the second brain's tuning for each season in turn, "key=value+key=value" a season, commas between seasons.
  for (const kv of ((process.env.SEASON_MT || "").split(",")[season] || "").split("+")) { const [k, v] = kv.split("="); if (k && v !== undefined) E.MT[k.trim()] = +v; }
  // "appnt": the app's way with no manager naming a man to mark (manager.ts, meThreatPlan).
  if (variant === "appnt") globalThis.__noThreats = true;
  // SEASON_OFF: the manager behaviours of 23 November switched off for each season in turn ("won+poor+respect+memo+sp" a
  // season, commas between seasons): stars off in a match that is over, the poor game and the booked man, respect for a
  // stronger eleven, the last meeting, the corner's best header (manager.ts, match.ts meCoachSubs).
  // SEASON_CFG: the engine's settings for each season in turn, the same way as SEASON_MT ("penWonTakes=0.25").
  for (const kv of ((process.env.SEASON_CFG || "").split(",")[season] || "").split("+")) { const [k, v] = kv.split("="); if (k && v !== undefined) E.CFG[k.trim()] = +v; }
  globalThis.__mgrOff = Object.fromEntries(((process.env.SEASON_OFF || "").split(",")[season] || "").split("+").filter(Boolean).map(k => [k.trim(), 1]));
  if (variant === "app" || variant === "pub" || variant === "appstrip" || variant === "appnt") { const H = clubs[h], A = clubs[a];
    let LG = null; globalThis.__mgrLog = (l) => { LG = l; };
    const sr = E.simPositionalMatch(new E.RNG(seed), H.skill, A.skill, false, H.style, A.style, H.formation, A.formation, "home",
      H.strategy, A.strategy, H.squad, A.squad, null, null, true, { home: H.mgmt ?? null, away: A.mgmt ?? null });
    const P = [];
    for (const [sd, t] of [["home", H], ["away", A]]) for (const p of sr.playerData[sd])
      P.push([t.code, p.fullName || p.name, p.pos, p.mins ?? 0, p.goals || 0, p.assists || 0, +(p.rating ?? 0).toFixed(2), p.saves || 0, p.ovr0 ?? p.ovr]);
    console.log(JSON.stringify({ s: season + +(process.env.SEASON_BASE || 0), v: variant, r: rep, m: idx,
      // the dugout log, both sides: [side 0/1, minute, kind, text]
      L: ["home", "away"].flatMap((sd, n) => (LG?.[sd] || []).map(e => [n, e.min, e.k, e.t])), h: H.code, a: A.code, gh: sr.ftHome, ga: sr.ftAway, yh: sr.cards.home.yellows, ya: sr.cards.away.yellows,
      rh: sr.cards.home.reds, ra: sr.cards.away.reds, inj: sr.cards.home.injuries + sr.cards.away.injuries, P,
      // every goal in order of the clock: side, scorer, minute, added minute, penalty, own goal (credited to the side it counted for)
      G: [...["home", "away"].flatMap(sd => (sr.scorers[sd] || []).map(g => [sd === "home" ? 0 : 1, g.full || g.name, g.min, g.add || 0, g.pen ? 1 : 0, 0])),
          ...["home", "away"].flatMap(sd => (sr.ogs[sd] || []).map(g => [sd === "home" ? 0 : 1, g.full || g.name, g.min, g.add || 0, 0, 1]))]
        .sort((x, y) => x[2] + x[3] - y[2] - y[3]) }));
    continue; }
  const r = L.play(E, clubs[h], clubs[a], seed);
  const P = [];
  for (const [sd, t] of [["home", clubs[h]], ["away", clubs[a]]]) for (const p of [...ST.players[sd], ...(ST.subbedOff?.[sd] || [])].filter(Boolean))
    P.push([t.code, p.fullName || p.name, p.spos || p.pos, p.mins ?? 0, p.goals || 0, p.assists || 0, +(p.rating ?? 0).toFixed(2), p.saves || 0, p.ovr0 ?? p.ovr]);
  console.log(JSON.stringify({ s: season, v: variant, m: idx, h: clubs[h].code, a: clubs[a].code, gh: r.home.gf, ga: r.away.gf, xh: r.home.xgf, xa: r.away.xgf, yh: r.home.yel, ya: r.away.yel, rh: r.home.red, ra: r.away.red, P }));
}
