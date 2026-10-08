// ROLES. Real tactics are written in roles -- an inverted full-back, a target man, a deep-lying
// playmaker -- and the first brain had none: a man's job was his formation slot plus a handful of
// thresholds, so every full-back in the league played the same game whatever his side was built for.
//
// A role says where a man plays with the ball in each phase (his LANE and his LINE), which runs he makes
// and how often, whether he is one of the men who stay behind the ball, how readily he presses first,
// and how he plays when it is at his feet. Roles are worked out from the slot, the formation, the style
// and the rating, so nothing in the sheets has to change.
//
// Lines, front to back: attack (on the last defender's shoulder), between (between their lines), high
// (ahead of the ball, short of their midfield), support (level with the ball, off to the side -- the short
// angle), hold (between support and the rest defence), base (the rest defence), deep (build-up from the
// back: split centre-halves, a pivot dropping between them). Lanes: wide, half (half-space), center, slot (where his formation has
// him), split (wider than the half-space, for a centre-half splitting in build-up).
import { ME_HALF_W } from "../geometry";
import { meBadgeFx } from "../attributes";

// ln and lane are [build-up, progression, final third]. run weights are 0..1 propensities.
const R = (lane, ln, o = {}) => ({ lane, ln, run: o.run || {}, rest: o.rest ?? 0, press: o.press ?? 0.4,
  risk: o.risk ?? 0, carry: o.carry ?? 0, lnOff: o.lnOff || [0, 0, 0], hold: o.hold ?? 0 });
