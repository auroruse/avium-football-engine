// On-the-ball decisions: shoot, pass, carry or clear, scored as expected goals.
import { CFG, NO_INSTRUCTIONS } from "./config";
import { meAtkW, meAttrs } from "./attributes";
import { ME_HALF_W, PITCH_L, meDanger, meDir, meLaneBlock, meOffsideLine, meOther, mePressure, meShotGeom, meVal } from "./geometry";
import { meTick } from "./match";

export const ME_XG_K = 0.143;

export function meShotP(s, side, p, x, y) {
  const g = meShotGeom(side, x, y);
  if (g.d > 40) return 0;
  const a = meAttrs(p);
  // Base conversion from geometry alone, then the finisher, then how hurried he is.
  let q = Math.exp(-g.d * ME_XG_K) * Math.min(1, g.ang / 0.42) * 0.78;
  q *= 0.60 + a.shoot / 99 * 0.80;
  q *= 1 / (1 + mePressure(s, side, x, y) * 0.35);
  // The keeper. Absolute: his reflexes against this shot, nothing to do with who he plays for.
  const gk = s.players[meOther(side)].find(q2 => q2.pos === "GK");
  if (gk) q *= Math.max(0.22, 1.24 - meAttrs(gk).reflex / 99 * 0.70) * (gk.emergencyGK ? 1.35 : 1);
  return Math.max(0, Math.min(0.95, q));
}

// ---- the decision -----------------------------------------------------------------------
// Every option is scored as "how much is the ball worth after this, times the chance it comes off".
// Instructions move the SCORES, never the success rolls. Asking for more direct passing really does
// mean attempting balls that get cut out more often, and that asymmetry is the whole design.
export const ME_SHOT_WORTH = 1.0;    // a shot is worth exactly its xG now; the constant survives only so
                              // chanceCreation has something to scale. See mecal.mjs.

// Set to an array to have every decision record what it considered. Off in normal play.
export let ME_DBG = null;

export const meSetDbg = (v) => { ME_DBG = v; };

