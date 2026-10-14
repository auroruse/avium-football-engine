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
pages. Search sits beside it, then the settings menu (the theme, the Arterra switch and the Documentation), Requests and the Cart for
editors, and the account menu. **Tournaments** is the third section, after Competitions (below).

**The Arterra switch** (Moukden and Kirin, 10 October 2026) is each viewer's own, kept in the browser and on unless
turned off. Off, the world is Avium alone: the four world switches go (Registry's title and its Nations panel, the side
picker, the tournament's Sides), and search, addresses and the Editor drop Arterra's sides, players and managers. A match
or tournament already holding an Arterra side plays on.

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
the loss colour on every pitch, for the eleven only: the eleven's rating counts it, a side's own rating and the AFA
Rankings do not. Out of position means the place costs him (`posDrop` above 0, the user, 11 October 2026): a free move,
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
coaches sub people in out of position so much?"). Sim All allows the same five changes as Live Match for a bench
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
season, the place and the points (an AFA Rankings bar: the year and the place).

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
is Avium's, so Arterra has none.

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
its name, which opens its side picker (the Side picker below: every league a group, the Avium/Arterra switch, a rating on
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

Kept as they were: the players are dots with surnames (asked: As Now); the goal replay waits until it is closed and can
be played again; after the whistle the buttons are New and Replay, or Import, Replay and Abandon for a tournament's
fixture.

### Full Time

The page a result is screenshotted from, carrying every fact of the match (Moukden and Kirin, 10 October 2026: "full time
should be optimized for screenshots to show all match info"). It fills the window at one scale, drawn on a 1600 by 1092
design. Top down:

**The banner** puts the result over the ground's photo, like Play Match's, the whole of it: every ground is a 5:1
panorama, so the banner is a fifth of the page's width tall (user, 11 October 2026: "show the full stadium image
uncropped"), and the page grew from 900 to 1092 for it rather than squeeze the squads; with no photo the kit colours run out from
each half under a shade that keeps white text readable on a light kit. Over the score, the competition and round
(1935 World Cup · Group A, Round 1; Friendly; Friendly · Second Leg); under it FULL TIME, AET, the shootout or the
aggregate, then the ground, its city and its nation. Each side has its crest, its name, its code with its eleven's OVR and
its shape, and its manager with his style.

The board fills the photo (user, 12 October 2026: the photo "had too much space that wasn't being used"; the photo itself
stays whole, "that's the scene"). Crests, names and managers are half again their old size and the score nearly twice.
Over a tournament's fixture the competition's own mark (the theme's art) is drawn large, the competition and round under
it; a friendly has the word alone ("Remove the theme banner from friendlies"). The score is set in the names' face
(Barlow Condensed), its figures' tops level with the names' capitals and their feet on the code line's baseline, and FULL
TIME sits level with the manager lines (user, 12 October 2026). So every name keeps one line: one too long for its half is
narrowed to fit, never shrunk, cut or wrapped, and so is a manager line. The shootout, extra time and the aggregate
share one line under that, over the ground. Not picked: the scorers in the banner, the timeline over the pitch, headline numbers, kits, the half-time score and date, team
ratings.

Then the timeline (cards, injuries and missed or saved penalties, never substitutions); the team sheets either side, with
the minute beside every man who came on or went off; between them the momentum chart, possession, the seventeen numbers
and the Played Live count under Reds for a tournament's fixture; and every goal along the bottom, playing on hover. The
middle column fills from the foot (user, 12 October 2026: "Move the possession bar down and add the momentum graph on top
of it with when the goals came. Make sure the bottom of the stats lines up with the bottom of the lineups regardless of
bench size"): the numbers' last line is level with the longer sheet's last man and possession sits over them. The chart
keeps one height (90 design pixels) whatever the window ("they need to stay the same height regardless": a wide window's
taller photo had squeezed it flat), its bars on a square root, each goal a dot at its side's edge with its minute; the
numbers' rows give instead (18 to 30 pixels), and anything they cannot take lies over the possession bar. The top player is a star
by his name in his sheet, no longer a card of his own.

**Copy Image** sits with the buttons, which keep out of the picture until the mouse moves. It copies the page to the
clipboard as a 1920 by 1310 picture whatever the window's shape, without the buttons, ready to paste into Discord, and so
does Command-C (Ctrl-C) with nothing selected. The momentum chart, not picked on 10 October, was asked for on 12 October.

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
along the foot. Every nation has a tab, and Arterra's national sides share one ARTERRA tab, last, while the Arterra switch
is on. The editor's own nations come first, then every nation with clubs; nations with only a national side are reached
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
free agents separate tabs"), of the tab's world (Arterra's for the Arterra tab, Avium's otherwise; the same day: "why are
arterra managers showing in avium new team????", which also took Arterra's men out of Trades and the new-club and
new-league reviews): Players and Managers are its two tabs, best first, each with a search and its New button,
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
says which pick took him and where. The draft keeps its own record; its moves are not in the Trades log.

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

Written for the ACU's editors and readers (Moukden and Kirin, 10 October 2026): every screen and how the engine plays a
match, in plain terms with few numbers. It opens from the settings menu. Its pages
are tabs in the page bar (The App, Matches, Styles And Managers, Ratings, Tournaments, Editing). Each page lists its
sections in a Contents panel on the left, lit as they are read, and reads in one panel beside it: the prose held to about
820px, the tables the panel's width. A page and a section are part of the address. The text is `src/docs.js`; what can
be read off the engine (the playstyles) is read live, so it cannot drift from what the engine plays.

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
