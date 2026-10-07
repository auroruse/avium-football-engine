// THE PLAYER BRAIN ON THE BALL. Grown out of meDecide (../decide.ts), which is kept untouched for the
// first brain. The option menu and the way each option is priced are the same calibrated machinery --
// shot by expected goals, every pass by where it is going and who can reach it first, the carry, the
// clearance, the ball into the stand -- and five things change:
//
//   1. HE DECIDES ON WHAT HE HAS SEEN. Called with mindLens's view, every position he reads is his
//      memory of it. A team-mate he has lost track of is not on his menu at all.
//   2. A MISREAD IS HELD. The first brain re-drew its judgement noise every quarter second, so a poor
//      player's error was a fresh coin each slice and he dithered between options he had misjudged
//      differently each time. Here the error belongs to the man, the option and the possession: he
//      keeps believing the wrong thing until the moment changes.
//   3. HE HOLDS A PLAN. A new option has to beat the one he is already set on by a margin (mindChoose).
//   4. THE BEST READERS SEE TWO MOVES. The few best passes are credited with what the man receiving
//      them can do next -- the ball before the assist -- in proportion to how much he sees.
//   5. HE CARRIES IT WHERE HE SCORES IT. The first brain priced a carry eight metres straight upfield
//      and then ran wherever an eight-way search pointed. The carry is now priced on several headings
//      and the one chosen is the one he takes. And the point a carry or a better shot is priced at no
//      longer runs past the goal line, which handed a free chance to any man inside eight metres.
import { meCoachSt, CFG, ME_DT, ME_HOME_ADV, ME_PAT_MAP, NO_INSTRUCTIONS, meZone } from "../config";
import { meAtkW, meAttrs, meBadgeFx, meGkSkill, meMind, mePassBadge, meTech, meSpeed } from "../attributes";
import { meKeeper, ME_HALF_W, PITCH_L, PITCH_W, meDanger, meDir, meGoalX, meGroundT, meLaneBlock, meOffsideLine,
         meOther, mePassRisk, mePressure, meShotGeom, meThruCover, meTimeToBallMs, meVal, meValHere } from "../geometry";
import { meGroundMaxD, meLoftT } from "../ball";
import { meMeetGround, meMeetLoft, mePassExecD } from "../pass";
import { meTouchNear } from "../touch";
import { meOppDist } from "../brain";
import { meCoverGoalSide, meShotP, meShotSit, meWindUp } from "../decide";
import { MT } from "./tune";
import { mindAware, mindIx, mindLens } from "./perceive";
import { dribSkill, tackSkill } from "./duel";
import { mindPatience } from "./team";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// HIS OWN READ OF AN OPTION, fixed for the possession. A hash rather than a draw: the same man asking
// about the same option in the same possession gets the same answer, drifting slowly over a few
// seconds, and nothing is taken from the match's own random stream.
function hu(a, b, c, d) {
  let h = 0x811c9dc5 ^ (a | 0);
  h = Math.imul(h ^ (b | 0), 0x01000193);
  h = Math.imul(h ^ (c | 0), 0x01000193);
  h = Math.imul(h ^ (d | 0), 0x01000193);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
const tri = (a, b, c, d) => hu(a, b, c, d) + hu(a ^ 0x5bd1e995, b, c, d) - 1;

const KIND_K = { feet: 1, long: 2, switch: 3, through: 4, space: 5, over: 6, cross: 7, throw: 8, punt: 9 };

// THE MAN IN THE WAY. mePassRisk asks who can RACE the ball to its line, and a defender a metre off it two
// strides away loses that race on paper -- he cannot react before it is past him. But he does not need to
// react: the ball goes into his legs. Measured among the strongest sides, one ball to feet in ten was
// blocked within four metres of the man who played it, two in three of them first time, with the blocker
// a median 0.9 m off the line. A footballer does not play it through a man standing in front of him; he
// sees the body, and so does this. Ground balls over their first few metres, a lofted ball only as it
// leaves the foot; a man alongside him counts for less than one in front.
function blockRisk(s, side, x0, y0, x1, y1, high) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const lim = high ? 2.2 : Math.min(L - 0.5, 6);
  let p = 0;
  for (const q of s.players[meOther(side)]) {
    if (!q || q.off) continue;
    const rx = q.x - x0, ry = q.y - y0, along = rx * ux + ry * uy;
    if (along < -1.2 || along > lim) continue;
    const perp = Math.abs(-rx * uy + ry * ux);
    const reach = CFG.bodyR + CFG.ballR + 0.55 + Math.max(0, along) * 0.12;
    if (perp >= reach + 0.35) continue;
    const b = (perp <= reach ? 0.85 : 0.85 * (reach + 0.35 - perp) / 0.35) * (along < 0 ? 0.55 : 1);
    if (b > p) p = b;
  }
  return p;
}

