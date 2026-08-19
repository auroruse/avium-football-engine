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

```bash
zsh test/rebuild.sh
node test/golden.mjs            # check against the baseline
node test/golden.mjs write      # re-baseline, once you can name why every diverging fixture moved
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
