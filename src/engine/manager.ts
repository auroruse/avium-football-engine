// THE MANAGER. Before a match he reads the opponent and sets his side up: his own style, or the one beside it
// when his read says his own is the wrong one for this opponent. During it he changes things when it is going
// wrong and when he loses a man. How well he reads any of it is his rating (MANAGER), and nothing else about him
// exists. Team selection and rotation, which plan around the fixture list, live with the squad (App.tsx,
// managerSelect).
//
// What he knows is what the engine measurably does: ME_MATCHUP is the xG a match each style is worth against
// each other at level squads (matchup.ts, measured in test/lab.mjs). A good manager reads it nearly true; a poor
// one misreads the opponent and the matchup both, so his changes are right far less often and worth far less.
// Styles are keyed by the ids the registry uses (tactics.ts, ME_STYLE_DEF).
import { ME_MGR, ME_STRAT_RANGE } from "./config";
import { mePlanOf, meStrategyOf, ME_STYLE_NAME } from "./tactics";
import { ME_MATCHUP } from "./matchup";
import { formAtkW, meFormAdj, sposFor } from "./formations";
import { meHungarian } from "./assignment";
import { traitId, traitLv } from "../data/badges.js";
import { ovrAt } from "../data/positions.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// HOW WELL HE READS IT, 0..1: the same scale the drilling has always used (mind/team.ts).
export const meMgrQ = (mgmt) => clamp(((mgmt ?? ME_MGR.mgmtDef) - 40) / 50, 0, 1);

// A number of his own for this fixture: the same manager reading the same fixture reads it the same way.
function hash01(...xs) {
  let h = 0x811c9dc5;
  for (const x of xs) for (const c of String(x)) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
}
const gauss = (u1, u2) => Math.sqrt(-2 * Math.log(Math.max(1e-9, u1))) * Math.cos(2 * Math.PI * u2);

// THE STYLES BESIDE EACH STYLE, the only ones a manager will move to: the three that play most like it,
// measured on how the styles actually play against every other one (possession, passing, pressing, line,
// crosses...; the matchup run of 8 Oct 2026, written by test/mkmatchup.mjs).
export const ME_STYLE_ADJ = {
  tikitaka: ["possession", "balanced", "wingplay"],
  possession: ["tikitaka", "balanced", "wingplay"],
  verticaltiki: ["balanced", "lanuestra", "wingplay"],
  gegenpress: ["secondball", "wingplay", "verticaltiki"],
  lanuestra: ["routeone", "balanced", "verticaltiki"],
  wingplay: ["balanced", "verticaltiki", "gegenpress"],
  routeone: ["lanuestra", "balanced", "secondball"],
  secondball: ["gegenpress", "routeone", "lanuestra"],
  counterattack: ["catenaccio", "zonamista", "routeone"],
  cholismo: ["balanced", "zonamista", "wingplay"],
  zonamista: ["cholismo", "balanced", "catenaccio"],
  catenaccio: ["zonamista", "counterattack", "cholismo"],
  parkthebus: ["zonamista", "cholismo", "catenaccio"],
  balanced: ["wingplay", "verticaltiki", "lanuestra"],
};
// HOW MUCH EACH STYLE ATTACKS: xG a match it creates over Balanced, against an even mix of every style at level
// squads (the same run). What he leans on when he has to win, and away from when a point will do.
export const ME_STYLE_ATTACK = {
  tikitaka: 0.19, wingplay: 0.15, counterattack: 0.07, verticaltiki: 0.06, gegenpress: 0.06, secondball: 0.04,
  routeone: 0.02, lanuestra: 0.01, balanced: 0.00, catenaccio: -0.11, cholismo: -0.12, zonamista: -0.15,
  possession: -0.18, parkthebus: -0.20,
};

