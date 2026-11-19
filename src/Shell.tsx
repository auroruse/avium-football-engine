// THE SHELL: ONE PAGE, TWO UNIVERSES (src/data/worlds.js; DESIGN.md, The two universes). Avium and Arterra are sealed
// from each other by each running as its own copy of the app, in a frame of its own: a copy is built from one universe's
// records alone (App.tsx, WORLD), so nothing of the other is in it to leak. This page holds the frames and shows one.
// The copy not on screen stays exactly as it was left -- its page, its live match (which waits), its tournament, its
// cart -- and is there again the moment it is switched back to. A universe's copy is made the first time it is opened.
//
// The address bar, Back and Forward belong to this page. A frame says where it is ({ type: "route" }) and this page
// writes the address and makes the history entry; an address arriving here (a link, Back, Forward) says which universe
// it is in ("?world=arterra", else Avium) and is handed to that frame ({ type: "go" }). A frame asks for the other
// universe with { type: "universe", to }. The last universe open is remembered in this browser.
import { useEffect, useRef, useState } from "react";

type World = "avium" | "arterra";
const WORLDS: World[] = ["avium", "arterra"];
const NAME: Record<World, string> = { avium: "Avium", arterra: "Arterra" };
const KEY = "avium-universe", SESSION_KEY = "avium-session";
const HOME: Record<World, string> = { avium: "#/", arterra: "#/?world=arterra" };

// Coming back from signing in, the address carries the session (#avium_session=...): it is kept and taken out of the
// address here, before any frame is made, as App.tsx does when it is opened on its own.
try {
  const h = window.location.hash, i = h.indexOf("avium_session=");
  if (i >= 0) {
    localStorage.setItem(SESSION_KEY, decodeURIComponent(h.slice(i + "avium_session=".length).split(/[&#]/)[0]));
    window.history.replaceState(null, "", window.location.pathname + window.location.search + h.slice(0, i).replace(/[#&?]+$/, ""));
  }
} catch {}

const bare = (h: string) => !h || h === "#" || h === "#/";
// The universe an address is in: Arterra's say so; any other page is Avium's; no page at all says nothing.
const worldOfHash = (h: string): World | null => {
  if (bare(h)) return null;
  const qi = h.indexOf("?");
  return qi >= 0 && new URLSearchParams(h.slice(qi + 1)).get("world") === "arterra" ? "arterra" : "avium";
};
const remembered = (): World => { try { return localStorage.getItem(KEY) === "arterra" ? "arterra" : "avium"; } catch { return "avium"; } };

export default function Shell() {
  const boot = useRef<{ world: World; hash: string } | null>(null);
  if (!boot.current) { const h = window.location.hash, w = worldOfHash(h) || remembered(); boot.current = { world: w, hash: bare(h) ? HOME[w] : h }; }
  const [active, setActive] = useState<World>(boot.current.world);
  const [loaded, setLoaded] = useState<World[]>([boot.current.world]);
  const frames = useRef<Partial<Record<World, HTMLIFrameElement | null>>>({});
  // Where each universe is: the address its frame last reported, and the one it is first opened at.
  const at = useRef<Record<World, string>>({ avium: HOME.avium, arterra: HOME.arterra, [boot.current.world]: boot.current.hash } as Record<World, string>);
  const first = useRef<Partial<Record<World, string>>>({ [boot.current.world]: boot.current.hash });
  const activeRef = useRef(active); activeRef.current = active;
  const say = (w: World, m: object) => { try { frames.current[w]?.contentWindow?.postMessage({ afe: true, ...m }, window.location.origin); } catch {} };

  const show = (w: World) => {
    if (!first.current[w]) first.current[w] = at.current[w];
    setLoaded(l => (l.includes(w) ? l : [...l, w]));
    setActive(w);
    try { localStorage.setItem(KEY, w); } catch {}
  };

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const m = e.data;
      if (e.origin !== window.location.origin || !m || m.afe !== true || !WORLDS.includes(m.world)) return;
      const w = m.world as World;
      if (e.source !== frames.current[w]?.contentWindow) return;
      if (m.type === "hello") say(w, { type: "active", on: w === activeRef.current });
      if (m.type === "route" && typeof m.hash === "string") {
        at.current[w] = m.hash;
        if (w !== activeRef.current || window.location.hash === m.hash) return;
        try { window.history[m.replace ? "replaceState" : "pushState"]({ afe: w }, "", m.hash); } catch {}
      }
      // The other universe, asked for from inside one: it opens where it was left, as a new entry, so Back returns.
      if (m.type === "universe" && WORLDS.includes(m.to) && m.to !== activeRef.current) {
        const to = m.to as World;
        try { window.history.pushState({ afe: to }, "", at.current[to]); } catch {}
        show(to);
      }
    };
    // An address arriving at the page: Back, Forward, or one typed into the bar.
    const onAddr = () => {
      const h = window.location.hash, w = worldOfHash(h) || activeRef.current, hash = bare(h) ? HOME[w] : h;
      at.current[w] = hash;
      if (frames.current[w]) say(w, { type: "go", hash });
      if (w !== activeRef.current) show(w);
    };
    window.addEventListener("message", onMsg);
    window.addEventListener("popstate", onAddr); window.addEventListener("hashchange", onAddr);
    return () => { window.removeEventListener("message", onMsg); window.removeEventListener("popstate", onAddr); window.removeEventListener("hashchange", onAddr); };
  }, []);

  // Which copy is on screen: each is told, and the one shown takes the keyboard.
  useEffect(() => {
    for (const w of loaded) say(w, { type: "active", on: w === active });
    try { frames.current[active]?.contentWindow?.focus(); } catch {}
  }, [active, loaded]);

  return (<>
    {loaded.map(w => (
      <iframe key={w} ref={el => { frames.current[w] = el; }} title={`${NAME[w]} Football Engine`}
        src={`${window.location.pathname}?universe=${w}${first.current[w] || HOME[w]}`}
        allow="fullscreen; clipboard-read; clipboard-write" allowFullScreen
        onLoad={() => { say(w, { type: "active", on: w === activeRef.current }); if (w === activeRef.current) { try { frames.current[w]?.contentWindow?.focus(); } catch {} } }}
        // The copy not on screen keeps its size, so nothing in it lays out again on the way back; it is only unseen.
        style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0, display: "block",
                 visibility: w === active ? "visible" : "hidden", pointerEvents: w === active ? "auto" : "none", zIndex: w === active ? 1 : 0 }} />))}
  </>);
}
