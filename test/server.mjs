// THE REGISTRY SERVER, END TO END, against a stand-in for GitHub: sign-in, who may change what, a transfer request from
// asking to accepting, and a save that has to be redone because main moved. The stand-in serves this checkout's records
// as main, keeps every commit, and checks the server's App signature with a throwaway key. No network, no real key.
//
//   node test/server.mjs        (bundles server/worker.js with esbuild first)
import { execFileSync } from "node:child_process";
import { generateKeyPairSync, verify as rsaVerify } from "node:crypto";
import { readFileSync, readdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(mkdtempSync(join(tmpdir(), "registry-")), "worker.mjs");
execFileSync(join(ROOT, "node_modules/.bin/esbuild"), [join(ROOT, "server/worker.js"), "--bundle", "--format=esm", "--platform=neutral", `--outfile=${OUT}`, "--log-level=error"]);
const worker = (await import(pathToFileURL(OUT).href)).default;
const { teamKey, idOf } = await import("../src/data/draft.js");
const { without, vacate, placeFor } = await import("../src/data/squads.js");
const { posFitCost, slotLabels } = await import("../src/data/positions.js");
const E = await import("./engine.mjs");                       // the engine's own slot table (rebuild it first)

let fails = 0;
const ok = (name, cond, got) => { if (!cond) fails++; console.log(`  ${cond ? "ok  " : "FAIL"}  ${name}${got === undefined ? "" : "   " + JSON.stringify(got)}`); };

// ── the stand-in ──
const REPO = "auroruse/avium-football-engine", APP_ID = "5241706";
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs1", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const SECRET = "client-secret";                              // what GitHub holds, whatever the server is given
const env = { REPO, APP_ID, CLIENT_ID: "Iv-test", CLIENT_SECRET: SECRET, PRIVATE_KEY: privateKey, SESSION_SECRET: "session-secret",
              APP_ORIGINS: "https://auroruse.github.io,http://localhost:5173" };
const start = {};
for (const f of ["players", "managers", "teams", "sheets", "editors"]) start[`src/data/${f}.json`] = readFileSync(join(ROOT, `src/data/${f}.json`), "utf8");
for (const f of readdirSync(join(ROOT, "src/presets"))) if (f.endsWith(".tsv")) start[`src/presets/${f}`] = readFileSync(join(ROOT, "src/presets", f), "utf8");
const gh = { commits: new Map([["c0", start]]), trees: new Map(), head: "c0", n: 0, refuse: 0, log: [] };
const reply = (o, status = 200) => new Response(o === null ? null : JSON.stringify(o), { status, headers: { "Content-Type": "application/json" } });
globalThis.fetch = async (url, opts = {}) => {
  const u = new URL(url), m = opts.method || "GET", auth = opts.headers?.Authorization || "";
  if (u.host === "github.com" && u.pathname === "/login/oauth/access_token") {
    const b = Object.fromEntries(new URLSearchParams(opts.body));
    if (b.client_secret !== SECRET) return reply({ error: "incorrect_client_credentials", error_description: "The client_id and/or client_secret passed are incorrect." });
    return reply({ access_token: "user:" + b.code });
  }
  if (u.pathname === "/user") return auth.startsWith("Bearer user:") ? reply({ login: auth.slice("Bearer user:".length) }) : reply({ message: "Bad credentials" }, 401);
  const p = u.pathname.replace(`/repos/${REPO}`, "");
  if (p === "/installation") {                                  // the App's signed token, checked against its key
    const [h, b, s] = auth.replace("Bearer ", "").split(".");
    const good = rsaVerify("RSA-SHA256", Buffer.from(`${h}.${b}`), publicKey, Buffer.from(s, "base64url"));
    const claims = JSON.parse(Buffer.from(b, "base64url"));
    return good && claims.iss === APP_ID ? reply({ id: 7 }) : reply({ message: "A JSON web token could not be decoded" }, 401);
  }
  if (u.pathname === "/app/installations/7/access_tokens") return reply({ token: "inst", expires_at: new Date(Date.now() + 3600e3).toISOString() });
  if (auth !== "Bearer inst") return reply({ message: "Bad credentials" }, 401);
  if (p === "/git/ref/heads/main") return reply({ object: { sha: gh.head } });
  if (p.startsWith("/git/commits/") && m === "GET") return reply({ tree: { sha: "tree:" + p.split("/").pop() } });
  if (p.startsWith("/contents/")) {
    const files = gh.commits.get(u.searchParams.get("ref")), f = decodeURIComponent(p.slice("/contents/".length));
    return f in files ? new Response(files[f], { status: 200 }) : reply({ message: "Not Found" }, 404);
  }
  if (p === "/git/trees" && m === "POST") {
    const b = JSON.parse(opts.body), files = { ...gh.commits.get(b.base_tree.slice(5)) };
    for (const e of b.tree) files[e.path] = e.content;
    const sha = "t" + ++gh.n; gh.trees.set(sha, { files, paths: b.tree.map(e => e.path) }); return reply({ sha });
  }
  if (p === "/git/commits" && m === "POST") {
    const b = JSON.parse(opts.body), sha = "c" + ++gh.n, t = gh.trees.get(b.tree);
    gh.commits.set(sha, t.files); gh.log.push({ sha, message: b.message, paths: t.paths, parent: b.parents[0] }); return reply({ sha });
  }
  if (p === "/git/refs/heads/main" && m === "PATCH") {
    const b = JSON.parse(opts.body), c = gh.log.find(x => x.sha === b.sha);
    if (gh.refuse > 0 || c.parent !== gh.head) { gh.refuse = Math.max(0, gh.refuse - 1); return reply({ message: "Update is not a fast forward" }, 422); }
    gh.head = b.sha; return reply({});
  }
  return reply({ message: "unexpected " + m + " " + u.pathname }, 404);
};

// ── the client side ──
const call = async (path, { method = "GET", session, body, origin = "https://auroruse.github.io" } = {}) => {
  const res = await worker.fetch(new Request("https://avium-registry.avium.workers.dev" + path, { method, redirect: "manual",
    headers: { Origin: origin, ...(session ? { Authorization: "Bearer " + session } : null), ...(body ? { "Content-Type": "application/json" } : null) },
    body: body ? JSON.stringify(body) : undefined }), env);
  const text = await res.text();
  let data = null; try { data = JSON.parse(text); } catch {}
  return { status: res.status, data, location: res.headers.get("Location"), cors: res.headers.get("Access-Control-Allow-Origin") };
};
async function signIn(login) {
  const go = await call("/login?return=" + encodeURIComponent("https://auroruse.github.io/avium-football-engine/"));
  const state = new URL(go.location).searchParams.get("state");
  const back = await call(`/callback?code=${encodeURIComponent(login)}&state=${encodeURIComponent(state)}`);
  return new URL(back.location).hash.replace("#avium_session=", "");
}
const now = () => Object.fromEntries(["players", "teams", "managers"].map(k => [k, JSON.parse(gh.commits.get(gh.head)[`src/data/${k}.json`])]));
const ids = (t) => t.squad.map(v => idOf(v) ?? null);
const lab = (t) => slotLabels(E.sposFor, t.formation, t.squad.length);
const ovrOf = (rec) => (id) => rec.players.find(p => p.id === id)?.ovr ?? 0;

console.log("signing in");
const go = await call("/login?return=" + encodeURIComponent("https://auroruse.github.io/avium-football-engine/"));
const to = new URL(go.location);
ok("sends you to GitHub with the App and the callback", go.status === 302 && to.host === "github.com" && to.searchParams.get("client_id") === "Iv-test"
   && to.searchParams.get("redirect_uri") === "https://avium-registry.avium.workers.dev/callback");
ok("refuses to send anyone back to an unknown site", (await call("/login?return=" + encodeURIComponent("https://evil.example/"))).status === 400);
ok("a forged state is refused", (await call("/callback?code=x&state=forged.sig")).status === 400);
{ const st = new URL((await call("/login?return=" + encodeURIComponent("https://auroruse.github.io/avium-football-engine/"))).location).searchParams.get("state");
  const realSecret = env.CLIENT_SECRET; env.CLIENT_SECRET = "pasted-wrong";
  const bad = await call(`/callback?code=x&state=${encodeURIComponent(st)}`);
  env.CLIENT_SECRET = realSecret;
  ok("a wrong client secret says so", bad.status === 400 && bad.data?.reason === "incorrect_client_credentials", bad.data); }
const skj = await signIn("SwiftorArrow"), ale = await signIn("mrrv533-creator"), varh = await signIn("GeneralVarah"), boss = await signIn("auroruse"), nobody = await signIn("someone-else");
ok("comes back to the app with a session", skj.split(".").length === 2);
const me = await call("/me", { session: skj });
ok("knows who you are and what you run", me.data?.role === "editor" && me.data.nations.join() === "SKJ", me.data);
ok("answers the app's origin, and only it", me.cors === "https://auroruse.github.io" && (await call("/me", { session: skj, origin: "https://evil.example" })).cors === null);
ok("a tampered session is refused", (await call("/me", { session: skj.slice(0, -2) + "xx" })).status === 401);
ok("no session: sign in first", (await call("/me")).status === 401);
ok("the overseer is the overseer", (await call("/me", { session: boss })).data?.role === "overseer");

console.log("saving");
let rec = now();
const skjClub = rec.teams.find(t => t.file === "SKJ"), aleClub = rec.teams.find(t => t.file === "ALE" && t.code === "LEI");
let r = await call("/save", { method: "POST", session: skj, body: { cart: { v: 1, players: {}, teams: { [teamKey(skjClub)]: { formation: "4-4-2", style: "Gegenpressing" } } } } });
ok("an editor's own club: live, one commit", r.status === 200 && !!r.data.sha && gh.head === r.data.sha, r.data);
ok("the commit touches the teams file and that nation's sheet only", JSON.stringify(gh.log.at(-1).paths.sort()) === JSON.stringify(["src/data/teams.json", "src/presets/SKJ.tsv"]), gh.log.at(-1).paths);
ok("and names who made it", gh.log.at(-1).message.startsWith("Registry: SwiftorArrow"), gh.log.at(-1).message);
r = await call("/save", { method: "POST", session: skj, body: { cart: { v: 1, players: { [rec.players[0].id]: { ovr: 99 } } } } });
ok("a player's rating: refused, nothing written", r.status === 422 && /overseer/.test(r.data.errors[0]) && gh.log.length === 1, r.data);
r = await call("/save", { method: "POST", session: skj, body: { cart: { v: 1, players: {}, teams: { [teamKey(aleClub)]: { style: "Catenaccio" } } } } });
ok("someone else's club: refused", r.status === 422 && /not one of your teams/.test(r.data.errors[0]), r.data);
r = await call("/save", { method: "POST", session: nobody, body: { cart: { v: 1, players: {}, teams: { [teamKey(skjClub)]: { style: "Balanced" } } } } });
ok("not on the list: refused", r.status === 422 && /approved/.test(r.data.errors[0]), r.data);

console.log("a transfer");
rec = now();
const club = rec.teams.find(t => teamKey(t) === teamKey(skjClub)), seller = rec.teams.find(t => teamKey(t) === teamKey(aleClub));
const star = ids(seller)[10], gone = ids(club)[15];
let mine = vacate(ids(club), 15, lab(club), posFitCost, ovrOf(rec));
mine[placeFor(mine, lab(club), posFitCost, lab(seller)[10])] = star;
const cart = { v: 1, players: {}, teams: { [teamKey(club)]: { squad: mine }, [teamKey(seller)]: { squad: without(ids(seller), star, lab(seller), posFitCost, ovrOf(rec)) } } };
r = await call("/save", { method: "POST", session: skj, body: { cart } });
const reqId = r.data?.requests?.[0]?.id;
ok("signing another owner's starter becomes a request", r.status === 200 && r.data.requests.length === 1 && r.data.applied === 0, r.data);
ok("only the request is written; neither club moves yet", JSON.stringify(gh.log.at(-1).paths) === JSON.stringify(["src/data/requests.json"]) &&
   JSON.stringify(now().teams) === JSON.stringify(rec.teams));
ok("it waits on the other club's owner", JSON.stringify(Object.values(r.data.requests[0].needs)) === JSON.stringify([["mrrv533-creator"]]), r.data.requests[0].needs);
ok("everyone can see it", (await call("/requests")).data.length === 1);
r = await call("/save", { method: "POST", session: skj, body: { cart: { v: 1, players: {}, teams: { [teamKey(club)]: { style: "Balanced" } } } } });
ok("his club is locked while it waits", r.status === 422 && /waiting on a request/.test(r.data.errors[0]), r.data);
r = await call(`/requests/${reqId}`, { method: "POST", session: varh, body: { action: "accept" } });
ok("a third editor cannot answer it", r.status === 422 && /Not yours/.test(r.data.errors[0]), r.data);
r = await call(`/requests/${reqId}`, { method: "POST", session: ale, body: { action: "accept" } });
const fin = now(), c2 = fin.teams.find(t => teamKey(t) === teamKey(club)), s2 = fin.teams.find(t => teamKey(t) === teamKey(seller));
ok("the other owner accepts: it goes live", r.status === 200 && r.data.done && !!r.data.sha, r.data);
ok("he is at the new club and gone from the old", ids(c2).includes(star) && !ids(s2).includes(star));
ok("the old club's bench fills the place he left", ids(s2).slice(0, 11).every(Boolean) && ids(s2).slice(11).some(v => v == null));
ok("the released man is kept, with his last position", JSON.stringify(fin.players.find(p => p.id === gone)?.pos) === JSON.stringify(lab(club)[15]));
ok("the request is cleared, both sheets written", JSON.parse(gh.commits.get(gh.head)["src/data/requests.json"]).length === 0 &&
   ["src/presets/SKJ.tsv", "src/presets/ALE.tsv"].every(f => gh.log.at(-1).paths.includes(f)), gh.log.at(-1).paths);

console.log("the overseer, and a race");
gh.refuse = 1;                                                  // main moves under the first attempt
r = await call("/save", { method: "POST", session: boss, body: { cart: { v: 1, players: { [gone]: { ovr: 77 } } } } });
ok("the overseer changes a rating; a refused write is redone", r.status === 200 && now().players.find(p => p.id === gone).ovr === 77, r.data);

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
