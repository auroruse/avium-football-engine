// THE PLAYER BADGES as people see them: name and tier, most useful first within each tier (gold, silver, bronze; the
// tiers set 8 Oct 2026 from measured worth). What each one does lives in the engine (config.ts ME_BADGES); its art is
// public/player-badges/<id>.svg, drawn by test/badge-art.mjs from this same table.
export const BADGES = [
  ["finisher", "Finisher", "gold"], ["interceptor", "Interceptor", "gold"], ["rapid", "Rapid", "gold"],
  ["aerial", "Aerial", "gold"], ["quickstep", "Quick Step", "gold"], ["blocker", "Blocker", "gold"], ["strong", "Strong", "gold"],
  ["relentless", "Relentless", "silver"], ["trickster", "Trickster", "silver"], ["vision", "Vision", "silver"],
  ["incisive", "Incisive", "silver"], ["disciplined", "Disciplined", "silver"], ["longshot", "Long Shot", "silver"],
  ["firsttouch", "First Touch", "silver"],
  ["crosser", "Crosser", "bronze"], ["tikitaka", "Short Passing", "bronze"], ["deadball", "Dead Ball", "bronze"],
  ["composed", "Composed", "bronze"], ["commanding", "Commanding", "bronze"], ["tackler", "Tackler", "bronze"],
  ["longball", "Long Ball", "bronze"], ["shotstopper", "Shot Stopper", "bronze"],
].map(([id, name, tier]) => ({ id, name, tier }));
export const BADGE_BY_ID = Object.fromEntries(BADGES.map(b => [b.id, b]));
export const TIER = Object.fromEntries(BADGES.map(b => [b.id, b.tier]));
export const NAME = Object.fromEntries(BADGES.map(b => [b.id, b.name]));
// A man's badges in the order the table lists them, whatever order they were picked in.
export const badgeOrder = (ids) => BADGES.filter(b => (ids || []).includes(b.id)).map(b => b.id);
// WHAT A TRAIT COSTS, AND WHAT A MAN MAY SPEND (user, 11 October 2026). A trait costs its pips: gold 3, silver 2,
// bronze 1. His rating gives him a budget of points to spend on any tiers, in at most two traits below 90 and three from
// 90; nothing below 75. Shared by the editor's trait list, the registry's rules and test/traits.mjs.
export const PRICE = { gold: 3, silver: 2, bronze: 1 };
export const budgetOf = (ovr) => (ovr >= 90 ? 6 : ovr >= 85 ? 4 : ovr >= 80 ? 3 : ovr >= 75 ? 2 : 0);
export const maxTraitsOf = (ovr) => (ovr >= 90 ? 3 : ovr >= 75 ? 2 : 0);
export const traitCost = (ids) => (ids || []).reduce((a, id) => a + (PRICE[TIER[id]] || 0), 0);
// What is wrong with giving a man of this rating these traits, or null: unknown traits, one twice, more than he may
// carry, or more than his budget.
export function traitsProblem(ids, ovr) {
  const xs = ids || [];
  if (!xs.length) return null;
  if (xs.some(id => !TIER[id])) return "not a trait";
  if (new Set(xs).size !== xs.length) return "a trait given twice";
  if (!(ovr >= 75)) return "traits need a rating of 75 or more";
  if (xs.length > maxTraitsOf(ovr)) return `at most ${maxTraitsOf(ovr) === 3 ? "three" : "two"} traits at ${ovr}`;
  if (traitCost(xs) > budgetOf(ovr)) return `traits worth ${traitCost(xs)} points, over the ${budgetOf(ovr)} a ${ovr} has`;
  return null;
}
