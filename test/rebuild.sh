#!/bin/zsh
# The engine now lives in real modules under src/engine, so the harness IMPORTS it instead of
# string-stripping App.tsx. App.tsx is still bundled for the app-side symbols the tests need
# (RNG, buildSquad, createMatchState, presets, UI helpers) with its asset imports stubbed by
# prelude.js -- but the engine import is kept, so esbuild resolves it for real.
SP="$(cd "$(dirname "$0")" && pwd)"
ENGDIR="$SP/../src/engine"
cd "$SP/.." || exit 1
tail -n +$(( $(grep -n '^import ' src/App.tsx | tail -1 | cut -d: -f1) + 1 )) src/App.tsx > "$SP/engine.tsx"
cat >> "$SP/engine.tsx" <<'XEOF'

export { FORMATIONS, FPOS2, GK_STOP, GL, LEAGUE_NAT, LEAGUE_ORDER, LM_CONTROLS_H, ME_TPM, PANEL_H, PARTICIPANT_PRESETS, PITCH_FAR, PITCH_H, PITCH_LABEL_H, PITCH_MAX_W, PITCH_NAME_W, PITCH_TOKEN, PITCH_W, POS_GROUP, POS_ROLE, POT_MODES, POT_MODE_DERIVED, POT_UNAFFILIATED, PRESET_CATALOG, RNG, ROSTER_HEAD_H, STRAT_DEF, TOKEN, T_DRAW_PHASES, T_PRESETS, XI_EDGES, XI_OOP_PENALTY, XI_STEPS, XI_STEP_MAX, allPool, allocDraw, allocPreset, bandsOf, basename, buildKOShell, buildSquad, collectKOTeams, colorsClash, createMatchState, dealVenues, dirname, drawConfKey, drawKeyCounts, drawNationKey, drawPots, ensureMaxLum, execFileSync, gkEdge, groupByLeague, hexToRgb, join, koPairDraw, koRoundLabel, koSplitByes, lightenUntil, ovrVs, parseBulk, percLum, pickXi, pitchDepthAt, pitchProj, pitchSlots, pitchToken, posFitCost, posix, propagateKO, readFileSync, readableClr, readdirSync, recalcStandings, renderToString, rmSync, run, settledPhase, simInstantMatch, splitSurname, stripVenue, unreadableOn, venueCap, writeFileSync, xiSkill, xiSteps, IDENTITY_KEYS, STYLES, refitLineup, meSide, meBench, meFreshOut, meStrategyFor, buildSeasonMd, buildSeasonStatsTsv, seasonScorersOf, seasonFmtScorers, buildPlayerIndex, pickNationalSquad, presetCell, parseStatBoards, seasonMVP, meOvr, STYLE_PRESET };
XEOF
# App.tsx re-exports the core for the harnesses; that path is relative to App.tsx, so point it
# at the real file before bundling from test/.
sed -i "" "s#from \"./sim/core\"#from \"$SP/../src/sim/core\"#g" "$SP/engine.tsx"
cat "$SP/prelude.js" "$SP/engine.tsx" > "$SP/e2.tsx" && mv "$SP/e2.tsx" "$SP/engine.tsx"
# Re-attach the engine: one import for App.tsx's own use, and a re-export so tests can reach it.
# Mirror App.tsx's own engine import exactly -- a symbol missing here is a ReferenceError that
# only shows up when a harness runs the function that uses it.
# Take App.tsx's OWN engine import line and repoint it at the engine directory. Copying the
# symbol list by hand is how this broke twice: a symbol added to App.tsx but not here is a
# ReferenceError that only appears when a harness runs the function that needs it.
grep -m1 '^import .* from "./engine";$' src/App.tsx | sed "s#\"./engine\"#\"$ENGDIR\"#" > "$SP/e3.tsx"
# ...and the worker pool, same trick. It is a real import in App.tsx, so stripping it without
# putting it back leaves makePool undefined at module scope and every harness dies on load.
grep -m1 '^import .* from "./sim/pool";$' src/App.tsx | sed "s#\"./sim/pool\"#\"$SP/../src/sim/pool\"#" >> "$SP/e3.tsx"
# ...and the sim core, which now holds the forty-odd symbols the engine entry needs. Same
# reason: stripped with the imports, and without it the harness loses FORMATIONS and friends.
grep -m1 '^import .* from "./sim/core";$' src/App.tsx | sed "s#\"./sim/core\"#\"$SP/../src/sim/core\"#" >> "$SP/e3.tsx"
cat "$SP/engine.tsx" >> "$SP/e3.tsx"
printf '\nexport * from "%s";\n' "$ENGDIR" >> "$SP/e3.tsx"
mv "$SP/e3.tsx" "$SP/engine.tsx"
node_modules/.bin/esbuild "$SP/engine.tsx" --bundle --format=esm --platform=node --loader:.tsx=tsx --outfile="$SP/engine.mjs" --log-level=error || exit 1
echo "rebuilt"