export const ME_MGR_READ = {
  oppRight: 0.55,     // chance a manager of no ability reads the opponent's style right...
  oppSkill: 0.42,     // ...and how much more the best one does
  errLo: 0.04,        // xG a match of misjudgement in the best manager's read of a matchup...
  errHi: 0.20,        // ...and in the worst one's
  leaveLo: 0.25,      // how much better for THIS opponent a style beside his own must read before the best manager
                      // leaves it: three times the table's own noise (~0.08 a cell)...
  leaveHi: 0.45,      // ...and before the worst one does. Asked to act on a read as noisy as his at the best one's bar,
                      // a poor manager left his own style in a third of his matches and was right three times in five.
                      // As set, every manager starts away from his own style in 11-16% of matches; the best one's
                      // switches are right 99% of the time and the worst one's 65%, worth 0.03 and 0.01 xG a match
                      // (8 Oct 2026 table). Scaled to the new table's noise (0.16 / 0.29) they would leave it in 30%.
  needW: 0.35,        // how far a match he must win (or need not) leans him toward the attacking (cautious) styles
};

const worthOf = (s, them) => ME_MATCHUP[s]?.[them] ?? 0;
// HOW MUCH BETTER THAN USUAL a style does against this opponent: its matchup less its own average across every
// opponent. Some styles are simply stronger than the ones beside them; judged on raw xG a manager would leave
// his own nearly every week (63% of reads, 7 Oct 2026), which is not a preferred style. He moves for the
// matchup, and never to a style that reads worse outright.
const ROWMEAN = {};
const fitOf = (s, them) => {
  const row = ME_MATCHUP[s]; if (!row) return 0;
  if (ROWMEAN[s] === undefined) { const v = Object.values(row); ROWMEAN[s] = v.reduce((a, b) => a + b, 0) / v.length; }
  return (row[them] ?? 0) - ROWMEAN[s];
};

// THE PLAN FOR THIS FIXTURE. team / opp: { style, mgmt }. ctx: { key, need: -1 protect .. +1 chase }.
// Returns { style, read } -- his own style unless one beside it reads clearly better.
export function mePreMatch(team, opp, ctx = {}) {
  const q = meMgrQ(team.mgmt), R = ME_MGR_READ, key = ctx.key ?? "";
  const own = team.style in ME_STYLE_ADJ ? team.style : "balanced";
  // His read of them: the style they will play or, misread, one beside it.
  let them = opp.style in ME_STYLE_ADJ ? opp.style : "balanced";
  // A side he has already met in this competition he has seen play: no misreading its style (ctx.seen).
  if (!ctx.seen && hash01(key, "read") > R.oppRight + R.oppSkill * q) {
    const adj = ME_STYLE_ADJ[them];
    them = adj[Math.floor(hash01(key, "which") * adj.length)];
  }
  // With no measured table there is nothing to weigh: he plays his own style rather than switch on a guess.
  if (!ME_MATCHUP[own]) return { style: own, read: them };
  const err = R.errHi + (R.errLo - R.errHi) * q, leave = R.leaveHi + (R.leaveLo - R.leaveHi) * q;
  const need = clamp(ctx.need || 0, -1, 1);
  const noise = (s) => gauss(hash01(key, s, 1), hash01(key, s, 2)) * err;
  const fit = (s) => fitOf(s, them) + need * R.needW * (ME_STYLE_ATTACK[s] ?? 0) + noise(s);
  const worth = (s) => worthOf(s, them) + need * R.needW * (ME_STYLE_ATTACK[s] ?? 0) + noise(s);
  let pick = own, bestFit = fit(own);
  for (const s of ME_STYLE_ADJ[own]) {
    const f = fit(s);
    if (f > bestFit + leave && worth(s) >= worth(own)) { bestFit = f; pick = s; }
  }
  return { style: pick, read: them };
}

// Put a style on a side for the rest of the match: its whole instruction sheet and its plan. Orders
// given from the Tactics panel (mePos.stratPin) stay on top of the new sheet.
export function meSetStyle(s, side, style) {
  s.styles[side] = style;
  s.strategy[side] = { ...s.strategy[side], ...meStrategyOf(style), ...(s.mePos?.stratPin?.[side] || {}) };
  (s.plan = s.plan || {})[side] = mePlanOf(style);
  if (s.mePos?.stratBase) s.mePos.stratBase[side] = { ...s.strategy[side] };
}

