// THE REGISTRY'S RULES (src/data/rules.js), on the real records: what an editor may change outright, what goes to the
// overseer as a request (a code, a ground, a city; a new player, manager or club), a trade with another nation (one way
// and an exchange) and its answer, the men a waiting request locks, and a decline's note; and deals (src/data/deals.js),
// between any number of clubs, with free agency, their offers, counters and every club's accept. Every case is checked the way
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
writeFileSync(ENTRY, ["data/rules.js", "data/draft.js", "data/squads.js", "data/positions.js", "data/sheets.js", "data/roll.js"].map(f => `export * from ${JSON.stringify(join(ROOT, "src", f))};`).join("\n")
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
const h = { labels: (t) => slotLabels(sposFor, String(t.formation).trim(), t.squad.length, !["AVIUM", "ARTERRA"].includes(t.file)), fit: posFitCost, ovr: (id) => ovr.get(id) ?? 0, pos: (id) => posOfRec.get(id) || [] };
const ids = (t) => t.squad.map(v => idOf(v) ?? null);
const ED = "mrrv533-creator", OV = "auroruse", NCH_ED = "auroruse";       // ALE's editor; the overseer (who also edits NCH)
const A = rec.teams.find(t => t.file === "ALE" && t.code === "ARM"), A2 = rec.teams.find(t => t.file === "ALE" && t.code === "HAN");
const B = rec.teams.find(t => t.file === "NCH" && t.code === "SPK");
const plan = (login, cart, pending = [], r = rec) => planSave(r, editors, pending, login, { v: 1, players: {}, ...cart }, h, "2026-10-10T00:00:00Z", (() => { let i = 0; return () => "r" + ++i; })());
const settle = (login, req, action, extra, r = rec) => settleRequest(r, editors, req, login, action, h, extra);
const after = (d, r = rec) => applyDraft(r, d);
// Clubs have twenty-two places with six open (12 October 2026), so a full squad is one with those six filled: from men
// at no club and in no national squad.
const placed = new Set(rec.teams.flatMap(t => ids(t)).filter(Boolean));
const spare = rec.players.filter(p => !p.retired && !placed.has(p.id)).map(p => p.id);
const fullOf = (keys) => { let k = 0; return { ...rec, teams: rec.teams.map(t => keys.includes(teamKey(t)) ? { ...t, squad: t.squad.map(v => v ?? spare[k++]) } : t) }; };

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
{ const s = plan(ED, { trades: [{ id: "x", side: teamKey(A), other: teamKey(B), ins: [{ kind: "player", id: star }], outs: [] }] }, [], fullOf([teamKey(A), teamKey(B)]));
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
{ const s = plan(ED, { new: [{ id: "n1", what: "players", name: "Hans MÜLLER", nat: "ALE", born: "1912-03-04", pos: "ST", ovr: 70, side: teamKey(A) }] }, [], fullOf([teamKey(A)]));
  ok("a new player needs a free place at his side", s.errors.some(e => /no free place/.test(e)), s.errors); }
{ const s = plan(ED, { teams: { [teamKey(A)]: { squad: freeA } }, new: [{ id: "n1", what: "players", name: "Hans MÜLLER", nat: "ALE", born: "1912-03-04", pos: "ST", ovr: 70, side: teamKey(A) }] });
  const r = s.requests.find(x => x.kind === "new");
  ok("a new player is a request to the overseer, with the rating the editor proposes", !s.errors.length && r?.needs[OVERSEER] && r.rec.ovr === 70, s.errors);
  const next = after(s.apply);
  const no = settle(ED, r, "accept", {}, next); ok("an editor cannot let him in", no.errors?.length > 0, no);
  const yes = settle(OV, r, "accept", { edits: { ovr: 66 } }, next), n2 = yes.apply && after(yes.apply, next), made = n2?.players.find(p => p.name === "Hans MÜLLER");
  ok("the overseer lets him in as edited, onto his side", !yes.errors.length && made?.ovr === 66 && ids(n2.teams.find(t => t.id === A.id)).includes(made.id), yes.errors); }
// Another nation's player, from an editor: rated below that nation's level, its national side's rating as the app shows it.
const NCH_LVL = R.natLevel(rec, "NCH");
const taro = (ovr) => ({ id: "n2", what: "players", name: "Taro YAMADA", nat: "NCH", born: "1912-03-04", pos: "CM", ovr, side: "" });
{ const s = plan(ED, { new: [taro(NCH_LVL - 1)] }), r = s.requests.find(x => x.kind === "new");
  ok("an editor may ask for another nation's player rated below its level", !s.errors.length && r?.rec.nat === "NCH", s.errors);
  const yes = r && settle(OV, r, "accept");
  ok("which the overseer lets in", !yes?.errors?.length && after(yes.apply).players.some(p => p.name === "Taro YAMADA" && p.ovr === NCH_LVL - 1), yes?.errors); }
{ const at = plan(ED, { new: [taro(NCH_LVL)] }), blank = plan(ED, { new: [taro(null)] });
  ok("but not at its level", at.errors.some(e => e === `Taro YAMADA: a Nichirin national needs a rating below ${NCH_LVL}`), at.errors);
  ok("nor unrated", blank.errors.some(e => /needs a rating below/.test(e)), blank.errors); }
{ const s = plan(ED, { new: [{ id: "n2", what: "managers", name: "Taro YAMADA", nat: "NCH", born: "1880-03-04", style: "counterattack", ovr: 60 }] });
  ok("an editor's new manager is of their own nation", s.errors.some(e => /not a nationality of yours/.test(e)), s.errors); }
// Traits on an editor's new player: what his rating can afford, gold 3, silver 2, bronze 1 (82: three points, two traits).
const hans = (ovr, badges) => ({ id: "n5", what: "players", name: "Hans TRAIT", nat: "ALE", born: "1912-03-04", pos: "ST", ovr, badges, side: "" });
{ const s = plan(ED, { new: [hans(82, ["finisher"])] }), r = s.requests.find(x => x.kind === "new");
  ok("an editor's new player may carry the traits his rating affords", !s.errors.length && r?.rec.badges?.[0] === "finisher", s.errors);
  const yes = r && settle(OV, r, "accept");
  ok("and keeps them when the overseer lets him in", !yes?.errors?.length && after(yes.apply).players.some(p => p.name === "Hans TRAIT" && p.badges?.join() === "finisher"), yes?.errors); }
{ const over = plan(ED, { new: [hans(82, ["finisher", "vision"])] }), blank = plan(ED, { new: [hans(null, ["crosser"])] }), low = plan(ED, { new: [hans(74, ["crosser"])] });
  ok("but not more than his budget", over.errors.some(e => /worth 5 points, over the 3 a 82 has/.test(e)), over.errors);
  ok("nor any without a rating of 75 or more", blank.errors.some(e => /need a rating of 75/.test(e)) && low.errors.some(e => /need a rating of 75/.test(e)), [blank.errors, low.errors]); }
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
{ const foreign = (ovr) => ({ ...NEWL, clubs: [{ ...NEWL.clubs[0], squad: NEWL.clubs[0].squad.map((v, i) => (i === 10 ? { ...v, nat: "NCH", ovr } : v)) }, NEWL.clubs[1]] });
  const s = plan(ESU_ED, { new: [foreign(null)] }), t = plan(ESU_ED, { new: [foreign(NCH_LVL - 1)] });
  ok("a founding club's man of another nation needs a rating below its level", s.errors.some(e => /a Nichirin national needs a rating below/.test(e)) && !t.errors.length, [s.errors, t.errors]); }
{ const sq = Array.from({ length: 16 }, (_, i) => ({ pos: i ? "CM" : "GK", ovr: "", nat: i % 2 ? "NCH" : "ESU" })), lab = sq.map(v => v.pos);
  const rolled = R.rollSquad(sq, lab, 80, () => null, Math.random, (v) => (v.nat === "NCH" ? 70 : 99));
  ok("the rating roll keeps such a man under his ceiling", rolled.every(v => v.nat !== "NCH" || +v.ovr <= 70) && rolled.some(v => v.nat === "ESU" && +v.ovr > 70), rolled.map(v => v.nat + v.ovr)); }
{ const s = plan(ESU_ED, { new: [{ ...NEWL, clubs: [{ ...founding("SPK", []) }] }] });
  ok("a founding club's code is free", s.errors.some(e => /the code SPK is taken/.test(e)), s.errors); }
{ const rated = (c) => ({ ...c, manager: { ...c.manager, ovr: 70 }, squad: c.squad.map(v => v && { ...v, ovr: v.ovr ?? 60 }) });
  const edits = { ...leagueReq.rec, clubs: leagueReq.rec.clubs.map(rated) };
  const yes = settle(OV, leagueReq, "accept", { edits }), n = yes.apply && after(yes.apply);
  const L = n?.leagues.find(l => l.name === NEWL.name), clubs = n?.teams.filter(t => t.group === NEWL.name) || [];
  ok("rated, the overseer lets it in", !yes.errors?.length && !!L && L.listed && L.nation === "ESU", yes.errors);
  ok("its clubs on the nation's own sheet, twenty-two places each", clubs.length === 2 && clubs.every(t => t.file === "ESU" && t.squad.length === 22 && ids(t).filter(Boolean).length === 11));
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
{ const s = plan(ED, { new: [{ ...LIST, men: [lad("Taro FREMD", "CM", null, "NCH")] }] }), t = plan(ED, { new: [{ ...LIST, men: [lad("Taro FREMD", "CM", NCH_LVL - 1, "NCH")] }] });
  ok("another nation's men in a list need ratings below its level", s.errors.some(e => /^Taro FREMD: a Nichirin national needs a rating below/.test(e)) && !t.errors.length, [s.errors, t.errors]); }
{ const ok1 = plan(ED, { new: [{ ...LIST, men: [{ ...lad("Fritz SILBER", "CM", 78), badges: ["vision"] }] }] }), bad1 = plan(ED, { new: [{ ...LIST, men: [{ ...lad("Fritz SILBER", "CM", 78), badges: ["vision", "crosser"] }] }] });
  ok("a man in a list carries what his rating affords, and no more", !ok1.errors.length && bad1.errors.some(e => /^Fritz SILBER: traits worth 3 points, over the 2 a 78 has/.test(e)), [ok1.errors, bad1.errors]); }
{ const s = plan(ED, { new: [{ ...LIST, side: teamKey(A) }] }, [], fullOf([teamKey(A)]));
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

console.log("deals (Trades, 11 October 2026)");
{ const SKJ_ED = "SwiftorArrow", C = rec.teams.find(t => t.file === "SKJ" && t.nation === "SKJ"), k = teamKey;
  const a = ids(A), b = ids(B), c = ids(C), clubOf = (d, id) => after(d).teams.find(t => !["AVIUM", "ARTERRA"].includes(t.file) && ids(t).includes(id))?.id || "free";
  const p1 = plan(ED, { deals: [{ sides: [k(A), k(B)], moves: [{ kind: "player", id: a[0], to: k(B) }, { kind: "player", id: b[5], to: k(A) }] }] }), r1 = p1.requests[0];
  ok("a swap with another nation's club is an offer to it", !p1.errors.length && !p1.apply && r1?.kind === "deal" && Object.keys(r1.needs).join() === k(B), p1);
  ok("it locks only its men", JSON.stringify(r1.locks.sort()) === JSON.stringify(["p:" + a[0], "p:" + b[5]].sort()), r1?.locks);
  ok("its sender cannot accept it", settle(ED, r1, "accept").errors?.length > 0);
  const y1 = settle(NCH_ED, r1, "accept");
  ok("the other club's accept puts it live", y1.done && clubOf(y1.apply, a[0]) === B.id && clubOf(y1.apply, b[5]) === A.id, y1);
  const c1 = settle(NCH_ED, r1, "counter", { moves: [{ kind: "player", id: a[0], to: k(B) }, { kind: "player", id: b[7], to: k(A) }], others: [r1] });
  ok("a counter goes back from the other side, waiting on the first", !c1.errors.length && c1.request.team === k(B) && c1.request.rounds === 2 && Object.keys(c1.request.needs).join() === k(A), c1);
  ok("...whose accept puts it live", settle(ED, c1.request, "accept").done);
  const busy = plan(ED, { deals: [{ sides: [k(A), k(B)], moves: [{ kind: "player", id: a[0], to: k(B) }, { kind: "player", id: b[6], to: k(A) }] }] }, [r1]);
  ok("a man in a waiting offer cannot go in another", busy.errors.some(e => /waiting on a request/.test(e)), busy.errors);
  const full = fullOf([k(A), k(B)]);
  const one = plan(ED, { deals: [{ sides: [k(A), k(B)], moves: [{ kind: "player", id: a[1], to: k(B) }] }] }, [], full);
  ok("one man into a full squad asks who makes way", one.errors.some(e => /pick who makes way/.test(e)), one.errors);
  const way = plan(ED, { deals: [{ sides: [k(A), k(B)], moves: [{ kind: "player", id: a[1], to: k(B) }, { kind: "player", id: b[15], to: null }] }] }, [], full);
  ok("with one of theirs released it is an offer", !way.errors.length && way.requests[0]?.kind === "deal", way.errors);
  const own = plan(ED, { deals: [{ sides: [k(A), k(A2)], moves: [{ kind: "player", id: a[12], to: k(A2) }, { kind: "player", id: ids(A2)[12], to: k(A) }] }] });
  ok("a deal between one's own clubs goes live", !own.errors.length && !own.requests.length && clubOf(own.apply, a[12]) === A2.id, own.errors);
  const clubbed = new Set(rec.teams.filter(t => !["AVIUM", "ARTERRA"].includes(t.file)).flatMap(ids)), fa = rec.players.find(p => !p.retired && !clubbed.has(p.id));
  const sign = plan(ED, { deals: [{ sides: [k(A)], moves: [{ kind: "player", id: fa.id, to: k(A) }, { kind: "player", id: a[15], to: null }] }] });
  ok("a signing with a release goes live", !sign.errors.length && clubOf(sign.apply, fa.id) === A.id && clubOf(sign.apply, a[15]) === "free", sign.errors);
  // The first offer sent their keeper's place a midfielder's way: the bench keeper takes it, the midfielder the bench.
  ok("a keeper's place goes to no outfielder", after(y1.apply).teams.find(t => t.id === A.id).squad.map(idOf)[0] === a[11], after(y1.apply).teams.find(t => t.id === A.id).squad.map(idOf));
  const ov = plan(OV, { deals: [{ sides: [k(B), k(A)], moves: [{ kind: "player", id: b[5], to: k(A) }, { kind: "player", id: a[0], to: k(B) }] }] });
  ok("the overseer's deal goes live as it stands", !ov.errors.length && !ov.requests.length && clubOf(ov.apply, a[0]) === B.id, ov.errors);
  const ovo = plan(OV, { deals: [{ sides: [k(B), k(A)], offer: true, moves: [{ kind: "player", id: b[5], to: k(A) }, { kind: "player", id: a[0], to: k(B) }] }] });
  ok("sent as an offer, the overseer's waits on the other nation's editor", !ovo.errors.length && !ovo.apply && JSON.stringify(ovo.requests[0]?.needs) === JSON.stringify({ [k(A)]: [ED] }), ovo);
  const B2 = rec.teams.find(t => t.file === "NCH" && t.id !== B.id);
  const ovn = plan(OV, { deals: [{ sides: [k(B), k(B2)], offer: true, moves: [{ kind: "player", id: b[12], to: k(B2) }, { kind: "player", id: ids(B2)[12], to: k(B) }] }] });
  ok("an offer between his own nation's clubs is refused", ovn.errors.some(e => /Nobody else answers/.test(e)), ovn.errors);
  const tri = plan(ED, { deals: [{ sides: [k(A), k(B), k(C)], moves: [{ kind: "player", id: a[12], to: k(B) }, { kind: "player", id: b[12], to: k(C) }, { kind: "player", id: c[12], to: k(A) }] }] }), r3 = tri.requests[0];
  ok("a three-club swap waits on both other nations", !tri.errors.length && Object.keys(r3?.needs || {}).sort().join() === [k(B), k(C)].sort().join() && r3.sides.length === 3, tri);
  const n3 = settle(SKJ_ED, r3, "accept");
  ok("one club's accept leaves it waiting on the other", !n3.done && JSON.stringify(n3.request?.approved) === JSON.stringify([k(C)]), n3);
  const y3 = settleRequest(rec, { ...editors, overseers: [] }, n3.request, NCH_ED, "accept", h);
  ok("the last club's accept puts it live", y3.done && clubOf(y3.apply, a[12]) === B.id && clubOf(y3.apply, b[12]) === C.id && clubOf(y3.apply, c[12]) === A.id, y3);
  const c3 = settle(SKJ_ED, r3, "counter", { moves: [{ kind: "player", id: a[12], to: k(B) }, { kind: "player", id: b[12], to: k(C) }, { kind: "player", id: c[13], to: k(A) }], others: [r3] });
  ok("a counter from one club waits on every other again", !c3.errors.length && c3.request.team === k(C) && Object.keys(c3.request.needs).sort().join() === [k(A), k(B)].sort().join() && !c3.request.approved.length, c3); }

console.log("a nation's clubs without its national side (the user, 11 October 2026)");
{ const KAR_ED = "zezelandnationstates-hash", TC = rec.teams.find(t => t.file === "TUR" && t.nation === "TUR"), TN = rec.teams.find(t => t.file === "AVIUM" && t.code === "TUR");
  const L = (rec.leagues || []).find(l => l.nation === "TUR");
  const sc = R.scopeOf(editors, KAR_ED);
  ok("the Karjanian editor keeps Turulia's clubs, and Turulia stays off their nations", sc.role === "editor" && sc.clubs.includes("TUR") && !sc.nations.includes("TUR"), sc);
  const club = plan(KAR_ED, { teams: { [teamKey(TC)]: { name: TC.name.trim() + " FC", home: "#123456" } } });
  ok("they rename and recolour a Turulian club outright", !club.errors.length && !club.requests.length && after(club.apply).teams.find(t => t.id === TC.id).home === "#123456", club.errors);
  const nt = plan(KAR_ED, { teams: { [teamKey(TN)]: { home: "#123456" } } });
  ok("they cannot touch Turulia's national side", nt.errors.some(e => /not one of your teams/.test(e)), nt.errors);
  const lg = L && plan(KAR_ED, { leagues: { [L.id]: { tier: 2 } } });
  ok("they change the Turulian league outright", L && !lg.errors.length, lg?.errors);
  ok("they answer for a Turulian club, and only for its club", R.ownersOf(editors, TC).includes(KAR_ED) && !R.ownersOf(editors, TN).includes(KAR_ED), [R.ownersOf(editors, TC), R.ownersOf(editors, TN)]);
  const dl = plan(ED, { deals: [{ sides: [teamKey(A), teamKey(TC)], moves: [{ kind: "player", id: ids(A)[12], to: teamKey(TC) }, { kind: "player", id: ids(TC)[12], to: teamKey(A) }] }] });
  ok("an offer to a Turulian club waits on them", !dl.errors.length && JSON.stringify(dl.requests[0]?.needs) === JSON.stringify({ [teamKey(TC)]: [KAR_ED] }), dl); }

console.log("sheet cells a save keeps (11 October 2026)");
// Saving the Dynamo Mizuhara and CSKA Radagorsk trade stripped the nation tags off CSKA men who were not in it: a cell the
// sheet wrote its own way stays as it was while its man stays at the side, and goes when he leaves it.
{ const k = teamKey, DYM = rec.teams.find(t => t.id === "t0205"), CSR = rec.teams.find(t => t.id === "t0200");
  // Compared as a set: the bench sort may move a man into one of the six new places that fits him (12 October 2026).
  const cells = (t) => t.squad.filter(v => v && typeof v === "object").map(v => JSON.stringify(v)).sort();
  const swap = plan(OV, { deals: [{ sides: [k(DYM), k(CSR)], moves: [{ kind: "player", id: "p1182", to: k(CSR) }, { kind: "player", id: "p1422", to: k(DYM) }] }] });
  const csr = swap.apply && after(swap.apply).teams.find(t => t.id === CSR.id);
  ok("a swap leaves the other men's tagged cells as they were", !swap.errors.length && JSON.stringify(cells(csr)) === JSON.stringify(cells(CSR)) && cells(CSR).length === 7, [swap.errors, csr && cells(csr)]);
  ok("...and the sheet still writes them", !!csr && sheetsFromRecords(after(swap.apply)).MISC.includes("[RUD]\t") && (sheetsFromRecords(after(swap.apply)).MISC.match(/\[RUD\]/g) || []).length === (sheetsFromRecords(rec).MISC.match(/\[RUD\]/g) || []).length);
  const out = plan(OV, { deals: [{ sides: [k(DYM), k(CSR)], moves: [{ kind: "player", id: "p1182", to: k(CSR) }, { kind: "player", id: "p1222", to: k(DYM) }] }] });
  const n = out.apply && after(out.apply), dym = n?.teams.find(t => t.id === DYM.id), csr2 = n?.teams.find(t => t.id === CSR.id);
  ok("a tagged man who leaves is written from his record at his new club", !out.errors.length && dym.squad.includes("p1222") && cells(csr2).length === 6, [out.errors, dym?.squad, csr2 && cells(csr2)]);
  const rate = after(plan(OV, { players: { p1222: { ovr: 70 } } }).apply).teams.find(t => t.id === CSR.id);
  ok("a new rating keeps his tag", JSON.stringify(rate.squad[1]) === JSON.stringify({ id: "p1222", tag: "RUD" }), rate.squad[1]);
  const natd = after(plan(OV, { players: { p1222: { nat: "ALE" } } }).apply).teams.find(t => t.id === CSR.id);
  ok("a new nationality writes him fresh", natd.squad[1] === "p1222", natd.squad[1]);
  const VJK = rec.teams.find(t => t.id === "t0170"), raw = after(plan(OV, { players: { p2861: { ovr: 63 } } }).apply).teams.find(t => t.id === VJK.id);
  ok("a cell kept as raw text is written fresh by any edit to its man", raw.squad[2] === "p2861", raw.squad[2]); }

console.log("the sheet (12 October 2026)");
{ const s = plan(ED, { teams: { [teamKey(A)]: { timeWasting: "Constantly" } } });
  ok("an editor sets their side's time wasting outright", !s.errors.length && !s.requests.length && after(s.apply).teams.find(t => t.id === A.id).timeWasting === "Constantly", s.errors);
  const bad = plan(ED, { teams: { [teamKey(A)]: { timeWasting: "Always" } } });
  ok("only Never, Sometimes or Constantly", bad.errors.some(e => /time wasting/.test(e)), bad.errors); }
{ const s = plan(ED, { teams: { [teamKey(A)]: { group: "2. Alemannische Oberliga" } } });
  ok("an editor may not move a club into another league", s.errors.some(e => /overseer's to change/.test(e)), s.errors);
  const o = plan(OV, { teams: { [teamKey(A)]: { group: "2. Alemannische Oberliga" } } });
  ok("the overseer moves one outright", !o.errors.length && after(o.apply).teams.find(t => t.id === A.id).group === "2. Alemannische Oberliga", o.errors); }
{ // A man dragged between two of the editor's own clubs: off one squad, onto the other's open place.
  const a = ids(A), b = ids(A2), man = a[15], sa = [...a]; sa[15] = null; const sb = [...b]; sb[15] = man; const was = b[15];
  const s = plan(ED, { teams: { [teamKey(A)]: { squad: sa }, [teamKey(A2)]: { squad: sb } } });
  ok("a man moves between an editor's own clubs outright", !s.errors.length && after(s.apply).teams.find(t => t.id === A2.id).squad.map(idOf).includes(man), s.errors);
  ok("(the one he replaced goes to free agency)", !after(s.apply).teams.some(t => t.squad.map(idOf).includes(was)) || after(s.apply).teams.filter(t => t.squad.map(idOf).includes(was)).every(t => t.file === "AVIUM")); }
{ // A new man typed into an open place: he lands in that place, not where the best fit would put him.
  const sq = ids(A), open = [...sq]; open[12] = null; const T = after(plan(OV, { teams: { [teamKey(A)]: { squad: open } } }).apply), at = 12;
  const s = plan(OV, { new: [{ id: "n9", what: "players", name: "Hans MUSTER", nat: "ALE", born: "1910-05-05", pos: ["ST"], ovr: 70, side: teamKey(A), at }] }, [], T);
  const n = s.apply && after(s.apply, T), club = n?.teams.find(t => t.id === A.id), p9 = n?.players.find(x => x.name === "Hans MUSTER");
  ok("a new man typed into a place goes to that place", !s.errors.length && !!p9 && club.squad.map(idOf).indexOf(p9.id) === at, [s.errors, club?.squad]); }
{ // A new club with new men of its own and its time wasting.
  const clubs = rec.teams.filter(t => t.file === "ALE" && t.id !== A.id).slice(0, 14), squad = clubs.map(t => ids(t)[15]).filter(Boolean).slice(0, 14);
  squad.push({ name: "Otto NEU", nat: "ALE", born: "1912-02-02", pos: ["GK"], ovr: 68 }, { name: "Emil NEU", nat: "ALE", born: "1913-03-03", pos: ["ST"], ovr: null });
  const s = plan(ED, { new: [{ id: "n5", what: "teams", name: "SV Neudorf", nation: "ALE", code: "NDF", home: "#224466", away: "#ffffff", stadium: "Neudorfer Platz (8,000)",
    location: "Berelstein", group: A.group, formation: "4-3-3", timeWasting: "Sometimes", manager: null, squad }] });
  const r = s.requests[0];
  ok("a new club may bring new men of its own", !s.errors.length && r?.kind === "new", s.errors);
  const r2 = { ...r, rec: { ...r.rec, squad: r.rec.squad.map(v => (v && typeof v === "object" && v.ovr == null ? { ...v, ovr: 66 } : v)) } };
  const yes = settle(OV, r2, "accept", { rec: r2.rec }), n = yes?.apply && after(yes.apply), club = n?.teams.find(t => t.name === "SV Neudorf");
  ok("let in, its new men are records in their places, and it keeps its time wasting", !yes.errors?.length && !!club && club.timeWasting === "Sometimes"
    && ["Otto NEU", "Emil NEU"].every(nm => n.players.some(x => x.name === nm && club.squad.map(idOf).includes(x.id))), [yes?.errors, club?.squad?.slice(-3)]); }

{ // A new manager made in a side's manager cell: a request, and let in he takes the club over with his style.
  const was = idOf(A.manager);
  const s = plan(ED, { new: [{ id: "n7", what: "managers", name: "Karl NEUMANN", nat: "ALE", born: "1885-04-04", style: "counterattack", ovr: null, side: teamKey(A) }] });
  const r = s.requests[0];
  ok("an editor's new manager for their own club is a request", !s.errors.length && r?.kind === "new", s.errors);
  const yes = settle(OV, { ...r, rec: { ...r.rec, ovr: 70 } }, "accept", {}), n = yes?.apply && after(yes.apply), club = n?.teams.find(t => t.id === A.id), m = n?.managers.find(x => x.name === "Karl NEUMANN");
  ok("let in, he manages the club and it plays his style; the old manager keeps only his national side", !yes.errors?.length && !!m && idOf(club.manager) === m.id
    && club.style === "Counter-Attack" && n.teams.filter(t => idOf(t.manager) === was).every(t => t.file === "AVIUM"), [yes?.errors, club?.manager, club?.style]);
  const no = plan(ED, { new: [{ id: "n8", what: "managers", name: "Karl NEUMANN", nat: "ALE", born: "1885-04-04", style: "balanced", ovr: null, side: teamKey(B) }] });
  ok("not for another nation's side", no.errors.some(e => /not one of your sides/.test(e)), no.errors); }

console.log("removing a club (12 October 2026)");
{ const X = rec.teams.find(t => t.file === "ALE" && t.code === "BTV"), K = teamKey(X), men = ids(X).filter(Boolean), mgr = idOf(X.manager);
  const ed = plan(ED, { teams: { [K]: { removed: true } } });
  ok("an editor may not remove a club", ed.errors.some(e => /overseer's to change/.test(e)), ed.errors);
  const s = plan(OV, { teams: { [K]: { removed: true } } }), n = s.apply && after(s.apply);
  ok("the overseer removes one: gone from the records", !s.errors.length && !!n && !n.teams.some(t => t.id === X.id), s.errors);
  ok("(its men and its manager are free of it)", !!n && men.every(id => !n.teams.some(t => !["AVIUM", "ARTERRA"].includes(t.file) && ids(t).includes(id)))
    && !n.teams.some(t => t.file !== "AVIUM" && idOf(t.manager) === mgr));
  ok("(its sheet is written without it)", !!n && !sheetsFromRecords(n).ALE.includes(X.name.trim()) && sheetsFromRecords(rec).ALE.includes(X.name.trim()));
  const nt = plan(OV, { teams: { [teamKey(rec.teams.find(t => t.file === "AVIUM" && t.code === "ALE"))]: { removed: true } } });
  ok("a national side is never removed", nt.errors.some(e => /never removed/.test(e)), nt.errors);
  const offer = [{ id: "r1", kind: "deal", by: ED, team: teamKey(A), sides: [teamKey(A), K], moves: [{ kind: "player", id: men[0], to: teamKey(A) }], locks: ["p:" + men[0]] }];
  const held = plan(OV, { teams: { [K]: { removed: true } } }, offer);
  ok("not while an offer names it", held.errors.some(e => /waiting on a request/.test(e)), held.errors);
  // One of its men signed by another club in the same cart, the club then removed.
  const a = ids(A), sa = [...a]; sa[15] = men[15] || men[men.length - 1];
  const both = plan(OV, { teams: { [K]: { removed: true }, [teamKey(A)]: { squad: sa } } }), nb = both.apply && after(both.apply);
  ok("its man signed elsewhere in the same cart", !both.errors.length && !!nb && ids(nb.teams.find(t => t.id === A.id)).includes(sa[15]), both.errors); }

console.log("codes of two to four letters (12 October 2026)");
{ const four = plan(OV, { teams: { [teamKey(A)]: { code: "ARMA" } } }), five = plan(OV, { teams: { [teamKey(A)]: { code: "ARMAX" } } });
  ok("a four-letter code is taken", !four.errors.length && after(four.apply).teams.find(t => t.id === A.id).code === "ARMA", four.errors);
  ok("a five-letter one is not", five.errors.some(e => /code/.test(e)), five.errors); }

console.log("the colleges: graduation years and conferences (13 October 2026)");
{ const L = rec.leagues.find(l => l.college), C = rec.teams.find(t => t.group === L.name), K = teamKey(C);
  const s = plan(OV, { new: [{ id: "c1", what: "players", name: "Taro GAKUSEI", nat: "NCH", born: "1914-05-05", ovr: 60, pos: ["CM"], side: K, grad: 1938 }] });
  const n = s.apply && after(s.apply), p = n?.players.find(x => x.name === "Taro GAKUSEI");
  ok("the overseer's new man at a college keeps his graduation year", !s.errors.length && p?.grad === 1938 && ids(n.teams.find(t => t.id === C.id)).includes(p?.id), s.errors);
  const bad = plan(OV, { new: [{ id: "c2", what: "players", name: "Jiro GAKUSEI", nat: "NCH", born: "1914-05-05", ovr: 60, pos: ["CM"], side: K, grad: 1938.5 }] });
  ok("a graduation year is a whole year", bad.errors.some(e => /graduation year/.test(e)), bad.errors);
  const any = rec.players.find(x => !x.retired);
  const set = plan(OV, { players: { [any.id]: { grad: 1937 } } });
  ok("the overseer sets a man's graduation year", !set.errors.length && after(set.apply).players.find(x => x.id === any.id).grad === 1937, set.errors);
  const ed = plan(ED, { players: { [ids(A)[0]]: { grad: 1937 } } });
  ok("an editor may not", ed.errors.some(e => /overseer's to change/.test(e)), ed.errors);
  const renamed = L.conferences.map((c, i) => (i === 0 ? { ...c, name: "Capital League" } : c));
  const rn = plan(NCH_ED, { leagues: { [L.id]: { conferences: renamed } } }), nl = rn.apply && after(rn.apply).leagues.find(l => l.id === L.id);
  ok("its nation's editor renames a conference, and the league stays a college league", !rn.errors.length && nl?.conferences[0].name === "Capital League"
    && nl.college === true && nl.conferences[0].clubs.join() === L.conferences[0].clubs.join(), rn.errors);
  const twice = plan(NCH_ED, { leagues: { [L.id]: { conferences: L.conferences.map((c, i) => (i === 1 ? { ...c, name: L.conferences[0].name } : c)) } } });
  ok("two conferences never share a name", twice.errors.some(e => /two conferences/.test(e)), twice.errors);
  const out = plan(NCH_ED, { leagues: { [L.id]: { conferences: L.conferences.map((c, i) => (i === 0 ? { ...c, clubs: [...c.clubs, teamKey(B)] } : c)) } } });
  ok("a conference holds only the league's own clubs", out.errors.some(e => /outside the league/.test(e)), out.errors);
  const two = plan(NCH_ED, { leagues: { [L.id]: { conferences: L.conferences.map((c, i) => (i === 1 ? { ...c, clubs: [...c.clubs, L.conferences[0].clubs[0]] } : c)) } } });
  ok("and a club only one", two.errors.some(e => /two conferences/.test(e)), two.errors);
  const other = plan(ED, { leagues: { [L.id]: { conferences: renamed } } });
  ok("another nation's editor may not touch them", other.errors.some(e => /not one of your leagues/.test(e)), other.errors); }

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
