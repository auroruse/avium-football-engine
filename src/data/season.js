// A SEASON: a nation's divisions and the cup they enter, played together (DESIGN.md "Seasons"; the user, 26 November
// 2026: "simming the league and cup simultaneously, since they take place simultaneously ... some cups have more than
// one division's clubs in them ... injuries and whatever will carry over between league & cup games").
//
// A season is one tournament: each division is a group with its own table, the cup is its knockout, and one record of
// every man's bans, injuries and tiredness serves them all. What is here is everything about it that needs no screen:
// which clubs make which division, the calendar of numbered matchdays, who sits the cup's first round out, and each
// competition's own figures read back out of the results.
//
// THE CALENDAR is numbered matchdays, no dates (the user: "numbered matchdays, since each nation could have different
// scheduling"). A matchday is a league day (every division with a round that day plays it) or a cup date, never both,
// and the cup's dates are set aside for every club before a ball is kicked, so nothing ever clashes. A division with
// fewer rounds than the longest sits league days out, spread evenly, and every division finishes on the same day. The
// cup's dates are spread evenly through the league's and its final comes after the last league round.

const mean = (ts) => ts.reduce((a, t) => a + (+t.skill || 0), 0) / Math.max(1, ts.length);

// The clubs picked, split into divisions by the league each is in, the highest division first. `leagueOf` names a
// club's league; `recs` is the league records (src/data/leagues.json), which give the tier, the cup and how many go up
// and down. A league with no record (or a tier of 0) goes after the ones that have one, the stronger first.
export function seasonDivisions(teams, leagueOf, recs) {
  const rec = new Map((recs || []).map(l => [l.name, l])), by = new Map();
  for (const t of teams || []) { const k = leagueOf(t) || "Clubs"; if (!by.has(k)) by.set(k, []); by.get(k).push(t); }
  const tierOf = (name) => { const t = rec.get(name)?.tier; return t > 0 ? t : 99; };
  return [...by].map(([name, ts]) => ({ name, teams: ts, rec: rec.get(name) || null, tier: tierOf(name) }))
    .sort((a, b) => a.tier - b.tier || mean(b.teams) - mean(a.teams) || a.name.localeCompare(b.name));
}

