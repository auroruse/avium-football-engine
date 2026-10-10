// WHO MANAGED WHOM, SEASON BY SEASON. The season archive records matches and never who managed them, so this file says
// who ran each side from 1931/32 on, the first season with player statistics (with the 1932 World Cup). Moukden and
// Kirin's rulings, 9 October 2026:
// - Every manager has run his current side or sides since tracking began, except at the sides listed here.
// - A listed side names its managers in order, each with the first season credited to him: a year (every season of that
//   year on), "after:<season>" (every season after that one), or a season (that one on). A null manager is a spell
//   nobody recorded. The last named is the side's manager now.
// - The sheets' moves of 6 September, 2 October and 5 October 2026 are real, and fall at the first season filed after
//   them: 6 September's from the 1935 World Cup, 2 and 5 October's after it. So are 9 October's, after it as well: three
//   national sides given a coach whose style fits theirs (Albers back at Kinshū; Rautinen and Sarelainen swapping
//   Tierra Arcadia and Axerfreditenshin), since a manager owns the style his sides play. Every other change in the sheets' history
//   is a cleanup and not canon, and so are 6 September's swaps at Spartak, Dynamo and ISS and 5 October's at Eivorie
//   (Dæltun Leah has had Eivorie throughout).
// Seasons are public/avium/pstats folders and seasons; sides are team records (src/data/teams.json); managers are
// src/data/managers.json. test/tenures.mjs checks the three agree.
export const TRACKED_FROM = 1932;
const SEP_1934 = "wc/1935";           // the sheets' 6 September 2026 moves
const EARLY_1935 = "after:wc/1935";   // their 2, 5 and 9 October 2026 moves

export const MANAGER_HISTORY = [
  // National sides.
  { side: "t0065", name: "E.S.U.", spells: [["m0059", "1932"], ["m0060", "1933"]] },                    // Kanno; Van der Bilt before 1933
  { side: "t0063", name: "Nichirin", spells: [["m0061", "1932"], ["m0244", "after:wc/1933"], ["m0059", EARLY_1935]] },
                                                                                                     // Tatara; Alferinho after the 1933 World Cup; Kanno
  { side: "t0067", name: "Arverne", spells: [["m0041", "1932"], ["m0061", "after:wc/1933"]] },          // De Courcelles; Tatara
  { side: "t0094", name: "Salishia", spells: [[null, "1932"], ["m0041", "after:wc/1933"]] },            // nobody recorded; De Courcelles
  { side: "t0086", name: "Hōrai", spells: [[null, "1932"], ["m0059", "1933"], ["m0179", SEP_1934], ["m0193", EARLY_1935]] },
                                                                                                     // nobody recorded; Kanno from E.S.U.; Kurobe; Hvit
  { side: "t0082", name: "Kinshū", spells: [["m0007", "1932"], ["m0072", SEP_1934], ["m0024", EARLY_1935]] },
                                                                                                     // Albers; Ōnuki; Albers
  { side: "t0095", name: "Divia", spells: [["m0072", "1932"], ["m0082", SEP_1934]] },                   // Ōnuki; Kanamori
  { side: "t0099", name: "Mizuho", spells: [["m0166", "1932"], ["m0194", SEP_1934], ["m0051", EARLY_1935]] },  // Stroganov; Zarubin; Thibaudeau
  { side: "t0109", name: "Ryūgu", spells: [["m0116", "1932"], ["m0190", SEP_1934], ["m0092", EARLY_1935]] },   // Beauchamp; Yagihara; Weber
  { side: "t0106", name: "Tierra Arcadia", spells: [["m0089", "1932"], ["m0097", EARLY_1935]] },      // Rautinen; Sarelainen
  { side: "t0114", name: "Axerfreditenshin", spells: [["m0097", "1932"], ["m0089", EARLY_1935]] },    // Sarelainen; Rautinen
  // Sides retconned out of the world, their seasons in the archive as Independent XIs (9 October 2026): East Kaukasos
  // (it left the sheets on 12 September 2026), Albinya and, from 10 October 2026, Morozia. An Independent XI is not a
  // standing team, so it is numbered only in a tournament that had more than one (Moukden and Kirin, 10 October 2026):
  // `as` gives the name each went by in each season it played, `key` keeps the three apart.
  { former: { key: "AEK", code: "IX", name: "Independent XI", nt: true,
      as: {
        "eastern/1935": "Independent XI 1", "eufa/1932": "Independent XI 1", "eufa/1933": "Independent XI 1",
        "eufa/1934": "Independent XI 1", "natl/1932": "Independent XI 1", "natl/1933": "Independent XI 1",
        "natl/1934": "Independent XI 1", "wc/1933": "Independent XI" } },
    spells: [["m0179", "1932"], ["m0192", SEP_1934]] },                                               // Kurobe; Shulha
  { former: { key: "ALB", code: "IX", name: "Independent XI", nt: true, as: { "wc/1935": "Independent XI" } },
    spells: [["m0080", "1932"]] },                                                                    // Etxebarria Zubeldia
  { former: { key: "MOR", code: "IX", name: "Independent XI", nt: true,
      as: {
        "conseaf/1932": "Independent XI", "conseaf/1933": "Independent XI 1", "conseaf/1934": "Independent XI",
        "natl/1932": "Independent XI 3", "natl/1933": "Independent XI 3", "natl/1934": "Independent XI 3",
        "western/1935": "Independent XI" } },
    spells: [["m0088", "1932"]] },                                                                    // Fazekas
  // Clubs.
  { side: "t0142", name: "Winscor Chaplains", spells: [["m0086", "1932"], ["m0117", SEP_1934]] },        // Khan; Rogan
  { side: "t0203", name: "Spartak Kanagawa", spells: [["m0061", "1932"], ["m0168", EARLY_1935]] },       // Tatara; Vogelsang
  { side: "t0205", name: "Dynamo Mizuhara", spells: [["m0194", "1932"], ["m0170", EARLY_1935]] },        // Zarubin; Onogi
  { side: "t0206", name: "Imperial Sports Society", spells: [["m0244", "1932"], ["m0171", EARLY_1935]] }, // Alferinho; Kirisaki
  { side: "t0209", name: "Shizuku Athletic", spells: [["m0069", "1932"], ["m0086", SEP_1934]] },         // Argyros; Khan
  { side: "t0234", name: "Shiome Matsuumi", spells: [["m0096", "1932"], ["m0069", SEP_1934]] },          // Sonobe; Argyros
  { side: "t0221", name: "Kannushi", spells: [["m0170", "1932"], ["m0178", EARLY_1935]] },               // Onogi; Kon Genjiro
  { side: "t0131", name: "Gallican FC", spells: [["m0168", "1932"], ["m0109", EARLY_1935]] },            // Vogelsang; Aretaechevarria
  { side: "t0213", name: "Takarazuka Kaigun", spells: [["m0068", "1932"], ["m0061", EARLY_1935]] },      // von Schöning; Tatara
  { side: "t0223", name: "AC Shirasagi", spells: [["m0093", "1932"], ["m0068", EARLY_1935]] },           // Horie; von Schöning
  { side: "t0235", name: "Metallurg Motohora", spells: [["m0247", "1932"], ["m0093", EARLY_1935]] },     // Ōkōchi; Horie
  { side: "t0243", name: "Concordia Hakata", spells: [["m0246", "1932"], ["m0194", EARLY_1935]] },       // Takahata; Zarubin
];
