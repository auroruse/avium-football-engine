// MVP is picked off a RATE stat, so unlike every other honour in that row it needs a minutes
// qualifier -- without one it goes to a substitute who had one good afternoon. This walks every
// archived season and prints what the honour would say, flagging any winner who played less than
// half of what the competition's most-used player did.
import { parseStatBoards, seasonMVP } from "./engine.mjs";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "public/avium/pstats";
const files = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f);
  statSync(p).isDirectory() ? walk(p) : /\.tsv$/i.test(f) && files.push(p); } })(ROOT);

let checked = 0, thin = 0, moved = 0;
for (const f of files.sort()) {
  const boards = parseStatBoards(readFileSync(f, "utf8"));
  if (!boards.RTG?.length) continue;
  const all = Object.values(boards).flat();
  const useMin = all.some(e => e.min > 0);
  const load = (e) => useMin ? e.min : e.gp;
  const maxLoad = Math.max(...all.map(load));
  const old = boards.RTG.reduce((b, r) => r.v > b.v ? r : b);
  const now = seasonMVP(boards);
  checked++;
  const share = maxLoad ? load(now) / maxLoad : 1;
  if (old.player !== now.player) moved++;
  if (share < 0.5) thin++;
  const tag = old.player === now.player ? "  " : "->";
  console.log(`${tag} ${f.replace(ROOT + "/", "").padEnd(22)} ${now.player.padEnd(24)} ${String(now.v).padStart(4)}  ${String(load(now)).padStart(4)}/${maxLoad}` +
              (old.player === now.player ? "" : `   was ${old.player} (${old.v}, ${load(old)})`));
}
console.log(`\n${checked} seasons with a rating board, ${moved} MVPs moved.`);
if (thin) { console.log(`FAIL: ${thin} winner(s) still under half the load`); process.exit(1); }
console.log("every MVP cleared the minutes bar");
