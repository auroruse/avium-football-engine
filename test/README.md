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
| `nt-drive.mjs` | not a test: the national-team tactics search, run by hand. Successive halving over the 13x11 style-by-formation grid (Park The Bus left out): every cell plays 30 matches, the top 48 play 50 more, the top 16 play 120 more, the top 8 play 400 more, so each finalist has 600 matches on the same fixtures and seeds as every other. The side's current cell is carried through every round and the call is made against a two-sigma floor from the finalists' own win and draw rates -- inside the floor the current tactic stays. Ten workers pull 30-match chunks from one queue, about an hour a side. |
| `nt-job.mjs`   | one chunk of that search: a (style, formation) cell built the way the app builds it -- the style's identity keys over `STRAT_DEF`, editables at zero, the XI re-slotted through `refitLineup` -- played over fixtures `k0..k0+n` against every international side within 15 OVR, both ways round. Opponent, venue and seed are functions of `k` alone, which is what makes the cells paired and the rounds cumulative. |
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