// THE LONE STRIKER, picked for the opponent he has read: against a side that keeps a high line, a poacher who
// lives on its shoulder; against a deep block, a target man to aim at. Anything else keeps his style's own role.
const HIGH_LINE = ["tikitaka", "gegenpress", "secondball"];
const DEEP_BLOCK = ["counterattack", "cholismo", "zonamista", "catenaccio", "parkthebus"];
function meStrikerFor(s, side, read) {
  const ps = s.players?.[side] || [];
  const sts = ps.map((p, i) => [p, i]).filter(([p]) => p && !p.bench && ((p.spos || "").split("/")[0] === "ST"));
  if (sts.length !== 1) return;
  const role = HIGH_LINE.includes(read) ? "st_poach" : DEEP_BLOCK.includes(read) ? "st_target" : null;
  if (role) (s.plan[side].roles = s.plan[side].roles || {})[sts[0][1]] = role;
}

// SHORT OF A POSITION. With a man missing and nobody of his position on the bench, somebody plays out of
// position in his slot. A manager who sees it moves to the neighbouring shape his eleven actually fit: the one
// whose slots their own positions fill with the least moving about, when it beats the sheet's shape by a whole
// line's worth (a centre-half in a winger's slot is nearly four). Positions sit on the grid fitEffOvr charges a
// man out of position on (sim/core FIT_POS_XY): depth is the expensive axis, side the cheaper one.
const POS_XY = { GK: [0, 0], CB: [1, 0], LB: [1, -1], RB: [1, 1], DEF: [1, 0], LWB: [2, -1], RWB: [2, 1], DM: [2, 0],
                 CM: [3, 0], LM: [3, -1], RM: [3, 1], MID: [3, 0], AM: [4, 0], LW: [4, -1], RW: [4, 1], ST: [5, 0], FWD: [5, 0] };
const posCost = (a, b) => { const A = POS_XY[a], B = POS_XY[b]; return A && B ? Math.abs(A[0] - B[0]) + 0.75 * Math.abs(A[1] - B[1]) : 0; };
const SLOT_GRP = (f) => { const d = f.split("-").map(Number), g = ["GK"];
  for (let i = 0; i < d[0]; i++) g.push("DEF");
  for (let k = 1; k < d.length - 1; k++) for (let i = 0; i < d[k]; i++) g.push("MID");
  for (let i = 0; i < d[d.length - 1]; i++) g.push("FWD");
  return g; };
function meShapeForXI(s, side) {
  const f = s.formations?.[side], ps = s.players?.[side];
  if (!f || !ps || ps.length !== 11 || ps[0]?.pos !== "GK") return null;
  // A man is judged by his own positions where he has them (the nearer of his two), else by the place he was picked for.
  const nat = (p) => p.natPos || p.spos || p.pos;
  const cost = (p, x) => (p.own?.length ? Math.min(...p.own.map(o => posCost(o, x))) : posCost(nat(p), x));
  const sp0 = sposFor(f);
  let c0 = 0, worst = 0, short = null;
  for (let i = 1; i < 11; i++) { const c = cost(ps[i], sp0[i]); c0 += c; if (c > worst) { worst = c; short = sp0[i]; } }
  if (c0 < 2) return null;
  let best = null;
  for (const g of meFormAdj(f)) {
    const sp = sposFor(g), m = [];
    for (let r = 1; r < 11; r++) m.push(sp.slice(1, 11).map(x => cost(ps[r], x)));
    const res = meHungarian(m, 10);
    let c = 0; for (let r = 0; r < 10; r++) c += m[r][res[r]];
    if (!best || c < best.c) best = { g, c, res };
  }
  return best && best.c <= c0 - 1 ? { ...best, short } : null;
}
function meApplyXI(s, side, b) {
  const ps = s.players[side], sp = sposFor(b.g), grp = SLOT_GRP(b.g), atk = formAtkW(b.g), next = [ps[0]];
  for (let r = 0; r < 10; r++) next[b.res[r] + 1] = ps[r + 1];
  for (let j = 1; j < 11; j++) {
    const p = next[j];
    p.natPos = p.natPos || p.spos || p.pos;
    p.spos = sp[j]; p.pos = grp[j]; p.atkW = atk[j]; p._att = null;
  }
  s.players[side] = next;
  s.formations[side] = b.g;
}

