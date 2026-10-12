// The sheet in the real app, with a stand-in session (the registry blocked): the overseer's Edit Club and Edit Player
// from the Registry, an old Editor address, a new manager typed into an empty manager cell; then Varahmehr's editor doing
// the same on a Livonian club. Pictures, the cart as stored, and every error.
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
const [base, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const chrome = spawn(process.env.CHROME || "google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
  "--remote-debugging-port=9334", "--window-size=1512,829", "about:blank"], { stdio: "ignore" });
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
const val = async (expression) => { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (r.result?.exceptionDetails) errors.push("eval: " + JSON.stringify(r.result.exceptionDetails).slice(0, 300)); return r.result?.result?.value; };
await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
await send("Network.setBlockedURLs", { urls: ["*avium-registry*"] });
await send("Emulation.setDeviceMetricsOverride", { width: 1512, height: 829, deviceScaleFactor: 2, mobile: false });
const shot = async (name, sel) => { const r = sel ? await val(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; })()`) : [0, 0, 1512, 829];
  if (!r) { console.log("(no picture " + name + ": nothing at " + sel + ")"); return; }
  const s = await send("Page.captureScreenshot", { format: "png", clip: { x: r[0], y: r[1], width: r[2], height: r[3], scale: sel ? 2 : 1 } }); writeFileSync(`${out}/${name}.png`, Buffer.from(s.result.data, "base64")); };
const centre = async (sel) => val(`(() => { const b = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
const clickAt = async (sel) => { await val(`document.querySelector(${JSON.stringify(sel)}).scrollIntoView({ block: "center", inline: "center" }); true`); await sleep(300);
  const r = await centre(sel); for (const type of ["mousePressed", "mouseReleased"]) await send("Input.dispatchMouseEvent", { type, x: r[0], y: r[1], button: "left", clickCount: 1 }); await sleep(700); };
const key = async (k, code, vk, text) => { for (const type of ["keyDown", "keyUp"]) await send("Input.dispatchKeyEvent", { type, key: k, code, windowsVirtualKeyCode: vk, ...(type === "keyDown" && text ? { text } : null) }); await sleep(400); };
const button = async (label) => val(`(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === ${JSON.stringify(label)}); if (!b) return false; b.click(); return true; })()`);
const until = async (expr, n = 60) => { for (let i = 0; i < n; i++) { if (await val(expr)) return true; await sleep(500); } return false; };
const signIn = async (login, scope) => {
  await send("Page.navigate", { url: base }); await sleep(2500);
  const tok = Buffer.from(JSON.stringify({ login, exp: 4102444800 })).toString("base64url") + ".x";
  await val(`localStorage.clear(); localStorage.setItem("avium-session", ${JSON.stringify(tok)}); localStorage.setItem("avium-scope", ${JSON.stringify(JSON.stringify(scope))}); true`);
  // the session is read when the page loads, and a change of address after the # does not load it again
  await send("Page.reload"); await sleep(3000);
  console.log("signed in as", login, ":", await val("[...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Sign In') ? 'NO (Sign In shown)' : 'yes'"));
};
const go = async (hash) => { await send("Page.navigate", { url: base + hash }); await sleep(3000); };
const keyOf = async (code) => val(`(() => { const r = [...document.querySelectorAll('.ux-sh-tbl tbody tr')].find(tr => tr.querySelector('td[data-cell$="|code"]')?.textContent.trim() === ${JSON.stringify(code)}); return r ? r.querySelector('td[data-cell$="|name"]').dataset.cell.split('|')[0] : null; })()`);
const cart = async () => val(`JSON.parse(localStorage.getItem("avium-records-draft") || "null")`);
const log = (...a) => console.log(...a);

// New players and managers on the dock, Free Agents' tabs, Many, Roll Ratings, Remove Club and Finish, as the overseer,
// then as Varahmehr's editor. The registry is blocked; the cart is read from the browser.
const teams = JSON.parse(readFileSync("src/data/teams.json", "utf8")), players = JSON.parse(readFileSync("src/data/players.json", "utf8")), managers = JSON.parse(readFileSync("src/data/managers.json", "utf8"));
const idOf = (v) => (v && typeof v === "object" ? v.id : v), clubMen = new Set(teams.filter(t => t.file !== "AVIUM" && t.file !== "ARTERRA").flatMap(t => t.squad.map(idOf)));
const ntOnly = players.find(p => !p.retired && !clubMen.has(p.id) && teams.some(t => t.file === "AVIUM" && t.squad.map(idOf).includes(p.id)));
const clubMgrs = new Set(teams.filter(t => t.file !== "AVIUM" && t.file !== "ARTERRA").map(t => idOf(t.manager)));
const ntMgr = managers.find(m => !clubMgrs.has(m.id) && teams.some(t => t.file === "AVIUM" && idOf(t.manager) === m.id));
log("a man who plays only for his national side:", ntOnly?.name, ntOnly?.nat, "| a manager only of a national side:", ntMgr?.name);
const setVal = (sel, v) => val(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; const proto = el.tagName === "SELECT" ? HTMLSelectElement.prototype : el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true })); return true; })()`);
const clickSel = (sel) => val(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.click(); return true; })()`);
const clickText = (scope, text) => val(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(scope)})].find(b => b.textContent.trim().startsWith(${JSON.stringify(text)})); if (!el) return false; el.click(); return true; })()`);
const head1 = () => val("document.querySelector('.ux-sh-rec .ux-sh-rh b')?.textContent");
const paste = (sel, text) => val(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; const dt = new DataTransfer(); dt.setData("text/plain", ${JSON.stringify(text)});
  el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })); return true; })()`);
