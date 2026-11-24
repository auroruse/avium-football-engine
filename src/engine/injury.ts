// INJURIES (steps four and five of the rework: DESIGN.md "The referee, the touchlines and injuries"; the user,
// 24 November 2026: "a rework to injuries, which are rudimentary right now at best").
//
// What it was: only a man fouled could be hurt, the diagnosis was drawn from the whole table whatever had happened to
// him, and he either ran it off or vanished from the pitch on the spot.
//
// WHAT HURTS A MAN. Four things, each with its own chance: a foul (the old one), a hard tackle that was fair, two men
// going up for the same ball, and a muscle that goes with nobody near him -- a sprint on tired legs, likelier for an
// older man, one just back from a lay-off, or one carrying something into the match. The diagnosis is drawn from the
// rows of the table that cause can produce (config.ts ME_INJURY `how`), so a trip is a knee or an ankle and a pull is
// a hamstring.
//
// HOW BAD. One of four: a KNOCK he runs off with play going on; FINE, treated and back; HURT, treated, back, and
// carrying it for the rest of the match (slower, first on the manager's list to come off, and it can go again); or
// OFF, he cannot continue. A head injury is always off.
//
// WHAT HAPPENS THEN. Anything past a knock stops play. The physio comes on from the technical area, kneels with him,
// and takes him to the nearest touchline (a stretcher for the bad ones), and the restart waits until he is off the
// field. A man treated is out of play while that happens and for a little after -- his side a man short -- then comes
// back on from where he left. A goalkeeper is treated where he lies and never leaves. The whole timetable is worked
// out here, once, as `mp.treats`, so a match nobody watches takes exactly as long as one somebody does; the figures
// are only drawn from it (touchline.ts).
import { CFG, ME_DT, ME_LEN, mePickInjury } from "./config";
import { ME_HALF_W, ME_SIDES, PITCH_L, PITCH_W } from "./geometry";

// THE CHANCES. foul: per foul given, more with pace (CFG.injP and injPace, scaled by foulK). tackle: per fair tackle
// won, more with pace. air: per ball two men went up for. pull: per slice a man is at a sprint (sprintV metres a
// second and over), and how much more for tired legs (pullTired at empty), each year past pullAge (pullOld), a man in
// his first match back (pullBack) and one carrying a knock in (pullDoubt).
// Set from the chances a match offers (test/hurtprobe.mjs: fifteen fouls given a free kick, five fair tackles at pace,
// eight aerial duels, twelve thousand slices of somebody sprinting) so the total stays where the old game had it on the
// cloud (run 45299932594: 0.72 men hurt a match, 0.134 of them lost), shared half to fouls, a quarter to pulls and the
// rest between tackles and the air. Measured on the cloud with the first setting (run 45303542261): 0.85 hurt a match
// and 0.181 lost, by cause 0.43 / 0.11 / 0.10 / 0.21; these are that, scaled to the old totals.
// THE LEVELS. off*: the share who cannot continue, by cause. Of the rest, `fine` and `hurt` are treated and the
// remainder run it off. again: per slice at a sprint, the chance a man playing on hurt breaks down.
// THE CARD. A foul that puts a man off is cardOff times as likely to be booked, one that needs the physio cardTreat.
// THE TIMETABLE, in slices at four a second. The physio covers physV metres a slice and is never longer than physMax
// getting there; he kneels kneel[level]; they leave at walkV (stretcherV carried), never longer than exitMax; a man
// treated waits back[level] off the field before he is waved on.
export const ME_HURT = {
  foulK: 0.58, tackleP: 0.0115, tacklePace: 0.25, airP: 0.0105, pullP: 0.0000077, sprintV: 6.2,
  pullTired: 2.0, pullAge: 29, pullOld: 0.07, pullBack: 1.6, pullDoubt: 1.4,
  offFoul: 0.145, offTackle: 0.15, offAir: 0.2, offPull: 0.24, fine: 0.3, hurt: 0.22,
  again: 0.0006, hurtSpd: 0.9,
  cardOff: 1.35, cardTreat: 1.15,
  physV: 1.75, physMax: 36, kneel: { fine: 10, hurt: 14, off: 16 }, walkV: 0.6, stretcherV: 0.8, exitMax: 40,
  back: { fine: 8, hurt: 44 },
};
const OFF_SHARE = { foul: "offFoul", tackle: "offTackle", air: "offAir", pull: "offPull" };
// WHAT A LESSER ONE IS CALLED (user, 24 November 2026: "Instead of 'plays on hurt' and 'treated,' just show what kind of
// injury it is"). A man who carries on, is treated, or plays on hurt has not been given a row of ME_INJURY, which is
// for the injuries that keep a man out; this names what he has, by what did it. Picked off the moment and the man, not
// the dice, so naming it changes nothing in the match.
export const ME_KNOCK = {
  c: ["Ankle Knock", "Dead Leg", "Knee Knock", "Shin Knock", "Bruised Foot", "Bruised Hip"],
  a: ["Head Knock", "Bruised Ribs", "Shoulder Knock", "Cut Head", "Back Knock", "Winded"],
  p: ["Hamstring Tightness", "Calf Tightness", "Groin Tightness", "Thigh Tightness"],
};
const hashS = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 100000) / 100000; };
const HOW = { foul: "c", tackle: "c", air: "a", pull: "p" };

