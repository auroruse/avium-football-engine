# The season archive

The Leagues tab reads this folder. `vite.config.js` enumerates it at build time (and watches it in
dev), so adding a season is one file drop — no code change, no manifest to keep in step.

## Season files

A season is up to two files sharing a name: `<season>.tsv` holding its leaderboards, and
`<season>.md` holding its report. Either one on its own is a season; neither is required to have
the other. A league season is `<comp>/<YY>-<YY>` (`nl1/33-34`); a one-off tournament is
`<comp>/<YYYY>` (`wc/1934`). The folder name maps to a competition in `PSTATS_COMP` in
`src/App.tsx`; an unmapped folder shows uppercased.

**Two-digit years are read with a pivot at 50**: `88-89` is 1888/89 and `00-01` is 1900/01. The
archive reaches back forty-five years, so a flat `1900 + n` filed the oldest seasons after the
newest.

## Competitions

`INTL_COMPS` in `src/App.tsx` is the international calendar, and every entry names the **field** it
draws on. That scope is what its Teams and Players tabs are filtered to, so a competition is a
proper competition rather than an archive folder: the World Cup and the Nations League field every
nation, a confederation championship fields that confederation, and the Club World Cup fields every
club. The four championships are derived from the confederations in `AVIUM.tsv`, so adding one adds
its competition.

Two competitions were folded into their successors, which is why a 1932 report can carry an older
name than the folder it sits in. **CONELAF became CONSEAF**, so the 1932 CONELAF Championship is
`conseaf/1932.md`; the **Foundation Cup became the Nations League**, so the 1932 Foundation Cup is
`natl/1932.md`. Both documents keep the title they were played under.

## Season reports

`<season>.md` is a markdown document and renders one of two ways.

**A domestic league season** is a run of `## Round N` headings, each with a `| Match | Score |`
table (the exporter adds `Scorers`, and a `### Table after Round N` beside it), closed by a
`## Final Table`. That shape drives the round stepper: pick a round, see its results next to the
standings they produced.

**Everything else** — every tournament — is the canonical tab format: each `## Heading` renders
as a tab inside the season, what sits above the first `##` is the preamble, and a `### Sub`
heading captions whatever follows it. The tab sets are fixed: a group tournament is
`Group Stage | Knockouts`, a double-elimination one is `Upper Bracket | Lower Bracket |
Grand Final` (plus `Group Stage` when it had a group phase). The Group Stage tab is standings
first, then the rounds, the same way a league season reads. No Draw tabs, no Notes tabs, no
preamble prose, no scorer columns anywhere: title, tabs, captions, tables.

The table formats are fixed too, and every file carries exactly these:

- **Standings** — `| # | Team | P | W | D | L | GF | GA | GD | Pts |`, numbered, GD signed,
  **bold** = advanced. The 1932 World Cup recorded no group tables, so its Standings are computed
  from its fixtures, sorted advancers-first then points, goal difference, goals.
- **Group fixtures** — `| Group | Match | Score |` under `### Round N` captions (the Group column
  is absent for a single-league phase's fixtures).
- **Knockout fixtures** — `| Match | Score |` or `| Match | Leg 1 | Leg 2 | Agg |`, `MOTM`
  trailing where recorded. **The winner is the bolded side of the Match cell, always.** A decided
  score is bare (`2-1`); qualifiers are comma suffixes on the deciding cell: `2-2, 7-6 pens`
  (shootout, home side first), `1-2, aet`, `2-2, ag` (away goals — applied wherever a level
  aggregate carried no note, since that is the rule the sources assumed). The app renders pens as
  bracketed counts flanking the score and the qualifiers as coloured tags, with the bracket and
  tag space reserved across the whole table so every row keeps one shape.

The Winner column on a season's banner resolves in order: the top row of `## Final Table`; a
`**Winner:**`/`**Champions:**` line; the bolded side of the report's last `Final`/`Grand Final`
fixture. Every season currently filed resolves one.

The reports were converted out of `Avium/Football/` — `International/<year>/`, and
`Nichirin League One|Two/<season>/`. Seasons older than 30/31 survive only as a final table, which
is what their TSV in `Historical Seasons/` holds; the club and base-skill block beside it is not
carried in, and neither are the player boards.

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