// `v` is the world as he sees it (mindLens); everything else is as meDecide.
export function mindDecide(v, side, i, dwell, noCarry, ft) {
  const s = v, ps = s.players[side], p = ps[i], a = meAttrs(p), st = meCoachSt(s.strategy?.[side] || NO_INSTRUCTIONS, p);
  const isGK = p.pos === "GK";
  const mp = s.mePos, M = mp.mind, press = mePressure(s, side, p.x, p.y), here = meVal(side, p.x, p.y);
  const off = meOffsideLine(s, side), dir = meDir(side);
  const role = p._role2 || {};
  const aw = mindAware(p), mind = meMind(p);
  // His identity and the moment his reads belong to.
  const me = mindIx(side, i), epi = M?.epi ?? 0, slow = Math.floor(mp.tick / 12);
  let goalSide = 0;
  for (const q of s.players[meOther(side)]) {
    if (q.pos === "GK" || q.off) continue;
    if ((q.x - p.x) * dir > 0 && Math.abs(q.y - p.y) < 20) goalSide++;
  }
  const runAtGoal = !meThruCover(s, side, p)
    || (meLaneBlock(s, side, p.x, p.y, meGoalX(side), ME_HALF_W) < CFG.noBackLane
        && Math.abs(meGoalX(side) - p.x) < CFG.noBackRange);
  const shut = clamp(Math.min(1, goalSide / 3.5) * 0.65
                   + Math.min(1, meLaneBlock(s, side, p.x, p.y, meGoalX(side), ME_HALF_W) / 3) * 0.35, 0, 1);
  const obey = (CFG.obeyBase + CFG.obeySpan * (1 - mind)) * (1 - (st.creativity || 0) * CFG.creObey);
  const styleW = CFG.styleW * obey;
  const held = (st.possWon || 0) < 0 && mp.side === side && mp.possT < CFG.transT ? CFG.holdSafe : 0;
  // His role's own appetite for risk sits on top of the side's.
  const riskM = Math.max(0.3, 1 - (st.creativity || 0) * CFG.styleRiskW * obey + held - (role.risk || 0) * 0.18);
  const lose = CFG.loss * riskM * (0.35 + meDanger(meOther(side), p.x, p.y));
  // AWAY FROM HOME he misjudges a little more: the crowd, the strange ground (ME_HOME_ADV.nerves).
  const guest = (s.homeAdv === "home" || s.homeAdv === "away") && side !== s.homeAdv;
  const miss = CFG.judgeErr * (1 - mind) * (guest ? 1 + (ME_HOME_ADV.nerves || 0) * ME_HOME_ADV.k : 1);
  const clsW = Math.sqrt(CFG.judgeShare), ownW = Math.sqrt(1 - CFG.judgeShare);
  const cls = { shot: tri(me, epi, 11, slow), pass: tri(me, epi, 12, slow), carry: tri(me, epi, 13, slow), clear: tri(me, epi, 14, slow) };
  const jit = (c, key) => (clsW * cls[c] + ownW * tri(me, epi, 1000 + key, slow)) * miss;
  const opts = [];
  const push = (o, sc, key, c) => { o.sc0 = sc; o.sc = sc + jit(c, key); o.key = key; opts.push(o); };
  const sbx = ft ? ft.bvx : mp.bvx, sby = ft ? ft.bvy : mp.bvy, sbz = ft ? ft.bz : mp.bz;
  const spvx = (p.vx || 0) / ME_DT, spvy = (p.vy || 0) / ME_DT, snear = meTouchNear(s, side, p.x, p.y);
  const exD = (ox, oy) => mePassExecD(sbx, sby, sbz, spvx, spvy, ox, oy, snear);
  // ---- SHOOT -------------------------------------------------------------------------------------
  const shotD = exD(meGoalX(side) - p.x, ME_HALF_W - p.y);
  const shotSit = meShotSit(s, side, p, meGoalX(side), ME_HALF_W);
  // A man with time and room at range knows he can set himself and pick his corner (meWindUp).
  const sp = meShotP(s, side, p, p.x, p.y) * Math.max(0, 1 - shotD * CFG.execShotLoss)
           * Math.max(0, 1 - shotSit * CFG.shotSitLoss)
           * (1 + meWindUp(Math.hypot(meGoalX(side) - p.x, ME_HALF_W - p.y), shotSit, shotD, !!ft) * CFG.shotSetK);
  // Where a few strides more would take him: toward the goal mouth, and never past the line.
  const gdx = meGoalX(side) - p.x, gdy = ME_HALF_W - p.y, gdl = Math.hypot(gdx, gdy) || 1;
  const adv = Math.max(0, Math.min(CFG.carryAdv, gdl - 3));
  const _cx = p.x + gdx / gdl * adv, _cy = p.y + gdy / gdl * adv;
  const spAhead = adv < 0.5 ? sp : meShotP(s, side, p, _cx, _cy)
                / (1 + press * CFG.carryDelay)
                * Math.min(1, meOppDist(s, side, _cx, _cy) / (CFG.carryAdv * CFG.carryReach));
  if (sp > CFG.shotMinP) {
    const gsh = meShotGeom(side, p.x, p.y);
    const lane = meLaneBlock(s, side, p.x, p.y, meGoalX(side), ME_HALF_W);
    const clear = Math.max(0, 1 - lane / CFG.shotLaneClear);
    const range = CFG.shotRange + a.shoot / 99 * CFG.shotRangeSkill + clear * CFG.shotClearRange + (meBadgeFx(p).range ?? 0);
    const sight = clear * clamp(1 - (gsh.d - range) / CFG.shotRangeFade, 0, 1);
    const nowBetter = sp > spAhead ? (sp - spAhead) / Math.max(sp, 1e-4) : 0;
    const sightHold = gsh.d < CFG.sightHoldD ? 1 : Math.pow(Math.min(1, sp / Math.max(sp, spAhead, 1e-4)), 2);
    const appetite = 1 + meAtkW(p) * 0.30 + sight * CFG.shotSight * sightHold + nowBetter * CFG.shotNowW;
    const wantD = CFG.shotWant + st.chanceCreation * CFG.shotWantStep;
    const offWant = Math.max(0, gsh.d - wantD - CFG.shotBand) - Math.max(0, gsh.d - CFG.shotWant - CFG.shotBand);
    const waitCost = Math.max(0, spAhead - sp) * CFG.shotWaitW / (1 + press * CFG.shotWaitPress);
    const sc = sp * (CFG.shotWorth ?? 1) * appetite - (1 - sp) * lose * CFG.shotMissW - offWant * CFG.shotWantW - waitCost;
    push({ k: "shot", p: sp, execD: shotD }, sc, 1, "shot");
  }
  // ---- PASS --------------------------------------------------------------------------------------
  const toLine = Math.abs(meGoalX(side) - p.x);
  // A WIDE SIDE CROSSES EARLY: from further out, the moment there is a man to find.
  const crossZone = toLine < CFG.crossFromX + Math.max(0, st.width || 0) * 3 && Math.abs(p.y - ME_HALF_W) > CFG.crossFromY;
  const inHands = isGK && mp.held && mp.side === side && mp.idx === i;
  const passTech = meTech(a.pass);
  const kindTech = (t, kn) => kn === 1 ? t
    : clamp(1 - kn * (1 - t) - (kn - 1) * CFG.passNoiseDeg / CFG.passNoiseSkill, 0, 1);
  const loftAt = Math.min(CFG.loftD - (st.passingDir || 0) * CFG.loftDir, meGroundMaxD());
  const inBox = (x, y) => Math.abs(meGoalX(side) - x) < CFG.crossBoxX && Math.abs(y - ME_HALF_W) < CFG.crossBoxY;
  const ownHalf = (p.x - meGoalX(meOther(side))) * dir < PITCH_L / 2;
  let crossOn = false;
  if (crossZone && (st.width || 0) > 0)
    for (const q of ps) if (q && q !== p && !q.off && q.pos !== "GK"
        && Math.abs(meGoalX(side) - q.x) < CFG.crossBoxX + 9 && Math.abs(q.y - ME_HALF_W) < CFG.crossBoxY + 4) { crossOn = true; break; }
  const recycOut = ownHalf && !isGK && (M?.recyc?.[side] ?? 0) >= 1 + Math.round(mindPatience(st) * 6);
  // How deep he is in his own half, for the build-up and progression limits below.
  const myDepth = (p.x - meGoalX(meOther(side))) * dir;
  const longBuild = !!s.plan?.[side]?.longBuild && !isGK && myDepth < MT.longBuildTo && press < MT.longBuildPress;
  const fwdOnly = !!s.plan?.[side]?.fwdOnly && !isGK && myDepth >= MT.longBuildTo && myDepth < MT.fwdOnlyTo && press < MT.fwdOnlyPress;
  const minOk = s.plan?.[side]?.minOk || 0; const minCarry = s.plan?.[side]?.minCarry || 0;
  const breakNow = (st.possWon || 0) > 0 && mp.side === side && (mp.possT ?? 99) < MT.cntT && !isGK
    && (p.x - meGoalX(meOther(side))) * dir < PITCH_L / 2;
  const clearNow = !!s.plan?.[side]?.clearLines && !isGK && press > MT.clrPress
    && (p.x - meGoalX(meOther(side))) * dir < MT.clrDepth;
  const consider = (q, j, c) => {
    const aimX = c.ax, aimY = c.ay;
    const dx = aimX - p.x, dy = aimY - p.y, d = Math.hypot(dx, dy) || 0.1;
    if (d > (c.kind === "punt" ? 65 : c.rel ? MT.relMaxD : 55)) return;
    // Nobody passes to a man standing next to him. Under three metres he keeps it, or the man moves.
    if (d < 3) return;
    const slack = c.thru ? CFG.offsideGrace : 0.4;
    const seen = (q.x - off) * dir + tri(me, epi, 3000 + j, slow) * CFG.offBlind * (1 - mind);
    if (seen > slack && (q.x - p.x) * dir > 0 && (q.x - PITCH_L / 2) * dir > 0) return;
    const fwd = (aimX - p.x) * dir;
    // OUT OF PATIENCE. A side that has already recycled it as often as its style allows does not look
    // back or across again in its own half -- unless he is being closed down, when anybody plays the
    // safe one. A limit on what he considers, not a price on what it is worth.
    if (fwd < 2 && recycOut && press < 1.2) return;
    // LONG FROM THE BACK (plan.longBuild). A side that builds long does not pass it about in its own third: the
    // ball goes forward and far, to the front men or the channel, or it is carried out. Left to the arithmetic, a
    // Route One side played 152 passes a match at 83%, exactly what Balanced did. Pressed, he plays what he can.
    if (longBuild && (fwd < MT.longBuildFwd || d < MT.longBuildD)) return;
    // FORWARD (plan.fwdOnly). Through the middle a direct side plays it forward, never square or back to start
    // again: it takes the risk the ball goes, and pays in how often it keeps it.
    if (fwdOnly && fwd < MT.fwdOnlyMin) return;
    // ...and a wide side's crosser with somebody to find does not turn it back inside.
    if (fwd < -2 && crossOn && press < 1.2) return;
    // NEVER ACROSS YOUR OWN AREA IN THE AIR. A lofted ball played square across the face of your own box
    // is the one pass every coach forbids: if it is cut out, the man who cuts it out is through on goal.
    // Under pressure in his own third a footballer goes down the line, back to the keeper, or clears it.
    if (c.high && !isGK) {
      const og = meGoalX(meOther(side)), aimDep = (aimX - og) * dir, myDep = (p.x - og) * dir;
      if (aimDep < 32 && Math.abs(aimY - ME_HALF_W) < 22 && Math.abs(aimY - p.y) > 18 && aimDep - myDep < 10) return;
    }
    // NOT STRAIGHT BACK TO HIM. The man who has just given it to him gets it back only as a one-two (he is
    // running past his man), as a ball forward, or when there is no time to do anything else.
    if (j === p._gotFrom && mp.tick - (p._gotT ?? -99) < 10 && !((q._runT ?? 0) > 0) && fwd < 3 && press < 1.0) return;
    // NOR THE SWITCH STRAIGHT BACK. A switch is played to attack the space on that side; the man it finds
    // goes at it, he does not send it back across while the block is still shifting.
    if (c.k === "switch" && M?.lastSw && M.lastSw.side === side && mp.tick - M.lastSw.t < 14
        && Math.sign(aimY - ME_HALF_W) === M.lastSw.from && press < 1.0) return;
    const spq = meShotP(s, side, q, aimX, aimY) * (c.k === "cross" ? CFG.crossHeadK : 1);
    if (fwd < -CFG.noBackDist && (sp > CFG.noBackShot || runAtGoal) && spq <= sp) return;
    if (runAtGoal && fwd < CFG.sideAdvance) {
      const betterSight = spq > sp * CFG.sideBetter;
      const freer = mePressure(s, side, aimX, aimY) < press - CFG.sideFreer;
      if (!betterSight && !freer) return;
    }
    const blk = c.blk;
    const rPress = mePressure(s, side, aimX, aimY);
    let val0 = 0;
    const rp = c.high && c.k !== "over" ? CFG.recvPressHigh : CFG.recvPress;
    const distK = CFG.passDistK * (1 - (c.thru && q._run === "behind" ? Math.min(1, meOppDist(s, side, aimX, aimY) / CFG.roomFull) * CFG.escDistRelief : 0));
    const xD = exD(dx, dy);
    const tech = kindTech(passTech + mePassBadge(p, c.k, d, !!c.high), c.high ? (CFG.kindNoise[c.kind] ?? 1) : 1) * Math.max(0, 1 - xD * CFG.execSkillLoss);
    const okBase = (CFG.passBase - d * distK) * Math.exp(-blk * CFG.laneK) * (CFG.passSkillLo + tech * CFG.passSkillW)
           * (1 / (1 + press * 0.20)) * (1 / (1 + rPress * rp))
           * (CFG.rcvPosLo + meTech(meAttrs(q).position) * CFG.rcvPosW);
    const loft = c.high ? { T: c.tb, z1: c.zEnd ?? CFG.ballR } : null;
    const risk = mePassRisk(s, side, p.x, p.y, aimX, aimY, c.high ? d / c.tb : 0, c.high, c.va, loft) * (c.high ? CFG.riskHigh : 1);
    const okRisk = 1 - risk * CFG.riskW;
    const tBall = c.tb * 1000;
    const late = meTimeToBallMs(q, aimX, aimY, meSpeed(meAttrs(q), q.stamina), CFG.rcvLag) - tBall;
    const okLate = late > CFG.rcvLateMs ? 1 - Math.min(1, (late - CFG.rcvLateMs) / CFG.riskSpanMs) * CFG.riskW : 1;
    if (isGK) val0 += (d > CFG.gkLongD ? 1 : -1) * (st.gkDist || 0) * CFG.gkDistW;
    let ok = 1 / (1 + Math.exp(-(CFG.passCal0 + CFG.passCalB * Math.log(Math.max(0.01, okBase))
                                 + CFG.passCalR * Math.log(Math.max(0.01, okRisk))
                                 + CFG.passCalL * Math.log(Math.max(0.01, okLate)))));
    if (c.k === "throw") ok *= CFG.gkThrowOk;
    else if (isGK && !c.high && d < CFG.gkRollD) ok *= CFG.gkRollOk;
    ok *= 1 - blockRisk(s, side, p.x, p.y, aimX, aimY, c.high) * MT.blockK;
    ok = clamp(ok, CFG.passFloor, 0.985);
    // A team-mate he last saw a while ago is a guess: the ball goes to where he thinks the man is.
    if ((q._age ?? 0) > 1.0) ok *= Math.max(0.55, 1 - ((q._age ?? 0) - 1.0) * 0.08);
    // CLEAR YOUR LINES (plan.clearLines). A side that builds long does not play short or across in its own
    // third with a man on it: it gets the ball forward, to somebody or into the channel, or out. Traced, a deep
    // side lost a fifth of the balls it won in its own third again within seconds, before anybody could run.
    if (clearNow && fwd < MT.clrFwd) return;
    // THE FIRST BALL GOES FORWARD. A side set up to break (possWon > 0) that has just won it does not play
    // back or across to the man beside him: from its own half the first ball goes forward, to the man left up
    // or into the space behind them. Traced against a pressing side, its breaks from its own third went
    // short to feet half the time and a quarter of them were lost where they were won.
    if (breakNow && fwd < MT.cntFwdMin && press < MT.cntPress) return;
    // KEEP IT (plan.minOk). A side that plays for control does not play a forward ball it is not sure of
    // short of the last third: it goes back or across and asks again. A limit on what he considers, not a
    // price on what it is worth -- it buys the ball and pays in ground. Being closed down, anybody plays it.
    if (minOk && fwd > 2 && ok < minOk && press < 1.0 && (aimX - meGoalX(meOther(side))) * dir < MT.keepUpTo) return;
    let val = meVal(side, aimX, aimY) + CFG.keep + (fwd <= 0 ? CFG.keepBuild * shut : 0) + val0;
    val += fwd * CFG.fwdPull;
    const want = CFG.passWant + st.passingDir * CFG.passWantStep;
    const breaking = mp.side === side && (mp.possT ?? 99) < CFG.transT && (st.possWon || 0) > 0;
    if (!breaking && meCoverGoalSide(s, side, aimX) > 0)
      val -= Math.max(0, Math.abs(d - want) - CFG.passBand) * CFG.passWantW;
    const edgeUse = clamp((Math.min(aimY, PITCH_W - aimY) - CFG.edgeMin) / CFG.edgeFull, 0, 1);
    const roomRaw = Math.min(1, meOppDist(s, side, aimX, aimY) / CFG.roomFull);
    const room = roomRaw * (CFG.edgeLo + (1 - CFG.edgeLo) * edgeUse);
    val += room * Math.max(0, fwd) * CFG.roomFwd;
    // The second brain's sides hold their width, so the far side is usually there to be found; the room a
    // switch finds is worth less to it than the first brain paid (MT.switchW, not CFG.switchW).
    if (c.k === "switch") val += roomRaw * MT.switchW;
    val += Math.max(0, spq - sp) * CFG.passShotW;
    if (c.thru && q._run === "behind") {
      const _gs = meCoverGoalSide(s, side, aimX);
      val += Math.max(0, 1 - _gs / 2) * CFG.escThruW;
    }
    if (q.pos !== "GK") val += Math.max(0, meMind(q) - mind) * CFG.passRecvW;
    if (q._pmk && q !== p) val += q._pmk * CFG.pmkRecvW;
    if (q._role && q !== p) val += q._role * CFG.roleRecvW;
    const seeHard = Math.min(1, (c.thru ? CFG.visThru : 0) + blk * CFG.visLane + Math.max(0, d - CFG.visD0) / CFG.visDSpan);
    val -= CFG.visMiss * seeHard * (1 - mind);
    const _pat = s.plan?.[side] ? s.plan[side].zones : ME_PAT_MAP[s.styles?.[side]];
    if (_pat) {
      const _gx = meGoalX(side);
      const _w = _pat.get(meZone(Math.abs(_gx - p.x), p.y) * 9 + meZone(Math.abs(_gx - aimX), aimY));
      if (_w) val += _w * CFG.patW;
    }
    // THE DRILLED BALL. A side running one of its moves (mind/team.ts, mindPatterns) has rehearsed this
    // pass; the man on the ball looks for it first, as much as the side is drilled and he can see it.
    const pat = M?.pat?.[side];
    if (pat && ((pat.j === j && pat.kinds.includes(c.k)) || (pat.k === "thirdman2" && pat.back === j && c.k === "feet")))
      val += MT.patW * (0.4 + 0.6 * (M.drill?.[side] ?? 0.4)) * (0.5 + 0.5 * aw);
    const giveUp = Math.max(0, here - meVal(side, aimX, aimY)) * CFG.surrender;
    const sc = ok * (val - giveUp) - (1 - ok) * CFG.loss * riskM * (0.35 + meDanger(meOther(side), aimX, aimY))
             + (q.pos === "GK" ? -0.020 : 0);
    push({ k: "pass", j, p: ok, ax: aimX, ay: aimY, high: c.high, thru: !!c.thru, pk: c.k, kind: c.kind, zEnd: c.zEnd,
           va: c.va, execD: xD, rel: !!c.rel, c: [okBase, okRisk, okLate, d, blk, press, rPress], _q: q },
         sc, 100 + j * 16 + (KIND_K[c.k] || 0), "pass");
  };
  for (let j = 0; j < ps.length; j++) {
    if (j === i) continue;
    const q = ps[j];
    if (!q || q.off) continue;
    const qvx = (q.vx || 0) / ME_DT, qvy = (q.vy || 0) / ME_DT, qsp = Math.hypot(qvx, qvy);
    const qTop = meSpeed(meAttrs(q), q.stamina);
    {
      let fx = q.x, fy = q.y;
      if (qsp > CFG.feetMoveV) {
        const d00 = Math.hypot(q.x - p.x, q.y - p.y);
        const l0 = Math.min(CFG.feetLeadMax, qsp * meGroundT(d00, d00) * CFG.feetLeadFrac);
        fx = q.x + qvx / qsp * l0; fy = q.y + qvy / qsp * l0;
      }
      const fd = Math.hypot(fx - p.x, fy - p.y);
      if (inHands) {
        if (fd <= CFG.gkThrowMax && meOppDist(s, side, fx, fy) < CFG.gkFreeR) { /* marked */ }
        else if (fd <= CFG.gkRollMax)
          consider(q, j, { ax: fx, ay: fy, k: "feet", high: false, tb: meGroundT(fd, fd), blk: meLaneBlock(s, side, p.x, p.y, fx, fy) });
        else {
          const kd = fd <= CFG.gkThrowMax ? "throw" : "punt";
          const sh = kd === "throw" ? Math.min(CFG.gkThrowShort, fd * 0.2) / Math.max(0.1, fd) : 0;
          consider(q, j, { ax: fx - (fx - p.x) * sh, ay: fy - (fy - p.y) * sh, k: kd === "throw" ? "throw" : "long", high: true, kind: kd,
                           zEnd: undefined, tb: meLoftT(fd, kd), blk: meLaneBlock(s, side, p.x, p.y, fx, fy, true) });
        }
      } else {
        const blkG = meLaneBlock(s, side, p.x, p.y, fx, fy);
        let high = fd > loftAt, blk = blkG;
        if (high) blk = meLaneBlock(s, side, p.x, p.y, fx, fy, true);
        else if (fd > 10) {
          const blkH = meLaneBlock(s, side, p.x, p.y, fx, fy, true);
          if (blkH * CFG.laneK + CFG.loftBar < blkG * CFG.laneK) { blk = blkH; high = true; }
        }
        if (isGK && fd <= CFG.gkThrowMax && meOppDist(s, side, fx, fy) < CFG.gkFreeR) { /* marked */ }
        else if (!high) consider(q, j, { ax: fx, ay: fy, k: "feet", high: false, tb: meGroundT(fd, fd), blk });
        else {
          const lat = Math.abs(fy - p.y);
          const sw = lat > CFG.switchLat && fd > CFG.switchD && lat > Math.abs(fx - p.x);
          const kd = sw ? "driven" : "loft";
          consider(q, j, { ax: fx, ay: fy, k: sw ? "switch" : "long", high: true, kind: kd,
                           zEnd: sw ? 0.25 : undefined, tb: meLoftT(fd, kd), blk });
        }
      }
    }
    if (inHands) continue;
    {
      const rk = (q._runT ?? 0) > 0 ? q._run : null;
      let ux = 0, uy = 0, vd = 0, committed = false;
      if (rk === "behind" || rk === "wall" || rk === "overlap" || rk === "third") {
        const rx = q._rx - q.x, ry = q._ry - q.y, rl = Math.hypot(rx, ry);
        if (rl > 0.5) { ux = rx / rl; uy = ry / rl; vd = qTop; committed = true; }
      }
      if (!committed && qsp > CFG.thruMoveV && qvx * dir > -0.3) {
        ux = qvx / qsp; uy = qvy / qsp; vd = Math.max(qsp, qTop * CFG.spaceVd);
      }
      if (vd > 0) {
        const g = meMeetGround(p.x, p.y, q.x, q.y, qvx, qvy, ux, uy, vd);
        const gOk = !!g && g.d <= CFG.groundMaxD;
        const gBlk = gOk ? meLaneBlock(s, side, p.x, p.y, g.ax, g.ay) : Infinity;
        if (gOk) consider(q, j, { ax: g.ax, ay: g.ay, k: committed ? "through" : "space", high: false, va: g.va, tb: g.t, thru: true, blk: gBlk });
        if (committed && (rk === "behind" || rk === "wall")) {
          const o = meMeetLoft(p.x, p.y, q.x, q.y, qvx, qvy, ux, uy, vd, "over", CFG.overLand);
          if (o && o.d >= CFG.overMinD) {
            const oBlk = meLaneBlock(s, side, p.x, p.y, o.ax, o.ay, true);
            if (!gOk || o.d > loftAt || oBlk * CFG.laneK + CFG.loftBar < gBlk * CFG.laneK)
              consider(q, j, { ax: o.ax, ay: o.ay, k: "over", high: true, kind: "over", tb: meLoftT(o.d, "over"), thru: true, blk: oBlk });
          }
        }
      }
    }
    // THE BALL IN BEHIND, for a man standing on the shoulder of their last defender with grass behind it. He
    // is a target before he has moved, and goes the moment it is struck (mindOnPass). Only a man already
    // running was ever offered the ball over the top, and nobody runs while the man on the ball is being
    // pressed -- so a pressed side never went over a high line and pressing high cost nothing: against a
    // last line 31 m off its own goal, 11% of long balls went in behind it, 4% to a man running.
    if (!((q._runT ?? 0) > 0) && (q._role2?.run?.behind ?? 0) >= MT.relRun && q.pos !== "GK") {
      const onLine = (q.x - off) * dir, room = (meGoalX(side) - off) * dir;
      if (onLine > -MT.relShoulder && onLine < 0.5 && room > MT.relRoom) {
        const tx = meGoalX(side) - dir * 6, ty = ME_HALF_W + (q.y - ME_HALF_W) * 0.6;
        const tl = Math.hypot(tx - q.x, ty - q.y) || 1;
        const o = meMeetLoft(p.x, p.y, q.x, q.y, qvx, qvy, (tx - q.x) / tl, (ty - q.y) / tl, qTop, "over", CFG.overLand);
        if (o && o.d >= CFG.overMinD && (o.ax - off) * dir > 1)
          consider(q, j, { ax: o.ax, ay: o.ay, k: "over", high: true, kind: "over", tb: meLoftT(o.d, "over"), thru: true, rel: true,
                           blk: meLaneBlock(s, side, p.x, p.y, o.ax, o.ay, true) });
      }
    }
    // A CROSS IS FOR A MAN WHO WILL BE IN THE BOX, not one who already is: with their line on the edge of
    // the area, the men attacking it are standing on that line until the ball comes, and they meet it inside
    // (the meeting point below has to be in the box).
    const nearBox = Math.abs(meGoalX(side) - q.x) < CFG.crossBoxX + 9 && Math.abs(q.y - ME_HALF_W) < CFG.crossBoxY + 4;
    if (crossZone && nearBox) {
      let ux, uy, vd;
      if (qsp > 1.5) { ux = qvx / qsp; uy = qvy / qsp; vd = Math.max(qsp, qTop * 0.7); }
      else {
        const gx6 = meGoalX(side) - dir * 6, tl = Math.hypot(gx6 - q.x, ME_HALF_W - q.y) || 1;
        ux = (gx6 - q.x) / tl; uy = (ME_HALF_W - q.y) / tl; vd = qTop * 0.6;
      }
      const o = meMeetLoft(p.x, p.y, q.x, q.y, qvx, qvy, ux, uy, vd, "cross", 0);
      if (o && inBox(o.ax, o.ay))
        consider(q, j, { ax: o.ax, ay: o.ay, k: "cross", high: true, kind: "cross", zEnd: CFG.crossZ,
                         tb: meLoftT(o.d, "cross"), blk: meLaneBlock(s, side, p.x, p.y, o.ax, o.ay, true) });
    }
  }
  // ---- TWO MOVES AHEAD ----------------------------------------------------------------------------
  // For his best few passes, what the receiver can do next from where he takes it: shoot, or play the
  // man beyond. Paid only in proportion to how much this man sees, and only for the gain over the
  // receiver's own spot, so it re-ranks passes and never invents one.
  const lk = MT.lookK * aw * aw;
  if (lk > 0.01) {
    const passes = opts.filter(o => o.k === "pass").sort((x, y) => y.sc - x.sc).slice(0, MT.lookTop);
    for (const o of passes) {
      const q = o._q, qx = o.ax, qy = o.ay;
      let nextV = 0;
      for (let k = 0; k < ps.length; k++) {
        const t = ps[k];
        if (k === i || k === o.j || !t || t.off || t.pos === "GK") continue;
        const dd = Math.hypot(t.x - qx, t.y - qy);
        if (dd < 5 || dd > 30) continue;
        if ((t.x - qx) * dir < 2) continue;                               // only the ball forward
        if ((t.x - off) * dir > 0.5 && (t._runT ?? 0) <= 0) continue;     // and not to a man standing offside
        const okN = clamp(0.95 - dd * 0.012, 0.3, 0.9) * Math.exp(-meLaneBlock(s, side, qx, qy, t.x, t.y) * CFG.laneK);
        const vN = (meVal(side, t.x, t.y) + Math.min(1, meOppDist(s, side, t.x, t.y) / CFG.roomFull) * 0.02) * okN;
        if (vN > nextV) nextV = vN;
      }
      const gain = Math.max(0, nextV - meVal(side, qx, qy));
      const add = lk * gain * o.p;
      o.sc += add; o.sc0 += add; o.look = add;
    }
  }
  // ---- CARRY -------------------------------------------------------------------------------------
  // On several headings now, each priced where it goes, and the chosen heading is his dribble.
  const thruMe = runAtGoal;
  const atk = dir > 0 ? 0 : Math.PI;
  const K = MT.carryDirs;
  for (let h = 0; h < K + 1; h++) {
    let ang;
    if (h < K) ang = atk + (h - (K - 1) / 2) * (Math.PI / (K - 1));            // -90 .. +90 degrees
    else if (p._drbA != null) ang = p._drbA; else continue;                    // and the way he is already going
    const cdx = p.x + Math.cos(ang) * CFG.carryAdv, cdy = p.y + Math.sin(ang) * CFG.carryAdv;
    if (cdx < 1 || cdx > PITCH_L - 1 || cdy < 1.5 || cdy > PITCH_W - 1.5) continue;
    const carryPress = Math.max(press, mePressure(s, side, cdx, cdy) * CFG.carryAhead);
    // A MAN IN HIS PATH IS A DUEL, and he knows roughly how his duels go: a dribbler backs himself against
    // a slow full-back, a centre-half does not take on a winger.
    let duel = 0;
    for (const q of s.players[meOther(side)]) {
      if (!q || q.off || q.pos === "GK") continue;
      const qx = q.x - p.x, qy = q.y - p.y, qd = Math.hypot(qx, qy);
      if (qd > 4.5 || qd < 0.1 || (qx * Math.cos(ang) + qy * Math.sin(ang)) / qd < 0.6) continue;
      duel = Math.min(duel === 0 ? 9 : duel, dribSkill(p) - tackSkill(q));
    }
    if (duel === 9) duel = 0;
    const drb = Math.max(CFG.carryFloor, Math.min(0.97, (1 - (0.05 + carryPress * CFG.carryRisk) * (1.7 - a.pace / 99 * 0.7))
                                                       * (1 + clamp(duel * 0.4, -0.3, 0.3))))
              * Math.pow(CFG.dwellDrop, Math.max(0, dwell || 0));
    const spH = meShotP(s, side, p, cdx, cdy) / (1 + press * CFG.carryDelay)
              * Math.min(1, meOppDist(s, side, cdx, cdy) / (CFG.carryAdv * CFG.carryReach));
    const spGain = Math.max(0, spH - sp);
    const fwdC = (cdx - p.x) * dir;
    const roomC = Math.min(1, meOppDist(s, side, cdx, cdy) / CFG.roomFull);
    const dsc = drb * (meValHere(s, side, cdx, cdy) + CFG.keep * 0.72 + spGain * CFG.carryShotW
                       + roomC * Math.max(0, fwdC) * CFG.roomFwd * CFG.carryRoomW)
              - (1 - drb) * CFG.loss * riskM * (0.35 + meDanger(meOther(side), cdx, cdy));
    const jd = dsc + (thruMe ? CFG.carryThruW * drb * Math.max(0, fwdC / CFG.carryAdv)
                             : CFG.carryInstrW * obey * (st.dribbling || 0) + (role.carry || 0) * 0.004);
    // ...and a side playing for control does not run it into a man it is not sure of beating (plan.minCarry),
    // short of the last third: it gives it to somebody instead. The same limit as minOk, for the carry.
    if (minCarry && drb < minCarry && carryPress > 0.4 && (cdx - meGoalX(meOther(side))) * dir < MT.keepUpTo) continue;
    // KEEP IT SIMPLE (dribbling < 0): he does not run it into a man unless that is his job. Into open grass he
    // still goes -- the old rule took the carry off him altogether after three slices, and at -0.57 xG a match it
    // was the most expensive thing on the sheet: half of all box entries are carries.
    if ((st.dribbling || 0) < 0 && carryPress > MT.simplePress && (role.carry || 0) < 0.3) continue;
    if (clearNow) continue;
    if (!noCarry) push({ k: "carry", p: drb, ang }, jd, 50 + h, "carry");
  }
  // ---- CLEAR -------------------------------------------------------------------------------------
  const ownGoal = meGoalX(meOther(side)), ownDepth = (p.x - ownGoal) * dir;
  if (isGK && ownDepth > CFG.gkSafeOut) {
    let cx = clamp(p.x + dir * 40, 2, PITCH_L - 2), cy = ME_HALF_W, cw = -Infinity;
    for (const q of ps) {
      if (q === p || q.off) continue;
      const up = (q.x - p.x) * dir;
      if (up < 8) continue;
      const w = up - mePressure(s, side, q.x, q.y) * 12;
      if (w > cw) { cw = w; cx = q.x; cy = q.y; }
    }
    const bx1 = cx - p.x, by1 = cy - p.y, bl1 = Math.hypot(bx1, by1) || 1;
    const want1 = Math.max(CFG.clearMinD, bl1 + CFG.clearPast);
    cx = clamp(p.x + bx1 / bl1 * want1, 2, PITCH_L - 2);
    cy = clamp(p.y + by1 / bl1 * want1, 2, PITCH_W - 2);
    return { k: "clear", p: 0.5, cx, cy, sc: 9, key: 2, alts: [] };
  }
  if (ownDepth < CFG.clearPanic || (ownDepth < CFG.clearDepth && press > CFG.clearPress)) {
    let cx = clamp(p.x + dir * 40, 2, PITCH_L - 2), cy = ME_HALF_W, cw = -Infinity;
    for (const q of ps) {
      if (q === p || q.pos === "GK" || q.off) continue;
      const up = (q.x - p.x) * dir;
      if (up < CFG.clearMinUp) continue;
      const w = up - mePressure(s, side, q.x, q.y) * 9 - Math.abs(q.y - p.y) * 0.25;
      if (w > cw) { cw = w; cx = q.x; cy = q.y; }
    }
    const bx0 = cx - p.x, by0 = cy - p.y, bl0 = Math.hypot(bx0, by0) || 1;
    const want0 = Math.max(CFG.clearMinD, bl0 + CFG.clearPast + press * CFG.clearOver);
    cx = clamp(p.x + bx0 / bl0 * want0, 2, PITCH_L - 2);
    cy = clamp(p.y + by0 / bl0 * want0, 2, PITCH_W - 2);
    const ok2 = CFG.clearOk;
    const relief = Math.max(0, meDanger(meOther(side), p.x, p.y) - meDanger(meOther(side), cx, cy)) * CFG.clearRelief;
    const urgency = Math.min(1, press / CFG.clearPress);
    const sc = ok2 * (meVal(side, cx, cy) + CFG.keep * 0.40) + relief * (0.2 + 0.8 * urgency)
             - (1 - ok2) * CFG.loss * riskM * (0.35 + meDanger(meOther(side), cx, cy));
    push({ k: "clear", p: ok2, cx, cy }, sc + (thruMe ? 0 : styleW * (st.approachPlay || 0) * CFG.apClearW), 2, "clear");
  }
  if (ownDepth < CFG.touchDepth && press > CFG.touchPress) {
    const sc = meDanger(meOther(side), p.x, p.y) * CFG.clearRelief * (0.2 + 0.8 * Math.min(1, press / CFG.touchPress))
             - CFG.loss * riskM * CFG.touchDiscount;
    push({ k: "touch", p: 1 }, sc, 3, "clear");
  }
  // ---- WHAT THE PLAN RULES OUT (after every option is on the table, carries and clearances included) ----
  // GET IT IN (plan.crossFirst). A side that attacks down the wings puts the ball into the box from the crossing
  // area whenever there is a cross on: not back inside, not across, not a lay-off -- a cross, or a ball along
  // the ground into the area. Measured without it, a wing side reached the crossing area two-fifths more often
  // than a Balanced one and then crossed from it LESS, a fifth of its passes from there against two-fifths.
  // Being closed down, he plays whatever gets him out. A limit on what he considers, not a price on any of it.
  if (s.plan?.[side]?.crossFirst && crossZone && press < MT.crossPress && opts.some(o => o.k === "pass" && o.pk === "cross"))
    for (let n = opts.length - 1; n >= 0; n--) {
      const o = opts[n];
      if (o.k === "pass" && o.pk !== "cross" && !inBox(o.ax, o.ay)) opts.splice(n, 1);
    }
  // TAKE HIM ON (plan.takeOn). A side built on its dribblers does not have them give it back or play it square
  // in the last forty metres when there is a man to go at: he goes at him, plays it forward, or shoots. Only a
  // man who can dribble is held to it, and being closed down, he plays whatever gets him out.
  if (s.plan?.[side]?.takeOn && toLine < MT.takeOnD && press < MT.crossPress && dribSkill(p) >= MT.takeOnSkill
      && opts.some(o => o.k === "carry" && o.ang != null && Math.cos(o.ang - (dir > 0 ? 0 : Math.PI)) > 0.3))
    for (let n = opts.length - 1; n >= 0; n--) {
      const o = opts[n];
      if (o.k === "pass" && (o.ax - p.x) * dir < 2 && !inBox(o.ax, o.ay)) opts.splice(n, 1);
    }
  // THE BALL GOES FORWARD (plan.earlyBall). On a break nobody plays it back or square to start again: with a man
  // going beyond him and a ball to him on, he plays that, or he runs with it. Traced, a counter side's ball-winner
  // ran on for four and six seconds while its striker stood on their last line and the cover got back. Ruling the
  // carry out as well helped against a Balanced side and cost two-thirds of the breaks' shots against a pressing one,
  // where running past the first man IS the break -- so the carry stays. Closed down, as above.
  if (s.plan?.[side]?.earlyBall && mp.side === side && (mp.possT ?? 99) < MT.earlyT && toLine > MT.earlyLast && press < MT.crossPress
      && opts.some(o => o.k === "pass" && o.thru && (o.ax - p.x) * dir > MT.earlyFwd && o.p > MT.earlyOk))
    for (let n = opts.length - 1; n >= 0; n--) {
      const o = opts[n];
      if (o.k === "pass" && (o.ax - p.x) * dir < 2) opts.splice(n, 1);
    }
  // IN BEHIND (plan.thruFirst). A side whose last third is the ball in behind plays it the moment it is on: from
  // their half to the edge of the area, with a man running beyond their last line and a ball into his path that
  // arrives often enough, the passes to feet go -- back, square and forward alike, unless into the box. He plays
  // the ball in behind, runs with it or shoots. Ruling out only the backward and square ones moved Vertical Tiki-Taka's
  // through balls 7%, because a ball to feet further up outbid the one in behind; this way it plays 7-10% more of them
  // than Balanced where it played 5% fewer (7 Oct 2026). The limit is how rarely a run in behind is on at all. Closed
  // down, he plays whatever gets him out.
  if (s.plan?.[side]?.thruFirst && toLine < MT.thruTo && toLine > MT.thruLast && !crossZone && press < MT.crossPress
      && opts.some(o => o.k === "pass" && o.thru && (o.ax - p.x) * dir > MT.thruFwd && o.p > MT.thruOk))
    for (let n = opts.length - 1; n >= 0; n--) {
      const o = opts[n];
      if (o.k === "pass" && !o.thru && !inBox(o.ax, o.ay)) opts.splice(n, 1);
    }
  // THE COUNTER IS ON. Breaking with them short at the back (team.ts mindPhase), the ball goes forward into the
  // space they left, now: with a ball on that gains cntGo metres and arrives often enough, the shorter passes go
  // (a run with it stays). Traced before this, a side that won it in its own box with their attackers still round
  // it kept it, played an 18-metre ball after three seconds, and had the ball 30 m from its goal ten seconds on --
  // positional value is flat that far out, so the safe ball always won and the space was gone before it moved.
  // Closed down, he plays whatever gets him out.
  const breaking = M?.ph?.[side]?.ph === "counter" && M.ph[side].short && mp.side === side && press < MT.crossPress;
  if (breaking && opts.some(o => o.k === "pass" && (o.ax - p.x) * dir >= MT.cntGo && o.p >= MT.cntGoOk))
    for (let n = opts.length - 1; n >= 0; n--) {
      const o = opts[n];
      if (o.k === "pass" && (o.ax - p.x) * dir < MT.cntGo) opts.splice(n, 1);
    }
  // ...AND THE MAN WITH IT RUNS AT THEM. Watched, a midfielder found on a break with nobody within eight metres and two
  // of theirs back carried it sideways for four seconds: thirty-odd metres from our goal the value of the ground is
  // flat, so going forward bought him nothing his sums could see. With room to run forward he runs: the carries that
  // do not go forward and the passes that do not go forward go. Closed down, as above.
  if (breaking && !isGK && opts.some(o => o.k === "carry" && o.ang != null && Math.cos(o.ang - atk) > MT.cntRunCos && o.p >= MT.cntRunOk))
    for (let n = opts.length - 1; n >= 0; n--) {
      const o = opts[n];
      if ((o.k === "carry" && o.ang != null && Math.cos(o.ang - atk) <= MT.cntRunCos)
          || (o.k === "pass" && (o.ax - p.x) * dir < MT.cntRunFwd)) opts.splice(n, 1);
    }
  if (!opts.length) return { k: "carry", p: 0.5, sc: 0, key: 0, ang: p._drbA ?? atk, alts: [] };
  opts.sort((x, y) => y.sc - x.sc);
  const best = opts[0];
  best.alts = opts.slice(0, 10);
  return best;
}

