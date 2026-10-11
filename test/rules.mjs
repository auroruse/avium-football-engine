// THE REGISTRY'S RULES (src/data/rules.js), on the real records: what an editor may change outright, what goes to the
// overseer as a request (a code, a ground, a city; a new player, manager or club), a trade with another nation (one way
// and an exchange) and its answer, the men a waiting request locks, and a decline's note. Every case is checked the way
// the server checks it: planSave on a cart, then settleRequest on the request it made.
//
//   node test/rules.mjs        (bundles src/data with esbuild first)
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIR = mkdtempSync(join(tmpdir(), "rules-")), ENTRY = join(DIR, "entry.js"), OUT = join(DIR, "rules.mjs");
writeFileSync(ENTRY, ["data/rules.js", "data/draft.js", "data/squads.js", "data/positions.js", "data/sheets.js"].map(f => `export * from ${JSON.stringify(join(ROOT, "src", f))};`).join("\n")
  + `\nexport { sposFor } from ${JSON.stringify(join(ROOT, "src/engine/formations.ts"))};\n`);
execFileSync(join(ROOT, "node_modules/.bin/esbuild"), [ENTRY, "--bundle", "--format=esm", "--platform=node", `--outfile=${OUT}`, "--log-level=error"]);
const R = await import(pathToFileURL(OUT).href);
const { planSave, settleRequest, applyDraft, draftWith, idOf, teamKey, vacate, posFitCost, slotLabels, sposFor, OVERSEER, sheetsFromRecords } = R;

let fails = 0;
const ok = (name, cond, got) => { if (!cond) fails++; console.log(`  ${cond ? "ok  " : "FAIL"}  ${name}${got === undefined || cond ? "" : "   " + JSON.stringify(got).slice(0, 300)}`); };
const rec = Object.fromEntries(["players", "managers", "teams", "sheets", "leagues"].map(k => [k, JSON.parse(readFileSync(join(ROOT, `src/data/${k}.json`), "utf8"))]));
const editors = JSON.parse(readFileSync(join(ROOT, "src/data/editors.json"), "utf8"));
const ovr = new Map(rec.players.map(p => [p.id, p.ovr]));
const posOfRec = new Map(rec.players.map(p => [p.id, p.pos || []]));
const h = { labels: (t) => slotLabels(sposFor, String(t.formation).trim(), t.squad.length), fit: posFitCost, ovr: (id) => ovr.get(id) ?? 0, pos: (id) => posOfRec.get(id) || [] };
const ids = (t) => t.squad.map(v => idOf(v) ?? null);
const ED = "mrrv533-creator", OV = "auroruse", NCH_ED = "auroruse";       // ALE's editor; the overseer (who also edits NCH)
const A = rec.teams.find(t => t.file === "ALE" && t.code === "ARM"), A2 = rec.teams.find(t => t.file === "ALE" && t.code === "HAN");
const B = rec.teams.find(t => t.file === "NCH" && t.code === "SPK");
const plan = (login, cart, pending = [], r = rec) => planSave(r, editors, pending, login, { v: 1, players: {}, ...cart }, h, "2026-10-10T00:00:00Z", (() => { let i = 0; return () => "r" + ++i; })());
const settle = (login, req, action, extra, r = rec) => settleRequest(r, editors, req, login, action, h, extra);
const after = (d, r = rec) => applyDraft(r, d);

