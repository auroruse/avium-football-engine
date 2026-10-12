// A club's page in the real app at several window sizes: the profile's six sections, the pitch with its bench beside it,
// the list with Traits in its own column, and the crest opening across the window. Measures what the eye would catch:
// columns, any page or column overflow, the pitch's proportions and the room beside it, every name cut short.
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
const [base, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const chrome = spawn(process.env.CHROME || "google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
  "--remote-debugging-port=9334", "--window-size=1600,1092", "about:blank"], { stdio: "ignore" });
let tgt;
for (let i = 0; i < 150 && !tgt; i++) { try { tgt = await (await fetch("http://127.0.0.1:9334/json/new?about:blank", { method: "PUT" })).json(); } catch { await sleep(200); } }
const ws = new WebSocket(tgt.webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener("open", r, { once: true }));
let id = 0; const wait = new Map(), errors = [];
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data);
  if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") errors.push("exception: " + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text).slice(0, 800));
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push("console: " + m.params.args.map(a => a.value ?? a.description ?? "").join(" ").slice(0, 300));
});
const send = (method, params = {}) => new Promise(r => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const val = async (expression) => { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) errors.push("eval: " + JSON.stringify(r.result.exceptionDetails).slice(0, 400)); return r.result?.result?.value; };
await send("Page.enable"); await send("Runtime.enable");
await send("Network.enable"); await send("Network.setBlockedURLs", { urls: ["*avium-registry*"] });
const until = async (expr, n = 60) => { for (let i = 0; i < n; i++) { if (await val(expr)) return true; await sleep(500); } return false; };
const shot = async (name) => { const s = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(`${out}/${name}.png`, Buffer.from(s.result.data, "base64")); };
const go = async (hash) => { await send("Page.navigate", { url: base + hash }); await sleep(4000); await until("!!document.querySelector('.ux-body')", 30); await sleep(1800); };
const view = (k) => val(`(() => { const b = [...document.querySelectorAll('[aria-label="Squad View"] button')].find(x => x.textContent === ${JSON.stringify(k)}); if (!b) return false; b.click(); return true; })()`);
await send("Page.navigate", { url: base }); await sleep(2500);

// How far a SlideName's text runs past its box (0 when it fits).
const OVER = `const over = (box) => { const sp = box && box.querySelector('span'); return sp ? Math.max(0, Math.round(sp.scrollWidth - box.clientWidth)) : null; };
  const R = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; };`;
const MEAS = `(() => { ${OVER}
  const body = document.querySelector('.ux-body'); if (!body) return null;
  const cols = [...body.children], prof = cols[0];
  const panels = [...prof.children].map(p => [p.querySelector('h2')?.textContent, Math.round(p.getBoundingClientRect().height)]);
  const stad = prof.querySelector('.ux-pstad'), nm = prof.querySelector('.ux-prof-nm > div'), mg = prof.querySelector('.ux-pmgr-nm');
  const pitch = document.querySelector('.ux-sqp .ux-pitch'), wrap = document.querySelector('.ux-sqp .ux-pitch-wrap'), bn = document.querySelector('.ux-bn');
  const bnm = [...document.querySelectorAll('.ux-bn-m')], bcut = bnm.map(m => [m.textContent, over(m.querySelector('.ux-bn-nm > div'))]).filter(x => x[1] > 0);
  const lastM = bnm[bnm.length - 1], bl = document.querySelector('.ux-bn-l');
  const tbl = document.querySelector('.ux-tbl.ux-sq');
  const cut = tbl ? [...tbl.querySelectorAll('tbody tr')].map(r => [r.querySelector('.ux-sqnm')?.textContent, over(r.querySelector('.ux-sqnm > div'))]).filter(x => x[1] > 0) : [];
  const strip = [...cols[2].querySelectorAll('.ux-strip > div')].map(d => { const b = d.querySelector('b'); return b ? Math.round(b.scrollWidth - d.clientWidth) : 0; });
  return {
    cols: cols.map(c => Math.round(c.getBoundingClientRect().width)), page: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
    colScroll: cols.map(c => c.scrollHeight - c.clientHeight), panels, stadium: R(stad), nameOver: over(nm), mgrOver: mg ? Math.round(mg.scrollWidth - mg.clientWidth) : null,
    strength: [...prof.querySelectorAll('.ux-pstr > div')].map(d => d.textContent).join(' '),
    pitch: R(pitch), ratio: pitch ? +(pitch.getBoundingClientRect().width / pitch.getBoundingClientRect().height).toFixed(3) : null,
    wrapContent: wrap ? Math.round(wrap.clientWidth - 12) : null, bench: R(bn), benchN: bnm.length, benchCut: bcut,
    benchFoot: lastM && bl ? Math.round(bl.getBoundingClientRect().bottom - lastM.getBoundingClientRect().bottom) : null, benchScroll: bl ? bl.scrollHeight - bl.clientHeight : null,
    head: tbl ? [...tbl.querySelectorAll('thead th')].map(x => x.textContent).join(',') : null, cut, stripWorst: strip.length ? Math.max(...strip) : null }; })()`;

const SIZES = [[1512, 949], [1512, 829], [1440, 790], [1920, 1080]];
for (const [w, h] of SIZES) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  for (const [name, hash] of [["club", "#/registry/clubs/dym"], ["nation", "#/registry/national-teams/nch"], ["nophoto", "#/registry/clubs/arm"]]) {
    await go(hash);
    await view("Pitch"); await sleep(900);
    console.log(name.padEnd(8), (w + "x" + h).padEnd(9), "pitch", JSON.stringify(await val(MEAS)));
    if (w === 1512 && h === 949 || name === "club") await shot(`${name}-pitch-${w}x${h}`);
    await view("List"); await sleep(1100);
    console.log(name.padEnd(8), (w + "x" + h).padEnd(9), "list ", JSON.stringify(await val(MEAS)));
    if (w === 1512 && h === 949 && name !== "nophoto") await shot(`${name}-list-${w}x${h}`);
  }
}
// The crest across the window, then shut with Escape.
await send("Emulation.setDeviceMetricsOverride", { width: 1512, height: 949, deviceScaleFactor: 1, mobile: false });
await go("#/registry/clubs/dym"); await view("Pitch"); await sleep(600);
console.log("crest click:", await val(`(() => { const b = document.querySelector('.ux-prof-crest'); if (!b) return 'no button'; b.click(); return 'clicked'; })()`));
await sleep(900);
console.log("lightbox:", JSON.stringify(await val(`(() => { const l = document.querySelector('.ux-lightbox'); if (!l) return null; const img = l.querySelector('figure img, figure svg'); const r = img?.getBoundingClientRect();
  return { caption: l.querySelector('figcaption')?.textContent, img: r ? [Math.round(r.width), Math.round(r.height)] : null, src: img?.getAttribute('src') }; })()`)));
await shot("crest-lightbox");
await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
await sleep(500);
console.log("after Escape:", await val(`!!document.querySelector('.ux-lightbox')`));
// A bench man's face opens his page.
console.log("bench click:", await val(`(() => { const b = document.querySelector('.ux-bn-tok:not(.ux-open)'); if (!b) return 'none'; const nm = b.getAttribute('aria-label'); b.click(); return nm; })()`));
await sleep(1500);
console.log("after bench click:", await val(`location.hash`));
console.log("\nerrors:", errors.length ? errors.join("\n") : "none");
ws.close(); chrome.kill(); process.exit(0);
