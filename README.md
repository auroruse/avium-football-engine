# Avium Football Engine

Browser-based football match simulator built for the [Avium Cinematic Universe](https://github.com/auroruse/avium-football-engine) roleplay setting. Single-file React app, zero backend.

**[Live App](https://auroruse.github.io/avium-football-engine/)**

## Features

### Live Match Engine
- Minute-by-minute simulation with zone-based progression, pressing, counter-attacks, and set pieces
- Dynamic tactics with auto-tempo, time wasting, creative freedom, counter-press, and high/low block
- 10 formations, 8 playstyles, 14 strategy sliders per team
- Player ratings, goals, assists, cards, injuries, substitutions (manual and AI)
- Extra time, penalty shootouts with zone/dive mechanics
- xG tracking, momentum system, stamina model
- Full post-match reports with POTM

### Tournament Mode
- Group stage (round-robin or Swiss), knockout, or combined formats
- Presets: League, Old/New World Cup, Old/New UCL, Cup
- 2-leg ties with away goals rule, third-place match
- Configurable home advantage: first-listed, weaker team, host nation, or per-match overrides
- Suspensions and injuries carry across rounds
- Player leaderboards: top scorers, assists, ratings
- Qualification zones with custom labels and colors

### Play Live from Tournament
- Launch any unplayed tournament match as a full live game
- Suspensions and injuries enforced: unavailable players auto-benched, bench promoted
- 2nd leg awareness: aggregate score, perspective flip, home advantage swap
- Post-match flow: view report, then import result, replay, or abandon

### Team Management
- 69-team Avium preset with full squads, tactics, and strategies
- 46-team European club preset
- Bulk import/export via TSV
- Per-player tier system (standard / key player / star)
- Custom squad builder with position assignments

## Development

```bash
npm install
npm run dev
```

## Deploy

Push to `main` — GitHub Actions builds and deploys to Pages automatically.

Repo Settings > Pages > Source > GitHub Actions.
