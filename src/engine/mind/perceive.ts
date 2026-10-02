// THE SENSES. A footballer knows where people are because he has looked, and only for as long as what
// he saw stays true. The first brain read all twenty-two positions exactly, through the back of every
// head, four times a second, so nobody was ever caught by a man he had not seen and a poor player's
// mistakes were dice rather than blind spots.
//
// Each man carries a BODY ANGLE (_face) that turns at a rate his pace allows, a HEAD (_look) that
// follows the ball unless he is checking his shoulder, and a MEMORY of every other player: where he
// was, how he was moving, and when that was. Decisions are taken against the memory (mindLens), so a
// man last seen two seconds ago is wherever he was heading two seconds ago.
import { ME_DT } from "../config";
import { meMind } from "../attributes";
import { ME_HALF_W, ME_SIDES, PITCH_L, PITCH_W, meDir, meGoalX, meOther } from "../geometry";
import { MT } from "./tune";

const NI = 22, NF = 5;            // men in the memory table, fields per man: x, y, vx, vy, tick

// Fixed slot in the memory table: home 0..10, away 11..21. Substitutes take the man's index with his
// place in the array, which is how meSub already works.
export const mindIx = (side, i) => (side === "home" ? 0 : 11) + i;

// HOW MUCH HE TAKES IN. Judgement (meMind) is the base -- the reading of the game a rating stands for --
// tilted by the job: a midfielder lives at the centre of a 360-degree picture and checks it constantly,
// a centre-forward much of the time has his back to most of it.
const AWARE_TILT = { GK: 0.0, DEF: 0.02, MID: 0.08, FWD: -0.04 };
export const mindAware = (p) => {
  if (p._aw !== undefined && p._awO === p.ovr) return p._aw;
  p._awO = p.ovr;
  return (p._aw = Math.max(0, Math.min(1, meMind(p) + (AWARE_TILT[p.pos] ?? 0))));
};

// A small fast generator of its own, so perception never draws from the match's stream: the noise in
// what twenty-two men see is a few hundred numbers a slice, and the first brain's harnesses must keep
// getting the identical sequence they always did.
export const mindRand = (M) => {
  let x = M.r | 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  M.r = x;
  return (x >>> 0) / 4294967296;
};
const gauss = (M) => (mindRand(M) + mindRand(M) + mindRand(M) - 1.5) * 1.15;

export const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

// Everybody starts knowing where everybody is: they have just lined up opposite each other.
function initMan(s, p, side, i) {
  const dir = meDir(side);
  if (p._face === undefined) { p._face = dir > 0 ? 0 : Math.PI; p._look = p._face; }
  p._scan = 0; p._scanSide = (i & 1) ? 1 : -1;
  const m = (p._mem = new Float64Array(NI * NF));
  const t = s.mePos.tick;
  for (const sd of ME_SIDES) {
    const ps = s.players[sd];
    for (let j = 0; j < ps.length; j++) {
      const q = ps[j], k = mindIx(sd, j) * NF;
      if (!q) continue;
      m[k] = q.x; m[k + 1] = q.y; m[k + 2] = q.vx || 0; m[k + 3] = q.vy || 0; m[k + 4] = t;
    }
  }
}

export function mindSenseInit(s) {
  for (const side of ME_SIDES) {
    const ps = s.players[side];
    for (let i = 0; i < ps.length; i++) if (ps[i]) initMan(s, ps[i], side, i);
  }
}

