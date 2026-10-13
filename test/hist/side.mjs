// A HISTORICAL SIDE (the 1888/89-1932/33 re-sim, 13 October 2026): no real players, only the club's rating that season, its
// style and its shape. The eleven play at the rating, the bench four under it, nobody has a name the report would print,
// and nobody manages: the record names no managers before 1931/32.
export function sideOf(E, { name, code, skill, style, formation }) {
  const squad = E.buildSquad(formation, null, 5, true).map((p, i) => ({ ...p, ovr: p.bench ? skill - 4 : skill, name: code + i, fullName: code + " " + i, nat: "NCH" }));
  return { name, code, skill, style, formation, strategy: { ...E.STRAT_DEF, ...(E.STYLE_PRESET[style] || {}) }, squad,
           manager: null, mgmt: null, league: "History", id: "hist-" + code };
}
