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
Home until Moukden and Kirin renamed it (9 October 2026). Players, Managers and Rating Changes are pages of Registry (its
page bar: Overview, Players, Managers, Rating Changes; Moukden and
Kirin, 9 October 2026). Custom Sides, the sides made in this browser, are gone (Moukden and Kirin, 10 October 2026).
Registry stays lit on them, on a player's or a manager's page, and on a nation's and its clubs'
pages. Search sits beside it, then the settings menu (the theme and the Documentation), Requests and the Cart for
editors, and the account menu. **Tournaments** is the third section, after Competitions (below).

### Pages (the page bar)

Each section's pages are tabs in the page bar under the top bar. A page about one thing (a club, a nation, a player)
starts the page bar with its crest and name. Every page has its own address.

A club has two pages: **Overview** (squad, pitch, club, honours, finishes, results) and **History**, a row a season,
newest first, with its division, finish, record, cup run and Club World Cup or Shield run, titles in gold, and its
manager (both, where a year had two), and its honours beside it by competition with the years each was won. A national side has the same two pages: its squad of
22 fills the first column with each man's club and the year's international figures, AFA Rankings (its place in the
ranking by rating, a bar a year from src/data/afa.js) stands where a club's league finishes are, and History has a column each for
the World Cup, its qualifying and the Nations League, then its manager (the old confederation championships have no
column, and count only toward who managed it).