// AFTER EVERYBODY HAS MOVED: each man turns his body, points his head, and takes in what is in front
// of it. Run once a slice, after meMove, so what he knows is where people are now.
export function mindSense(s) {
  const mp = s.mePos, M = mp.mind, tick = mp.tick;
  const bx = mp.bx, by = mp.by;
  const cosFov = Math.cos(MT.fovHalf);
  for (const side of ME_SIDES) {
    const ps = s.players[side], dir = meDir(side);
    const ours = mp.side === side;
    const drill = M.drill?.[side] ?? 0.4;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      if (!p || p.off) continue;
      if (!p._mem) initMan(s, p, side, i);
      const onBall = mp.idx === i && mp.side === side;
      const aw = mindAware(p);
      // ---- THE BODY ----------------------------------------------------------------------------
      const vx = (p.vx || 0) / ME_DT, vy = (p.vy || 0) / ME_DT, v = Math.hypot(vx, vy);
      const toB = Math.atan2(by - p.y, bx - p.x), dB = Math.hypot(bx - p.x, by - p.y);
      let want;
      if (onBall) want = p._drbA != null ? p._drbA : v > 0.5 ? Math.atan2(vy, vx) : toB;
      else if (p.pos === "GK") want = toB;
      else if (v > MT.runFaceV) want = Math.atan2(vy, vx);
      else {
        // Standing or shuffling he faces the ball -- and if his side has it and it may come to him, he
        // opens up toward their goal, so that he can take it on the half-turn and play forward.
        want = dB > 0.3 ? toB : p._face;
        if (ours && p.pos !== "GK" && dB > 4) {
          const toG = Math.atan2(ME_HALF_W - p.y, meGoalX(side) - p.x);
          want += Math.max(-MT.openMax, Math.min(MT.openMax, angDiff(toG, toB))) * MT.openBody;
        }
        // Moving slowly, the way he is going pulls his body round with it.
        if (v > 1.2) {
          const mv = Math.atan2(vy, vx), k = (v - 1.2) / (MT.runFaceV - 1.2);
          want += angDiff(mv, want) * Math.max(0, Math.min(1, k));
        }
      }
      const rate = MT.turnStill + (MT.turnRun - MT.turnStill) * Math.min(1, v / MT.turnRunV);
      const turn = rate * ME_DT;
      p._face += Math.max(-turn, Math.min(turn, angDiff(want, p._face)));
      p._face = Math.atan2(Math.sin(p._face), Math.cos(p._face));
      // ---- THE HEAD ----------------------------------------------------------------------------
      let look;
      if (p._scan > 0) { look = p._scanDir; p._scan--; }
      else {
        // HOW OFTEN HE CHECKS. Awareness sets the rate; the moment sets the multiplier. He checks most
        // when the ball might be coming to him -- the look before he receives is what lets him play
        // forward on the half-turn -- and least with it at his own feet.
        const expect = ours && !onBall && p.pos !== "GK" && dB > 4 && dB < 32;
        const mult = onBall ? MT.scanOnBall : expect ? MT.scanRecv : 1;
        const rateS = (MT.scanLo + (MT.scanHi - MT.scanLo) * aw) * mult;
        if (p.pos !== "GK" && mindRand(M) < rateS * ME_DT) {
          p._scanSide = -p._scanSide;
          // Over a shoulder: the half of the pitch behind him relative to the ball, the half he
          // cannot see while he watches it.
          p._scanDir = toB + Math.PI + 0.55 * p._scanSide;
          p._scan = MT.scanTicks - 1;
          p._scans = (p._scans || 0) + 1;
          look = p._scanDir;
        } else {
          const off = angDiff(toB, p._face);
          look = Math.abs(off) <= MT.headMax ? toB : p._face + Math.sign(off) * MT.headMax;
        }
      }
      p._look = look;
      // ---- WHAT HE TAKES IN --------------------------------------------------------------------
      const lx = Math.cos(look), ly = Math.sin(look);
      const m = p._mem, nz = MT.posNoise * (1 - 0.75 * aw), vz = MT.velNoise * (1 - 0.75 * aw);
      for (const sd of ME_SIDES) {
        const qs = s.players[sd];
        for (let j = 0; j < qs.length; j++) {
          const q = qs[j];
          if (!q || q === p || q.off) continue;
          const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
          let seen = d < MT.feelR;
          if (!seen && d < MT.viewR && (dx * lx + dy * ly) > cosFov * d) seen = true;
          if (!seen && d < MT.hearR && mindRand(M) < MT.hearP * (0.4 + 0.6 * aw)) seen = true;
          if (!seen) continue;
          const k = mindIx(sd, j) * NF, e = d * nz;
          m[k] = q.x + gauss(M) * e; m[k + 1] = q.y + gauss(M) * e;
          m[k + 2] = (q.vx || 0) * (1 + gauss(M) * vz); m[k + 3] = (q.vy || 0) * (1 + gauss(M) * vz);
          m[k + 4] = tick;
        }
      }
      // ---- "MAN ON" -------------------------------------------------------------------------------
      // The man with the ball, or the one it is travelling to, is told about the opponent closing on his
      // blind side. How often somebody shouts is how well drilled the side is.
      const target = onBall || (mp.flight && mp.fside === side && mp.fj === i);
      if (target) {
        const callP = MT.callLo + MT.callDrill * drill;
        const opp = s.players[meOther(side)], os = meOther(side);
        for (let j = 0; j < opp.length; j++) {
          const q = opp[j];
          if (!q || q.off) continue;
          const d = Math.hypot(q.x - p.x, q.y - p.y);
          if (d > MT.callR) continue;
          const k = mindIx(os, j) * NF;
          if (tick - m[k + 4] < 2) continue;
          if (mindRand(M) < callP) {
            m[k] = q.x; m[k + 1] = q.y; m[k + 2] = q.vx || 0; m[k + 3] = q.vy || 0; m[k + 4] = tick;
          }
        }
      }
    }
  }
}