// THE THREAT (23 November 2026; the user: "opposing teams need to be aware of who the star/threatening players on the
// other team are every match, and attempt to shut them down"). Until now a manager read a style and never a man: the
// best striker in the league met the same zonal block as anybody, and a side's top scorer took 46% of its goals in 98%
// of its minutes (run 45146812880). Before kick-off each manager names the one man of theirs most likely to score and,
// when that man stands clear of his own back line, gives him a marker: the defender who plays where the threat does
// (a centre-half for a striker, the full-back facing a winger, the holding man for a ten), the best of them at it.
// What the marker then does is in mind/team.ts (mindDefend, THE THREAT): he leaves his spot for the man, the lane into
// him is screened and he is closed by two sooner. The price is the marker's spot, and it is paid on the pitch: nothing
// here scales a chance. How far the plan goes (lvl 0..1) is how far the man stands above the defence set against him.
//   He is read on what a manager can know: his rating where he plays, the traits that score goals, and his goals a
//   match in this competition where the match was given them (p.tg, p.tm, from the tournament's own tables) -- so a
//   man on a scoring run is watched more closely every week -- and, once the match is on, his goals today.
// A poorer manager names the wrong man more often (ME_THREAT.read*), and puts it right at half time only.
export const ME_THREAT = {
  // Where he plays: nothing off a striker, a little off a wide man or a ten, more off a midfielder. Nobody else is read.
  posW: { ST: 0, FWD: 0, LW: -3, RW: -3, AM: -3, LM: -6, RM: -6, CM: -8, MID: -8 },
  traitW: { finisher: 2, poacher: 2, longshot: 1.5, aerial: 1, rapid: 1, greedy: 0.5 },   // points a level
  goalW: 14, goalFrom: 0.3, goalApps: 3,   // points for each goal a match above goalFrom, once he has played goalApps
  vsW: 4,                                  // points for each goal he scored against this side the last time they met
  liveW: 5,                                // points for each goal he has scored today
  bar: 2, span: 10,                        // points above the back line before he is given a man, and on to the full plan
  readLo: 0.6, readSkill: 0.4,             // chance a manager of no ability names the right man, and what the best adds
  markW: { tightmarker: 2, disciplined: 1, strong: 0.5, losesman: -2 },   // what makes a marker, points a level
  // Who plays where he does, in the order a manager looks.
  marker: { ST: ["CB"], FWD: ["CB"], LW: ["RB", "RWB", "CB"], RW: ["LB", "LWB", "CB"], LM: ["RB", "RWB", "RM", "CB"],
            RM: ["LB", "LWB", "LM", "CB"], AM: ["DM", "CM", "CB"], CM: ["DM", "CM"], MID: ["DM", "CM"] },
};
const placeOf = (p) => String(p?.spos || p?.pos || "").split("/")[0];
const lvSum = (p, W) => { let v = 0; for (const k of p?.badges || []) { const w = W[traitId(k)]; if (w) v += w * traitLv(k); } return v; };
export function meDangerOf(q) {
  const T = ME_THREAT, w = T.posW[placeOf(q)] ?? T.posW[q?.pos];
  if (w === undefined || !q || q.off) return null;
  const gpm = (q.tm || 0) >= T.goalApps ? (q.tg || 0) / q.tm : 0;
  return (q.ovr0 ?? q.ovr ?? 65) + w + lvSum(q, T.traitW) + T.goalW * Math.max(0, gpm - T.goalFrom) + T.liveW * (q.goals || 0)
    + T.vsW * (q.vs || 0);
}
function meMarkerFor(s, side, q) {
  const ps = s.players?.[side] || [], T = ME_THREAT;
  for (const want of T.marker[placeOf(q)] || T.marker[q.pos] || ["CB"]) {
    let best = null, bv = -Infinity;
    for (const p of ps) {
      if (!p || p.off || p.pos === "GK" || placeOf(p) !== want) continue;
      const v = (p.ovr0 ?? p.ovr ?? 65) + lvSum(p, T.markW);
      if (v > bv) { bv = v; best = p; }
    }
    if (best) return best;
  }
  return null;
}
// The plan of `side` against the other side's man: s.threat[side] = { q: their man, m: our marker, lvl }, or nothing.
// first: the read before kick-off, which a poorer manager gets wrong more often; afterwards he reads what he has seen.
export function meThreatPlan(s, side, first) {
  if (globalThis.__noThreats) return null;                  // a harness can measure the matches without it
  const opp = side === "home" ? "away" : "home", T = ME_THREAT;
  const cand = [];
  for (const q of s.players?.[opp] || []) { const d = meDangerOf(q); if (d != null) cand.push([d, q]); }
  cand.sort((a, b) => b[0] - a[0]);
  s.threat = s.threat || {};
  const was = s.threat[side] || null;
  if (!cand.length) { s.threat[side] = null; return null; }
  let pick = cand[0];
  if (first && cand.length > 1 && !(cand[0][1].vs > 0)      // nobody misnames the man who scored against him last time
      && hash01(s.mgrKey ?? 0, side, "threat") > T.readLo + T.readSkill * meMgrQ(s.mgmt?.[side])) pick = cand[1];
  let n = 0, dm = 0;
  for (const p of s.players?.[side] || []) if (p && !p.off && p.pos === "DEF") { dm += p.ovr0 ?? p.ovr ?? 65; n++; }
  const lvl = clamp((pick[0] - (n ? dm / n : 70) - T.bar) / T.span, 0, 1);
  // The same man keeps the marker he has while that marker is still on.
  const keep = was && was.q === pick[1] && was.m && !was.m.off && (s.players[side] || []).includes(was.m) ? was.m : null;
  const m = lvl > 0 ? keep || meMarkerFor(s, side, pick[1]) : null;
  s.threat[side] = m ? { q: pick[1], m, lvl } : null;
  if (!m || (was && was.q === pick[1] && was.m === m)) return null;
  return `${m.fullName || m.name} on ${pick[1].fullName || pick[1].name}`;
}