export const ROLES = {
  gk:          R(["center", "center", "center"], ["deep", "deep", "deep"], { rest: 1, press: 0 }),
  cb:          R(["slot", "slot", "slot"], ["deep", "base", "base"], { rest: 1, press: 0.15 }),
  cb_ball:     R(["split", "half", "half"], ["deep", "base", "base"], { rest: 1, press: 0.15, carry: 0.35, risk: 0.2 }),
  cb_stop:     R(["slot", "slot", "slot"], ["deep", "base", "base"], { rest: 1, press: 0.35 }),
  cb_cover:    R(["slot", "slot", "slot"], ["deep", "base", "base"], { rest: 1, press: 0.05, lnOff: [0, -2, -3] }),
  cb_lib:      R(["center", "center", "center"], ["deep", "base", "base"], { rest: 1, press: 0, lnOff: [-2, -5, -6] }),
  cbw:         R(["split", "half", "half"], ["deep", "base", "base"], { rest: 0.9, press: 0.25, carry: 0.3, lnOff: [0, 2, 4] }),
  fb:          R(["wide", "wide", "wide"], ["support", "support", "high"], { run: { overlap: 0.45, underlap: 0.15 }, rest: 0.25, press: 0.3 }),
  fb_over:     R(["wide", "wide", "wide"], ["support", "high", "between"], { run: { overlap: 0.9, underlap: 0.2, box: 0.1 }, rest: 0.05, press: 0.35, carry: 0.2 }),
  fb_inv:      R(["wide", "half", "half"], ["support", "support", "support"], { run: { underlap: 0.15 }, rest: 0.55, press: 0.3, risk: 0.1 }),
  fb_hold:     R(["wide", "wide", "wide"], ["support", "hold", "hold"], { run: { overlap: 0.15 }, rest: 0.85, press: 0.25 }),
  wb:          R(["wide", "wide", "wide"], ["support", "between", "attack"], { run: { overlap: 0.6, box: 0.3 }, rest: 0.05, press: 0.35, carry: 0.25, lnOff: [0, 0, -3] }),
  wb_def:      R(["wide", "wide", "wide"], ["support", "hold", "support"], { run: { overlap: 0.25 }, rest: 0.6, press: 0.3 }),
  dm_anchor:   R(["center", "center", "center"], ["support", "hold", "hold"], { rest: 0.95, press: 0.4 }),
  dm_dlp:      R(["center", "center", "center"], ["deep", "support", "hold"], { rest: 0.75, press: 0.35, risk: 0.35, lnOff: [3, 0, 0] }),
  dm_win:      R(["center", "center", "center"], ["support", "support", "hold"], { rest: 0.6, press: 0.85 }),
  dm_box:      R(["slot", "slot", "slot"], ["support", "support", "high"], { run: { box: 0.4, third: 0.3 }, rest: 0.4, press: 0.55 }),
  cm:          R(["slot", "slot", "slot"], ["high", "high", "between"], { run: { box: 0.4, third: 0.3, behind: 0.1 }, rest: 0.2, press: 0.5 }),
  cm_mez:      R(["half", "half", "half"], ["high", "between", "between"], { run: { behind: 0.4, box: 0.5, third: 0.6 }, rest: 0.05, press: 0.5, carry: 0.3 }),
  cm_play:     R(["half", "half", "half"], ["high", "high", "high"], { run: { third: 0.3, box: 0.2 }, rest: 0.3, press: 0.4, risk: 0.4 }),
  cm_b2b:      R(["slot", "slot", "slot"], ["high", "high", "between"], { run: { box: 0.7, third: 0.5, behind: 0.2 }, rest: 0.15, press: 0.65 }),
  cm_hold:     R(["slot", "slot", "slot"], ["support", "hold", "support"], { run: { box: 0.15 }, rest: 0.6, press: 0.45 }),
  am:          R(["center", "center", "center"], ["high", "between", "between"], { run: { box: 0.5, third: 0.4, behind: 0.2 }, press: 0.55 }),
  am_play:     R(["center", "center", "center"], ["high", "between", "between"], { run: { third: 0.3, box: 0.3 }, press: 0.45, risk: 0.45, carry: 0.2 }),
  am_shadow:   R(["center", "center", "center"], ["high", "between", "attack"], { run: { behind: 0.7, box: 0.85 }, press: 0.6, lnOff: [0, 0, -2] }),
  w:           R(["wide", "wide", "wide"], ["high", "between", "attack"], { run: { behind: 0.45, box: 0.45 }, press: 0.55, carry: 0.35 }),
  w_wide:      R(["wide", "wide", "wide"], ["between", "attack", "attack"], { run: { behind: 0.3, box: 0.35 }, press: 0.5, carry: 0.55 }),
  w_inside:    R(["wide", "wide", "half"], ["between", "attack", "attack"], { run: { behind: 0.85, box: 0.6 }, press: 0.6, carry: 0.5 }),
  wm:          R(["wide", "wide", "wide"], ["support", "high", "between"], { run: { behind: 0.3, overlap: 0.2, box: 0.3 }, press: 0.45, rest: 0.1, carry: 0.3 }),
  w_def:       R(["wide", "wide", "wide"], ["support", "high", "high"], { run: { behind: 0.25, box: 0.2 }, press: 0.4, rest: 0.3 }),
  st:          R(["center", "center", "center"], ["attack", "attack", "attack"], { run: { behind: 0.5, drop: 0.35, box: 0.85 }, press: 0.75 }),
  st_false9:   R(["center", "center", "center"], ["between", "between", "between"], { run: { drop: 0.85, behind: 0.2, box: 0.45 }, press: 0.65, risk: 0.3, carry: 0.3 }),
  st_complete: R(["center", "center", "center"], ["attack", "attack", "attack"], { run: { drop: 0.5, behind: 0.45, box: 0.85 }, press: 0.7, carry: 0.25 }),
  st_target:   R(["center", "center", "center"], ["attack", "attack", "attack"], { run: { drop: 0.3, behind: 0.1, box: 0.95 }, press: 0.55, hold: 1 }),
  st_poach:    R(["slot", "slot", "slot"], ["attack", "attack", "attack"], { run: { behind: 0.9, box: 1.0 }, press: 0.6 }),
  st_press:    R(["center", "center", "center"], ["attack", "attack", "attack"], { run: { behind: 0.6, drop: 0.25, box: 0.85 }, press: 1.0 }),
};

// WHAT THE TEAM SHEET CALLS EACH ROLE, and the letters it shows beside the man.
export const ROLE_NAME = {
  gk: ["Goalkeeper", "GK"],
  cb: ["Centre-Back", "CB"], cb_ball: ["Ball-Playing Defender", "BPD"], cb_stop: ["Stopper", "STP"],
  cb_cover: ["Cover Defender", "COV"], cb_lib: ["Libero", "LIB"], cbw: ["Wide Centre-Back", "WCB"],
  fb: ["Full-Back", "FB"], fb_over: ["Overlapping Full-Back", "OFB"], fb_inv: ["Inverted Full-Back", "IFB"],
  fb_hold: ["Holding Full-Back", "HFB"], wb: ["Wing-Back", "WB"], wb_def: ["Defensive Wing-Back", "DWB"],
  dm_anchor: ["Anchor", "ANC"], dm_dlp: ["Deep-Lying Playmaker", "DLP"], dm_win: ["Ball-Winning Midfielder", "BWM"],
  dm_box: ["Segundo Volante", "SV"],
  cm: ["Central Midfielder", "CM"], cm_mez: ["Mezzala", "MEZ"], cm_play: ["Playmaker", "PM"],
  cm_b2b: ["Box-to-Box Midfielder", "B2B"], cm_hold: ["Holding Midfielder", "HM"],
  am: ["Attacking Midfielder", "AM"], am_play: ["Advanced Playmaker", "AP"], am_shadow: ["Shadow Striker", "SS"],
  w: ["Winger", "W"], w_wide: ["Touchline Winger", "TW"], w_inside: ["Inside Forward", "IF"],
  wm: ["Wide Midfielder", "WM"], w_def: ["Defensive Winger", "DW"],
  st: ["Striker", "ST"], st_false9: ["False Nine", "F9"], st_complete: ["Complete Forward", "CF"],
  st_target: ["Target Man", "TM"], st_poach: ["Poacher", "P"], st_press: ["Pressing Forward", "PF"],
};

