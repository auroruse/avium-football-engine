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