// RESPECT, AND THE LAST TIME THEY MET (23 November 2026, the rest of the manager rework). Until now the champions met
// the same set-up from the bottom side as anybody did. A manager whose eleven stands clearly below theirs, away from
// home or on neutral ground, sets up for it: his line and his press a step deeper at the full plan. It is a set-up for
// nought-nought: behind, the chase lifts it off again (match.ts meChase), and a side that has to win does not start
// with it at all. What he measures is the two elevens as picked, a point to the side at home; and he remembers: beaten
// by three or more the last time they met in this competition (s.matchUrg.last, from the tournament's own results), he
// counts them better than their ratings say. Not in a second leg, where the first is a deficit to chase and already
// read as one. The sheet moves; nothing scales a chance.
//   NEVER AT HOME, which is the measurement (run 45177480046: League One's bottom seven against its top five, every
//   fixture six times, 420 matches an arm on the same dice). With the plan on both ways the weaker side took 0.545
//   points a match against 0.564 without it (each +-0.05), drew more, won less and conceded 2.23 against 2.10: nothing
//   gained. Split by ground it was two different things: away 0.60 against 0.45, at home 0.49 against 0.68 (210 matches
//   each, +-0.07). With the one season of run 45176557365 pooled in, away +0.12 and at home -0.19, both +-0.09. So it
//   is the away side's plan, as it is a real one's; on neutral ground it is unmeasured. A lean toward the cautious
//   style beside his own was built with it and changed nothing in those 420 matches (bit for bit), so it is not here.
export const ME_RESPECT = {
  bar: 4, span: 8,          // rating points their eleven stands above his before he sets up for it, and on to the full plan
  home: 1,                  // what their playing at home is worth to that count
  lastFrom: 2, lastW: 4,    // beaten by more than lastFrom the last time: points for each goal beyond it (so a 4-0
                            // between level sides is a third of the full plan, and a 5-0 nearly all of it)
  sheet: { defLine: -1, pressingLOE: -1 },   // the full plan on his sheet, in steps
  // THE FAVOURITE'S ANSWER: the manager across from a side set up like that expects the deep block and plays wider
  // against it, a full step of width at their full plan (more of the pitch used, crosses from deeper, a man more in
  // the box: mind/team.ts and mind/decide.ts read st.width).
  favWidth: 1,
};
const xiMean = (ps) => { let n = 0, t = 0; for (const p of ps || []) if (p && !p.off && p.pos !== "GK") { t += p.ovr0 ?? p.ovr ?? 65; n++; } return n ? t / n : 65; };
export function meRespect(s, side) {
  if (globalThis.__mgrOff?.respect || s.allowTacChange?.[side] === false || s.homeAdv === side) return 0;
  const opp = side === "home" ? "away" : "home", R = ME_RESPECT;
  let gap = xiMean(s.players?.[opp]) - xiMean(s.players?.[side]);
  if (s.homeAdv === opp) gap += R.home;
  const last = s.aggLead || globalThis.__mgrOff?.memo ? null : s.matchUrg?.last?.[side];
  if (last != null && -last > R.lastFrom) gap += R.lastW * (-last - R.lastFrom);
  return clamp((gap - R.bar) / R.span, 0, 1) * (1 - clamp(s.matchUrg?.[side] || 0, 0, 1));
}

