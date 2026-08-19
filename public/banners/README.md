# Banners

Two sets, both keyed by **theme id** — `default`, `nl1`, `wc1933`, `wc1934`. Drop a file in, reload;
nothing imports these, so no rebuild and no code change is needed to add or replace one.

## `app/` — the masthead

Replaces the "Avium Football Engine" wordmark top-left as the theme changes.

- `app/<theme>.png` — e.g. `app/nl1.png`
- Transparent PNG. It sits on the chrome background.
- Drawn at 34 px tall, width auto. Author at 3x (~102 px tall) for retina.
- `app/default.png` is the standard wordmark. A theme with no file falls back to it.

## `match/` — the in-match banner

A band above the venue image on the match scoreboard. **Theme-exclusive**: no file, no band —
the standard theme shows nothing here by design, and the scoreboard renders exactly as before.

- `match/<theme>.png` — e.g. `match/nl1.png`
- **Transparent.** It sits directly on the sidebar with no band or rule behind it, so the card
  reads as one surface from the photograph down to the city line. Anything opaque will show as a
  rectangle against the panel.
- Full width of the scoreboard, its own aspect ratio kept — nothing is cropped. Author wide and
  short: 1600x180 renders about 74 px tall at the scoreboard's width.
- A `maxHeight` of 96 px is the only guard. Go taller than roughly 16:1 and the band is capped and
  centre-cropped instead, so keep the ratio wider than that.
- No `match/default.png`. Adding one would put a band on the standard theme, which is the one
  case that is meant to have none.
