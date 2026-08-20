# Player statistics archive

The Players tab reads this folder. `vite.config.js` enumerates it at build time (and watches it in
dev), so adding a season is one file drop — no code change, no manifest to keep in step.

## Season files

One TSV per competition-season. A league season is `<comp>/<YY>-<YY>.tsv` (`nl1/33-34.tsv`); a
one-off tournament is `<comp>/<YYYY>.tsv` (`wc/1934.tsv`). The folder name maps to a competition in
`PSTATS_COMP` in `src/App.tsx`; an unmapped folder shows uppercased.

The career table is ordered chronologically, and a year holding both a tournament and a league
season is broken by `PSTATS_KIND`: World Cup, then league, then Club World Cup — the same order the
changelog uses. So 1934's World Cup sits above the 33/34 league season, not below it.

Each file is the season's leaderboards side by side, one blank column between boards:

```
#  PLAYER  POS  TEAM  GP  G     #  PLAYER  POS  TEAM  GP  A     #  PLAYER  POS  TEAM  GP  RTG   ...
```

The header cell four columns right of each `PLAYER` names the stat: `G`, `A`, `RTG`, `CC`, `DC`,
`S` (saves, displayed as SV). Boards may be absent — 31/32 has only G, A and RTG, and the career
table leaves those cells blank rather than showing a zero. Player names are written in full
("Trent Hawthorne"), matched case- and diacritic-insensitively against the presets.

**31/32 is the exception, and is left alone deliberately.** It shipped with initials rather than
full names, and it is old enough that no committed version of the presets carries the full spellings
to expand them from — so about 220 of its names cannot be reconciled with anyone, and most of those
players have left the league anyway. Every other file resolves: 33/34 has no unmatched names at all
and the 1934 World Cup has nine. Do not spend time re-deriving them; the source needed to do it was
never written down.

## Rating scale

**The match-rating model changed twice, and the pre-33/34 RTG columns have been converted to the
33/34 model's scale.** All three seasons already agreed on the mean rating (6.89 / 6.82 / 6.81);
what changed was the spread (standard deviation 0.354 / 0.255 / 0.185), so a 7.9 in 31/32 was a far
commoner thing than a 7.9 would be now. The conversion matches each season's mean and standard
deviation to 33/34's, which is a change of units: every ordering and every relative gap survives it.

```
31/32   RTG' = 0.5248 x RTG + 3.1908
32/33   RTG' = 0.7323 x RTG + 1.8157
```

Across the deciles the converted values land within 0.1 of 33/34's own distribution everywhere
except the very bottom of the table, where a single outlier leaves 0.2. The original unscaled
numbers are still in the vault, under `Avium/Football/Nichirin League One/<season>/`.

## Counting stats

Goals, assists and appearances are real events and mean the same thing in every season. Chances
created, defensive contributions and saves do not: all three were redefined between 32/33 and
33/34, so **32/33's CC, DC and SV columns have been converted too** — 31/32 recorded none of them.

The conversion is a factor per position group, not one league-wide, because the redefinition was
not even across the pitch. A defender's DC roughly doubled; a forward's more than tripled, since
pressing actions high up the pitch now count and did not before. One global factor would have
buried exactly the players the change was meant to lift.

```
CC   DEF x0.7167   MID x0.4325   FWD x0.3266
DC   DEF x2.1052   MID x2.0157   FWD x3.2087
SV   GK  x1.2807
```

Each factor is a least-squares ratio through the origin fitted on the top half of the group: through
the origin because a count of nothing converts to a count of nothing, and on the top half because
these boards list only players with a non-zero value, so their bottom ends hold different
populations (32/33 lists a keeper with 2 saves; 33/34's thinnest keeper has 16).

The World Cup files needed less. Chances created and saves already agree between 1933 and 1934 to
within a few percent per game, so neither was touched; only defensive contributions had moved, and
only for the two position groups that recorded any:

```
DC (1933 World Cup)   DEF x1.4316   MID x1.8844
```

1933 records **no** defensive contributions for forwards or goalkeepers — under that definition they
registered none at all, where in 1934 they average 0.43 and 0.25 a game. Those are blank rather than
scaled, since there is nothing to scale. 1932 carries no CC, DC or saves boards whatsoever.

Because the factors differ by position, the converted boards were re-sorted and renumbered — that
reordering is the correction, not a side effect. Residual error against 33/34's own distribution is
around 2–5 across the top half of each board, except forwards' DC at 8.5: that group's redefinition
is the least linear of the seven and its converted figures are the roughest in the archive.

## changelog.tsv

Every post-tournament rating adjustment, one row per player:

```
SEASON   COMPETITION   PLAYER   TEAM   POS   OLD   NEW
33/34    nl1           Miltiadis Galanis   VIR   FWD   87   91
```

`SEASON` and `COMPETITION` mirror the season files so the Rating Changelog sits on the same grid as
the career table above it: a `COMPETITION` matching a folder name resolves to its full title, and
anything else — a cup, an international tournament — prints verbatim.

**Rows are in chronological order and are displayed in file order**, earliest first, the same way
the career table reads. Within a year that means World Cup, then league season, then Club World Cup.
Order matters beyond presentation: a player's entries are a chain of old-to-new steps, so one batch
filed out of sequence shows up as a rating that jumps between rows.

When a gap does turn up — a tournament that adjusted somebody but was never filed — close it by
moving the **earlier** entry, keeping the delta it was filed with and shifting both its figures. The
newest entry is the one that has to stay put, because it is what the live preset carries; the size
of an adjustment is what the row is actually recording, so that is preserved rather than the
absolute figures around it.

`TEAM` is always a team code, club or national, resolved to a crest and a full name. A side that no
longer fields a team keeps its code: the badge in `public/badges` outlives the preset, so it still
renders like any other national team, just with nothing to open behind it. Give it a full name by
adding the code to `FORMER_TEAMS` in `src/App.tsx`; without an entry it shows the bare code, which
is better than an invented name.