// THE STYLE FAMILY. Fourteen styles, but roles divide them into fewer ways of playing.
export const FAM = {
  tikitaka: "pos", possession: "pos", verticaltiki: "vert", lanuestra: "flair", zonamista: "zona",
  gegenpress: "press", secondball: "direct", routeone: "direct", wingplay: "wide",
  counterattack: "counter", cholismo: "block", catenaccio: "catenaccio", parkthebus: "bus", balanced: "bal",
};

// HOW THE FAMILY PLAYS AS A TEAM. restN: outfielders kept behind the ball in the final third; counter:
// whether winning it means going forward at once; libero: a sweeper behind the line; manMark: the block
// marks men rather than space.
export const FAMPLAN = {
  pos:        { restN: 3, libero: false, manMark: 0.0 },
  vert:       { restN: 3, libero: false, manMark: 0.0 },
  flair:      { restN: 3, libero: false, manMark: 0.0 },
  zona:       { restN: 4, libero: true,  manMark: 0.55 },
  press:      { restN: 3, libero: false, manMark: 0.15 },
  direct:     { restN: 4, libero: false, manMark: 0.1 },
  wide:       { restN: 3, libero: false, manMark: 0.0 },
  counter:    { restN: 4, libero: false, manMark: 0.1 },
  block:      { restN: 5, libero: false, manMark: 0.2 },
  catenaccio: { restN: 5, libero: true,  manMark: 0.8 },
  bus:        { restN: 6, libero: false, manMark: 0.35 },
  bal:        { restN: 4, libero: false, manMark: 0.1 },
};

const lat = (p) => (p._bw0 ?? ME_HALF_W) < ME_HALF_W - 6 ? "L" : (p._bw0 ?? ME_HALF_W) > ME_HALF_W + 6 ? "R" : "C";
const sposOf = (p) => (p.spos || "").split("/")[0] || ({ GK: "GK", DEF: "CB", MID: "CM", FWD: "ST" })[p.pos] || "CM";

