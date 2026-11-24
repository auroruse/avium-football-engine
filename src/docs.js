// THE DOCUMENTATION (gear menu), written for Avium's editors and readers in plain terms. It runs from first use to how
// the engine works: Basics, Browsing, Matches, Tournaments and Editing are how to use the app; Players, Tactics and The
// Engine are how it plays. A page is a topic and a section a question. A block is one of:
//   "text"                          a paragraph
//   { dl: [[term, text]] }          a list of terms, each a name the app itself uses (a button, a setting, a panel)
//   { tbl: { head, rows, w, sm } }  a table, where the rows really have columns (w: widths in pixels, the last left to fill)
//   { steps: ["text"] }             numbered steps
//   { live: "styles", ... }         drawn from the engine itself (App.tsx docLive), so it cannot drift from what it plays
// Explanation is written as paragraphs. A paragraph is never cut into labelled boxes to look like a figure.
// A section keeps its id when it moves, so an address copied before a reorganisation still opens it; DOC_MOVED holds the
// pages that were renamed.
export const DOC_MOVED = { app: "browsing", start: "basics", styles: "tactics", ratings: "players" };
export const DOCS = [
  { id: "basics", title: "Basics", sections: [
    { id: "the-app", title: "The App", body: [
      "The Avium Football Engine keeps the football of Avium: every nation, club, player and manager, and every competition they have played. It also plays the matches. A match is simulated in full, twenty-two players and a ball on a full-size pitch, and you can watch it or take the result at once.",
      "Signing in is for Avium's editors, who each keep their own nation's sides, and for the overseer, Kirin, who keeps the whole registry and sets every rating.",
      "The same app also serves Arterra, another roleplay, under the Universe switch in Settings.",
    ] },
    { id: "getting-around", title: "The Screen", body: [
      { live: "screen" },
      { dl: [
        ["1 Sections", "Registry, Competitions and Tournaments, and Editor for a signed-in editor."],
        ["2 Search", "Finds nations, clubs, players, managers and competitions by the start of any word in the name, and a side by its code. The arrow keys move through the results and Enter opens one."],
        ["3 Settings", "The colour theme, the Universe switch and this Documentation. Kirin's menu also has Viewer Mode, which shows the app as someone signed out sees it."],
        ["4 Sign In", "With a GitHub account, for Avium's editors. Signed in, an editor has Requests and the Cart beside it: what is waiting on an answer, and the changes not yet saved. See Editing."],
        ["5 Play Match", "Opens the match screen. See Matches."],
        ["6 Page Bar", "Names the page you are on and lists the section's pages as tabs. On a page about one club, nation, player, manager or competition it starts with that name, and with the step above it where there is one: a club's nation, a player's club."],
      ] },
    ] },
    { id: "first-match", title: "A First Match", body: [
      { steps: [
        "Press Play Match, on the right of the top bar.",
        "Pick two sides by searching for their names, or press the die for a random one.",
        "Press Kick Off to watch it, about fifteen minutes at normal speed, or Sim To End for the result at once.",
        "At Full Time, Copy Image puts the whole match on the clipboard as a picture.",
      ] },
      "A friendly starts on neutral ground with injuries on, and goes to extra time and penalties if it ends level.",
    ] },
    { id: "terms", title: "Terms", body: [
      { dl: [
        ["Eleven, Bench", "The eleven who start, and the substitutes. Every side has twenty-two places: eleven and a bench of eleven."],
        ["Rating", "A player's overall rating, his OVR: a whole number from 25 to 99."],
        ["Position", "Where a player belongs. He has one or two of his own, and most other places cost him rating."],
        ["Role", "The job a slot carries under the side's style: a ball-playing defender, a target man."],
        ["Playstyle", "A side's whole set of instructions, shown as its manager's style."],
        ["Trait", "What a player is known for: a habit in how he plays, and an edge in the skill the habit needs."],
        ["Match Rating", "A mark out of ten for one player's match. Everyone starts on 6.5."],
        ["Expected Goals", "How likely a shot was to go in, from nought to one, added up over a match."],
        ["Editor", "Keeps one nation's sides: its squads, managers, grounds and leagues."],
      ] },
    ] },
  ] },
  { id: "browsing", title: "Browsing", sections: [
    { id: "registry", title: "Registry", body: [
      "Registry is the record of who exists today: every nation, club, player and manager. Its Overview ranks the national sides, shows your own nation when you are signed in as an editor, the season's leaders (the season picked in the title), the holder of every title still contested, and the Atlas.",
    ] },
    { id: "atlas", title: "The Atlas", body: [
      "The map on Registry's Overview places every Avium club in its city. Zoomed out, nations are dots in their colours; zoom in for crests. A crest's size follows its club's rating. A city with several clubs is one marker, its strongest club's crest with a count on its corner, and pointing at it lists them all. The switch in the title moves between clubs and national sides.",
    ] },
    { id: "nations", title: "Nations", body: [
      "A nation's page opens on its national side as a banner: conference, rating, ground, AFA ranking, manager, style, last five results and the titles it holds. Under it, each division of its league is a band of club tiles. Last season's champion sits on gold, and the clubs that came up or went down carry an arrow.",
    ] },
    { id: "clubs", title: "Clubs And National Sides", body: [
      "A club has two pages. Overview runs left to right. First comes the club's profile: its crest, kits, ground, manager, strength by line, and its squad's age and value. Then its squad, as a list of every player with his age, value, traits and season's figures, the bench's open places shown, or on a pitch in the club's formation with the bench beside it. Then its season and its honours, and every result of the current season in every competition.",
      "History is a row a season, newest first: the division, the finish, the record, the cup and continental runs, titles in gold, and the manager. Every honour sits beside it, by competition, with the years it was won.",
      "A national side has the same two pages. Its squad shows each player's club and the year's international figures, and its latest tournament stands where a club's season is. Its History has columns for the World Cup, its qualifying, the Nations League and its AFA ranking that year.",
    ] },
    { id: "teams", title: "Teams", body: [
      "Teams lists every club, or every national side by the switch in its title, with its nation and league (a national side's conference), its rating, its eleven's attack, midfield and defence, its bench, its city, its style and formation, and its squad's value. Filter by name, nation and league, or conference.",
    ] },
    { id: "players", title: "Players", body: [
      "Players searches every player. Filter by name, position, nationality, competition, club and age; the club filter also holds Free Agents and the Hall Of Fame. The table has three views: Overview, Season (one year in every competition) and Career.",
      "A player's page opens on a banner in his club's colours with his crests, rating, positions, age and value. Positions lights his own positions, each with the sides that play him there. A place a side plays him out of position is red, with a line under the pitch for that side, and the role each side's style gives him is listed below.",
      "After Positions come Traits, Season Stats for the season picked, Performance (his career per game against the average career at his position), Career (a row a spell at a side, with one total) and Honours. His History lists every competition season he played, with his figures and the rating change each one brought.",
    ] },
    { id: "managers", title: "Managers", body: [
      "Managers works like Players. Filter by name, style, seat (clubs, national sides, both, or free agents) and nationality, with the manager's card on the right. Win rates at clubs and with national sides are kept apart. A rate from fewer than ten matches is grey and sorts below the rest.",
      "A manager's page has his banner (style, rating, both win rates, age), then Tactics, his side on a pitch with the role he gives each player; Sides, each side's record this season; and Results. His History has his Career, a row a side, the Competitions he managed in, and his Honours. A free agent's page is his banner over his history.",
    ] },
    { id: "trades", title: "Trades", body: [
      "Trades is every move the registry has made, season by season: trades between nations' clubs, free agent signings, releases, moves between one nation's own clubs, and managers changing club. A season runs from one World Cup to the next.",
      "Each deal shows the real date it was made and its kind, every player in it with his rating, age and value when he moved, the clubs he left and joined, and each club's value in and out. Clubs, on the right, lists who bought and who sold that season; picking one shows only its deals.",
    ] },
    { id: "rating-changes", title: "Rating Changes", body: [
      "Rating Changes lists every ratings refresh on file. Batches, down the left, lists each refresh, newest first, with its rises and falls. Changes, in the middle, lists the picked batch a player a row, searchable and filtered by side or by rises and falls. Sides, on the right, gives each side's net change; picking a side filters Changes to it, and picking it again clears it.",
    ] },
    { id: "competitions", title: "Competitions", body: [
      "Competitions is the archive: every competition on file and every season of each. Overview lists them with their seasons on file, the holder and the side with the most titles. Years shows every competition that finished in a year. Head To Head sets two clubs or two national sides against each other: their record, every meeting, and every season they played in the same competition.",
      "A competition has three pages. Overview is its Roll Of Honour and its Titles. Season shows one season: its table, or its groups and knockouts, the results round by round, a summary of the champion, the runner-up and the season's best players, and Player Stats. Records holds the all-time table, the team records and, from 1931/32, the player records.",
      "A league's final table marks the champion and the places that went up, into a playoff and down, with an arrow by each club that moved. The newest season marks who its rules send before anyone has moved.",
      "Seasons are filed at three depths: a winner alone, a final table alone, or the whole season with its results and player figures. The full seasons mostly start in 1931/32.",
    ] },
    { id: "afa-rankings", title: "AFA Rankings", body: [
      "The AFA Rankings place every Avium national side that has played, once a year, by its results. Every side started 1932 level. A side takes points off the side it beats in a World Cup, a World Cup qualifier or a Nations League match: more for a bigger margin, most at a World Cup, and a shootout counts as a draw. Confederation championships are left out.",
      "At each year's turn a side keeps two thirds of its lead over the starting mark, or of its deficit, so one year's run counts for less in the next.",
      "AFA Rankings, in Competitions, has a full table for each year. A national side's page shows its place each year as a bar, and its current place with an arrow for the move since the year before. A year is added when it closes.",
    ] },
  ] },
  { id: "matches", title: "Matches", sections: [
    { id: "play-match", title: "Setting Up A Match", body: [
      "Play Match, in the top bar, sets up a friendly, and a tournament's fixture opens here from its Live button. Pick each side by searching its name, with the leagues as groups. The die picks a random side from every league: a club for a club, a national side for a national side.",
      { dl: [
        ["Venue", "Home Ground, Away Ground or Neutral, the default. A neutral ground can be named, and Swap Ends swaps the sides, the ground and a first leg's score."],
        ["Result", "Draw Allowed, or Extra Time And Penalties, the default."],
        ["Injuries", "On by default."],
        ["Second Leg", "Enter the first leg's score and the aggregate decides, with away goals if you turn them on."],
      ] },
      "Under the banner are both team sheets, on a pitch or as a bench, then Strength Comparison, Form and Head To Head. The team sheets show the roles from each side's own style, so they can change once the managers have read each other. Kick Off starts the live match, and Sim To End plays it out at once.",
      "A tournament's fixture keeps its sides and the tournament's rules: a knockout needs a winner except in a first leg, and the team sheets allow for bans, injuries and rotation. Drop Fixture lets go of the tournament and keeps the two sides as a friendly. Close parks a match in progress, to Resume or Abandon later.",
    ] },
    { id: "live-match", title: "The Live Match", body: [
      "At normal speed a match runs in real time, about fifteen minutes, and it can run from a quarter speed to twenty times. Half time waits for a click, and the same fixture played again gives a different match.",
      "The scorebug in the top left carries the score and the clock, a red mark for each player sent off, and in a shootout every kick. Plates come out from under it and go back in: a goal's scorer with the minute and who made it, a card, a change, a missed penalty, a number set side against side every ten minutes or so, the two sides' record together at the kick-off, and the scorers and numbers for as long as an interval waits.",
      "Watched at four times or faster, only goals, cards and changes are shown, and at eight times only goals and red cards.",
      "Beside the pitch are the feed, both sides' player ratings, Momentum and the Top Player. Each line of the feed is a heading (Goal, Yellow Card, Foul, Injury and the rest) with the player under it.",
      "On the pitch with the players are the referee and his two assistants, as striped dots, and both coaches in their technical areas. A coach's order shows over him as he gives it.",
      { dl: [
        ["Start, Pause, Continue", "Run and stop the match."],
        ["Sim To End", "Plays the rest out at once, extra time and penalties included."],
        ["Subs", "Either side's substitutions. The match pauses while it is open, and the changes are made at the next dead ball."],
        ["Tactics", "Either side's tempo, time wasting, goal kicks and defensive line, with From The Dugout, the manager's latest moves. The match pauses while it is open, and the changes apply at the next dead ball."],
        ["Stats", "The full figures, with the match still running."],
        ["Overlay", "Draws the runs, the pressers and the markers on the pitch."],
        ["Close", "Parks the match to finish later."],
      ] },
    ] },
    { id: "replays", title: "Goal Replays", body: [
      "After a goal the match plays on. Replay, on the goal's plate under the scorebug, opens its replay, and the arrow on a goal's line in the feed opens that goal's at any time. Slanted panels in the scoring side's colour cross the screen as a replay opens and as it closes, and the match waits while it is open.",
      "A replay takes the whole pitch and shows up to fifteen seconds of the move, drawn the way the match is and at the match's speed.",
      "Its arrow button saves it as a GIF: the attacking half with the goal at the top, each player's name over him as he touches the ball, and a bar underneath with the scorer's portrait, the minute, his name and the assister, both crests and the score. The highlights at Full Time have the same button.",
    ] },
    { id: "live-tactics", title: "Tactics In A Match", body: [
      "A side's tempo, time wasting, goal kicks and line all come from its style. During a live match, Tactics changes them for either side, from the next dead ball.",
      { dl: [
        ["Tempo", "Five steps. A quicker tempo means less time on the ball and firmer passes, and tires players faster."],
        ["Time Wasting", "Never, Sometimes or Constantly, only while ahead: slower restarts, at the risk of a booking."],
        ["GK Distribution", "Short or long goal kicks."],
        ["DL Style", "Drop Off, Step Up or Offside Trap: the line sits deeper or higher, and the trap steps up further still."],
      ] },
    ] },
    { id: "full-time", title: "Full Time", body: [
      "Full Time puts the whole match on one page, made to be screenshotted. The result sits in big type over the whole of the ground's photograph, uncropped. Down the middle come the theme's competition mark, drawn large over a tournament's fixture, then the competition and round, the score level with the names, FULL TIME level with the managers, Pens, AET or Agg where they apply, and the ground. Each side has its code, its eleven's rating, its shape, and its manager with his style.",
      "Below come the timeline of cards, injuries and missed or saved penalties, then both team sheets, with every player's figures and the minute each substitute came on or went off. The match's top player has a star by his name. Then the momentum chart, with the minute of every goal, over possession and seventeen more numbers, and every goal along the bottom, replayed on hover.",
      "Copy Image, or Command-C (Ctrl-C) with nothing selected, puts the page on the clipboard as a 1920 by 1310 picture, ready to paste into Discord. A friendly then offers New and Replay, and a tournament's fixture Import, Replay and Abandon.",
    ] },
  ] },
  { id: "tournaments", title: "Tournaments", sections: [
    { id: "saved", title: "Saved Tournaments", body: [
      "Tournaments are kept in this browser and save themselves a moment after every change. Saved lists them newest first, with the stage each has reached, its leader or winner and the matches played. Each row has Rename, Copy, Export and Delete, and New Tournament and Import are in the page bar.",
      "An exported tournament is a file another browser can import. A tournament copies its sides' squads when it is made, so later changes to a squad never reach it.",
    ] },
    { id: "formats", title: "Formats", body: [
      "New Tournament starts from a preset or from scratch. The Preset menu has two halves. Formats are shapes with no sides in them: League, Cup, Groups And Knockout, Home And Away Groups, Groups And Best Thirds, Swiss And Playoff and Double Elimination.",
      "Fields are real competitions, and loading one brings its sides, its groups where they were drawn, and the format it was played under: the 1934 World Cup and Club World Shield, the 1935 World Cup, Club World Cup, Club World Shield and Nations League, the 1936 Eastern and Western Qualifiers, and the All-Nichirin Collegiate Championship. A side that has since left the world leaves its field, and its group plays a side short.",
      { dl: [
        ["Structure", "Groups; Groups, Then Knockout; or Knockout."],
        ["Groups", "From 1 to 26, played as a round robin over the legs you choose, or Swiss, over up to one round fewer than a group's size."],
        ["Drawn Swiss", "A Swiss whose whole schedule is drawn before a ball is kicked. Each group is cut into pots by rating, one pot for every two rounds, and every side plays two from each pot, its own included, one at home and one away. Every side hosts half its matches and never plays three at home or three away in a row."],
        ["Group Allocation", "As Drawn, Seed (snake order by rating), Random, By Hand or Draw."],
        ["Knockout", "Single or double elimination, with a third-place match, two legs with away goals, a reset match, and byes by ranking or by hand. First Round Only stops it after its first round, the Playoff: every winner goes through and there is no champion."],
        ["Knockout Allocation", "Seed, Random, By Hand, Draw or Crossover. Crossover pairs group winners with other groups' runners-up (1A against 2B), and works when exactly the top two of an even number of groups go through."],
      ] },
      "Before It Can Start lists anything that stops a tournament from starting, such as too few sides or more Swiss rounds than a group allows.",
    ] },
    { id: "the-draw", title: "The Draw", body: [
      "A group draw can limit the clubs from one nation and the sides from one confederation in a group to 1, 2 or 3; a limit no draw could meet is greyed out. Sides can be pinned to a group before it starts, and a check says whether the draw is still possible. Pots go by rating, nation, confederation or by hand. Begin Draw starts it, and Draw Next, Auto and Draw All carry it on.",
      "A knockout draw can also draw later rounds, and keep apart sides from the same confederation, nation or group, or two group winners. The first side drawn into a tie plays at home.",
      "On a by-hand step, click or drag sides into place, or use Fill At Random. A tie with one side is a bye; byes can also be given to the top sides by ranking. A draw in progress is saved, and Back To Setup works until it begins.",
    ] },
    { id: "zones", title: "Qualification Zones", body: [
      "Zones mark places in a group's table, counted from the top or from the bottom.",
      { dl: [
        ["Colour Only", "Shading, for a champion's place or relegation."],
        ["Go Through", "The sides in it qualify for the knockout."],
        ["Best Placed", "The sides in it from every group go into one table, ranked by points, goal difference, goals and rating, and the number you set qualify, the way a World Cup takes its best third-placed sides."],
      ] },
      "Go Through and Best Placed exist only in a tournament with a knockout. Without either, Through Per Group sets how many go through from each group.",
      "Already Qualified marks sides that play and count but take no place in the zones, the way a World Cup host plays its qualifiers. The places pass down past them, so if the host finishes third, fourth takes the third place's zone.",
    ] },
    { id: "tiebreakers", title: "Tiebreakers", body: [
      "Points come first. After them come the tiebreakers, in an order you drag to set: Goal Difference, Goals Scored, Head To Head (points, then goal difference, then goals between the sides level), Wins, Buchholz (Swiss only: the strength of the opponents faced) and By Hand. Sides level on everything rank by rating.",
      "With By Hand, sides level on everything get a swap button, and while such a pair sits across a qualification line the knockout waits: Proceed To Knockout reads Tiebreaker Needed.",
    ] },
    { id: "venues-rules", title: "Home Advantage And Rules", body: [
      { dl: [
        ["Home Advantage", "Off, First Listed, Weaker Side, Fewer Group Points or Host Side. Host Side plays at a set of host grounds, spread evenly over the matches. In a two-legged tie each leg's home side has it."],
        ["Injuries", "Whether players get injured, and miss matches for it. A player who played on hurt is Doubtful for the next match and starts it short of full fitness."],
        ["Long Injuries", "Leaves out a player whose long injury is on file from an earlier season."],
        ["Suspensions", "A red card bans a player for one to five matches, by the offence. Every fifth yellow card bans him for one."],
        ["Tiredness", "Players carry tiredness from one match into the next, and sides rotate for it."],
      ] },
    ] },
    { id: "long-injuries", title: "Long Injuries", body: [
      "The worst injuries outlast the competition they happen in. The season's Player Stats sheet lists them in a block headed INJURED, and once that season is filed every new competition leaves those players out, for club and country. A row can be typed into the sheet or deleted from it by hand.",
      "A year runs World Cup, then leagues and cups, then Club World Cup and Shield, then Nations League, then World Cup Qualifiers, counted as 2, 6, 2, 1 and 1 of its twelve parts. A broken foot, cartilage, a collarbone, a broken ankle or ankle ligaments cost one to five parts from the day it happened, so a player can be back partway through a league. A cruciate, an Achilles or a broken leg ends the year, and in its second half the next World Cup as well.",
      "A competition is placed in the year by its name, so name it for its season: 1936 World Cup, League One 35-36. A friendly never makes a long injury.",
      "While it lasts, the player's page shows it in a warning row over his Season Stats, with the competition he is back for. At full time a match lists every injury with the games it costs, ROS for one that outlasts the competition and Doubtful for a player who played on hurt.",
    ] },
    { id: "rotation", title: "Rotation", body: [
      "With Tiredness on, tired players and players on a long run of starts are rested for fresher ones, except in a match that must be won.",
      "A side measures each match against every line on its table: the title, a playoff place and the drop, as much as the places that go through. A side that is through with its place settled rests up to eight players for the knockout. A side that is out, or whose league place can no longer change, plays its best eleven.",
      "Over two legs a side three or four goals down still plays to win, and only five down is the tie given up.",
      "A player in his first match back from an injury that kept him out for two matches or more starts it short of fitness, so he tires by the hour and usually comes off then.",
    ] },
    { id: "playing", title: "Playing A Tournament", body: [
      "A running tournament has four pages: Overview (the stage, its fixtures and its leaders, and a summary once it is over), Fixtures, Player Stats and Rules, where the tiebreakers and home advantage can still change and Rebuild From The Results recounts the tables and player figures.",
      "Group matches open a round at a time; a knockout tie opens once both its sides are known. Each match has Sim, to play it out at once, Score, to type a result, and Live, to watch it in Play Match. A typed score is played out with scorers to match, and a level knockout score goes to extra time and then penalties.",
      "A played match can be edited or deleted. Deleting a knockout result clears the rounds after it, and editing one clears them only if the winner changes.",
      { dl: [
        ["Sim Round", "Plays every match left in the round."],
        ["Sim All", "Plays on until the end, or to a round that still has to be drawn."],
        ["Pair Round", "Pairs a Swiss round."],
        ["Proceed To Knockout", "Ends the group stage."],
        ["Export", "The season's report, its player stats and its bracket."],
        ["Reset", "Back to the start, after asking twice."],
      ] },
    ] },
  ] },
  { id: "editing", title: "Editing", sections: [
    { id: "editors", title: "Editors And Kirin", body: [
      "Each editor keeps their own nation: its national side, its clubs and its leagues. An editor may also be given another nation's clubs and leagues without its national side. Kirin can change anything, and answers the requests editors send.",
      "Sign in with the GitHub account Kirin has listed for you, and the top bar gains the Editor section, Requests and the Cart. Everything is edited on its own page: Edit, at the top right of one of your sides, a league or a player, turns that page into its editor. The Editor section holds Home, Sent (Kirin's Inbox), Trades and Activity, the pages for new players, clubs and leagues, and the Sheet until the pages cover everything it does.",
      { dl: [
        ["Yours To Change", "A side's name, kits, ground, capacity, city, time wasting and formation, and who plays where; players and managers moved between your own sides, free agents signed and players released; your national side's call-ups; a league's name, tier and cup; and a new player rated at or under his side's level for him, its best starter at his position."],
        ["By Request", "A club's code, one of your players' positions, a new player rated over his side's level or left blank, and every new manager, club and league. Kirin answers these."],
        ["On Trades", "Any move between clubs can also be made on Trades, which shows every player's value. A move to or from another nation's club is made only there, as an offer that nation accepts."],
        ["Kirin's", "Every player's own record: his name, nationality, date of birth, rating and traits, shown locked on his page; his positions too, which you may ask to change, and a new portrait, which you may ask for. A side plays its manager's style, so a new manager brings his with him."],
      ] },
    ] },
    { id: "side-page", title: "Editing A Side", body: [
      "Edit on one of your sides' pages shows its editor, the same for a club and a national side: the team and its tactics on the left, the squad, where players come from beside it, and Checks and Changes on the right. Editing stays on as you go from side to side, and Previous and Next Club step through your sides that still have open places.",
      { dl: [
        ["Team", "The name and code, the formation, time wasting and the style, which is the manager's; the manager, with the free managers to appoint and Sack; the kits; and the ground, capacity and city. A club with no badge says so, with How To Send."],
        ["A Club's Open Places", "Pick an open place, or leave the first one picked, and beside the squad choose who fills it: Free Agents to sign, My Clubs to bring a player over from another of your clubs, or New Player to make one there, one at a time, with his rating against the club's level. For Its Place puts the players who fit that place first. Many, over the squad, makes several at once."],
        ["A National Side's Nationals", "Every eligible national is listed beside the squad, best first, by line and by search. Pick a squad player and the list narrows to those who can play his place, each with Swap In; pick an open place and each has Call Up. Move To Bench and Drop are over the list."],
        ["Player", "On a club, the player picked: where he plays, his positions and value. Swap and then another row changes the two over, and a row dragged onto another does the same. Move To Bench brings the best substitute for his place into the eleven. Call Up puts him into your national side, Trade opens Trades, and Release asks twice. His rating and the rest of his record are on his own page."],
        ["Checks", "The side in words: whether the eleven is complete, its goalkeepers, its open places, its manager, anyone out of position, and a missing badge."],
        ["Changes", "This side's changes in the cart, each marked Live or For Review, each with Undo. Send saves the whole cart."],
      ] },
      "A new player waiting for review shows faintly in his place, and that place is not open until he is answered.",
    ] },
    { id: "player-page", title: "Editing A Player", body: [
      "Edit Player on a player's page edits him there. Kirin sets his rating in the banner, his positions on the pitch (Primary, or Second for the one he also plays; clicking his second again drops it), his traits and their levels, his name, nationality and date of birth, and can retire him. An editor asks for one of their own players' positions the same way, and Request New Portrait asks for a new picture of him. Changes, on the right, lists what is done to him with Undo and Send.",
    ] },
    { id: "new-pages", title: "New Players, Clubs And Leagues", body: [
      { dl: [
        ["New Player", "From Home, or One at the top of the page: a blank player page, filled where it reads. His name, nationality, date of birth or age (the die draws another date), positions on the pitch, rating in the banner, traits, and the club and place he joins or none. On Save says whether he goes in at once or for review. Add Player puts him in the cart, and Add And Next starts the next open place at the same club. An editor's new player has his portrait asked for with him."],
        ["Many", "A list pasted a player a line, into one club's open places or to free agency. Each line becomes a row to put right before anything is added: name, position, age and rating can be changed in the row, and a row with something wrong says what. Ages and ratings not given are drawn or left as chosen."],
        ["New Club", "From Home, or New Club on a league's page: a blank club page marked Draft, filled where it reads, its squad from free agents, your other clubs or new players. Checks says what it still needs, and Send sends it for review."],
        ["New League", "From Home: a blank league page marked Draft, with its name, tier and cup, and its clubs made with New Club, each opening its own draft page. The league and its clubs go for review together."],
        ["A League's Page", "Edit on one of your leagues changes its name, tier and cup, lists its clubs with Edit on each, and starts a New Club in it. Kirin also moves clubs in and out."],
      ] },
    ] },
    { id: "desk", title: "Home And Activity", body: [
      "Home is your nation at a glance: what there is to do, each with a button that starts it (Fill takes you to your first side with open places), and your sides as a ledger with their ratings, squads, open places, managers and shapes. Click a side to edit it. Beside it are what you sent, the offers made to you, and the latest activity.",
      "Activity lists every save that put something live, who made it and what it changed. Undo takes one back while nothing it changed has been changed since: its fields go back to what they were and the players it made are removed. Kirin can undo anyone's; an editor, their own. An undo shows in the list too, and can itself be undone.",
    ] },
    { id: "cart", title: "The Cart", body: [
      "Nothing in the Editor is saved until the cart is. Each change goes into the Cart in the top bar, a block for each player, manager, side or league with every field it changes, old to new. Live on a block means saving puts it on the site; Request means it waits for an answer.",
      "Remove takes a block out, with Undo to put it back, and Empty Cart clears the lot after asking twice. The cart is kept in this browser until it is saved.",
      "Save checks the whole cart against the rules first and lists anything wrong at its foot. A cart with a problem saves nothing. Saved changes are on the site in a minute or two, and any requests in the cart are sent at the same time.",
      "Deals never go into the cart: they are sent from Trades, and take the cart's changes to their clubs with them.",
    ] },
    { id: "requests", title: "Requests", body: [
      "Requests, in the top bar, lists what is waiting: For You, the requests you can answer, then Yours, the ones you sent. An editor's Sent page shows the same in full. Kirin's Inbox lists what waits a save a row; a save opened shows its players under their clubs, each with his rating in a box, and Preview beside it shows the picked club's eleven, bench and squad ratings before and after. Cap At Level brings every rating over its club's level down to it, and Live lists what editors put in on their own, with Undo.",
      "Each request shows its side, who asked and when, the players coming in and going out, and who it is waiting for, with a tick against each who has agreed. Offers from Trades show in the top bar too, each with Open, which takes you to it on Trades; the Sent page and the Inbox leave them to Trades.",
      { dl: [
        ["Accept, Decline", "Answer a request sent to you."],
        ["Withdraw", "Takes back one of yours before it is answered."],
        ["Dismiss", "Clears one of yours that was declined. It stays in Yours, with the note it was declined with, until you do."],
        ["Review", "Kirin's, on a new record: it opens in the Editor with every field open. Approve lets it in as it then stands, once every blank rating is set, and Reject sends it back with a note."],
        ["Accept All, Accept Selected", "Answers a block, a club or the ticked rows in one save. A rating can be changed in its row first."],
        ["Withdraw All", "Takes back a whole block."],
        ["+3", "A new player rated that far above his club's best starter at his position."],
      ] },
      "Four or more requests from one save show as one block, its new players a row each under their club. A new player waiting for review shows faintly in his place on the Sheet and on his side's page. Decline, Withdraw and Dismiss each ask twice.",
    ] },
    { id: "sheet", title: "The Sheet", body: [
      "The Sheet is the registry as a spreadsheet. Each nation has a tab along the foot, yours first and then every nation with clubs; the rest are under All Nations. Every tab can be read, and another nation's is locked.",
      "A tab is one table: the national side first, then the clubs league by league, each league under a strip with its badge and name. Clubs stand best first, sorted when the tab opens, so a row stays put while you work on it.",
      "The badge, code and name stay in place while the rest scrolls: OVR, XI, Bench and Value, worked out as players move; formation and time wasting; the manager; home and away kits; city, ground and capacity; and then the places, twenty-two for every side. Each place starts with its position in the side's formation, and on the bench its group: keeper, defenders, midfielders and forwards, in that order.",
      "A player is a chip with his rating, his name, and his nation's code when he is not the tab's. One out of position, a substitute in another group's place too, shows the rating he plays the place at, ringed in red, with what it costs him. A manager's chip carries his style.",
      "One click opens any cell you can change: a list for formation and time wasting, a colour picker for a kit, a search for the city, a box for the rest. Enter or Tab keeps the change and Escape drops it. The arrow keys and Tab move around the sheet, typing on a cell starts on it, Enter on a chip opens his record, and Delete releases a player or sacks a manager. The bar over the grid shows the picked cell in full.",
      "A changed cell stays marked until the cart is saved, and an editor's change to a code shows Requested until Kirin answers. Undo and Redo, beside the bar, or Ctrl+Z and Ctrl+Y, step back and forward through your changes.",
      { dl: [
        ["Sort And Filter", "A column's name sorts every league by it, and its funnel keeps only the values you tick."],
        ["Find", "Looks across every tab for a player, a manager or a side, and takes you to his cell."],
        ["Fullscreen", "Lays the sheet and the dock over the whole screen. Escape brings it back."],
      ] },
    ] },
    { id: "moving-men", title: "Moving Players", body: [
      "Drag a chip onto a place. Onto another player, the two change places, wherever each came from: two of your clubs, or the eleven and the bench. Onto an open place, he moves there.",
      "A club's player dragged onto his national side is called up and stays at his club; dropped onto a player already there, that player leaves the squad. Managers move the same way between your sides.",
      "A starting place can't be left empty, and a player in an offer or request that is still waiting carries a lock and can't move. A move to another nation's club is made on Trades.",
      { dl: [
        ["Record", "The chip you clicked: his details, the sides he plays for, his traits and his value. Sub Out on a starter and Sub In on a substitute list the players he can change places with. Trade opens Trades with him in a deal; on another nation's player it reads Make An Offer. Kirin edits the record here and can retire a player."],
        ["Lineup", "The picked side on a pitch, with its bench under it and its formation at the top. Drag players around it, or between it and the sheet. Clicking a side's badge opens it here."],
        ["Free Agents", "Every player and manager without a club, best first, on two tabs, Players and Managers, each with a search; a player who plays only for his national side is one. Drag one onto an open place to sign him, or onto a player to sign him in that player's place. Drag a player from the sheet onto this panel to release him, or a manager to sack him. New Player and New Manager are at the top, and new players in the cart without a side show first in the list."],
        ["Nationals", "With a national side picked: its players not called up, best first. Drag one up into the squad."],
      ] },
    ] },
    { id: "new-records", title: "New Players And Managers", body: [
      "New Player, at the top of Free Agents, opens the form on the dock: name, nationality, date of birth (or an age, which draws a date for it, and the die another), position and second position, the side he joins if any, rating and traits. Add To Cart puts him in the cart, and Cancel throws the form away. A form left for something else is kept in this browser, and New Player brings it back. The + in an open place opens the same form for that place.",
      "New Manager, and the + in an empty manager cell, do the same for a manager, with his style in place of positions; one made for a side takes it over when he is let in.",
      "Typing into an open place is quicker, a player a line: (86) Kenji MORISHITA, ST, 24, Finisher, Composed",
      { tbl: { head: ["Part", "Written", "If Left Out"], w: [110, 0, 380], rows: [
        ["Rating", "In brackets, first", "He stays blank"],
        ["Name", "A surname in lower case is put in capitals", "Needed"],
        ["Position", "After a comma, and a second after another comma", "He plays the place's"],
        ["Age", "A number", "A date of birth is drawn for an age from 18 to 32, or 18 to 21 at a college"],
        ["Traits", "By name, each with a number after it for its level (Vision 3)", "None"],
      ] } },
      "A college's player starts in the year his age gives. Paste several lines to make a player in each open place from there on. A row copied from a sheet works too, a player a cell as the registry writes him, (76) Cihan KARTACA [SEL], with his nation in brackets when it is not the side's: the players go to the places one after another, an empty cell leaves its place as it is, and a cell holding only a position gives it to the player before it. A manager's name typed into an empty manager cell makes him the same way.",
      "A new player's chip, typed or made with the form, opens him in the form, where Done keeps a change and Remove takes him out.",
      "Many, at the top of the New Player form, opens a list across the page for a whole squad or a group of free agents: a line a player as above, one nationality unless a line tags his own, an age range for the lines without an age, and each player rated in the table if his line has no rating. A free agent's line needs his position; a player joining a side plays the place he takes. It goes to Kirin as one request, and its players show in the places they will take, or at the top of Free Agents.",
      { dl: [
        ["Roll Ratings", "In the menu on a side's row number, wherever it has new players: a new club's, or the new players in the cart in one of your sides. Give it a team rating and it rates every new player left blank, or rolled before, so the side averages it: the starters about a point above it and each bench player below the starter at his position. Ratings you typed, and players already on file, stay as they are."],
        ["Roll Ages", "Beside it. Give it an age range, 18 to 32 to start, and every new player there gets a new date of birth for an age in it. A date set by hand on his form stays."],
      ] },
      "Everything new is sent when the cart is saved. For an editor each new player is one request, which Kirin may change before letting it in; Kirin's own go in at once. A rating can be left blank for Kirin to set, and a new player's traits are those his rating affords. A new player can be of any nation, but one from outside your own needs a rating below that nation's level, its national side's rating, which the Rating box shows. New managers are of your own nation.",
    ] },
    { id: "leagues", title: "Clubs And Leagues", body: [
      "+ New Club, at the foot of each league, adds a row to fill in place: name, code, kits, city, ground and capacity, formation and time wasting. Its players come from Free Agents and your own clubs, or are made in its places; its manager comes from Free Agents or the + in its manager cell. It needs its eleven starters, and the bench can wait. Remove, in a new club's menu, takes it out of the cart with the players made there.",
      "New League, under the last league, adds a strip for the league's name, tier and cup, with + New Club for its founding clubs. A new club with its players is one request, and so is a new league with its clubs.",
      "A league's name, on its strip, opens it on the dock: its name, tier and cup are yours to change without a request. Two leagues can share a tier, for regional divisions. A renamed league keeps its old names, so its past seasons, its badge and the clubs in saved tournaments still find it. A league split into conferences, as the collegiate championship is, lists them on its dock with their clubs, and its editor renames them there.",
      "Kirin also sees how many places go up and down, and moves a club into another league by dragging its row number onto that league's strip.",
      "Kirin removes a club from its row number's menu: Remove Club, then Confirm Remove. When the cart is saved the club leaves the records, its players and manager become free agents, and its seasons stay in the archive. A club named in a waiting offer or request, or holding a player who is, can't be removed.",
    ] },
    { id: "trades", title: "Trades", body: [
      "Trades is where players and managers change clubs: signings, releases, moves between your own clubs and swaps with other nations' clubs, between as many clubs as you like. Down the left are your offers: Your Move, the ones waiting on you; Waiting, yours and the ones you have accepted that still wait on others; and Declined. New Deal starts another.",
      "Your club stands on the left. Add, on the right, brings in another club, or Free Agents to sign from; each gets a tab, and the cross on a tab takes it out. Click a player to put him in the deal: with one other club he goes to it, and with more the click asks where he goes, to a club or to free agency. Click him again to take him out.",
      "Each club counts its places as the deal stands, and one that would hold too many asks who makes way, with Release beside each of its players; the deal cannot go until every squad fits. A player coming in takes the place of a player leaving, but a keeper's place only ever goes to a keeper, and a starting place left empty is filled from the bench.",
      "Each player shows his transfer value where he stands now. The Deal lists what each club gets and gives, with the value coming in and going out, and where each player coming in will play. A deal between your own clubs, or with free agents, goes live with Confirm. One with another nation's club is an offer: Send Offer sends it to that nation's editors, or to Kirin where it has none. Kirin has Apply Now as well, to put it straight in.",
      "Every club in an offer accepts the same version. Accept, Decline (with a note) or Counter answer it: a counter changes the deal from your side and sends it back to every other club to accept again. Withdraw takes back one of yours. Until it is settled only the players in it are held, and each accept checks again that it still fits.",
      "Sending or accepting a deal also saves the cart's changes to its clubs, so nothing you arranged is lost. National sides are not traded: they call up their own nationals on the Sheet.",
    ] },
    { id: "college-draft", title: "The College Draft", body: [
      "After each NL season the final-year college players are drafted in one round of 44 picks, NL2's last club picking first and NL1's champion last, except where a pick has been traded. Its board is the Draft page in the Editor, which Kirin and every editor holding a pick see.",
      "A pick has two hours. When one of your clubs is on the clock the Draft tab carries a dot, and every player still on the board has a Draft button; Draft asks to confirm. With no open place in your squad, you name who makes way, and he leaves for free agency.",
      "A club whose two hours run out gets the best season match rating left, among the players with a sixth of the most minutes first. That is the list's order.",
      "Each pick on the board shows the club holding it and, once made, the player, his position and his college. The list under it is every final-year player left, with his season's figures; his rating stays hidden until he is drafted.",
      "Every final-year player nobody took goes to free agency, and any club can sign him through the usual save, first come first served. The draft is then filed under the Championship, and each player's page shows his pick.",
    ] },
    { id: "images", title: "Badges And Portraits", body: [
      "Nothing is uploaded in the app. A portrait is made on request: Request New Portrait on a player's page, or asked for with a new player.",
      "A badge, for a club or a league, is a 500 by 500 PNG with a transparent background, 50 pixels of padding on every side and a 25 pixel white outline, named by its code (ABC.png). Zip your badges together and DM them to Kirin on Discord. How To Send, on any missing badge, shows the same and lists your sides still without one.",
    ] },
  ] },
  { id: "players", title: "Players", sections: [
    { id: "player-ratings", title: "Player Ratings", body: [
      "A player's rating, his OVR, is a whole number from 25 to 99, set by Kirin. It is everything the engine knows about him. The badge it sits in is coloured by band.",
      { live: "metals" },
      "The engine works out his abilities from his rating and the line of the slot he stands in, when the slot is one of his own positions: pace, passing, shooting, tackling, positioning, strength, heading, reflexes and touch. The further forward the slot, the more of the rating goes into shooting and the less into tackling, so two 75-rated centre-backs are the same player until a trait sets one apart. Tired legs slow everyone as a match goes on.",
    ] },
    { id: "positions", title: "Positions", body: [
      { live: "positions" },
      "Every player has one or two positions of his own, kept on his record, and plays both at his full rating. His page lights them, with the sides that play him there, and lists show them as CM or CM/DM.",
      "Anywhere else he keeps the skills of his own position, whichever of his two costs him less there: a striker at centre-back tackles like a striker, and a centre-back up front shoots like one. He is never better than the player who belongs there at anything, so it can only cost him. A move within a line, a left back on the right or a central midfielder sitting deeper, costs little or nothing; a move between lines costs most.",
      { live: "posdrop" },
      "Keeping goal is apart: an outfielder who goes in goal plays it at half his rating, and a keeper played outfield plays on a keeper's skills and is shown at half his.",
      "Team sheets, pitches and the eleven's rating show a player at about the rating he plays the place at. Where the place costs him he is out of position: on a pitch his rating is ringed in red, with what the place costs him over it and a red warning triangle over his place, and in a list the triangle and the cost follow his place. Hovering either opens a card with his own positions, where he is playing and what he plays it as. A move that costs nothing is not flagged.",
      "Managers, tournaments and the Editor place players by their own positions: a formation change, a substitution, cover for an injury or a ban, and a signing all go to the place a player fits best. Positions are set by Kirin; an editor asks for a change by request.",
    ] },
    { id: "traits", title: "Traits", body: [
      "A trait is what a player is known for: a habit in how he plays, and an edge in the one skill the habit needs. A player without one plays exactly to his rating. His rating gives him points to spend on them, and nobody under 70 carries any.",
      { live: "budget" },
      { dl: [
        ["Levels", "Every trait comes at bronze, silver or gold: one, two or three pips. A higher level is more of the same habit and the same edge."],
        ["Cost", "A trait costs its level: one point at bronze, two at silver, three at gold."],
        ["Spending", "A few traits at a high level or several at a low one. A 90 can be a specialist with two traits at gold or an all-rounder with six at bronze."],
        ["Flaws", "A flaw is a trait that costs him in play. It comes at level one or two, gives that many points back, and a player carries one at most."],
        ["Pairs", "No bonus is added for holding two traits together. They work through the match itself: a trait that needs him to have seen the pass pays more on a player who looks around more."],
        ["Older Traits", "The twenty-two that existed before levels are carried at the level they then cost, so nobody who had one has changed."],
        ["In The App", "Hovering a trait anywhere shows its card: its name, its level, its family and what it does."],
      ] },
      "A keeper carries Shot Stopper or Commanding, and from 80 one of Long Ball, Short Passing or Composed. A trait usually belongs to a player's position, though about one in four crosses into another, and players of the same position and rating are spread across many traits rather than sharing one. Among the first twenty-two traits, those carried at the same level are each held by about as many players.",
      { live: "traits" },
    ] },
    { id: "match-ratings", title: "Match Ratings", body: [
      "Every player starts a match on 6.5 and finishes it between 3.0 and 10.0, on the scale SofaScore's ratings have used since 2025. An ordinary full match is about 6.95 for anyone. About one rating in thirteen is 8.0 or better, one in seventy is 9.0 or better, and a 10.0 comes about once in nine hundred.",
      { live: "scale", marks: [[6.5, "Start"], [8, "1 In 13"], [9, "1 In 70"], [10, "1 In 900"], [6.95, "Ordinary Match", "dn"]] },
      "Goals move it most, a goal from deeper more than a striker's, and a goal that decides the match further still; an assist moves it less. Cards, penalties won, given away, saved or missed, errors that lead to a goal, own goals and big chances missed all count.",
      "So does the routine work: passes, balls in behind that reach their player, duels, dribbles, headers, tackles and blocks, with defending worth more the nearer it is to his own goal. A goal against costs the defenders most and the midfielders a little, and a win or a draw adds a little for everyone who played in it.",
      "A keeper gains for every save and is judged on the goals he kept out compared with an ordinary keeper facing the same shots. A clean sheet adds to his rating, more for each save in it, and a full match without conceding never reads below 7.0.",
      "At full time every player is measured against an ordinary afternoon in his own position, so one scale serves them all. A player who played less than about two thirds of the match is measured against an ordinary spell of his length and drawn back toward 6.5 in proportion, unless he was sent off, so a quiet twenty minutes off the bench reads about 6.6. During a match the figure shown is the running total.",
      "A season's average rating is his match ratings over his appearances. Lists rank an average only from 15 games in a season, or from a sixth of the longest career for careers; a shorter one is grey and sorts last.",
    ] },
    { id: "season-stats", title: "Season Statistics", body: [
      { dl: [
        ["GP", "Games played, as a starter or a substitute."],
        ["G and A", "Goals and assists."],
        ["CC", "Chances created: every pass that led to a shot, assists included."],
        ["DC", "Defensive actions: tackles won, interceptions and clearances."],
        ["SV", "Saves."],
        ["Avg", "Average match rating."],
      ] },
      "A match is played in eighteen simulated minutes at full physical scale, so counting figures such as passes, tackles and chances come out at about a fifth of a real match's, and are shown as they are. Goals, expected goals and ratings are tuned to real matches.",
      "Performance, on a player's page, draws his whole career per game as a shape over the average career at his position: goals, assists, chances created, defensive actions and average rating for an outfield player, and saves, goals conceded, clean sheets and average rating for a keeper.",
    ] },
    { id: "ages-values", title: "Ages And Values", body: [
      "Everyone has a date of birth, and ages run on the in-world clock that the Time Counter and the Talopedia keep: a year of Avium time passes every 52 real days, counted from 1 January 1934.",
      "A player's value is worked out each time it is shown, from five things.",
      { live: "value" },
      { dl: [
        ["Rating", "The steepest part."],
        ["Age", "Full value from 24 to 27, falling from 28 to a few percent of it at 37. Keepers age two years later. A young player rated above 60 carries a premium, larger the younger and better he is."],
        ["Position", "Strikers are worth the most, then attacking midfielders and wingers, then midfielders, defenders and keepers."],
        ["Trend", "His net rating change over the last two seasons: a rise adds value and a fall takes it away."],
        ["League", "The strength of the league his club plays in. A player without a club counts as a middling league."],
      ] },
      "Values are shown to two figures ($8.5M, $450K). A Hall Of Fame player reads Retired.",
    ] },
    { id: "rating-changes", title: "How Ratings Change", body: [
      "Ratings move after each season, player by player, judged on how each did against what was expected of him, and Kirin files the changes. Each is recorded with its season and the competition that brought it; a few batches belong to no competition, such as a general rebalance. Rating Changes, in Registry, lists every batch, and a player's History shows each change on the row of the competition that brought it.",
    ] },
    { id: "side-strength", title: "Side Strength", body: [
      "A side's rating is the average of the players in its squad, bench included. Every side has twenty-two places, eleven and a bench of eleven, and a club's open places count for nothing until a player fills them.",
      "Play Match's Strength Comparison shows the eleven's attack, midfield and defence, each player counted at the rating he plays his place at, and the bench's rating; Teams shows the same for every side. The scorebug and Full Time show the eleven's rating the same way, and it moves when a substitute comes on.",
      "A side's rating never enters a match. Every duel, pass and shot is settled by the players involved, so the eleven on the pitch and the substitutes who come on decide it. Home advantage changes how a side plays and how the referee sees it, never anyone's rating.",
    ] },
    { id: "college-players", title: "College Players", body: [
      "The All-Nichirin Collegiate Championship is Nichirin's third tier: thirty-two college sides in four conferences. A player at a college shows no rating, value or traits, and no rating changes, to anyone but Kirin. Everyone sees his name, positions, age, college, year and figures, his match ratings included. A college side's own rating, its lines and its squad's value still show, and the moment a player leaves a college he shows like anyone else.",
      "A college course runs four years, First Year to Final Year. A player's year stands on his page where a value would, and beside his name on the Sheet.",
    ] },
  ] },
  { id: "tactics", title: "Tactics", sections: [
    { id: "playstyles", title: "Playstyles", body: [
      "A playstyle is a side's whole set of instructions: how it builds from the back, how it attacks, where it defends and how high it presses, and what it does the moment it wins or loses the ball. A side's style is shown as its manager's.",
      { live: "styles" },
    ] },
    { id: "what-a-style-does", title: "What A Style Changes", body: [
      "Most of a style's choices remove options outright. Unless he is under pressure, a player in a side that builds long plays no short pass near his own goal; a side told to go forward only passes forward through midfield; a patient side plays no forward ball it is unsure of; and a side told to cross, play through balls or take players on favours that in its part of the pitch.",
      "A limit holds while a ball it allows is on. With none on, a player may play the pass his style forbids before he gives the ball away. A style never changes the chance that something works, and weaker players keep to it more strictly.",
      "The pressing styles start hunting the ball higher up the pitch, at a cost in stamina, and push their line up with it; the low blocks never press high. A side set to counter breaks for a few seconds when it wins the ball, and one set to counter-press hunts it for a few seconds when it loses it. Each style keeps its own number of players behind the ball.",
      "Every style also moves with the score and the clock: through a match a side shifts its line, its pressing, its directness, its tempo and its time wasting to the situation.",
    ] },
    { id: "formations", title: "Formations", body: [
      "A formation is a set of slots, and whoever stands in a slot plays its role, on his own position's skills if the slot is not one of his positions. Without the ball a side drops into the shape its formation becomes: the second pitch of each pair, with that shape's name under it.",
      { live: "shapes" },
      "Changing a side's formation moves every player to the slot nearest his own positions. A manager who changes shape in a match only moves to a neighbouring one, and keeps his players in their own positions where the shape allows.",
    ] },
    { id: "roles", title: "Roles", body: [
      "Every player is given a role from his side's style, his slot and the side of the pitch the slot is on. A role decides where he stands in each phase, the runs he makes, how much he stays back, how readily he presses and tackles, and how much risk he takes with the ball.",
      { live: "roles" },
      "The possession styles field ball-playing defenders, inverted full-backs, a deep-lying playmaker, mezzalas and a false nine. Gegenpressing plays a stopper and a cover defender, overlapping full-backs, a ball-winner, box-to-box midfielders and pressing forwards. The low blocks play holding full-backs and a stopper, with a libero behind him in Zona Mista and Catenaccio.",
      "Where two players share a role, such as two defensive midfielders or two strikers, the better-rated takes the leading part, and team-mates look for him a little more. When the ball goes wide in the last third the striker is already on their last line, so the runs into the box come mostly from midfield. Roles are dealt again after a substitution, a red card, or a change of style or formation.",
    ] },
    { id: "managers", title: "Managers", body: [
      "A manager has a rating, a nationality and a date of birth, and his style is the one his side plays. His rating gives his players nothing in a match. It decides how well drilled his side is: how closely players hold their shape, how often they use the style's practised moves, call for each other and make their runs. It also decides how well he reads the match, before it and during it.",
      "The rating runs from 25 to 99 and is set by Kirin. It has no effect at 40 and its full effect at 90, and a side with no rated manager plays as if its manager were 60.",
      "His win rates count every match the archive credits him with, at clubs and with national sides kept apart. A shootout counts as a win or a loss.",
    ] },
    { id: "before-kick-off", title: "Before Kick-Off", body: [
      "If a stand-in is playing out of position, the manager may move to the neighbouring formation his eleven fit better. He then reads the opponent's style, getting it right more often the better he is, and weighs his own style against the three nearest to it. He sets his own aside only when one of them reads clearly better against this opponent, leaning toward attack when he must win or is behind in a tie. He also chooses his lone striker's role: a poacher against a high line, a target man against a low block.",
      "Each manager names the opponent's most dangerous player, from where he plays, his traits and his goals in the competition so far, and a poorer manager names the wrong one more often. If that player stands clear of the defence he faces, he is given a marker: the best defender who plays where he does.",
      "The marker leaves his own position to stay tight on him, follows his runs and stays with him when his own side attacks, while a midfielder blocks the pass into him and a second player closes him sooner near the box. The marker's own position is left open. The manager looks again at half time, and a good one as soon as his side concedes; the marker he names appears in From The Dugout.",
      "Away from home or on neutral ground, a manager whose eleven is clearly the weaker sets up for it. His defensive line and his press start deeper, more so the wider the gap. He drops it once he falls behind, and never starts with it in a match he has to win or at his own ground. The manager across from him expects the deep block and sets his side wider against it.",
      "A manager who reads a game well also looks for a weak link in the opposing back line: a stand-in playing out of position, a booked player, or one whose legs have gone. If one stands clearly below the rest, play is aimed at his part of the final third. He looks at kick-off and again at half time, and the player appears in From The Dugout.",
      "He remembers the last meeting with this opponent in the same competition. He reads their style correctly, counts a side that beat him by three or more as stronger than its ratings say, and has the players who scored against him that day watched more closely. In a second leg the first leg counts as a deficit to chase instead.",
      "At a corner his best player in the air marks theirs, his second best their second, and his own corners look for his best header first.",
    ] },
    { id: "during-the-match", title: "During The Match", body: [
      { live: "clock", rows: [["Injured Player Replaced", 0], ["Legs Gone", 0], ["Booked And Still Fouling", "subRiskFrom"], ["Tired Legs", "subLateMin"], ["A Poor Game", "subLateMin"],
        ["Match Won, Three Ahead", "subWon.0.1"], ["Match Gone, Three Behind", "subLost.0.1"], ["Match Won, Two Ahead", "subWon.1.1"], ["Forward On When Chasing", "subChaseMin"], ["Shape To Hold A Lead", 75]] },
      { dl: [
        ["Half Time", "Two down, or one down and outplayed, he switches to the neighbouring style that reads best."],
        ["Ten Men", "Unless he is behind, he turns to his most cautious neighbouring style."],
        ["Holding A Lead", "One up in the last quarter of an hour, he may move to the neighbouring formation that commits the fewest players forward."],
        ["Chasing", "One or two behind late on, he may send on a forward for a defender or a midfielder and move to the more attacking neighbouring formation. Once a match, and only when the bench holds a forward who fits."],
        ["Orders", "When his side is being outplayed he gives two to four players individual orders."],
        ["Substitutions", "An injured player at once, a keeper only for a keeper. Before the hour, only a player whose legs have gone. From the hour, a tired player once his replacement would play the place better than he can on the legs he has left, the changes worth most first, a better manager seeing it a little sooner. Chasing, he freshens his forwards first with the most attacking player who can play the place; holding a lead, the back, with the most defensive."],
        ["A Poor Game", "From the hour, a player whose match rating has fallen low is judged as the player he has been that day, so he comes off sooner."],
        ["On A Booking", "A booked player who has fouled again since the card can come off from half time, before he is sent off."],
        ["Match Over", "Three ahead from the hour, or two ahead in the last quarter of an hour, his best players and his most tired come off whatever the bench holds. The same three behind late on, unless the tie has to be settled that day."],
      ] },
      "Tired legs cost a player less than the gap between a star and a reserve usually is, so a side's best players stay on long after its squad players have gone off, often to the end.",
    ] },
    { id: "style-price", title: "The Price Of A Style", body: [
      "Left to itself the engine would favour pressing and direct play, so each style pays or is paid a small amount at kick-off, measured to even the styles out. Every player in the side, bench included, plays the whole match at his rating plus the figure for the style his side kicks off in.",
      { live: "style-price" },
    ] },
  ] },
  { id: "engine", title: "The Engine", sections: [
    { id: "how-it-works", title: "How A Match Is Played", body: [
      "Every match is simulated in full. Twenty-two players and a ball move on a full-size pitch, 105 by 68 metres. The world moves on four times every simulated second and the ball a hundred times, so every touch, line and goal is settled at the moment it happens. Team ratings are never compared: a goal comes from a player reaching a position, striking the ball and beating the keeper.",
      "A match is eighteen simulated minutes, shown as ninety, at full physical scale: distances, speeds and the pace of a shot are real, and there is less of the match. That is why passes, tackles and clearances come out at about a fifth of a real match's and are shown as they are, while goals, expected goals and ratings are tuned to real matches.",
    ] },
    { id: "decisions", title: "Decisions", body: [
      "The player on the ball prices every option open to him: a shot, worth its expected goals; a pass to feet, into space, through, over the top, a switch, a long ball or a cross; a run with the ball; a clearance; or putting it out. Each is worth what follows it, times the chance it comes off, less the cost of losing the ball there, and he takes the best.",
      "He knows only what he has seen. He looks around, checks his shoulder and remembers players out of view, and better players misjudge less. A misjudgement lasts for the whole move.",
      "He does not play a pass he does not expect to arrive: how sure he has to be rises with his rating, and moves a little with his side's passing and freedom instructions. The exceptions are a ball that makes a chance, a ball his side's plan asks for, and a ball played under pressure. With nothing sure on he keeps the ball.",
      "Settling on a pass takes time: little for a short, open ball to a player in front of him, more for one that is far, through a crowded lane, into a run, in the air, one he is less sure of, or to a player he is not looking at. A less aware player needs longer for all of them, and a player being closed down plays what he has already seen.",
      "The time he has had a team-mate in sight before the ball arrives counts toward it, so the obvious ball to a player he has been watching can go first time and the one he has to look for waits. After a touch that controls the ball the earliest pass is half a second later, and a player with nobody on him is in no hurry. A sure forward pass goes as soon as he has settled on it.",
      "No ball played back toward his own line is aimed in front of his own goal, unless it is to the keeper. A team-mate with a clearly better chance to score is given the ball.",
    ] },
    { id: "off-the-ball", title: "Off The Ball", body: [
      "Off the ball the side moves through phases: building up, progressing, attacking, countering, pressing, holding a block or recovering. Each role has its lane, players stay back, a unit presses, the marking is zonal or man to man, and players make runs: in behind, overlapping, underlapping, coming short, into the box, third-man runs and one-twos.",
      "With the ball, a side keeps two players open ahead of it: when too few are, the players best placed leave their places for the nearest free spot the passer can reach, and hold it while it stays open. A break is on only while the other side is outnumbered behind the ball or caught upfield.",
      "A player who goes in behind gets a start on his marker, who needs a moment to react, shorter the better he reads the game. A player standing on the last defender's shoulder can be played in behind before he moves: he goes as the ball is struck. A ball that puts a player clear is played at once when it is on, though not to a runner whose marker is goal-side of him and close.",
    ] },
    { id: "passing", title: "Passing", body: [
      "Whether a pass arrives is down to the physics: every kick carries an error in aim and weight, and whoever reaches the ball takes it. The error is smallest for a good passer with time on a still ball. It grows with the players closing him down, each counted by how good a defender he is, with a ball struck first time or on the move, and with a lower rating; a composed player is hurried less. The same pressure makes a first touch heavier and a shot less clean.",
      "A pass to a running player is played into his stride, ahead of him across the line of the pass, and a ball in the air is led for its own longer flight. The player it is for and the players contesting it read where it will come down, and a player who cannot quite get to a pass in time stretches for the nearest point of it he can reach.",
      "Dice settle tackles, aerial duels, a keeper's catch or parry, a penalty keeper's guess, fouls, cards, injuries and where a corner is aimed.",
    ] },
    { id: "duels", title: "Duels And Speed", body: [
      "A loose ball goes to whoever reaches it first, and the player on the ball keeps it unless an opponent gets a foot nearer. Reading the game lengthens a player's reach to cut out a pass and shortens the time he needs to react to one, strength widens the carrier's edge, and tackling lengthens a defender's reach at the carrier. In his own penalty area a defender throws a leg at a pass as he would at a shot.",
      "A defender close enough goes in when his chance clears a bar set by his temperament, a booking, his side's instructions and the cover behind him. If he misses, he fouls or is beaten and has to turn. A dribbler's move wrong-foots his defender for a moment, longer the better he is on the ball than the defender is in the tackle.",
      "A ball into a player with an opponent close by is an aerial duel, won in the air by the stronger and better-placed of the two. The winner heads it to a free team-mate if he can find one, and away if he cannot. A player with nobody on him brings a high ball down and plays.",
      "In front of the other side's goal it is different: any ball that drops at head height close to it is headed at goal. A cross is only played when a team-mate can meet it in front of goal, and it is put ahead of him for him to attack.",
      "Pace sets a player's top speed, and tiredness takes speed and touch away.",
    ] },
    { id: "shots", title: "Shots And Goalkeepers", body: [
      "A shot's expected goals are set as it is struck: the distance and the angle, the shooter's finishing, the pressure on him, the bodies in the way, his run-up and where the keeper really stands. A header is worth about three-fifths as much, and a penalty about three in four. Better finishers aim nearer the post, and every strike carries some error.",
      "A player does not shoot into a defender a stride in front of him, or at a keeper who covers the goal from where he stands; he looks for another way. With the goal packed in front of him, he has a go from the edge of the area, through a body or two if he can see the goal. A cross, a corner or a free kick swung into the box is attacked in the air and headed at goal.",
      "The keeper reacts to the shot as it comes. Better keepers react sooner, and bodies in front of him slow him down. Close in, he saves only what he already covers standing.",
      "A slow ball is always held; otherwise he catches more easily the nearer it is to him, the slower it is and the fewer players are in front of him. A ball he catches stays in his hands, however hard it was struck. Anything he does not hold is a parry still in play. He may not handle a deliberate back-pass.",
      "A shot or a cross that comes off a defender in his own area carries on the way a ball comes off a body, now and then into his own net. A deflected shot is the shooter's goal if it was on target and an own goal if it was going wide, and a cross or a pass a defender turns in is an own goal.",
    ] },
    { id: "set-pieces", title: "Set Pieces", body: [
      "The restarts are kick-offs, goal kicks, corners, throw-ins, free kicks and penalties. Each is taken once the players who matter are in place, never later than a set time. The keeper takes the goal kicks, the side's specialist the corners and the free kicks near goal, a strong player the long throws, and the nearest player the rest.",
      "A throw, a goal kick or a free kick far out goes to the team-mate the taker rates best, the way a pass is chosen in open play: whether anybody can get across the ball's path, whether the receiver is free when it gets to him, how likely the side is to still have the ball a few seconds later, and what having it there is worth. With nobody to find, a goal kick or a free kick goes long into their half and a throw goes down the line.",
      "A restart is played quickly only if that team-mate is still clearly free when the taker is over the ball; otherwise it waits for the shape. Unless it is taken quickly, the players jog to their places rather than sprint, and only hurry if it has been waiting a while.",
      "At a kick-off each side stands in its shape in its own half: the side kicking off has its back line about fifteen metres behind halfway, and the side waiting for it keeps its forwards just off the centre circle and its back line about twenty metres back. Offside is judged at the moment of the pass and called when the offside player plays the ball.",
    ] },
    { id: "free-kicks", title: "Free Kicks And Corners", body: [
      { live: "ranges" },
      "A free kick close enough to the goal, from where enough of the goal can be seen, is struck at goal with spin: it swings in the air and dips, over the wall or round the end of it, harder and nearer the corner the better the taker. The keeper reads only part of the swing as it is struck. From out wide it is crossed in.",
      "The nearer the kick, the more players stand in the wall, with one fewer from a tight angle. They line up from the near post inward while the keeper takes the far side. The kick is not taken until nobody is inside ten yards, the wall stands on its marks, the keeper is set and the taker's own players are up.",
      "Corners use three routines, the centre-backs go up, and the ball favours the best headers. A corner, and a free kick crossed into the area, is whipped in with swing on it to the top of its target's jump, and the players attacking it go to meet it in the air; the defence, set and marking, still wins the first ball more often than not. One down at the end, the keeper goes up too.",
      "A cross from open play swings too. Anybody puts a little swing on a ball; a lot of it takes Dead Ball on a dead one or Crosser on a cross, and a ball that swings is harder to defend in the air.",
    ] },
    { id: "penalties", title: "Penalties", body: [
      "A penalty has no set taker: the player who won it takes it about half the time, and otherwise it goes to any one of the side's three best at it. It is taken as soon as the area is clear and the taker is set.",
      "Everyone else waits on the edge of the area beside the D, in pairs with a player from the other side, the defender on the inside, with one of the attacking side on the D and a few from each side back near halfway. The kick goes to a random corner and the keeper guesses, better keepers guessing right more often.",
    ] },
    { id: "celebrations", title: "Celebrations", body: [
      "A goal is celebrated the way the moment calls for. Usually the scorer runs to the corner flag or to the crowd, and the team-mates near him follow. A late equaliser or winner brings the whole side to him and the substitutes off the bench; a goal that makes it three or more ahead is a handshake and a jog back. The side that conceded walks back to restart. While a goal is being celebrated the match clock runs at real time.",
    ] },
    { id: "discipline", title: "Fouls, Cards And Injuries", body: [
      "Fouls come from challenges: a mistimed tackle, a hold, or a foul on purpose to stop a break. A foul in the box is a penalty, so defenders go into challenges there far more carefully.",
      "The referee is on the pitch and gives what he sees. From far off, with players in his way or at a run himself, he can miss a foul (Waved Away in the feed) or give a fair tackle (Soft Foul). The home crowd sways only the calls he is unsure of. Each match he is a little stricter or more lenient than the last; he books less in the first twelve minutes, more from a player's third foul, and more for a foul that hurts its man.",
      "Outside the box, and away from the fouled side's own third, he plays advantage when the player rides the challenge. It runs four seconds: if the other side wins the ball in that time, play comes back for the free kick. A card he owes is shown at the next stoppage.",
      "Denying a clear chance is usually a red outside the box and a yellow inside it; stopping a promising attack is a yellow; any other foul is judged on the pace of the challenge and the danger. Two yellows make a red. Time wasting can be booked, and now and then a player is sent off for violent conduct or abuse away from the ball. A handball in the box is a penalty, and a red if it stopped a shot.",
      "A player can be hurt by a foul, a hard fair tackle, a clash in the air, or a muscle that goes at a sprint, likelier on tired legs, past 29, in a first match back or carrying a knock into the match. The injury fits what happened: a challenge takes a knee or an ankle, a pull takes a hamstring.",
      "A knock he runs off, a little slower for a few minutes. Anything worse stops play and brings the physio on. He is then treated and back, or treated and playing on hurt (slower for the rest of the match, and it can go again), or cannot continue and is replaced. A player being treated leaves the field, so his side is a man short until he is waved back on; a keeper is treated where he lies. A head injury always ends his match.",
      "After a red card a side gives up its most advanced position, and its manager turns cautious unless he is behind. A sent-off keeper is replaced by the reserve keeper, at the cost of the weakest outfielder; with no keeper left, the deepest outfielder goes in goal at half his rating.",
    ] },
    { id: "stamina", title: "Stamina", body: [
      "A player starts a match on the legs he has: fresh, or in a tournament that carries tiredness, with three quarters of what he lost in his last match back. His stamina drains with every metre he runs, faster while his side presses and at a quicker tempo. Nobody recovers during a match, and a tired player loses pace and touch.",
      "A player presses only as hard as his legs allow: the extra cost of pressing falls away as he tires, and once he is tired he stops chasing the ball just because he was told to, so a pressing side eases off in the last half hour.",
    ] },
    { id: "substitutions", title: "Substitutions", body: [
      "A side has five substitutions when its bench has eleven places, named or not, and three with a smaller one. They are made at a dead ball and, like the law, at no more than three stoppages, half time not counted. The managers make them for both sides, in a live match too, where you can also make them yourself from Subs. When a manager makes each change is under Tactics.",
      "The player who comes on enters at the halfway line and runs to his place, and play waits for him. He takes the slot of the player he replaces and always plays it at no cost by his own positions, the best of those who can; if nobody on the bench can, the tired player stays on. Only an injured player is replaced out of position, by whoever plays the place best, and a keeper only by a keeper.",
      "A player who came on is not taken off again for his legs. In a tie that must be settled, level late on, a manager keeps a change for extra time.",
    ] },
    { id: "stoppage", title: "Added Time, Extra Time And Penalties", body: [
      "Added time is a little over half the time the ball was dead, and wasting time while ahead makes restarts longer. In a live match each half has its own added time, and the referee waits for a quiet moment to blow. Extra time is two halves.",
      "A shootout uses only the players on the pitch. A coin toss decides who kicks first. The five best takers take the first five, in the manager's order: most often the best is kept for the fifth, sometimes he goes first with the second best last, otherwise best first. Then the rest, the keepers last, and nobody takes a second kick until everyone has taken one.",
      "Each side takes five, and then it goes to sudden death. When it is won the winners run from the halfway line to the player who won it. Shootout kicks are not counted in the match figures.",
    ] },
    { id: "two-legs", title: "Two Legs And Home Advantage", body: [
      "Over two legs the aggregate decides, with away goals if they are on, counting in extra time as well, and the managers play to the aggregate.",
      "Home advantage changes no rating: the home side wins a few more tackles, and the referee's doubtful calls go its way.",
    ] },
  ] },
];