// HE HOLDS HIS PLAN. Re-asked every slice, a footballer does not abandon what he is set on for an option
// that is only a shade better on this slice's arithmetic: the new one must clear the one he holds by
// hystAbs or hystRel of it. The plan lasts the possession (mp.mind.epi) and goes when its option does.
export function mindChoose(s, side, i, dwell, noCarry, ft) {
  const mp = s.mePos, M = mp.mind, p = s.players[side][i];
  // (KEEP IT SIMPLE and GET IT IN used to take the carry away here after a few touches: the first is now a
  // limit on carrying into a man, in mindDecide's carry loop, and the second is the crossFirst plan.)
  const view = mindLens(s, side, i);
  const res = mindDecide(view, side, i, dwell, noCarry, ft);
  let pick = res;
  const plan = p._plan;
  if (plan && plan.epi === M.epi && plan.key !== res.key && res.alts?.length) {
    const kept = res.alts.find(o => o.key === plan.key);
    if (kept && kept.sc + Math.max(MT.hystAbs, MT.hystRel * Math.abs(kept.sc)) >= res.sc) pick = kept;
  }
  p._plan = { key: pick.key, epi: M.epi, t: mp.tick, k: pick.k };
  // The carry he chose is the line he runs it on.
  if (pick.k === "carry" && pick.ang != null) { p._drbWant = pick.ang; p._drbT = CFG.carryCommit; }
  return pick;
}

