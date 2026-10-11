// WHERE A MAN PLAYS. Every player has positions of his own, one or two, on his record (`pos`, Moukden and Kirin, 11
// October 2026), and plays both of them at his full rating. Anywhere else he keeps the skills of his own position (the
// engine, src/engine/attributes.ts) and is worse for it, by about what ovrAt says. The squad tools judge places by
// the same positions: App.tsx re-slots lineups by them, and the registry server fills a vacated place by them, so the
// two always agree.

// Natural-position model: [line, side] -- line GK->DEF->WB->DM->MID->AM->FWD, side left/centre/right.
// Side mismatches cost slightly more than line ones: a left back at right back is a worse ask
// than a left back pushed to left midfield.
export const POS_ROLE = { GK:[0,0], LB:[1,-1], CB:[1,0], RB:[1,1], LWB:[1.5,-1], RWB:[1.5,1], DM:[2,0], CM:[3,0], AM:[4,0], LM:[3,-1], RM:[3,1], LW:[4,-1], RW:[4,1], ST:[5,0] };
// The positions in the order lists show them: the keeper, then up the pitch, left to right.
export const POSITIONS = ["GK", "LB", "CB", "RB", "LWB", "RWB", "DM", "CM", "AM", "LM", "RM", "LW", "RW", "ST"];
// The broad groups a bench place takes (Moukden and Kirin, 11 October 2026: "Places keep a broad group"): a keeper, a
// defender, a midfielder or a forward. Wing-backs defend; wingers attack.
export const POS_GROUP = { GK: "GK", LB: "DEF", CB: "DEF", RB: "DEF", LWB: "DEF", RWB: "DEF", DM: "MID", CM: "MID", AM: "MID", LM: "MID", RM: "MID",
                           LW: "FWD", RW: "FWD", ST: "FWD" };
export const GROUPS = ["GK", "DEF", "MID", "FWD"];
export const GROUP_NAME = { GK: "Keeper", DEF: "Defender", MID: "Midfielder", FWD: "Forward" };
const GROUP_POS = Object.fromEntries(GROUPS.map(g => [g, POSITIONS.filter(p => POS_GROUP[p] === g)]));

// A man's positions as a list, from however a record or a sheet carries them: "CM", ["CM", "DM"] or "CM/DM". At most
// two, each once, and only real positions.
export const posList = (v) => {
  const l = Array.isArray(v) ? v : typeof v === "string" && v ? v.split("/") : [];
  const out = [];
  for (const x of l) { const p = String(x || "").trim().toUpperCase(); if (POS_ROLE[p] && !out.includes(p)) out.push(p); }
  return out.slice(0, 2);
};
export const posText = (v) => posList(v).join("/");

// How far a man is from a place. `a` is a position, a man's list of positions (the nearest counts) or, for an old
// sheet's bench man, a group; `b` a position or a bench place's group, which any of its positions fills at no cost. An
// empty list is a man whose positions are not known, who fits anywhere as every man did before they had them.
export function posFitCost(a, b) {
  if (Array.isArray(a)) { if (!a.length) return b === "GK" ? 1000 : 0; return Math.min(...a.map(x => posFitCost(x, b))); }
  if (GROUP_POS[a] && a !== "GK") return Math.min(...GROUP_POS[a].map(x => posFitCost(x, b)));
  if (GROUP_POS[b] && b !== "GK") return POS_GROUP[a] === b ? 0 : Math.min(...GROUP_POS[b].map(x => posFitCost(a, x)));
  if ((a === "GK") !== (b === "GK")) return 1000;
  const A = POS_ROLE[a] || POS_ROLE.CM, B = POS_ROLE[b] || POS_ROLE.CM;
  return Math.abs(A[0] - B[0]) + 1.2 * Math.abs(A[1] - B[1]);
}
// Whether a man's positions include a place: the position itself, or one of a bench place's group.
export const fitsPlace = (own, place) => { const l = posList(own); return !l.length || (GROUP_POS[place] ? l.some(p => POS_GROUP[p] === place) : l.includes(place)); };
// Which of his positions he plays a place from: the place itself if it is his, else the nearer of his two.
export const ownFor = (own, place) => { const l = posList(own); if (!l.length) return place;
  return l.includes(place) ? place : l.reduce((b, p) => (posFitCost(p, place) < posFitCost(b, place) ? p : b), l[0]); };

