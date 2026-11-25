// THE APP'S OWN DROPDOWN FOR A SHORT LIST (the user, 25 November 2026: "Why are some dropdowns still the browser ones and
// not our ones???"). A <Sel> is written exactly like a <select>, with its <option>s and <optgroup>s, and the select itself
// is still the field on the page, so every rule that sizes a select, and every handler on one, holds as before. What it
// stops is the browser's own list: a click, a touch, the arrows or space (and a showPicker() call, the Sheet's cell
// editors) open this list instead, drawn in the app's panel colours under the field, or over it near the window's foot.
// The focus stays on the select the whole time, so a form or a cell that closes on blur behaves as it did: the arrows
// move, Enter or space picks, Escape closes, and typing narrows the list. A list of more than ten has a search box at its
// head, focused as it opens, like the side and nation pickers (the user, the same day: "some of those drop downs need
// search bars. The registry filters at least"); the select counts as still focused while it is, so a Sheet cell does
// not close under it. A pick is written to the select and announced with a real change event, so onChange reads
// e.target.value as it always has.
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const fold = (x) => String(x).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const readOpts = (s) => [...s.options].map((o) => ({ v: o.value, l: o.textContent, g: o.parentElement?.tagName === "OPTGROUP" ? o.parentElement.label : null,
  off: o.disabled || !!o.parentElement?.disabled || o.hidden }));
const setValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
const ROW = 30, HEAD = 24, FIND_OVER = 10, FIND_H = 38;

