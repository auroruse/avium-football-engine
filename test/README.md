# Match engine test harness

`zsh test/rebuild.sh` bundles `src/App.tsx` (asset imports stubbed by `prelude.js`) together with
the real `src/engine` modules into `test/engine.mjs`, which every harness imports. Rebuild it after
**any** change to `App.tsx` or `src/engine` — a stale bundle silently tests the old engine.

| harness | what it answers |
|---|---|
| `golden.mjs`  | is the engine byte-for-byte what it was? 24 fixtures hashed tick-for-tick — scoreline, the whole event feed with coordinates, every counter, every player's own numbers. The safety net for engine work. |
| `tourn.mjs`   | does a tournament run start to finish, with stats carried per player? |
| `pool.mjs`    | does the worker pool wire up and play a fixture? |
| `cards.mjs`   | do suspensions outlast the right things — second yellow, violent conduct, DOGSO? |
| `import.mjs`  | does a bracket import land each side on its own club? |
| `rcbadge.mjs` | does the red-card badge render and count? |
| `mvp.mjs`     | does the season honours row give MVP to somebody who actually played? Walks every archived `pstats` season, prints the winner with his share of the competition's heaviest workload, and fails on any winner under half of it. MVP is the one honour picked off a rate stat, so it is the one that can be won off the bench. |
| `roles.mjs`   | does the best man in each unit lead it most of the time and not every time? Plays N fixtures and reads, per unit, how often the highest-rated man drew the top role; the hub's strength distribution; that every unit's roles sum to zero (the role redistributes, it must not buff); and that no side ever finishes with a midfielder standing and no hub, which is the substitution refresh. Also prints the hub's share of his side's chances against how much of a hub he was -- the thing the hub was built for and never measured. |
| `ablate-roles.mjs` | which role term moves the OVR gradient? Not a test: one arm per lever (`full`, `old`, `recv0`, `run0`, `form0`), paired seeds keyed to the fixture, the better side's result by XI gap. The reading that settled whether form and unit roles had flattened the meta -- the unpaired ratings harness said they had, this said they had not. |
| `nt-drive.mjs` | not a test: the national-team tactics search, run by hand. Successive halving over the 13x11 style-by-formation grid (Park The Bus left out): every cell plays 30 matches, the top 48 play 50 more, the top 16 play 120 more, the top 8 play 400 more, so each finalist has 600 matches on the same fixtures and seeds as every other. The side's current cell is carried through every round and the call is made against a two-sigma floor from the finalists' own win and draw rates -- inside the floor the current tactic stays. Ten workers, each loading the engine once, pull 10-match chunks from one queue, about an hour a side. |
| `nt-job.mjs`   | one chunk of that search: a (style, formation) cell built the way the app builds it -- the style's identity keys over `STRAT_DEF`, editables at zero, the XI re-slotted through `refitLineup` -- played over fixtures `k0..k0+n` against every international side within 15 OVR, both ways round. Opponent, venue and seed are functions of `k` alone, which is what makes the cells paired and the rounds cumulative. `ntPool(W)` plays a queue of them in W worker processes that keep the engine loaded, which is how `nt-drive` runs them. |
| `lab.mjs`     | not a test: the tactics lab. `node test/lab.mjs <spec.mjs> [workers] [out.jsonl]` plays every ARM of a spec (a way of setting a side up: `team`, `opp`, and optionally `bundle`, `cfg`, `mt`, `seed`) for every club in the spec's league against a rotating field, home and away alternating, with opponent, venue and seed keyed to the club and fixture number so the arms are paired. Writes one row per match with about seventy metrics a side, a `.summary.json`, and a paired-difference table. `seed` replays the same fixtures on other dice, for base replicates. How the 6 Oct 2026 styles, the instruction survey and the matchup table were measured. |
| `records.mjs` | not a test: the player, manager and team records in `src/data` (one record a person, squads as links to players), which the app reads through `src/data/sheets.js`. `import` builds them from the sheets in `src/presets` and keeps every existing ID, `export [dir]` writes the sheets from them, `check` compares every sheet with the records byte for byte. A cell the records cannot regenerate exactly (a tag naming the club's own nation, stray spacing) keeps its own text. `prelude.js` makes the same check, so no harness loads while a sheet and the records disagree. |
| `publish.mjs` | does the editor's Publish write what it should? Runs `src/data/publish.js` against a stand-in for GitHub that serves this checkout as main: one man's rating, nation and badges must commit his record and exactly the sheets he is on; a team's style, lineup and manager (with the manager's rating) the teams and managers files, that team's sheet and only the manager's cell on his other jobs; a transfer (the seller's bench filling the starting place, the released man kept as a free agent with his last position) and a retirement (out of club and country, record kept) exactly the files they touch; a no-op draft nothing, main moving mid-write a fresh read, a missing or wrong key a refusal. No key, no network, under a second. |
| `server.mjs` | does the registry server (`server/worker.js`) let the right people change the right things? Bundles it and runs it end to end against a stand-in for GitHub that serves this checkout as main and checks the App's signature with a throwaway key: sign-in and sessions, an editor's own club going live in one commit, ratings and other people's clubs refused, a transfer request from asking through the lock to the other owner's accept (the seller's bench filling in), and a save redone when main moves. No network, no real key. |
| `mkmatchup.mjs` | not a test: writes the managers' tables from a run of `specs/matchup.mjs` (every style against every other at level squads, one direction of each pairing, about 25,000 matches, so a cloud run): `src/engine/matchup.ts`, and `ME_STYLE_ADJ` and `ME_STYLE_ATTACK` in `manager.ts`. The managers choose their styles on these numbers, so re-run both after any engine change that moves how the styles play. |
| `tdz.mjs`     | does the app paint at all? Evaluates the SHIPPED `dist` bundle in node and fails on a ReferenceError — a const read before its own line at module scope, which is a black screen and nothing else. Needs `npx vite build` first, and it is the only harness that can see this: `test/ssr` bundles with esbuild, which concatenates every module into one scope and rewrites all 415 top-level consts to `var`, erasing the dead zone. Rollup keeps const, so only the real bundle still carries the bug. |
| `natxi.mjs`   | not a test: the national-team selector, run by hand. Recomputes every nation's 22 player columns from the player pool and prints them as a TSV to paste over `AVIUM.tsv`; the per-nation changes and any unfilled seats go to stderr. It replaced the Utilities-tab panel that did this on screen. |
| `ratings.mjs` | does a player's rating reach his rating, and does the decision believe the truth? Plays 200 league fixtures on every core and reads, per position, the par, the spread, what ten OVR buys (raw and within his own XI), the ghost share and the per-event deltas; for keepers, the engine's conversion curve on target and whether the save/concede model balances; for passes, the decision's completion belief against what happened, by band and by component, with the logistic fit the belief ships. `check` fails if `ratePos`, `gkExp` or the belief (by band) have drifted; `derive` prints the values to ship. It is the calibration harness behind those constants as well as the test. |

```bash
zsh test/rebuild.sh
node test/golden.mjs            # check against the baseline
node test/golden.mjs write      # re-baseline, once you can name why every diverging fixture moved
node test/ratings.mjs check     # the pars and the keeper balance still hold (about a minute on 8 cores)
node test/ratings.mjs derive    # after touching any rate constant: the ratePos / gkExp to ship
node test/natxi.mjs > natxi.tsv  # recompute the national sheets' player columns
npx vite build && node test/tdz.mjs   # after any App.tsx edit: does the shipped bundle still evaluate
node test/mvp.mjs               # who every archived season would name MVP
node test/roles.mjs             # form and unit roles: leadership rates, hub variance, zero-sum, sub refresh
node test/nt-drive.mjs NCH,NKI 10   # national tactics search, one line a round to scratch/nt-progress.log
node test/mkmatchup.mjs runs/ "cloud run 123, 8 Oct 2026"   # the managers' tables from a matchup run's records
```

## The probes are gone

Around 195 one-off harnesses used to live here — the working-out behind the numbers quoted
throughout the engine's comments (`mecal`, `megap`, `gksweep`, and so on). They were investigation
scripts, not tests: nothing ran them, several had rotted against a retired loader, and they held
26 config keys and 7 engine exports alive that the app itself never read.

They are in git history. To re-run an old calibration, restore the one you want rather than
carrying all of them:

```bash
git log --oneline --diff-filter=D -- test/mecal.mjs
git checkout <commit>^ -- test/mecal.mjs
```

Write new probes in the session scratchpad, not here. This directory is the suite.
