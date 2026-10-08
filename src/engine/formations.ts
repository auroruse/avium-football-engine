// FORMATIONS. The shapes a side can set up in: what each slot is called, how attacking it is, where it
// stands, the shape it drops into without the ball, and which shapes are next to which. Engine data,
// because the manager changes shape in the middle of a match; the sim core and the app read it from here.
import { meHungarian } from "./assignment";

export const FORMATIONS=["4-2-4","3-4-3","4-1-2-1-2","4-2-2-2","4-3-3","4-4-2","4-2-3-1","4-4-1-1","4-3-1-2","3-5-2","3-4-1-2","3-4-2-1","4-1-4-1","4-3-2-1","5-3-2","5-4-1"];

export const FORM_SPOS = {
  "4-2-4":     ["GK","LB","CB","CB","RB","CM","CM","LW","ST","ST","RW"],
  "4-4-2":     ["GK","LB","CB","CB","RB","LM","CM","CM","RM","ST","ST"],
  "4-3-3":     ["GK","LB","CB","CB","RB","CM","CM","CM","LW","ST","RW"],
  "4-2-3-1":   ["GK","LB","CB","CB","RB","DM","DM","AM","AM","AM","ST"],
  "4-1-4-1":   ["GK","LB","CB","CB","RB","DM","LW","CM","CM","RW","ST"],
  "4-1-2-1-2": ["GK","LB","CB","CB","RB","DM","CM","CM","AM","ST","ST"],
  "4-3-2-1":   ["GK","LB","CB","CB","RB","CM","CM","CM","AM","AM","ST"],
  "3-4-3":     ["GK","CB","CB","CB","LM","CM","CM","RM","LW","ST","RW"],
  "3-5-2":     ["GK","CB","CB","CB","LWB","CM","CM","CM","RWB","ST","ST"],
  "3-4-1-2":   ["GK","CB","CB","CB","LWB","CM","CM","RWB","AM","ST","ST"],
  "5-3-2":     ["GK","LWB","CB","CB","CB","RWB","CM","CM","CM","ST","ST"],
  "4-4-1-1":   ["GK","LB","CB","CB","RB","LM","CM","CM","RM","AM","ST"],
  "4-2-2-2":   ["GK","LB","CB","CB","RB","DM","DM","AM","AM","ST","ST"],
  "4-3-1-2":   ["GK","LB","CB","CB","RB","CM","CM","CM","AM","ST","ST"],
  "3-4-2-1":   ["GK","CB","CB","CB","LWB","CM","CM","RWB","AM","AM","ST"],
  "5-4-1":     ["GK","LWB","CB","CB","CB","RWB","LM","CM","CM","RM","ST"],
};

export function sposFor(fm) {
  if (FORM_SPOS[fm]) return FORM_SPOS[fm];
  const d2=fm.split("-").map(Number); const s=["GK"]; const nd=d2[0]; if(nd<=3)for(let i=0;i<nd;i++)s.push("CB"); else{for(let i=0;i<nd;i++)s.push(i===0?"LB":i===nd-1?"RB":"CB");} for(let d=1;d<d2.length-1;d++){const isDeep=d===1&&d2.length>3;for(let i=0;i<d2[d];i++)s.push(isDeep?"DM":"CM");} const nf=d2[d2.length-1];if(nf===1)s.push("ST");else if(nf===2){s.push("ST","ST");}else{for(let i=0;i<nf;i++)s.push(i===0?"LW":i===nf-1?"RW":"ST");} return s;
}

