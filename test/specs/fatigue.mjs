// WHAT TIRED LEGS COST, IN RATING POINTS (16 October 2026, the coach's plan; the user: "If the early sub thing is
// stamina's fault then make the coach plan smarter"). A coach who weighs a tired man against the fresh one on his bench
// has to know what the legs are worth against the rating, and in this engine stamina reaches the pitch three ways at once
// -- top speed (0.80 + 0.20 x stamina), the strike's execution (fatExLo), and the press (pressLegs, pressLegsRun) -- which
// no arithmetic over the tables can add up. So it is measured: every club plays its fixtures with its eleven held at one
// stamina for the whole match (drain off, for both sides) or held fresh and some rating points down, and the stamina that
// costs a side what a given drop in rating costs it is the exchange rate. Nobody comes off: both sides play without a
// bench, so the eleven that start finish.
//   FIX_FIELD=nt   the twelve strongest national sides instead of League One
//   LAB_SPEC=fatigue.mjs, MINI_N fixtures a side.
const NT = process.env.FIX_FIELD === "nt";
const XI = (t) => t.squad.filter(p => !p.bench);
const legs = (s) => (t) => ({ ...t, squad: XI(t).map(p => ({ ...p, stamina: s })) });
const down = (d) => (t) => ({ ...t, skill: (t.skill ?? 75) - d, squad: XI(t).map(p => ({ ...p, ovr: (p.ovr ?? 75) - d, stamina: 100 })) });
const still = { drain: 0 };
export default {
  field: NT ? "Avium International" : "Nichirin League One",
  clubs: NT ? ["NCH", "ALE", "ESU", "ASK", "ARV", "HOL", "VIC", "ELV", "KAR", "SKJ", "AUR", "RUD"] : "all",
  n: +(process.env.MINI_N || 60), chunk: 20, base: "s100",
  opp: (t) => ({ ...t, squad: XI(t) }),
  arms: [
    { name: "s100", cfg: still, team: legs(100) },
    { name: "s85", cfg: still, team: legs(85) },
    { name: "s70", cfg: still, team: legs(70) },
    { name: "s55", cfg: still, team: legs(55) },
    { name: "s40", cfg: still, team: legs(40) },
    { name: "o4", cfg: still, team: down(4) },
    { name: "o8", cfg: still, team: down(8) },
    { name: "o12", cfg: still, team: down(12) },
    { name: "o16", cfg: still, team: down(16) },
  ],
};
