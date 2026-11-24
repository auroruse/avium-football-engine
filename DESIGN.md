# Avium Football Engine: design file

Every screen in the app is built against this file. When a build and this file disagree, either the build is wrong or
this file changes first, on purpose.

Decided with Moukden and Kirin, 8 October 2026: option A (rebuild the interface inside the React app), inspired by
Football Manager 27's interface. The match engine is untouched.

---

## 1. The app

**Job:** the AFA registry (nations, clubs, players, managers), the season archive, and the match engine, for the ACU's
editors and readers. A screen is judged against FM27's Portal: it uses the whole window, it has two levels of
navigation, and every panel answers one question.

### Sections (the top bar)

Registry · Competitions, and **Play match** as the one primary button on the right, where FM27 has Continue. Registry was
Home until Moukden and Kirin renamed it (9 October 2026). Players, Managers, Teams and Rating Changes are pages of Registry
(its page bar: Overview, Teams, Players, Managers, Trades, Rating Changes; Moukden and Kirin, 9 October 2026; Teams 11 October
2026, first after Overview). Custom Sides, the sides made in this browser, are gone (Moukden and Kirin, 10 October 2026).
Registry stays lit on them, on a player's or a manager's page, and on a nation's and its clubs'
pages. Search sits beside it, then the settings menu (the theme, the Universe switch and the Documentation), Requests and the Cart for
editors, and the account menu. **Tournaments** is the third section, after Competitions (below).