**Who managed whom** is src/data/spells.js (Moukden and Kirin, 9 October 2026): the archive credits every season from
1931/32 on (the first with player statistics) to a manager. Everyone has run his current sides since then, except at the
sides that file lists, which name their managers in order and the season each took over. The sheets' moves of 6
September, 2 October and 5 October 2026 are real, apart from 6 September's swaps at Spartak, Dynamo and ISS and 5
October's at Eivorie; every
other change in the sheets' history was a cleanup. 9 October's moves are real too: three national sides took a coach
whose style fits theirs (Albers back at Kinshū; Rautinen and Sarelainen swapping Tierra Arcadia and Axerfreditenshin). test/tenures.mjs checks the file against the records.
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
first), a bar at the left of a row marking the champion (`--gold`), the clubs that went up (`--up`) and the clubs that
went down (`--loss`), read off the division each played the season after, with a key. A tournament's stages are its
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
row). Overview and Rules give the side column more of the window than a competition's pages do (480 to 620px), so
every fixture keeps its sides' names whole (Moukden and Kirin, 10 October 2026: "Table can take up less space here;
the team names in fixtures shouldn't be truncated"). Once it is over, **Summary** (the champion, the runner-up and
third) takes the place of Fixtures. **Fixtures**:
every round of every stage, the round being played scrolled into view, the same rows with the buttons' names and each
match's home advantage. Delete asks twice, and a knockout's clears the rounds after it. **Player Stats**: as a season's.
**Rules**: what it was set up with, and what can still change from the next match (the tiebreakers, home advantage).
Live hands the match to Play Match and brings its result back. A finished tournament downloads its season file and its
player stats sheet in the archive's format, to be filed by hand; a File To Archive button can follow.

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
in a real pitch's widest proportions, or its bench (a row a man, given name and SURNAME, the surname bold: "John DOE"), by the switch in its
title row, which reads the formation and Bench (Moukden and Kirin, 10 October 2026: "Do manager and bench need their own
column?", then "Dude have you seen how crowded the pitches are"). Between them: **Strength Comparison** (OVR, XI OVR and
BENCH OVR, then the eleven's ATT, MID and DEF, each pair facing across its label), **Form** (each side's last five, on one
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
should be optimized for screenshots to show all match info"). It fills the window at one scale, drawn on a 1600 by 900
design. Top down:

**The banner** puts the result over the ground's photo, like Play Match's; with no photo the kit colours run out from
each half under a shade that keeps white text readable on a light kit. Over the score, the competition and round
(1935 World Cup · Group A, Round 1; Friendly; Friendly · Second Leg); under it FULL TIME, AET, the shootout or the
aggregate, then the ground, its city and its nation. Each side has its crest, its name, its code with its eleven's OVR and
its shape, and its manager with his style.

Then the timeline (cards, injuries and missed or saved penalties, never substitutions); the team sheets either side, with
the minute beside every man who came on or went off; between them possession, the seventeen numbers, the Played Live
count under Reds for a tournament's fixture, and the Top Player; and every goal along the bottom, playing on hover.

**Copy Image** sits with the buttons, which keep out of the picture until the mouse moves. It copies the page to the
clipboard as a 1920 by 1080 picture whatever the window's shape, without the buttons, ready to paste into Discord. Not
picked: the momentum chart on Full Time.

### Editor

For the ACU's editors and the overseer (Moukden and Kirin, 10 October 2026, over five rounds of questions). A fourth
section in the top bar, EDITOR, shown only to signed-in editors and the overseer. Its pages are tabs in the page bar:
**Teams**, **Players**, **Managers** and **Requests**. The Edit Player and Edit Club buttons on player and side pages open
that record here; the old dialogs go.

**Who may change what.** The overseer changes everything. An editor changes only their own nation's sides, its national
side and its clubs: their names and kits freely; their code, ground (with its capacity) and city by request to the
overseer; their formations and the slots of their squads; and who plays for them and who manages them, by moving men. An
editor never changes a man's rating, age or traits, and their editor shows those locked. A side's style follows its
manager: appointing a manager brings his style, and only the overseer sets a style directly.

**Teams** is a picker rail down the left (New Team at the top, a search, then the editor's own sides; the overseer sees
every side) with the picked side filling the rest: its name and kits, its code, ground and city (a request), its
formation, and its squad on a pitch with the bench beside it. Drag a man onto another slot or bench place to swap the
two, or click one and then the other. Beside the pitch a search covers every player and manager: a free agent, or a man
from one of the editor's own sides, moves at once; a man at another nation's club opens a trade, to which men going back
the other way can be added before it is sent. Changing the formation re-slots the eleven.

**Players** is the same rail (New Player, a search, the editor's nation's men first). A player's page shows his facts
(name, nationality, date of birth, rating, traits), locked for an editor and open to the overseer, and his sides: an
editor can release him from or move him between their own clubs, and call him up to or drop him from their national
side. The overseer can also retire him. **Managers** works the same way: appoint him to one of your sides or release him;
one at another nation's club is a trade; his rating is the overseer's.

**New records** are requests the overseer answers. A new player: name, nationality, date of birth, position, the side he
joins (one of the editor's own sides, or none) and the rating the editor proposes. A new manager: name, nationality, date
of birth, style and a proposed rating. The overseer may change any of it before letting it in (Moukden and Kirin, 10
October 2026). A new club: name, code,
kits, ground and capacity, a city from the map's cities, its league and division, formation, manager, and a full squad of
sixteen from free agents, its nation's men and new players requested with it. One line under each form gives the image
rules: badges 500 by 500 with 50px of padding on every side and a 25px white outline, portraits a chest-up headshot in a
plain white shirt, sent as a zip to @auroruse on Discord.

**Trades** are a one-way move or an exchange (men going both ways), proposed as one request and accepted or declined
whole, by the other nation's editors or, where it has none, the overseer. While one waits only the men named in it are
locked, and accepting re-checks that it still fits both squads.

**Requests** is the full view of every request: For You, Yours and, for the overseer, the new records waiting. A new
record opens in the Editor with every field open to the overseer; Approve lets it in as edited, Reject sends it back with
a note. The top bar's Cart and Requests stay as the quick view, and every change is saved from the cart, as before.

### Documentation

Written for the ACU's editors and readers (Moukden and Kirin, 10 October 2026): every screen and how the engine plays a
match, in plain terms with few numbers. It opens from the settings menu. Its pages
are tabs in the page bar (The App, Matches, Styles And Managers, Ratings, Tournaments; editing waits on the editor's
rebuild). Each page lists its
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

Inline SVG, 1.5px stroke, round caps and joins, 16px in bars, 14px in rows. No emoji, no icon font.

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
up to the widest pitch the window's height allows.

**Results.** Every match of the season in every competition the club entered, newest first: the competition's short
form (the archive folder, NL1, KPL, CWC, WC), the round or stage (R38, G3, QF, F), the opponent's crest and code, H or
A, and the result. A shoot-out adds a P after the score (its own score on hover), and extra time without one adds AET; every
score in the app is written this way, however its file spelt it.

**Nation.** The national side as a banner: "National Team" and its conference over its name and rating, its ground,
then a dark strip of its AFA ranking (with the move since the year before), manager, style and last five results,
beside honours chips the strip's height. A side with no ground photo wears a sash of its second colour; the kit's second
colour edges every banner. Below it, each division is a band of club tiles, as wide as its clubs need: last season's
champion on gold, the clubs that came up or went down on faint green or red beside their arrows.

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
  previews; `test/rules.mjs` checks it on the real records. A change to the rules goes live when the server is redeployed. A screen not yet rebuilt sits under the two bars in
  the old canvas, at its old size.
- `test/tourn.mjs`, `test/import.mjs` and `test/export.mjs` cut the tournament's functions out of App.tsx by name, so
  rebuilding Tournaments keeps those names.
- `design/mock/build.mjs` writes the mockups in `design/mock/` from the real records and season archive. Every new
  screen is mocked there and approved before it is built.
