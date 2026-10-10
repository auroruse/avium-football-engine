// WHAT A PLAYER IS WORTH: a transfer value in dollars, the unit the Avium Map's national statistics use, at modern
// scale. Worked out whenever it is shown and never stored, so it follows a man's rating and age on its own (the user,
// 9 Oct 2026). Five things set it: his rating, his age, his position, how his rating moved at the last refreshes, and
// the strength of the league his club plays in. The app (a player's page) and test/values.mjs (the report) both read
// the five off the records through valueContext and trendsOf below, so the two always give the same figure.
import { ageOf } from "./icclock.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Rating: dollars at each anchor, read between them on a log scale, so the top end climbs the way a market does.
const BASE = [[35, 10e3], [40, 20e3], [50, 60e3], [60, 250e3], [70, 1.2e6], [75, 4e6], [80, 12e6], [87, 50e6], [93, 150e6]];
function base(ovr) {
  let i = 1;
  while (i < BASE.length - 1 && ovr > BASE[i][0]) i++;
  const [a, va] = BASE[i - 1], [b, vb] = BASE[i];
  return Math.exp(Math.log(va) + (ovr - a) * (Math.log(vb) - Math.log(va)) / (b - a));
}

// Age: full value from 24 to 27 and falling fast after 28; a keeper ages two years slower. A young man already good for
// his age is worth more than the same rating at 27.
const DECLINE = { 28: 0.9, 29: 0.8, 30: 0.68, 31: 0.55, 32: 0.43, 33: 0.33, 34: 0.25, 35: 0.18, 36: 0.13, 37: 0.09 };
const YOUTH = { 17: 0.9, 18: 0.8, 19: 0.65, 20: 0.5, 21: 0.35, 22: 0.2, 23: 0.1 };
function ageFactor(age, ovr, gk) {
  const a = gk ? age - 2 : age;
  if (a >= 38) return 0.06;
  if (a >= 28) return DECLINE[a];
  if (a >= 24) return 1;
  return 1 + 0.8 * YOUTH[Math.max(17, a)] * clamp((ovr - 60) / 25, 0, 1);
}

// Position: keepers worth least, then defenders and midfielders, attacking midfielders and wingers, forwards most.
const POS = { GK: 0.6, DEF: 0.85, MID: 1, ATT: 1.1, FWD: 1.2 };
export const posGroup = (p) => {
  const s = String(p || "").toUpperCase();
  return s === "GK" ? "GK" : /^(CB|LB|RB|LWB|RWB|SW|DEF)$/.test(s) ? "DEF" : /^(AM|LW|RW|CAM|LAM|RAM)$/.test(s) ? "ATT"
    : /^(ST|CF|SS|FWD|LS|RS)$/.test(s) ? "FWD" : "MID";
};

// Trend: what his rating did, net, at the last refreshes.
const trendFactor = (net) => (net >= 4 ? 1.3 : net >= 2 ? 1.15 : net <= -4 ? 0.8 : net <= -2 ? 0.9 : 1);

// League: its clubs' average rating, from x0.6 at 55 and below to x1.15 at 80 and above; a man with no club x0.85.
const leagueFactor = (mean) => (mean == null ? 0.85 : 0.6 + 0.55 * clamp((mean - 55) / 25, 0, 1));

// Two significant figures: a value is an estimate, and $12,384,551 claims a precision nobody has.
const round2 = (v) => { if (!(v > 0)) return 0; const p = Math.pow(10, Math.floor(Math.log10(v)) - 1); return Math.round(v / p) * p; };

// { ovr, age, pos, trend, leagueMean } -> dollars, or null without a rating.
export function valueOf({ ovr, age = null, pos = null, trend = 0, leagueMean = null }) {
  if (ovr == null || !Number.isFinite(+ovr)) return null;
  const g = posGroup(pos);
  return round2(base(+ovr) * (age == null ? 1 : ageFactor(age, +ovr, g === "GK")) * POS[g] * trendFactor(trend) * leagueFactor(leagueMean));
}

// A name as both the archive and the records can be matched on: accents, case, spaces and punctuation dropped.
export const nameKey = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");

// What each man's rating did, net, at the last refreshes: the newest two seasons of the changelog
// (public/avium/pstats/changelog.tsv), given as rows of { season, player, old, neu }. Keyed by nameKey.
export function trendsOf(rows) {
  const years = rows.map(r => parseInt(r.season, 10)).filter(Number.isFinite), newest = years.length ? Math.max(...years) : 0;
  const out = new Map();
  for (const r of rows) if (parseInt(r.season, 10) >= newest - 1) { const k = nameKey(r.player); out.set(k, (out.get(k) || 0) + (+r.neu - +r.old)); }
  return out;
}

// The rest of what a value needs, read off the team records (src/data/teams.json, or the app's records with the cart
// laid over them). A man's position is the slot he fills, a club's XI before a national one before a bench (slotsFor
// gives a formation's eleven; a 22-man national bench mirrors the XI, a club's five are GK, CB, CM, CM, ST). His club is
// the first club sheet that names him, and a league's strength is the average rating of its clubs.
export function valueContext(teams, slotsFor, idOf) {
  const national = (t) => t.file === "AVIUM" || t.file === "ARTERRA";
  const posOf = new Map(), rank = new Map(), clubOf = new Map(), byLeague = new Map();
  for (const t of teams) {
    const xi = slotsFor(String(t.formation || "4-3-3").trim());
    const labels = [...xi, ...(t.squad.length > 16 ? xi : ["GK", "CB", "CM", "CM", "ST"])];
    t.squad.forEach((v, i) => { const id = idOf(v); if (!id) return;
      const r = (i < 11 ? 0 : 2) + (national(t) ? 1 : 0);
      if (!posOf.has(id) || r < rank.get(id)) { posOf.set(id, labels[i]); rank.set(id, r); } });
    if (national(t)) continue;
    (byLeague.get(t.group) || byLeague.set(t.group, []).get(t.group)).push(+t.ovr);
    for (const v of t.squad) { const id = idOf(v); if (id && !clubOf.has(id)) clubOf.set(id, t); }
  }
  const leagueMean = new Map([...byLeague].map(([g, a]) => [g, a.reduce((x, y) => x + y, 0) / a.length]));
  return { posOf, clubOf, leagueMean };
}

// The five inputs for one man's record ({ id, name, ovr, born }), and his value.
export function valueInputs(p, ctx, trends, at) {
  const club = ctx.clubOf.get(p.id) || null;
  return { ovr: p.ovr, age: ageOf(p.born, at), pos: ctx.posOf.get(p.id) || null, trend: trends.get(nameKey(p.name)) || 0,
           leagueMean: club ? ctx.leagueMean.get(club.group) : null, club };
}
export const playerValue = (p, ctx, trends, at) => valueOf(valueInputs(p, ctx, trends, at));

// $150M, $8.5M, $450K, $9.5K: two figures and a unit.
export function moneyLabel(v) {
  if (v == null) return "–";
  const f = (x) => (x < 10 ? x.toFixed(1).replace(/\.0$/, "") : String(Math.round(x)));
  return v >= 1e9 ? `$${f(v / 1e9)}B` : v >= 1e6 ? `$${f(v / 1e6)}M` : v >= 1e3 ? `$${f(v / 1e3)}K` : `$${Math.round(v)}`;
}
