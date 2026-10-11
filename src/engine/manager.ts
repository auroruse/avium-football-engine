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
import { ME_MGR } from "./config";
import { mePlanOf, meStrategyOf, ME_STYLE_NAME } from "./tactics";
import { ME_MATCHUP } from "./matchup";
import { formAtkW, meFormAdj, sposFor } from "./formations";
import { meHungarian } from "./assignment";

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
  tikitaka: ["possession", "balanced", "lanuestra"],
  possession: ["tikitaka", "balanced", "lanuestra"],
  verticaltiki: ["balanced", "lanuestra", "wingplay"],
  gegenpress: ["secondball", "verticaltiki", "cholismo"],
  lanuestra: ["balanced", "verticaltiki", "zonamista"],
  wingplay: ["balanced", "verticaltiki", "cholismo"],
  routeone: ["cholismo", "secondball", "verticaltiki"],
  secondball: ["gegenpress", "routeone", "cholismo"],
  counterattack: ["catenaccio", "routeone", "cholismo"],
  cholismo: ["routeone", "lanuestra", "balanced"],
  zonamista: ["lanuestra", "balanced", "verticaltiki"],
  catenaccio: ["counterattack", "zonamista", "parkthebus"],
  parkthebus: ["cholismo", "zonamista", "catenaccio"],
  balanced: ["lanuestra", "verticaltiki", "wingplay"],
};
// HOW MUCH EACH STYLE ATTACKS: xG a match it creates over Balanced, against an even mix of every style at level
// squads (the same run). What he leans on when he has to win, and away from when a point will do.
export const ME_STYLE_ATTACK = {
  counterattack: 0.31, gegenpress: 0.25, verticaltiki: 0.23, secondball: 0.17, routeone: 0.14, wingplay: 0.10,
  lanuestra: 0.07, catenaccio: 0.07, cholismo: 0.01, balanced: 0.00, possession: -0.03, parkthebus: -0.06,
  zonamista: -0.07, tikitaka: -0.08,
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
  if (hash01(key, "read") > R.oppRight + R.oppSkill * q) {
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

// BEFORE KICK-OFF, both managers. Only where the match asks for managers (s.managers): the lab and the tests set
// every side up themselves and must get exactly what they asked for. key: a number for this fixture.
export function meManagersPreMatch(s, key) {
  if (!s.managers) return;
  s.mgrKey = key;
  for (const side of ["home", "away"]) {
    const xi = meShapeForXI(s, side);
    if (xi && hash01(key, side, "xi") < 0.5 + 0.5 * meMgrQ(s.mgmt?.[side])) {
      const from = s.formations[side];
      meApplyXI(s, side, xi);
      ((s.preLog = s.preLog || {})[side] = s.preLog[side] || []).push({ min: 0, k: "shape",
        t: `Short at ${xi.short}: ${from} to ${xi.g}` });
    }
  }
  for (const side of ["home", "away"]) {
    const opp = side === "home" ? "away" : "home";
    const m = mePreMatch({ style: s.styles?.[side], mgmt: s.mgmt?.[side] }, { style: s.styles?.[opp] },
                         { key: `${key}:${side}`, need: (s.matchUrg?.[side] || 0) - 0.5 * (s.aggLead?.[side] || 0) });
    const from = s.styles?.[side] || "balanced";
    (s.plan = s.plan || {})[side] = s.plan[side] || mePlanOf(from);
    if (m.style !== from) {
      meSetStyle(s, side, m.style);
      ((s.preLog = s.preLog || {})[side] = s.preLog[side] || []).push({ min: 0, k: "switch",
        t: `Read ${ME_STYLE_NAME[m.read] || m.read}: ${ME_STYLE_NAME[from] || from} set aside for ${ME_STYLE_NAME[m.style] || m.style}` });
    }
    meStrikerFor(s, side, m.read);
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
export function meShapeFor(s, side, lead, rem) {
  const f = s.formations?.[side];
  if (!f || globalThis.__noShape) return null;           // a harness can measure the matches without it
  if (!(lead === 1 && rem <= 15)) return null;
  if (hash01(s.mgrKey ?? 0, side, "shape") > 0.4 + 0.6 * meMgrQ(s.mgmt?.[side])) return null;
  let pick = null, best = atkSum(f);
  for (const g of meFormAdj(f)) { const a = atkSum(g); if (a < best) { best = a; pick = g; } }
  return pick;
}