const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const full = (p) => p.fullName || p.name;

// HOW BAD, for a man hurt by `cause`. Two dice for the level, and one more for what he did when he is off.
function hurtLevel(rng, p, cause) {
  const H = ME_HURT, u = rng.u(), v = rng.u();
  if (u < H[OFF_SHARE[cause]]) return { lvl: "off", ...mePickInjury(rng, HOW[cause]) };
  // Two men's heads: nobody plays on after that.
  if (cause === "air" && v < 0.18) { const pick = mePickInjury(rng, "a"); if (pick.part === "head") return { lvl: "off", ...pick }; }
  return { lvl: v < H.fine ? "fine" : v < H.fine + H.hurt ? "hurt" : "knock" };
}

// A FOUL: is the man fouled hurt, and how badly. Asked before the card is chosen, because the referee weighs it.
export function meHurtFoul(s, rng, p, closeV) {
  if (s.injuriesOn === false) return null;
  // (harness only: the next foul hurts its man this badly, so a treatment can be watched without waiting for one)
  if (globalThis.__hurtForce) { const f = globalThis.__hurtForce; globalThis.__hurtForce = null;
    if (f === "carry") { let H; do H = mePickInjury(rng, "c"); while (!H.sev.carry); return { lvl: "off", ...H }; }
    return f === "off" ? { lvl: "off", ...mePickInjury(rng, "c") } : { lvl: f }; }
  if (rng.u() >= CFG.injP * ME_HURT.foulK * ME_LEN * (1 + closeV * CFG.injPace)) return null;
  return hurtLevel(rng, p, "foul");
}

// The nearest way off the field for a man at (x, y): a touchline, or the goal line when he is deep and central, never
// through the goal itself.
function exitOf(x, y) {
  const opts = [[x, -0.9, y], [x, PITCH_W + 0.9, PITCH_W - y]];
  const gy = Math.abs(y - ME_HALF_W) < 6 ? ME_HALF_W + (y < ME_HALF_W ? -6 : 6) : y;
  opts.push([-0.9, gy, Math.hypot(x, y - gy)], [PITCH_L + 0.9, gy, Math.hypot(PITCH_L - x, y - gy)]);
  opts.sort((a, b) => a[2] - b[2]);
  return opts[0];
}

