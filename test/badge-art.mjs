// PLAYER BADGE ART. One SVG per badge in ME_BADGES (src/engine/config.ts) per level: its own icon, struck in white on
// the metal of its level -- the same gold, silver and copper the OVR chips are struck in (App.tsx OVR_METAL), with the
// same white ink and shadow -- and the level marked again in pips along the foot, so colour is never the only signal.
// A flaw is struck in a dull red iron with hollow pips. Written as <id>-<level>.svg, and <id>.svg at the trait's std.
//   node test/badge-art.mjs [outDir=public/player-badges] [sheet.svg]
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const METAL = {
  gold:   { hi: "#f2d067", mid: "#b5860f", lo: "#5f4405", pips: 3 },
  silver: { hi: "#cdd5dd", mid: "#8b949c", lo: "#4d555c", pips: 2 },
  bronze: { hi: "#e0a071", mid: "#a05f2c", lo: "#4f2a12", pips: 1 },
  flaw:   { hi: "#c9807a", mid: "#8a3630", lo: "#3f1512", pips: 0 },
};
// The tiers as measured (8 Oct 2026, five cloud runs pooled): worth to the man who carries the badge.
import { BADGES, BADGE_BY_ID, LEVEL_TIER, TIER, NAME, maxLevelOf } from "../src/data/badges.js";   // the one table: the app reads it too
export { TIER, NAME };

const W = 5.2, INK = "#ffffff", DARK = "#1d2026";
const f = (n) => +n.toFixed(2);
const hex = (r) => [-90, -30, 30, 90, 150, 210].map(a => [50 + r * Math.cos(a * Math.PI / 180), 50 + r * Math.sin(a * Math.PI / 180)]);
const poly = (pts) => "M" + pts.map(([x, y]) => `${f(x)} ${f(y)}`).join(" L") + " Z";
const line = (d, w = W, extra = "") => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${extra}/>`;
const dash = (d, w = 4) => line(d, w, ` stroke-dasharray="5 4.6"`);
const fill = (d) => `<path d="${d}" fill="${INK}"/>`;
const dot = (x, y, r) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${INK}"/>`;
const ring = (x, y, r, w = W) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="none" stroke="${INK}" stroke-width="${w}"/>`;
// The ball: white, with the dark pentagon that makes it a football at any size.
const ball = (x, y, r) => {
  const p = [0, 1, 2, 3, 4].map(k => { const a = (-90 + k * 72) * Math.PI / 180; return [x + 0.42 * r * Math.cos(a), y + 0.42 * r * Math.sin(a)]; });
  return `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${INK}"/><path d="${poly(p)}" fill="${DARK}"/>`;
};
// An open arrowhead on the end of a line, pointing along (dx, dy).
const head = (x, y, dx, dy, len = 8.5, spread = 0.62, w = W) => {
  const l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l, c = Math.cos(spread), s = Math.sin(spread);
  const a = [x - len * (ux * c - uy * s), y - len * (uy * c + ux * s)], b = [x - len * (ux * c + uy * s), y - len * (uy * c - ux * s)];
  return line(`M${f(a[0])} ${f(a[1])} L${f(x)} ${f(y)} L${f(b[0])} ${f(b[1])}`, w);
};