**The two universes** (Moukden and Kirin, 19 November 2026: "a app-wide toggle between Avium and Arterra, waterproof,
separating the two universes in one engine"). Avium and Arterra share the engine and nothing else. This replaces the
Arterra on/off switch of 10 October 2026 and its four world switches (Registry's title and Nations panel, the side
picker, the tournament's Sides), under which a fixture or a tournament could hold sides of both. The answers given that
day:

- **Never mix.** A match, a tournament, a transfer or a list holds one universe's sides and men only.
- **Each keeps its place.** Switching leaves the universe behind exactly as it was: its page, its live match (which
  waits and plays on from the same tick), its open tournament, its cart. Switching back returns to it.
- **Arterra is a full universe.** It is built to take clubs, leagues, transfers, an archive and a Hall of Fame of its own
  (`public/arterra/pstats`, `public/arterra/stadiums`); a section with nothing in it yet shows empty.
- **Its own time.** Arterra's dates are its own counter's (`src/data/icclock.js`: 28 July 2026 was 1 January 2043, four
  times as fast, 365-day years). Ages and dates of birth in Arterra are read on it.
- **Its own accent.** The same layout and the same wordmark (the same day: "you dont need a custom title"), with the
  accent its badge's green and the champion's gold its badge's gold (`src/theme.css`, `[data-universe="arterra"]`;
  "Accent should be yellow or green from Arterra's badge"). The colour themes are Avium's tournaments', so Arterra
  has no theme menu.
- **The switch is in Settings**, a Universe row with both names (the same day: "The switch can be in settings"). The app
  opens in the universe last used, Avium the first time, and an address opens in its own universe (`?world=arterra` on
  Arterra's).

How it is sealed. The page is a shell (`src/Shell.tsx`) holding a copy of the app for each universe in a frame of its
own, made the first time that universe is opened and kept from then on; it shows one. A copy is one universe's from its
first line (`App.tsx`, `WORLD`): its records are cut down to that universe before anything is built from them
(`src/data/worlds.js`, `scopeRecords`), so no list, index, search or cache in it can hold the other's. The address bar,
Back and Forward are the shell's; a frame reports its address and is handed the ones that arrive. What a universe keeps
in the browser (cart, saved tournaments, editor forms) is under its own keys; the theme and the sign-in are shared. A
saved tournament holding a side of the other universe, or a save file exported from it, is refused.

Where a record belongs: a national side by its sheet (AVIUM or ARTERRA); a club or league by its nation; a player or
manager by `world: "arterra"` on his own record, set when he is made and never changed. National codes are never shared
between the two, which keeps an editor's rights in one universe. The registry server seals every change before it
commits (`sealDraft`, through `planSave` and `settleRequest`): a new man is given his universe, and a man, a manager or
a nationality of one is refused in the other. Each universe's transfers go in its own log.

**Viewer Mode** (Moukden and Kirin, 13 October 2026: "add a viewer mode in settings for the overseer so I can view the app
as a normie") is the overseer's switch in the settings menu, kept in his browser: on, the app treats him as someone signed
out, his session kept. The Editor, Requests and the Cart go, no side is his, and a college player's rating, value and
traits are hidden from him as from everyone else; the account menu says so.

### Pages (the page bar)

Each section's pages are tabs in the page bar under the top bar. A page about one thing (a club, a nation, a player)
starts the page bar with its crest and name. Every page has its own address.

A club has two pages: **Overview** and **History**. Overview runs left to right (user, 13 October 2026, after a squad
column beside the pitch had squeezed it thin and cut names short): the **profile**, one sidebar in sections (user: "Do
multiple sections here", then "Keep the left in one sidebar"): the crest, name and code stacked at its top, the crest as big
as the room the sections leave, 64 to 200 pixels ("that badge can be a lot bigger"), a name too long for the sidebar narrowed
as Full Time's are, the crest opening across
the window as the ground's photo does; then Kits, home and away a row each with the colour's code under its name; Stadium, its photo at its own 5:1 proportions
("the stadium image needs to be displayed at original aspect ratio") with the ground's name, city and capacity under it (no
photo keeps the kit colours); Manager, his face, name, rating and style and
the side's shape; Strength, the side's rating then ATT, MID, DEF and BENCH as Play Match compares them; and Age & Value. The
League, City population and Time Wasting rows went with the sections. Then the **squad**, a Pitch or List switch in its title
bar, the list on every visit (user: "make list view the default"): the list a row a man with his face, place and other
position, his traits in a column of their own (user: "Give traits its own column"), nation, age, rating, value and the
season's figures, the bench's eleven places with an open one a quiet row and Vacant; the pitch in the formation with the bench
in a strip down its right, every place on it drawn as on the pitch but smaller. Its column is at least 624 pixels, and the
pitch's full width with the bench beside it when the window is tall enough, the profile and the season giving up their width
first once they have 264 pixels each (down to 240 on a narrow window); Results keeps its width. Then the **season** (place and league, then points leading the figures, form, top scorer and most
assists) over **Honours**; and **Results**. League Finishes is gone from it.
History is a row a season,
newest first, with its division, finish, record, cup run and Club World Cup or Shield run, titles in gold, and its
manager (both, where a year had two), and its honours beside it by competition with the years each was won. A national side has the same two pages: its squad of
22 is its squad, each man with his club and the year's international figures, its **latest tournament** (where it went
out or that it won, its record, results, top scorer and most assists; user: "it should just say how the team did in the
most recent int'l tournament") stands where a club's season is, and History has a column each for
the World Cup, its qualifying and the Nations League, then its AFA ranking that year, then its manager (the old confederation championships have no
column, and count only toward who managed it).

**Positions** (Moukden and Kirin, 11 October 2026, over three rounds of questions). Every player has one or two positions of
his own on his record (`pos`, `src/data/positions.js`) and plays both at his full rating. Anywhere else he keeps his own
position's skills, whichever of his two costs him less there (the nearer of them until 14 October 2026), and is never better than the slot's own player at anything
(`src/engine/attributes.ts` meAttrs); the keeper's slot is apart, an outfielder in goal at half his rating as before.
The app shows a man out of position at about the rating he plays the place at (`ovrAt`, from `POS_DROP`, which
`test/posdrop.mjs` writes from what each skill is worth in each kind of slot, measured by `test/specs/positions.mjs` and
`positions2.mjs` on goal difference; a slot's main skills count whole and any other skill's gap counts less the larger it
is, which twelve moves played out by `positions-check.mjs` confirmed within their noise), ringed in
the loss colour on every pitch, for the eleven only: the eleven's rating counts it, a side's own rating does not. Out of position means the place costs him (`posDrop` above 0, the user, 11 October 2026): a free move,
a left back on the right or a central midfielder holding, is not flagged. Flagged, he carries the alert: on a pitch a
red warning triangle centred over his place's label and the cost (a drawn arrow down and the points) in a block of his
rating's width over it; in a list the triangle and the cost after his place; each opens the out-of-position card
(TraitCard, `data-oop`). A player's page lights his own positions and puts a place a side plays him out of position in
the loss colour, with a line for each such side under the pitch (and on his Players card); the Players list puts the
alert beside his positions. Lists of a side show where each man plays, one place: the eleven's place, a bench man his
first position (the editor's bench, his position that fits the place); his banner and the Players list give both. Bench places keep a broad group (a club's keeper, defender, two midfielders and forward and the groups of the eleven those
leave uncovered; a national side's the groups of its eleven), in line order, keeper, defenders, midfielders, forwards
(Moukden and Kirin, 13 October 2026, "This needs to be organized properly"): substitutes are sorted into the places their
positions fit wherever men come or go, and a man left in another group's place is marked, not refused, with the rating
he plays it at, the least any of its positions costs him ("if a player DEF for example is placed in MID there should be an
alert and OVR decrease"). Substitutions, injury and ban cover, rotation,
formation changes and the manager's shape change all place men by their own positions; a substitute takes the slot of
the man he replaces. A manager's change for tired legs is only ever a man who plays that place at no cost, the score
choosing only between those (the most attacking chasing, the most defensive holding a lead), and with nobody who can
the tired man stays on; only an injury is covered out of position (Moukden and Kirin, 14 October 2026, after "Why do
coaches sub people in out of position so much?"). The change is made only once the man coming on would play the place
better than the tired man can on the legs he has left, a point of stamina costing 0.09 of a rating point (measured,
`test/specs/fatigue.mjs`), the most worthwhile first and each window taking its share, so a side's best players stay on;
a man who came on is not changed again, a level tie that must be settled keeps one change for extra time, and the man
coming on enters at halfway with the restart waiting for him (Moukden and Kirin, 16 October 2026, after the Nations League
final: "SURELY in a FINAL you'd keep them on for longer?"). Sim All allows the same five changes as Live Match for a bench
eleven places wide, however many it names. Positions are the overseer's: an editor asks for a change by request (`kind: "pos"`). The first
positions were set from where everyone played on 11 October 2026: club slot, then national slot (both where they
differ), past sheets for a second, and the club substitutes nobody had placed drawn inside their bench group to cover
their side's eleven.

**Who carries traits** (Moukden and Kirin, 11 October 2026). A trait costs its pips, gold 3, silver 2, bronze 1, and a
man's rating gives him a budget to spend on any tiers (`src/data/badges.js` budgetOf: 75-79 two points, 80-84 three,
85-89 four, 90 and over six), in at most two traits below 90 and three from 90; nobody under 75 carries any. He spends
all of it, so one rating comes in shapes (80-84: a single gold, or a silver and a bronze), and `test/traits.mjs` splits
each position and band evenly between its shapes ("Give a points budget to each OVR tier and distribute it between
golds, silvers, bronzes appropriately with differentiation"). An editor's new player may carry what his rating affords
(`traitsProblem`, checked by the registry's rules; the trait list shows the points spent and greys out what does not fit),
and the overseer's own edits show the budget without being held to it. A keeper carries Shot Stopper or Commanding, split evenly at each
rating, and from 80 one of Long Ball, Short Passing or Composed. Inside a tier every trait is held by as many men as
every other, give or take one. A trait can cross into any position where it means something in a match (`OPEN` in
`test/traits.mjs`), and is likelier where it was measured (`NATURAL`): the first run kept traits to their measured
positions and every position came out one habit (93% of centre-backs rated 80-84 Disciplined, 82% of wingers Crosser),
while the user's own picks for the men rated 90 or more crossed positions on a quarter of their traits ("There should be
distinctness all around", 11 October 2026). So inside each rating band and position the n-th man to take a trait pays
more for it past his group's fair share; the second run (`redo`, which gives everyone under 90 his traits again and
keeps the 90s as the user set them) crossed positions on 23% of traits, with no trait on more than about a third of any
position and band. `test/traits.mjs` chooses them in one min-cost flow: every man his count, the equal totals, a
top-tier trait for everyone who could take one, then variety, then the best fits from his career a game against men of
his position at his rating, and his age; `write` keeps any traits a man already has and counts them, so a rerun only
fills the men without. The overseer edits any man's traits on his page afterwards, from a list
a tier with a tick against each he carries (App.tsx edTraitList). Hovering or focusing any trait, anywhere, shows its
card: art, name, tier and the Traits table's words (TraitCard; whatever stands for a trait carries `data-trait`, found
by delegation, the card fixed to the window so no clipping panel cuts it).

**Who managed whom** is src/data/spells.js (Moukden and Kirin, 9 October 2026): the archive credits every season from
1931/32 on (the first with player statistics) to a manager. Everyone has run his current sides since then, except at the
sides that file lists, which name their managers in order and the season each took over. The sheets' moves of 6
September, 2 October and 5 October 2026 are real, apart from 6 September's swaps at Spartak, Dynamo and ISS and 5
October's at Eivorie; every
other change in the sheets' history was a cleanup. 9 October's moves are real too: three national sides took a coach
whose style fits theirs (Albers back at Kinshū; Rautinen and Sarelainen swapping Tierra Arcadia and Axerfreditenshin). So are 12 October's: the Giathkik Premier League's founding clubs took Sonobe (Zoryansk Rangers) and Ōkōchi (Svyatogorsk Spearmen), both out of work since leaving their Nichirian clubs. test/tenures.mjs checks the file against the records.
A bar in League Finishes opens that season, and hovering it (or reaching it by keyboard) shows a card over it: the
season, the place and the points (an AFA Rankings bar: the year, the place and the points). A national side's Overview
has its AFA Rankings under Honours, a bar a year (Moukden and Kirin, 24 October 2026: "one per year, below honours", then
"make it a graph instead of a list"). The ranking is results, not ratings ("Actually use points for 1934 and 1935
rankings too"): an Elo table over every recorded World Cup, World Cup qualifying and Nations League match from 1932,
every side starting on 1500 and keeping two thirds of its distance from 1500 at each year's turn ("Lead Fades Each
Year", taken out and then put back the same day), a World Cup match counting most. The confederation championships are
left out ("Don't use championships at all"); `test/afa.mjs` writes `src/data/afa.js`, a year at its close. Each year's full table is Competitions' fourth tab, **AFA
Rankings** (Moukden and Kirin, 24 October 2026: "a separate leaderboard page", "Competitions Tab"; tried first on Registry's
Nations panel and moved off it as "not detailed enough"), the year on a stepper at the page bar's right: every ranked
side's place and move, its points and what that year's matches won or lost it, its international record that year and
the titles it won. A side new to the table reads New.

A player has the same two pages (Moukden and Kirin, 9 October 2026). **Overview** opens on his banner, then three
columns: Positions (a pitch with a dot on each spot he plays, the crest of the side he plays it for beside it) over
Traits; Season Stats (a row a competition for the season picked, with a total row, each competition opening its season)
over Performance (his career a game as a polygon over the average career at his position); Career (a row a spell at
a side, his country's caps and goals under the clubs, one career total on the block's foot however few the rows) over
Honours (every title won in a season he played for the winner). **History** is a row a competition a season, newest
first, with every figure and the rating change that competition brought him. A change from no competition (a general rebalance,
the international one) is a row of its own, without a crest, where it fell among them, so his rating reads as one chain. The page bar names the player, with his club (his country if he has none) as the step up.
A panel with nothing to show is left out and the panel above it takes the room; a column left empty goes with it.

**Players** is FM's Player Search (Moukden and Kirin, 9 October 2026): one panel the height of the window, a filter row
(Search, Position, Nationality, Competition, Club, Age; Competition is the league a man's club plays in, and the Club filter
also holds Free Agents and the Hall Of Fame, which is not a page of its own) over one table of every player in the world on show, sortable by any column, and the selected
player's card down the right. The table has three views of the same men: **Overview** (positions, age, nationality,
club, OVR, value, career average rating), **Season** (one year in every competition, added up the way Leaders adds it,
the year picked in the title row) and **Career**. A row puts its man in the card; his name and the card's View Player
open his page. Arrow keys walk the rows.

**Managers** is the same panel for managers: Search, Style, Seat (clubs, national sides, both, free agents) and
Nationality over a table of each man's age, nationality, style, OVR, club win rate, national win rate and seats, and the
selected manager's card down the right. A row puts its man in the card; his name and the card's View Manager open his
page. Arrow keys walk the rows. The style is his: a manager owns the style his sides play (6 October 2026), read off his
club's sheet, else his national side's. A shape belongs to the side, so neither the list nor his page shows one (Moukden
and Kirin, 9 October 2026). His two win rates are every match the archive credits him with at clubs and with national
sides, kept apart since a rate means something else at each; under ten matches a rate is grey and lighter and sorts
below the rest, as a player's average rating does. A stage the archive files as tables alone (the oldest league seasons,
the 1932 and 1933 confederation groups) counts from its table lines.

**A manager** in work has two pages. **Overview** opens on his banner, a player's: his portrait (the solid silhouette
where he has none; Moukden and Kirin, 9 October 2026), the crests of his nation and his sides, and Style, OVR, Club Win %,
NT Win % and Age in the strip. Under it, **Tactics**: his side on a pitch in his shape, each man with the role he gives him, beside a
row a place (position, role, man); a manager with a club and a national side switches between them in the title row.
Then **Sides**, a row a side (its competition, rating, last season's finish, that season's record in every competition,
and form), over **Results**, every match his sides played that season, newest first, each opponent's name after its
code since the panel is wide. **History** is **Career** (a row a side he has run since 1931/32: the years, its record
in every competition and the win rate; on the block's foot a total for his clubs and one for his national sides, each
where he has run more than one, never the two added up), **Competitions** (a row a competition season he
managed: where his side finished and its record) and **Honours** (every title his sides won under him). A free agent
has one page: his banner over his history.

**Trades** (Moukden and Kirin, 13 October 2026, over one round of questions) is every move of a man the registry made,
season by season: trades between nations' clubs, free agent signings, releases, moves between one nation's own clubs and
managers changing club. The registry server writes it as each save or accepted offer goes live
(`public/avium/pstats/trades.tsv`, a row a man, the rows of one deal sharing its number; `src/data/trades.js`), so a move
made outside the app, a script on the records, is not in it. A deal is the moves one save or accept makes that share a
club. A season runs from one World Cup to the next (the user: "After every World Cup"): a move belongs to the year of the
latest World Cup on file when it went live, so the log opens on 1935. Three columns, as Rating Changes: **Seasons** (a row
each, newest first, with its deals and men moved), **Deals** (the picked season's, newest first, a row a deal: the real date
it was made, as the sport runs out of step with the world's clock (the user, 13 October 2026), and its kind, a Trade between nations' clubs, a Move between one nation's own, a Signing, a Release or a Manager; each
man in it with his position, rating and transfer value when he moved, frozen, and the clubs he left and joined; under them
each club's incoming and outgoing value), with a search for a player or a club; and **Clubs** (each club's men in and out
and their value in the season, highest net first; picking one filters Deals to it, picking it again clears it). A man at a
college shows no value there but to the overseer.

**Rating Changes** (Moukden and Kirin, 9 October 2026) answers who moved, in which refresh, and which sides gained.
Three columns. **Batches**: every refresh the changelog files, newest first, a row each (the competition's crest, its
name over the season and its rises and falls, each an arrow up or down before the count, the net at the right edge).
**Changes**: the picked batch, the newest at first, a row a player (position, the side he moved with, old rating, new
rating, the change), searchable, filtered by side and by rises or falls, sortable by any column, biggest rise first.
There is no view of every batch at once (the user, 9 October 2026). **Sides**: each side's rises and falls (the arrows again) and net in the batch, highest net first; picking one
filters Changes to it, picking it again clears it. A player's name opens his page, a side's name its own. The archive
is each universe's own (`public/<universe>/pstats`), and so is its calendar: Arterra's is the Arterra Cup alone
(`ac/`, 2040 and 2042, from the organiser's scorination posts on the Lightbound board), Avium's the World Cup and the rest.

**Competitions** (Moukden and Kirin, 9 October 2026) is the archive: every competition on file, every season of each and
who won it. A competition's clubs today are its nation's page and its players are on Players, so a competition has no
page of either; a domestic cup is a competition of its own. The section's page bar: **Overview**, **Years** and **Head To
Head**.
Seasons are filed at three depths, and each reads as deliberate: a winner alone (the World Cup before 1932, the cups,
NL2, the old championships), a final table alone (most league seasons, back to 1888/89), or the whole season with its
results and player figures (mostly 1931/32 on).

**Overview** is one panel the height of the window: a filter row (Search, Kind: Leagues, Cups, International, Retired;
Nation) over a row a competition, the international ones first, then each nation's by tier with its cup, then the
retired ones. A row is the competition's crest and name, its seasons on file, its holder, and the side with the most
titles with its count. No timeline or strip of champions (Moukden and Kirin, 9 October 2026: "just isn't really
necessary", of the competition's strip and then of the Overview's).

**Years** is a year a page, the newest first, picked in the page bar between the years before and after: every
competition that finished in it, in two tables so each column holds one kind of figure. **Leagues** (a season decided on
a table): the champion, its points, the runner-up and the margin. **Finals**: the winner, the score and the runner-up.
Both with the top scorer where a season has figures; a season filed as a winner alone goes with its competition's kind,
and each table takes room in proportion to its rows.

**Head To Head** sets two clubs or two national sides against each other, picked in its title row with two side pickers
(Moukden and Kirin, 9 October 2026: built in, with a search, never the browser's own select): their crests and
names either side of their record together (played, each side's wins, the draws, the goals), only the crest and name
opening the side's page. Clubs open on Spartak Kanagawa against Dynamo Mizuhara (Moukden and Kirin, 9 October 2026),
national sides on the pair that have met most often. Under it, **Meetings**:
every match between them on file, newest first (season, competition, round, home side, score, away side, the winner in
bold). Beside it, **Seasons Together**: every season both played the same competition, with each side's finish (a title
in gold, the higher finish white, the lower grey) and on the block's foot how often each finished higher. A league
season filed as a table alone has no meetings, but it counts here.

**A competition** has three pages; its crest and name start the page bar, with its nation as the step up when it has
one. The three, and Head To Head, split the window the same way (the side column 340 to 480px), so changing tab never
moves a panel. **Overview**: **Roll Of Honour** (a row a season, newest first: a league's champion, its points, the runner-up and the margin; a
cup's or a tournament's winner, the final's score and the runner-up; then the top scorer with his goals and, from
1931/32, the champion's manager) beside **Titles** (a row a side: titles, runners-up, the last season won).
**Season** is one season, picked in the page bar between the seasons before and after. Its main panel switches in the
title row between the season's stages and its **Player Stats** (every man with figures, sortable, with a search and
filters by position and side). A league's stage is its **Table**, after the round picked in Results (the last at
first). On the final table a bar at the left of a row marks the champion (`--gold`) and the places that went up (`--up`),
into a playoff (`--playoff`, every club the playoff took) and down (`--loss`), with a key, and an arrow after a club's
name marks that it went (Moukden and Kirin, 13 October 2026). Both are read off the nation's tables in the next season
the league has on file, over the war years: a club in none of them went down out of the leagues, unless its nation's cup
that season was played without it too and no club on file has its name, which is a club that folded and carries no mark. The newest season, before anyone has moved, marks who
its rules send, as the pyramid does. A club's History carries the same arrow beside its finish. A tournament's stages are its
report's (Group Stage and Knockouts; a double-elimination one's Upper Bracket, Lower Bracket and Grand Final): groups as
tables two abreast, knockouts as a bracket, a round a column. Beside the main panel, **Results** (the round or stage
picked, every match) over **Summary** (champion, runner-up, top scorer, top playmaker, MVP and golden glove; a season
of tables alone has its champion, runner-up, best attack and best defence). A season filed as a table alone has no
Results, and one filed as a winner alone has no page. **Records**: **All-Time Table** (every season on file added up, a
row a side: seasons, played, won, drawn, lost, goals for and against, goal difference, points, titles and best finish,
sortable; a tournament's counts appearances and finals in place of points) beside **Records** (most points, most goals,
fewest conceded, the widest title margin, most titles in a row, the biggest win and the most goals in a match, each with
its side and season) over **Player Records** (from 1931/32: most goals, assists and saves in a season, the best average
rating over half a season's football, and most goals over every season).

Old addresses forward: a competition's Teams goes to its nation, its Players to Players filtered to it, its Winners to
its Overview, and its cup to the cup's own pages.

### Tournaments

The tournaments made and played in this browser, rebuilt from the old Tournament screen (Moukden and Kirin, 9 October
2026, choosing every option below). Its machinery stays as it is: the draws, the schedules, the tables, the sims and the
saves. Only its screens are new, and everything the old screen could set up or do comes across.

**Saved** is the section's first page: a row a saved tournament (its name, format, sides, stage, leader or winner, the
matches played and when it was last saved, newest first) with New Tournament, Rename, Copy, Export, Import and Delete,
which asks twice. Opening one gives it its own page and address (#/tournament/<its name>, then its page).

**New Tournament** is one page. A preset picker in its title row (the eight formats, and the three ready-made fields:
1934 World Cup, 1934 Club World Shield, 1935 World Cup) fills three panels: **Format** (a league, groups then a
knockout, or a knockout alone; groups played round robin or Swiss; a knockout single or double elimination, with two
legs, a third-place match or a double elimination's reset match, and where no zone sends anybody through, how many go
through from each group), **Rules** (qualification zones, the tiebreakers in order, home advantage with its hosts
and venues, injuries, suspensions and tiredness) and **Sides** (the world's sides by league or conference, searchable).
Beside them, **What It Builds**: the groups, rounds and matches it will make, and under it, until it can start, what
stops it (**Before It Can Start**). Groups or ties seeded, random, picked by
hand or drawn; a draw opens its own page (pots, limits per nation and confederation, sides pinned to groups, and the
draw itself, a side at a time or all at once).

**The stages between** a setup and its matches are pages of their own, named in the page bar where a tournament's tabs
go (Moukden and Kirin, 10 October 2026: "build the draw pages and pages for picking groups, byes, and ties by hand,
intuitively and in the new UI style"). Each is kept in the save, so a reload reopens it where it was, mid-draw included.
**Group Draw**: the groups as boxes, two abreast or more, wrapping, each a row a place; down the side **Rules** (at most
so many clubs of one nation, or sides of one confederation, in a group, a limit no draw could meet greyed out with why on
hover, and sides pinned to groups), with Possible or Impossible beside the title from the draw's own solver, over
**Pots** (by rating, nation, confederation or by hand, and how many). Begin Draw, then a side at a time (Draw Next), by
itself (Auto) or all at once (Draw All): **The Draw** names the side just out and its group, the group's box lights,
and a drawn side greys out in its pot with its group's letter. A knockout round's draw (**Quarter-Finals Draw** and the
others) is the same page with ties for groups and the sides through on a bye under them, its rules the later rounds also
to be drawn and the sides kept apart (confederations, nations, groups, winners from winners), and the pool down the side.
**Groups By Hand** and **Ties By Hand**: the sides still to place down the left, searchable, the boxes on the right; a
side clicked is in hand and lights every box that can take it, the box clicked next takes it (or it is dragged there), a
placed side's cross sends it back, and Fill At Random and Clear do the rest. A tie left with one side is a bye.
**Byes**: the sides through, ranked with their group record, a tick each, Top By Ranking, and Confirm Byes. Each page
has the way back to where it came from (Back To Setup, Back To Groups) until a draw begins, and Reset.

**A tournament** has four pages; its name starts the page bar under Tournaments, and at its right are Sim Round and Sim
All (Proceed To Knockout, or Pair Round in a Swiss stage, when one is due), Export (the season file, the player stats
sheet and the bracket) and Reset, which asks twice.
**Overview**: the stage under way as the main panel, built as a competition's Season is (groups as tables two abreast,
wrapping where the window is narrow, with their zone bars; a league as one table with its form; a knockout as a bracket
with the third-place match under the final), beside **Fixtures** (the round
picked: each match with Sim, Score and Live, a played one with Edit and Delete, as icons in that narrow column, a
fast-forward, a pencil and a screen, named on hover) over **Leaders** (goals, assists, average rating, chances created,
defensive actions and saves, each opening Player Stats sorted by it; the men unavailable behind a count in its title
row). Rules gives the side column more of the window than a competition's pages do (480 to 620px); Overview's is 340 to
400px, its fixtures naming each side by its code with the name on hover, so the tables keep their names whole (Moukden and
Kirin, 10 October 2026: "the team names in fixtures shouldn't be truncated", and 14 October: "the fixtures should use team
codes so that the team names aren't all truncated"). Once it is over, **Summary** (the champion, the runner-up and
third) takes the place of Fixtures. **Fixtures**:
every round of every stage, the round being played scrolled into view, the same rows with the buttons' names and each
match's home advantage. Delete asks twice, and a knockout's clears the rounds after it. **Player Stats**: as a season's.
**Rules**: what it was set up with, and what can still change from the next match (the tiebreakers, home advantage).
Live hands the match to Play Match and brings its result back. A finished tournament downloads its season file and its
player stats sheet in the archive's format, to be filed by hand; a File To Archive button can follow. A season file is
written as tabs whenever there is more than one group, so a group stage filed before its knockout reads too, and the
sides a group sent through are in bold in its table. A group a preset names (a college league's conferences) goes by its
name wherever a group is named (its table, a side's route into the knockout, a fixture on Live Match), and by its
initials where a column only has room for a letter. Overview's Fixtures, too narrow for long names, gives each side by its code, the name on hover (the user,
14 October 2026: "the fixtures should use team codes so that the team names aren't all truncated").

The rebuild also puts right what the old screen got wrong (found reading its code, 9 October 2026, each reproduced and
fixed 10 October): editing a played score replaces its player stats, and a knockout edit clears the rounds after it,
their stats with them, only when the tie has a new winner; a score entered by hand has scorers that match it (the match is
played out once and its goals fitted to the score); a knockout finished live or typed ends the tournament or opens the
next round's draw, as a simmed one does, and Sim All stops at a round that is to be drawn; confirming byes keeps the
group stage's player stats; a reload in the middle of setup reopens where it was; the sides judge a group match
against the line the qualification zones draw; a lone final keeps Sim Round and Sim All; and Reset asks twice before
autosave can overwrite the save.

### Play Match

The match engine's own page, opened by **Play Match** at the right of the top bar or by a tournament's Live, rebuilt
from the old setup screen (Moukden and Kirin, 10 October 2026, choosing every option below). It is one page: the setup
and both team sheets together, so a side's team sheet shows the moment it is picked, and the old Pre-Match step is
gone. Its page bar names a tournament's fixture under its tournament, and the kind of match (Friendly, Final, Group A,
Round 2) is its one tab; at its right are **Sim To End** and **Kick Off**, and Drop Fixture for a tournament's fixture.
The live match and Full Time follow below.

**The banner** runs the width of the page over the chosen ground's photo. Each side has its crest at the outer edge, then
its name, which opens its side picker (the Side picker below: every league a group, a rating on
each row), a die beside it for a random side from any league (a club for a club, a national side for a national side), its league, and its manager with his style in its
colour and his rating. Between them: the ground with its city and capacity, then the venue switch (Home Ground, Away
Ground or Neutral) centred under it with Swap Ends to its left ("home/away/neutral isnt centered", Moukden and Kirin, 10
October 2026). A neutral ground is picked from the ground's name itself, a searchable list by nation.

Under it, three columns. Down each outside, the side's **Team Sheet**: its eleven on the Pitch at the panel's full height,
in a real pitch's widest proportions, or its bench (a row a man, given name and SURNAME, the surname bold: "John DOE";
an open place a quiet row with its group and Vacant, user, 12 October 2026: "Vacant spots should be shown"), by the switch in its
title row, which reads the formation and Bench (Moukden and Kirin, 10 October 2026: "Do manager and bench need their own
column?", then "Dude have you seen how crowded the pitches are"). Between them: **Strength Comparison** (the eleven's ATT,
MID and DEF, then BENCH, each pair facing across its label; the user, 11 October 2026: "only keep ATT, MID, DEF, and BENCH"), **Form** (each side's last five, on one
line), **Head To Head** (their record and every meeting on file) and **Rules** (Result: Draw Allowed or Extra Time And
Penalties; Injuries; Second Leg with the first leg's score, which counts in a friendly too, and Away Goals). Sides play
as listed under their managers: nothing about a side changes before kick-off, and Subs and Tactics stay in the live
match.

A match closed midway shows **In Progress** in the page bar (the score and the minute) with Abandon, which asks twice,
and Resume. A tournament's fixture keeps its sides and whatever the tournament sets locked, its rules shown as facts.
The fixture is in the address. Auto Tempo and Auto Subs are gone: nothing ever read them. Not picked: kits, a
prediction, recent fixtures, changing a side before kick-off, a table to browse sides.

### Live Match

The match keeps the whole window once it kicks off, and the strip across the top is gone (Moukden and Kirin, 10 October
2026: "Own screen, broadcast-style scoreboard instead of strip", and the rest below, each the option recommended unless
said). The pitch fills the left, the sidebar the right.

**The scorebug** sits top left over the pitch, in a deeper run-off above the touchline that the live pitch keeps for it,
so it never covers play or the goal replay pinned to the touchline's corner. It follows an MLS broadcast's bug (Moukden
and Kirin, 10 October 2026: "The scoreboard's a little simple, no?", then "Just do something like this"): each side a
panel in its kit colour, its crest drawn big at the outer end and cut off in a patch of its own whose inner edge is a
diagonal with a thin stripe down it in the side's away colour, and its code close beside it, as the model's are ("The
badge should overflow", "Too much space between the badge and the name. There's also a diagonal cutoff between them",
"Have a small team away colored divider at the diagonal"); the score dark on a light block tight against both codes
("too much space between team code and the score. Make it more compact"); the clock in a box of its own, with added time beside it in amber and HALF TIME
or another break in its place. Extra time and the aggregate hang under the bar. A code is white on a dark kit and black
on a light one (gold, silver, orange), where white would not read.

**In a shootout** ("Also what's it look like during penalty shootouts") the clock box reads PENALTIES, each side's kicks
run under its panel in the order taken (scored; missed, with a cross as well as the red; still to come; and a yellow ring
on the kick being taken), and the shootout's own score sits under the match score in the penalties yellow. Best of five,
then a kick each, the marks growing with sudden death. Once it is over the bar carries the result, 4-3 PENS.

**The sidebar**, top to bottom: the ground (its photo, with its name, city and nation over it, and a theme's
competition art); **Feed** and **Ratings** on one switch, the feed as before and Ratings both elevens side by side, each
man's rating so far and the legs he has left, the men taken off greyed under them; **Live Stats** (possession, xG, shots,
on target, corners, cards, and each eleven's OVR); **Momentum**, which side is on top minute by minute, home above the
line and away below, a dot for each goal and a dashed rule at each interval; the Top Player; and the controls. Those are
Start or Pause (Continue at a break), Sim To End and Close; the speeds, a quarter to twenty times, on one switch, with
Overlay where the match has one; and Stats, Subs and Tactics.

**Subs and Tactics** pause the match while either is open and play on when it closes; Stats only reads, so it leaves the
match running. Each takes the pitch's place with the scorebug still over it, a panel a side under its manager. Subs lists
the men on the pitch and the bench, each at his listed rating with what coaching and tired legs do to it and his stamina;
pick a man, then his replacement, and the change is made at the next stoppage. Tactics shows each instruction as a switch
lit at the option nearest the one in force, since the managers move them during a match, with From The Dugout under it.

**Replays and Save GIF (22 November 2026).** Asked: "saving replays as a gif, with the game, scorer, minute, assister if
applicable. Replays should also be longer and maybe more detailed." Answers: the button on both the live replay and the
Full Time highlights; up to fifteen seconds of play; smoother motion, names and pass lines, ball height and a slow-motion
finish, all four; the GIF framed on the attacking half with the caption below. A replay runs back to where the side won the
ball, fifteen seconds at most, the last second at half pace. The button is a round arrow, titled Save GIF, beside the
replay's own. No library: `src/gif.ts` writes the GIF.

Three corrections the same day, in the user's words. "Hate the styling. Do player name that fades away after the touch, and
no tracking lines in the gif." Then: "The non-gif replay should just look like before and the in-game replay should be
fullscreen and full detail like a game." Then: "why do names only show up once per player? The GIF is also way too slow,
not fluid enough, and the ball is too big, and it all looks too fucking arcady instead of a proper professional replay."
So there are three drawings and they are not to be merged:

- **The Full Time highlights** are drawn as they were before any of this: dots, the yellow ball trail, one ball. Only the
  Save GIF button is new there.
- **The in-game replay** is not an inset. It takes the whole pitch and is drawn by the match's own `dot()` from the tape:
  kit, keeper, surname, the way each man faces, the reach ring on the man with the ball, the ball at its real size. The
  word Replay in the corner, progress along the bottom touchline, and three round buttons: Save GIF, play again, close.
- **The GIF** is 648 by 546 in the match's turf and markings, goal at the top, the view sliding up with the ball. Men are
  small dots with a nose for the way they face, the keeper in his own colour; the ball is small with a shadow. No trail
  and no pass lines. A man's name comes up over him every time he touches the ball (`meTouchLog`: held at his feet, or
  played first time), holds a moment and fades. Twenty-five pictures a second at the speed of play (see the fourth
  correction below; at sixteen pictures a second it had been "way too slow", and at twice the speed "a bit too fast"). Under the pitch, a bar ("make it look like a
  real highlight reel. Also redesign info UI to have team logos and scorer portrait"): the scorer's portrait in a ring of
  his side's colour, the minute, his name and Assist with the name on the left; crest, code, the score in a white box,
  code, crest on the right, the competition under them. Crests and portraits are found the way `TeamCrest` and
  `PlayerShot` find them, with the same fallbacks (a plain shield, the placeholder face).

A fourth, the same evening: "Why is the replay so much faster than the match? Make all replays the same speed as the
match. Also, the in-match replay should be an option to open, not something instant. Come on. You know better. This isn't
professional." So:

- **A replay is never staged.** A goal no longer freezes the match and plays itself back. The match plays on; Replay in
  the corner of the pitch opens the last goal's, and the arrow on a goal's line in the feed opens that goal's. The match
  waits while one is open and carries on from the same instant when it is closed.
- **Every replay runs at the speed of the match.** In the match, at the speed it is being watched at; in the Full Time
  highlights and the GIF, at the speed of play. No slow-motion finish anywhere (it had been asked for with the first
  design and went with this).

The rule behind both: nothing takes the screen from the match unasked, and nothing shown of the match moves at a speed
the match does not.

Players in both the replay and the GIF move on a curve through the tape's four positions a second (`meManAt`), because
straight lines between them made every turn a corner. The tape keeps each man's facing and the last deliberate touch for
this (`meSnap` fc, tk).

**The broadcast's graphics (22 November 2026).** Asked: "implement better match graphics & animations. PL-style.
Goalscorer, H2H, all of the other PL animations that come off of the scoreboard. Replay will be a popup there too."
Everything the broadcast says beyond the score is a plate that comes out from under the scorebug, holds, and goes back in
(`MatchGfx`, `.ux-gfx-*`). One at a time, on the wall clock, never stopping the match.

- **Goal.** The bar is wiped with GOAL in the scoring side's kit colour, from that side, and the score rolls as the wipe
  clears. Under that side: the scorer's portrait, surname and minute; Penalty, Own Goal, Second Goal or Hat-Trick; Assist
  and the name; and **Replay**, which is where a replay is opened from now (the pitch-corner button is gone; the feed's
  arrows stay for earlier goals). Nine seconds.
- **Card, change, missed penalty.** Under the side concerned: the card and the name (a red with its reason, a second
  yellow as both cards); up to three changes on one plate, the man coming on over the man going off.
- **Numbers.** Possession, Shots, Passes, On Target, xG, Corners, one at a time at set minutes, the two values either
  side of the label over a bar in the sides' colours.
- **Head To Head** at the kick-off: each side's wins, the draws, a three-way bar; First Meeting when there is none. The
  same record Play Match's Head To Head panel shows.
- **The interval.** While a break waits for Continue: the scorers each side and five numbers.
- **On the bar itself.** A red mark by a side's code for each man sent off; added time comes out of the clock; Replay as
  a tag while a replay is up.

Shape and colour are the scorebug's own: its dark plate, its title face, its diagonal on the inner end of a one-sided
plate, the side's colour on the outer edge (lifted when too dark to show). A goal or a red card cuts in on a number.
At four times speed or faster only goals, cards and changes show; at eight times, goals and red cards. Nothing from
before the match was opened is shown. Class names carry their own prefix (`ux-gfx-s`, `ux-gfx-r`): `.ux-side > span`
already fades its text and caught the first build.

**The sidebar, the feed and the cut to a replay (22 November 2026).** With a crop of a goal's line, its replay arrow hanging
below the name: "There should be a screen-wide animation when opening the replay. Also remove live stats from sidebar and
fix alignment issue here. So feed and ratings should just both be there. Also, improve feed: Have headings like 'Injury',
'Foul', 'Yellow Card', etc. and the player portrait/name below instead of stuffing it all on one line." Then, of the first
build: "No everything needs to be more neatly aligned."

- **The sidebar** is the ground, Feed, Ratings, Momentum, Top Player, the controls. No Feed/Ratings switch and no Live
  Stats: the numbers are the scorebug's plates and the Stats panel. The feed takes the slack and scrolls; the ratings give
  way first in a short window.
- **A feed row is one grid, the same for every row** (`.ux-fd-row`): the minute set to its right edge, the icon, the
  text, the side's code in a box of fixed width. Line one is the minute, the icon, the heading and the code. The man is
  on the line under the heading and starts where the heading starts, portrait then name then what there is to add
  (Assist and a name, a red card's reason, Time Wasting, an injury, On and Off for a change, which is two lines). A
  restart with nobody to name is its heading alone. A goal's replay button sits under the side's code, centred on it.
  A long name slides; what is said about the man gives way first. Icons are drawn (`tlIcon`), never emoji.
- **The cut to a replay and back** (`.ux-wipe`, `meWipeGo`): two slanted panels on the scorebug's diagonal cross the
  whole picture, the scoring side's colour then the dark plate, the word Replay between them. The picture changes while
  they cover it and the replay starts as they clear. Not shown under reduced motion.

**The sidebar, Subs and Tactics again (23 November 2026).** With a screenshot of the sidebar: "Ratings on the sidebar should
only show the active men (red card if applicable), not subbed off men, or else the feed gets squished", "The sidebar, except
the stadium banner, can definitely use a visual overhaul", "Make substitutions drag and drop with a save button", "Have the
tactics screen be more detailed about every aspect of the manager's decisions."

- **Ratings** list the eleven on the pitch only: place, surname with any card, a stamina gauge filled from the bottom, the
  rating. A man sent off stays, greyed; a man taken off leaves for the one who came on.
- **The sidebar's look** is the scorebug's: heads in the title face behind a tick on its slant with a rule to the edge, each
  side's code on a plate in its kit (`.ux-fd-side`, `.ux-lr-head`), the controls and the speeds as square plates cut on the
  same diagonal, focus drawn inside the plate. No rounded corners in the sidebar or the panels over the pitch.
- **Subs** is a draft. A bench man is dragged onto the man he replaces (or the other way), and the two change places in the
  lists, the one coming on edged in the win colour, the one going off greyed on the bench in the loss colour, each with an
  undo. A click on one row then on a row in the other list does the same. Save hands the draft to the queue the next stoppage
  plays and closes the panel; Clear empties it; closing without saving drops it. The draft opens on what is already queued.
- **Tactics** reads the engine's own state, a column a side: Game Plan (style and the one on his record when he switched, his
  read of theirs, formation and his own, stakes, aggregate, sitting deeper or going wider, intent as a meter off the chase,
  individual orders), Touchline (the four settable orders), Instructions (the rest, with an arrow where he has moved one off
  his style's sheet), Style by phase, Marking (danger man, marker and how tight, weak link), Set Pieces (who corners are aimed
  at, who marks their best in the air, the box at corners, the penalty pool), Roles, Changes (made, windows, the men he is
  weighing on meCoachSubs's own thresholds), and the whole of From The Dugout. The pre-match read is kept on `s.mgrRead`
  (manager.ts), which nothing in the engine reads.
- **Tactics, second pass** (the user: "From the Dugout to the top", "Color-code instructions (offensive/defensive)", "Height
  of everything in both columns need to match", "Marking, set pieces, roles: no player portraits, arrange more neatly.
  Roles: surname only"). From The Dugout leads. The panel is one table of two columns (`.ux-tc-table`), a cell a row a side,
  the shorter list padded, so every row stands level with its partner. Every setting is drawn in the attacking shapes'
  colour or the defensive shapes' (`--ui-attack`, `--ui-form-defensive`, as FORM_CLR) by which way it leans, plain at the
  middle; intent and the approach bars use the same two. No portraits anywhere in the panel: a man is his position then his
  name in fixed columns; set pieces are a row each (Corners Aimed At, Their Best In Air, Marked By, Box At Corners, and the
  penalty pool a name a row); roles are surname and role in fixed columns.
- **Third pass** (the user: "Remove 'Winner Or One Of', their best in air, marked by (from display, not code). Rename Corners
  Aimed At -> Corner Target. From the Dugout should have a set height and be scrollable"). Set Pieces shows Corner Target,
  Box At Corners and the penalty pool under Penalties; the other two are still worked out in App.tsx. From The Dugout is a
  168px box that scrolls, level on both sides. The marker's tightness (the plan's level, 0 to 1) is a percentage in a fixed column, not a
  bar ("Blue line -> numerical value").
- **Small fixes.** A side's code sits in the middle of its plate above the 2px edge, the letter-spacing given back on the
  left ("Align code properly"). The Top Player's counts are G, A and SV after the figure, in the position's face ("Replace
  stuff like '1 Goal' with G, A, SV, etc. in the same font as position").

**Phones, goal cards and the replay from Full Time (23 November 2026).** "Someone said that they were able to use the app
on mobile, horizontal? Shouldn't be able to happen." The gate now also covers a touch screen whose short side is under
600px (a phone on its side; the smallest tablet sideways is 744 tall), and reads "The engine needs a desktop, or a tablet
held sideways". Then: "'The Goals:' should only highlight the path of the SHOT. Indicate passes better (dots?), and there
should be a replay button, like in matches." A goal card (GoalReplay, on Full Time and in Stats) is a still of the move: the
shot alone is a line, gold, along the ball's flight; each pass the scoring side played before it is a chain of white dots
with a dot on the passer, read off the engine's own events kept on every taped frame (`snap.ev`: pass, head, shot). The
card no longer plays under the pointer; its round button (the feed's own) opens the goal's full-pitch replay, wipe and
all, over Full Time too, at normal speed whatever speed the match ended at. Mocks for the Full Time redesign are
`design/mock/fulltime-a.png` and `fulltime-b.png` (`node design/mock/fulltime.mjs <match.json>`), not built.

**The mistakes and the goal mix (22 November 2026).** After watching the rebuilt passing: "Passes. Great. Pretty accurate
at the top level", then "you might want to nerf players' field awareness and/or reaction time and/or touch quality and/or
pass quality dynamically based on OVR, field state, stamina, or something? It's literally too good to be true right now and
every attack is a perfect tiki taka goal", and "the vast majority of goals are coming from a bunch of quick passes, low
cross into box, tap-in. Almost never seeing any long shots/goals, headed goals, etc. Not even penalties." Asked: mistakes
come from Pressure, Rating and Speed Of Play (Tiredness was offered and not picked); the best sides stay Fluid Vs Weak
Only; the goal mix is Real Football.

- **Pressure is who, not how many.** A man closing down counts for his tackling and positioning (`meDefQ`, `mePressQ`):
  it hurries the pass, the first touch and the shot, and a composed man is hurried less. This is what makes a good
  defence break up a top side's passing and a poor one let it through. The decision still sees only that he is being
  closed down.
- **Speed of play and rating.** A ball struck first time or on the move costs more aim and weight, and more of a
  first-time finish; lower-rated men pass, judge and look around worse; better defenders read a pass sooner and reach
  further for it.
- **Retuned 24 November 2026: mistakes are forced, not given away.** Measured by situation (`test/mistab.mjs`), the round
  moved pass completion by about a point in every situation; what it visibly added was first touches lost under a man
  (4.8% to 8.8% within two metres) and passes cut out. The parts nobody forces went back to where they were: the
  unpressed strike (`passNoiseSkill`, `powerNoiseSkill`), the choice of pass (`judgeErr`) and the look around
  (`MT.scanLo`). The touch under a man was eased (`ftDp` 0.36, 5.5% within two metres) and a free man's touch made surer
  (`ftFree` 0.7: 1.8% lost to 0.9%). Pressure by who applies it, the first-time ball and the defenders' reading of a pass
  stay. Goals at 18 minutes: League One 2.82, the sixteen best national sides 2.63 (1,200 fixtures).
- **The dribbler stays behind his ball (24 November 2026).** He was given the ball's pace on top of closing the gap to a
  mark that already allowed for it, so he ran past it and carried it at his side or behind him. He now covers exactly the
  gap (`match.ts` meMove) and makes small corrections in full (`carryAcc`). With the look halved the same day, attacks
  worked better and the match went to fifteen minutes: League One 2.81, the best national sides 2.68.
- **The tap-in is defended.** In his own area a defender throws a leg at a pass as he does at a shot (`boxCutK`). This,
  not the passer's valuation of the square ball, is what moves it: valuing the square ball less was measured and did
  nothing.
- **Headers come from crosses put in front of goal.** A cross is led toward the front of the six-yard box and is only on
  when it can be met inside about twelve metres; any ball dropping at head height in front of goal is headed at it; the
  man attacking a cross wins more of the duels. Corners were left alone: a match has two, each costs thirty-five seconds,
  and that is why headed goals reach one in eight and not the real one in six.
- **Penalties** by more fouls and handballs in the area, to about one goal in ten.
- **The match is seventeen minutes.** Mistakes cost about a fifth of the scoring a minute; the match was thirteen
  minutes for the too-perfect build and eighteen before any of this. (Eighteen again later the same day: see the
  sizing run below.)

Measured as arms on the same fixtures, League One and the twelve best national sides, 1,200 fixtures a side each
(`test/specs/mix.mjs`, two rounds). Do not tune any of it on local samples: sixty matches swing by 0.3 goals.

**The keeper's own goals and the look (22 November 2026).** With three saved replays: "why are there so many instances of
the goalkeeper palming the ball into their own net???", and "you still haven't addressed the fact that there are too many
passes. You added error, sure, but they're still passing too much - real players don't process things as fast as them.
But don't nerf accuracy or whatnot any further." Then, mid-work: "Maybe add some sort of memory? So that simple obvious
passes won't require much thought, and the opposite for passes you have to kind of search for."

- **A caught ball stays caught.** Two of the three replays were own goals by the keeper. Traced: a keeper who won the
  catch on a hard shot fell through to the line that makes a pass too fast for an outfielder's feet squirt off him, so
  the "save" came off him at a third of its pace toward a random point, now and then over his own line. Four in thirty
  internationals before, none in forty after. The catch already prices how hard the ball came.
- **Nothing is led into his own goal mouth.** The other keeper own goal was a ball rolled out to a defender running
  back toward his own goal, led into his path a metre off the line between the posts (`ownMouthD`, `ownMouthW`).
- **Left alone:** a parry that still carries in (the fingertip rule, `gkGrazeP`), about one goal in twenty-five, credited
  to the shooter. It is the real "got a hand to it"; say if it should go too.
- **The look (`mindReady`, mind/decide.ts).** Every pass on a man's menu carries the thought it takes: little for a short
  open ball to a man in front of him; more for far, through a crowded lane, into a run, in the air, doubtful, or to a
  man he is not looking at; all of it longer for a less aware player, shorter when he is closed down. Memory pays part
  of it in advance: each slice he has had that man in sight before the ball arrives (a sixth field in the memory table,
  mind/perceive.ts) counts toward it. A first-time pass is one already paid for. After a controlling touch the earliest
  pass is two slices on (`touchSet`), and a man with nobody on him has three more slices before his time is up
  (`lookHold`). Nothing about how the ball is struck changed.
- **Measured locally, thirty matches a level, same fixtures:** passes a minute of play 25.9 to 19.7 in League One and
  27.8 to 21.0 among the twelve best national sides (a real match runs 16 to 17); first-time passes from a quarter of
  all passes to a tenth; mean time on the ball about 1.2 s (measured in the real game: about 1.1); passes kept 80.2% to
  83.3% and 78.2% to 82.1%. Goals and xG were inside the noise of thirty matches and have NOT been re-centred: that
  needs a cloud run, and the six allowed were already used.

**The dressed pitch (22 November 2026).** "Let's make the field and graphics look a lot better. Ideas? No more boring
dots and lines." Asked: Dressed Top-Down (not a follow camera, not a tilted view), names over every player, one house
look for every ground. A head and shoulders drawn from above was tried and rejected on sight: "Figures look goofy just
use dots."

- **Players stay dots:** kit colour, a soft shadow, a nose the way he faces, his reach ring when he has the ball, a
  small card beside a booked man. Drawn at 0.5 m, nearly twice his body, because at true size he is six pixels.
- **The ball** has a shadow that moves away from it as it rises and a streak behind it when it is struck hard. A pass
  no longer gets a line drawn for it; a challenge, a block or a save is a small ring on the grass.
- **The ground:** a dark speckled stand fills whatever the window leaves round the pitch, with boards along the far
  side and behind each goal line (a plain mark on each, never a word), a darker apron of grass, light falling away to
  the corners, worn goalmouths, nets seen from above that bulge when a goal goes in, corner flags and technical areas.
  Colours are `--ui-turf-*`, `--ui-stand*`, `--ui-board-*`, `--ui-net`, `--ui-flag` in theme.css.
- **One ground for every picture** ("Match the GIF and Full Time highlights too"): `PitchGround` draws it for the live
  pitch, the replay on it and the Full Time highlights; the saved GIF paints the same ground on its canvas in flat
  colours (no light across it, which 256 colours would band; plain grass at its two-metre sides, the stand and boards
  behind the goal line), with the shadows and the ball's streak.

**Effects (22 November 2026).** "I feel like headers, shots, tackles, blocks, and saves can have special effects." Asked:
all five groups, at full strength (one level, no setting), and the keeper may stretch along his dive ("Keeper can
stretch"); the dots, at 0.5 m, were "a bit too big" and are 0.4.

- **How it works.** The engine lists every event of a slice when the viewer asks (`out.fx`, match.ts `meEvt`; a harness
  never does, and results are unchanged). `meFxMake` turns a slice's list into records against the state as the slice
  left it; `meFxPrims` is what a record draws at an age (rings, lines, dots, in pitch metres); `meFxMan` is what the
  records do to a man. A record's clock is in slices, so an effect runs at the speed of whatever shows it: the live
  pitch, the replay (the tape's frames carry their records) and the saved GIF, which paints the same primitives.
- **Shots:** a ring at the boot, larger and brighter the harder it is struck; the frame flashes and trembles when it is
  hit; rings through the net after it bulges; cameras going off in the stand behind that goal and along the far side.
- **Headers:** the dot lifts off its shadow and lands; the man he beat lifts with him and drops first; a tick at the ball.
- **Tackles:** a slide draws the dot out along its line and leaves a scuff on the grass that fades over a few seconds
  (a slide is the duel's own call, carried on the event; it used to be guessed from the gap between the two men, and
  three standing tackles in four were drawn as slides);
  a standing tackle is a small burst between the two men; a foul is a ring in the warning colour.
- **Blocks:** a short bar square to the shot, and the blocker takes a step back along it.
- **Saves:** the keeper's dot drawn out along his dive, only with a shot on its way (the engine lengthens him whenever
  he moves quickly, and a keeper running is not diving); a catch is a ring closing on the ball in his yellow, a parry a
  burst of it.
- **Rules:** white and the keeper's yellow only, each over in about half a second of play, nothing stops or shakes the
  match; none of it for someone who has asked for less motion. The replay and the GIF hold their last frame while
  what the goal set off plays out.

**Traits by level, in families, with flaws (22 November 2026).** "We have a few new things now. Thinking delay, first
touch error, passing error, etcetera. We should redesign badges to cover everything new we have, more comprehensively, to
cover different player archetypes with combinations and such." Asked after a brainstorm: Levels; flaws In; Mind and
Keeper first; and "have some better names though: some of these don't sound football related at all or are too simple."

- **A trait has a level, one to three, and costs it.** The metals are now the levels (bronze, silver, gold), not a rank
  of one trait against another. A man spends his rating's budget (unchanged: 2, 3, 4, 6) on a few traits high or several
  low; the cap on how many he carries is gone. Stored as a key: `vision` is Vision at the level its effect is written
  at (`std`), `vision:3` at three (`src/data/badges.js`).
- **Nobody who already had traits changed.** Each of the first twenty-two has for its std what it used to cost, so every
  man carries his at that level, has spent what he had, and plays as before (golden identical). Below std a level is a
  share in proportion; above it the effect grows half as fast (`levelShare`), a share never past the whole, a habit that
  is his or not at any level (`attributes.ts`).
- **A flaw** costs him in play, at level one or two, and gives its level back in points. One a man.
- **Families:** Mind, Ball, Body, Finishing, Defending, Keeper. The pickers and the Traits table group by them.
- **The Traits page in the documentation** ("Organize the traits better in the documentation"; it was two long
  paragraphs and one table of fifty-one rows): the rules as a short list (Levels, Cost, Budget, Spending, Flaws, Pairs,
  Older Traits, In The App), one trait drawn at each level and as a flaw, then a table a family under its own heading,
  the family's flaws last and marked Flaw.
- **Mind, new:** Shoulder Check (scans more, remembers longer, a man out of sight costs no time to find), Pass And Move
  (the short ball to feet needs no thought, first time and clean, then he runs on), Dictates Tempo (waits longer with
  nobody on him, minds losing it, picks better), Man On (team-mates near him get the shout). Vision also needs less
  time for a pass that is hard to see. Flaws: Ball Watcher, Dwells On It.
- **Keeper, new:** Safe Hands (holds more), Strong Wrists (parries wide, the fingertip that carries in is rarer), Quick
  Release (lets it go sooner, surer throw, better long kick), Penalty Stopper. Flaws: Flaps At Crosses, Spills It.
- **Names: one describing word.** Two rounds were thrown out: plain nouns (Scanner, Tempo, Distributor: "don't sound
  football related at all or are too simple") and then commentator's phrases (Shoulder Check, Man On, Dwells On It,
  Flaps At Crosses: "Trait names still need work... What even are those"). Asked with all three lists in front of him,
  he chose One-Word Adjectives, the register of Rapid, Aerial, Relentless, Composed and Commanding. Everything below
  that names a new trait by an older name means: Alert (Shoulder Check), Slick (Pass And Move, First-Time Ball),
  Patient (Dictates Tempo), Vocal (Man On), Unaware (Ball Watcher), Hesitant (Dwells On It), Unflappable (Press
  Resistant), Fluent (On The Run), Deceptive (Disguised Pass), Driving (Drives Forward), Elusive (Draws The Foul),
  Clumsy (Heavy Touch), Wasteful (Gives It Away), Sturdy (Rides Tackles), Unfit (Runs Out Of Legs), Predatory (Goal
  Poacher), Unselfish (Squares It), Greedy, Tenacious (Closes Down), Desperate (Last Ditch), Tight (Tight Marker),
  Reckless (Hot Head), Dozy (Loses His Man), Assured (Safe Hands), Firm (Strong Wrists), Quick (Quick Release), Clutch
  (Penalty Stopper), Erratic (Flaps At Crosses), Nervous (Spills It). The ids in the data keep the first names.
- **Combinations are not bonuses.** A pair multiplies through the match itself (a man who has had more team-mates in
  sight has more of every pass already paid for). No number is added for holding a named pair.
- **Art:** one picture a level, `public/player-badges/<id>-<level>.svg`; a flaw in dull red iron with hollow pips.
- **Not sized.** The new effects are set by reasoning. A sixteen-match trace with a trait on every man shows the
  direction for Pass And Move (first-time passes 9% to 15%), Dwells On It (passes a match 298 to 268), Safe Hands
  (parries 4.3 to 2.4) and Spills It (4.3 to 6.4); Shoulder Check and Dictates Tempo showed nothing clear. Sizing them,
  and the old traits against the new passing errors, is a cloud run that has not been asked for yet.
- **The other four families, the same day** ("Go ahead, then do the other four families"). Ball: Press Resistant (his
  touch and pass with a man on him), On The Run (the strike at a run or first time), Disguised Pass (defenders read it
  late), Drives Forward, Draws The Foul; flaws Heavy Touch, Gives It Away. Body: Rides Tackles; flaw Runs Out Of Legs.
  Finishing: Goal Poacher (what comes loose in the area), Squares It; flaw Greedy. Defending: Closes Down (the man he
  closes is hurried more), Last Ditch (the leg at the square ball and the shot in his own area), Tight Marker (reacts
  sooner to his man's run); flaws Hot Head, Loses His Man. Fifty-one traits in all, ten of them flaws. Twelve-match
  traces show the direction for Disguised Pass (passes lost 49 to 40), Draws The Foul (fouls 20 to 28), Rides Tackles
  (tackles tried 30 to 14), Hot Head (fouls 20 to 26) and, faintly, Closes Down and Gives It Away; Press Resistant and
  On The Run showed nothing clear. These seventeen were built after the sizing run was started and are not in it.
- **The sizing run (cloud 45055086971, 31,680 matches; `test/specs/traits2.mjs`).**
  - *The look and goals.* 2,880 paired matches a level. League One 2.73 goals a match with the look, +0.03 (se 0.04)
    from it; the twelve best national sides 2.50, -0.02 (se 0.04). Passes a match 345 to 260 and 385 to 288 (a
    quarter fewer); passes kept +2.9 and +3.0 points; xG +0.29 and +0.28. A man on the ball longer is challenged more:
    penalty goals 0.28 to 0.41 in League One (15% of goals) and 0.23 to 0.32. Headed goals, goals from outside the
    area and first-time goals each fell a little.
  - *Acted on, by interpolation, not measured again:* fouls in the area back down (`boxTackleFoul` 0.45 to 0.27,
    `boxContactFoul` 0.32 to 0.19) for penalties at one goal in ten, and the match eighteen minutes again, which puts
    League One near 2.75 and the national sides near 2.56.
  - *The traits, in rating points on the man who carries one (about +-0.5 for an outfield placement, +-1.4 for a
    keeper's).* Man On +1.6. Dictates Tempo +0.5. Shoulder Check and Ball Watcher nothing. Pass And Move -3.1: a ball
    let go sooner with nobody on him is a worse ball. Dwells On It +0.6: taking longer made him better, so it was no
    flaw. Safe Hands and Shot Stopper about +2, Flaps At Crosses about -2, the other keeper traits inside the noise.
  - *Rewritten after it, and not measured since:* Pass And Move became First-Time Ball (how clean the ball is, not how
    soon it goes); Dwells On It acts only when he is closed down, and he is robbed more easily; Ball Watcher is also
    late to his man's run; Shoulder Check also knows of the man closing on his own blind side; Dictates Tempo a little
    more of everything.
  - *The old traits against what they cost,* same units: Interceptor 4.6, Quick Step 3.2, Finisher 2.3 (more on goals
    than on chances), Rapid about 2, Aerial 1.3 to 1.8, Strong 0.9 (all cost three); Disciplined 1.5, Relentless 0.8,
    Vision 0.8, Incisive 0.4, First Touch 0.2, Trickster 0.0, Long Shot about 0 (cost two); Composed 1.9, Short Passing
    1.8, Tackler 1.4, Long Ball 1.3, Crosser -0.3, Dead Ball -0.4 (cost one). Commanding measured -2 on its keeper.
    Composed and Short Passing are now worth more than they cost and First Touch, Trickster and Incisive less; nothing
    was repriced, because a price change would put existing players over or under their budgets.
- **The second sizing run and the ratings (cloud 45059646100 and 45059651165; "Go ahead with both runs").**
  - *Eighteen minutes, measured:* League One 2.84 goals a match (se 0.03), the twelve best national sides 2.56; penalty
    goals 12% and 10% of goals (0.34 and 0.26 a match), the lower fouls in the area having taken 0.11 and 0.08 off
    them. Trimmed a ninth more after it (`boxTackleFoul` 0.24, `boxContactFoul` 0.17), not measured.
  - *The four families,* rating points on the man: Disguised Pass +3.5; Closes Down +1.0; Last Ditch +0.8 on chances and
    about +2 on goals conceded; Press Resistant, On The Run, Drives Forward, Draws The Foul, Rides Tackles and Goal
    Poacher +0.6 to +0.8; Tight Marker nothing. Squares It -1.5 and Greedy +1.1, both the wrong way round: the passer
    already squares it as often as pays. Flaws: Heavy Touch -7.3 (far too much), Runs Out Of Legs, Hot Head and Loses
    His Man about -0.7, Gives It Away nothing.
  - *The rewritten five:* First-Time Ball -0.3 (was -3.1 as Pass And Move), Dwells On It -0.4 (was +0.6), Shoulder
    Check, Dictates Tempo and Ball Watcher still nothing: this engine pays little for seeing more.
  - *Keepers,* two runs together: Safe Hands about +4, Strong Wrists about +2, Spills It about -3, the rest inside
    the noise; Commanding negative in both.
  - *Turned up or rewritten after it, by reasoning, not measured:* every trait that read under +1 (and Heavy Touch
    down to a quarter); Squares It is now how well the square ball is played; Greedy also snatches at his chances;
    Tight Marker, Loses His Man and Ball Watcher move a man's positioning; Shoulder Check and Dictates Tempo carry a
    little judgement.
  - *Ratings refitted* (`rateFin`, `gkExp`, `gkExpPen`) on 2,971 matches of the eighteen-minute build; the check on
    the same matches holds every par.
- **Commanding reworked** ("Rework commanding, maybe increase collection range / reach when out?"). It only made the
  keeper come, for tighter races and further, and measured as a loss to his side in both runs. It now also makes him
  get there: more reach for a cross or a loose ball in his area, more again for a ball at his feet once he is off his
  line, a better read of the race, and a little less sweep. Every keeper who carries it changes with it. Not measured.
- **The deal (`test/traits2.mjs`; asked and answered 22 November 2026).** One point at 70 to 74 (`budgetOf`); everyone
  rated 70 and over dealt again, each keeping the trait he is best known for, never at a lower level while his points
  reach; a flaw on one man in five under 90 (level two for the quarter of each flaw's men it fits most, nobody under
  75); and first, one point made to buy about the same everywhere: Composed and Short Passing about halved, First
  Touch, Trickster and Incisive given the levers the runs showed are worth something. The rest of each man's places by
  the first deal's min-cost flow (position, record, age, variety), every trait held by as many men as every other.
  The 90s are dealt one by one outside the flow, a trait they were given by hand staying unless something fits
  clearly better ("90s can be changed if there's more fitting stuff"). `test/traits-picks.json`, when it exists, is
  the user's own word for a man and is written exactly. As a dry run: 3,264 men, 2,765 changed, every trait on 116 to
  117 of them and each keeper trait on 87 to 88, 648 flaws.
- **Written the same day, as a full fresh deal.** Shown that list, the user gave twenty-eight players as archetypes
  ("Here are the required player archetypes. Distribute traits accordingly") and then "You can reallocate all traits
  mate": nobody's old traits are kept, except by the four 90s he did not name. The twenty-eight are in
  `test/traits-picks.json`, one line a man, and are written exactly; a re-run cannot lose them. 3,264 men carry traits
  (649 a flaw), every outfield trait on 121 or 122 of them across all three levels, each keeper trait on 91, 30% of
  traits crossing position. After a merge with other editors' saves, run the script again rather than resolve
  players.json by hand.
- **Still to do:** The registry's server
  checks traits with the same rules file, so it needs redeploying before an editor can save a trait at a level.

Kept as they were: the players are dots with surnames (asked: As Now); the goal replay waits until it is closed and can
be played again; after the whistle the buttons are New and Replay, or Import, Replay and Abandon for a tournament's
fixture.

### Full Time

The page a result is screenshotted from, carrying every fact of the match (Moukden and Kirin, 10 October 2026: "full time
should be optimized for screenshots to show all match info"). On the screen it fills the window at one scale, drawn on a
1600 by 1092 design at the least: a wider window gives the middle and the timeline more room, a taller one the goals.

**Redesigned 23-24 November 2026** in the live sidebar's language ("Redesign the post-match screen in the same style you
redesigned the sidebar with. Give me mocks first after asking questions"; answers: rearranging allowed, two directions, the
first one taken). The mock it was approved from is `design/mock/fulltime.mjs` (`fulltime-a.png`; `fulltime-a-many.png` and
`fulltime-a-twenty.png` are the same match with 20 goals, 14-6 and 20-0, made up to test the banner). The rulings on the way:
"MANY malaligned elements", "Momentum, possession, on/off the ball (rename) need to have uniform heights and match the height
of the player list", "City name and nation next to stadium", "Drop the scoreboard; replace formation with code, move badges
back to where they are currently", "top of score always needs to be lined up with the top of the team names", "I expect max
goals to be around 20", four scorers a column, "The cards are meant to be fucking adjustable", "where's the download for the
goals???".

- **Every line in the title face is trimmed to its capitals** (`text-box: trim-both cap alphabetic`), so a code, a minute or a
  head centred in its box is centred on its letters.
- **The banner** (306 tall), over the ground's photo or the two kits: each side's crest at its outer edge, its name, its
  manager with his style, and its code with its eleven's OVR. The crest's drawn art is exactly as tall as those three lines,
  from the name's capitals to the code's foot, its top on theirs: every crest file pads its art differently, so FtCrest
  measures the drawn part of each file once and draws the file to it ("the badge height is meant to match the text next to
  it", then "not fucking aligned"). The two sit about the banner's middle. The photo or the kits stop 16 pixels short of the
  banner's foot under a veil that is solid there: painted to the foot, they showed through its last part-covered line of
  pixels as a seam ("Visible seam in the fade"). The score sits on the centre line, its top level with the tops
  of the names; the competition over it (a tournament's theme mark beside the words); FULL TIME under it, with AET, the
  shootout and the aggregate on the same line. Under all of that, the scorers: a line each with all his minutes (P for a
  penalty, OG), four to a column, columns going out from the centre (home's set to it from the left, away's from the
  right), five a side at most, so twenty goals to one side fit. The ground, its city and nation along the foot.
- **The timeline**: one line from kick-off to the last whistle; each event on a stem from its minute, home's above and
  away's below, its minute on a plate in the side's kit centred on the stem and what happened beside it, turned back from
  the right edge. A side's events within a minute and a half share a label. A label goes out a lane until it touches no
  other label, its stem passes through none nearer the line, and it covers no stem from further out; a side too crowded
  for names shows minutes and icons only; past that a label joins its neighbour. Goals, cards, missed penalties and
  injuries, never changes. As tall as its lanes.
- **The sheets** either side (470 wide): a plate in the side's kit with its crest, name and code; the column heads; the
  starters, a rule, the changes with the minute each came on or went off, the unused bench greyed; a row each at 17
  pixels. The top player has a star by his name.
- **The numbers** between them, every row on one of the sheets' row lines: On The Ball and Off The Ball (they were "with
  the ball" and "without it") on the sheets' last lines, Possession three lines above their head, Momentum taking the rest,
  so the column ends with the player list however long it is. Where the benches are short, the band runs on past the
  sheets as empty row lines until the starters and the numbers' rows fit, and the numbers end on the last of them. Heads one height (26) everywhere, the sheets' plates too. A
  tournament's Played Live count sits in the line Off The Ball leaves under Reds.
- **The goals**: a card each, as big as the strip allows (one row, or two or three when that makes every card bigger): the
  minute's plate, the scorer and who made it, the score, then the move (GoalReplay: the passes as dots, the shot a gold
  line) with Save GIF in its corner and the replay button under it. A narrow card names the scorer alone, a tiny one puts
  the score in the pitch's corner. Past what a card can show a move at, the goals are a list, five across: minute, scorer,
  score, Save GIF, replay.

**Copy Image** sits with the buttons, which keep out of the picture until the mouse moves, and so does Command-C (Ctrl-C)
with nothing selected. It draws the page at a fixed 1600 by 1092 whatever the window and takes it 1920 by 1310, without
the buttons (user, 24 November 2026: "make sure the copyable match report matches the displayed thing EXACTLY", then "I
asked for the copied report to be fixed dimensions"): the same page as the screen's, laid out at the design size. The
window's zoom, carried into the copy, had drawn it 2.5% small inside its own frame; the copy now sets --app-zoom to 1
(shot.js `vars`).

### Editor

For the ACU's editors and the overseer (Moukden and Kirin, 10 October 2026, over five rounds of questions; rebuilt as a
sheet on 12 October 2026, over seven more). A fourth section in the top bar, EDITOR, shown only to signed-in editors and
the overseer. Its pages are tabs in the page bar: **Sheet**, **Trades** and **Requests**. The Edit Player and Edit Club
buttons on player and side pages open the sheet at that man's chip or that side's row; the old Teams, Players, Managers
and Leagues pages are gone, and their addresses open the sheet.

**Who may change what.** The overseer changes everything. An editor changes only their own nation's sides, its national
side and its clubs: their names, kits and time wasting freely; their code, ground (with its capacity) and city by request
to the overseer; their formations and the places of their squads; who plays for them and who manages them, by moving men;
and the name, tier and cup of their nation's leagues, outright. An editor may also keep another nation's clubs and leagues
without its national side (editors.json `clubs`; the user, 11 October 2026: "Give the Karjanian access to the Turulian
LEAGUE (not NT)"): those clubs are theirs as their own are, and that nation's players still count as another nation's. An
editor never changes a man's rating, age or traits, and sees them locked; a player's positions change only by request to
the overseer, for one of the editor's own men. A side's style, keeper passing and defensive line follow its manager:
appointing a manager brings them, and only the overseer sets a style directly.

**The Sheet** (Moukden and Kirin, 12 October 2026: "the team, player, and league editor/creator can be merged into one
entity – a Google Sheets clone") is the AFA Registry the records came from, rebuilt in the app's own theme: column
letters over the columns, row numbers down the left, the picked cell's whole value in a bar over the grid, and the tabs
along the foot. Every nation has a tab; in Arterra the national sides share one ARTERRA tab. The editor's own nations come first, then every nation with clubs; nations with only a national side are reached
from All Nations at the end of the tab bar. Every tab can be read by every editor; only their own sides take changes, and
another nation's tab shows its cells locked. A tab's header row wears its nation's colour.

A nation's tab is one table under one header (Moukden and Kirin, 12 October 2026: two tables with their own headers were
the main clutter): its national side first, as a band of its own, then its clubs league by league. Each band is a thin
strip with the league's crest and name and nothing else (the same day: "The descriptions next to the league headers and
the small colored part on the left need to go"); the name opens the league on the dock, where its name, tier and cup are
changed and the overseer sees the places promoted and relegated. A band's clubs stand best first by OVR, sorted when the
tab opens and not again while it is open, so a row never jumps while men are moved. Crest, code and name stay put while
the rest scrolls sideways.

**The columns:** crest, code, name, OVR, XI, Bench, Value, formation, time wasting, manager, home and away kits, city,
ground and capacity, and then the places, last, twenty-two for every side (a club's bench grew from five to eleven on 12
October 2026, its first five places as they were and six more after them, open until filled). OVR is the squad's mean, XI the
eleven's, Bench the bench's and Value its men's transfer values together, all worked out as men move and never typed; a
saved side's record carries its OVR as worked out. Style, keeper passing and defensive line have no columns, since they
follow the manager: his chip carries his style's name in its colour. Formation and time wasting are drop-downs in their
cells, a kit is its hex code on its own colour with a picker, and a city is picked from the map's cities.

**A man is a chip in his place:** his rating in its metal, his given name and SURNAME, and his nation's code after them
when he is not the tab's national. Each place cell starts with the place its side's formation gives it (GK, LB, CB and so
on, and on the bench its group, GK, DEF, MID or FWD), so a row reads as its shape. A man out of position, a substitute
in another group's place too, shows the rating he plays the place at, ringed in the loss colour, with what the place
costs him. A new formation re-slots the eleven by each man's own positions. A
manager is a chip in the manager cell: his rating, his name and his style.

**Editing** takes one click (Moukden and Kirin, 12 October 2026: "everything needs to be editable in one click"): a click
opens any cell the person may change, a drop-down showing its list, a kit its colour picker and a city its search, and the
bar shows all of the cell. The arrows and Tab move, typing on a picked cell starts it, Escape lets go of an edit, and
Ctrl+Z and Ctrl+Y undo and redo anything not yet saved. A fact on the dock opens the same way. **Fullscreen**, in the bar,
lays the grid and the dock over the whole window and asks the browser for the screen; Escape, the button or leaving the
browser's fullscreen brings it back. A column's header sorts
each band by it, and its filter narrows the rows to the values picked. Find searches every tab for a man, a manager or a
side, and opens the tab with the cell lit. No ranges, copying or filling down.

**Moving men** happens inside one's own sheet, by dragging a chip onto a place. Onto a taken place, the two change places
wherever each came from (two clubs, the eleven and the bench); onto an empty one, he moves there. A man dragged from a club
onto the national side is called up and stays at his club; dropped onto a man already there, that man leaves the squad; a
man dragged off the national side is dropped from it. Managers move the same way between one's own sides. A move between
two sheets is a trade, made on Trades, even between two sheets the same editor keeps; and Trades still makes any move,
domestic ones too, with the men's values beside them (the user, the same day: "The trades feature should still work
domestically in tandem with this, so that we can still see values").

**The dock** on the right holds four panels, one at a time: Record, Lineup, Free Agents and Nationals. **Lineup** (Moukden
and Kirin, 12 October 2026: the table for the registry, a pitch for one side's shape) is the picked side's eleven on the club
page's pitch, without traits, with its bench under it and its formation in its head; a man is dragged onto another place
there, or between it and the grid or the Free Agents panel, as in the sheet, and the row changes with it. Clicking a
side's crest brings it forward. Clicking a chip opens his
Record: name, nationality, date of birth, rating, positions, traits, value and his sides. The overseer changes all of it
and can retire him; an editor sees it locked but for his positions, which are asked for. **Free Agents** lists every
player and manager without a club, as Trades and the server count them, so a man who plays only for his national side is
one (the user, 12 October 2026: "national team-only free agents aren't shown for some reason? Make player and manager
free agents separate tabs"), of the universe the copy is (the same day: "why are arterra managers showing in avium new
team????", since settled for good by the two universes above): Players and Managers are its two tabs, best first, each with a search and its New button,
and new men in the cart without a side stand first, faint. Dragging one onto an empty place signs him, onto a man sends
that man to free agency in his stead, and dragging a man onto the panel releases him. Nationals opens while a national side is
picked: the nation's men playing abroad, best first, to drag up. Under a record stand its actions: **Sub Out** for a
starter and **Sub In** for a substitute (the user: "an option to sub players in/out in the sidebar next to retire"), each
opening the side's men he can change places with, a click swapping them; **Trade** on one's own man and **Make An
Offer** on another nation's, each opening Trades with him in a deal; and the overseer's Retire.

**New records** are made in the sheet. Typing a man into an empty place makes him there, a line as src/data/menlines.js
reads it (the user, 13 October 2026): "(OVR) Name SURNAME, Position, Age, Badge 1, Badge 2, Badge 3", only the name needed,
each field after the name told by what it is (a position or two, an age, a trait by its name); with no position he plays
the place's, with no age one is drawn, and a college's man starts in the year his age gives. Pasting several lines into a
run of places makes one in each, and a
row copied from a sheet makes one a cell, as the registry wrote them ("(76) Cihan KARTACA [SEL]", the user, 12 October
2026: "they should go to separate slots"), an empty cell keeping its place and a position-only cell going to the man
before it. **New Player** on Free Agents, and the + in an empty place, open the full form on the dock (the user,
12 October 2026, asked what was missing from making a new player: a New Player button, the full form, opening typed men,
"Ensure that bulk player import works"): name, nationality (the side's, or the tab's, to start), date of birth or an age
(the age draws a date for it, a die another), position and second position by name, the side he joins (from the button),
rating with another nation's limit, the traits that rating affords for editors too, and the portrait line; **Add To
Cart** puts him in the cart and **Cancel** discards the form. A new man already made, in the cart or typed into a new
club, opens in the same form, with **Done** and **Remove**. **Many**, on the form's head, opens the list form full width
(a line a man as above, one nationality unless a line tags his own, an age range for lines without an age, a table to
rate them; a free agent's line needs his position, a man joining a side plays the place he takes): one request, its men shown in the places they will
take or first on Free Agents. A manager is made the same way, from **New Manager** or an empty manager cell, with his
style; made for a side he takes it over when let in. **+ New Club** at the foot of each league band adds a row filled in
place: name, code, kits, city, ground, capacity, formation, manager and its twenty-two places. **New League** at the foot of
the tab adds a band for the league's name, tier and cup (picked from the nation's cups or named new), with its founding
clubs as new rows. A club row's menu opens from its row number (a click, or the right button). **Roll Ratings**, in the
menu of any side with new men (a new club's, or the new men in the cart placed in one of the person's sides; the user, 12
October 2026: "I can then use the OVR randomizer? Also add an age randomizer with an age range"), is a tool and never a
field: given a team rating it rates
every new man left blank or rolled before so the side's men average it, starters about 1.3 over it with a spread of 2.3 and
each bench man below the starter at his position, keeping typed ratings (`src/data/roll.js`). **Roll Ages** beside it
draws a date of birth for an age in a range (18 to 32 to start) for every new man there, keeping a date set by hand on
his form (`bornSet`); every new man starts with a date for an age from 18 to 32 and a rating blank unless given. For an editor each new man,
each new club with all it holds and each new league with its band is one request to the overseer, who may change any of
it before letting it in. A rating may be left blank for the overseer to set; a new man of another nation needs a rating
below that nation's level, its national side's rating as the app shows it (`natLevel`), and no traits come below 75. A
new league lists on its own from its first club, and a nation's first league makes its club sheet. A New form is kept in
the browser until it goes to the cart or is cancelled; one left for something else comes back from New Player or New
Manager, the list on the dock or full width. (Unfinished forms from the old editor came back through Finish buttons over
the sheet for a day; the user had them removed on 12 October 2026 once Giathka's league was in.) One line under the forms
gives the image rules:
badges 500 by 500 with 50px of padding on every side and a 25px white outline, portraits a chest-up headshot in a plain
white shirt, sent as a zip to @auroruse on Discord.

**Requests in the cells.** An editor types into the code, ground, capacity and city cells as into any other, but those
are the overseer's to agree: the cell keeps what it has and shows the asked-for value beside it, marked Requested, until
he answers. A man in a waiting offer or request wears a lock on his chip; a requested man, club or league stands faintly
in the sheet until answered, and the overseer approves it as edited, or rejects it with a note, right there.

**Saving** is the cart's: a changed cell stays marked until the cart is saved, live or as requests. The sheet shows the
records as saved; others' saves arrive when the page is reloaded, with a note when there are new ones, and a save that
clashes with one made since is caught and shown. There is no editing together live.

**The overseer** also drags a club's row into another league's band to move it there (promotion, relegation), and removes
a club from its row menu (**Remove Club**, then **Confirm Remove**): a `removed` mark in the cart, and when it is saved the
club leaves `src/data/teams.json` and its sheet, its men and manager go to free agency, and its seasons stay in the
archive. The server refuses it while an offer or request names the club or holds one of its men, and from an editor. A league's record is
`src/data/leagues.json`: a rename keeps the old name in `formerly`, so the archive's seasons, its badge and the clubs a
saved tournament names still find it.

**Trades** (user, 11 October 2026, over four rounds of questions: "Moving players around teams is shit right now because
it just shows that the other team is full") makes every move of a man, beside the sheet's dragging: a signing, a release,
a move between one's own clubs, and the only way between two sheets, a swap with other nations' clubs, managers as well
as players, between any number of clubs ("What about multi team swaps?"). Down the left are the offers: New Deal at the top, then
Your Move (offers and counters waiting on this person), Waiting (theirs, waiting on others) and Declined (with its note,
until dismissed). The deal fills the rest. The editor's own club stands on the left; on the right a tab for each other club
in the deal and for Free Agents (a search over every free player and manager, best first), with Add for another. Each club shows its manager, its eleven and its bench, with its places counted (16 of
16). Clicking a man puts him in the deal; with one other club he goes to it, and with more, or with Free Agents open, the
click asks where he goes (each club, or free agency).
Clicking him again takes him out. A man coming in takes the place of a man leaving, the one that fits him best, starters
first, but never a keeper's place for an outfielder or the other way round; a starting place left with nobody coming in is
filled from the bench, and anyone still coming in takes an open place. A club that would hold more men than places, or
two managers, asks who makes way: each of its men gets Release beside him, and the man picked either goes in the deal (a
click) or to free agency (Release). Every player shows his transfer value where he stands now (user, the same day). Beside
the clubs the deal reads as each club's comings and goings, with the value it gets and gives, the place each newcomer
takes, and whether it fits.

A deal between one's own clubs, or with free agency, goes live at once (Confirm). A deal with other nations' clubs is an offer, sent at once
(Send Offer), to each of those nations' editors or, where a nation has none, the overseer. Every club accepts the same
version: each answers Accept, Decline (with a note) or Counter, and a counter (the deal changed as they like, from their
side) becomes the new version, which every other club then accepts again, until all have accepted, one declines or its
sender withdraws it. The overseer has both Apply Now and Send Offer, so he can trade as Nichirin's editor like anyone
else. While an offer waits only the men in it are locked, and the last accept checks again that it still fits every
squad. Sending, accepting or applying a deal also saves the cart's changes to the clubs in it. Offers never go through the
cart. National sides are not traded.

**Requests** is the full view of every request but the offers, which live on Trades: For You, Yours and, for the
overseer, the new records waiting. A new record opens in the sheet where it stands, with every field open to the
overseer; Approve lets it in as edited, Reject sends it back with a note. The top bar's Cart and Requests stay as the
quick view, and every change is saved from the cart, as before.

**Requests sent together** (Moukden and Kirin, 21 November 2026, with 143 new men waiting from one editor's save, a card
each: "I genuinely have 143 requests right now"). Requests one person made in one save are one group, and a group of four
or more shows as one block in every list: what it holds ("143 New Players At 15 Clubs"), who sent it and when, and its new
men a row each under their club (position, name, age, Eleven or Bench, rating). In the overseer's New Records the rating
is a box in the row, a man rated over his club's level (below) is marked with the gap (+3), and each row, each club and
the block has a tick; **Accept All** on the block, **Accept** on a club and **Accept Selected** (with **Decline**) over the
list answer in one save, a hundred at a time (`POST /requests`, `settleMany` in `src/data/rules.js`: each answered as its
own Accept would, in order, in one commit; one the rules refuse says why under its row and the rest go on). In Yours the
block has **Withdraw All** and each row its own Withdraw. The top bar's list shows a block as one line with Open. A new
man waiting for review stands faintly in the place he was asked for on the sheet, marked Waiting, so his editor
sees what was sent. The words on screen never name the overseer: a thing waits For Review (the user, 21 November 2026:
"Stop talking about the Overseer and just say its waiting for review"), and no screen carries a line of explanation or
a prompt ("stop it with the AI slop prompts and text"). This is the first step of the Editor's redesign (the sheet is to go; edit where you read).

#### The Editor, redesigned (mocked 21 November 2026; built 24 November 2026)

Moukden and Kirin, 21 November 2026: "We need to rethink and redesign the entire editor ... Must be user-friendly and
overseer-friendly", and, of the sheet, "I don't think in the sheet either actually. Everything needs to be more intuitive
... a completely user-facing feature-rich editor with very connected and navigable interface." Until it is built the
section above stands. Mocks, drawn from the app's own pages and Antiqa's real records: `design/mock/editor2-home.png`,
`editor2-club.png`, `editor2-fill.png`, `editor2-inbox.png`.

**Edit where you read.** The sheet goes, for the overseer too. The Registry's own pages are the editor: a club's, a
player's, a manager's, a league's and a nation's page takes changes in place from whoever may change it, and looks as it
does today to everyone else. On a page one edits, the page bar says Editing; each fact its editor may change carries
Edit, and one that goes for review carries a lock and Request.

**A club's page.** The squad list is where men are added: an open place is a row that takes a name (its position is the
place's; Enter moves to the next open place), or a man from Free Agents or My Clubs. **Fill Open Places** takes a
pasted list of names, one a line, for every open place at once, with ages drawn in a range and ratings Club Level,
Typed or Blank, and shows each man in his place before he is added, marked Live or For Review. Picking a man opens his card beside
the list: where he plays, his rating (locked), positions (Request Change), value, and what can be done with him: Swap,
Move To Bench, Trade, Call Up, Release. **Checks** reads the club in words (Eleven
Complete, Two Goalkeepers, 8 Open Places, No Badge). **Changes** replaces the cart on the page: what was done this
sitting, each with Undo and marked Live or For Review, and Send. A run of clubs with
the same thing to do (Open Places 3 Of 15) has Previous and Next Club.

**The Editor section is a desk**: Home, Sent (the overseer: Inbox), Trades, Activity. **Home** is one's nation: New
Player, New Club, New League and New Deal; To Do, each line a count and a button that starts it (Open Places 143 Fill,
Missing Badges 16 Upload); one's sides as a ledger (OVR, XI, squad, open places, manager, shape, badge), never cards;
Sent, Offers and the day's Activity. New Club and New League are guided, in steps, and the new club then
opens as a page like any other with its Checks saying what is missing.

**What goes live without the overseer** (the user, the same day, to the rule as proposed: "Your 3 others are good"): a
new player rated at or under his club's level, and a ground, a city or a capacity, at once, each listed under Live
with Undo. A code, a new club, a new league and a rating over the club's level stay requests. **A club's level for a
man** is its best starter at his position (the user, the same day: "Club level: best starter at his position"), the
nearest position where nobody in the eleven plays his (`clubLevel` in `src/data/rules.js`). By it 72 of Antiqa's 143 men
of 21 November pass and 71 do not.

**The Inbox** (the overseer's) lists what waits as one row a save, and under it, Live, what went in on its own. An
opened save shows its clubs and its ratings' range, and its men under their clubs, each with his gap to the club's
level (+3) and his rating in a box; beside it a Preview of the picked club: its eleven, its bench with the new
men, and its eleven, bench and squad ratings before and after. Accept All, Accept by club or by tick, Decline, and one
change for the lot (Cap At Level). **Activity** is every save, who and what, with Undo.

**Also proposed:** a Player Finder (every man, filtered, acted on several at once); search that also runs commands; a
card with actions on every name; Season Rollover (promotion and relegation from the filed tables in one step); rating
changes pasted as a list; badge and portrait upload with a preview, as a request; a Discord note when a save arrives or
is answered. **A phone** gets the Inbox and a club's page in one column (the app refuses under 756px today).

**Order:** the requests relief (above, built); the club page and Home, the sheet retiring once they cover it; the Inbox,
Activity and the rules for what goes live (server); the rest.

**Built 24 November 2026** (the user: "Build then."). Edit on one's own side's page (`renderUxClubEdit`) with the squad
list taking names (Enter on to the next open place; a name alone takes the place's position and the side's level),
Free Agents, My Clubs or a national side's Nationals per place, Fill Open Places (a typed rating kept in every mode but
Blank), the man's card (Swap, drag and drop, Move To Bench, Trade, Call Up, Release, positions asked for, the overseer's
rating in place), Checks, Changes with Undo and Send, Kits, Stadium and Manager edited in place, Previous and Next Club
over one's sides with open places. A place a waiting request's new man stands in is not open and shows him faintly. The
desk: Home (nation, To Do, the ledger, Sent or Inbox, Offers, Activity), the overseer's Inbox (saves, the opened save
by club with ratings in boxes and Cap At Level, Preview before and after, Live with Undo), Activity (Everyone or Mine,
Undo), Trades, Draft, and the Sheet last. The server: `liveNewMan` in `src/data/rules.js` puts an editor's new man at or
under his side's level live, a list's passing men live and the rest as a request; a city goes live with the ground; every
live save, answer and undo is logged in `src/data/activity.json` (`src/data/activity.js`: fields from and to and the
records added, so an undo puts the fields back and drops the records while nothing has touched them since), `GET
/activity` and `POST /activity/<id>` on the worker. **Not yet built:** New Club and New League in steps (Home's buttons
open the Sheet's), Missing Badges and badge upload, the Player Finder, command search, Season Rollover, pasted rating
changes, the Discord note, and a phone's one-column Inbox and club page.

#### The Editor, organised (mocked and built 25 November 2026)

Moukden and Kirin, 25 November 2026: "We gotta organize the editor bro. Why are OVRs editable in the team pages for existing
clubs when that should be done via player page? Why can I add new players to a national team when it should be selection,
and selection itself is tedious because I have to cut players to see who's available? And why does the player edit go to the
retired sheet instead of a player editor page on his page?", then "Clubs and leagues should be intuitive and connected and
player addition should offer both detailed and bulk options. Mock first", then, of the mocks, "Make everything integrated
better". Mocks: `design/mock/editor3-*.png`.

**A thing is edited on its own page, and that page edits only what belongs to it.** A man's rating, traits, name,
nationality, date of birth and positions are edited on his player page (Edit Player), never on a side's page: the rating in
the banner, the positions on the pitch (Primary, or Second for the one he also plays), the traits with their levels
(TraitPicker), the rest in a Record panel, Retire for the overseer, and a Changes panel where the career was. An editor asks
for positions there and for a portrait.

**Every side edits on one page, shaped the same** (`renderUxClubEdit`): the Team column (name and code; Tactics, which are
formation, time wasting and the style, locked to the manager for an editor; manager; kits; stadium; the overseer's Remove
Club), the squad, where men come from beside it, and Checks and Changes. A club's open place, the first one unless another is
picked, is filled from Free Agents, My Clubs or one New Player made there (the user: "add back the option to add new player
for Club, though one at a time only. Clubs should also maybe have a free agents option"); Many, over the squad, opens the
list. A man picked shows his card, his rating read only. A national side never makes men: its Nationals are always listed
beside its squad, by line and search, narrowed to the men who fit a picked man's place, each with Swap In, or Call Up for an
open place.

**New things are draft pages filled where they read.** New Player is a blank player page (his portrait the default face
until one is made) with One and Many; Many is a pasted list into one club's open places or to free agency, each line a row
to put right before it goes in. New Club is a blank club page marked Draft (`renderClubDraft`) with Checks and Send For
Review; New League a blank league page (`renderLeagueEdit`) whose clubs are made with New Club, each opening its own draft.
A league on file edits on its own page (Edit on the competition's Overview): name, tier, cup, its clubs with Edit, New Club,
and the overseer's moves in and out. Home starts each, and lists the drafts in its To Do.

**Nothing is uploaded** (the user: "All image uploads need to be DMed to Kirin ... Portraits are generated by request and club
badges must have the standard padding, outline, transparency, and should be sent in zipped batches to Kirin"). A portrait is
a request (`kind: "portrait"` in `src/data/rules.js`, from the cart's `portraits` or a new man's `portrait`; Accept says it is
made and changes nothing). A missing badge, found by asking for its PNG, opens How To Send: 500 by 500 PNG, transparent, 50px
padding every side, 25px white outline, named by code, zipped and DMed to Kirin on Discord, with this person's sides still
without one.

The Sheet stays in the desk for what no page does yet: new managers, conferences, and promotion by dragging rows.

### The ANCC

The All-Nichirin Collegiate Championship (Moukden and Kirin, 12 and 13 October 2026, over four rounds of questions) is
Nichirin's tier 3: thirty-two college sides, one competition (`l0021`), played beside the NL each season. Its record in
`src/data/leagues.json` carries `college: true` and its four `conferences` in bracket order, each a name and its eight
clubs. The names (Capital Eight in the north-west, then the Five Lakes Conference, the Serica Conference and the Blue Water
Conference, for the south-east, south-west and north-east as the map shows them; the user, 14 October 2026: "rename the
conferences outside the capital eight entirely, more creatively") stand until the overseer
renames them on the league's dock, where each conference lists its clubs. A season is the conference round robin, one
match a pairing, then the top two of each into an eight-team playoff crossed so that two sides of one conference can meet
only in the final (Capital 1 against Five Lakes 2 and Serica 1 against Blue Water 2 in one half, Five Lakes 1 against Capital 2
and Blue Water 1 against Serica 2 in the other), with extra time and penalties. Rivalry week and the bowls are gone (the
user, 13 October 2026: "Only conference games and playoffs"). The draft follows the NL season, before the Club World Cup,
the Club World Shield and the next NL season: one round of 44 picks, the whole pyramid worst first (NL2's last first,
NL1's champion last). A pick trades on Trades for the coming draft only, worth the slot its club's table place gives it
now and settled when the tables are final.

**Hidden men.** A player at a college shows no rating, value, traits or rating change to anyone but the overseer, wherever
he stands in the app: squad lists and pitches, his page and banner, Players and its card, search, the Sheet's chips and
dock, Trades and its totals, Play Match, Live Match, tournaments and Rating Changes. Everyone sees his name, positions,
age, college, year and figures, his match ratings included. The overseer sees the ratings ringed in a dashed line
("Hidden from everyone but you"), except on Live Match and Full Time, which are streamed and copied, where nobody does.
A college side's own
ratings (OVR, XI, Bench, the lines and the squad's value) show to all (the user, 12 October 2026: "Shown"). A list sorted
by rating or value puts a hidden man last, as a man with none. The records still carry the ratings, so anyone can play a
college side (the same day: "Hidden In The App"), and the moment a man leaves a college he shows like anyone else.

**Years.** A college player's record carries `grad`, the year his course ends, which is the draft he enters. His year
reads off it against the college season (1934/35 to start, feeding the 1935 draft; the user filed the first season as
1935 beside the NL's and moved everything back a year, 14 October 2026): Final Year when the two meet, then
Third, Second and First. A man made at a college takes it from his age, 21 or more Final Year, 20 Third, 19 Second, 18 or
less First, and the overseer changes it on his Record. On the Sheet his chip carries his year (Y1 to Y4) where another
nation's code would stand. New men at a college are aged 18 to 21, typed or pasted into its places, from Many and in Roll
Ages. The overseer makes all of them on the Sheet (the user, 13 October 2026), and a rating moves only at his refreshes,
as everyone's does ("Your Refresh Only").

**Kits** come from each college's badge: its main colour at home, its next away.

**Grounds.** A college's record carries `university`, its institution's name, beside a `stadium` left empty until the
overseer adds one (the user, 13 October 2026: "Stadiums should be empty right now, then below it have University, City"):
its club page's Stadium shows the picture, or its kit colours without one, the ground's name once it has one, the city
and capacity under it as a club's, then University, its name sliding when too long.

**The season** (stage 2, the user, 13 October 2026: "Tournament itself I can just do 4 groups", then "add a tournament
preset for ANCC"). New Tournament's preset picker lists the college league under Fields by its name. The preset is read
off the league's record when the app loads, so a conference renamed or a club moved between conferences is in it at
once: the 32 clubs, each conference a group in bracket order and named after it (As Drawn), each a single round robin
with the first-listed side at home, sides level on points split by goal difference, goals, head to head and wins, and the
top two of each into the crossed playoff (one leg, no home side, extra time and penalties, no third-place match). Its
stages are called Conferences and Playoff wherever a tournament names its stages (the stage panel, Saved, Proceed To
Playoff), and its fixtures read Capital Eight, Round 3.

**Into the archive.** Its season file has a Conferences tab (the four tables, each under its conference's name with the
two that went through in bold, then each conference's rounds) and a Playoff tab, and it reads halfway through as well as
at the end. Filed as `public/avium/pstats/ancc/35-36.md` with its player stats as `35-36.tsv`, it lands on the
Championship by its clubs, like any league season. The archive reads it as a tournament where that is the right reading
and as a league where a club's season is concerned:
- its season page has Conferences, Playoff and Player Stats; its Roll Of Honour, the year's page and its Records give the
  winner, the final's score and the runner-up, and the furthest each club went;
- a club's History gives its conference as its division, its place and record there, and a Playoff column with how far
  it went (Winner in gold); its Overview's Season panel gives the same, with its form over every match;
- nobody goes up or down from it, and its tables are never read for another league's promotion or relegation.

Every prospect's figures (appearances, starts, minutes, goals, assists, average match rating, chances created, defensive
actions, saves) are on the season's Player Stats and on his own page once the files are in, his match ratings included;
his rating, value and traits stay hidden.

**The draft** (stage 3, the user, 13 October 2026, with a Sleeper draft board as the reference: "Make it like a draft
board ... instead of rounds it'll just be 1 to 44, and no queue, roster, or chat"). One round of 44 picks after the NL
season, before the Club World Cup. Its record is `src/data/drafts.json`: each pick's number and the club holding it, and
once made the man, when, by whom, whether it was automatic and who made way for him. The order is the NL's final tables,
NL2's last first and NL1's champion last; until the overseer starts the draft it reads off the newest tables on file, and
starting it fixes it. Nichirin had already traded twelve picks (the user, the same day), placed at random among NL1's
picks, 25 to 44 (the user, 14 October 2026: "disperse the foreign picks across the LATTER half, the NL1 clubs. The NL2
clubs lowkey need the picks"), and kept there whatever the tables do: two to Daryā Shushabad, one to Tarāzu Dashtvār, two
to Homā Nourabad, one to Mehrāvar AC and one each to Murmánska Partisani, Åulot FK, RöPS, XIV. District JK, VKS and
Szatmár SK. The NL1 clubs whose places land on those picks have none. A pick traded later the overseer gives to its new club on the board ("You Move
Them"); nothing on Trades.

**Picking.** Asynchronous, two hours a pick. Every club picks by hand, in the Editor's Draft tab, which only the overseer
and editors holding a pick see: Karjania's and Varahmehr's editors for theirs, the overseer for Nichirin's (the user, 14
October 2026, after starting the draft picked NL2's 24 at once by the earlier rule: "Undo, You Pick NL By Hand"). A club
whose two hours run out gets the best season match rating left ("Auto-Pick"), in the season's Player Stats order (men with
a sixth of the most minutes first), the clock checked every five minutes. A
drafted man goes to an open place in his new club's squad; with none open, the editor names who makes way as he picks
("Editor Chooses"), the weakest bench man at the drafted man's position offered first (else the lowest-rated man on the
bench), and an automatic pick sends that man. He goes to free agency. The overseer can pause the clock, give a pick still
to come to another club, and pick for the club on the clock.

**When it ends** every final-year man not drafted leaves his college for free agency, where any club signs him through the
usual save, first come first served. A drafted or released man shows his rating like anyone else's. The draft is then filed
under the Championship ("Editor Tab, Then Archive"): its Draft tab shows the board and every pick, and a drafted man's page
says which pick took him and where. The draft keeps its own record; its moves are not in the Trades log. Then the colleges move on a year (`COLLEGE_SEASON`) and the next draft's record waits in `drafts.json`, every pick still the tables' to give: the 1935 draft ended 14 October 2026, its 131 undrafted final-year men free agents, and the 1936 draft waits (the user: "the draft will be back for next year").

**The board** (Editor, Draft). The draft's name, its state and the clock over the 44 picks, eleven to a row, each cell its
number and the club holding it by its code, the full name on hover (the user, 13 October 2026: "Show team codes"); a pick
made shows the man on his position's colour, his first name small over his surname ("Show small first name above last
name"), his position, his college's code and his rating, which shows the moment he is picked, everywhere ("the OVR should
be revealed after drafting"). The pick on the clock is lit with the time it has left. Under it the draftable men: every
final-year man at a college, ranked as the automatic pick takes them, with his nationality ("show nationality in the
draftable table") and his season's figures once the season is filed (games, starts, minutes, goals, assists, average
rating, chances created, defensive actions, saves), searchable and by position, Show Drafted keeping the men taken in the
list. Whoever holds the pick on the clock has a Draft button on each row, which asks to confirm, with Who
Makes Way when the squad is full. The overseer has Start Draft, Pause and Resume above the board and, on a pick still to
come, Give To.

### Documentation

Written for Avium's editors and readers (Moukden and Kirin, 10 October 2026). Arterra is named once, as another roleplay
the engine also serves, and the ACU never; the overseer is named once and is Kirin after it; nothing that states the
obvious (24 November 2026). It covers every screen and how the engine plays a
match, in plain terms with few numbers. It opens from the settings menu. Its pages
are tabs in the page bar, from first use to how the engine works (Moukden and Kirin, 23 November 2026: "reorganized, more
intuitively, from beginner to in-depth mechanics"): Basics, Browsing, Matches, Tournaments, Editing, then Players,
Tactics, The Engine. Each page lists its
sections in a Contents panel on the left, lit as they are read, and reads in one panel beside it: the prose held to about
820px, the tables the panel's width. A page and a section are part of the address, and a section keeps its id when it
moves, so an address copied before the reorganisation still opens it (`DOC_MOVED` for the renamed pages). The text is
`src/docs.js`; what can be read off the engine is drawn live (`docLive`), so it cannot drift from what the engine plays.

A visual is a drawing of the thing, never prose cut into labelled boxes ("visuals instead of text walls", then, of a
draft that had turned paragraphs into bold-label lists, "What It Shows" tables, captioned boxes and numbered steps with
titles: "classic AI slop labeling, descriptions, and bolded headings"). Explanation is short plain paragraphs under a
plain noun heading. A list of terms is used only where each term is a name the app itself uses (a button, a setting, a
panel), and a table only where the rows have real columns. Drawn from the engine: the screen with its bars numbered,
the positions on a pitch, every formation with and without the ball, the points a rating gives for traits, the match
rating's scale, value by rating and by age, what each style pays at kick-off as bars, the minute each of a manager's
moves can first happen, and the distances in front of goal that decide a header, a free kick and a wall.

---

## 2. Look

### Colour

The app's own colours, kept (Moukden and Kirin, 9 October 2026): the Standard theme in `src/theme.css`. They are tokens
in `design/ui.css`; nothing in a screen names a hex.

| Token | Hex | Use |
|---|---|---|
| `--bg` | #0a0e17 | the window behind the panels |
| `--bar` | #060b14 | the top bar |
| `--pagebar` | #0d1117 | the page bar |
| `--panel` | #141c2b | panel bodies |
| `--panel-2` | #182134 | every second table row, hover |
| `--panel-3` | #1e2a3d | selected rows, inputs, chips |
| `--line` | #2a3a50 | hairlines, panel borders |
| `--line-2` | #3a4d66 | outlines on raised parts |
| `--text` | #ffffff | primary text |
| `--text-2` | #b3bfcf | secondary text |
| `--text-3` | #7889a0 | labels, column heads, metadata |
| `--accent` | #e4002b | Play match, the current section and tab, the rule under a panel title |
| `--accent-ink` | #ff5c73 | the accent as text: your team, key figures |
| `--win`, `--draw`, `--loss` | #8fbf8f, #ebcb8b, #e08a8a | results, each on its own dark ground (#26402a, #3a3520, #43282a) |
| `--up`, `--down` | #a3be8c, #bf616a | rises and falls, relegation |
| `--gold` | #ebcb8b | champions |
| `--cont` | #4a7ab5 | continental places |
| `--playoff` | #4a7ab5 | a league's playoff places |

Ratings keep the app's own two scales: the metal tiers for a rating badge (copper, silver, gold, emerald, amethyst,
iridescent) and the match-rating colours for a performance.

Measured contrast on `--panel`: text 17.1:1, text-2 9.2:1, text-3 4.8:1, accent-ink 5.7:1. `--accent` and `--down` are
never small text: white on `--accent` measures 4.9:1, and a fall is written in `--loss`.

### Type

Three faces, each with one job.

| Role | Face | Size | Notes |
|---|---|---|---|
| Panel title | Barlow Condensed 700, upper | 14px | tracking 0.04em |
| Page title (page bar) | Barlow Condensed 700, upper | 20px | |
| Hero figure | Barlow Condensed 700 | 28px | a position, a rating on a card; Your Nation's name, upper |
| Body, list primary | Neue Montreal 500 | 13px | |
| Table cell, list secondary | Neue Montreal 400 | 12px | |
| Label, column head, chip | Neue Montreal 500 | 11px | `--text-3` |

Every label is in Title Case, every word capitalised, the way FM writes them: panel titles, tabs, buttons, column heads,
field names, placeholders ("Search Nations", "Most Goal Contributions", "Time Wasting"). Names keep their own spelling.

Every digit in running text and tables comes from JetBrains Mono, so columns of figures line up. Nothing else: seven
sizes is the whole scale, and a size off it is a bug.

### Space and layout

- 4px base. Steps: 4, 8, 12, 16, 24, 32.
- **The window is the canvas.** Top bar 48px, page bar 36px, and the body fills the rest. No fixed design box, no zoom:
  a bigger window shows more, never the same thing larger.
- The body is a grid of panels with a 12px gutter and 12px gaps. The page never scrolls; a panel scrolls inside itself.
- Columns are sized by what they hold. A list column is 300 to 340px, a side rail 260 to 300px, tables and pictures share
  the rest. Under 1280px wide the side rail moves under the other columns and the page scrolls.
- A name too long for its cell fades out at the cell's edge; nothing ends in an ellipsis.
  On a club's page the squad's names, the names on the pitch and the ground slide to their end and back instead
  (SlideName), so they can be read whole, and so do the Managers list's names and the club and ground on the map's card
  (Moukden and Kirin, 10 October 2026: "The names should be going back and forth").
- Table rows are 24px, list rows with a crest 32px, two-line items 44px. Crests are 16px in a table row, 20px in a list
  row, 48px on a card.

### Shape

- Panels: radius 8px, a 1px `--line` border, no shadow.
- Chips and badges: radius 4px. Buttons: radius 6px.
- Only floating menus and hover cards carry a shadow.
- Lists never show the browser's own markers.

### Icons

Inline SVG, 1.5px stroke, round caps and joins, 16px in bars, 14px in rows. No emoji, no icon font. No typed triangles
either (the user, 11 October 2026): a rise or fall in a line of text is a drawn arrow (`UxArrow`) in the text's own
colour, as tall as its capitals with a stroke near its weight, and a sort order or a closed list a drawn caret.

### Motion

Hover and selection fade in 120ms. Nothing on a data screen animates on load. `prefers-reduced-motion` stops the rest;
the match renderer is exempt, because the moving dots are the content.

Five pieces move beyond that, picked from React Bits and ported by hand (Moukden and Kirin, 24 October 2026, after a
mockup, `design/mock/motion.html`):
- **The score rolls.** On the Live Match scorebug each digit rolls to its new figure like an odometer, up for a goal and
  down when a replay starts over; nothing rolls when the scorebug first draws.
- **The goal sheen.** One streak of light crosses the scoring side's panel toward the score, and the score rolls as it
  arrives.
- **Hold to confirm.** Abandon, Drop Fixture, a tournament's Reset, Delete on Saved and Empty Cart are held for 1.2
  seconds, the loss colour rising through the button, rather than clicked twice. Each says Hold in its label.
- **Warm tooltips.** Anything named on hover (the narrow Fixtures' icons, a side given by its code) opens its name after
  half a second, and the next at once while one has just been open. One tooltip for the whole app.
- **The badge sheen.** An Iridescent rating badge (90 and up) catches one band of light as the pointer reaches its row.
  The other tiers stay still (the user, 24 October 2026, after trying every tier).
Full Time stays still, because Copy Image takes it.

---

## 3. Components

**Top bar.** 48px, `--bar` with a `--line` hairline under it. Left: the Avium wordmark at 26px tall, then back and
forward. Then the sections in Neue Montreal 600 13px upper, each with its menu; the current one gets a 2px `--accent`
bar.
Right: search (260px), the settings menu, Requests (editors, with a count of those waiting on them), the Cart (editors, and
anyone with unsaved changes, with a count), the account, and Play Match in `--accent`.

**Page bar.** 36px, `--pagebar`. Left: the section's name, or the crest and name of the page's subject. Then the page
tabs in 13px; the current one is white with a 2px `--accent` bar, the rest `--text-2`. Right: shortcuts as small outlined
buttons.

**Panel.** `--panel`, radius 8, 1px `--line`. A 36px title row: the title, with a 2px `--accent` rule under the title's
own width, and on the right at most a working control such as a season picker. Never a caption. Tables run edge to edge
inside; text sits 12px in.

**Table.** Column heads 11px `--text-3` on `--panel`, then 24px rows, every second one `--panel-2`. Figures right-aligned,
except an age and a count of seasons, centred between their neighbours. A crest and name share one cell. Your team's row is `--accent-ink` and bold. A 3px bar at a row's left edge marks
champions (`--gold`), continental places (`--cont`) and relegation (`--loss`), with a key under the table. Column widths
are set in pixels, never left to the browser: every column has one, and a table wider than their sum shares the room
out across them all, so no one column (a name) swallows it.

**List row.** Rank, crest, name, one fact, and the rating badge at the right edge, 32px tall.

**Rating badge.** The app's metal badge, 30 by 18px, figure centred. A performance rating is a plain figure in the
match-rating colour.

**Form.** Results as 18px squares lettered W, D and L, each in its result colour on its own dark ground, newest on the
right.

**Result.** The score in figures and a dot before it: filled `--win` for a win, hollow `--loss` for a loss, hollow
`--text-3` for a draw.

**Leader.** A 30px portrait with the club's crest on its corner, the category in 11px, the name in 13px, and the figure
on the right. A record's figure sits on its category's line with the season under it, both against the right edge, so a
panel's seasons line up (Moukden and Kirin, 9 October 2026: a season after the name, floating against the figure, was
"awkward").

**Pitch.** Green grass in mown bands with white markings, attacking upward. Each man is drawn the way the team page has
always drawn him: his whole portrait in a 44px circle ringed in his position's colour, the metal rating chip on the
circle's left, the position chip on its right, given name over SURNAME above. A man with no portrait gets the app's
placeholder.
The pitch fills its panel and never leaves the panel's ground showing: it takes the panel's proportions within a real
pitch's (64 to 75 metres wide, 100 to 110 long), and on a club's page its column takes the window's spare width first,
up to the widest pitch the window's height allows and the bench's strip beside it. The strip takes whatever width the pitch
leaves, never less than its own (Moukden and Kirin, 13 October 2026, picking the bench over the margins a short window left
either side of a pitch that could not fill its panel).

**Results.** Every match of the season in every competition the club entered, newest first: the competition's short
form (the archive folder, NL1, KPL, CWC, WC), the round or stage (R38, G3, QF, F), the opponent's crest and code, H or
A, and the result. A shoot-out adds a P after the score (its own score on hover), and extra time without one adds AET; every
score in the app is written this way, however its file spelt it.

**Nation.** The national side as a banner: "National Team" and its conference over its name and rating, its ground,
then a dark strip of its AFA ranking (with the move since the year before), manager, style and last five results,
beside honours chips the strip's height. A side with no ground photo wears a sash of its second colour; the kit's second
colour edges every banner. Below it, each division is a band of club tiles, as wide as its clubs need: last season's
champion on gold, the clubs that came up or went down on faint green or red beside their arrows. A division that has not
started its next season shows instead who its finished table sends up and down, arrowed where they stand (the league's
`up` and `down` places and any playoff its report records); nobody moves until the next season.

**Player banner.** The width of the page, in his club's colours (his national side's when he has no club). Behind
everything his surname, huge and faint in the kit's second colour, every letter whole, filling the banner edge to edge:
its capitals the full height, its first letter's ink on the left edge and its last letter's on the right, spaced out
between (a name too long for the width has its letters narrowed, never made smaller); a soft light behind his head;
no coloured edge under it (Moukden and Kirin, 9 October 2026, over the
plain kit sash: "generic and flat"). Left to right: his portrait cut out and standing below the banner's foot, so the
sides where the picture was cut never show (a solid drawn silhouette when there is no portrait), his national side's crest
and his club's, each opening its page, then a dark strip of four facts in hero figures, spread wide across the rest of
the banner: OVR as the metal badge, his positions in their colours, his age with his date of birth, and his transfer
value (src/data/value.js, worked out as it is shown).

**Positions.** A pitch in the panel's proportions with the fourteen positions as faint rings and the ones he plays as
dots in the position's colour, lettered, with the crest of each side that plays him there under the dot. Under the
pitch, a row for each side whose sheet he is on, his country first: its crest, the role its style, shape and his slot
deal him (the engine's FM-style roles: Shadow Striker, Mezzala) with its short form, and the style in its colour;
Substitute, dimmed, where it benches him, since a substitute has no role until he comes on. No suitability stars: the
engine never rates a man for a role.

**Player card.** The Players page's right column, 340px: his banner in small (club colours, portrait, given name over
SURNAME, his nation's and club's crests; the portrait in the banner's proportions, its bottom quarter below the foot, so
no picture's cut sides show), the four banner facts in a strip, his roles as on Positions, his line for the
season (the Season view's year, else his newest) and his career's, and View Player.

**Teams** (the user, 11 October 2026). Every club, or every national side by a switch in the title, as Players and Managers
are listed: #, Club (National Team), Nation and League (Conference), OVR, ATT, MID, DEF, BENCH, City, Style, Formation and
Value, filterable and sortable. ATT, MID, DEF and BENCH are the listed eleven's by line at the ratings they play their places at and the
bench's, read by uxLinesOf exactly as Play Match's Strength Comparison. Its card: the crest on the side's kit colours
fading into its ground's photo, the whole banner opening the side (no View button), OVR, Style, Formation and Value (the
squad's, each man's own) and its manager (opening his page); then Strength (bars), Best Players (top four by rating) and
Honours. No season standing, form, ground, city or capacity, and no AFA ranking (the user, 11 October 2026).

**Manager card.** The Managers page's right column, built as the player card: his banner in small (his club's colours,
else his national side's or his nation's, portrait, given name over SURNAME, the crests of his nation and his sides),
his banner's facts but his age in a strip (style, OVR, the two win rates), and View Manager; then his sides, a row each
(crest, name over its competition), his career a row for his clubs and one for his national sides (seasons, played, won,
drawn, lost) and his honours as on his History.

**Filter row.** Under a panel's title row, 44px: the search field, each filter as a select (a filter of sides as a side
picker), and the count of rows on show at the right. A select stops at 180px and the search gives way to 140px, so
Players' six filters fit at 1440px wide.

**Sortable heads.** Click a column head to sort by it: figures run high to low first, names A to Z. The head in use is
white with a caret, which hangs beside the label so the label stays over its column.

**Tactics.** The Pitch with the role in place of the position chip: each man's portrait ringed in his position's
colour, the rating chip on the left, the role's short form on the right (SS, MEZ), his name above.

**Performance.** His whole career on record, a polygon on five axes for an outfielder (goals, assists, chances created
and defensive actions per game, and average rating) and four for a keeper (saves and goals conceded per game, the
share of clean sheets, and average rating; conceded and clean sheets are his sides', in the seasons he played). His
shape is filled in his position's colour over the dashed average career at his position, of everyone with a sixth of
the fullest career on record; the rim on each axis is the best of them (Moukden and Kirin, 9 October 2026). Each axis
carries its name and his figure, and a key names the two shapes.

**Bracket.** A knockout as columns, a round each, every tie a box of two lines (crest, name, score; the winner in bold,
a two-legged tie's aggregate with its legs in small), the ties of each round centred between the two they came from.

**Map.** The Avium Map's own tiles in a square panel. Nations are dots in their home colour until the map is zoomed in far
enough for crests. A club's crest is sized by its rating: from 80 up on a steep scale (an 80 side at 0.84 of the reference,
an 83 at 1.06), below 80 falling gently, half the size every twenty points, to its smallest at about 62, so the strong
clubs read first and the small ones stay in sight (Moukden and Kirin, 10 October 2026, over five rounds: "Club crests
should scale more strongly", "now the largest clubs are too big", "80+ OVR teams should be roughly as large as how big
70+ OVR teams are right now", "Now smaller clubs are way too small. Keep large clubs as they are"). A city's count is a
small dark pill on its crest's corner, shown once the crest can carry it ("too large and intrusive" with a ring). A city with several clubs is one marker, its strongest club's crest with the count on its corner; its
panel of clubs opens only while the pointer is on the marker, on the panel, or on the unseen way between the two, so the
pointer can cross to it and pick a club, and the panel's crests are all one size (Moukden and Kirin, 10 October 2026). From where
crests appear to the deepest zoom, crests that would cover one another are eased apart, a little more at each step in and
the bigger crest moving less, so at the deepest zoom every club can be picked (Moukden and Kirin, 10 October 2026:
Scramrock Rovers could not be clicked).

**Search.** 32px, `--panel-3`, a magnifier on the left, results in a floating menu grouped by kind.

**Side picker.** Every choice of a side (Head To Head's two sides, Players' Club filter, a season's Side filter): a
field 200px wide whatever it holds, 24px in a title row and 30px in a filter row, with the side's crest and name and a
caret. It opens a floating menu under the field (its right edge under the field's when the window is too narrow) with a
search field on top and the sides under their headings (divisions, or a national side's conference), a filter's own
choices first and untitled (All Clubs, Free Agents, Hall Of Fame), the headings held at the top of the list as it
scrolls and the choice it holds ticked in the middle of it. Typing keeps the sides with a word of their name or heading,
or a code, starting with what is typed; the arrows move, Enter picks, Escape closes. A second picker beside it never
offers the first one's side (Moukden and Kirin, 9 October 2026: team selection is "built-in with a search function,
not the default ones").

**Buttons.** Primary: `--accent`, white 13px 600. Secondary: 1px `--line-2` outline, `--text`. Both 32px tall, or 28px
in a bar.

**Cart and Requests.** Drop-down panels under their buttons in the top bar (Moukden and Kirin, 10 October 2026), 640px wide
and as tall as what they hold up to the window, the page left in view; Escape or a click outside closes one, and only one
is open at a time, with the menus. A change reads as a block a player, manager or side: the portrait or crest and name on
its head with, at the right, what saving does (Live, or Request when it waits on another nation's answer) and Remove; under
it a line a field, the field's name and the old value to the new. A transfer is one block holding both sides. The Cart's
title row holds Empty Cart (two steps) and its foot the save's message and Save (Sign In To Save when signed out).
Requests lists For You, then Yours: a block a request, with the side, who asked and when, each man it signs and the side he
comes from, its changes, and Accept and Decline (two steps), or Withdraw on your own.

**Simulating.** While a round or a stage is played out at once the window is held under a cover in `--bg`: SIMULATING in
the page title's face with the accent rule, a progress bar in `--accent`, and under it the matches done of the total and
the threads at work.

**Narrow window.** Under the narrowest window the app draws (a landscape window `MIN_WINDOW_W` wide, 756px) the frame
gives way to the wordmark, WRONG WINDOW SHAPE in the page title's face with the accent rule, and one line saying what to
do.

---

## 4. Accessibility

- Text at least 4.5:1 on its real background (measured above).
- Every control has a pointer cursor, a hover state and a 2px `--accent-ink` focus ring; tab order follows the screen.
- Colour is never the only signal: form squares carry a letter, table bars have a key, your team is bold as well as
  coloured.
- Crests and portraits carry alt text; decoration is hidden from screen readers.

## 5. Not this

No grids of identical cards. No gradient wash per item. No captions beside a panel title, and no descriptions that
explain a panel. No heading
over every group. No emoji. No fixed canvas or zoom. No font size off the scale, and no hex in a screen. No drop shadows
on panels, no hover lift. No panel without a question to answer.

## 6. Build

- `src/ui.css` holds the app's tokens and parts. Every class is prefixed `ux-` and nothing in it touches a bare element,
  so the screens not yet rebuilt render as before. Its colours are named from the theme (`src/theme.css`), so a theme
  still dresses the whole app. `design/ui.css` is the mockups' copy.
- The frame and the rebuilt screens are App.tsx's `renderUx*` functions: the top bar, the page bar, Registry, a nation, a
  club's or national side's Overview and History, a player's, Players, Managers, a manager's Overview and History, Rating Changes, Competitions (its Overview, Years, Head To Head, and a
  competition's Overview, Season and Records), Tournaments (Saved, New Tournament, a tournament's four pages and the
  stages between), Play Match, the live match and Full Time, the Cart and Requests, the Editor, the Documentation and the
  Simulating cover. `src/docs.js` holds the Documentation's text.
- Who may change what, and what a saved cart becomes (outright changes, trades, new records, changes by request, the men a
  waiting request locks), is `src/data/rules.js`, which the registry server (`server/worker.js`) enforces and the app
  previews; `test/rules.mjs` checks it on the real records. A change to the rules goes live when the server is redeployed.
  The leagues are `src/data/leagues.json` (`src/data/leagues.js` reads it), which the server writes beside the other
  records and `node test/records.mjs check` holds to the clubs; Roll Ratings is `src/data/roll.js`. Positions are
  `src/data/positions.js` (the drop table between its markers is written by `node test/posdrop.mjs write`), the bench's
  groups `src/data/squads.js` arrangeBench, and `node test/records.mjs check` holds every player to one or two. A screen not yet rebuilt sits under the two bars in
  the old canvas, at its old size.
- `test/tourn.mjs`, `test/import.mjs` and `test/export.mjs` cut the tournament's functions out of App.tsx by name, so
  rebuilding Tournaments keeps those names.
- `design/mock/build.mjs` writes the mockups in `design/mock/` from the real records and season archive. Every new
  screen is mocked there and approved before it is built.

## Every trait measured again (23 November 2026)
User: "re-measure the traits. The bare minimum is that all positive traits add OVR and all negative traits subtract OVR." Then, of an 85-minute run: "I dont have 85 minutes. Be more efficient. Do you even need so many samples". Three short cloud runs instead, 16,800 matches and about 20 minutes each (45069957270 all 51 traits; 45072401985 the 15 it could not call, strengthened; 45074579913 the last six). Specs test/specs/traits4.mjs to traits6.mjs.
- Both sides of a match draw their own placements, so a match reads each placement twice; squads are stripped of their dealt traits first. Traits at level three, flaws at two, on the positions they are dealt to.
- The yardstick is five rating points on one line at a time (keeper, defence, midfield, attack); a rating point on one man came out at 0.011 to 0.018 goals a match.
- Read by chances (xG both ways) for most; by goals for and xG against for the finishing ones; by xG for and goals against for the keeper's, Blocker and Desperate; Clutch by penalty goals conceded alone. The two one-sided readings need each side's own placements as regressors: off the difference of the two sides they both collapse to the mean of net goals and net xG (caught on Blocker).
- Dead Ball: a side with the specialist scored no free kicks at all (0.02 to 0.03 fewer a match in all three runs), aim capped and keeper delayed notwithstanding. A free kick here goes in by its scatter, so a truer strike is a saved one. The trait now leaves the free kick at goal alone; its penalties are worth 0.012 goals a match. The free kick model itself is the open fault.

Rating points on the man who carries it (level three; flaws level two):

| Family | Trait | Worth | +/- | Verdict |
|---|---|---|---|---|
| Mind | Alert | +2.3 | 0.3 | clear |
| Mind | Composed | +1.8 | 0.1 | clear |
| Mind | Vision | +1.1 | 0.3 | clear |
| Mind | Vocal | +1.1 | 0.4 | clear |
| Mind | Slick | +0.7 | 0.2 | clear |
| Mind | Patient | +0.5 | 0.2 | clear |
| Ball | Deceptive | +3.1 | 0.4 | clear |
| Ball | Short Passing | +2.4 | 0.2 | clear |
| Ball | Long Ball | +2.3 | 0.2 | clear |
| Ball | Unflappable | +2.0 | 0.3 | clear |
| Ball | First Touch | +1.9 | 0.2 | clear |
| Ball | Incisive | +1.5 | 0.4 | clear |
| Ball | Driving | +1.2 | 0.3 | clear |
| Ball | Trickster | +1.1 | 0.3 | clear |
| Ball | Elusive | +1.0 | 0.2 | clear |
| Ball | Fluent | +0.9 | 0.3 | clear |
| Ball | Crosser | +0.4 | 0.2 | right side, not clear |
| Ball | Dead Ball | +0.8 | 0.2 | ok (read by penalty goals; free kick at goal untouched now) |
| Body | Quick Step | +3.4 | 0.3 | clear |
| Body | Strong | +2.3 | 0.6 | clear |
| Body | Aerial | +1.7 | 0.3 | clear |
| Body | Rapid | +1.6 | 0.2 | clear |
| Body | Relentless | +1.2 | 0.1 | clear |
| Body | Sturdy | +0.9 | 0.2 | clear |
| Finishing | Finisher | +5.6 | 0.6 | clear |
| Finishing | Predatory | +3.7 | 0.6 | clear |
| Finishing | Long Shot | +2.3 | 0.2 | clear |
| Finishing | Unselfish | +1.8 | 0.3 | clear |
| Defending | Interceptor | +4.9 | 0.5 | clear |
| Defending | Disciplined | +3.1 | 0.2 | clear |
| Defending | Tight | +2.8 | 0.3 | clear |
| Defending | Desperate | +2.6 | 0.4 | clear |
| Defending | Tenacious | +2.0 | 0.2 | clear |
| Defending | Tackler | +2.0 | 0.2 | clear |
| Defending | Blocker | +1.5 | 0.4 | clear |
| Keeper | Shot Stopper | +4.4 | 0.8 | clear |
| Keeper | Assured | +2.3 | 0.8 | clear |
| Keeper | Clutch | +1.8 | 0.2 | clear |
| Keeper | Firm | +1.7 | 0.8 | clear |
| Keeper | Commanding | +1.1 | 0.5 | clear |
| Keeper | Quick | +0.8 | 0.6 | right side, not clear |
| FLAW Mind | Unaware | -3.3 | 0.2 | clear |
| FLAW Mind | Hesitant | -0.4 | 0.1 | clear |
| FLAW Ball | Wasteful | -1.8 | 0.1 | clear |
| FLAW Ball | Clumsy | -1.3 | 0.1 | clear |
| FLAW Body | Unfit | -1.3 | 0.1 | clear |
| FLAW Finishing | Greedy | -1.3 | 0.4 | clear |
| FLAW Defending | Dozy | -3.5 | 0.3 | clear |
| FLAW Defending | Reckless | -1.1 | 0.2 | clear |
| FLAW Keeper | Erratic | -4.1 | 1.0 | clear |
| FLAW Keeper | Nervous | -1.9 | 0.8 | clear |

## The free kick at goal, rebuilt (23 November 2026)

User: "Fix the free kick model. I've noticed that they don't actually wait for people to be in position before striking, and a lot of them just go into the wall. Real free kicks have curve when struck at the goal."

Traced first (scratch fk.mjs: free kicks staged in shooting range out of live play, League One squads without traits). Of 40 before the change: 27 struck before the wall was built, 35 with a defender inside ten yards, struck 6 seconds after the whistle on average; 19 into the wall, 14 saved, 1 scored. The old kick was a straight ball aimed at the far side, where the keeper stands, clipped to clear heads by 0.35 m when a man in the wall heads a ball up to 2.6 m.

- **The wait** (setpiece.ts meSPReady). A free kick with a wall is held until nobody is inside ten yards, the wall is on its marks, the keeper is set and two of the taker's men are up; 25 seconds at most (spFkWallMaxT). Other free kicks are as they were. A run-up now gets its fourteen slices from when it starts, which also mends a penalty forced late being struck with the taker three metres off the ball.
- **Spin** (ball.ts stepOnce). A ball can carry side-spin (its heading swings at bsp radians a second) and top-spin (pulled down at bdip times its pace). Gone at the first bounce, body or kick. The forecast carries it, so everyone reads the real path. A ball without spin flies bit for bit as before.
- **The strike** (ball.ts meFkStrike). He picks a corner, the wall's side six times in ten, and the launch that takes this pace and spin there is found by flying it on the ball's own integrator. It must pass every man in the way at the height he can jump to; the hardest strike that does is played, with more dip before less pace. Then his error on heading, lift and spin.
- **The keeper** (keeper.ts planFor) reads 80% to 98% of the swing at the strike, by his rating.
- **Dead Ball** is back on the free kick: three quarters of it onto his skill there, capped at 1.15.

Staged, 300 kicks a setting, after: wall on its marks at 297 of 300 strikes, struck 12 seconds after the whistle on average. Scored 9%, wall 26%, saved 27%, off target 21%, blocked further on 10%. With Dead Ball at level three on the takers: scored 15%. Not measured over matches: goals a match should rise by roughly a tenth of a goal, and Dead Ball's worth is unmeasured.

## Corners headed, and swing on every ball into the area (23 November 2026)

User: "Crosses and corners should have spin, but maybe more spin should be gated behind traits. Also players barely head off of crosses or corners. Crosses I get if it's a low cross but corners..."

Traced first (scratch ck.mjs: corners staged out of live play, 300 to 500 a setting). Before: the ball hung for 2.4 seconds and went seven metres up; 46% of corners came down to the grass with nobody having gone up; the man it was for stood 2.4 m from where it landed; a defender had the first touch on 78%; one corner in 300 was headed at goal.

Causes: only an open-play cross was met in the air by the meeting law (pass.ts meMeetAir), a corner's attackers chased it on the old reach model; the target's run lasted six slices against a ten-slice flight; it was flighted to 1.85 m, a standing forehead, where any neighbour who jumps higher has it first; a free kick crossed in was a floated pass landing at its man's feet.

- **Delivery**: whipped (loftK.corner 0.7 + 0.03 d: a second and two thirds to the spot, five metres up), to 0.2 m under the top of its man's jump. A free kick into the area is struck the same way. The runs last as long as the flight.
- **Meeting**: a corner, a long throw or a free kick into the area is met in the air by the attacking side on the cross's law.
- **Swing** (ball.ts meKickBall o.spin): 0.05 rad/s for anybody, plus 0.45 for each unit of Dead Ball on a dead ball and 0.15 for each of Crosser on a cross, so at level three either trait swings it about four times as far. The strike is turned half the swing off its line so the ball comes round onto its man.
- **The duel**: a dead ball into a set defence gives the defender +0.55 (airSetDef); swing takes 0.6 of its rad/s off him (airSpin).

Staged after, 500 corners: headed at goal 25% (5% scored), defence heads or clears first 54%, 1% untouched. Dead Ball at level three on everyone: headed at goal 27%, attackers win 31% of the duels against 24%. Per corner that is more goals than a real corner (about 3%), in a match that has a fifth of a real match's corners. Not measured over matches; open-play crosses were not staged at all, only given swing.

## Before release: measured over matches, and what it changed (23 November 2026)

User: "Sure, go", then "Keep going until everything looks good... I expect season-wide stats to be normal when I wake up tomorrow."

Spec test/specs/rel1.mjs (League One as the sheet has it, and the twelve strongest national sides, three sets of dice each), test/reltests.mjs (tournament, pool and card tests on the cloud), test/ratings.mjs split dumps, test/season.mjs (whole seasons).

- **First run (45080909054, 17,280 matches)**: League One 3.03 goals a match against 2.84 before the free kick and corner were rebuilt. Headed goals 0.45 (0.33 before: normal now). Free kick goals 0.19, one kick in ten, where real football has about 0.07: too many.
- **Why**: two in three free kicks arriving above 1.8 m went in, from the middle of the goal as often as a corner, because the keeper stood two metres out and they dipped over him. He stands on his line for a free kick at goal now (CFG.spFkGkOut); what scores is the top corner. Accuracy re-sized on 600 staged kicks (5% scored, Dead Ball at level three 11%), and fewer are shot at all (spShootRange 27 to 25, spShootAng 12 to 14).
- **Second and third runs (45084192944, 45085974311)**: League One 2.85 and 2.88 goals a match, national sides 2.67. Of League One's goals: headed 0.45 (15%), penalties 0.27 (9%), free kicks 0.10 (3.5%), from outside the area 0.46 (16%). Draws 23%. Yellows 2.84, reds 0.17 a match.
- **Ratings** (dump run 45084196754): keepers had drifted (8.8% of full matches at 6.0 or under against 6.8%). rateFin and gkExp re-derived; all pars and the keeper balance hold on the same records.
- **Tests on the cloud** (45085978679): tournament and cards pass. Pool passes all but its check for the built worker chunk, which the cloud does not build.
- **Substitutions** (user: "make subbed/injured players walk to their technical area smoothly, vice versa for their replacement"): the man replaced jogs to his side's technical area and an injured man is walked there; a man sent off goes down the tunnel at halfway; the replacement comes on from the technical area (CFG.subEnterX 10.5), two together side by side. Watched headless in a live match.

## Whole seasons, and the finishing traits cut (23 November 2026, overnight)

test/season.mjs plays League One seasons on the cloud (380 matches, four runners a season, five seasons a run), in the lab's way, the app's own way ("app": src/sim/core.ts simPositionalMatch with the home side's advantage, injuries on and the managers), on the engine without traits ("strip"), or as the app is published ("pub": the last commit's engine and records, built in a temporary copy). Read by scratch seasonsum.mjs. No lay-offs or bans between matches in any of them: every man is back for the next one.

| | Published app | New, first | New, after the cut |
|---|---|---|---|
| Goals a match | 2.58 to 2.84 | 2.85 to 2.94 | 2.72 to 2.93 |
| Top scorer | 33 to 41 | 39 to 56 | 34 to 45 |
| Third best scorer | 29 to 33 | 29 to 33 | 28 to 32 |
| Most assists | 15 to 21 | 21 to 32 | 21 to 27 |
| Best average rating | 8.23 to 8.41 | 7.89 to 8.10 | 7.95 to 8.19 |
| Champions' points | 66 to 76 | 80 to 87 | 81 to 90 |
| Bottom side's points | 30 to 35 | 18 to 26 | 19 to 32 |
| Draws | 26 to 31% | 20 to 26% | 22 to 25% |

("New, first" was played the lab's way, the other two the app's way.)

- **Finisher was far too strong.** Per player against the same seasons with traits stripped: Finisher at level three took Hawthorne from 26 goals a season to 44, at level two it was worth six to eight to a striker, Long Shot three with Dead Ball took Szabo from 16 to 30. Finisher, Long Shot and Predatory cut to about a third (config.ts). Measured after (run 45089366727): Finisher +3.5 rating points on the man, Predatory +3.6, Long Shot +0.4, all still clear.
- **A side's top scorer takes 35 to 40% of its goals and ten or so men reach twenty** in every version, the published one included: forwards score 55 to 60% of all goals in this engine. Not changed.
- **The table is more spread** than the published app's (champions 81 to 90 points against 66 to 76), nearer a real league's.
- **A direct free kick goal no longer credits an assist**: the walk back through the touches went past the taker's own strike to whoever had passed to the man fouled.
- Home sides win 40% and away sides 37% in both versions; 0.7 injuries a match in both.

**Final round (runs 45094136652, 45094142452, 45094149079, 45094155667).** League One 2.80 goals a match, national sides 2.54; headed 0.43, penalties 0.28, free kicks 0.10; draws 24.5%. Ratings: all pars and the keeper balance hold on a fresh dump. Tournament and card tests pass; the pool test passes all but its check for the built worker chunk, which the cloud does not build. Five more app-way seasons: top scorer 34 to 45, most assists 20 to 27.

## Long Shot curls it (23 November 2026)

The user: "make long shot give holders the ability to curve shots outside of the box. Also make them more likely to
attempt long shots." From outside the box a holder's strike carries spin (config.ts `longshot.curl`, 0.5 rad/s at level
two): it starts toward the keeper and bends away into the corner he picked, and the keeper reads only part of the bend
(`gkCurlRead`). Measured on the cloud (run 45138190966, the same fixtures with the curl on and off): shots from outside
the box scored 6.4% against 3.3%, went wide 19% against 35%.

A flat urge to shoot (range 8, farW 0.08) gave the curl's goals straight back: two 5-minute trait runs read it at -0.5
and +0.0 rating points. So the holder shoots more because the curled shot is worth more to him: `curlP` raises the
chance he puts on a shot from outside the box (mind/decide.ts), 0.6 at level two, and range and farW are back at 6 and
0.03. Run 45140373150: Long Shot +3.4 ±0.6 rating points at level three, net goals +0.22 a match on its placement. The
readout reads xG for some traits, and xG does not see curl, so read Long Shot by net goals.

One League One season the app's way after it (run 45141304200): 2.88 goals a match, top scorer 45 (Hawthorne), third
best 30, champions 95, bottom 18. All inside or at the edge of the ranges the five seasons before it gave.

## Managers: every line on the table, and the man to mark (23 November 2026)

**Where the goals are** (run 45146812880, one League One season the app's way, the goals in order of the clock; read by scratch goalstate.mjs and conc.mjs). Hawthorne's 46: ten penalties, eleven scored when his side was already two or more up (nine of them after the hour), 98% of the minutes, 46% of his side's goals. Across the league a side's first scorer takes 37% of its goals, strikers score half of all goals and the two wingers together about 5%; nine of the twenty clubs play one striker.

**Every line on the table** (the user: "in a WC match, Cahaya rested all of its players after already being eliminated from the group stage, which shouldn't happen"). A group match was measured against one line, the top qualifying place, and a side that could no longer reach it was a dead rubber: it changed every man it had a reserve for and coasted. That caught far more than Cahaya: every league side out of the title race, every side fighting the drop, and in the 1936 qualifiers (whose "advance" zone is the playoff places, from eighth) every side that could not finish first. computeGroupStakes (App.tsx) now measures a side against every line between two zones and takes the most urgent one still open; inside the places that go through, first against second is seeding, worth a proper side and never a must-win; a place among the best placed is never settled inside its own group; a side already qualified has nothing on any match. A settled side is one of two things. Through, with a knockout to come: "rest", up to eight changes, the most tired first, the keeper among them. Out, or a league place fixed: "free", the first-choice side, and in its last match simply the best eleven it has that day. No match is a must-win with more than two still to play after it. Over two legs, three or four down is a tie to be won (it was a dead rubber); only five down is given up; three up lets him change a few. A Swiss draws its rounds one at a time, so its matches left are counted off the format (groupRemAfter): every Swiss match used to read as the side's last. Checked by scratch stakes.mjs over a World Cup group, a league of twenty, the qualifiers, every knockout case and a Swiss; test/tourn.mjs and test/pool.mjs pass.

**The man to mark** (the user: "opposing teams need to be aware of who the star/threatening players on the other team are every match, and attempt to shut them down"). src/engine/manager.ts meThreatPlan: before kick-off each manager names the opponent's most dangerous man (rating where he plays, the scoring traits, goals a match in the competition so far, which the tournament passes in as p.tg and p.tm, and his goals today) and, when he stands clear of the back line set against him, gives him a marker, the best defender who plays where he does. A poorer manager names the wrong man more often; everybody looks again at half time, a manager of 65 or better as soon as his side concedes, and at once if the man or the marker goes off. On the pitch (mind/team.ts, THE THREAT): the marker is his and nobody else's inside a leash, goal-side and tight, follows his runs, takes him in the box, goes to the ball only when clearly the man to go, and stays goal-side of him while his own side has the ball; one midfielder with nobody to mark stands in the lane into him; he is closed by two ten metres sooner. The marker's spot is left empty: nothing scales a chance. Off at set pieces, and off wherever a match has no managers (the lab, golden: identical across all 24).

Measured on whole seasons, same dice (runs 45149033171, 45150667531; the no-plan season is 45146812880's): goals a match 2.98 with no plan, 2.68 as shipped, 2.79 with the marker alone; men on thirty goals 4, 1, 3; on twenty-five 8, 5, 7; a side's first scorer 37%, 35%, 38% of its goals. Traced over nineteen matches, the marked striker took the ball 17.8 times a match against 21.9 and the nearest defender to him in the last third stood 3.1 m off against 3.7. **It does not bring the top scorer into line**: Hawthorne 46 with no plan, 41 as shipped, 44 with the marker alone, one season each (about six either way). His open-play goals in the box did not fall (9 against 10 in the trace); what fell was his team-mates' (3 against 11), who score through him. What is left of the top scorer is not marking's to fix: Finisher at level three (33 with every trait stripped), penalties (nine of the 41), a starter never rested or taken off with the match won, and one striker taking half his side's goals.

test/season.mjs: every goal in order of the clock (G); "appnt", the app's way with no man marked; SEASON_MT, the second brain's tuning a season ("key=value+key=value", commas between seasons). src/sim/core.ts calls globalThis.__simTick each tick when a harness sets it.

**No set penalty taker** (the user, the same day: "Maybe Hawthorne just shouldnt be taking every penalty?", then "Do a mix of the person who won the penalty or a random player in the team good at finishing, no set penalty taker"). The best striker of a ball took every penalty his side won, so they were all one man's: Hawthorne ten of 46, Galanis twelve of 27. In a match the man who won it now takes it half the time (CFG.penWonTakes), when he is still on and is not the keeper; otherwise, and for a handball, any one of the side's three best at it (CFG.penPool; Dead Ball counts toward being one of them), drawn off the restart's own seed (setpiece.ts meSPBegin; match.ts meFoulCommit names the man fouled). A shootout keeps its order. Golden: with the old rule replayed through the new code (penWonTakes 0, penPool 1) all 24 were identical; under the new rule fixtures 0, 1, 5, 14 and 22 moved, all five among the eight with a penalty (0, 1, 5, 8, 10, 14, 18, 22), and it was re-recorded.

One season with both in (run 45153157295, same dice): 2.61 goals a match, Hawthorne 33 (four penalties), then 26 and 24; a side's first scorer 32% of its goals; six men on twenty goals, two on twenty-five, one on thirty; champions 82 points, bottom 25; most assists 19.


## Managers: the rest of the rework (23 November 2026)

The user, after the release check: "Build the rest except managers who differ." Five behaviours from the brainstorm, all only in a match that has managers (`s.managers`), so the lab and the 24 reference matches are untouched (golden identical, nothing re-recorded). Each can be switched off for a measurement through `globalThis.__mgrOff` (`won`, `poor`, `respect`, `memo`, `sp`); test/season.mjs takes them a season at a time as `SEASON_OFF`.

**A match that is over** (match.ts meCoachSubs, config.ts `subWon`, `subLost`, `subWonStar`). Three up from the hour or two up from the 75th minute, on the aggregate in a second leg, the gap to the reserve stops counting: a man comes off for his legs or for standing above the eleven's mean, the best first. The same three down from the 70th minute, unless the tie has to be settled that night. The dugout log reads "Match won: legs saved" or "Match gone: legs saved" with his name.

**A poor game, and a booked man still fouling** (the same function; `subPoorBar`, `subPoorPts`, `subRiskFrom`, `subRiskPts`). From the hour a man whose match rating is under 6.3 is priced as the player he has been that day, eight rating points off him for each point under the bar; on the hour one outfield man in sixteen is under 6.3 (24 matches traced). A booked man who has fouled again since the card (match.ts meFoulCommit keeps `_fl` and `_flYc`) is worth four points to take off from the 46th minute, the one change besides gone legs made before the hour. Both scale with the manager's rating.

**Respect** (manager.ts `ME_RESPECT`, meRespect). Away from home or on neutral ground, a manager whose eleven stands four rating points or more below theirs (a point more if they are at home) drops his line and his press, a full step each at twelve points. Behind, the chase lifts it; a must-win side never starts with it. Measured (run 45177480046, League One's bottom seven against its top five, every fixture six times, 420 matches an arm on the same dice): applied at both grounds the weaker side took 0.545 points a match against 0.564 without (each +-0.05) and conceded 2.23 against 2.10. By ground: away 0.60 against 0.45, at home 0.49 against 0.68 (+-0.07 each). So it is the away side's plan only. On neutral ground it is unmeasured. A lean toward the cautious neighbouring style was built with it and changed no match of the 420, so it was taken out.

**The last meeting** (App.tsx lastMeeting, carried on the match's stakes as `last` and `lastSc`; core.ts flipUrg turns it round for a second leg). A manager who has met this opponent in the same tournament reads its style right, counts four points of respect for each goal beyond two he lost by, and has the men who scored against him watched (`ME_THREAT.vsW`, four points a goal; he no longer misnames such a man). An open two-leg tie is not a meeting: the first leg is already read as a deficit. The season harness plays every match alone, so this is traced on single matches and unmeasured in bulk.

**Corners** (mind/team.ts spCorner, setpiece.ts, `spBestHead`). Defending, the markers take their men by rank in the air, best on best; traced on twelve matches the best marker stood on the best header at 96% of corners against 36% before. Attacking, the delivery is one and a half times likelier to be aimed at the side's best header among the men it can reach.

One League One season with all of it but respect (run 45176557365, season two; same dice as run 45153157295): 2.71 goals a match against 2.61, 3.67 changes a side against 3.43, Hawthorne 28 in 75 minutes a match against 33 in 90, nobody on thirty goals, two on twenty-five, six on twenty, the top four on 80, 79, 78 and 75 points, yellows 2.73 a match, reds 65.

**The last four** (the user, the same evening: "Put the rest in. If Hawthorne falls further we can adjust pens to 75% takers / 25% winner"). Switches `favour`, `chase`, `weak` in `__mgrOff`.

- **The favourite's answer** (manager.ts `ME_RESPECT.favWidth`). The manager across from a side set up with respect expects the deep block and plays a step wider at their full plan. Run 45207043332 (the top five at home to the bottom seven, every fixture twelve times, 420 matches an arm): the weaker side took 0.407 points a match against it and 0.479 without (each +-0.045), conceding 2.31 against 2.23. In the favourite's favour, inside the noise. The same run puts sitting deep away at 0.48 points a match on 420 matches, against 0.45 without it on the earlier 210: about level, and the +0.15 read from 210 matches was mostly noise.
- **Chasing it with a forward** (manager.ts meShapeChase, match.ts meCoachSubs, `subChaseMin`). One or two behind from the 75th minute, once a match and likelier the better the manager: the best forward on the bench who fits comes on for the least of the men in the line the more attacking neighbouring shape drops, and the side moves to that shape with him furthest forward. 52 times in a season of 380 matches. The docs no longer say a manager never changes formation to chase. Its worth is unmeasured: it fires too rarely to read in one season.
- **The weak link** (manager.ts meWeakPlan, `ME_WEAK`; called from match.ts meChase). A defender four points below the rest of his back line, counting a stand-in out of position, a booking (three points) and legs under 70, has the play aimed at his part of the final third by legs added to the side's own pass pattern (`s.plan.zones`). Read at the first minute, at the break and when the plan is replaced. 244 times a season, a third of all sides. Unmeasured in isolation.
- **Eased back** (App.tsx managerSelect, `BACK_FIT`; `injAt` and `injLen` written where a match's injuries are filed). A man in his first match back from two matches or more out starts on 75 stamina at most, until he has played a minute since. Resting men before a harder fixture was already in managerSelect (its look at the next opponent and the run of fixtures).

One League One season with everything in (run 45206950897, same dice): 2.78 goals a match, 3.69 changes a side, yellows 2.80 a match, reds 63, Hawthorne 32 (three penalties) in 75 minutes a match, then 26, 24, 21; one man on thirty goals, two on twenty-five, six on twenty; champions 91, bottom 23. The same season with the winner of a penalty taking a quarter of them (`penWonTakes` 0.25): Hawthorne 31, three penalties again. He did not fall, and the split made no difference to him, so `penWonTakes` stays at 0.5.

test/season.mjs: `SEASON_ONLY` ("A+B_vs_C+D", only the fixtures between the two lists), `SEASON_HOME` (the first list at home only), `SEASON_REP` (each fixture that many times), `SEASON_CFG` (the engine's settings a season, as SEASON_MT), and every line carries the dugout log (`L`).

## The referee, the touchlines and injuries (24 November 2026)

The user's brief: "a rework to injuries, which are rudimentary right now at best, as well as a referee in-match with improved reworked dynamic decisions based on home advantage, his field position, etc., linemen (cosmetic), coaches in the technical area walking around (cosmetic; shouting effects when he gives instructions)". Five steps, in this order. Only a step marked built is built.

**The user's answers.** Referees are anonymous: a temperament rolled for each match, never a named roster. Wrong calls are in, at low rates. Advantage is in, and "it should expire after a bit". The injury total stays where it is, spread across the new causes once it is measured. On the referee: "make sure his AI is realistic, doesn't glitch with the players, avoids players and the ball". On the physios: "ensure the physios' animations are also realistic".

**Step 1: the figures on the pitch. Built.**
- **The referee** (`src/engine/referee.ts`, `ME_REF`; stepped at the head of `meTick`). A man the engine moves, kept in `mePos.ref` and never in `s.players`, so nothing passes to him, marks him or finds him in a search. He works a diagonal: above the ball in the left half of the screen and below it in the right, all match, six metres behind the move, out of the penalty areas except at a penalty, with a place of his own at every dead ball. He reads a pass at the man it is going to, walks when he already has his view, picks a spot with nobody standing on it, gives a berth to each man and to the ball, and steps off the line of a man or a ball coming at him. He takes no dice and writes to nothing but himself: all 24 golden fixtures are identical with him running.
- **Measured** (`test/refprobe.mjs`, six matches): 17 metres from the ball at the median in open play, top speed 7.3 metres a second, no slice over 8, never inside a penalty area. He is within 0.8 metres of a player in 0.17% of slices, about eight times a match, nearly all of them a single slice as a man runs past. On screen, sampled every drawn frame for forty seconds at double speed, no figure moved more than 0.57 metres between two frames.
- **The assistants and the coaches** (`src/engine/touchline.ts`, `ME_TL`; kept on the app's match object as `m.tl`, stepped after the tick while a match is watched). Drawn only: nothing in the engine reads them. As the screen shows it, the assistant on the near touchline has the left half and the one on the far touchline the right, the whole match (the second half is only drawn mirrored, so in the engine's coordinates the crew's diagonal turns over at the break, on `mp.h2`; the far assistant used to run the top left in the first half, under the scorebug), each level with the second-last defender or the ball, 0.6 metres off that line at the median. A flag goes up for offside, along the line for a throw, down at a corner, in at a goal kick, and he walks the goal line to the edge of the area for a penalty. A coach stands back when the match is going his way and comes to the edge and follows play when it is not. Each new line in the manager log (`out.mgrLog`) brings him to the front with three arcs and the order over the pitch (`ME_TL_TAG`: Change Of Style, New Orders, Orders Lifted, Team Talk, Man Marking, Game Plan, Substitution, Change Of Shape, Reshuffle); a card against his side gets the arcs with no words.
- **Drawn** on the live pitch and in the full-pitch replay (the tape's frames carry all five as `of`), and the referee and assistants in the saved GIF. They walk off and back at every break with the players. The referee and the assistants are striped dots (the user: "Refs/linemen should have striped referee dots"), in `--ui-official` on `--ui-official-edge`; a coach is a dark dot ringed in his side's colour. The technical areas are 0.4 metres deeper so a coach can stand clear of the assistant running past.

**Step 2: the referee's decisions. Built and measured.** (`referee.ts` `meRefJudge`, `meRefView`, `ME_CALL`; every foul of the second brain goes through it from `meDuelHooks.commit` in match.ts, and so does the handball.)
- **Two questions.** The challenge decides whether there was a foul (mind/duel.ts, as before, without the crowd). The referee decides whether it is given. His view of the spot is full inside 17 metres and falls to 0.42 by 44, less 0.13 for each body standing in his line of sight and 0.08 when he is at a run. How plain the offence was rises with the pace the man came in at. The doubt is what both leave: (1 - view) x (1 - plain), counted 1.6 times in the penalty area.
- **Three outcomes.** A real foul is missed on half the doubt (feed: Waved Away; half the time the man who did it comes out with the ball). A fair tackle is whistled on 0.18 of how poorly he saw it, 0.15 as often in the area (feed: Soft Foul; a free kick and at most a booking). Otherwise it is given.
- **The crowd** works on the doubt alone (`homePull` 0.7, times how much this referee listens): more of the host's fouls missed and more of the visitor's fair tackles whistled, and the reverse less. On the discretionary cards it leans by how far from plain the offence was. The flat fifteen per cent on every foul roll (`ME_HOME_ADV.refRoll`) is retired.
- **Temperament and patience.** Strictness (0.84 to 1.18), readiness with a card (0.78 to 1.22) and how much he hears the crowd (0.55 to 1.45) come off the match's drawing seed. In the first twelve minutes a booking is 0.8 as likely; a man's third foul and each after is a quarter likelier to be booked, to 1.6. A foul that puts its man off the field is 1.35 times as likely to be booked, one that needs the physio 1.15.
- **He goes to it.** For six slices after he blows he runs to within three metres of the spot, then takes his place for the restart.
- **The switch.** `globalThis.__refOff` plays the whole old game on the same bundle: the old referee, no advantage, the old injuries, the old home dial. With it on, all 24 golden fixtures were identical to the baseline as it stood before this rework; the baseline was then re-made for the new game (every fixture moves, because the foul roll takes different dice) and repeats.
- **Measured against the old game** (`test/refab.mjs`, cloud run 45305381212: every ordered League One pair, the listed home side as host, 3,040 matches an arm on the same seeds). Old, then new: goals a match 2.776 and 2.782; fouls 20.65 and 20.61; yellows 2.859 and 2.859; reds 0.162 and 0.169; penalties 0.378 and 0.363; host goal difference +0.116 and +0.113 (se 0.032), results 40.3/24.3/35.5 and 40.3/23.7/36.0. The new game also has 0.78 fouls a match not given, 0.27 soft ones given, and 3.3 advantages of which 0.9 are brought back. The host commits as many fouls as the visitor now (10.3 and 10.4, against 9.2 and 11.4): the old referee took a flat share off every roll.
- **Home advantage kept whole** (config `ME_HOME_ADV.duel` 0.06 to 0.072): the referee's share is smaller now that the crowd moves only his doubtful calls, and at 0.064 the host goal difference read +0.077; the home side's edge in a duel makes it up.

**Step 3: advantage. Built and measured.** (match.ts `meAdvOn`, `meAdvStart`, `meAdvStep`; config `advT`, `advFrom`, `advRide`, `advPace`, `advStrong`; switch `__advOff`.) A foul given outside the area, on a man 35 metres or more up the pitch from his own goal line, is played on when he rides it: 0.16 of the time, less for a challenge at pace, more for a strong man. It counts as a foul; the card is decided at once and kept in his pocket, and a red for denying a goal becomes a booking once play has run. The window is 16 slices, four seconds. The other side getting the ball under control inside it brings play back for the free kick. After it, or at any dead ball, the advantage is over and the card comes out at that stoppage. Feed: Advantage. The man who fouled does not go for the same player again while it runs: left beaten beside a break, he was the first man the foul on purpose looks for, and sendings-off rose by half until he was stopped (0.235 a match against 0.153, cloud run 45299932594).

**Step 4: injuries in the match. Built and measured.** (`src/engine/injury.ts`, `ME_HURT`; the figures in `touchline.ts` `meTlCare`.)
- **Four levels.** A knock he runs off with play going on. Fine: treated and back. Hurt: treated, back, and carrying it for the rest of the match (slower, first on the manager's list, and at a sprint it can go again, which ends his match). Off: he cannot continue, with a diagnosis. A head injury is always off.
- **The stoppage.** Anything past a knock stops play: a foul's own free kick, or in open play a dropped ball to the side that had it (in a penalty area, to that area's goalkeeper). The whole timetable is worked out once by the engine as `mp.treats`: the physio runs on from his technical area at 1.75 metres a slice (never longer than 36 slices), kneels 10, 14 or 16 slices by level, and they leave by the nearest way off the field at a walk, or on a stretcher with two bearers for the rows of the table marked `carry`. The restart waits until he is off the field (`sp.minT`), or for a goalkeeper, who is treated where he lies, until he is up.
- **A man short.** A player treated is out of play, not replaced, and waved back on from where he left 8 slices later if he is fine and 44 if he is hurt. A man who cannot continue is replaced at that dead ball as before.
- **Drawn** from the timetable only, so a match nobody watches takes exactly as long: the man lying flat in his side's colour, the physio a pale dot with a cross, the bearers either end of him; a man coming back waits at the touchline with the physio; a man who is finished is taken round the outside of the pitch to his bench.
- **The card.** The foul is judged knowing what it did (above).
- **Feed and tags.** Every injury line names what he has: the injury itself for a man who goes off, and for one who carries on, is treated or plays on hurt a lesser one by what did it (`ME_KNOCK`: an ankle knock, a dead leg, hamstring tightness), picked off the moment and the man so naming it spends no dice. The ratings list tags a man Treatment, Hurt or Knock.
- **Full time.** An Injuries list over The Goals, a row a man: the minute, the man, the injury, and the games it costs him (`injLen`, settled by the engine when he goes off, so the tournament records the same number), ROS for a long injury, Doubtful for a man who played on hurt. A match played live and imported had been dropping the diagnosis on the way into the tournament (a random one to five games, and no long injury filed); it carries it now.
- **Player page.** A long injury on file is a warning row over Season Stats: the injury, and Out Until the competition he is back for.

**Step 5: causes, risk and what follows. Built and measured.**
- **Causes** (`ME_HURT`): a foul (per foul given a free kick, more at pace); a fair tackle won at pace; two men up for the same ball; and a pull, per slice a man is sprinting, 3 times as likely on empty legs, 7% likelier for each year past 29, 1.6 times in a first match back and 1.4 times for a man who came into the match doubtful. The diagnosis is drawn from the rows that cause can produce (config.ts `ME_INJURY` `how`: c a challenge, a the air, p a pull), so a trip is a knee or an ankle and a pull is a hamstring.
- **The total is where it was.** Cloud, 3,040 League One matches an arm (run 45305381212): 0.71 men hurt a match against the old game's 0.72, and 0.126 lost against 0.121. By cause: fouls 0.35, tackles 0.10, the air 0.095, pulls 0.16. Treated off the field 0.29 a match; playing on hurt 0.13.
- **Doubtful** (App.tsx `managerSelect`, `DOUBT_FIT`, `hurtAt`): a man who played on hurt starts his side's next match on 88 stamina at most and goes into it likelier to pull something, until he has played a minute since. The competition's Unavailable list names him Doubtful.
- **Age** reaches the engine on each squad entry (`attachRecords`), from the record's date of birth.

**Long injuries. Built.** (`src/data/longout.js`; the user: "really bad injuries causing players to miss the entire year or a set number of tournaments".)
- **Where they live.** In the season's Player Stats sheet, as a block beside the leaderboards headed `# INJURED POS TEAM INJURY AT ID`: the man, his side, the injury by its id in the table, how far through his side's matches it came (0 to 1) and his record's id. The leaderboard reader never takes it for a board (it looks for PLAYER). The app reads every filed season's sheet at start, so filing the season is all it takes; a row can be typed in or deleted by hand. A friendly never makes one.
- **The year** runs World Cup, then League And Cup (everything else), then Club World Cup and Shield, then Nations League, then World Cup Qualifiers (the user: "these should have different weights"), counted as 2, 6, 2, 1 and 1 of its 12 units (`LONG_SLOTS`). A filed season is placed by its folder and year; the qualifiers close the year before the World Cup they are named for, and a league written across two years belongs to the year it starts in. A competition being played is placed by the year and the words in its name ("1936 World Cup", "League One 35-36"), or this year if it has none.
- **How long** (config.ts `ME_INJURY` `long`, `out`): cartilage 2 to 4 units, ankle ligaments 1 to 3, a broken ankle 3 to 5, a broken foot 2 to 3, a collarbone 2 to 3, from the moment it happened, the man's own place in the range settled by his name. A cruciate, an Achilles or a broken leg: the rest of the year, and from its second half the next World Cup as well.
- **Who is left out** (App.tsx `longIdx`, `tLongOut`, into `tUnavail`): with Long Injuries on in setup (it is by default, beside Injuries, Suspensions and Tiredness), every man in a competition's squads with a long injury on file misses the share of it his lay-off still covers: counted in his side's matches where the format says how many there are, the whole of it otherwise when more than a quarter is covered. The Unavailable list names him Long Injury with what it is; his page shows a warning row over Season Stats with the injury and the competition he is back for, for as long as the archive has not got past it.