// FIRST TIME, through his own eyes. The same question as meFirstTime asks, on what he has seen.
export function mindFirstTime(s, side, i, z) {
  const mp = s.mePos, p = s.players[side][i];
  const act = mindChoose(s, side, i, 0, false, { bvx: mp.bvx, bvy: mp.bvy, bz: z });
  if (!act || (act.k !== "pass" && act.k !== "shot" && act.k !== "clear")) return null;
  const press = mePressure(s, side, p.x, p.y);
  if ((act.sc ?? 0) <= CFG.ftActNow * Math.max(0, 1 - press * CFG.pressActNow)) return null;
  act.ft = true;
  return act;
}

// THE FIRST TOUCH GOES WHERE THE NEXT ACTION IS. He takes it on the line he means to carry it, toward the
// pass he means to play, or out of his feet toward goal for the shot -- the touch sets up the plan.
export function mindTouchAngle(s, side, i) {
  const mp = s.mePos, p = s.players[side][i];
  const act = mindChoose(s, side, i, 0, false, { bvx: mp.bvx, bvy: mp.bvy, bz: mp.bz });
  const dir = meDir(side), atk = dir > 0 ? 0 : Math.PI;
  if (!act) return null;
  if (act.k === "carry") return act.ang ?? atk;
  if (act.k === "shot") return Math.atan2(ME_HALF_W - p.y, meGoalX(side) - p.x);
  const ax = act.k === "pass" ? act.ax : act.cx, ay = act.k === "pass" ? act.ay : act.cy;
  if (ax === undefined) return null;
  // Toward the pass, but never more than a quarter turn off facing play: the touch opens the angle, it
  // does not take him away from it.
  const want = Math.atan2(ay - p.y, ax - p.x);
  const off = Math.atan2(Math.sin(want - atk), Math.cos(want - atk));
  return atk + clamp(off, -1.6, 1.6) * 0.6;
}