const ICON = {
  // The ball in the top corner.
  finisher: () => [
    `<g opacity="0.5">${["M38 31 V70", "M50 31 V70", "M62 31 V70", "M27 44 H73", "M27 57 H73"].map(d => line(d, 1.6)).join("")}</g>`,
    line("M26 71 V30 H74 V71"), ball(61, 42, 8.5)].join(""),
  // Into the passing lane: the ball between two men, cut out from above.
  interceptor: () => [dot(26, 64, 4.6), dot(74, 64, 4.6), dash("M34 64 H44"), dash("M56 64 H66"),
    line("M50 26 V55"), head(50, 57, 0, 1), ring(50, 64, 3.2, 3)].join(""),
  // Past their last line.
  rapid: () => [`<g opacity="0.75">${dash("M54 24 V76", 2.6)}</g>`, line("M21 52 H29", 3.4), line("M19 60 H28", 3.4), line("M21 68 H29", 3.4),
    line("M33 64 Q52 58 69 35"), head(70.5, 33, 0.62, -0.79)].join(""),
  // Up for it.
  aerial: () => [ball(50, 30, 7.6), line("M40 41 L37 38", 3.2), line("M60 41 L63 38", 3.2), dot(50, 55, 8.5), line("M32 76 Q50 61 68 76")].join(""),
  // The burst.
  quickstep: () => [line("M23 41 H31", 3.4), line("M20 50 H31", 3.4), line("M23 59 H31", 3.4),
    line("M38 32 L55 50 L38 68"), line("M55 32 L72 50 L55 68")].join(""),
  // In the way of it.
  blocker: () => [line("M56 27 L73 33 V49 Q73 65 56 74 Q39 65 39 49 V33 Z"), `<path d="M56 34 L67 38 V49 Q67 60 56 67 Q45 60 45 49 V38 Z" fill="${INK}" opacity="0.28"/>`,
    ball(27, 49, 7), line("M34 38 L37.5 41.5", 3.2), line("M34 60 L37.5 56.5", 3.2)].join(""),
  // The target man: strength.
  strong: () => [`<rect x="22" y="36" width="9" height="28" rx="3" fill="${INK}"/>`, `<rect x="69" y="36" width="9" height="28" rx="3" fill="${INK}"/>`,
    `<rect x="31.5" y="41" width="6" height="18" rx="2.5" fill="${INK}"/>`, `<rect x="62.5" y="41" width="6" height="18" rx="2.5" fill="${INK}"/>`,
    line("M38 50 H62", 5.6)].join(""),
  // Never stops.
  relentless: () => [line("M50 50 C44 37.5 28 37.5 28 50 C28 62.5 44 62.5 50 50 C56 37.5 72 37.5 72 50 C72 62.5 56 62.5 50 50 Z")].join(""),
  // Takes him on.
  trickster: () => [ball(25, 68, 6), line("M31 61 L41 44 L52 60 L64 38"), head(65.5, 35.5, 0.5, -0.87)].join(""),
  // Sees it.
  vision: () => [line("M22 50 Q50 25 78 50 Q50 75 22 50 Z"), dot(50, 50, 10), `<circle cx="50" cy="50" r="4.2" fill="${DARK}"/>`,
    `<circle cx="53.5" cy="46.5" r="1.8" fill="${INK}"/>`].join(""),
  // Between them.
  incisive: () => [`<rect x="27" y="36" width="8" height="28" rx="4" fill="${INK}"/>`, `<rect x="65" y="36" width="8" height="28" rx="4" fill="${INK}"/>`,
    line("M46 73 L52.6 31"), head(53, 28, 0.15, -0.99)].join(""),
  // Clean.
  disciplined: () => [`<g transform="rotate(-10 50 49)"><rect x="34" y="26" width="32" height="46" rx="5" fill="none" stroke="${INK}" stroke-width="${W}"/></g>`,
    line("M41 50 L48 57 L60 41")].join(""),
  // From range.
  longshot: () => [`<g opacity="0.5">${["M64.7 41 V60", "M71.3 41 V60", "M58 50.5 H78"].map(d => line(d, 1.4)).join("")}</g>`, line("M58 61 V40 H78 V61", 4),
    dash("M33 61 Q42 20 66 45", 4), ball(28, 66, 6.6)].join(""),
  // Kills it.
  firsttouch: () => [ball(53, 33, 8.2), `<g opacity="0.6">${line("M40 41 Q53 49 66 41", 3)}</g>`,
    fill("M23 67 V60 Q23 55 28 55 H44 Q49 55 52 51 L56 46 Q58 43 62 44 L71 46.5 Q76 48 76 53 V61 Q76 67 70 67 Z"),
    dot(30, 69.5, 2), dot(40, 69.5, 2), dot(60, 69.5, 2), dot(69, 69.5, 2)].join(""),
  // Early, from deep.
  crosser: () => [ball(26, 70, 6), line("M30 63 Q32 33 64 33"), head(66, 33, 1, 0)].join(""),
  // Short and simple.
  tikitaka: () => [dot(50, 29, 6), dot(29, 65, 6), dot(71, 65, 6),
    line("M35 57 L45 39", 4), head(46, 37, 0.5, -0.87, 7, 0.62, 4), line("M55 37 L65 55", 4), head(66, 57, 0.5, 0.87, 7, 0.62, 4),
    line("M63 65 H38", 4), head(36, 65, -1, 0, 7, 0.62, 4)].join(""),
  // Over the wall.
  deadball: () => [`<rect x="44" y="47" width="6" height="22" rx="3" fill="${INK}"/>`, `<rect x="52" y="47" width="6" height="22" rx="3" fill="${INK}"/>`,
    `<rect x="60" y="47" width="6" height="22" rx="3" fill="${INK}"/>`, ball(26, 68, 6.4), dash("M31 61 Q38 22 69 33", 4), head(71, 34, 0.9, 0.42, 7.5, 0.62, 4)].join(""),
  // Calm inside it.
  composed: () => [ring(50, 50, 16, 3.6), ball(50, 50, 8.2),
    ...[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => line(`M${50 + sx * 26} ${50 + sy * 26} L${50 + sx * 17.5} ${50 + sy * 17.5}`, 3.8) +
      head(50 + sx * 15.5, 50 + sy * 15.5, -sx, -sy, 6.5, 0.62, 3.8))].join(""),
  // Off his line.
  commanding: () => [`<g opacity="0.5">${["M39 66 V77", "M50 66 V77", "M61 66 V77"].map(d => line(d, 1.4)).join("")}</g>`, line("M28 77 V65 H72 V77", 4),
    dot(50, 30, 5.6), line("M29 33 L41 41 H59 L71 33"), line("M50 41 V50"), line("M42 58 L50 50 L58 58")].join(""),
  // Goes in.
  tackler: () => [line("M21 47 L29 51", 3.2), line("M21 57 L29 61", 3.2), line("M30 37 L53 59"), line("M49 65 L60 53"), ball(66, 62, 7.2)].join(""),
  // Across the pitch.
  longball: () => [`<g opacity="0.6">${line("M21 72 H79", 2.6)}</g>`, dash("M25 70 Q50 18 73 66", 4), head(74, 69, 0.42, 0.91, 7.5, 0.62, 4), ball(50, 44, 6.2)].join(""),
  // On his line, saves it.
  shotstopper: () => [ball(71, 29, 6.4),
    ...[38.5, 45.4, 52.3, 59.2].map(x => `<rect x="${x}" y="31" width="5.8" height="18" rx="2.9" fill="${INK}"/>`),
    `<rect x="37.5" y="44" width="28" height="23" rx="7" fill="${INK}"/>`,
    `<g transform="rotate(-38 33 56)"><rect x="29.5" y="46" width="7" height="17" rx="3.5" fill="${INK}"/></g>`,
    `<rect x="40" y="68.5" width="23" height="6" rx="2" fill="${INK}"/>`].join(""),
  // --- the Mind (22 November 2026) ---
  // Over his shoulder: a head, and the look that swings round behind it.
  shouldercheck: () => [dot(46, 44, 9), line("M26 76 Q46 58 66 76"), line("M60 34 Q78 34 76 54", 4), head(75.5, 57, -0.1, 1, 7.5, 0.62, 4)].join(""),
  // Gives it, and goes.
  passandmove: () => [dot(28, 66, 5.4), line("M36 64 L62 56", 4), head(65, 55, 0.95, -0.3, 7.5, 0.62, 4), ball(72, 53, 5.4),
    dash("M30 56 Q34 34 52 28", 4), head(55, 27, 0.95, -0.3, 7.5, 0.62, 4)].join(""),
  // The metronome.
  tempo: () => [line("M36 76 L45 28 H55 L64 76 Z"), line("M50 70 L62 38", 4), dot(60, 43, 4.4), line("M41 62 H59", 3)].join(""),
  // The shout.
  manon: () => [dot(30, 50, 8), line("M46 40 Q54 50 46 60", 4), line("M56 33 Q68 50 56 67", 4), line("M66 26 Q82 50 66 74", 4)].join(""),
  // --- the Keeper ---
  // In both hands.
  safehands: () => [ball(50, 42, 10.5), line("M27 40 Q27 68 50 68 Q73 68 73 40", 6.4)].join(""),
  // Off the palm, and wide.
  strongwrists: () => [`<rect x="40" y="28" width="9" height="44" rx="4.5" fill="${INK}"/>`, dash("M78 30 L54 46", 4), line("M54 54 L74 70", 4),
    head(76.5, 72, 0.78, 0.62, 7.5, 0.62, 4), ball(63, 39, 5.6)].join(""),
  // Out of his hands, early.
  quickrelease: () => [dot(27, 60, 6.4), line("M27 67 V78", 4), line("M30 55 L42 42", 4), line("M22 38 H30", 3.2), line("M19 46 H28", 3.2),
    dash("M46 38 Q62 22 76 42", 4), head(77.5, 45, 0.55, 0.83, 7.5, 0.62, 4), ball(46, 37, 5.6)].join(""),
  // Goes the right way.
  penstopper: () => [line("M22 72 V32 H78 V72", 4), dot(50, 76, 2.8), ball(33, 45, 7), `<rect x="43" y="36" width="7" height="20" rx="3.5" fill="${INK}"/>`,
    line("M60 60 L50 50", 3.4), `<g opacity="0.6">${dash("M50 72 L38 52", 3)}</g>`].join(""),
  // --- flaws ---
  // Eyes on the ball, and nothing else.
  ballwatcher: () => [line("M26 38 Q50 18 74 38 Q50 58 26 38 Z", 4.4), dot(50, 39, 7), `<circle cx="50" cy="41" r="3" fill="${DARK}"/>`,
    `<g opacity="0.7">${dash("M50 50 V60", 3)}</g>`, ball(50, 70, 7.4)].join(""),
  // Time runs.
  dwells: () => [line("M36 26 H64 L50 49 L64 72 H36 L50 49 Z", 4.6), fill("M43 66 H57 L50 56 Z"), ball(76, 68, 5.6)].join(""),
  // Up for it, under it.
  flaps: () => [ball(63, 27, 7.4), `<g opacity="0.7">${dash("M26 36 Q46 12 74 40", 3)}</g>`, line("M38 76 L44 46", 5), line("M56 76 L52 48", 5),
    line("M40 44 L36 38", 3.2), line("M53 45 L55 38", 3.2)].join(""),
  // Through his hands.
  spills: () => [line("M28 34 Q28 54 43 58", 6), line("M72 34 Q72 54 57 58", 6), ball(50, 70, 7.6), line("M44 54 L46 60", 3), line("M56 54 L54 60", 3)].join(""),
  // --- the Ball, the Body, Finishing, Defending (22 November 2026) ---
  // Two men on him, and he has it.
  pressresistant: () => [dot(50, 40, 7.5), ball(50, 60, 6.4), line("M18 50 H32", 4.4), head(34.5, 50, 1, 0, 7.5, 0.62, 4.4), line("M82 50 H68", 4.4), head(65.5, 50, -1, 0, 7.5, 0.62, 4.4),
    `<g opacity="0.7">${line("M36 72 Q50 79 64 72", 3)}</g>`].join(""),
  // In his stride.
  ontherun: () => [line("M19 42 H29", 3.4), line("M16 51 H28", 3.4), line("M19 60 H29", 3.4), dot(41, 46, 7), line("M41 54 L47 66", 4.4), ball(56, 68, 5.6),
    line("M62 63 L77 44", 4.4), head(78.5, 42, 0.62, -0.79, 7.5, 0.62, 4.4)].join(""),
  // Shapes one way, plays the other.
  disguise: () => [dot(27, 64, 5.6), `<g opacity="0.75">${dash("M34 58 L60 36", 3.6)}</g>`, `<g opacity="0.75">${head(62.5, 34, 0.76, -0.65, 6.5, 0.62, 3.2)}</g>`,
    line("M35 66 H68", 4.6), head(71, 66, 1, 0, 8, 0.62, 4.6)].join(""),
  // Up the pitch with it.
  drives: () => [`<g opacity="0.6">${line("M20 76 H62", 2.6)}</g>`, dot(32, 60, 6.8), ball(45, 67, 5.2), line("M52 60 L71 35", 5.2), head(72.8, 32.6, 0.6, -0.8)].join(""),
  // The whistle.
  drawsfoul: () => [`<circle cx="41" cy="57" r="13.5" fill="${INK}"/>`, `<circle cx="41" cy="57" r="5" fill="${DARK}"/>`, `<rect x="41" y="43.5" width="36" height="11" rx="3" fill="${INK}"/>`,
    line("M28 34 L24 27", 3.2), line("M41 31 V23", 3.2), line("M54 34 L58 27", 3.2)].join(""),
  // Still on his feet.
  ridestackles: () => [dot(55, 33, 7.4), line("M55 42 V60"), line("M55 60 L47 76"), line("M55 60 L65 76"), line("M19 71 L41 66", 5.6), ball(76, 71, 5.2)].join(""),
  // On the line, waiting.
  poacher: () => [`<g opacity="0.5">${["M38 28 V52", "M50 28 V52", "M62 28 V52", "M26 40 H74"].map(d => line(d, 1.6)).join("")}</g>`, line("M26 54 V28 H74 V54"),
    ball(50, 60, 6.2), dot(50, 74, 4.8)].join(""),
  // To the man who is free.
  squares: () => [line("M30 28 H70", 4.4), line("M30 28 V36", 4.4), line("M70 28 V36", 4.4), dot(27, 62, 6.4), dot(73, 62, 6.4), line("M36 62 H58", 4.4), head(61, 62, 1, 0, 7.5, 0.62, 4.4)].join(""),
  // Gets there.
  closesdown: () => [ball(71, 56, 5.4), dot(64, 44, 6.4), line("M18 50 H42", 5.2), head(45, 50, 1, 0), line("M24 34 L33 41", 3.2), line("M24 66 L33 59", 3.2)].join(""),
  // On the line, at full stretch.
  lastditch: () => [line("M74 24 V76", 4.6), `<g opacity="0.5">${line("M74 24 H82", 3)}</g>`, ball(60, 60, 6.4), line("M20 72 L50 63", 6.2), line("M52 50 L56 46", 3.2), line("M48 46 L49 40", 3.2)].join(""),
  // Nowhere to go.
  tightmarker: () => [dot(43, 50, 9.5), ring(59, 50, 10.5, 4.4), line("M28 30 L34 36", 3.2), line("M28 70 L34 64", 3.2)].join(""),
  // --- flaws ---
  // Away from him.
  heavytouch: () => [`<rect x="20" y="60" width="24" height="10" rx="4.5" fill="${INK}"/>`, `<g opacity="0.75">${dash("M40 56 Q54 26 68 38", 3.4)}</g>`, ball(73, 42, 6.6)].join(""),
  // To them.
  givesaway: () => [dot(26, 64, 5.8), line("M33 60 L58 46", 4.4), head(60.5, 44.6, 0.87, -0.5, 7.5, 0.62, 4.4), ring(71, 39, 7.6, 3.6), line("M66 34 L76 44", 3), line("M76 34 L66 44", 3)].join(""),
  // Nothing left.
  outoflegs: () => [line("M24 36 H68 V64 H24 Z", 4.6), `<rect x="69" y="44" width="6" height="12" rx="2" fill="${INK}"/>`, `<rect x="30" y="42" width="8" height="16" rx="1.5" fill="${INK}"/>`].join(""),
  // His, and nobody else's.
  greedy: () => [line("M34 24 H74", 4.4), line("M34 24 V32", 4.4), line("M74 24 V32", 4.4), dot(30, 68, 6.4), ball(41, 62, 4.8), line("M43 55 L52 36", 5), head(53, 33.4, 0.42, -0.9),
    `<g opacity="0.6">${ring(70, 66, 6, 3)}</g>`].join(""),
  // The red mist.
  hothead: () => [fill("M50 22 C57 35 69 42 67 58 C66 70 58 77 50 77 C42 77 34 70 33 58 C32 49 39 45 41 36 C45 43 48 40 50 22 Z"),
    `<path d="M50 50 C53 56 58 58 57 65 C56 70 53 72 50 72 C47 72 44 70 43 65 C43 60 47 58 50 50 Z" fill="${DARK}"/>`].join(""),
  // Gone.
  losesman: () => [dot(31, 62, 7), `<g opacity="0.7">${line("M41 62 H49", 3)}</g>`, ring(56, 46, 6.2, 3.4), line("M62 41 L75 30", 4.4), head(77, 28.2, 0.76, -0.65, 7.5, 0.62, 4.4),
    `<g opacity="0.7">${dash("M40 54 L48 50", 3)}</g>`].join(""),
};

