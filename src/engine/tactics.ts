// TACTICS. What a manager chooses -- a style, and inside it a choice for every phase of play and a setting
// for every lever -- and how that becomes the two things the brain reads: the side's instruction sheet
// (s.strategy) and its plan (plan.ts). A style is a starting point and a leash: the choices it makes, and the
// ones a manager may move to without it becoming a different style.
//
// Every choice here works the way an instruction has to in this engine (see the note on COHERENCE in
// config.ts): it constrains what a man considers, opens a phase, or moves where men stand. None of them
// prices an option up or down.
import { mePlanLegacy } from "./plan";
import { ME_CHASE } from "./config";

// Every instruction the brain reads, in the order the sheet carries them.
export const ME_STRAT_KEYS = ["tempo", "width", "passingDir", "chanceCreation", "pressingLOE", "defLine", "possWon",
  "approachPlay", "dribbling", "creativity", "timeWasting", "possLost", "gkDist", "dlBehavior", "tackling"];

// ---- THE PHASES ------------------------------------------------------------------------------------
// st: instruction values the choice sets; plan: plan fields; zones: [from, to, worth] legs of the pass
// pattern (meZone's nine zones: 0-2 own third L/C/R, 3-5 middle, 6-8 final), merged by the strongest.
export const PHASES = {
  // With the ball in our own third.
  build: {
    short: { st: { gkDist: -1, approachPlay: -1 } },
    mixed: {},
    long:  { st: { gkDist: 1, approachPlay: 1 }, plan: { secondBall: true, clearLines: true, longBuild: true }, zones: [[1, 7, 0.9], [0, 6, 0.5], [2, 8, 0.5]] },
  },
  // Through the middle third.
  progress: {
    patient: { st: { passingDir: -1 }, plan: { minOk: 0.82, minCarry: 0.8, pats: { switch: 0.8 } },
               zones: [[3, 5, 0.6], [5, 3, 0.6], [3, 4, 0.5], [5, 4, 0.5], [4, 7, 0.7]] },
    central: { st: { width: -1 }, plan: { pats: { thirdman: 1 } }, zones: [[4, 7, 1.0], [3, 7, 0.8], [5, 7, 0.8], [1, 4, 0.5]] },
    flanks:  { st: { width: 1 }, plan: { pats: { overlap: 1, switch: 1 } },
               zones: [[4, 6, 0.8], [4, 8, 0.8], [3, 6, 0.5], [5, 8, 0.5]] },
    direct:  { st: { passingDir: 1 }, plan: { pats: { overtop: 1 }, fwdOnly: true }, zones: [[1, 7, 1.0], [4, 7, 0.8], [0, 6, 0.6], [2, 8, 0.6]] },
  },
  // Into the box.
  final: {
    cross:   { st: { width: 1 }, plan: { crossFirst: true } },
    cutback: { zones: [[6, 7, 1.0], [8, 7, 1.0]] },
    through: { plan: { pats: { thirdman: 0.8, overtop: 0.6 }, thruFirst: true }, zones: [[4, 7, 1.0], [3, 7, 0.6], [5, 7, 0.6]] },
    workin:  { st: { chanceCreation: -1 } },
    dribble: { st: { dribbling: 1 }, plan: { takeOn: true } },
    shoot:   { st: { chanceCreation: 1 } },
  },
  // Without the ball: where the side engages.
  block: {
    high: { st: { pressingLOE: 2, defLine: 2 } },
    mid:  {},
    low:  { st: { pressingLOE: -1, defLine: -1 }, plan: { compact: 0.5 } },
    deep: { st: { pressingLOE: -2, defLine: -2 }, plan: { restN: 1, compact: 1 } },
  },
  // ...and how it marks.
  marking: {
    zonal: { plan: { manMark: 0 } },
    mixed: { plan: { manMark: 0.35 } },
    man:   { plan: { manMark: 0.8, libero: true } },
    // Zona mista: the block marks space with a sweeper behind it, but its stoppers take the forwards man for man.
    zona:  { plan: { manMark: 0.55, libero: true } },
  },
  // The moment it is won, and the moment it is lost.
  onWin:  { counter: { st: { possWon: 1 }, plan: { earlyBall: true } }, keep: { st: { possWon: -1 } } },
  onLoss: { cpress: { st: { possLost: 1 } }, regroup: { st: { possLost: -1 } } },
};

