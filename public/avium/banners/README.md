# Banners

One set, keyed by **theme id** — the filename IS the id. Drop a file in, reload; nothing imports
these, so no rebuild and no code change is needed to replace one. Adding a NEW theme still needs a
row in `UI_THEMES` in `App.tsx`, because that is what puts it in the picker.

A World Cup is keyed by year and host: `1933nch.png` is Nichirin's 1933 tournament.

## The in-match banner

A band above the venue image on the match scoreboard. **Theme-exclusive**: no file, no band — the
standard theme shows nothing here by design, and the scoreboard renders exactly as before.

- `<theme>.png` — e.g. `nl1.png`
- **Transparent.** It sits directly on the sidebar with no band or rule behind it, so the card
  reads as one surface from the photograph down to the city line. Anything opaque will show as a
  rectangle against the panel.
- Full width of the scoreboard, its own aspect ratio kept — nothing is cropped. Author wide and
  short: 1600x180 renders about 74 px tall at the scoreboard's width.
- A `maxHeight` of 96 px is the only guard. Go taller than roughly 16:1 and the band is capped and
  centre-cropped instead, so keep the ratio wider than that.
- No `default.png`. Adding one would put a band on the standard theme, which is the one case that
  is meant to have none.

## The masthead does not theme

The wordmark top-left is always `src/header.png`. There is no `app/` set any more — a theme dresses
the match, and the app keeps its own name.