// HOW ATTACKING EACH SLOT IS (buildSquad's atkW), left to right within each line.
export const FORM_ATKW = {
  "4-2-4":     [0, 4,3,3,4, 16,16, 34,40,42,34],          // LB CB CB RB | CM CM | LW ST ST RW
  "4-4-2":     [0, 4,3,3,4, 20,16,16,20, 40,42],           // LB CB CB RB | LM CM CM RM | ST ST
  "4-3-3":     [0, 5,3,3,5, 14,18,14, 34,42,34],           // LB CB CB RB | CM CM(b2b) CM | LW ST RW
  "4-2-3-1":   [0, 4,3,3,4, 10,10, 24,30,24, 42],          // LB CB CB RB | DM DM | LAM CAM RAM | ST
  "4-1-4-1":   [0, 4,3,3,4, 8, 26,16,16,26, 38],           // LB CB CB RB | DM | LW CM CM RW | ST
  "4-1-2-1-2": [0, 4,3,3,4, 8, 16,16, 30, 40,42],          // LB CB CB RB | DM | CM CM | AM | ST ST
  "4-3-2-1":   [0, 4,3,3,4, 12,18,12, 28,28, 42],          // LB CB CB RB | CM CM(b2b) CM | AM AM | ST
  "3-4-3":     [0, 3,4,3, 14,12,12,14, 34,40,34],          // CB CB CB | LM CM CM RM | LW ST RW
  "3-5-2":     [0, 3,4,3, 16,14,18,14,16, 38,40],          // CB CB CB | LWB CM CM(b2b) CM RWB | ST ST
  "3-4-1-2":   [0, 3,4,3, 16,12,12,16, 28, 38,40],         // CB CB CB | LWB CM CM RWB | AM | ST ST
  "5-3-2":     [0, 10,3,4,3,10, 18,16,18, 38,40],          // LWB CB CB CB RWB | CM CM(b2b) CM | ST ST
  "4-4-1-1":   [0, 4,3,3,4, 20,16,16,20, 32, 42],          // LB CB CB RB | LM CM CM RM | AM | ST
  "4-2-2-2":   [0, 4,3,3,4, 10,10, 28,28, 40,42],          // LB CB CB RB | DM DM | LAM RAM | ST ST
  "4-3-1-2":   [0, 4,3,3,4, 12,16,12, 30, 40,42],          // LB CB CB RB | CM CM(b2b) CM | AM | ST ST
  "3-4-2-1":   [0, 3,4,3, 16,12,12,16, 28,28, 42],         // CB CB CB | LWB CM CM RWB | AM AM | ST
  "5-4-1":     [0, 10,3,4,3,10, 18,14,14,18, 40],          // LWB CB CB CB RWB | LM CM CM RM | ST
};

export const formAtkW = (fm) => FORM_ATKW[fm] || (()=>{ const d2=fm.split("-").map(Number); const g=[0]; let ii=1; for(let i=0;i<d2[0];i++){g.push(4);ii++;} for(let di=1;di<d2.length-1;di++){const isDeep=di===1&&d2.length>3;for(let i=0;i<d2[di];i++){g.push(isDeep?10:Math.round(12+26*((ii-d2[0]-1)/Math.max(1,10-d2[0]-d2[d2.length-1]-1))));ii++;}} for(let i=0;i<d2[d2.length-1];i++){const nf=d2[d2.length-1];g.push(nf===1?36:nf===2?(i===0?40:42):(i===nf-1?38:36));ii++;} return g; })();

// ── Formation pitch geometry ───────────────────────────────────────────
// Slot positions as x/y percentages across the pitch, y=100 at your own goal line, attacking
// upward. Hand-placed per formation so the shape reads as that formation rather than as evenly
// spaced rows; anything not in the table falls back to the generated layout below.
export const FPOS2 = {
  "4-4-2":[[50,93],[15,74],[38.3,76],[61.7,76],[85,74],[12,52],[37.3,54],[62.7,54],[88,52],[38,28],[62,28]],
  "4-3-3":[[50,93],[15,74],[38.3,76],[61.7,76],[85,74],[28,52],[50,50],[72,52],[15,24],[50,20],[85,24]],
  "4-2-3-1":[[50,93],[15,74],[38.3,76],[61.7,76],[85,74],[39,56],[61,56],[18,36],[50,32],[82,36],[50,14]],
  "4-1-4-1":[[50,93],[15,74],[38.3,76],[61.7,76],[85,74],[50,56],[14,38],[38,40],[62,40],[86,38],[50,18]],
  "4-1-2-1-2":[[50,93],[15,74],[38.3,76],[61.7,76],[85,74],[50,58],[39,44],[61,44],[50,30],[39,16],[61,16]],
  "4-3-2-1":[[50,93],[15,74],[38.3,76],[61.7,76],[85,74],[28,54],[50,52],[72,54],[38,32],[62,32],[50,14]],
  "4-2-4":[[50,93],[15,74],[38.3,76],[61.7,76],[85,74],[39,54],[61,54],[14,26],[38,22],[62,22],[86,26]],
  "3-4-3":[[50,93],[28,76],[50,78],[72,76],[12,52],[37.3,54],[62.7,54],[88,52],[18,24],[50,20],[82,24]],
  "3-5-2":[[50,93],[28,76],[50,78],[72,76],[9,50],[29.5,52],[50,48],[70.5,52],[91,50],[39,22],[61,22]],
  "3-4-1-2":[[50,93],[28,76],[50,78],[72,76],[12,54],[37.3,56],[62.7,56],[88,54],[50,34],[39,16],[61,16]],
  "5-3-2":[[50,93],[9,68],[28,76],[50,78],[72,76],[91,68],[28,48],[50,46],[72,48],[39,22],[61,22]],
  "4-2-2-2":[[50,93],[15,74],[38.3,76],[61.7,76],[85,74],[39,56],[61,56],[24,34],[76,34],[39,16],[61,16]],
  "4-3-1-2":[[50,93],[15,74],[38.3,76],[61.7,76],[85,74],[28,54],[50,52],[72,54],[50,32],[39,16],[61,16]],
  "3-4-2-1":[[50,93],[28,76],[50,78],[72,76],[12,54],[37.3,56],[62.7,56],[88,54],[36,32],[64,32],[50,14]],
  // DEFENSIVE COUNTERPARTS, and since 6 Oct 2026 shapes a side can start in too. A side DROPS into one of
  // these when it loses the ball: a 3-4-3 defends as a 5-4-1 and a 4-2-3-1 as a 4-4-1-1, so the shape the
  // engine holds out of possession is the shape the formation actually becomes rather than the one it
  // attacks in.
  //
  // Authored rather than generated. pitchSlots' fallback lays out flat, evenly spaced rows: it puts
  // a back FIVE in one line 88 units wide at y=65, nine units higher up the pitch than an authored
  // back four sits, which is the opposite of what a back five is for. The stagger here is the one
  // every other entry above uses -- centre-backs narrow and deep, the men outside them wider and a
  // touch higher.
  "5-4-1":[[50,93],[9,68],[28,76],[50,78],[72,76],[91,68],[14,50],[37.3,48],[62.7,48],[86,50],[50,20]],
  "4-4-1-1":[[50,93],[15,74],[38.3,76],[61.7,76],[85,74],[12,52],[37.3,54],[62.7,54],[88,52],[50,32],[50,14]],
};