// WHAT IT DOES TO HIM AND TO THE MATCH. `H` is what hurtLevel returned; the ball must already be dead for anything past
// a knock (the caller sees to it), and the restart is made to wait for the treatment.
export function meHurtApply(s, out, side, p, H, cause) {
  const mp = s.mePos, K = ME_HURT;
  (out.injuries = out.injuries || { home: 0, away: 0 })[side]++;
  if (globalThis.__hurt) globalThis.__hurt.push({ cause, lvl: H.lvl, id: H.sev?.id || "", gk: p.pos === "GK" ? 1 : 0 });
  const u = hashS(`${full(p)}|${mp.tick}|${mp.vseed | 0}`);
  const dx = H.sev ? null : (ME_KNOCK[HOW[cause]] || ME_KNOCK.c)[Math.floor(u * (ME_KNOCK[HOW[cause]] || ME_KNOCK.c).length)];
  if (H.lvl === "knock") {
    p.knock = CFG.injKnockT;                 // he runs it off
    meEvtI(out, side, p, `${full(p)} is hurt but carries on`, { lvl: "knock", dx });
    return;
  }
  const gk = p.pos === "GK", lvl = H.lvl, x0 = p.x, y0 = p.y;
  // The timetable. The physio's run is from his own technical area.
  const bx = PITCH_L / 2 + (side === "home" ? -1 : 1) * CFG.subEnterX, by = PITCH_W + 0.7;
  const arr = clamp(Math.round(Math.hypot(x0 - bx, y0 - by) / K.physV), 5, K.physMax);
  const up = arr + K.kneel[lvl];
  const carry = lvl === "off" && !!H.sev?.carry;
  const [ex, ey, ed] = exitOf(x0, y0);
  const stays = gk && lvl !== "off";          // a keeper is treated where he lies
  const offT = stays ? up : up + clamp(Math.round(ed / (carry ? K.stretcherV : K.walkV)), 4, K.exitMax);
  const T = { p, side, kind: stays ? "gk" : lvl === "off" ? (carry ? "stretcher" : "walk") : lvl, lvl,
              x: x0, y: y0, ex, ey, t0: mp.tick, arr, up, offT, backT: lvl === "off" || stays ? 0 : mp.tick + offT + K.back[lvl] };
  (mp.treats = mp.treats || []).push(T);
  p._care = 1;                                // the app draws him from the timetable, not from its own walk-off
  // The restart waits for it: the keeper back on his feet, anybody else off the field.
  if (mp.sp) {
    mp.sp.quick = 0;
    mp.sp.minT = Math.max(mp.sp.minT ?? 0, mp.sp.t + offT);
    mp.sp.maxT = Math.max(mp.sp.maxT ?? CFG.spMaxTBy?.[mp.sp.kind] ?? CFG.spMaxT, mp.sp.t + offT + 30);
  }
  if (lvl === "off") {
    // He cannot continue. Flagged and parked where the engine keeps a man who is off; the bench replaces him at this
    // dead ball (meAutoSubs, meCoachSubs), so a side only finishes a man short if its changes are spent.
    p.rc = false; p.off = true; p.inj = true; p.injSev = H.sev.id; p.injPart = H.part; p.injHow = cause;
    // How many matches it keeps him out, settled now so the full-time screen can say it and the tournament records the
    // same number (App.tsx injDurOf). Off the moment, not the dice.
    p.injLen = H.sev.dur[0] + Math.floor(u * (H.sev.dur[1] - H.sev.dur[0] + 1));
    (out.injured = out.injured || { home: [], away: [] })[side].push(
      { name: p.name, full: full(p), min: out.min ?? 0, add: out.add || 0, part: H.part, sev: H.sev.id, how: cause });
    p._offX = x0; p._offY = y0;
    p.y = -6; p.vx = 0; p.vy = 0; p._offAt = mp.tick;
    meEvtI(out, side, p, `${full(p)} cannot continue, ${H.part} ${H.sev.label.toLowerCase()}`, { sev: H.sev.id, part: H.part, lvl: "off", how: cause });
    return;
  }
  (out.treated = out.treated || { home: 0, away: 0 })[side]++;
  // Carrying it for the rest of the match (meInjStep, meMove); what it is and when, for the full-time screen.
  if (lvl === "hurt") { p.hurt = 1; p.hurtDx = dx; p.hurtMin = out?.min ?? 0; p.hurtAdd = out?.add || 0; }
  if (stays) { if (lvl === "hurt") p.knock = 1e6; else p.knock = CFG.injKnockT >> 1; }
  else {
    // Off the field while he is seen to. Not `inj`: nobody replaces him, and he is coming back.
    p.off = true; p.treat = 1; p._tx0 = x0; p._ty0 = y0;
    p.y = -6; p.vx = 0; p.vy = 0;
  }
  meEvtI(out, side, p, lvl === "hurt" ? `${full(p)} is treated and plays on hurt` : `${full(p)} is treated and carries on`, { lvl, dx });
}
// (match.ts meEvt, without importing it back: an injury line for the feed and the viewer's effects.)
function meEvtI(out, side, p, txt, extra) {
  if (!out) return;
  out.evt = { k: "injury", side, x0: p.x, y0: p.y, x1: p.x, y1: p.y, age: 0 };
  if (out.fx) out.fx.push({ k: "injury", side, x0: p.x, y0: p.y, x1: p.x, y1: p.y, txt });
  if (out.feed) { out.feed.unshift({ min: out.min || 0, add: out.add || 0, side, k: "injury", txt, ...extra }); if (out.feed.length > 200) out.feed.pop(); }
}