export const Sel = forwardRef(function Sel({ onMouseDown, onKeyDown, onBlur, onTouchStart, onTouchEnd, children, ...rest }, ref) {
  const el = useRef(null), menu = useRef(null), inp = useRef(null), touch = useRef(null), showRef = useRef(null), openedAt = useRef(0);
  const [m, setM] = useState(null);                        // open: { opts, at, hi, q }
  const close = () => setM(null);
  // where the list stands: under the whole field (a select styled inside a .ux-pick is narrower than the box drawn round
  // it), or over it when the window's foot is nearer
  const place = (s, opts) => {
    const r = (s.closest(".ux-pick") || s).getBoundingClientRect(), heads = new Set(opts.map(o => o.g).filter(Boolean)).size, find = opts.length > FIND_OVER;
    const want = Math.min(find ? 380 : 330, opts.length * ROW + heads * HEAD + 10 + (find ? FIND_H : 0)), below = window.innerHeight - r.bottom - 10, above = r.top - 10;
    const width = Math.min(340, Math.max(r.width, find ? 220 : 150)), left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    const down = below >= Math.min(want, 200) || below >= above;
    return { left, minWidth: width, maxHeight: Math.max(120, Math.min(want, down ? below : above)), ...(down ? { top: r.bottom + 4 } : { bottom: window.innerHeight - r.top + 4 }) };
  };
  const show = () => {
    const s = el.current; if (!s || s.disabled) return;
    const opts = readOpts(s), at = place(s, opts);
    const cur = opts.findIndex(o => o.v === s.value);
    openedAt.current = performance.now(); setM({ opts, at, hi: Math.max(0, cur), q: "", find: opts.length > FIND_OVER });
  };
  showRef.current = show;
  const setRef = useCallback((node) => {
    el.current = node;
    if (node) node.showPicker = () => showRef.current();      // the Sheet's editors open their list as they appear
    if (typeof ref === "function") ref(node); else if (ref) ref.current = node;
  }, [ref]);
  const hit = (o, q) => fold(o.l).includes(fold(q)) || (!!o.g && fold(o.g).includes(fold(q)));
  const shown = m ? (m.q ? m.opts.filter(o => hit(o, m.q)) : m.opts) : [];
  // the focus back on the select from the search box, so a cell or form that closes on blur never sees it leave
  const back = () => el.current?.focus({ preventScroll: true, focusVisible: false });
  const pick = (o) => {
    const s = el.current; if (m?.find) back(); close(); if (!s || !o || o.off) return;
    if (s.value !== o.v) { setValue.call(s, o.v); s.dispatchEvent(new Event("change", { bubbles: true })); }
  };
  const step = (d) => setM(x => { if (!x) return x; const list = x.q ? x.opts.filter(o => hit(o, x.q)) : x.opts; if (!list.length) return x;
    let i = Math.min(x.hi, list.length - 1); for (let k = 0; k < list.length; k++) { i = (i + d + list.length) % list.length; if (!list[i].off) break; } return { ...x, hi: i }; });
  // a long list opens on its search box
  useEffect(() => { if (m?.find) inp.current?.focus({ preventScroll: true }); }, [!!m]);
  // the reached choice kept in view
  useEffect(() => { const L = menu.current; if (!m || !L) return; const e = L.querySelector('[data-hi="1"]'); if (e) e.scrollIntoView({ block: "nearest" }); }, [m?.hi, m?.q, !!m]);
  // the page scrolled or the window resized under it: the list follows its field (the Sheet scrolls a cell into view as
  // its editor opens)
  useEffect(() => {
    if (!m) return;
    const move = (e) => { if (menu.current && e.target instanceof Node && menu.current.contains(e.target)) return;
      const s = el.current; if (s) setM(x => (x ? { ...x, at: place(s, x.opts) } : x)); };
    window.addEventListener("scroll", move, true); window.addEventListener("resize", move);
    return () => { window.removeEventListener("scroll", move, true); window.removeEventListener("resize", move); };
  }, [!!m]);
  const kd = (e) => {
    if (m) {
      const k = e.key;
      if (k === "ArrowDown" || k === "ArrowUp") { e.preventDefault(); step(k === "ArrowDown" ? 1 : -1); }
      else if (k === "Enter" || (k === " " && !m.q)) { e.preventDefault(); e.stopPropagation(); pick(shown[Math.min(m.hi, shown.length - 1)]); }
      else if (k === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
      else if (k === "Tab") close();
      else if (k === "Backspace") { e.preventDefault(); setM(x => ({ ...x, q: x.q.slice(0, -1), hi: 0 })); }
      else if (k.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); setM(x => ({ ...x, q: x.q + k, hi: 0 })); }
      return;
    }
    onKeyDown?.(e); if (e.defaultPrevented) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === " ") { e.preventDefault(); show(); }
  };
  const md = (e) => {
    onMouseDown?.(e); if (e.defaultPrevented || e.button !== 0) return;
    e.preventDefault(); if (document.activeElement !== el.current) el.current?.focus({ preventScroll: true, focusVisible: false });
    // the second press of a double-click that opened it (a Sheet cell opens its list on the first) leaves it open
    if (m) { if (performance.now() - openedAt.current > 400) { if (m.find) back(); close(); } } else show();
  };
  const ts = (e) => { onTouchStart?.(e); const t = e.touches[0]; touch.current = t ? [t.clientX, t.clientY] : null; };
  const te = (e) => {
    onTouchEnd?.(e); const t = e.changedTouches[0], a = touch.current; touch.current = null;
    if (e.defaultPrevented || !t || !a || Math.hypot(t.clientX - a[0], t.clientY - a[1]) > 10) return;
    e.preventDefault(); el.current?.focus({ preventScroll: true, focusVisible: false }); if (m) close(); else show();
  };
  const inMenu = (x) => !!x && !!menu.current && menu.current.contains(x);
  const bl = (e) => { if (inMenu(e.relatedTarget)) return; close(); onBlur?.(e); };
  const fk = (e) => {
    const k = e.key;
    if (k === "ArrowDown" || k === "ArrowUp") { e.preventDefault(); step(k === "ArrowDown" ? 1 : -1); }
    else if (k === "Enter") { e.preventDefault(); e.stopPropagation(); pick(shown[Math.min(m.hi, shown.length - 1)]); }
    else if (k === "Escape" || k === "Tab") { e.preventDefault(); e.stopPropagation(); back(); close(); }
  };
  const fb = (e) => { if (e.relatedTarget === el.current || inMenu(e.relatedTarget)) return; close(); onBlur?.(e); };
  const target = m && el.current ? (el.current.closest(".ux-app") || document.body) : null;
  const val = el.current?.value;
  let last = null, n = 0;
  return (<>
    <select ref={setRef} {...rest} aria-expanded={!!m} onMouseDown={md} onKeyDown={kd} onBlur={bl} onTouchStart={ts} onTouchEnd={te}>{children}</select>
    {m && target && createPortal(
      <div ref={menu} className="ux-sel-menu" style={m.at}
        onMouseDown={e => { e.stopPropagation(); if (e.target !== inp.current) e.preventDefault(); }} onClick={e => e.stopPropagation()}>
        {m.find ? (
          <label className="ux-sel-find"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input ref={inp} type="search" placeholder="Search" aria-label={"Search, " + (rest["aria-label"] || "Choices")} autoComplete="off" spellCheck={false}
              value={m.q} onChange={e => { const q = e.target.value; setM(x => (x ? { ...x, q, hi: 0 } : x)); }} onKeyDown={fk} onBlur={fb} /></label>
        ) : m.q && <div className="ux-sel-q">{m.q}</div>}
        <div className="ux-sel-list" role="listbox" aria-label={rest["aria-label"]}>
        {!shown.length && <div className="ux-sel-none">No Matches</div>}
        {shown.map((o) => { const head = o.g && o.g !== last ? o.g : null; last = o.g; const i = n++; return (
          <div key={(o.g || "") + "|" + o.v + "|" + i}>
            {head && <div className="ux-sel-h">{head}</div>}
            <div role="option" aria-selected={o.v === val} aria-disabled={o.off || undefined} data-hi={i === m.hi ? "1" : undefined}
              className={"ux-sel-o" + (i === m.hi ? " ux-on" : "") + (o.v === val ? " ux-cur" : "") + (o.off ? " ux-off" : "")}
              onMouseEnter={() => setM(x => (x ? { ...x, hi: i } : x))} onClick={() => pick(o)}>
              <span>{o.l}</span>
              {o.v === val && <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>}
            </div>
          </div>); })}
        </div>
      </div>, target)}
  </>);
});