// BEFORE KICK-OFF, both managers. Only where the match asks for managers (s.managers): the lab and the tests set
// every side up themselves and must get exactly what they asked for. key: a number for this fixture.
export function meManagersPreMatch(s, key) {
  if (!s.managers) return;
  s.mgrKey = key;
  // WHAT EACH MANAGER WENT WITH, kept for the Live Match's Tactics panel to show (s.mgrRead): the style and shape on his
  // record, his read of theirs, and how far he set up to respect them or expects them to respect him. Read only by the app.
  const rd = s.mgrRead = { home: {}, away: {} };
  for (const side of ["home", "away"]) { rd[side].style0 = s.styles?.[side] || "balanced"; rd[side].form0 = s.formations?.[side]; }
  for (const side of ["home", "away"]) {
    const xi = meShapeForXI(s, side);
    if (xi && hash01(key, side, "xi") < 0.5 + 0.5 * meMgrQ(s.mgmt?.[side])) {
      const from = s.formations[side];
      meApplyXI(s, side, xi);
      ((s.preLog = s.preLog || {})[side] = s.preLog[side] || []).push({ min: 0, k: "shape",
        t: `Short at ${xi.short}: ${from} to ${xi.g}` });
    }
  }
  const memo = !globalThis.__mgrOff?.memo;
  const respBy = { home: meRespect(s, "home"), away: meRespect(s, "away") };
  for (const side of ["home", "away"]) {
    const opp = side === "home" ? "away" : "home";
    const resp = respBy[side], seen = memo && (s.matchUrg?.last != null || s.aggLead != null);
    const m = mePreMatch({ style: s.styles?.[side], mgmt: s.mgmt?.[side] }, { style: s.styles?.[opp] },
                         { key: `${key}:${side}`, seen,
                           need: (s.matchUrg?.[side] || 0) - 0.5 * (s.aggLead?.[side] || 0) });
    const from = s.styles?.[side] || "balanced";
    rd[side].read = m.read; rd[side].resp = resp;
    rd[side].fav = respBy[opp] > 0 && !globalThis.__mgrOff?.favour && s.allowTacChange?.[side] !== false ? respBy[opp] : 0;
    (s.plan = s.plan || {})[side] = s.plan[side] || mePlanOf(from);
    if (m.style !== from) {
      meSetStyle(s, side, m.style);
      ((s.preLog = s.preLog || {})[side] = s.preLog[side] || []).push({ min: 0, k: "switch",
        t: `Read ${ME_STYLE_NAME[m.read] || m.read}: ${ME_STYLE_NAME[from] || from} set aside for ${ME_STYLE_NAME[m.style] || m.style}` });
    }
    meStrikerFor(s, side, m.read);
    // The respectful set-up goes on top of whichever sheet he starts with.
    if (resp > 0 && s.strategy?.[side]) {
      const st = s.strategy[side] = { ...s.strategy[side] };
      for (const k in ME_RESPECT.sheet) { const r = ME_STRAT_RANGE[k];
        st[k] = clamp((st[k] || 0) + ME_RESPECT.sheet[k] * resp, r[0], r[1]); }
      const last = s.aggLead ? null : s.matchUrg?.last?.[side];
      ((s.preLog = s.preLog || {})[side] = s.preLog[side] || []).push({ min: 0, k: "plan",
        t: memo && last != null && -last > ME_RESPECT.lastFrom ? `Beaten by ${-last} last time: line and press dropped`
                                                               : "Stronger opponent: line and press dropped" });
    }
    if (respBy[opp] > 0 && s.strategy?.[side] && !globalThis.__mgrOff?.favour && s.allowTacChange?.[side] !== false) {
      const st = s.strategy[side] = { ...s.strategy[side] };
      st.width = clamp((st.width || 0) + ME_RESPECT.favWidth * respBy[opp], -2, 2);
      ((s.preLog = s.preLog || {})[side] = s.preLog[side] || []).push({ min: 0, k: "plan", t: "Deep block expected: wider" });
    }
  }
  // The men who scored against each side the last time they met (s.matchUrg.lastSc, the tournament's own results).
  if (memo && s.matchUrg?.lastSc) for (const side of ["home", "away"]) {
    const sc = s.matchUrg.lastSc[side] || {};
    for (const p of s.players?.[side] || []) if (p) p.vs = sc[p.fullName || p.name] || sc[p.name] || 0;
  }
  for (const side of ["home", "away"]) {
    const t = meThreatPlan(s, side, true);
    if (t) ((s.preLog = s.preLog || {})[side] = s.preLog[side] || []).push({ min: 0, k: "mark", t });
  }
}

