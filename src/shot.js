// A PART OF THE PAGE AS A PICTURE, FAST (user, 11 October 2026: "the copy image feature after full-time literally takes
// longer than screenshotting"). html-to-image copied every computed style onto every element: the full-time page came to
// a 21 MB picture that took about two seconds to build and decode, and a picture whose address has an apostrophe in it
// (Konohanasakuya Goshin'en's ground) was never embedded, so it came out blank. Here the copy keeps its own classes and
// inline styles and takes the page's stylesheets with it. Where it stood is rebuilt around it: its ancestors' classes (as
// boxless wrappers, so rules like `.ux-app svg.ux-i` still match), and its custom properties and inherited text styles.
// Only the pictures (img sources and background images) and the web fonts are embedded, each fetched once a session.
import { getFontEmbedCSS } from "html-to-image";

// A picture as a data URL, null when it does not load. Kept for the session: the same crests and faces come back.
const pics = new Map();
const dataURL = (url) => {
  if (!pics.has(url)) pics.set(url, fetch(url).then(r => (r.ok ? r.blob() : null)).then(b => (!b ? null : new Promise((res) => {
    const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => res(null); fr.readAsDataURL(b);
  }))).catch(() => null));
  return pics.get(url);
};

// Every url() in a CSS value, however it is quoted (a computed value quotes with ", and an address may hold a ').
const URLS = /url\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|([^)\s"']+))\s*\)/g;
const unescape = (s) => s.replace(/\\(.)/g, "$1");
// A background's layers with each picture embedded. A layer that will not load, or that repeats an earlier layer's
// picture (the stadium photos' fallback chain), becomes `none`.
async function inlineURLs(value) {
  const found = [...value.matchAll(URLS)];
  if (!found.length) return value;
  const seen = new Set(), subs = await Promise.all(found.map(m => dataURL(unescape(m[1] ?? m[2] ?? m[3]))));
  let out = "", at = 0;
  found.forEach((m, i) => {
    const d = subs[i], dup = d && seen.has(d); if (d) seen.add(d);
    out += value.slice(at, m.index) + (d && !dup ? `url("${d}")` : "none"); at = m.index + m[0].length;
  });
  return out + value.slice(at);
}

// The page's own rules, but its @font-face rules (embedded apart, with their files).
function sheetCSS() {
  const out = [];
  for (const s of document.styleSheets) {
    let rules; try { rules = s.cssRules; } catch { continue; }
    for (const r of rules) if (r.type !== CSSRule.FONT_FACE_RULE) out.push(r.cssText);
  }
  return out.join("\n");
}
let fonts = null;
const fontCSS = (el) => (fonts ||= getFontEmbedCSS(el).catch(() => ""));

// What a copy cut out of the page has to be given by hand: the text styles it inherited, and the custom properties.
const INHERITED = ["color", "font-family", "font-size", "font-style", "font-weight", "font-stretch", "font-variant", "font-feature-settings",
  "font-variation-settings", "font-kerning", "line-height", "letter-spacing", "word-spacing", "text-align", "text-transform", "text-rendering",
  "white-space", "direction", "-webkit-font-smoothing", "word-break", "overflow-wrap", "tab-size", "hyphens", "visibility"];
const BG = ["background-image", "mask-image", "-webkit-mask-image", "border-image-source", "list-style-image"];

// Fetches what a part of the page shows ahead of time, so the first picture taken of it does not wait on the network.
export function shotWarm(el) {
  if (!el) return;
  fontCSS(el);
  for (const im of el.querySelectorAll("img")) { const s = im.currentSrc || im.src; if (s && !s.startsWith("data:")) dataURL(s); }
}

// The element as a PNG: `width` x `height` CSS pixels drawn at `scale`, its own position overridden by `rootStyle`.
export async function shotBlob(el, { width, height, scale = 1, rootStyle = {}, background } = {}) {
  const fontText = fontCSS(el);
  const copy = el.cloneNode(true);
  for (const [k, v] of Object.entries(rootStyle)) copy.style.setProperty(k.replace(/[A-Z]/g, c => "-" + c.toLowerCase()), v);
  // Pictures and backgrounds, walking the page and the copy together.
  const jobs = [];
  const walk = (o, c) => {
    if (o.tagName === "IMG") {
      const s = o.currentSrc || o.src; c.removeAttribute("srcset"); c.removeAttribute("loading");
      if (s && !s.startsWith("data:")) jobs.push(dataURL(s).then(d => { if (d) c.setAttribute("src", d); else c.removeAttribute("src"); }));
    } else if (o.tagName === "CANVAS") {
      const im = document.createElement("img"); im.src = o.toDataURL(); im.className = o.className; im.style.cssText = o.style.cssText;
      im.width = o.width; im.height = o.height; c.replaceWith(im); return;
    } else if (o.tagName === "INPUT" || o.tagName === "TEXTAREA") c.setAttribute("value", o.value);
    const cs = getComputedStyle(o);
    for (const p of BG) { const v = cs.getPropertyValue(p); if (v && v.includes("url(")) jobs.push(inlineURLs(v).then(x => c.style.setProperty(p, x))); }
    for (let i = 0; i < o.children.length; i++) walk(o.children[i], c.children[i]);
  };
  walk(el, copy);
  // Where it stood: each ancestor's classes and data attributes on a box-less wrapper, innermost last.
  let inner = copy;
  for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
    const w = document.createElement("div");
    if (a.className && typeof a.className === "string") w.className = a.className;
    for (const at of a.attributes) if (at.name.startsWith("data-")) w.setAttribute(at.name, at.value);
    w.style.display = "contents"; w.appendChild(inner); inner = w;
  }
  const root = document.createElement("div"), ps = getComputedStyle(el.parentElement || el), es = getComputedStyle(el);
  for (const at of document.documentElement.attributes) if (at.name.startsWith("data-")) root.setAttribute(at.name, at.value);
  for (const p of INHERITED) root.style.setProperty(p, ps.getPropertyValue(p));
  for (let i = 0; i < es.length; i++) if (es[i].startsWith("--")) root.style.setProperty(es[i], es.getPropertyValue(es[i]));
  root.style.width = width + "px"; root.style.height = height + "px"; root.style.overflow = "hidden";
  if (background) root.style.background = background;
  const style = document.createElement("style");
  root.appendChild(style); root.appendChild(inner);
  await Promise.all(jobs);
  style.textContent = (await fontText) + "\n" + sheetCSS();
  const xhtml = new XMLSerializer().serializeToString(root);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject x="0" y="0" width="100%" height="100%">${xhtml}</foreignObject></svg>`;
  const img = new Image();
  img.decoding = "sync";
  await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error("the picture did not draw")); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg); });
  const cv = document.createElement("canvas");
  cv.width = Math.round(width * scale); cv.height = Math.round(height * scale);
  const cx = cv.getContext("2d"); cx.scale(scale, scale); cx.drawImage(img, 0, 0, width, height);
  return new Promise((res, rej) => cv.toBlob(b => (b ? res(b) : rej(new Error("no picture"))), "image/png"));
}