export function meDecide(s, rng, side, i) {
  const ps = s.players[side], p = ps[i], a = meAttrs(p), st = s.strategy?.[side] || NO_INSTRUCTIONS;
  const mp = s.mePos, press = mePressure(s, side, p.x, p.y), here = meVal(side, p.x, p.y);
  const off = meOffsideLine(s, side), dir = meDir(side);
  // Every option below is scored the same way -- what you gain times the chance of getting it, minus
  // what you lose times the chance of not. Charging that cost to passes ALONE made carrying strictly
  // dominant and passing collapsed to a fifth of its rate, so it has to be applied to all three.
  const lose = CFG.loss * (0.35 + meDanger(meOther(side), p.x, p.y));
  let best = null, bestSc = -Infinity;
  // Shoot.
  const sp = meShotP(s, side, p, p.x, p.y);
  if (sp > 0) {
    const appetite = 1 + st.chanceCreation * 0.55 + meAtkW(p) * 0.30;
    const sc = sp * ME_SHOT_WORTH * appetite - (1 - sp) * lose * 0.32;   // a miss is only a goal kick
    if (ME_DBG) ME_DBG.shot = sc;
    if (sc > bestSc) { bestSc = sc; best = { k: "shot", p: sp }; }
  }
  // Pass.
  for (let j = 0; j < ps.length; j++) {
    if (j === i) continue;
    const q = ps[j];
    // A runner is passed INTO the space he is attacking; everyone else is passed to his feet. This
    // is what a through ball is, and without it a run in behind can never be found.
    const aimX = (q._runT > 0 && q._run === "behind") ? q._rx : q.x;
    const aimY = (q._runT > 0 && q._run === "behind") ? q._ry : q.y;
    const dx = aimX - p.x, dy = aimY - p.y, d = Math.hypot(dx, dy) || 0.1;
    if (d > 55) continue;
    // Offside. A man running in behind gets the benefit of the doubt for a couple of metres, which
    // is what makes a through ball possible at all; beyond that nobody plays it on purpose.
    const slack = q._run === "behind" ? CFG.offsideGrace : 0.4;
    if ((q.x - off) * dir > slack) continue;
    const fwd = (aimX - p.x) * meDir(side);
    const blk = meLaneBlock(s, side, p.x, p.y, aimX, aimY);
    // Longer balls and covered lanes fail more. This is the only place directness is ever paid for.
    // Whether the RECEIVER is marked, which is the thing that was missing: success depended on the
    // lane and on the passer being closed down, but never on the man you were passing to being
    // picked up. With marking limited to a sensible few, that left every receiver free and
    // completion sat at 95% -- no turnovers, no shots, a match of endless sideways passing.
    const rPress = mePressure(s, side, q.x, q.y);
    let ok = (CFG.passBase - d * 0.0072) * Math.exp(-blk * CFG.laneK) * (0.72 + a.pass / 99 * 0.34)
           * (1 / (1 + press * 0.20)) * (1 / (1 + rPress * CFG.recvPress)) * (0.86 + meAttrs(q).position / 99 * 0.20);
    ok = Math.max(CFG.passFloor, Math.min(0.985, ok));
    // What the pass is WORTH, before instructions.
    let val = meVal(side, aimX, aimY) + CFG.keep;
    // Directness: bias toward balls that gain ground. Work-ball-in does the reverse. These are the
    // only lines an instruction touches, and they move what is ATTEMPTED, never whether it lands.
    val += fwd * (CFG.fwdPull + st.passingDir * 0.00034);
    if (st.approachPlay === -1 && fwd < 0) val += 0.004;
    if (st.approachPlay === 1) val += Math.max(0, fwd) * 0.00024;
    const sc = ok * val - (1 - ok) * CFG.loss * (0.35 + meDanger(meOther(side), p.x, p.y))
             + (q.pos === "GK" ? -0.020 : 0);
    if (ME_DBG) ME_DBG.pass = Math.max(ME_DBG.pass ?? -1, sc);
    if (sc > bestSc) { bestSc = sc; best = { k: "pass", j, p: ok, ax: aimX, ay: aimY }; }
  }
  // Carry it. Cheap, safe, gains a little -- and the option a pressed player loses first.
  // drb is now a real retention probability, and meTick rolls against exactly this number.
  const drb = Math.max(CFG.carryFloor, Math.min(0.97, 1 - (0.05 + press * CFG.carryRisk) * (1.7 - a.pace / 99 * 0.7) / (1 + st.dribbling * 0.20)));
  const dsc = drb * (meVal(side, p.x + dir * CFG.carryAdv, p.y) + CFG.keep * 0.72) - (1 - drb) * lose;
  if (ME_DBG) { ME_DBG.carry = dsc; ME_DBG.press = press; ME_DBG.nopts = ps.length; }
  if (dsc > bestSc) { bestSc = dsc; best = { k: "carry", p: drb }; }
  // Hoofing it. You probably concede possession, but you concede it forty metres from your own goal
  // instead of ten, and the cost of losing it is charged WHERE IT LANDS rather than where you stand.
  // That is the whole value of the option, and it is why it has to be scored rather than used as a
  // last resort: with a hard threshold it fired exactly zero times a match, so a pinned side had no
  // way of ever resetting field position and a rating gap compounded territorially without limit.
  if (press > 2.1) {
    const cx = Math.max(2, Math.min(PITCH_L - 2, p.x + dir * 38));
    const sc = 0.42 * (meVal(side, cx, ME_HALF_W) + CFG.keep * 0.40)
             - 0.58 * CFG.loss * (0.35 + meDanger(meOther(side), cx, ME_HALF_W));
    if (sc > bestSc) { bestSc = sc; best = { k: "clear", p: 0.42 }; }
  }
  return best || { k: "carry", p: 0.5 };
}