// GOING WRONG: the style beside his own that his read says does best against what they are actually playing,
// leaning to the attacking ones because he is chasing. Null when none reads better than staying.
export function meChaseStyle(s, side, key) {
  const own = s.styles?.[side] || "balanced", opp = side === "home" ? "away" : "home";
  if (!(own in ME_STYLE_ADJ)) return null;
  const m = mePreMatch({ style: own, mgmt: s.mgmt?.[side] }, { style: s.styles?.[opp] }, { key: `${key}:${side}:chase`, need: 1 });
  return m.style !== own ? m.style : null;
}

// A MAN DOWN: the most cautious style beside his own, unless he is behind and has to go for it anyway.
export function meTenMenStyle(s, side, lead) {
  const own = s.styles?.[side] || "balanced";
  if (lead < 0 || !(own in ME_STYLE_ADJ)) return null;
  let pick = null, lo = ME_STYLE_ATTACK[own] ?? 0;
  for (const a of ME_STYLE_ADJ[own]) if ((ME_STYLE_ATTACK[a] ?? 0) < lo) { lo = ME_STYLE_ATTACK[a]; pick = a; }
  return pick;
}

// THE SHAPE, LATE. A goal up with a quarter of an hour left he goes to the neighbouring formation that commits the
// fewest men forward (formations.ts, meFormAdj, by the slots' own attacking weight). Once a match, and not every
// manager reaches for it: the better he reads a game the likelier he is to make the change. In a second leg it is
// the aggregate he is ahead on.
// Not when chasing it. Behind with 25 minutes left, the neighbouring shape that commits the most men forward cost
// the side 0.08 points and 0.15 goals of difference against the same matches played without the change (215 of them,
// League One and Two, 7 Oct 2026): the more attacking shapes did not score more. Going for it is the half-time style
// change (meChaseStyle) and the chase in the instructions.
const atkSum = (f) => formAtkW(f).reduce((a, b) => a + b, 0);
// CHASING IT WITH A FORWARD (23 November 2026, the last of the manager rework). The shape alone, with the same eleven,
// was measured and left out above. This is the change a manager actually makes: a forward off the bench for a man
// from the line the more attacking neighbouring shape drops. Here only the question of which shape and which line;
// the change itself is in match.ts (meCoachSubs). Once a match, and likelier the better he reads a game.
export function meShapeChase(s, side) {
  const f = s.formations?.[side];
  if (!f || globalThis.__mgrOff?.chase) return null;
  if (hash01(s.mgrKey ?? 0, side, "chase") > 0.4 + 0.6 * meMgrQ(s.mgmt?.[side])) return null;
  const cnt = (g) => { const c = { DEF: 0, MID: 0, FWD: 0 }; for (const x of SLOT_GRP(g)) if (c[x] !== undefined) c[x]++; return c; };
  const a = cnt(f);
  let pick = null, best = atkSum(f), lose = null;
  for (const g of meFormAdj(f)) {
    const b = cnt(g), l = b.FWD <= a.FWD ? null : b.DEF < a.DEF ? "DEF" : b.MID < a.MID ? "MID" : null;
    if (l && atkSum(g) > best) { best = atkSum(g); pick = g; lose = l; }
  }
  if (!pick) return null;
  const grp = SLOT_GRP(pick);
  return { to: pick, lose, slots: sposFor(pick).filter((x, i) => grp[i] === "FWD") };
}