// WHERE HE THINKS SOMEBODY IS: the last sighting, carried on along the line the man was running for as
// long as that guess is worth anything, and held there after it.
export function mindSeen(s, p, side, j) {
  const m = p._mem, k = mindIx(side, j) * NF;
  const age = (s.mePos.tick - m[k + 4]) * ME_DT;
  const ext = Math.min(age, MT.memFade) / ME_DT;
  return { x: Math.max(0.5, Math.min(PITCH_L - 0.5, m[k] + m[k + 2] * ext)),
           y: Math.max(0.5, Math.min(PITCH_W - 0.5, m[k + 1] + m[k + 3] * ext)),
           vx: age > MT.memFade ? m[k + 2] * 0.4 : m[k + 2],
           vy: age > MT.memFade ? m[k + 3] * 0.4 : m[k + 3], age };
}

// THE WORLD AS HE SEES IT. A view of the state in which every other player stands where this man's
// memory puts him -- the same objects underneath (Object.create), so ratings, positions in the array
// and everything else read through unchanged, and only x, y, vx and vy are his belief. Every function
// the decision layer calls takes `s` and reads s.players, so handing it this view is all it takes for
// the choice to be made on what he knows rather than on the truth. The kick is still struck in the
// real world: a pass into a defender he never saw is cut out by that defender.
//
// A team-mate he has not seen for longer than his memory holds, or who is further off than he looks for
// a pass, is not an option: he is flagged `off` in the view only, which every option loop already skips.
// `at` moves the man himself, for a decision about the ball before it reaches him.
export function mindLens(s, side, i, at) {
  const mp = s.mePos, p = s.players[side][i];
  if (globalThis.__omni && !at) return s;                // harness-only: decide on the truth
  const key = mp.tick * 64 + mindIx(side, i) + (at ? 32 : 0);
  if (!at && p._lensK === key) return p._lens;
  const aw = mindAware(p);
  const visMem = MT.visMemLo + (MT.visMemHi - MT.visMemLo) * aw;
  const visR = MT.visRangeLo + (MT.visRangeHi - MT.visRangeLo) * aw;
  const view = Object.create(s);
  view.players = { home: [], away: [] };
  const sx = at ? at.x : p.x, sy = at ? at.y : p.y;
  for (const sd of ME_SIDES) {
    const qs = s.players[sd], arr = view.players[sd];
    for (let j = 0; j < qs.length; j++) {
      const q = qs[j];
      if (!q || q.off) { arr.push(q); continue; }
      if (q === p) {
        if (!at) { arr.push(p); continue; }
        const me = Object.create(p); me.x = at.x; me.y = at.y; me.vx = at.vx ?? p.vx; me.vy = at.vy ?? p.vy;
        arr.push(me); continue;
      }
      const b = mindSeen(s, p, sd, j);
      const o = Object.create(q);
      o.x = b.x; o.y = b.y; o.vx = b.vx; o.vy = b.vy; o._age = b.age;
      if (sd === side && q.pos !== "GK" && (b.age > visMem || Math.hypot(b.x - sx, b.y - sy) > visR)) o.off = true;
      arr.push(o);
    }
  }
  if (!at) { p._lensK = key; p._lens = view; }
  return view;
}

// The man in a view who is this real player, or the real one when the view is the truth.
export const mindSelfIn = (view, side, i) => view.players[side][i];

