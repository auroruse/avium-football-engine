// SET PIECES, 12 October 2026 (the user: goals "so inflated", top scorers past a goal a game, "a lot of free kicks
// converted from ridiculously steep angles"). The first run (base against the last commit) found 0.89 penalties a match,
// 0.80 of them for fouls, scored 89%, where a real league gives 0.28 and scores 76%. This one sets the area's own foul
// rule (MT.boxTackleFoul, the share of a missed tackle's chance of a foul left in the area; base 0.3) and the penalty's
// conversion (CFG.spPenRead, the keeper's read; CFG.spPenAim, how near the post he goes) arm by arm.
// test/lab.mjs records, per side and match, the free kicks struck at goal (fkTry, fkWide) and scored (g_fk), the
// penalties given for a foul (penF) and a handball (penH) and scored (g_pen), goals with no shot (g_ns) or from a shot
// with no origin (g_sp), and every foul in the match by kind and whether it was in an area (flT/flTB, flC/flCB, flY/flYB).
//   FIX_FIELD=nl1 | nt   MINI_N fixtures a side.
const NT = process.env.FIX_FIELD === "nt";
export default {
  field: NT ? "Avium International" : "Nichirin League One",
  clubs: NT ? ["NCH", "ALE", "ESU", "ASK", "ARV", "HOL", "VIC", "ELV", "KAR", "SKJ", "AUR", "RUD"] : "all",
  n: +(process.env.MINI_N || 100), chunk: 25, base: "base",
  arms: [
    { name: "base" },
    { name: "box15", mt: { boxTackleFoul: 0.15 } },
    { name: "box50", mt: { boxTackleFoul: 0.5 } },
    { name: "read25", cfg: { spPenRead: 0.25 } },
    { name: "aim72", cfg: { spPenAim: 0.72 } },
  ],
};
