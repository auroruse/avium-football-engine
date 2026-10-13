// THE REGISTRY SERVER (Cloudflare Workers; wrangler.toml beside this). It signs editors in with GitHub through the
// "Avium Football Registry" GitHub App, checks every save against src/data/rules.js, and commits what passes to main as
// the App, which redeploys the site. Requests waiting on another owner live in src/data/requests.json.
//
//   GET  /login?return=<app url>   to GitHub's sign-in, and back to the app with a session in the address
//   GET  /callback                 where GitHub sends the person back
//   GET  /me                       { login, role, nations }
//   GET  /requests                 the requests waiting
//   POST /save                     { cart }  -> { sha, applied, apply, requests, waiting } or 422 { errors }
//   POST /requests/<id>            { action: "accept" | "decline" | "withdraw" | "counter", edits?, note?, moves?, sides? }
//                                  -> { sha, done, apply, request, waiting }
//   GET  /draft                    the drafts (src/data/drafts.json)
//   POST /draft                    { action: "pick", n, player, out? } the club on the clock's editor or the overseer;
//                                  { action: "start", order, stats } | "pause" | "resume" | { action: "give", n, club } the
//                                  overseer; "tick" anyone -> { sha, draft, apply } or 422 { errors }
//   (every five minutes)           a draft whose clock has run out makes that pick (wrangler.toml's cron)
//                                  (edits: the overseer's changes to a new record he accepts; note: what a decline sends back;
//                                  moves and sides: a counter's deal, src/data/deals.js)
//
// `apply` is what went live (a draft over the records, null if nothing did), so the app can show it before the site
// redeploys; `waiting` is every request still open afterwards.
//
// Secrets (wrangler secret put): CLIENT_SECRET, PRIVATE_KEY (the App's key, as GitHub gave it), SESSION_SECRET.
import { applyDraft, draftChanges, dumpRecords, teamKey } from "../src/data/draft.js";
import { sheetsFromRecords } from "../src/data/sheets.js";
import { owns, planSave, scopeOf, settleRequest } from "../src/data/rules.js";
import { DRAFT_FILE, currentDraft, dumpDrafts, pickDue, ratingBoard, runDraft, startDraft, steerDraft } from "../src/data/collegedraft.js";
import { posFitCost, posList, slotLabels } from "../src/data/positions.js";
import { TRADES_FILE, dumpTrades, latestWorldCup, parseTrades, tradeMoves, tradeRows, trendsFrom } from "../src/data/trades.js";
import { icNow } from "../src/data/icclock.js";
const NATIONAL_FILES = new Set(["AVIUM", "ARTERRA"]);
import { sposFor } from "../src/engine/formations.ts";

const API = "https://api.github.com", UA = "avium-football-registry", MAX_BODY = 256 * 1024;
const enc = new TextEncoder(), dec = new TextDecoder();

// ── bytes and signatures ──────────────────────────────────────────────────────────────────────────
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const hmacKey = (secret) => crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
async function sign(secret, obj) {
  const body = b64url(enc.encode(JSON.stringify(obj)));
  return body + "." + b64url(await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(body)));
}
async function unsign(secret, token) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const ok = await crypto.subtle.verify("HMAC", await hmacKey(secret), unb64url(sig), enc.encode(body)).catch(() => false);
  if (!ok) return null;
  const obj = JSON.parse(dec.decode(unb64url(body)));
  return obj.exp > Date.now() / 1000 ? obj : null;
}