console.log("an editor's own sides and the overseer's things");
{ const p = ids(A)[0];
  const s = plan(ED, { players: { [p]: { born: "1910-01-01" } } });
  ok("an editor may not change a player's date of birth", s.errors.some(e => /overseer's to change/.test(e)), s.errors); }
{ const s = plan(ED, { teams: { [teamKey(A)]: { name: "Arminia Berlin", home: "#112233" } } });
  ok("an editor renames and recolours their club outright", !s.errors.length && after(s.apply).teams.find(t => t.id === A.id).name === "Arminia Berlin" && !s.requests.length, s); }
{ const s = plan(ED, { teams: { [teamKey(A)]: { name: "Arminia Neu", stadium: "Neues Stadion (40,000)", location: "Berelstein", code: "ARN" } } });
  const r = s.requests[0];
  ok("a code, ground or city goes to the overseer as a request", !s.errors.length && s.requests.length === 1 && r.kind === "details" && r.needs[OVERSEER] && r.patch.code === "ARN" && !("code" in (s.apply?.teams?.[teamKey(A)] || {})), s);
  ok("the rest of that side's change goes live", after(s.apply).teams.find(t => t.id === A.id).name === "Arminia Neu");
  const a = settle(ED, r, "accept"); ok("an editor cannot answer it", a.errors?.length > 0, a);
  const o = settle(OV, r, "accept"); ok("the overseer's accept applies it", !o.errors.length && after(o.apply).teams.find(t => t.id === A.id).code === "ARN", o); }
{ const s = plan(ED, { teams: { [teamKey(B)]: { name: "Nope" } } });
  ok("an editor may not touch another nation's side", s.errors.some(e => /not one of your teams/.test(e)), s.errors); }

console.log("trades");
const star = ids(B)[10], mine = ids(A)[13];
{ const s = plan(ED, { trades: [{ id: "x", side: teamKey(A), other: teamKey(B), ins: [{ kind: "player", id: star }], outs: [] }] });
  ok("a one-way trade into a full squad is refused before it is sent", s.errors.some(e => /no free place/.test(e)), s.errors); }
let tradeReq;
{ const s = plan(ED, { trades: [{ id: "x", side: teamKey(A), other: teamKey(B), ins: [{ kind: "player", id: star }], outs: [{ kind: "player", id: mine }] }] });
  tradeReq = s.requests[0];
  ok("an exchange becomes a request to the other nation", !s.errors.length && tradeReq?.kind === "trade" && tradeReq.needs[teamKey(B)] && !s.apply, s);
  ok("it locks only the men in it", JSON.stringify(tradeReq.locks.sort()) === JSON.stringify(["p:" + mine, "p:" + star].sort()), tradeReq?.locks);
  const busy = plan(ED, { teams: { [teamKey(A)]: { squad: vacate(ids(A), 13, h.labels(A), posFitCost, h.ovr) } } }, [tradeReq]);
  ok("a man in a waiting trade cannot be moved", busy.errors.some(e => /waiting on a request/.test(e)), busy.errors);
  const other = plan(ED, { teams: { [teamKey(A)]: { formation: "4-4-2", squad: ids(A) } } }, [tradeReq]);
  ok("the rest of the side stays editable", !other.errors.length, other.errors);
  const no = settle(ED, tradeReq, "accept"); ok("the asking side cannot accept it", no.errors?.length > 0, no);
  const yes = settle(NCH_ED, tradeReq, "accept"), n = yes.apply && after(yes.apply);
  ok("the other nation's accept swaps the two men", !yes.errors.length && ids(n.teams.find(t => t.id === A.id)).includes(star) && ids(n.teams.find(t => t.id === B.id)).includes(mine)
    && !ids(n.teams.find(t => t.id === A.id)).includes(mine), yes.errors); }
{ // A one-way trade once the side has made room: a bench man released in the same cart.
  const sq = vacate(ids(A), 15, h.labels(A), posFitCost, h.ovr);
  const s = plan(ED, { teams: { [teamKey(A)]: { squad: sq } }, trades: [{ id: "y", side: teamKey(A), other: teamKey(B), ins: [{ kind: "player", id: star }], outs: [] }] });
  ok("a one-way trade fits once a place is open", !s.errors.length && s.requests[0]?.kind === "trade" && s.apply, s.errors);
  const next = after(s.apply), yes = settle(NCH_ED, s.requests[0], "accept", {}, next);
  ok("accepted later, it lands in the open place", !yes.errors.length && ids(after(yes.apply, next).teams.find(t => t.id === A.id)).includes(star), yes.errors); }
{ const s = plan(ED, { trades: [{ id: "z", side: teamKey(A), other: teamKey(A2), ins: [{ kind: "player", id: ids(A2)[12] }], outs: [{ kind: "player", id: ids(A)[12] }] }] });
  ok("a trade between two of one's own clubs is refused", s.errors.some(e => /both are yours/.test(e)), s.errors); }
{ const s = plan(OV, { trades: [{ id: "o", side: teamKey(A), other: teamKey(B), ins: [{ kind: "player", id: star }], outs: [{ kind: "player", id: mine }] }] });
  ok("the overseer's trade goes live as it stands", !s.errors.length && !s.requests.length && ids(after(s.apply).teams.find(t => t.id === A.id)).includes(star), s.errors); }
{ const d = settle(NCH_ED, tradeReq, "decline", { note: "Not for sale" });
  ok("a decline keeps the request with its note", !d.errors.length && d.request?.declined?.note === "Not for sale", d);
  const free = plan(ED, { teams: { [teamKey(A)]: { squad: vacate(ids(A), 13, h.labels(A), posFitCost, h.ovr) } } }, [d.request]);
  ok("a declined request locks nobody", !free.errors.length, free.errors);
  const w = settle(ED, d.request, "withdraw"); ok("its maker dismisses it", !w.errors.length && w.request === null, w); }

console.log("new records");
const freeA = vacate(ids(A), 15, h.labels(A), posFitCost, h.ovr);
{ const s = plan(ED, { new: [{ id: "n1", what: "players", name: "Hans MÜLLER", nat: "ALE", born: "1912-03-04", pos: "ST", ovr: 70, side: teamKey(A) }] });
  ok("a new player needs a free place at his side", s.errors.some(e => /no free place/.test(e)), s.errors); }
{ const s = plan(ED, { teams: { [teamKey(A)]: { squad: freeA } }, new: [{ id: "n1", what: "players", name: "Hans MÜLLER", nat: "ALE", born: "1912-03-04", pos: "ST", ovr: 70, side: teamKey(A) }] });
  const r = s.requests.find(x => x.kind === "new");
  ok("a new player is a request to the overseer, with the rating the editor proposes", !s.errors.length && r?.needs[OVERSEER] && r.rec.ovr === 70, s.errors);
  const next = after(s.apply);
  const no = settle(ED, r, "accept", {}, next); ok("an editor cannot let him in", no.errors?.length > 0, no);
  const yes = settle(OV, r, "accept", { edits: { ovr: 66 } }, next), n2 = yes.apply && after(yes.apply, next), made = n2?.players.find(p => p.name === "Hans MÜLLER");
  ok("the overseer lets him in as edited, onto his side", !yes.errors.length && made?.ovr === 66 && ids(n2.teams.find(t => t.id === A.id)).includes(made.id), yes.errors); }
{ const s = plan(ED, { new: [{ id: "n2", what: "players", name: "Taro YAMADA", nat: "NCH", born: "1912-03-04", pos: "CM", ovr: 70, side: "" }] });
  ok("an editor's new player is of their own nation", s.errors.some(e => /not a nationality of yours/.test(e)), s.errors); }
{ const s = plan(ED, { new: [{ id: "n3", what: "managers", name: "Karl BAUER", nat: "ALE", born: "1890-05-06", style: "counterattack", ovr: 72 }] });
  const r = s.requests[0], yes = r && settle(OV, r, "accept");
  ok("a new manager is let in by the overseer", !s.errors.length && !yes.errors.length && after(yes.apply).managers.some(m => m.name === "Karl BAUER" && m.style === "Counter-Attack"), [s.errors, yes?.errors]); }
{ // A new club: sixteen men from the bench of each other ALE club, and no manager.
  const clubs = rec.teams.filter(t => t.file === "ALE" && t.id !== A.id).slice(0, 16), squad = clubs.map(t => ids(t)[15]).filter(Boolean);
  while (squad.length < 16) squad.push(ids(clubs[0])[14 - (16 - squad.length)]);
  const group = A.group;
  const s = plan(ED, { new: [{ id: "n4", what: "teams", name: "FC Neustadt", nation: "ALE", code: "NEU", home: "#123456", away: "#ffffff", stadium: "Neustadion (12,000)",
    location: "Berelstein", group, formation: "4-3-3", manager: null, squad }] });
  const r = s.requests[0];
  ok("a new club is a request to the overseer, locking its men", !s.errors.length && r?.kind === "new" && r.locks.length === 16, s.errors);
  const yes = r && settle(OV, r, "accept"), n3 = yes?.apply && after(yes.apply), club = n3?.teams.find(t => t.name === "FC Neustadt");
  ok("let in, it joins its nation's league with its sixteen", !yes.errors.length && club?.file === "ALE" && club.group === group && ids(club).filter(Boolean).length === 16, yes?.errors);
  ok("and its men have left their old clubs", !!club && ids(club).every(id => !id || n3.teams.filter(t => t.file === "ALE" && t.id !== club.id).every(t => !ids(t).includes(id)))); }

console.log("leagues");
const lg = (id) => rec.leagues.find(l => l.id === id), AO = rec.leagues.find(l => l.name === "Alemannische Oberliga"), NL1 = rec.leagues.find(l => l.name === "Nichirin League One");
{ const s = plan(ED, { leagues: { [AO.id]: { name: "Bundesliga Alemannia", tier: 1 } } }), n = s.apply && after(s.apply), l = n?.leagues.find(x => x.id === AO.id);
  ok("an editor renames their league outright", !s.errors.length && !s.requests.length && l?.name === "Bundesliga Alemannia", s.errors);
  ok("its clubs carry the new name", !!n && n.teams.filter(t => t.group === "Bundesliga Alemannia").length === rec.teams.filter(t => t.group === AO.name).length
    && !n.teams.some(t => t.group === AO.name));
  ok("and the old one is kept", JSON.stringify(l?.formerly) === JSON.stringify([AO.name]), l); }
{ const s = plan(ED, { leagues: { [NL1.id]: { name: "Nope League" } } });
  ok("an editor may not touch another nation's league", s.errors.some(e => /not one of your leagues/.test(e)), s.errors); }
{ const s = plan(ED, { leagues: { [AO.id]: { name: "2. Alemannische Oberliga" } } });
  ok("a league's name is free", s.errors.some(e => /already called/.test(e)), s.errors); }
{ const s = plan(ED, { leagues: { [AO.id]: { tier: 9 } } });
  ok("a tier is 1 to 5 or none", s.errors.some(e => /a tier is/.test(e)), s.errors); }
{ const s = plan(ED, { leagues: { [AO.id]: { cup: "Alemannischer Pokal" } } }), t = plan(ED, { leagues: { [AO.id]: { cup: "Nichirin League One" } } });
  ok("a new cup is a name", !s.errors.length && after(s.apply).leagues.find(x => x.id === AO.id).cup === "Alemannischer Pokal", s.errors);
  ok("never a league's", t.errors.some(e => /not a usable cup/.test(e)), t.errors); }
const ESU_ED = "that1sealguy";
const man = (name, pos, ovr) => ({ name, pos, nat: "ESU", born: "1910-05-05", ovr });
const founding = (code, ovrs) => ({ name: "Test " + code, code, home: "#112233", away: "#ffffff", stadium: "Test Park (5,000)", location: "Testopolis", formation: "4-4-2",
  manager: { name: "Max MANAGER", nat: "ESU", born: "1890-01-01", style: "counterattack", ovr: null },
  squad: ["GK", "LB", "CB", "CB", "RB", "LM", "CM", "CM", "RM", "ST", "ST"].map((pos, i) => man(`Player ${code}${i} TEST`, pos, ovrs[i] ?? null)).concat([null, null, null, null, null]) });
const NEWL = { id: "L1", what: "leagues", name: "E.S.U. Test League", nation: "ESU", tier: 1, cup: null, clubs: [founding("TQA", [70, 68, null, 66]), founding("TQB", [])] };
let leagueReq;
{ const s = plan(ESU_ED, { new: [NEWL] });
  leagueReq = s.requests[0];
  ok("a club-less nation's editor asks for a league, ratings left blank", !s.errors.length && leagueReq?.kind === "new" && leagueReq.what === "leagues" && leagueReq.needs[OVERSEER], s.errors);
  ok("it holds nobody already on file", (leagueReq?.locks || []).length === 0, leagueReq?.locks);
  const no = settle(OV, leagueReq, "accept");
  ok("the overseer cannot let it in with ratings blank", no.errors?.some(e => /a rating is a whole number/.test(e)), no.errors); }
{ const s = plan(ESU_ED, { new: [{ ...NEWL, nation: "NCH" }] });
  ok("an editor's league is of their own nation", s.errors.some(e => /not a nation of yours/.test(e)), s.errors); }
{ const s = plan(ESU_ED, { new: [{ ...NEWL, clubs: [{ ...founding("SPK", []) }] }] });
  ok("a founding club's code is free", s.errors.some(e => /the code SPK is taken/.test(e)), s.errors); }
{ const rated = (c) => ({ ...c, manager: { ...c.manager, ovr: 70 }, squad: c.squad.map(v => v && { ...v, ovr: v.ovr ?? 60 }) });
  const edits = { ...leagueReq.rec, clubs: leagueReq.rec.clubs.map(rated) };
  const yes = settle(OV, leagueReq, "accept", { edits }), n = yes.apply && after(yes.apply);
  const L = n?.leagues.find(l => l.name === NEWL.name), clubs = n?.teams.filter(t => t.group === NEWL.name) || [];
  ok("rated, the overseer lets it in", !yes.errors?.length && !!L && L.listed && L.nation === "ESU", yes.errors);
  ok("its clubs on the nation's own sheet, sixteen places each", clubs.length === 2 && clubs.every(t => t.file === "ESU" && t.squad.length === 16 && ids(t).filter(Boolean).length === 11));
  ok("its new men on file with the ratings set", clubs.every(t => ids(t).filter(Boolean).every(id => n.players.find(p => p.id === id)?.ovr >= 25))
    && n.players.some(p => p.name === "Player TQA0 TEST" && p.ovr === 70) && clubs.every(t => n.managers.find(m => m.id === t.manager)?.ovr === 70));
  const sheets = n && sheetsFromRecords(n);
  ok("and the nation gets a sheet", !!sheets?.ESU && sheets.ESU.split("\n").length === 3 && sheets.ESU.includes("E.S.U. Test League"), Object.keys(sheets || {})); }
{ const rated = { ...NEWL, clubs: NEWL.clubs.map(c => ({ ...c, manager: { ...c.manager, ovr: 66 }, squad: c.squad.map(v => v && { ...v, ovr: 61 }) })) };
  const s = plan(OV, { new: [rated] }), n = s.apply && after(s.apply);
  ok("the overseer's own league goes straight in", !s.errors.length && !s.requests.length && n?.leagues.some(l => l.name === NEWL.name), s.errors); }
{ const s = plan(ED, { teams: { [teamKey(A)]: { squad: freeA } }, new: [{ id: "n9", what: "players", name: "Otto BLANK", nat: "ALE", born: "1912-03-04", pos: "CM", ovr: null, side: teamKey(A) }] });
  const r = s.requests.find(x => x.kind === "new"), next = s.apply && after(s.apply);
  ok("an ordinary new player may leave his rating to the overseer", !s.errors.length && r?.rec.ovr == null, s.errors);
  const no = settle(OV, r, "accept", {}, next), yes = settle(OV, r, "accept", { edits: { ovr: 64 } }, next);
  ok("who must set it to let him in", no.errors?.length > 0 && !yes.errors?.length && after(yes.apply, next).players.some(p => p.name === "Otto BLANK" && p.ovr === 64), [no.errors, yes.errors]); }

console.log("lists of new players");
const lad = (name, pos, ovr = null, nat = "ALE") => ({ name, pos, nat, born: "1912-06-06", ovr });
const LIST = { id: "b1", what: "batch", name: "3 New Players", side: null, men: [lad("Erich EINS", "GK"), lad("Fritz ZWEI", "CB"), lad("Gustav DREI", "ST", 63)] };
let batchReq;
{ const s = plan(ED, { new: [LIST] }); batchReq = s.requests[0];
  ok("an editor asks for a list of new players, ratings blank", !s.errors.length && batchReq?.what === "batch" && batchReq.needs[OVERSEER], s.errors);
  const no = settle(OV, batchReq, "accept");
  ok("the overseer cannot let them in unrated", no.errors?.some(e => /a rating is a whole number/.test(e)), no.errors);
  const yes = settle(OV, batchReq, "accept", { edits: { men: LIST.men.map(m => ({ ...m, ovr: m.ovr ?? 60 })) } }), n = yes.apply && after(yes.apply);
  ok("rated, they come in as free agents with their positions", !yes.errors?.length && ["Erich EINS", "Fritz ZWEI", "Gustav DREI"].every(nm => { const p = n.players.find(x => x.name === nm);
    return p && p.ovr >= 25 && p.pos; }) && n.players.find(x => x.name === "Gustav DREI").ovr === 63, yes.errors); }
{ const s = plan(ED, { new: [{ ...LIST, men: [lad("Taro FREMD", "CM", null, "NCH")] }] });
  ok("an editor's list is of their own nationals", s.errors.some(e => /not a nationality of yours/.test(e)), s.errors); }
{ const s = plan(ED, { new: [{ ...LIST, side: teamKey(A) }] });
  ok("a list joining a full side is refused", s.errors.some(e => /has room for 0 of the 3/.test(e)), s.errors); }
{ const two = vacate(vacate(ids(A), 15, h.labels(A), posFitCost, h.ovr), 14, h.labels(A), posFitCost, h.ovr);
  const men = [lad("Hans LINKS", "ST", 60), lad("Karl RECHTS", "GK", 61)];
  const s = plan(ED, { teams: { [teamKey(A)]: { squad: two } }, new: [{ ...LIST, side: teamKey(A), men }] }), next = s.apply && after(s.apply);
  const yes = settle(OV, s.requests[0], "accept", {}, next), n = yes.apply && after(yes.apply, next), club = n?.teams.find(t => t.id === A.id);
  ok("a list joining a side fills its open places", !s.errors.length && !yes.errors?.length && ["Hans LINKS", "Karl RECHTS"].every(nm => ids(club).includes(n.players.find(p => p.name === nm)?.id)), [s.errors, yes.errors]); }

console.log("positions (Moukden and Kirin, 11 October 2026)");
{ const p = ids(A)[5];
  const s = plan(OV, { players: { [p]: { pos: ["CM", "DM"] } } });
  ok("the overseer changes a player's positions outright", !s.errors.length && !s.requests.length && after(s.apply).players.find(x => x.id === p).pos.join("/") === "CM/DM", s); }
{ const p = ids(A)[5];
  const s = plan(ED, { players: { [p]: { pos: ["CM", "DM"] } } }), r = s.requests[0];
  ok("an editor's change to one of their players' positions is a request to the overseer", !s.errors.length && !s.apply && r?.kind === "pos" && Object.keys(r.needs).join() === OVERSEER, s);
  const no = settle(ED, r, "accept");
  ok("...which only the overseer answers", no.errors.length > 0, no);
  const yes = settle(OV, r, "accept");
  ok("...and his accept lets it in", !yes.errors.length && yes.done && after(yes.apply).players.find(x => x.id === p).pos.join("/") === "CM/DM", yes); }
{ const p = ids(B)[5];
  const s = plan(ED, { players: { [p]: { pos: ["ST"] } } });
  ok("an editor cannot ask for another nation's player", s.errors.some(e => /not one of your players/.test(e)), s.errors); }
{ const p = ids(A)[5];
  const three = plan(OV, { players: { [p]: { pos: ["CM", "DM", "AM"] } } }), none = plan(OV, { players: { [p]: { pos: ["XX"] } } });
  ok("three positions, or one that is not a position, are refused", three.errors.some(e => /one or two positions/.test(e)) && none.errors.some(e => /one or two positions/.test(e)), [three.errors, none.errors]); }
{ const s = plan(OV, { new: [{ id: "n1", what: "players", name: "Test TWOPOS", nat: "ALE", born: "1910-05-05", pos: ["CB", "RB"], ovr: 60 }] });
  const np = s.apply && after(s.apply).players.find(x => x.name === "Test TWOPOS");
  ok("a new player keeps both his positions", !s.errors.length && np?.pos?.join("/") === "CB/RB", s.errors); }
{ // A release, then a signing into the place it opened: the substitutes end in the places their groups fit.
  const sq = ids(A), lab = slotLabels(sposFor, String(A.formation).trim(), sq.length), gk = sq[11], fwd = sq[15];
  const swapped = [...sq]; swapped[11] = fwd; swapped[15] = gk;
  const s = plan(OV, { teams: { [teamKey(A)]: { squad: swapped } } });
  ok("a substitute may sit in another group's place: the app marks it, nothing refuses it", !s.errors.length, s.errors); }

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