export function badgeSvg(id, tier = BADGE_BY_ID[id].flaw ? "flaw" : TIER[id], px = 128, level = null) {
  const m = METAL[tier], g = `m${tier}`, sh = `s${tier}`, np = level ?? m.pips;
  const pipX = (n, k) => 50 + (k - (n - 1) / 2) * 7.5;
  const pips = Array.from({ length: np }, (_, k) => tier === "flaw"
    ? `<circle cx="${f(pipX(np, k))}" cy="85.5" r="2.1" fill="none" stroke="${INK}" stroke-width="1.3"/>`
    : `<circle cx="${f(pipX(np, k))}" cy="85.5" r="2.4" fill="${INK}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${px}" height="${px}" role="img" aria-label="${NAME[id]} (${tier === "flaw" ? "flaw " + np : tier})">
<defs>
<linearGradient id="${g}" x1="0.21" y1="0.09" x2="0.79" y2="0.91"><stop offset="0" stop-color="${m.hi}"/><stop offset="0.26" stop-color="${m.mid}"/><stop offset="0.5" stop-color="${m.lo}"/><stop offset="0.74" stop-color="${m.mid}"/><stop offset="1" stop-color="${m.hi}"/></linearGradient>
<filter id="${sh}" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="1" stdDeviation="0.9" flood-color="#000" flood-opacity="0.5"/></filter>
</defs>
<path d="${poly(hex(45))}" fill="${m.lo}" stroke="${m.lo}" stroke-width="7" stroke-linejoin="round"/>
<path d="${poly(hex(41))}" fill="url(#${g})" stroke="url(#${g})" stroke-width="4" stroke-linejoin="round"/>
<path d="${poly(hex(35.5))}" fill="none" stroke="${m.hi}" stroke-opacity="0.55" stroke-width="1.2" stroke-linejoin="round"/>
<g filter="url(#${sh})">${ICON[id]()}${pips}</g>
</svg>`;
}

if (fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const out = process.argv[2] || "public/player-badges", sheet = process.argv[3];
  mkdirSync(out, { recursive: true });
  for (const id of Object.keys(ICON)) {
    const b = BADGE_BY_ID[id];
    for (let lv = 1; lv <= maxLevelOf(id); lv++) writeFileSync(join(out, `${id}-${lv}.svg`), badgeSvg(id, b.flaw ? "flaw" : LEVEL_TIER[lv], 128, lv) + "\n");
    writeFileSync(join(out, `${id}.svg`), badgeSvg(id, b.flaw ? "flaw" : LEVEL_TIER[b.std], 128, b.std) + "\n");
  }
  if (sheet) {
    const ids = (process.env.SHEET_IDS ? process.env.SHEET_IDS.split(",") : Object.keys(TIER)), cols = +(process.env.SHEET_COLS || 5), cw = 172, ch = 172;
    const rows = Math.ceil(ids.length / cols);
    const cells = ids.map((id, i) => {
      const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
      const inner = badgeSvg(id).replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
      return `<g transform="translate(${x + 26} ${y + 10}) scale(1.2)">${inner}</g><text x="${x + cw / 2}" y="${y + 150}" text-anchor="middle" font-family="-apple-system, Helvetica, Arial" font-size="15" fill="#e8e9ec">${NAME[id]}</text>`;
    }).join("\n");
    writeFileSync(sheet, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cols * cw} ${rows * ch}" width="${cols * cw}" height="${rows * ch}"><rect width="100%" height="100%" fill="#16181d"/>\n${cells}\n</svg>\n`);
  }
  console.log(`wrote ${Object.keys(ICON).length} badges to ${out}`);
}
