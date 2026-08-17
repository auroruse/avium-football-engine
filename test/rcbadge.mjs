// THE REPLAY COUNTER. Two things to be right about, and neither shows up in a build:
//   the COUNT -- one per kickoff of that exact fixture, second legs kept apart from first, and
//     surviving a reload through the checksummed store
//   the DRAWING -- setting canvas.width to fit the text also wipes the context, so a font set
//     before the resize is gone by the time anything is drawn with it. That is invisible in code
//     review and looks like "the font just isn't applying" in a browser.
// Both are driven out of the shipped source rather than re-implemented here.
import fs from "node:fs";
const SRC = fs.readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

let fails = 0;
const ok = (name, cond, got) => {
  if (!cond) { fails++; console.log("  FAIL  " + name + (got === undefined ? "" : "   " + JSON.stringify(got))); }
  else console.log("  ok    " + name + (got === undefined ? "" : "   " + JSON.stringify(got)));
};

// ── 1. THE COUNT ─────────────────────────────────────────────────────────────
// _rc and fixtureKey, lifted whole. localStorage is stubbed so the persistence path is exercised
// rather than skipped.
const store = {};
const rcSrc = SRC.slice(SRC.indexOf("const _rc = (() => {"), SRC.indexOf("\n})();", SRC.indexOf("const _rc = (() => {")) + 6);
const fkSrc = SRC.slice(SRC.indexOf("function fixtureKey(t)"));
const { _rc, fixtureKey } = new Function("localStorage", `
  ${rcSrc}
  ${fkSrc.slice(0, fkSrc.indexOf("\n") + 1)}
  return { _rc, fixtureKey };`)({
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  });

console.log("the count");
const key = (t) => fixtureKey(t) + (t.flipped ? "_L2" : "");
const g0 = { type: "group", gi: 0, ri: 0, mi: 0 };
const g1 = { type: "group", gi: 0, ri: 0, mi: 1 };
const k0 = { type: "ko", ri: 1, mi: 2, bracket: "wb" };
const k0L2 = { type: "ko", ri: 1, mi: 2, bracket: "wb", leg: 2, flipped: true };

ok("an unplayed fixture is zero", _rc.get(key(g0)) === 0, _rc.get(key(g0)));
_rc.inc(key(g0));
ok("the first kickoff is one",    _rc.get(key(g0)) === 1, _rc.get(key(g0)));
_rc.inc(key(g0)); _rc.inc(key(g0));
ok("two replays make three",      _rc.get(key(g0)) === 3, _rc.get(key(g0)));
ok("the fixture next to it is untouched", _rc.get(key(g1)) === 0, _rc.get(key(g1)));

_rc.inc(key(k0));
ok("a knockout counts on its own", _rc.get(key(k0)) === 1, _rc.get(key(k0)));
ok("the second leg is its own fixture", _rc.get(key(k0L2)) === 0,
   [key(k0), key(k0L2)]);
_rc.inc(key(k0L2)); _rc.inc(key(k0L2));
ok("...and counts separately",     _rc.get(key(k0)) === 1 && _rc.get(key(k0L2)) === 2,
   [_rc.get(key(k0)), _rc.get(key(k0L2))]);

// Reload: a fresh instance reads the same localStorage and must agree.
const reloaded = new Function("localStorage", `${rcSrc}\nreturn _rc;`)({
  getItem: (k) => (k in store ? store[k] : null), setItem: () => {}, removeItem: () => {},
});
ok("it survives a reload", reloaded.get(key(g0)) === 3 && reloaded.get(key(k0L2)) === 2,
   [reloaded.get(key(g0)), reloaded.get(key(k0L2))]);

// Tampered store: the checksum has to reject a hand-edited count rather than trust it.
store["aFe_rcs"] = JSON.stringify({ d: { [key(g0)]: 1 }, c: 12345 });
const tampered = new Function("localStorage", `${rcSrc}\nreturn _rc;`)({
  getItem: (k) => (k in store ? store[k] : null), setItem: () => {}, removeItem: () => {},
});
ok("a hand-edited store is refused", tampered.get(key(g0)) === 0, tampered.get(key(g0)));

// ── 2. THE DRAWING ───────────────────────────────────────────────────────────
// The effect body, run against a context that records what it was asked to do.
console.log("\nthe drawing");
const body = (() => {
  const i = SRC.indexOf("function RcBadge({ n, theme }) {");
  const a = SRC.indexOf("const cv = ref.current;", i);
  const b = SRC.indexOf("}, [n, theme]);", i);
  return SRC.slice(a, b);
})();

const draw = (n) => {
  const calls = [];
  const ctx = {
    _font: "", _fill: "", _ls: "",
    set font(v) { this._font = v; calls.push(["font", v]); },
    get font() { return this._font; },
    set fillStyle(v) { this._fill = v; },
    get fillStyle() { return this._fill; },
    set letterSpacing(v) { this._ls = v; },
    get letterSpacing() { return this._ls; },
    textBaseline: "",
    measureText: (t) => ({ width: t.length * 6 }),
    setTransform: (...a) => calls.push(["setTransform", ...a]),
    clearRect: (...a) => calls.push(["clearRect", ...a]),
    fillText: function (t, x, y) { calls.push(["fillText", t, Math.round(x), this._fill, this._font]); },
  };
  const cv = {
    style: {}, _w: 0, _h: 0,
    get width() { return this._w; },
    // Setting width is what wipes the context in a real canvas; the stub does the same so a font
    // set before the resize cannot silently survive into the drawing.
    set width(v) { this._w = v; ctx._font = ""; ctx._fill = ""; ctx.textBaseline = ""; calls.push(["resize", v]); },
    get height() { return this._h; },
    set height(v) { this._h = v; },
    getContext: () => ctx,
  };
  new Function("n", "ref", "window", "getComputedStyle", body)(
    n, { current: cv }, { devicePixelRatio: 2 },
    () => ({ getPropertyValue: (k) => ({ "--chrome-muted": " #8a8a8a ", "--ui-warn": " #d9a441 " })[k] || "" }));
  return { calls, cv, texts: calls.filter(c => c[0] === "fillText") };
};

{
  const { calls, cv, texts } = draw(1);
  const resizeAt = calls.findIndex(c => c[0] === "resize");
  const firstText = calls.findIndex(c => c[0] === "fillText");
  ok("it resizes before it draws", resizeAt >= 0 && resizeAt < firstText, [resizeAt, firstText]);
  ok("every fillText has a font",  texts.every(t => t[4]), texts.map(t => t[4]));
  ok("the label is drawn",         texts.some(t => t[1] === "PLAYED LIVE"));
  ok("the count is drawn",         texts.some(t => t[1] === "×1"));
  ok("the count sits after the label", texts[1][2] > texts[0][2], texts.map(t => t[2]));
  ok("device pixels, not css pixels", cv.width === Math.round(parseInt(cv.style.width) * 2),
     [cv.width, cv.style.width]);
  ok("colours come from the stylesheet", texts.every(t => /^#/.test(t[3])), texts.map(t => t[3]));
  ok("played once is muted",       texts[1][3] === "#8a8a8a", texts[1][3]);
}
{
  const { texts } = draw(3);
  ok("played again is flagged",    texts[1][3] === "#d9a441", texts[1][3]);
  ok("...and says how many",       texts[1][1] === "×3", texts[1][1]);
}
{
  const { cv } = draw(1), wide = draw(12);
  ok("the box grows with the number", wide.cv.width > cv.width, [cv.width, wide.cv.width]);
}

console.log(fails ? "\n" + fails + " FAILED" : "\nall passed");
process.exit(fails ? 1 : 0);