// What each family of traits is about, for the heading over its table.
export const TRAIT_FAM_DOC = {
  Mind: "How he reads the game and chooses",
  Ball: "What he does with it at his feet",
  Body: "Pace, strength and legs",
  Finishing: "Chances and what he does with them",
  Defending: "Winning it back and guarding the goal",
  Keeper: "Goalkeepers only",
};
// What each trait does to how a man plays (src/engine/config.ts ME_BADGES), for the Traits table. Its name and family are
// read from src/data/badges.js.
export const TRAIT_DOC = {
  finisher: "Gets into the box and hits it first time, with sharper shooting.",
  interceptor: "Leaves his man to sit in the passing lane and gambles on cutting the ball out.",
  rapid: "Runs in behind, beyond the last line, and wins the race.",
  aerial: "Crosses and corners are aimed at him, and he wins them in the air.",
  quickstep: "Quick off the mark, he runs with the ball into any grass in front of him.",
  blocker: "Gets into the line of the shot and throws himself at it.",
  strong: "Long balls go up to him, and he holds them up.",
  relentless: "Presses first, further from his post, and keeps going all match.",
  trickster: "Takes men on: feints, cuts and the knock past a man. He rides the challenge and wins fouls.",
  vision: "Reads the game better with time and options, needs less time to settle on a pass that is hard to see, and finds a runner early.",
  incisive: "Plays the ball into a runner's path and over the top, away from his marker, and defenders read it a little late.",
  disciplined: "Stays on his feet and picks his moment: his tackles are clean and he gives away fewer fouls.",
  longshot: "Shoots from distance whenever he has room, and curls it from outside the box.",
  firsttouch: "Wants the ball under pressure: team-mates find him even when he is marked, his touch is cleaner, and the man on him hurries it less.",
  crosser: "Crosses early, and from deep, with far more swing on the ball than most: harder to win in the air against.",
  tikitaka: "Keeps it short and simple, into the receiver's stronger foot, and takes it already knowing the next one.",
  deadball: "Takes the corners and free kicks, is one of the few who take penalties, and strikes them better: more pace and spin on a free kick, nearer the corner, with less error, and far more swing on a corner or a free kick crossed in.",
  composed: "Pressure does not hurry him: he keeps playing forward, strikes it clean and never panics it away.",
  commanding: "Comes off his line for balls in behind and for crosses, judges the race for them better, and reaches further for a cross, a loose ball in his area or a ball at a man's feet once he is out.",
  tackler: "Dives in, early and often, and gives away fouls for it.",
  longball: "Goes long with switches and diagonals, dropped onto the receiver's foot.",
  shotstopper: "Stays on his line, and on it his reflexes are sharper.",
  shouldercheck: "Checks his shoulder more often and remembers longer who is out of his sight, so a team-mate behind him costs no time to find, the man closing on his blind side rarely surprises him, and a runner off his shoulder is picked up sooner.",
  passandmove: "A ball he plays first time is struck as cleanly as one he has set himself for, and arrives easy to take, on the side away from the marker.",
  tempo: "Puts his foot on it: with nobody on him he waits longer for the right ball, minds losing it more and picks it better.",
  manon: "Talks: team-mates near him are warned more often of the man closing on their blind side, and pick up a runner sooner.",
  safehands: "Holds more of what he reaches, so fewer shots come back out to their strikers.",
  strongwrists: "Pushes his parries further and wider, and a shot rarely goes in off his fingertips.",
  quickrelease: "Lets the ball go sooner after a catch, with a surer throw and a better long kick.",
  penstopper: "Goes the right way more often at a penalty.",
  ballwatcher: "Watches the ball: rarely checks his shoulder, soon forgets who he cannot see, and is late to his man's run.",
  dwells: "Closed down, he takes as long over a pass as with nobody near, is slower getting the ball out of his feet, and is robbed more easily.",
  flaps: "Comes for crosses more often, misjudges them, and reaches fewer.",
  spills: "Holds less of what he reaches.",
  pressresistant: "Takes the ball and plays it with a man on him: his first touch, his pass and his choice are hurried far less.",
  ontherun: "Strikes it in his stride: a pass or a shot hit at a run or first time costs him little.",
  disguise: "Shapes to play one ball and plays another, so defenders read his pass late and reach less of it.",
  drives: "Carries the ball out and up the pitch whenever there is grass in front of him.",
  drawsfoul: "Gets his body between man and ball: he rides a challenge better, and those on him are given as fouls more often, in the area too.",
  ridestackles: "Stays on his feet through a challenge, so defenders win the ball off him less and go in less.",
  poacher: "Gets into the area, and what comes loose there he hits first time and cleanly.",
  squares: "Finds the team-mate with the better chance, with a ball played so that he can hit it: the shot off his pass is easier to strike.",
  closesdown: "Presses sooner, and the man he closes down is hurried more than his tackling alone would do.",
  lastditch: "In his own area he reaches further for the square pass and gets more in the way of the shot.",
  tightmarker: "Stays with his man: he reacts sooner to a run in behind and to the ball played into it, and holds a better position.",
  heavytouch: "His first touch is heavier.",
  givesaway: "Looser with every pass, and hurried more by a man on him.",
  outoflegs: "Tires faster.",
  greedy: "Shoots when a team-mate has the better chance, from further out, and snatches at it under pressure.",
  hothead: "Goes into tackles he should leave, and gives away more fouls.",
  losesman: "Reacts late to his man's run and stands in the wrong place.",
};

// The positions in the order the Positions table lists them.
export const POS_NAME = {
  GK: "Goalkeeper", LB: "Left Back", CB: "Centre Back", RB: "Right Back", LWB: "Left Wing Back", RWB: "Right Wing Back",
  DM: "Defensive Midfielder", CM: "Central Midfielder", AM: "Attacking Midfielder", LM: "Left Midfielder", RM: "Right Midfielder",
  LW: "Left Winger", RW: "Right Winger", ST: "Striker",
};