// A squad's places: the formation's eleven (sposFor, from the engine's formations), then the bench, each bench place a
// broad group. A club's five are a keeper, a defender, two midfielders and a forward; a national side's eleven take its
// starters' groups, slot for slot.
export const CLUB_BENCH = ["GK", "DEF", "MID", "MID", "FWD"];
export const slotLabels = (sposFor, formation, n) => {
  const xi = sposFor(String(formation || "4-3-3").trim());
  return [...xi, ...(n > 16 ? xi.map(p => POS_GROUP[p] || "MID") : CLUB_BENCH)].slice(0, n);
};

// WHAT A MAN IS WORTH OUT OF POSITION, as a rating: about what the skills of his own position cost him in the place he
// is playing (the engine plays him on those skills; this is the figure the app shows). POS_DROP[own][place] is the
// rating he loses there, worked out by test/posdrop.mjs from what each skill is worth in each line, measured in the lab.
// In goal, or a keeper out of it, a man plays at half his rating, as the engine has always played an outfielder in goal.
// POS_DROP BEGIN (test/posdrop.mjs write, weights reasoned)
export const POS_DROP = {
  LB: {CB: 0, RB: 0, LWB: 3, RWB: 3, DM: 7, CM: 7, AM: 8, LM: 7, RM: 7, LW: 8, RW: 8, ST: 10},
  CB: {LB: 0, RB: 0, LWB: 3, RWB: 3, DM: 7, CM: 7, AM: 8, LM: 7, RM: 7, LW: 8, RW: 8, ST: 10},
  RB: {LB: 0, CB: 0, LWB: 3, RWB: 3, DM: 7, CM: 7, AM: 8, LM: 7, RM: 7, LW: 8, RW: 8, ST: 10},
  LWB: {LB: 4, CB: 5, RB: 4, RWB: 0, DM: 3, CM: 3, AM: 3, LM: 3, RM: 3, LW: 4, RW: 4, ST: 6},
  RWB: {LB: 4, CB: 5, RB: 4, LWB: 0, DM: 3, CM: 3, AM: 3, LM: 3, RM: 3, LW: 4, RW: 4, ST: 6},
  DM: {LB: 6, CB: 6, RB: 6, LWB: 1, RWB: 1, CM: 0, AM: 1, LM: 0, RM: 0, LW: 4, RW: 4, ST: 6},
  CM: {LB: 7, CB: 7, RB: 7, LWB: 2, RWB: 2, DM: 0, AM: 1, LM: 0, RM: 0, LW: 3, RW: 3, ST: 5},
  AM: {LB: 8, CB: 8, RB: 8, LWB: 2, RWB: 2, DM: 1, CM: 1, LM: 0, RM: 0, LW: 3, RW: 3, ST: 4},
  LM: {LB: 7, CB: 7, RB: 7, LWB: 2, RWB: 2, DM: 0, CM: 0, AM: 0, RM: 0, LW: 3, RW: 3, ST: 5},
  RM: {LB: 7, CB: 7, RB: 7, LWB: 2, RWB: 2, DM: 0, CM: 0, AM: 0, LM: 0, LW: 3, RW: 3, ST: 5},
  LW: {LB: 12, CB: 12, RB: 12, LWB: 6, RWB: 6, DM: 5, CM: 5, AM: 5, LM: 5, RM: 5, RW: 0, ST: 1},
  RW: {LB: 12, CB: 12, RB: 12, LWB: 6, RWB: 6, DM: 5, CM: 5, AM: 5, LM: 5, RM: 5, LW: 0, ST: 1},
  ST: {LB: 14, CB: 14, RB: 14, LWB: 8, RWB: 8, DM: 7, CM: 7, AM: 6, LM: 7, RM: 7, LW: 1, RW: 1},
};
// POS_DROP END
export const posDrop = (own, place) => {
  const l = posList(own); if (!l.length || !POS_ROLE[place] || l.includes(place)) return 0;
  const p = ownFor(l, place);
  if ((p === "GK") !== (place === "GK")) return null;                      // half his rating: see ovrAt
  return POS_DROP?.[p]?.[place] ?? 0;
};
// The rating a man plays a place at, as the app shows it.
export const ovrAt = (ovr, own, place) => {
  const d = posDrop(own, place);
  if (d === null) return Math.max(1, Math.round((Number(ovr) || 0) / 2));
  return Math.max(1, (Number(ovr) || 0) - d);
};
