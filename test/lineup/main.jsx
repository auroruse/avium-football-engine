// Every shape at a run of pitch sizes, Grzegorz Brzęczyszczykiewicz in every place, drawn by the app's own UxLineup with
// the app's stylesheets; then every name line is measured against the pitch's edges and against everything the other
// men draw. ?one=<traits 0|1>,<pitch height>,<shape> draws one case alone for a picture.
import React from "react";
import ReactDOM from "react-dom/client";
import { UxLineup } from "../../src/App";
import { FPOS2 } from "../../src/engine/formations";
import "../../src/theme.css";
import "../../src/ui.css";

const SHAPES = Object.keys(FPOS2);
const HEIGHTS = [380, 420, 459, 500, 549, 600, 669, 740, 820];
const mono = { fontFamily: "'JetBrains Mono','Fira Code',monospace", fontVariantNumeric: "tabular-nums" };
const WARN = (<span className="ux-pl-warn"><svg className="ux-warn-i" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M10.27 3.5a2 2 0 0 1 3.46 0l8.66 15a2 2 0 0 1-1.73 3H3.34a2 2 0 0 1-1.73-3z" fill="#e5484d" /></svg></span>);
const rtg = (oop) => (<span className={"ux-pl-rtg" + (oop ? " ux-oop" : "")}
  style={{ background: "linear-gradient(#e8d27a,#b8962e)", color: "#111", ...mono, boxShadow: (oop ? "0 0 0 2px var(--ux-loss), " : "") + "inset 0 1px 0 rgba(255,255,255,0.5)" }}>
  84{oop && <span className="ux-pl-drop">-5</span>}</span>);
const menFor = (fm, traits, name) => FPOS2[fm].map((_, i) => { const oop = i % 4 === 2;
  return { first: name[0], last: name[1], label: name.join(" "), shot: name.join(" "), code: i === 0 ? "GK" : "BWM", codeTitle: "",
    clr: "var(--ui-ok)", oop, rtg: rtg(oop), warn: oop ? WARN : null, traits: traits ? ["finisher", "relentless", "crosser"] : null, onClick: () => {} }; });
const LONG = ["Grzegorz", "Brzęczyszczykiewicz"], SHORT = ["Jo", "Kim"];

function Case({ traits, h, fm, name = LONG }) {
  const w = Math.floor(h * 0.75);
  return (
    <div className="case" data-case={`${traits ? "traits" : "bare"}|${h}|${fm}|${name[1]}`}
      style={{ display: "flex", flexDirection: "column", width: w + 24, height: h + 14, flex: "none" }}>
      <UxLineup slots={FPOS2[fm]} men={menFor(fm, traits, name)} />
    </div>);
}

const one = new URLSearchParams(location.search).get("one");
const cases = one ? [one.split(",")].map(([t, h, fm]) => ({ traits: t === "1", h: +h, fm }))
  : [0, 1].flatMap(t => HEIGHTS.flatMap(h => SHAPES.map(fm => ({ traits: !!t, h, fm }))));
// A few with a short name too: a name that fits must not slide.
const shorts = one ? [] : SHAPES.map(fm => ({ traits: true, h: 549, fm, name: SHORT }));

ReactDOM.createRoot(document.getElementById("root")).render(
  <div className="app-root" style={{ fontFamily: "var(--chrome-font)", background: "var(--chrome-bg)", color: "var(--ui-text)" }}>
    <div className="ux-app" style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: 8, alignItems: "flex-start", height: "auto" }}>
      {[...cases, ...shorts].map((c, i) => <Case key={i} {...c} />)}
    </div></div>);

const R = (el) => el.getBoundingClientRect();
const grow = (r, d) => ({ left: r.left - d, right: r.right + d, top: r.top - d, bottom: r.bottom + d });
const hit = (a, b) => { const x = Math.min(a.right, b.right) - Math.max(a.left, b.left), y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return x > 0.5 && y > 0.5 ? Math.round(Math.min(x, y) * 10) / 10 : 0; };
const hitCircle = (r, c) => { const px = Math.max(r.left, Math.min(c.x, r.right)), py = Math.max(r.top, Math.min(c.y, r.bottom));
  const d = c.r - Math.hypot(px - c.x, py - c.y); return d > 0.5 ? Math.round(d * 10) / 10 : 0; };