// THE WEAK LINK (the same day). A manager who reads a game looks for the man in their back line who stands clearly
// below the rest of it: a stand-in out of his position, a booked man, a man whose legs have gone. Play is aimed at
// the part of the final third he defends, by the means a style aims play anywhere: legs added to the side's pass
// pattern (s.plan.zones, mind/decide.ts). Read at kick-off, at the break, and whenever the plan itself is replaced.
export const ME_WEAK = {
  bar: 4,                       // rating points below the rest of the back line before he is the weak link
  booked: 3, legsFrom: 70, legsW: 0.15,   // what a booking costs that count, and each point of stamina under legsFrom
  legW: 0.8,                    // the worth of each added leg of the pattern (a style's own run 0.5 to 1)
  readLo: 0.4, readSkill: 0.6,  // chance a manager of no ability looks for one at all, and what the best adds
};
export function meWeakPlan(s, side) {
  const plan = s.plan?.[side];
  if (!plan || globalThis.__mgrOff?.weak) return null;
  if (plan._z0 === undefined) Object.defineProperty(plan, "_z0", { value: plan.zones || null, enumerable: false });
  const opp = side === "home" ? "away" : "home", W = ME_WEAK;
  const was = (s.weak = s.weak || {})[side] || null;
  const ds = (s.players?.[opp] || []).filter(p => p && !p.off && p.pos === "DEF");
  let pick = null;
  if (ds.length >= 3 && hash01(s.mgrKey ?? 0, side, "weak") < W.readLo + W.readSkill * meMgrQ(s.mgmt?.[side])) {
    const e = ds.map(p => (p.own?.length && p.spos ? ovrAt(p.ovr0 ?? p.ovr ?? 65, p.own, placeOf(p)) : p.ovr0 ?? p.ovr ?? 65)
      - ((p.yc || 0) === 1 ? W.booked : 0) - W.legsW * Math.max(0, W.legsFrom - (p.stamina ?? 100)));
    const tot = e.reduce((x, y) => x + y, 0);
    let bg = W.bar;
    e.forEach((v, i) => { const gap = (tot - v) / (e.length - 1) - v; if (gap >= bg) { bg = gap; pick = ds[i]; } });
  }
  s.weak[side] = pick;
  const legs = new Map(plan._z0 || []);
  if (pick) {
    const y = pick._zy ?? pick.y ?? 34, lat = y < 20.4 ? 0 : y > 47.6 ? 2 : 1, tz = 6 + lat;
    for (const from of lat === 1 ? [3, 4, 5] : [3 + lat, 4, 7]) legs.set(from * 9 + tz, Math.max(legs.get(from * 9 + tz) || 0, W.legW));
  }
  plan.zones = legs.size ? legs : null;
  return pick && pick !== was ? `Play aimed at ${pick.fullName || pick.name}` : null;
}
export function meShapeFor(s, side, lead, rem) {
  const f = s.formations?.[side];
  if (!f || globalThis.__noShape) return null;           // a harness can measure the matches without it
  if (!(lead === 1 && rem <= 15)) return null;
  if (hash01(s.mgrKey ?? 0, side, "shape") > 0.4 + 0.6 * meMgrQ(s.mgmt?.[side])) return null;
  let pick = null, best = atkSum(f);
  for (const g of meFormAdj(f)) { const a = atkSum(g); if (a < best) { best = a; pick = g; } }
  return pick;
}