export const pitchSlots = (formation) => FPOS2[formation] || (() => {
  const layers = (formation || "4-3-3").split("-").map(Number);
  const nR = layers.length + 1, yT = 12, yB = 92, rG = (yB - yT) / (nR - 1);
  const pts = [[50, yB]];
  // Keep adjacent dots at least 22 units apart so player-name labels never overlap.
  layers.forEach((c, li) => { const y = yB - (li + 1) * rG; const hs = c <= 1 ? 0 : Math.max(38, 11 * (c - 1)); const lo = 50 - hs; const gap = c <= 1 ? 0 : (2 * hs) / (c - 1); for (let j = 0; j < c; j++) pts.push([c === 1 ? 50 : lo + j * gap, y]); });
  return pts;
})();

// WHAT A SHAPE BECOMES WHEN IT LOSES THE BALL. A 3-4-3 does not defend as a 3-4-3; the wing-backs
// drop and it is a 5-4-1. Nothing here was ever told that, so a side defended in the shape it
// attacks in -- which is why a back five put fewer men in its own box than a back four.
//
// Names, not coordinates: the app's slot table already has every one of these, and the only thing a
// defensive shape has to supply is relative depth order and width. meBlock derives the actual line
// and spacing from the ball. Two of the names were authored for this (5-4-1 and 4-4-1-1) because
// the generated fallback lays out flat evenly-spaced rows and would have put a back five in one
// line, nine metres higher up the pitch than an authored back four sits.
export const ME_DEF_FORM = {
  "3-4-3": "5-4-1", "3-5-2": "5-3-2", "3-4-1-2": "5-3-2",
  "4-2-4": "4-4-2", "4-1-2-1-2": "4-4-2", "4-3-2-1": "4-4-2",
  "4-3-3": "4-1-4-1", "4-2-3-1": "4-4-1-1",
  "4-2-2-2": "4-4-2", "4-3-1-2": "4-4-2", "3-4-2-1": "5-4-1",
};

// WHICH SHAPES ARE NEXT TO WHICH. A manager who changes shape in a match moves to a neighbouring one, and
// how far apart two shapes are is how far their ten outfielders have to move to get from one to the other:
// the cheapest assignment of one shape's slots onto the other's, in metres on a 105x68 pitch. A back four
// becoming a back three is a long way; a 4-4-2 becoming a 4-4-1-1 is one man stepping off the front line.
const _formCost = new Map();
export function meFormCost(a, b) {
  if (a === b) return 0;
  const k = a < b ? a + "|" + b : b + "|" + a;
  if (_formCost.has(k)) return _formCost.get(k);
  const A = pitchSlots(a).slice(1), B = pitchSlots(b).slice(1), n = Math.min(A.length, B.length);
  const m = A.slice(0, n).map(([x1, y1]) => B.slice(0, n).map(([x2, y2]) => Math.hypot((x1 - x2) * 0.68, (y1 - y2) * 1.05)));
  const res = meHungarian(m, n);
  let c = 0;
  for (let r = 0; r < n; r++) c += m[r][res[r]];
  _formCost.set(k, c);
  return c;
}
// The shapes within `max` metres of this one, nearest first -- and never fewer than the nearest two, or a
// shape out on its own (a 5-4-1 is 63 m from anything) would have nowhere to go.
export function meFormAdj(f, max = 60) {
  const all = FORMATIONS.filter(g => g !== f).sort((a, b) => meFormCost(f, a) - meFormCost(f, b));
  const near = all.filter(g => meFormCost(f, g) <= max);
  return near.length >= 2 ? near : all.slice(0, 2);
}
