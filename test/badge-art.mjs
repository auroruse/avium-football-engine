// PLAYER BADGE ART. One SVG per badge in ME_BADGES (src/engine/config.ts): its own icon, struck in white on the metal of
// its tier -- the same gold, silver and copper the OVR chips are struck in (App.tsx OVR_METAL), with the same white ink
// and shadow -- and the tier marked again in pips along the foot, so colour is never the only signal.
//   node test/badge-art.mjs [outDir=public/player-badges] [sheet.svg]
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const METAL = {
  gold:   { hi: "#f2d067", mid: "#b5860f", lo: "#5f4405", pips: 3 },
  silver: { hi: "#cdd5dd", mid: "#8b949c", lo: "#4d555c", pips: 2 },
  bronze: { hi: "#e0a071", mid: "#a05f2c", lo: "#4f2a12", pips: 1 },
};
// The tiers as measured (8 Oct 2026, five cloud runs pooled): worth to the man who carries the badge.
import { TIER, NAME } from "../src/data/badges.js";   // the one table: the app reads it too
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
};

export function badgeSvg(id, tier = TIER[id], px = 128) {
  const m = METAL[tier], g = `m${tier}`, sh = `s${tier}`;
  const pipX = (n, k) => 50 + (k - (n - 1) / 2) * 7.5;
  const pips = Array.from({ length: m.pips }, (_, k) => `<circle cx="${f(pipX(m.pips, k))}" cy="85.5" r="2.4" fill="${INK}"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${px}" height="${px}" role="img" aria-label="${NAME[id]} (${tier})">
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
  for (const id of Object.keys(ICON)) writeFileSync(join(out, `${id}.svg`), badgeSvg(id) + "\n");
  if (sheet) {
    const ids = Object.keys(TIER), cols = 5, cw = 172, ch = 172;
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