const rnOf = (k) => `tr:has(td[data-cell="${k}|name"]) td.ux-sh-rn`;
const signIn2 = async (login, scope) => { await send("Page.navigate", { url: base }); await sleep(2500);
  const tok = Buffer.from(JSON.stringify({ login, exp: 4102444800 })).toString("base64url") + ".x";
  await val(`localStorage.clear(); localStorage.setItem("avium-session", ${JSON.stringify(tok)}); localStorage.setItem("avium-scope", ${JSON.stringify(JSON.stringify(scope))}); true`);
  await send("Page.reload"); await sleep(3000); await go("#/editor/sheet"); await until("!!document.querySelector('.ux-sh-tbl')"); };

// The Teams list's card: the club's badge level with the middle of its name block, the nation's and league's crests level.
await send("Page.navigate", { url: base }); await sleep(2500);
await go("#/registry/teams"); await sleep(2500);
const measure = async () => val(`(() => { const mid = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return Math.round((b.top + b.height / 2) * 10) / 10; };
  const box = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; };
  const card = document.querySelector('.ux-tmc-ban'); if (!card) return null;
  const cr = [...card.querySelectorAll('.ux-plc-crests > *')];
  const ban = card.getBoundingClientRect(), id = card.querySelector('.ux-plc-id').getBoundingClientRect();
  return { bannerH: Math.round(ban.height), roomAbove: Math.round(id.top - ban.top), name: card.querySelector('.ux-plc-last')?.textContent, badgeMid: mid(card.querySelector('.ux-tmc-crest')), nameBlockMid: mid(card.querySelector('.ux-plc-id')),
    crestMids: cr.map(mid), crestBoxes: cr.map(box), artBoxes: cr.map(e => box(e.tagName === "IMG" ? e : e.querySelector('img, svg'))) }; })()`);
for (const name of ["Imperial Sports Society", "Dynamo Mizuhara"]) {
  const hit = await val(`(() => { const r = [...document.querySelectorAll('tr, [role="row"], .ux-link')].find(e => e.textContent.includes(${JSON.stringify(name)})); if (!r) return false; r.click(); return true; })()`);
  await sleep(1200);
  log(name, "| row clicked:", hit, "|", JSON.stringify(await measure()));
  await shot(name === "Dynamo Mizuhara" ? "2-card-dynamo" : "1-card-imperial", ".ux-tmc-ban");
}
writeFileSync(`${out}/errors.txt`, errors.join("\n") + "\n");
log(errors.length, "errors"); log(errors.slice(0, 8).join("\n"));
chrome.kill(); process.exit(0);