// A MAN HIT IN OPEN PLAY, noted where it happened and settled at the head of the next slice (meInjStep): a fair tackle
// won at pace, or two men up for the same ball.
export function meHurtNote(s, hit) { const mp = s.mePos; if (s.injuriesOn === false || globalThis.__refOff) return; (mp._hits = mp._hits || []).push(hit); }

// ONE SLICE OF IT, at the head of the tick: the men coming back on, the hits of the last slice, the muscle that goes,
// and the man playing on hurt whose injury goes again. `stop(side)` stops play for treatment (match.ts: a dropped ball
// to the side that had it). Dice are spent only on what could happen this slice.
export function meInjStep(s, rng, out, stop) {
  const mp = s.mePos, K = ME_HURT;
  // BACK ON. Waved on from where he left, once his time is up and he is still wanted.
  if (mp.treats && mp.treats.length) {
    for (const T of mp.treats) {
      if (!T.backT || mp.tick < T.backT || T.done) continue;
      T.done = 1;
      const p = T.p;
      if (!p.treat || !s.players[T.side].includes(p)) continue;
      p.off = false; p.treat = 0; p._care = 0;
      p.x = clamp(T.ex, 0.6, PITCH_L - 0.6); p.y = clamp(T.ey, 0.6, PITCH_W - 0.6); p._px = p.x; p._py = p.y; p.vx = 0; p.vy = 0;
      p.knock = T.lvl === "hurt" ? 1e6 : CFG.injKnockT >> 1;
    }
    // (kept a while after for the drawing of the walk round to the bench, then dropped)
    if (mp.treats.some(T => mp.tick - T.t0 > T.offT + 400)) mp.treats = mp.treats.filter(T => mp.tick - T.t0 <= T.offT + 400);
  }
  if (s.injuriesOn === false || globalThis.__refOff) { mp._hits = null; return; }
  const live = !mp.sp;
  const hurtNow = (side, p, cause) => {
    const H = hurtLevel(rng, p, cause);
    if (H.lvl !== "knock" && !mp.sp) stop(side);
    meHurtApply(s, out, side, p, H, cause);
  };
  // THE HITS of the slice before.
  if (mp._hits && mp._hits.length) {
    const hits = mp._hits; mp._hits = null;
    for (const h of hits) {
      if (h.cause === "tackle") {
        if (globalThis.__hurtOpp) globalThis.__hurtOpp.tackle++;
        if (!h.p.off && rng.u() < K.tackleP * ME_LEN * (1 + (h.v || 0) * K.tacklePace)) hurtNow(h.side, h.p, "tackle");
      } else {
        if (globalThis.__hurtOpp) globalThis.__hurtOpp.air++;
        if (rng.u() < K.airP * ME_LEN) { const first = rng.u() < 0.5, p = first ? h.a : h.b, side = first ? h.sa : h.sb; if (!p.off) hurtNow(side, p, "air"); }
      }
    }
  }
  if (!live || mp.sp) return;
  // THE MUSCLE THAT GOES, and the injury that goes again. One die for the lot: each man at a sprint adds his own
  // chance to the pot, and if it comes up the pot is shared out by those chances.
  let pot = 0, n = 0; const who = [];
  for (const side of ME_SIDES) for (const p of s.players[side]) {
    if (!p || p.off || p.pos === "GK") continue;
    const v = Math.hypot(p.x - (p._px ?? p.x), p.y - (p._py ?? p.y)) / ME_DT;
    if (v < K.sprintV || v > 14) continue;
    n++;
    const tired = 1 + clamp((100 - (p.stamina ?? 100)) / 100, 0, 1) * K.pullTired;
    const old = p.age > K.pullAge ? 1 + (p.age - K.pullAge) * K.pullOld : 1;
    let h = K.pullP * ME_LEN * tired * old * (p.back ? K.pullBack : 1) * (p.doubt ? K.pullDoubt : 1);
    if (p.hurt) h += K.again * ME_LEN;
    pot += h; who.push([p, side, h]);
  }
  if (globalThis.__hurtOpp) globalThis.__hurtOpp.sprint += n;
  if (!n) return;
  let r = rng.u();
  if (r >= pot) return;
  for (const [p, side, h] of who) { r -= h; if (r < 0) {
    // A man already carrying it: this time he is off, with whatever it was.
    if (p.hurt) { const H = { lvl: "off", ...mePickInjury(rng, "p") }; stop(side); meHurtApply(s, out, side, p, H, "pull"); }
    else hurtNow(side, p, "pull");
    return; } }
}
