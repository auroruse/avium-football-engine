# Match engine test harness

`bash test/rebuild.sh` bundles `src/App.tsx` (asset imports stubbed by `prelude.js`) together with
the real `src/engine` modules into `test/engine.mjs`, which every harness imports.

The ones that matter for the positional engine:

| harness | what it answers |
|---|---|
| `mecal.mjs`   | does a match look like football? shots, goals, passing, corners, fouls, in-play minutes, xG per shot, shot-distance histogram, all against real-world targets |
| `mespace.mjs` | is the side shaped like a team? nearest team-mate, stretch index, convex-hull surface area, % of players inside 3m — the units sports science uses |
| `megap.mjs`   | does a rating gap turn into a rout? goal difference by OVR gap (the old abstract engine gave +8 1.07, +29 3.31) |
| `meduty.mjs`  | duty distribution, and how many players press the ball at once (should be ~0.5, not 6) |
| `mepress.mjs` | pressing intensity and stamina cost by `pressingLOE` setting |
| `mediag.mjs`  | the pass-to-shot funnel: passes per shot, turnovers, where completed passes end up by third |
| `merun.mjs`   | off-ball runs started, by kind, and how many players are running at any moment |
| `meshape.mjs` | formation spread in metres, and jitter (% of slices where a player reverses direction) |
| `mebench.mjs` | ms per match |

Run any of them with `node test/<name>.mjs` after `rebuild.sh`.

Every tuning number is on `CFG` in `src/engine/config.ts`; sweeps patch that object rather than
editing source.
