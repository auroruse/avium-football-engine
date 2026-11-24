// THE PLAYER BADGES as people see them: name, family and level. What each one does lives in the engine (config.ts
// ME_BADGES); its art is public/player-badges/<id>-<level>.svg, drawn by test/badge-art.mjs from this same table.
// LEVELS, FAMILIES AND FLAWS (user, 22 November 2026: "redesign badges to cover everything new we have, more
// comprehensively, to cover different player archetypes with combinations and such"; asked: Levels, flaws In, Mind and
// Keeper first). Every trait now comes at a level, one to three, and costs its level in points: a man spends what his
// rating gives him on a few traits at a high level or on several at a low one. The metals are the levels (bronze 1,
// silver 2, gold 3) and no longer a rank of the traits against each other. A FLAW is a trait that costs him, at level
// one or two, and gives its level back in points; a man carries one at most.
//   std: the level a trait's effect in the engine (config.ts ME_BADGES) is written at. For the traits that existed
//   before levels it is what the trait then cost (gold 3, silver 2, bronze 1), so every man who already carried one
//   carries it at that level, plays exactly as he did and has spent exactly what he had.
//   A man's traits are stored as keys: "vision" is Vision at its std, "vision:3" at level three.
export const FAMILIES = ["Mind", "Ball", "Body", "Finishing", "Defending", "Keeper"];
// In the order the records have always listed a man's traits (the first twenty-two), then the new ones; the pickers
// and the Traits table group them by family.
// THE NEW ONES ARE NAMED WITH ONE DESCRIBING WORD (user, 22 November 2026, after two rounds he threw out, nouns then
// phrases: asked, he chose One-Word Adjectives, the register of Rapid, Aerial, Relentless, Composed and Commanding).
// Their ids keep the first names they had (passandmove is Slick, safehands is Assured): ids are what records store.
export const BADGES = [
  ["finisher", "Finisher", "Finishing", 3], ["interceptor", "Interceptor", "Defending", 3], ["rapid", "Rapid", "Body", 3],
  ["aerial", "Aerial", "Body", 3], ["quickstep", "Quick Step", "Body", 3], ["blocker", "Blocker", "Defending", 3], ["strong", "Strong", "Body", 3],
  ["relentless", "Relentless", "Body", 2], ["trickster", "Trickster", "Ball", 2], ["vision", "Vision", "Mind", 2],
  ["incisive", "Incisive", "Ball", 2], ["disciplined", "Disciplined", "Defending", 2], ["longshot", "Long Shot", "Finishing", 2],
  ["firsttouch", "First Touch", "Ball", 2],
  ["crosser", "Crosser", "Ball", 1], ["tikitaka", "Short Passing", "Ball", 1], ["deadball", "Dead Ball", "Ball", 1],
  ["composed", "Composed", "Mind", 1], ["commanding", "Commanding", "Keeper", 1], ["tackler", "Tackler", "Defending", 1],
  ["longball", "Long Ball", "Ball", 1], ["shotstopper", "Shot Stopper", "Keeper", 1],
  // Mind (22 November 2026)
  ["shouldercheck", "Alert", "Mind", 3], ["passandmove", "Slick", "Mind", 3],
  ["tempo", "Patient", "Mind", 3], ["manon", "Vocal", "Mind", 3],
  // Keeper
  ["safehands", "Assured", "Keeper", 3], ["strongwrists", "Firm", "Keeper", 3],
  ["quickrelease", "Quick", "Keeper", 3], ["penstopper", "Clutch", "Keeper", 3],
  // Ball, Body, Finishing, Defending
  ["pressresistant", "Unflappable", "Ball", 3], ["ontherun", "Fluent", "Ball", 3], ["disguise", "Deceptive", "Ball", 3],
  ["drives", "Driving", "Ball", 3], ["drawsfoul", "Elusive", "Ball", 3],
  ["ridestackles", "Sturdy", "Body", 3],
  ["poacher", "Predatory", "Finishing", 3], ["squares", "Unselfish", "Finishing", 3],
  ["closesdown", "Tenacious", "Defending", 3], ["lastditch", "Desperate", "Defending", 3], ["tightmarker", "Tight", "Defending", 3],
  // Flaws
  ["ballwatcher", "Unaware", "Mind", 2, 1], ["dwells", "Hesitant", "Mind", 2, 1],
  ["flaps", "Erratic", "Keeper", 2, 1], ["spills", "Nervous", "Keeper", 2, 1],
  ["heavytouch", "Clumsy", "Ball", 2, 1], ["givesaway", "Wasteful", "Ball", 2, 1],
  ["outoflegs", "Unfit", "Body", 2, 1], ["greedy", "Greedy", "Finishing", 2, 1],
  ["hothead", "Reckless", "Defending", 2, 1], ["losesman", "Dozy", "Defending", 2, 1],
].map(([id, name, fam, std, flaw]) => ({ id, name, fam, std, flaw: !!flaw, tier: ["", "bronze", "silver", "gold"][std] }));
export const BADGE_BY_ID = Object.fromEntries(BADGES.map(b => [b.id, b]));
export const NAME = Object.fromEntries(BADGES.map(b => [b.id, b.name]));
// The level's metal, for the art and the labels: the same three the ratings are struck in.
export const LEVEL_TIER = ["", "bronze", "silver", "gold"];
export const LEVEL_NAME = ["", "Bronze", "Silver", "Gold"];
// A key apart: the trait's id, the trait itself, its level (0 for no such trait), and the key for a trait at a level.
export const traitId = (k) => String(k ?? "").split(":")[0];
export const badgeOf = (k) => BADGE_BY_ID[traitId(k)] || null;
export const traitLv = (k) => { const b = badgeOf(k); if (!b) return 0; const l = String(k).split(":")[1]; return l === undefined ? b.std : +l; };
export const maxLevelOf = (id) => (BADGE_BY_ID[traitId(id)]?.flaw ? 2 : 3);
export const traitKey = (id, lv) => (lv === BADGE_BY_ID[id]?.std ? id : `${id}:${lv}`);
export const TIER = Object.fromEntries(BADGES.map(b => [b.id, b.tier]));   // a trait's metal at its std (the art's default)
// How much of a trait's written effect a level carries: in proportion up to its std, half as fast past it. (The traits
// that were bronze and silver were sized as large as the engine rewards; past that they grow, but slower.)
export const levelShare = (lv, std) => (lv <= std ? lv / std : 1 + (lv - std) * 0.5);
// A man's traits in the order the table lists them, whatever order they were picked in; one key a trait.
export const badgeOrder = (ids) => { const xs = ids || []; return BADGES.map(b => xs.find(k => traitId(k) === b.id)).filter(Boolean); };
// WHAT A TRAIT COSTS, AND WHAT A MAN MAY SPEND (user, 11 October 2026; levels 22 November 2026). A trait costs its level
// and a flaw gives its level back. His rating gives him a budget of points; nothing below 70. Shared by the editor's
// trait list, the registry's rules and test/traits.mjs.
// (One point at 70 to 74 from 22 November 2026: the largest band there is, and nothing told two of its men apart.)
export const budgetOf = (ovr) => (ovr >= 90 ? 6 : ovr >= 85 ? 4 : ovr >= 80 ? 3 : ovr >= 75 ? 2 : ovr >= 70 ? 1 : 0);
export const traitCost = (ids) => (ids || []).reduce((a, k) => a + (badgeOf(k) ? (badgeOf(k).flaw ? -1 : 1) * traitLv(k) : 0), 0);
// His traits with one of them set to a level (0 takes it away), in the table's order.
export const withTrait = (ids, id, lv) => badgeOrder([...(ids || []).filter(k => traitId(k) !== id), ...(lv > 0 ? [traitKey(id, lv)] : [])]);
// (For test/traits.mjs, which gave every man his first traits under the old tiers.)
export const PRICE = { gold: 3, silver: 2, bronze: 1 };
export const maxTraitsOf = (ovr) => (ovr >= 90 ? 3 : ovr >= 75 ? 2 : 0);
// What is wrong with giving a man of this rating these traits, or null: unknown traits, one twice, more than he may
// carry, or more than his budget.
export function traitsProblem(ids, ovr) {
  const xs = ids || [];
  if (!xs.length) return null;
  if (xs.some(k => !badgeOf(k))) return "not a trait";
  if (xs.some(k => !(Number.isInteger(traitLv(k)) && traitLv(k) >= 1 && traitLv(k) <= maxLevelOf(k)))) return "a trait's level is 1 to 3, a flaw's 1 or 2";
  if (new Set(xs.map(traitId)).size !== xs.length) return "a trait given twice";
  if (!(ovr >= 70)) return "traits need a rating of 70 or more";
  if (xs.filter(k => badgeOf(k).flaw).length > 1) return "one flaw at most";
  if (traitCost(xs) > budgetOf(ovr)) return `traits worth ${traitCost(xs)} points, over the ${budgetOf(ovr)} a ${ovr} has`;
  return null;
}
