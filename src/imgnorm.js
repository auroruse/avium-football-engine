// PORTRAITS, EVENED OUT AS THEY ARE SHOWN (the user, 25 November 2026: "an in-app one that standardizes the display").
// The files stay as they were sent; each is read once, moved and scaled so the face sits where the house portraits put it,
// the same size and in the same place in every frame, and shown from that copy everywhere the app draws it. A browser
// cannot find a face, so where each one is comes from src/data/faces.json, written by the Mac's own face finder
// (swift test/faces.swift); a portrait not in it yet is shown as it came. Badges are shown as sent (the user, the same day).
import { useEffect, useState } from "react";
import FACES from "./data/faces.json";

// The house portrait: the face's centre and width as fractions of the frame, the medians of the 195 portraits on disk
// (25 November 2026). A face is never scaled by more than a quarter either way.
const FACE = { N: 500, cx: 0.5, cy: 0.486, w: 0.452, lo: 0.8, hi: 1.25 };

const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
const ctx = (c) => c.getContext("2d", { willReadFrequently: true });

// ── a portrait ──
// Its face, by the file it was read from: <world>/players/<name>.png.
export const faceOf = (url) => {
  const m = /([^/]+)\/players\/([^/?#]+)\.png(?:[?#].*)?$/.exec(String(url || ""));
  if (!m) return null;
  let n = m[2]; try { n = decodeURIComponent(n); } catch {}
  return FACES[m[1] + "/" + n.normalize("NFC")] || null;
};
export function normPortrait(im, f) {
  if (!f) return null;
  const nw = im.naturalWidth || im.width, nh = im.naturalHeight || im.height, N = FACE.N;
  const s = Math.max(FACE.lo, Math.min(FACE.hi, FACE.w / f[2]));
  const W = N * s, H = (nh / nw) * N * s, tx = FACE.cx * N - f[0] * W, ty = FACE.cy * N - f[1] * H;
  const out = canvas(N, N), g = ctx(out); g.imageSmoothingQuality = "high";
  g.drawImage(im, tx, ty, W, H);
  // a picture made smaller would show where it was cut off, at the foot and the sides: the shirt at its edge is drawn on
  // out to the frame's, so the shoulders still run off it
  const gl = Math.max(0, Math.ceil(tx)), gr = Math.max(0, Math.ceil(N - tx - W)), gb = Math.max(0, Math.ceil(N - ty - H));
  if (gb) g.drawImage(im, 0, nh - 1, nw, 1, tx, ty + H - 0.5, W, gb + 1);
  if (gl) { g.drawImage(im, 0, 0, 1, nh, 0, ty, gl + 0.5, H); if (gb) g.drawImage(im, 0, nh - 1, 1, 1, 0, ty + H - 0.5, gl + 0.5, gb + 1); }
  if (gr) { g.drawImage(im, nw - 1, 0, 1, nh, N - gr - 0.5, ty, gr + 0.5, H); if (gb) g.drawImage(im, nw - 1, nh - 1, 1, 1, N - gr - 0.5, ty + H - 0.5, gr + 0.5, gb + 1); }
  return out;
}

// ── the cache, and the hook every portrait goes through ──
// key -> a blob URL of the evened copy, the file's own URL when it could not be evened, or false when there is no file.
const DONE = new Map(), WAIT = new Map();
// The evened copies are kept in the browser between visits, each under its file's own version (its ETag, else when it was
// last changed), so a replaced file is evened again and only a first visit does the work. VER moves when the house standard
// or the method does.
const VER = "1";
const store = (() => { let p = null; return () => (p = p || (typeof caches === "undefined" ? Promise.resolve(null) : caches.open("avium-evened").catch(() => null))); })();
// One at a time, a frame apart, so a page of faces does not stall while it is evened.
const JOBS = [];
let pumping = false;
async function pump() {
  if (pumping) return; pumping = true;
  while (JOBS.length) { await JOBS.shift()(); await new Promise(r => setTimeout(r, 0)); }
  pumping = false;
}
const later = (fn) => new Promise(res => { JOBS.push(() => fn().then(res, () => res(null))); pump(); });
const toBlob = (c) => new Promise(res => c.toBlob(b => res(b), "image/webp", 0.92));
async function even(url, kind) {
  let r; try { r = await fetch(url); } catch { return false; }
  if (!r.ok || !(r.headers.get("content-type") || "").startsWith("image")) return false;
  const f = faceOf(url);
  if (!f) return url;                                        // a portrait whose face is not on file yet: as it came
  const tag = r.headers.get("etag") || r.headers.get("last-modified") || r.headers.get("content-length") || "";
  const base = location.origin + "/__evened/" + VER + "/" + kind + "/" + encodeURIComponent(url), key = base + "?" + encodeURIComponent(tag + (f ? "|" + f.join(",") : ""));
  const c = await store();
  try { const hit = c && await c.match(key); if (hit) return URL.createObjectURL(await hit.blob()); } catch {}
  let im; try { im = await createImageBitmap(await r.blob()); } catch { return url; }
  const out = await later(async () => { const cv = normPortrait(im, f); return cv ? toBlob(cv) : null; });
  if (!out) return url;
  if (c) { try { await c.delete(base, { ignoreSearch: true }); await c.put(key, new Response(out, { headers: { "content-type": out.type } })); } catch {} }
  return URL.createObjectURL(out);
}
export function normImg(url, kind) {
  if (!url) return Promise.resolve(false);
  const key = kind + "|" + url;
  if (DONE.has(key)) return Promise.resolve(DONE.get(key));
  if (WAIT.has(key)) return WAIT.get(key);
  const p = even(url, kind).catch(() => url).then(v => { DONE.set(key, v); WAIT.delete(key); return v; });
  WAIT.set(key, p);
  return p;
}
export const normPeek = (url, kind) => (url ? DONE.get(kind + "|" + url) : false);
// undefined while it is on its way, false when there is no file, else the URL to show
export function useNormImg(url, kind) {
  const [v, setV] = useState(() => normPeek(url, kind));
  useEffect(() => {
    const now = normPeek(url, kind); setV(now);
    if (now !== undefined) return;
    let live = true; normImg(url, kind).then(r => { if (live) setV(r); });
    return () => { live = false; };
  }, [url, kind]);
  return v;
}
// The first of several files that is there (a portrait's spellings, a league's names), evened out: the same three answers.
const FIRST = new Map();
export function normFirst(urls, kind) {
  const list = (urls || []).filter(Boolean), key = kind + "|" + list.join("|");
  if (FIRST.has(key)) return Promise.resolve(FIRST.get(key));
  return (async () => { for (const u of list) { const v = await normImg(u, kind); if (v) { FIRST.set(key, v); return v; } } FIRST.set(key, false); return false; })();
}
export const normFirstPeek = (urls, kind) => FIRST.get(kind + "|" + (urls || []).filter(Boolean).join("|"));
export function useNormFirst(urls, kind) {
  const key = (urls || []).filter(Boolean).join("|");
  const [v, setV] = useState(() => normFirstPeek(urls, kind));
  useEffect(() => {
    const now = normFirstPeek(urls, kind); setV(now);
    if (now !== undefined) return;
    let live = true; normFirst(urls, kind).then(r => { if (live) setV(r); });
    return () => { live = false; };
  }, [key, kind]);
  return v;
}