// ---- THE LEVERS ------------------------------------------------------------------------------------
// How much of something, on top of the phase choices: each is an instruction key, or a plan field, and its
// legal range.
// Not on offer, measured as pure costs on brain 2 (6 Oct 2026, 240 matches a setting against three Balanced runs):
// a quicker tempo, -0.20 xG a match whatever its stamina price (0, 0.15, 0.30 all the same), and keeping it simple,
// -0.42 even once it only stopped men running into a man. Both take away carries and take-ons, which is where this
// engine's chances come from. They come back when they buy something.
export const LEVERS = {
  tempo:   { st: "tempo", r: [-2, 0] },
  width:   { st: "width", r: [-2, 2] },
  length:  { st: "passingDir", r: [-2, 2] },
  line:    { st: "defLine", r: [-2, 2] },
  press:   { st: "pressingLOE", r: [-2, 2] },
  tackle:  { st: "tackling", r: [-1, 1] },
  dribble: { st: "dribbling", r: [0, 1] },
  risk:    { st: "creativity", r: [-1, 1] },
  waste:   { st: "timeWasting", r: [0, 2] },
  back:    { plan: "restN", r: [-1, 2] },
  outlets: { plan: "outlet", r: [0, 2] },
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// THE SHEET AND THE PLAN for a set of choices. `fam` is the role family (mind/roles.ts) the style's men are
// dealt their roles from until a manager picks them by name.
export function meResolve(t) {
  const st = Object.fromEntries(ME_STRAT_KEYS.map(k => [k, 0]));
  const plan = { ...mePlanLegacy("balanced"), style: t.id || "balanced", fam: t.fam || "bal", pats: { thirdman: 0, overlap: 0, switch: 0, overtop: 0 } };
  const legs = new Map();
  for (const [phase, choice] of Object.entries(t.phases || {})) {
    const fx = PHASES[phase]?.[choice];
    if (!fx) continue;
    for (const [k, v] of Object.entries(fx.st || {})) st[k] = clamp((st[k] || 0) + v, -2, 2);
    for (const [k, v] of Object.entries(fx.plan || {})) {
      if (k === "pats") for (const [m, w] of Object.entries(v)) plan.pats[m] = Math.max(plan.pats[m] || 0, w);
      else if (k === "restN") plan.restN += v;
      else plan[k] = v;
    }
    for (const [a, b, w] of fx.zones || []) legs.set(a * 9 + b, Math.max(legs.get(a * 9 + b) || 0, w));
  }
  for (const [name, v] of Object.entries(t.levers || {})) {
    const L = LEVERS[name];
    if (!L) continue;
    if (L.st) st[L.st] = clamp((st[L.st] || 0) + v, L.r[0], L.r[1]);
    else if (L.plan === "restN") plan.restN = clamp(plan.restN + v, 2, 7);
    else plan[L.plan] = clamp(v, L.r[0], L.r[1]);
  }
  plan.zones = legs.size ? legs : null;
  return { strategy: st, plan };
}

// ---- CANDIDATE STYLES ------------------------------------------------------------------------------
// Measured before any of them is offered (test/lab.mjs): a style is kept only if it plays clearly unlike
// every other one. `fam` deals the roles until managers pick them by name.
export const ME_STYLE_CANDIDATES = {
  positional: { fam: "pos", phases: { build: "short", progress: "patient", final: "cutback", block: "high", marking: "zonal", onWin: "keep", onLoss: "cpress" },
                levers: { length: -1, back: 1 } },
  control:    { fam: "pos", phases: { build: "short", progress: "patient", final: "workin", block: "mid", marking: "zonal", onWin: "keep", onLoss: "cpress" },
                levers: { tempo: -1 } },
  vertical:   { fam: "vert", phases: { build: "mixed", progress: "central", final: "through", block: "mid", marking: "zonal", onWin: "counter", onLoss: "cpress" },
                levers: {} },
  gegenpress: { fam: "press", phases: { build: "mixed", progress: "direct", final: "through", block: "high", marking: "mixed", onWin: "counter", onLoss: "cpress" },
                levers: { tackle: 1, line: -1 } },
  flair:      { fam: "flair", phases: { build: "short", progress: "central", final: "dribble", block: "mid", marking: "zonal", onWin: "counter", onLoss: "regroup" },
                levers: { risk: 1, length: -1 } },
  wing:       { fam: "wide", phases: { build: "mixed", progress: "flanks", final: "cross", block: "mid", marking: "zonal", onWin: "counter", onLoss: "cpress" },
                levers: { width: 1 } },
  routeone:   { fam: "direct", phases: { build: "long", progress: "direct", final: "cross", block: "mid", marking: "mixed", onWin: "counter", onLoss: "regroup" },
                levers: { length: 1 } },
  secondball: { fam: "direct", phases: { build: "long", progress: "direct", final: "shoot", block: "high", marking: "mixed", onWin: "counter", onLoss: "regroup" },
                levers: { tackle: 1 } },
  counter:    { fam: "counter", phases: { build: "long", progress: "direct", final: "through", block: "low", marking: "mixed", onWin: "counter", onLoss: "regroup" },
                levers: { outlets: 2 } },
  cholismo:   { fam: "block", phases: { build: "mixed", progress: "direct", final: "cross", block: "low", marking: "mixed", onWin: "counter", onLoss: "regroup" },
                levers: { tackle: 1, width: -1 } },
  zonamista:  { fam: "zona", phases: { build: "short", progress: "central", final: "through", block: "low", marking: "zona", onWin: "counter", onLoss: "regroup" },
                levers: {} },
  catenaccio: { fam: "catenaccio", phases: { build: "long", progress: "direct", final: "through", block: "low", marking: "man", onWin: "counter", onLoss: "regroup" },
                levers: { outlets: 1 } },
  bus:        { fam: "bus", phases: { build: "long", progress: "direct", final: "workin", block: "deep", marking: "mixed", onWin: "counter", onLoss: "regroup" },
                levers: { back: 1, waste: 2 } },
  balanced:   { fam: "bal", phases: {}, levers: {} },
};

// THE STYLE EACH SHEET NAME PLAYS. The registry, the app and the tests key a style by these ids, and each now
// plays its rebuilt definition above (6 Oct 2026). Two changed meaning with their names: "tikitaka" is shown as
// Juego de Posicion and plays the positional style, "possession" is shown as Tiki-Taka and plays the patient one.
// Counter-Attack plays from a low block with two forwards left up (7 Oct 2026): from a mid block it won the ball
// no deeper than Balanced and was among the five strongest styles.
export const ME_STYLE_DEF = {
  tikitaka: "positional", possession: "control", verticaltiki: "vertical", gegenpress: "gegenpress",
  lanuestra: "flair", wingplay: "wing", routeone: "routeone", secondball: "secondball",
  counterattack: "counter", cholismo: "cholismo", zonamista: "zonamista", catenaccio: "catenaccio",
  parkthebus: "bus", balanced: "balanced",
};
export const meStyleDef = (style) => {
  const id = ME_STYLE_DEF[style] || style, d = ME_STYLE_CANDIDATES[id];
  return d ? { id, ...d } : null;
};
// Every instruction the style sets, the line, the keeper and the time-wasting included: the manager's sheet.
export const meStrategyOf = (style) => meResolve(meStyleDef(style) || { id: "balanced" }).strategy;
// ...and its plan, with the chase profile the style has always had.
export function mePlanOf(style) {
  const d = meStyleDef(style || "balanced");
  if (!d) return mePlanLegacy(style);
  const p = meResolve(d).plan;
  p.style = style || "balanced";
  p.chase = ME_CHASE[style] || ME_CHASE.balanced;
  return p;
}

// What the app calls each style, for the managers' log lines the engine writes (App.tsx STYLE_LBL is the same).
export const ME_STYLE_NAME = {
  tikitaka: "Juego de Posición", possession: "Tiki-Taka", verticaltiki: "Vertical Tiki-Taka", gegenpress: "Gegenpressing",
  lanuestra: "La Nuestra", wingplay: "Wing Play", routeone: "Route One", secondball: "Kick and Rush",
  counterattack: "Counter-Attack", cholismo: "Cholismo", zonamista: "Zona Mista", catenaccio: "Catenaccio",
  parkthebus: "Park the Bus", balanced: "Balanced",
};