// The cup most of these divisions enter, by their records; "" when none of them names one.
export function seasonCupName(divs) {
  const n = new Map();
  for (const d of divs || []) if (d.rec?.cup) n.set(d.rec.cup, (n.get(d.rec.cup) || 0) + d.teams.length);
  return [...n].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

// A division's places worth marking, off its league's record (src/data/leagues.js), from the top: the Club World Cup's
// places and the Club World Shield's after them, or who goes up and the promotion playoff's places after them; then who
// goes down. No zone for the champions (the user, 26 November 2026: "It's self-explanatory"). `f` is { cwc, cws, up,
// playoff, down } and `colors` the colour of each by the same names. Editable afterwards on the season's Rules page.
export function seasonZones(f, colors) {
  const n = (v) => Math.max(0, Math.round(+v || 0)), z = [];
  const run = (k, label) => { const c = n(f?.[k]); if (!c) return; const from = (z.at(-1)?.to || 0) + 1;
    z.push({ anchor: "top", from, to: from + c - 1, label, color: colors[k], type: "cosmetic" }); };
  run("cwc", "Club World Cup"); run("cws", "Club World Shield"); run("up", "Promotion"); run("playoff", "Promotion Playoff");
  if (n(f?.down)) z.push({ anchor: "bottom", from: 1, to: n(f.down), label: "Relegation", color: colors.down, type: "cosmetic" });
  return z;
}

// The cup's dates in order, off its bracket: a date a round, two for a round over two legs, the third-place match on
// the final's date. Each is { ri, leg, fin, tp }: leg 0 a tie settled on the day, 1 and 2 the legs.
export function cupDates(nRounds, twoLegs, finalOneLeg, thirdPlace) {
  const out = [];
  for (let ri = 0; ri < nRounds; ri++) {
    const fin = ri === nRounds - 1, two = twoLegs && !(fin && finalOneLeg);
    if (two) out.push({ ri, leg: 1, fin }, { ri, leg: 2, fin }); else out.push({ ri, leg: 0, fin });
    if (fin && thirdPlace) out[out.length - (two ? 2 : 1)].tp = true;
  }
  return out;
}

// The calendar: `divRounds` is the rounds each division plays, `cup` the cup's dates (cupDates). Each matchday is
// { k: "l", r: [the round each division plays that day, -1 for a division sitting it out] } or { k: "c", ...date }.
export function seasonCalendar(divRounds, cup) {
  const L = Math.max(0, ...divRounds), dates = cup || [];
  const dayOf = divRounds.map(R => Array.from({ length: R }, (_, r) => (R <= 1 || R === L ? r : Math.round(r * (L - 1) / (R - 1)))));
  const early = dates.filter(d => !d.fin), late = dates.filter(d => d.fin);
  // The league days a cup date comes after: the earlier rounds spread evenly, never before the first league day.
  const after = early.map((_, i) => Math.min(Math.max(1, L - 1), Math.max(1, Math.round((i + 1) * L / (early.length + 1)))));
  const out = [];
  for (let d = 0; d < L; d++) {
    out.push({ k: "l", r: divRounds.map((_, di) => dayOf[di].indexOf(d)) });
    early.forEach((c, i) => { if (after[i] === d + 1 && d + 1 < L) out.push({ k: "c", ...c }); });
  }
  // A league of one day, or none: every cup date follows it.
  early.forEach((c, i) => { if (after[i] >= L) out.push({ k: "c", ...c }); });
  late.forEach(c => out.push({ k: "c", ...c }));
  return out;
}

// A cup tie is played once it has its result; one whose sides are not known yet (the round before still to play, or the
// draw still to make) is still to come, never played. Only a bye stands without one.
const tiePlayed = (m, leg1) => !m || !!m.bye || (!!m.home && !!m.away && !!m.result && (leg1 || !m.result.partial));
// Is a matchday played out? A cup date's first leg is played once its ties have a first leg.
export function matchdayDone(md, groups, ko) {
  if (!md) return true;
  if (md.k === "l") return md.r.every((ri, gi) => ri < 0 || (groups[gi]?.schedule[ri] || []).every(m => !m || m.bye || !m.home || !m.away || !!m.result));
  const ms = ko?.rounds?.[md.ri]?.matches || [];
  const ties = ms.every(m => tiePlayed(m, md.leg === 1));
  return ties && (!md.tp || !ko?.thirdPlace || tiePlayed(ko.thirdPlace, false));
}
// The matchday being played: the first not played out, or the calendar's length when the season is over.
export function matchdayNow(cal, groups, ko) {
  for (let i = 0; i < (cal || []).length; i++) if (!matchdayDone(cal[i], groups, ko)) return i;
  return (cal || []).length;
}
// WHAT A MATCHDAY IS CALLED (the user, 26 November 2026: cup rounds "shouldn't count as numbered matchdays (tho function
// as ones)"). League days are numbered among themselves; a cup date between them goes by its round.
export const leagueDayOf = (cal, i) => { let n = 0; for (let j = 0; j <= i && j < (cal || []).length; j++) if (cal[j].k === "l") n++; return n; };
export const leagueDays = (cal) => (cal || []).filter(m => m.k === "l").length;
export function matchdayLabel(cal, i, ko, cupName) {
  const md = cal?.[i]; if (!md) return "";
  if (md.k === "l") return "Matchday " + leagueDayOf(cal, i);
  const rd = ko?.rounds?.[md.ri]?.name || "Cup";
  return `${cupName || "Cup"}, ${rd}${md.leg ? ", Leg " + md.leg : ""}`;
}
// The next opponents a club meets from matchday `from` on, league or cup, nearest first: what its manager weighs when
// he decides whom to rest. A cup tie counts once its two sides are known.
export function seasonHorizon(cal, from, groups, ko, name, k = 3) {
  const out = [];
  let gi = -1;
  (groups || []).forEach((g, i) => { if (gi < 0 && (g.teams || []).some(t => t.name === name)) gi = i; });
  for (let i = from; i < (cal || []).length && out.length < k; i++) {
    const md = cal[i];
    let m = null;
    if (md.k === "l") { const ri = gi >= 0 ? md.r[gi] : -1; if (ri >= 0) m = (groups[gi].schedule[ri] || []).find(x => x && (x.home?.name === name || x.away?.name === name)); }
    else m = (ko?.rounds?.[md.ri]?.matches || []).find(x => x && !x.bye && x.home && x.away && (x.home.name === name || x.away.name === name));
    if (!m || m.bye || !m.home || !m.away) continue;
    const opp = m.home.name === name ? m.away : m.home;
    out.push({ skill: opp.skill ?? 65, name: opp.name, cup: md.k === "c" });
  }
  return out;
}

// Who sits the cup's first round out: `order` is the sides best first (the higher division, then the rating). The
// bracket holds the next power of two; the best of the field take the places nobody is drawn against.
export function cupEntry(order) {
  let n2 = 1; while (n2 < order.length) n2 *= 2;
  const nb = n2 - order.length;
  return { n2, byes: order.slice(0, nb), playing: order.slice(nb) };
}

// ── Each competition's own figures. A result keeps what it gave every man (statDiffs), so a competition's table of
// goals, assists and the rest is those added up over its own matches, whatever else he played that season. ──
export const TALLY = ["matches", "subApp", "mins", "goals", "assists", "totalRating", "yellows", "reds", "passOk", "prog", "cc", "defActs", "saves"];
const diffSets = (m) => { const sd = m?.result?.statDiffs; if (!sd) return []; return sd.leg1 ? [sd.leg1.home, sd.leg1.away, sd.leg2?.home, sd.leg2?.away] : [sd.home, sd.away]; };
export function tallyMatches(matches) {
  const sum = {};
  for (const m of matches || []) for (const diffs of diffSets(m)) if (diffs) for (const [k, d] of Object.entries(diffs)) {
    const e = sum[k] || (sum[k] = {});
    for (const f of TALLY) e[f] = (e[f] || 0) + (d[f] || 0);
  }
  return sum;
}
export const koMatches = (ko) => !ko ? [] : [...(ko.rounds || []).flatMap(r => r.matches || []), ...(ko.losers || []).flatMap(r => r.matches || []),
  ko.thirdPlace, ko.grandFinal, ko.reset].filter(Boolean);
export const groupMatches = (g) => (g?.schedule || []).flat().filter(Boolean);
// A competition's players: who each man is off the season's record, his figures off the competition's matches. The
// long injuries go with the league (`long`), which is where the year's lay-offs are read from.
export function compPlayerStats(playerStats, matches, long) {
  const sum = tallyMatches(matches), out = {};
  for (const [k, t] of Object.entries(sum)) {
    const p = playerStats[k]; if (!p) continue;
    const { longSev, longApps, ...who } = p;
    out[k] = { ...who, ...t, ...(long && longSev ? { longSev, longApps } : null) };
  }
  return out;
}