// The App's key arrives as GitHub gives it (PKCS#1, "BEGIN RSA PRIVATE KEY"); Web Crypto takes PKCS#8, so it is wrapped.
function pkcs8(pem) {
  const der = Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")), c => c.charCodeAt(0));
  if (/BEGIN PRIVATE KEY/.test(pem)) return der;
  const len = (n) => n < 128 ? [n] : n < 256 ? [0x81, n] : [0x82, n >> 8, n & 255];
  const alg = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];
  const inner = [0x02, 0x01, 0x00, ...alg, 0x04, ...len(der.length), ...der];
  return new Uint8Array([0x30, ...len(inner.length), ...inner]);
}
async function appJwt(env) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(enc.encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const body = b64url(enc.encode(JSON.stringify({ iat: now - 60, exp: now + 540, iss: env.APP_ID })));
  const key = await crypto.subtle.importKey("pkcs8", pkcs8(env.PRIVATE_KEY), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  return `${head}.${body}.${b64url(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(`${head}.${body}`)))}`;
}

// ── GitHub, as the App ────────────────────────────────────────────────────────────────────────────
let install = null;                                    // { token, until } for the App's install on the repo
async function ghRaw(url, token, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { "User-Agent": UA, Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28", ...(token ? { Authorization: `Bearer ${token}` } : null), ...(opts.headers || {}) } });
  if (!r.ok) {
    let msg = ""; try { msg = (await r.json()).message || ""; } catch {}
    throw Object.assign(new Error(`GitHub ${r.status}${msg ? ": " + msg : ""}`), { status: r.status });
  }
  return opts.raw ? r.text() : r.status === 204 ? null : r.json();
}
async function appToken(env) {
  if (install && install.until > Date.now() + 60_000) return install.token;
  const jwt = await appJwt(env);
  const { id } = await ghRaw(`${API}/repos/${env.REPO}/installation`, jwt);
  const t = await ghRaw(`${API}/app/installations/${id}/access_tokens`, jwt, { method: "POST" });
  install = { token: t.token, until: Date.parse(t.expires_at) };
  return t.token;
}
const gh = async (env, path, opts) => ghRaw(API + path, await appToken(env), opts);

// Main as it stands: its head, its tree, the records, the editors and the requests. One file is a lighter read.
const mainHead = async (env) => (await gh(env, `/repos/${env.REPO}/git/ref/heads/main`)).object.sha;
async function readJson(env, head, p, dflt) {
  try { return JSON.parse(await gh(env, `/repos/${env.REPO}/contents/${p}?ref=${head}`, { raw: true, headers: { Accept: "application/vnd.github.raw+json" } })); }
  catch (e) { if (e.status === 404 && dflt !== undefined) return dflt; throw e; }
}
const readOne = async (env, p, dflt) => readJson(env, await mainHead(env), p, dflt);
async function readText(env, head, p, dflt) {
  try { return await gh(env, `/repos/${env.REPO}/contents/${encodeURI(p)}?ref=${head}`, { raw: true, headers: { Accept: "application/vnd.github.raw+json" } }); }
  catch (e) { if (e.status === 404) return dflt; throw e; }
}
// THE TRADES LOG (src/data/trades.js): the moves a change makes, each man as he stood before it, added to the log in the
// same commit; null when it moves nobody. The season is the latest World Cup on file.
async function tradeLog(env, head, rec, next, by) {
  if (!tradeMoves(rec, next).length) return null;
  const [old, changelog, wc] = await Promise.all([readText(env, head, TRADES_FILE, ""), readText(env, head, "public/avium/pstats/changelog.tsv", ""),
    gh(env, `/repos/${env.REPO}/contents/public/avium/pstats/wc?ref=${head}`).catch(() => [])]);
  const rows = parseTrades(old), now = new Date();
  const season = latestWorldCup((Array.isArray(wc) ? wc : []).map(f => f.name)) ?? icNow(now).getUTCFullYear();
  const add = tradeRows(rec, next, { season, now, by, first: rows.reduce((n, r) => Math.max(n, r.deal || 0), 0) + 1, trends: trendsFrom(changelog),
    slotsFor: (f) => sposFor(String(f || "4-3-3").trim()) });
  return add.length ? dumpTrades([...rows, ...add]) : null;
}
async function readMain(env) {
  const head = await mainHead(env);
  const tree = (await gh(env, `/repos/${env.REPO}/git/commits/${head}`)).tree.sha;
  const [players, managers, teams, sheets, editors, requests, leagues, drafts] = await Promise.all(["players", "managers", "teams", "sheets", "editors"]
    .map(f => readJson(env, head, `src/data/${f}.json`)).concat(readJson(env, head, "src/data/requests.json", []), readJson(env, head, "src/data/leagues.json", []),
      readJson(env, head, DRAFT_FILE, [])));
  return { head, tree, rec: { players, managers, teams, sheets, leagues }, editors, requests, drafts };
}
// One commit to main with these files, or a 422 if main moved meanwhile (the caller reads again and redoes).
async function commit(env, head, tree, files, message) {
  const t = await gh(env, `/repos/${env.REPO}/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: tree,
    tree: Object.entries(files).map(([path, content]) => ({ path, mode: "100644", type: "blob", content })) }) });
  const c = await gh(env, `/repos/${env.REPO}/git/commits`, { method: "POST", body: JSON.stringify({ message, tree: t.sha, parents: [head] }) });
  await gh(env, `/repos/${env.REPO}/git/refs/heads/main`, { method: "PATCH", body: JSON.stringify({ sha: c.sha, force: false }) });
  return c.sha;
}
// The files a change to the records rewrites: each records file and each sheet that differs.
function filesFor(rec, next) {
  const out = {};
  for (const k of ["players", "managers", "teams", "leagues"]) { const a = dumpRecords(rec[k] || []), b = dumpRecords(next[k] || []); if (a !== b) out[`src/data/${k}.json`] = b; }
  const before = sheetsFromRecords(rec), after = sheetsFromRecords(next);
  for (const f of Object.keys(after)) if (after[f] !== before[f]) out[`src/presets/${f}.tsv`] = after[f];
  return out;
}
// How squads are judged, against these records.
const judge = (rec) => { const ovr = new Map(rec.players.map(r => [r.id, r.ovr])), pos = new Map(rec.players.map(r => [r.id, posList(r.pos)]));
  return { labels: (t) => slotLabels(sposFor, t.formation, t.squad.length, !NATIONAL_FILES.has(t.file)), fit: posFitCost, ovr: (id) => ovr.get(id) ?? 0, pos: (id) => pos.get(id) || [] }; };

// ── the college draft (src/data/collegedraft.js) ──────────────────────────────────────────────────
// Every club picks by hand, the overseer for Nichirin's (the user, 14 October 2026, after the start picked NL2's 24 at
// once: "Undo, You Pick NL By Hand"); a pick is made automatically only when its two hours run out.
const BY_HAND = () => true;
// One step of a draft: the overseer's start, pause, resume or giving a pick, a pick, or a tick; then every pick due made at
// once. { files, message, result } to commit, { result } when nothing changed, or { errors }.
async function draftStep(env, head, rec, editors, drafts, login, a, now) {
  const scope = scopeOf(editors, login), over = scope.role === "overseer";
  const d0 = (a.id ? drafts.find(d => d.id === a.id) : null) || currentDraft(drafts);
  if (!d0) return { errors: ["There is no draft"] };
  let d = d0;
  if (["start", "pause", "resume", "give"].includes(a.action) && !over) return { errors: ["That is the overseer's to do"] };
  if (a.action === "start") { const s = startDraft(rec, d, a.order, a.stats ?? null, now); if (s.errors) return s; d = s.draft; }
  else if (["pause", "resume", "give"].includes(a.action)) { const s = steerDraft(rec, d, a.action, { n: a.n, club: a.club ?? null, now }); if (s.errors) return s; d = s.draft; }
  else if (a.action === "pick") {
    const p = pickDue(d), t = p ? rec.teams.find(x => teamKey(x) === p.club) : null;
    if (!p || p.n !== a.n) return { errors: [`Pick ${a.n} is not on the clock`] };
    if (!over && !(t && owns(scope, t))) return { errors: ["That pick is not yours to make"] };
  } else if (a.action !== "tick") return { errors: ["Unknown action"] };
  const board = d.stats ? ratingBoard(await readText(env, head, d.stats, "")) : [];
  const r = runDraft(rec, d, { now, hand: BY_HAND, board, h: judge(rec),
    pick: a.action === "pick" ? { n: a.n, player: a.player, out: a.out ?? null, by: login } : null });
  if (r.errors) return r;
  if (!r.patch && JSON.stringify(r.draft) === JSON.stringify(d0)) return { result: { draft: d0, apply: null } };
  const files = { [DRAFT_FILE]: dumpDrafts(drafts.map(x => (x.id === d0.id ? r.draft : x))), ...(r.patch ? filesFor(rec, applyDraft(rec, r.patch)) : null) };
  const own = a.action === "pick" ? 1 : 0, auto = r.made.slice(own), late = r.made.filter(n => r.draft.picks[n - 1].by === "clock");
  const what = a.action === "pick" ? `${login}, pick ${a.n}` : a.action === "tick" ? (late.length ? `pick ${late[0]}, time ran out` : "the clock")
    : `${login}, ${a.action}${a.action === "give" ? ` pick ${a.n}` : ""}`;
  return { files, message: `Draft: ${what}${auto.length - late.length > 0 ? `, ${auto.length - late.length} automatic` : ""}${r.draft.status === "done" && d0.status !== "done" ? ", over" : ""}`,
           result: { draft: r.draft, apply: r.patch } };
}
// Every five minutes: a draft whose clock has run out makes that pick, and the ones after it nobody picks by hand.
async function draftClock(env) {
  const d = currentDraft(await readOne(env, DRAFT_FILE, []));
  if (!d || d.status !== "running" || !(d.clock?.until && Date.parse(d.clock.until) <= Date.now())) return null;
  return withMain(env, async ({ head, rec, editors, drafts }) => { const r = await draftStep(env, head, rec, editors, drafts, "", { action: "tick" }, new Date(Date.now()));
    return r.errors ? { result: null } : r; });
}

// ── the web ───────────────────────────────────────────────────────────────────────────────────────
const origins = (env) => String(env.APP_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
function cors(req, env, res) {
  const o = req.headers.get("Origin");
  if (o && origins(env).includes(o)) {
    res.headers.set("Access-Control-Allow-Origin", o);
    res.headers.set("Access-Control-Allow-Headers", "authorization, content-type");
    res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.headers.set("Vary", "Origin");
  }
  return res;
}
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
// Built by hand: Response.redirect() comes back with locked headers, and the CORS headers could not be added to it.
const redirect = (to) => new Response(null, { status: 302, headers: { Location: to } });
async function who(req, env) {
  const s = await unsign(env.SESSION_SECRET, (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, ""));
  return s?.login || null;
}
async function body(req) {
  const text = await req.text();
  if (text.length > MAX_BODY) throw Object.assign(new Error("Too large"), { status: 413 });
  return JSON.parse(text || "{}");
}

// Read main, work the change out, commit it; if main moved underneath, read again and redo (three tries).
async function withMain(env, work) {
  for (let i = 0; i < 3; i++) {
    const m = await readMain(env), out = await work(m);
    if (!out.files) return out.result;
    try { const sha = await commit(env, m.head, m.tree, out.files, out.message); return { ...out.result, sha }; }
    catch (e) { if (e.status !== 422 || i === 2) throw e; }
  }
}

async function handle(req, env) {
  const url = new URL(req.url), path = url.pathname.replace(/\/+$/, "") || "/";
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  if (path === "/login") {
    const ret = url.searchParams.get("return") || "";
    if (!origins(env).some(o => ret === o || ret.startsWith(o + "/"))) return json({ error: "Unknown return address" }, 400);
    const state = await sign(env.SESSION_SECRET, { r: ret, exp: Math.floor(Date.now() / 1000) + 600 });
    const to = new URL("https://github.com/login/oauth/authorize");
    to.searchParams.set("client_id", env.CLIENT_ID);
    to.searchParams.set("redirect_uri", url.origin + "/callback");
    to.searchParams.set("state", state);
    return redirect(to.toString());
  }
  if (path === "/callback") {
    const st = await unsign(env.SESSION_SECRET, url.searchParams.get("state"));
    if (!st) return json({ error: "Sign-in expired: start again" }, 400);
    if (url.searchParams.get("error")) return json({ error: "Sign-in cancelled on GitHub", reason: url.searchParams.get("error") }, 400);
    // The form GitHub documents for this exchange. Its own reason comes back on a refusal (a wrong client secret reads
    // incorrect_client_credentials, a used or stale code bad_verification_code), so a failure says what to fix.
    const tok = await fetch("https://github.com/login/oauth/access_token", { method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
      body: new URLSearchParams({ client_id: env.CLIENT_ID, client_secret: env.CLIENT_SECRET || "", code: url.searchParams.get("code") || "",
                                  redirect_uri: url.origin + "/callback" }).toString() }).then(r => r.json()).catch(() => ({}));
    if (!tok.access_token) return json({ error: "GitHub refused the sign-in", reason: tok.error || "no answer", detail: tok.error_description || "" }, 400);
    const user = await ghRaw(`${API}/user`, tok.access_token);
    const session = await sign(env.SESSION_SECRET, { login: user.login, exp: Math.floor(Date.now() / 1000) + 30 * 86400 });
    return redirect(`${st.r}#avium_session=${session}`);
  }
  if (path === "/requests" && req.method === "GET") return json(await readOne(env, "src/data/requests.json", []));
  if (path === "/draft" && req.method === "GET") return json(await readOne(env, DRAFT_FILE, []));

  const login = await who(req, env);
  if (!login) return json({ error: "Sign in first" }, 401);
  if (path === "/me") return json(scopeOf(await readOne(env, "src/data/editors.json"), login));

  if (path === "/save" && req.method === "POST") {
    const { cart } = await body(req);
    let errors = null;
    const result = await withMain(env, async ({ head, rec, editors, requests }) => {
      const plan = planSave(rec, editors, requests, login, cart, judge(rec));
      if (plan.errors.length) { errors = plan.errors; return { result: null }; }
      const nothing = { result: { sha: null, applied: 0, apply: null, requests: [], waiting: requests } };
      if (!plan.apply && !plan.requests.length) return nothing;
      const next = plan.apply ? applyDraft(rec, plan.apply) : rec, files = filesFor(rec, next), waiting = [...requests, ...plan.requests];
      if (plan.requests.length) files["src/data/requests.json"] = JSON.stringify(waiting, null, 1) + "\n";
      const log = plan.apply ? await tradeLog(env, head, rec, next, login) : null;
      if (log) files[TRADES_FILE] = log;
      const added = ["players", "managers", "teams", "leagues"].reduce((n, k) => n + (plan.apply?.add?.[k]?.length || 0), 0);
      const applied = plan.apply ? draftChanges(rec, plan.apply).filter(c => c.field !== "pos").length + added : 0;
      if (!Object.keys(files).length) return nothing;
      const parts = [applied && `${applied} change${applied > 1 ? "s" : ""}`, plan.requests.length && `${plan.requests.length} request${plan.requests.length > 1 ? "s" : ""}`].filter(Boolean);
      return { files, message: `Registry: ${login}, ${parts.join(" and ")}`,
               result: { applied, apply: applied ? plan.apply : null, requests: plan.requests, waiting } };
    });
    return errors ? json({ errors }, 422) : json(result);
  }
  if (path === "/draft" && req.method === "POST") {
    const { id, action, n, player, out, club, order, stats } = await body(req);
    let errors = null;
    const result = await withMain(env, async ({ head, rec, editors, drafts }) => {
      const r = await draftStep(env, head, rec, editors, drafts, login, { id, action, n, player, out, club, order, stats }, new Date(Date.now()));
      if (r.errors) { errors = r.errors; return { result: null }; }
      return r;
    });
    return errors ? json({ errors }, 422) : json(result);
  }
  const m = path.match(/^\/requests\/([\w-]+)$/);
  if (m && req.method === "POST") {
    const { action, edits, note, moves, sides } = await body(req);
    if (!["accept", "decline", "withdraw", "counter"].includes(action)) return json({ error: "Unknown action" }, 400);
    let errors = null;
    const result = await withMain(env, async ({ head, rec, editors, requests }) => {
      const r = requests.find(x => x.id === m[1]);
      if (!r) { errors = ["No such request"]; return { result: null }; }
      const s = settleRequest(rec, editors, r, login, action, judge(rec), { edits, note, moves, sides, others: requests });
      if (s.errors?.length) { errors = s.errors; return { result: null }; }
      const left = s.request ? requests.map(x => (x.id === r.id ? s.request : x)) : requests.filter(x => x.id !== r.id);
      const files = { ...(s.apply ? filesFor(rec, applyDraft(rec, s.apply)) : null), "src/data/requests.json": JSON.stringify(left, null, 1) + "\n" };
      const log = s.apply ? await tradeLog(env, head, rec, applyDraft(rec, s.apply), login) : null;
      if (log) files[TRADES_FILE] = log;
      return { files, message: `Registry: ${login} ${action}s ${r.teamName}'s ${r.kind === "deal" ? "offer" : "request"}`,
               result: { done: !!s.done, apply: s.apply || null, request: s.request, waiting: left } };
    });
    return errors ? json({ errors }, 422) : json(result);
  }
  return json({ error: "Not found" }, 404);
}

export default {
  async fetch(req, env) {
    try { return cors(req, env, await handle(req, env)); }
    catch (e) { return cors(req, env, json({ error: String(e?.message || e) }, e?.status && e.status < 600 ? e.status : 500)); }
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(draftClock(env).catch((e) => console.error("draft clock:", e?.message || e))); },
};
