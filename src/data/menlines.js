// NEW MEN BY THE LINE (Moukden and Kirin, 13 October 2026): "(OVR) Name SURNAME, Position, Age, Badge 1, Badge 2, Badge 3",
// and nothing but the name needed. The Sheet (a line, or each cell of a row copied from a sheet), the New Player form's
// Many list and a founding club's Import (src/App.tsx) all read a man this way.
import { BADGES } from "./badges.js";
import { POSITIONS } from "./positions.js";

const fold = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const TRAIT = new Map(BADGES.flatMap(b => [[fold(b.name), b.id], [fold(b.id), b.id]]));
// A trait by its name as people write it ("Quick Step", "quick-step", "QUICKSTEP"), or null.
export const traitOf = (s) => TRAIT.get(fold(s)) || null;
const posOf = (s) => (POSITIONS.includes(String(s).toUpperCase()) ? String(s).toUpperCase() : null);

// One man: his rating in brackets before the name; then, after the name, each field told by what it is: a position (one
// or two), an age (14 to 60) or a trait (at most three). A cell as the registry writes a man reads too ("(76) Cihan
// KARTACA [SEL]": his nation in brackets after the name; a tier mark, [*] or [+], dropped). A name may carry commas of
// its own, so the fields before the first that reads as one of these are all name. The surname goes in capitals unless a
// word of the name already is. { man: { name, ovr, nat, pos, age, badges }, bad: [what could not be read] }, or null for
// a line with no name.
export function readManLine(line) {
  const s = String(line ?? "").replace(/\s*\[[*+]\]/g, "").trim();
  const head = s.match(/^\((\d+)\)\s*/), parts = (head ? s.slice(head[0].length) : s).split(",").map(x => x.trim());
  const known = (x) => !!(posOf(x) || /^\d+$/.test(x) || traitOf(x));
  let at = parts.findIndex((x, i) => i > 0 && known(x));
  if (at < 0) at = parts.length;
  let name = parts.slice(0, at).join(", ").replace(/\s+/g, " ").trim(), nat = null;
  const tag = name.match(/\s*\[([A-Za-z]{2,4})\]$/);
  if (tag) { nat = tag[1].toUpperCase(); name = name.slice(0, -tag[0].length).trim(); }
  if (!name) return null;
  const bad = [], pos = [], badges = [];
  let age = null;
  const ovr = head ? +head[1] : null;
  if (ovr != null && !(ovr >= 25 && ovr <= 99)) bad.push("a rating is 25 to 99");
  if (name.length > 60) bad.push("a name is at most 60 letters");
  if (/[[\]()]/.test(name)) bad.push(`"${name}" is not a name`);
  for (const x of parts.slice(at)) {
    if (!x) continue;
    const p = posOf(x), t = traitOf(x);
    if (p) { if (pos.includes(p)) continue; if (pos.length === 2) bad.push("a player has one or two positions"); else pos.push(p); }
    else if (/^\d+$/.test(x)) { if (age != null) bad.push("a man has one age"); else if (+x < 14 || +x > 60) bad.push("an age is 14 to 60"); else age = +x; }
    else if (t) { if (badges.includes(t)) continue; if (badges.length === 3) bad.push("at most three traits"); else badges.push(t); }
    else bad.push(`"${x}" is not a position, an age or a trait`);
  }
  const words = name.split(" "), caps = words.some(w => /\p{L}/u.test(w) && w === w.toUpperCase() && w.length > 1);
  if (!caps && words.length > 1) words[words.length - 1] = words[words.length - 1].toUpperCase();
  return { man: { name: words.join(" "), ovr, nat, pos, age, badges }, bad: [...new Set(bad)] };
}