// THE ROLE FOR EVERY MAN ON THE PITCH. Run at kickoff and whenever who is out there changes.
export function mindRoles(s, side) {
  const ps = s.players[side], pl = s.plan?.[side], fam = pl ? pl.fam : FAM[s.styles?.[side]] || "bal";
  const live = ps.filter(p => p && !p.off);
  const by = (k) => live.filter(p => sposOf(p) === k);
  const cbs = by("CB"), dms = by("DM"), sts = by("ST");
  const backThree = cbs.length >= 3;
  // The better of two men sharing a job gets the creative half of it.
  const better = (a, b) => (a.ovr0 ?? a.ovr ?? 70) >= (b.ovr0 ?? b.ovr ?? 70);
  const cmsC = by("CM").filter(p => lat(p) === "C");
  const pivotCM = !dms.length && cmsC.length ? cmsC[0] : null;
  const pick = {};
  for (const p of live) {
    const sp = sposOf(p), L = lat(p);
    let r = "cm";
    if (p.pos === "GK") r = "gk";
    else if (sp === "CB") {
      if (backThree) {
        const mid = L === "C" || (cbs.length >= 3 && Math.abs((p._bw0 ?? ME_HALF_W) - ME_HALF_W) < 6);
        r = mid ? ((pl ? pl.libero : FAMPLAN[fam].libero) ? "cb_lib" : "cb_cover") : (fam === "bus" || fam === "catenaccio" ? "cb_stop" : "cbw");
      } else {
        const first = cbs[0] === p;
        r = fam === "pos" || fam === "vert" || fam === "flair" ? "cb_ball"
          : fam === "zona" || fam === "catenaccio" ? (first ? "cb_stop" : "cb_lib")
          : fam === "press" || fam === "counter" || fam === "block" || fam === "direct" ? (first ? "cb_stop" : "cb_cover")
          : "cb";
      }
    } else if (sp === "LB" || sp === "RB") {
      r = fam === "pos" ? "fb_inv"
        : fam === "vert" || fam === "flair" ? (sp === "LB" ? "fb_inv" : "fb_over")
        : fam === "press" || fam === "wide" ? "fb_over"
        : fam === "counter" || fam === "block" || fam === "bus" || fam === "catenaccio" || fam === "zona" ? "fb_hold"
        : "fb";
    } else if (sp === "LWB" || sp === "RWB") r = fam === "bus" || fam === "catenaccio" ? "wb_def" : "wb";
    else if (sp === "LM" || sp === "RM") {
      r = backThree ? (fam === "bus" || fam === "catenaccio" ? "wb_def" : "wb")
        : fam === "wide" ? "w_wide" : fam === "pos" || fam === "vert" || fam === "flair" || fam === "press" ? "w_inside"
        : fam === "bus" || fam === "catenaccio" ? "w_def" : "wm";
    } else if (sp === "DM") {
      const lead = dms.length < 2 || better(p, dms.find(q => q !== p));
      if (lead) r = fam === "pos" || fam === "vert" || fam === "flair" || fam === "zona" ? "dm_dlp"
                  : fam === "press" ? "dm_win" : "dm_anchor";
      else r = fam === "bus" || fam === "catenaccio" || fam === "block" ? "dm_anchor" : "dm_box";
    } else if (sp === "CM") {
      if (p === pivotCM) r = fam === "pos" || fam === "vert" || fam === "flair" || fam === "zona" ? "dm_dlp"
                           : fam === "press" ? "dm_win" : "dm_anchor";
      else r = fam === "pos" ? (L === "C" ? "cm_play" : "cm_mez")
             : fam === "vert" || fam === "flair" ? (L === "L" ? "cm_mez" : "cm_play")
             : fam === "press" || fam === "wide" || fam === "direct" ? "cm_b2b"
             : fam === "bus" || fam === "catenaccio" ? "cm_hold"
             : fam === "counter" || fam === "block" || fam === "zona" ? "cm_b2b" : "cm";
    } else if (sp === "AM") {
      if (L !== "C") r = fam === "wide" ? "w_wide" : fam === "bus" || fam === "catenaccio" ? "w_def" : "w_inside";
      else r = fam === "pos" || fam === "flair" || fam === "zona" ? "am_play"
             : fam === "press" || fam === "counter" || fam === "direct" || fam === "vert" ? "am_shadow" : "am";
    } else if (sp === "LW" || sp === "RW") {
      r = fam === "pos" || fam === "wide" ? "w_wide"
        : fam === "bus" || fam === "catenaccio" ? "w_def"
        : fam === "bal" ? "w" : "w_inside";
    } else if (sp === "ST") {
      if (sts.length < 2) r = fam === "pos" || fam === "flair" ? "st_false9" : fam === "vert" ? "st_complete"
                            : fam === "press" ? "st_press" : fam === "wide" || fam === "direct" || fam === "bus" || fam === "catenaccio" || fam === "block" ? "st_target"
                            : fam === "counter" ? "st_poach" : "st";
      else {
        const lead = better(p, sts.find(q => q !== p));
        r = lead ? (fam === "wide" || fam === "direct" || fam === "bus" || fam === "catenaccio" || fam === "block" ? "st_target"
                   : fam === "press" ? "st_press" : "st_complete")
                 : (fam === "pos" || fam === "flair" ? "am_shadow" : "st_poach");
      }
    }
    pick[ps.indexOf(p)] = r;
  }
  // A ROLE THE MANAGER CHOSE (plan.roles, by slot) stands; the substitute who takes the slot plays it too.
  const chosen = pl?.roles;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i]; if (!p) continue;
    const c = chosen?.[i];
    const r = c && ROLES[c] && (c === "gk") === (p.pos === "GK") ? c : pick[i] || (p.pos === "GK" ? "gk" : "cm");
    p._mr = r; p._role2 = traitRole(ROLES[r], p);
  }
}

// A MAN'S OWN HABITS ON TOP OF HIS ROLE (his badges, ME_BADGES run / press). A player without them shares the role's
// table; one with them gets his own copy, made once for this role and these badges. His runs come only as far as his
// role lets him leave the back line (rest): a centre-half with a runner's legs still holds his post.
function traitRole(R, p) {
  const fx = meBadgeFx(p);
  if (!fx.run && !fx.press) return R;
  if (p._trR === R && p._trB === p.badges) return p._trRole;
  const run = { ...R.run };
  for (const [k, v] of Object.entries(fx.run || {})) run[k] = Math.min(1, (run[k] || 0) + v * (1 - (R.rest ?? 0)));
  const out = { ...R, run, press: Math.min(1, R.press + (fx.press ?? 0)) };
  p._trR = R; p._trB = p.badges; p._trRole = out;
  return out;
}