function measure() {
  const out = [];
  for (const el of document.querySelectorAll(".case")) {
    const [kind, h, fm, who] = el.dataset.case.split("|"), P = R(el.querySelector(".ux-pitch"));
    const men = [...el.querySelectorAll(".ux-pl")].map(m => {
      const t = R(m.querySelector(".ux-pl-tok"));
      const parts = [["rating", m.querySelector(".ux-pl-rtg"), m.querySelector(".ux-pl-rtg.ux-oop") ? 2 : 0], ["place", m.querySelector(".ux-pl-pos"), 0],
        ["warning", m.querySelector(".ux-pl-warn"), 0], ["cost", m.querySelector(".ux-pl-drop"), 2],
        ...[...m.querySelectorAll(".ux-pl-tr img")].map(im => ["trait", im, 0])].filter(([, e]) => e).map(([k, e, d]) => [k, grow(R(e), d)]);
      const lines = [...m.querySelectorAll(".ux-pl-first > div, .ux-pl-last > div")].map(b => { const br = R(b), sr = R(b.firstElementChild);
        return { b, r: br, ink: { left: Math.max(br.left, sr.left), right: Math.min(br.right, sr.right), top: br.top, bottom: br.bottom }, first: !!b.closest(".ux-pl-first") }; });
      return { circle: { x: (t.left + t.right) / 2, y: (t.top + t.bottom) / 2, r: t.width / 2 }, parts, lines, lane: parseFloat(m.querySelector(".ux-pl-label").style.maxWidth) || null };
    });
    const rec = { kind, h: +h, fm, who, edge: [], names: [], bodies: [], slide: [], lanes: men.map(m => m.lane), sliding: 0, outside: [] };
    men.forEach((m, i) => {
      m.lines.forEach(L => {
        const r = L.r;
        if (r.left < P.left - 0.5 || r.right > P.right + 0.5) rec.edge.push([i, Math.round(Math.max(P.left - r.left, r.right - P.right) * 10) / 10]);
        const span = L.b.firstElementChild, over = span.scrollWidth - L.b.clientWidth, sl = L.b.classList.contains("slide-fade");
        if (sl) rec.sliding++;
        if ((over > 0.5 && !sl) || (over <= 0 && sl)) rec.slide.push([i, L.first ? "first" : "last", over]);
        men.forEach((o, j) => { if (j === i) return;
          for (const L2 of o.lines) { const d = hit(r, L2.r); if (d) rec.names.push([i, j, d]); }
          const dc = hitCircle(L.ink, o.circle); if (dc) rec.bodies.push([i, j, L.first ? "first" : "last", "circle", dc]);
          for (const [k, pr] of o.parts) { const d = hit(L.ink, pr); if (d) rec.bodies.push([i, j, L.first ? "first" : "last", k, d]); }
        });
      });
      for (const [k, pr] of m.parts) if (pr.left < P.left - 0.5 || pr.right > P.right + 0.5 || pr.top < P.top - 0.5 || pr.bottom > P.bottom + 0.5) rec.outside.push([i, k]);
      const c = m.circle; if (c.x - c.r < P.left - 0.5 || c.x + c.r > P.right + 0.5 || c.y - c.r < P.top - 0.5 || c.y + c.r > P.bottom + 0.5) rec.outside.push([i, "circle"]);
    });
    out.push(rec);
  }
  return out;
}
(async () => {
  await document.fonts.ready;
  for (let k = 0; k < 6; k++) await new Promise(r => requestAnimationFrame(() => r()));
  await new Promise(r => setTimeout(r, 1500));
  window.__report = measure();
  window.__done = true;
})();
