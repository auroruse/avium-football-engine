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

export { FORMATIONS, FPOS2, GK_STOP, GL, LEAGUE_NAT, LEAGUE_ORDER, LM_CONTROLS_H, ME_TPM, PANEL_H, PARTICIPANT_PRESETS, PITCH_FAR, PITCH_H, PITCH_LABEL_H, PITCH_MAX_W, PITCH_NAME_W, PITCH_TOKEN, PITCH_W, POS_GROUP, POS_ROLE, POT_MODES, POT_MODE_DERIVED, POT_UNAFFILIATED, PRESET_CATALOG, RNG, ROSTER_HEAD_H, STRAT_DEF, TOKEN, T_DRAW_PHASES, T_PRESETS, XI_EDGES, XI_OOP_PENALTY, XI_STEPS, XI_STEP_MAX, allPool, allocDraw, allocPreset, bandsOf, basename, buildKOShell, buildSquad, collectKOTeams, colorsClash, createMatchState, dealVenues, dirname, drawConfKey, drawKeyCounts, drawNationKey, drawPots, ensureMaxLum, execFileSync, gkEdge, groupByLeague, hexToRgb, join, koPairDraw, koRoundLabel, koSplitByes, lightenUntil, ovrColor, ovrVs, parseBulk, percLum, pickXi, pitchDepthAt, pitchProj, pitchSlots, pitchToken, posFitCost, posix, propagateKO, readFileSync, readableClr, readdirSync, recalcStandings, renderToString, rmSync, run, settledPhase, simInstantMatch, splitSurname, stripVenue, unreadableOn, venueCap, writeFileSync, xiSkill, xiSteps };
XEOF
cat "$SP/prelude.js" "$SP/engine.tsx" > "$SP/e2.tsx" && mv "$SP/e2.tsx" "$SP/engine.tsx"
# Re-attach the engine: one import for App.tsx's own use, and a re-export so tests can reach it.
printf 'import { ME_DT, ME_TPM, meInit, meTick } from "%s";\n' "$ENGDIR" > "$SP/e3.tsx"
cat "$SP/engine.tsx" >> "$SP/e3.tsx"
printf '\nexport * from "%s";\n' "$ENGDIR" >> "$SP/e3.tsx"
mv "$SP/e3.tsx" "$SP/engine.tsx"
node_modules/.bin/esbuild "$SP/engine.tsx" --bundle --format=esm --platform=node --loader:.tsx=tsx --outfile="$SP/engine.mjs" --log-level=error || exit 1
echo "rebuilt"
