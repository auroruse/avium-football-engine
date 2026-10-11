// THE DOCUMENTATION: a page a topic, a section a question, read in the Documentation section (gear menu). Written for
// the ACU's editors and readers in plain terms. A block is a paragraph (a string), a list of terms ({ dl: [[term, text]] })
// or a table read live from the engine ({ live: "styles" }), so what it shows cannot drift from what the engine plays.
export const DOCS = [
  { id: "app", title: "The App", sections: [
    { id: "getting-around", title: "Getting Around", body: [
      "The top bar holds the three sections, Registry, Competitions and Tournaments, with Play Match on the right, and a fourth, Editor, for a signed-in editor. Under it, the page bar names the page you are on and lists the section's pages as tabs. A page about one club, nation, player, manager or competition starts the page bar with its name, and with the step above it where there is one: a club's nation, a player's club.",
      "Every page has its own address. The browser's back and forward buttons work, the arrows beside the wordmark do the same, and any page can be sent to someone as a link.",
      { dl: [
        ["Search", "Finds nations, clubs, players, managers and competitions by the start of any word in the name, and a side by its code. The arrow keys move through the results and Enter opens one."],
        ["Settings", "The gear: the colour theme, the Arterra switch, and this Documentation. With Arterra off, the app shows Avium only: no world switches, and no Arterra sides, players or managers in any list, search or picker. It is saved in your browser and changes nothing for anyone else."],
        ["Sign In", "With a GitHub account, for the ACU's editors. Reading needs no account. See Editing."],
        ["Requests And Cart", "An editor's: what is waiting on an answer, and the changes not yet saved. See Editing."],
        ["Play Match", "The match screen. See Matches."],
      ] },
    ] },
    { id: "registry", title: "Registry", body: [
      "Registry is the record of who exists today: every nation, club, player and manager. Its pages are Overview, Players, Managers and Rating Changes. Overview has five panels.",
      { dl: [
        ["Nations", "Every national side ranked by rating. The switch in the title moves between Avium and Arterra, which are never listed together. It is gone while Arterra is off in Settings."],
        ["Your Nation", "When you are signed in as an editor, your nation: its rating, manager, style, ground and the titles it holds."],
        ["Leaders", "The season's best players: average rating, goals, assists, goal contributions, chances created, defensive actions, saves and appearances. The season is picked in the title."],
        ["Champions", "The current holder of every title still contested."],
        ["Atlas", "The map of Avium. See The Atlas."],
      ] },
    ] },
    { id: "nations", title: "Nations", body: [
      "A nation's page opens on its national side as a banner: conference, rating, ground, AFA ranking, manager, style, last five results and the titles it holds. Under it, each division of its league is a band of club tiles. Last season's champion sits on gold, and the clubs that came up or went down carry an arrow.",
    ] },
    { id: "clubs", title: "Clubs And National Sides", body: [
      "A club has two pages. Overview has the squad, the starting eleven on a pitch in the club's formation, the club's details, its honours, its league finishes and every result of the current season in every competition. Each bar in League Finishes opens that season.",
      "History is a row a season, newest first: the division, the finish, the record, the cup and continental runs, titles in gold and the manager. Every honour sits beside it, by competition, with the years it was won.",
      "A national side has the same two pages. Its squad of 22 fills the first column with each man's club, and AFA Rankings stands where a club's league finishes would. Its History has columns for the World Cup, its qualifying and the Nations League.",
    ] },
    { id: "players", title: "Players", body: [
      "Players searches every player in the world picked. Filter by name, position, nationality, competition, club and age; the club filter also holds Free Agents and the Hall Of Fame. The table has three views: Overview, Season (one year in every competition) and Career. Click a column head to sort by it.",
      "Clicking a row puts the player's card on the right. His name, or View Player on the card, opens his page, and the arrow keys move through the rows.",
      "A player's page opens on a banner in his club's colours with his crests, rating, positions, age and value. Under it come Positions (his own positions lit, each with the sides that play him there, any other place a side plays him in red, and the role each side's style gives him), Traits, Season Stats for the season picked, Performance (his career per game against the average career at his position), Career (a row a spell at a side, with one total) and Honours. His History lists every competition season he played, with his figures and the rating change each one brought.",
    ] },
    { id: "managers", title: "Managers", body: [
      "Managers works like Players. Filter by name, style, seat (clubs, national sides, both, or free agents) and nationality, with the manager's card on the right. Win rates at clubs and with national sides are kept apart. A rate from fewer than ten matches is grey and sorts below the rest.",
      "A manager's page has his banner (style, rating, both win rates, age), then Tactics, his side on a pitch with the role he gives each man; Sides, each side's record this season; and Results. His History has his Career, a row a side, the Competitions he managed in, and his Honours. A free agent's page is his banner over his history.",
    ] },
    { id: "rating-changes", title: "Rating Changes", body: [
      "Rating Changes lists every ratings refresh on file. Batches, down the left, lists each refresh, newest first, with its rises and falls. Changes, in the middle, lists the picked batch a player a row, searchable and filtered by side or by rises and falls. Sides, on the right, gives each side's net change; picking a side filters Changes to it, and picking it again clears it.",
    ] },
    { id: "competitions", title: "Competitions", body: [
      "Competitions is the archive: every competition on file and every season of each. Overview lists them with their seasons on file, the holder and the side with the most titles. Years shows every competition that finished in a year. Head To Head sets two clubs or two national sides against each other: their record, every meeting, and every season they played in the same competition.",
      "A competition has three pages. Overview is its Roll Of Honour and its Titles. Season shows one season: its table, or its groups and knockouts, the results round by round, a summary of the champion, the runner-up and the season's best players, and Player Stats. Records holds the all-time table, the team records and, from 1931/32, the player records.",
      "Seasons are filed at three depths: a winner alone, a final table alone, or the whole season with its results and player figures. The full seasons mostly start in 1931/32.",
    ] },
    { id: "atlas", title: "The Atlas", body: [
      "The map on Registry's Overview places every Avium club in its city. Zoomed out, nations are dots in their colours; zoom in for crests. A crest's size follows its club's rating. A city with several clubs is one marker, its strongest club's crest with a count on its corner, and pointing at it lists them all. The switch in the title moves between clubs and national sides.",
    ] },
  ] },
  { id: "matches", title: "Matches", sections: [
    { id: "play-match", title: "Playing A Match", body: [
      "Play Match, in the top bar, sets up a friendly, and a tournament's fixture opens here from its Live button. Pick each side by searching its name, with the leagues as groups and a switch between Avium and Arterra. The die picks a random side from every league in the world picked: a club for a club, a national side for a national side.",
      { dl: [
        ["Venue", "Home Ground, Away Ground or Neutral, the default. A neutral ground can be named, and Swap Ends swaps the sides, the ground and a first leg's score."],
        ["Result", "Draw Allowed, or Extra Time And Penalties, the default."],
        ["Injuries", "On by default."],
        ["Second Leg", "Enter the first leg's score and the aggregate decides, with away goals if you turn them on."],
      ] },
      "Under the banner are both team sheets, on a pitch or as a bench, then Strength Comparison, Form and Head To Head. Kick Off starts the live match, and Sim To End plays it out at once.",
      "A tournament's fixture keeps its sides and the tournament's rules: a knockout needs a winner except in a first leg, and the team sheets allow for bans, injuries and rotation. Drop Fixture lets go of the tournament and keeps the two sides as a friendly. Close parks a match in progress, to Resume or Abandon later.",
    ] },
    { id: "live-match", title: "The Live Match", body: [
      "At normal speed a match runs in real time, about eighteen minutes, and it can run from a quarter speed to twenty times. The scorebug in the top left carries the score and the clock, and in a shootout every kick. Beside the pitch are the feed and the live player ratings, Live Stats, Momentum and the Top Player. Goal replays and half time wait for a click, and the same fixture played again gives a different match.",
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
    { id: "full-time", title: "Full Time", body: [
      "Full Time puts the whole match on one page, made to be screenshotted. Over the score sit the competition and round, with Pens, AET or Agg where they apply, and under it the ground. Each side has its code, its eleven's rating, its shape, and its manager with his style. Below come the timeline of cards, injuries and missed or saved penalties; both team sheets, with every man's figures and the minute each substitute came on or went off; possession and seventeen more numbers; the top player; and every goal along the bottom, replayed on hover.",
      "Copy Image puts the page on the clipboard as a 1920 by 1080 picture, ready to paste into Discord. A friendly then offers New and Replay, and a tournament's fixture Import, Replay and Abandon.",
    ] },
    { id: "how-it-works", title: "How A Match Is Played", body: [
      "Every match is simulated in full. Twenty-two men and a ball move on a full-size pitch, 105 by 68 metres. The world moves on four times every simulated second and the ball a hundred times, so every touch, line and goal is settled at the moment it happens. Team ratings are never compared: a goal comes from a man reaching a position, striking the ball and beating the keeper.",
      "A match is eighteen simulated minutes, shown as ninety, at full physical scale: distances, speeds and the pace of a shot are real, and there is less of the match. That is why passes, tackles and clearances come out at about a fifth of a real match's and are shown as they are, while goals, expected goals and ratings are tuned to real matches.",
    ] },
    { id: "decisions", title: "Decisions", body: [
      "The man on the ball prices every option open to him: a shot, worth its expected goals; a pass to feet, into space, through, over the top, a switch, a long ball or a cross; a run with the ball; a clearance; or putting it out. Each is worth what follows it, times the chance it comes off, less the cost of losing the ball there, and he takes the best. He knows only what he has seen. He looks around, checks his shoulder and remembers men out of view, and better players misjudge less. A misjudgement lasts for the whole move.",
      "Off the ball the side moves through phases, building up, progressing, attacking, countering, pressing, holding a block or recovering. Each role has its lane, men stay back, a unit presses, the marking is zonal or man to man, and men make runs: in behind, overlapping, underlapping, coming short, into the box, third-man runs and one-twos.",
      "A style limits what a man considers and moves where men stand. It never changes the chance that something works, and weaker players keep to it more strictly. Whether a pass arrives is down to the physics: every kick carries a little error in aim and weight, and whoever reaches the ball takes it. Dice settle tackles, aerial duels, a keeper's catch or parry, a penalty keeper's guess, fouls, cards, injuries and where a corner is aimed.",
    ] },
    { id: "duels", title: "Duels And Speed", body: [
      "A loose ball goes to whoever reaches it first, and the man on the ball keeps it unless an opponent gets a foot nearer. Reading the game lengthens a man's reach to cut out a pass, strength widens the carrier's edge, and tackling lengthens a defender's reach at the carrier.",
      "A defender close enough goes in when his chance clears a bar set by his temperament, a booking, his side's instructions and the cover behind him. If he misses, he fouls or is beaten and has to turn. A ball into a man with an opponent close by is an aerial duel, won in the air by the stronger and better-placed man. Pace sets a man's top speed, and tiredness takes speed and touch away.",
    ] },
    { id: "shots", title: "Shots And Goalkeepers", body: [
      "A shot's expected goals are set as it is struck: the distance and the angle, the shooter's finishing, the pressure on him, the bodies in the way, his run-up and where the keeper really stands. A header is worth less than half as much, and a penalty about three in four. Better finishers aim nearer the post, and every strike carries some error.",
      "The keeper reacts to the shot as it comes. Better keepers react sooner, and bodies in front of him slow him down. A slow ball is always held; otherwise he catches more easily the nearer it is to him, the slower it is and the fewer men are in front of him. Anything he does not hold is a parry still in play. He may not handle a deliberate back-pass.",
    ] },
    { id: "set-pieces", title: "Set Pieces", body: [
      "The restarts are kick-offs, goal kicks, corners, throw-ins, free kicks and penalties. Each is taken once the men who matter are in place, never later than a set time. The best shooter takes the penalties, the keeper the goal kicks, the side's specialist the corners and the free kicks near goal, a strong man the long throws, and the nearest man the rest. Free kicks far out, goal kicks and throws are played quickly to a free man when there is one.",
      "A free kick within about 27 metres is shot over a four-man wall. Corners use three routines, the centre-backs go up, and the ball favours the best headers; one down at the end, the keeper goes up too. A penalty goes to a random corner and the keeper guesses, better keepers guessing right more often. Offside is judged at the moment of the pass and called when the offside man plays the ball.",
    ] },
    { id: "discipline", title: "Fouls, Cards And Injuries", body: [
      "Fouls come from challenges: a mistimed tackle, a hold, or a foul on purpose to stop a break. There is no advantage, and a foul in the box is a penalty. Denying a clear chance is usually a red outside the box and a yellow inside it; stopping a promising attack is a yellow; any other foul is judged on the pace of the challenge and the danger. Two yellows make a red. Time wasting can be booked, and now and then a man is sent off for violent conduct or abuse away from the ball. A handball in the box is a penalty, and a red if it stopped a shot.",
      "Injuries come only from fouls, more often at pace. Most are knocks that slow a man for a few minutes; the rest end his match, with a body part and a severity that can keep him out for anything up to a season.",
      "After a red card a side gives up its most advanced position, and its manager turns cautious unless he is behind. A sent-off keeper is replaced by the reserve keeper, at the cost of the weakest outfielder; with no keeper left, the deepest outfielder goes in goal at half his rating.",
    ] },
    { id: "stamina", title: "Stamina And Substitutions", body: [
      "Every man starts fresh, and his stamina drains with every metre he runs, faster while his side presses and at a quicker tempo. Nobody recovers during a match, and a tired man loses pace and touch.",
      "A side has three substitutions, or five with a bench of eleven, made at a dead ball. The managers make them for both sides, in a live match too: an injured man at once (a keeper only for a keeper), tired men from about the half hour, a forward when chasing late and a defender when holding a lead. The man who comes on is the one who would play the place best by his own positions, and he takes the slot of the man he replaces. In a live match you can make them yourself from Subs.",
    ] },
    { id: "stoppage", title: "Added Time, Extra Time And Penalties", body: [
      "Added time is a little over half the time the ball was dead, and wasting time while ahead makes restarts longer. In a live match each half has its own added time, and the referee waits for a quiet moment to blow. Extra time is two halves.",
      "A shootout uses only the men on the pitch, the best takers first and the keepers last, and nobody takes a second kick until everyone has taken one. The home side kicks first. Each side takes five, and then it goes to sudden death. Shootout kicks are not counted in the match figures.",
      "Over two legs the aggregate decides, with away goals if they are on, counting in extra time as well, and the managers play to the aggregate. Home advantage changes no rating: the referee leans a little toward the home side on fouls and cards, and the home side wins a few more tackles.",
    ] },
  ] },
  { id: "styles", title: "Styles And Managers", sections: [
    { id: "playstyles", title: "Playstyles", body: [
      "A playstyle is a side's whole set of instructions: how it builds from the back, how it attacks, where it defends and how high it presses, and what it does the moment it wins or loses the ball. A side's style is shown as its manager's.",
      { live: "styles" },
    ] },
    { id: "what-a-style-does", title: "What A Style Changes", body: [
      "Most of a style's choices remove options outright. Unless he is under pressure, a man in a side that builds long plays no short pass near his own goal; a side told to go forward only passes forward through midfield; a patient side plays no forward ball it is unsure of; and a side told to cross, play through balls or take men on favours that in its part of the pitch.",
      "The pressing styles start hunting the ball higher up the pitch, at a cost in stamina, and push their line up with it; the low blocks never press high. A side set to counter breaks for a few seconds when it wins the ball, and one set to counter-press hunts it for a few seconds when it loses it. Each style keeps its own number of men behind the ball.",
      "Every style also moves with the score and the clock: through a match a side shifts its line, its pressing, its directness, its tempo and its time wasting to the situation.",
    ] },
    { id: "style-price", title: "The Price Of A Style", body: [
      "Left to itself the engine would favour pressing and direct play, so each style pays or is paid a small amount at kick-off, measured to even the styles out. Every man in the side, bench included, plays the whole match at his rating plus the figure for the style his side kicks off in:",
      { live: "style-price" },
    ] },
    { id: "managers", title: "Managers", body: [
      "A manager has a rating, a nationality and a date of birth, and his style is the one his side plays. His rating gives his players nothing in a match. It decides how well drilled his side is: how closely men hold their shape, how often they use the style's practised moves, call for each other and make their runs. It also decides how well he reads the match, before it and during it.",
    ] },
    { id: "before-kick-off", title: "Before Kick-Off", body: [
      "If a stand-in is playing out of position, the manager may move to the neighbouring formation his eleven fit better. He then reads the opponent's style, getting it right more often the better he is, and weighs his own style against the three nearest to it. He sets his own aside only when one of them reads clearly better against this opponent, leaning toward attack when he must win or is behind in a tie. He also chooses his lone striker's role: a poacher against a high line, a target man against a low block.",
      "The team sheet before a match shows the roles from the side's own style, so they can change once the manager has read the opponent.",
    ] },
    { id: "during-the-match", title: "During The Match", body: [
      { dl: [
        ["Half Time", "Two down, or one down and outplayed, he switches to the neighbouring style that reads best."],
        ["Ten Men", "Unless he is behind, he turns to his most cautious neighbouring style."],
        ["Holding A Lead", "One up in the last quarter of an hour, he may move to the neighbouring formation that commits the fewest men forward. He never changes formation to chase a match."],
        ["Orders", "When his side is being outplayed he gives two to four men individual orders."],
        ["Substitutions", "Made at a dead ball: injuries at once, tired men from about the half hour, a forward when chasing and a defender when protecting."],
      ] },
    ] },
    { id: "formations", title: "Formations", body: [
      "A formation is a set of slots, and whoever stands in a slot plays its role, on his own position's skills if the slot is not one of his positions (see Positions). Without the ball a side drops into the shape its formation becomes:",
      { live: "formations" },
      "Changing a side's formation moves every man to the slot nearest his own positions. A manager who changes shape in a match only moves to a neighbouring one, and keeps his men in their own positions where the shape allows.",
    ] },
    { id: "roles", title: "Roles", body: [
      "Every man is given a role from his side's style, his slot and the side of the pitch the slot is on. A role decides where he stands in each phase, the runs he makes, how much he stays back, how readily he presses and tackles, and how much risk he takes with the ball. Where two men share a role, such as two defensive midfielders or two strikers, the better-rated takes the leading part. Roles are dealt again after a substitution, a red card, or a change of style or formation.",
      "The possession styles field ball-playing defenders, inverted full-backs, a deep-lying playmaker, mezzalas and a false nine. Gegenpressing plays a stopper and a cover defender, overlapping full-backs, a ball-winner, box-to-box midfielders and pressing forwards. The low blocks play holding full-backs and a stopper, with a libero behind him in Zona Mista and Catenaccio.",
      { live: "roles" },
    ] },
    { id: "live-tactics", title: "Tactics In A Match", body: [
      "A side's tempo, time wasting, goal kicks and line all come from its style. During a live match, Tactics changes them for either side, from the next dead ball:",
      { dl: [
        ["Tempo", "Five steps. A quicker tempo means less time on the ball and firmer passes, and tires men faster."],
        ["Time Wasting", "Never, Sometimes or Constantly, only while ahead: slower restarts, at the risk of a booking."],
        ["GK Distribution", "Short or long goal kicks."],
        ["DL Style", "Drop Off, Step Up or Offside Trap: the line sits deeper or higher, and the trap steps up further still."],
      ] },
    ] },
  ] },
  { id: "ratings", title: "Ratings", sections: [
    { id: "player-ratings", title: "Player Ratings", body: [
      "A player's rating, his OVR, is a whole number from 25 to 99, set by the overseer. It is everything the engine knows about him. The badge it sits in is coloured by band:",
      { live: "metals" },
      "The engine works out his abilities from his rating and the line of the slot he stands in, when the slot is one of his own positions: pace, passing, shooting, tackling, positioning, strength, heading, reflexes and touch. The further forward the slot, the more of the rating goes into shooting and the less into tackling, so two 75-rated centre-backs are the same man until a trait sets one apart. Out of his positions he keeps his own position's abilities (see Positions). Tired legs slow everyone as a match goes on.",
    ] },
    { id: "positions", title: "Positions", body: [
      { live: "positions" },
      "Every player has one or two positions of his own, kept on his record, and plays both at his full rating. His page lights them, with the sides that play him there, and lists show them as CM or CM/DM.",
      "Anywhere else he keeps the skills of his own position, the nearer of his two: a striker at centre-back tackles like a striker, and a centre-back up front shoots like one. He is never better than the man who belongs there at anything, so it can only cost him. Team sheets, pitches and the eleven's rating show him at about the rating he plays the place at, ringed in red. A move within a line, a left back on the right or a central midfielder sitting deeper, costs little or nothing; a move between lines costs most:",
      { live: "posdrop" },
      "Keeping goal is apart: an outfielder who goes in goal plays it at half his rating, and a keeper played outfield plays on a keeper's skills and is shown at half his.",
      "Managers, tournaments and the Editor place men by their own positions: a formation change, a substitution, cover for an injury or a ban, and a signing all go to the place a man fits best. Positions are set by the overseer; an editor asks for a change by request (see Editing).",
    ] },
    { id: "traits", title: "Traits", body: [
      "A trait is what a player is known for: a habit in how he plays, and an edge in the one skill the habit needs. A trait does the same for everyone who has it, and a player without one plays exactly to his rating. Traits come in three tiers, gold, silver and bronze, by how much they are worth in a match.",
      { live: "traits" },
    ] },
    { id: "side-strength", title: "Side Strength", body: [
      "A side's rating is the average of its whole squad, bench included: sixteen men at a club, twenty-two for a national side. Play Match also shows the starting eleven's rating (XI OVR), the bench's, and the eleven's attack, midfield and defence, each man in the eleven counted at the rating he plays his place at. The scorebug and Full Time show the eleven's rating the same way, and it moves when a substitute comes on.",
      "A side's rating never enters a match. Every duel, pass and shot is settled by the men involved, so the eleven on the pitch and the men who come off the bench decide it. Home advantage changes how a side plays and how the referee sees it, never anyone's rating.",
    ] },
    { id: "afa-rankings", title: "AFA Rankings", body: [
      "The AFA Rankings place every Avium national side by the average rating of its squad of 22, once a year. A national side's page shows its place each year as a bar, and its current place with an arrow for the move since the year before. A year is added when it closes.",
    ] },
    { id: "match-ratings", title: "Match Ratings", body: [
      "Every player starts a match on 6.5 and finishes it between 3.0 and 10.0. Goals and assists move it most, and a goal that decides the match moves it further. Cards, penalties won, given away, saved or missed, errors that lead to a goal and big chances missed all count, and so does the routine work: passes, duels, dribbles, headers, tackles and blocks, with defending worth more the nearer it is to his own goal. A keeper is judged on the goals he kept out compared with an ordinary keeper facing the same shots.",
      "At full time every man is measured against an ordinary afternoon in his own position, so one scale serves them all. An ordinary full match is about 6.9 for anyone, 8.0 or better is a standout, and 10.0 is very rare. A man who played less than about two thirds of the match has his rating drawn back toward 6.5 in proportion, unless he was sent off. During a match the figure shown is the running total.",
      { live: "rating-colours" },
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
      "A player's value is worked out each time it is shown, from five things:",
      { dl: [
        ["Rating", "The steepest part: about $1.2M at 70, $12M at 80 and $150M at 93."],
        ["Age", "Full value from 24 to 27, falling from 28 to a few percent of it at 37. Keepers age two years later. A young player rated above 60 carries a premium, larger the younger and better he is."],
        ["Position", "Strikers are worth the most, then attacking midfielders and wingers, then midfielders, defenders and keepers."],
        ["Trend", "His net rating change over the last two seasons: a rise adds value and a fall takes it away."],
        ["League", "The strength of the league his club plays in. A man without a club counts as a middling league."],
      ] },
      "Values are shown to two figures ($8.5M, $450K). A Hall Of Fame player reads Retired.",
    ] },
    { id: "rating-changes", title: "How Ratings Change", body: [
      "Ratings move after each season, player by player, judged on how each man did against what was expected of him, and the overseer files the changes. Each is recorded with its season and the competition that brought it; a few batches belong to no competition, such as a general rebalance. Rating Changes, in Registry, lists every batch, and a player's History shows each change on the row of the competition that brought it.",
    ] },
    { id: "manager-ratings", title: "Manager Ratings", body: [
      "A manager's rating runs from 25 to 99, set by the overseer, and measures how well he reads the game. It has no effect at 40 and its full effect at 90, and a side with no rated manager plays as if its manager were 60. What he does with it is under Styles And Managers.",
      "His win rates count every match the archive credits him with, at clubs and with national sides kept apart. A shootout counts as a win or a loss.",
    ] },
  ] },
  { id: "tournaments", title: "Tournaments", sections: [
    { id: "saved", title: "Saved Tournaments", body: [
      "Tournaments are kept in this browser and saved by themselves a moment after every change. Saved lists them newest first, with the stage each has reached, its leader or winner and the matches played. Each row has Rename, Copy, Export and Delete, and New Tournament and Import are in the page bar. An exported tournament is a file another browser can import. A tournament copies its sides' squads when it is made, so later changes to a squad never reach it.",
    ] },
    { id: "formats", title: "Formats", body: [
      "New Tournament starts from a preset or from scratch. The presets are League, Cup, World Cup, Club World Cup, Nations League, Legacy UCL, Legacy WC and 1935 World Cup. Three fields come ready-made: the 1934 and 1935 World Cups, with their groups as drawn, and the 1934 Club World Shield.",
      { dl: [
        ["Structure", "Groups; Groups, Then Knockout; or Knockout."],
        ["Groups", "From 1 to 26, played as a round robin over the legs you choose, or Swiss, over up to one round fewer than a group's size."],
        ["Group Allocation", "As Drawn, Seed (snake order by rating), Random, By Hand or Draw."],
        ["Knockout", "Single or double elimination, with a third-place match, two legs with away goals, a reset match, and byes by ranking or by hand."],
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
    ] },
    { id: "tiebreakers", title: "Tiebreakers", body: [
      "Points come first. After them come the tiebreakers, in an order you drag to set: Goal Difference, Goals Scored, Head To Head (points, then goal difference, then goals between the sides level), Wins, Buchholz (Swiss only: the strength of the opponents faced) and By Hand. Sides level on everything rank by rating.",
      "With By Hand, sides level on everything get a swap button, and while such a pair sits across a qualification line the knockout waits: Proceed To Knockout reads Tiebreaker Needed.",
    ] },
    { id: "venues-rules", title: "Home Advantage And Rules", body: [
      { dl: [
        ["Home Advantage", "Off, First Listed, Weaker Side, Fewer Group Points or Host Side. Host Side plays at a set of host grounds, spread evenly over the matches. In a two-legged tie each leg's home side has it."],
        ["Injuries", "Whether players get injured, and miss matches for it."],
        ["Suspensions", "A red card bans a man for one to five matches, by the offence; every fifth yellow card bans him for one."],
        ["Tiredness", "Players carry tiredness from one match into the next. Tired men, and men on a long run of starts, are rested for fresher ones, except in a match that must be won."],
      ] },
    ] },
    { id: "playing", title: "Playing A Tournament", body: [
      "A running tournament has four pages: Overview (the stage, its fixtures and its leaders, and a summary once it is over), Fixtures, Player Stats and Rules, where the tiebreakers and home advantage can still change and Rebuild From The Results recounts the tables and player figures.",
      "Group matches open a round at a time; a knockout tie opens once both its sides are known. Each match has Sim, to play it out at once, Score, to type a result, and Live, to watch it in Play Match. A typed score is played out with scorers to match, and a level knockout score goes to extra time and then penalties. A played match can be edited or deleted; deleting a knockout result clears the rounds after it, and editing one clears them only if the winner changes.",
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
    { id: "editors", title: "Editors And The Overseer", body: [
      "Each editor keeps their own nation: its national side, its clubs and its leagues. Sign in with the GitHub account the overseer has listed for you, and the top bar gains the Editor section, Requests and the Cart. The overseer can change anything, and answers the requests editors send.",
      { dl: [
        ["Yours To Change", "A side's name and kits, its formation and who plays where; signing free agents and moving men between your own sides; calling men up to your national side; appointing and releasing managers; and a league's name, tier and cup."],
        ["By Request", "A side's ground, capacity and city, a club's code, one of your players' positions, and every new player, manager, club and league. The overseer answers these."],
        ["By Trade", "A man or manager at another nation's club, answered by that nation."],
        ["The Overseer's", "Every man's own record: his name, nationality, date of birth, rating and traits, shown locked; his positions too, which you may ask to change. A club plays its manager's style, so a new manager brings his with him."],
      ] },
    ] },
    { id: "cart", title: "The Cart", body: [
      "Nothing in the Editor is saved until the cart is. Each change goes into the Cart in the top bar, a block for each player, manager, side or league with every field it changes, old to new. Live on a block means saving puts it on the site; Request means it waits for an answer. Remove takes a block out, with Undo to put it back, and Empty Cart clears the lot after asking twice. The cart is kept in this browser until it is saved.",
      "Save checks the whole cart against the rules first and lists anything wrong at its foot. A cart with a problem saves nothing. Saved changes are on the site in a minute or two, and any requests in the cart are sent at the same time.",
    ] },
    { id: "requests", title: "Requests", body: [
      "Requests, in the top bar, lists what is waiting: For You, the requests you can answer, then Yours, the ones you sent. The Editor's Requests tab shows the same in full, with a third list, New Records, for the overseer. Each request shows its side, who asked and when, the men coming in and going out, and who it is waiting for, with a tick against each who has agreed.",
      { dl: [
        ["Accept, Decline", "Answer a request sent to you."],
        ["Withdraw", "Takes back one of yours before it is answered."],
        ["Dismiss", "Clears one of yours that was declined. It stays in Yours, with the note it was declined with, until you do."],
        ["Review", "The overseer's, on a new record: it opens in the Editor with every field open. Approve lets it in as it then stands, once every blank rating is set, and Reject sends it back with a note."],
      ] },
      "Decline, Withdraw and Dismiss each ask twice.",
    ] },
    { id: "teams", title: "Teams", body: [
      "Teams lists your sides down the left, the national side first and then your clubs by league, under New Team and a search. The overseer sees every side. The side picked fills the page. Its name and kits are edited in place, and Request A Change opens its ground, capacity and city, and a club's code, for Add To Cart to send to the overseer.",
      "The squad stands on a pitch in the side's formation, with the bench beside it. Drag a man onto another place to swap the two, or click one and then the other. A man out of his own positions shows the rating he would play the place at, ringed in red. A new formation moves every man to the place nearest his positions. Clicking a man brings up Release (Drop, on a national side) to let him go; if he started, the bench man who best fits his place moves up into it. The cross on a bench row does the same.",
      "Each bench place takes a man of its group, shown beside it: a club's five are a keeper, a defender, two midfielders and a forward, and a national side's eleven follow the groups of its starting eleven. Each man's own positions sit at the end of his row. Signings, trades and new players are sorted into the places their positions fit, as far as the bench allows, and a man left in another group's place is marked in red.",
      "Sign, beside the pitch (Call Up on a national side), searches every player and manager. A free agent, or a man from another of your clubs, comes straight in; a man at another nation's club reads Trade. A national side finds only its own nationals. Appoint brings in a manager, and the cross beside the manager releases him. A man named in a request that is still waiting cannot move, and is marked Waiting On A Request.",
    ] },
    { id: "trades", title: "Trades", body: [
      "A man or manager at another nation's club comes by trade. Trade, on his row in the search, opens the trade beside the pitch with him Coming In. Click your own men on the pitch or the bench to send them the other way as Going Out, for an exchange, then Add To Cart. Saving sends it to that nation's editors, or to the overseer where it has none.",
      "Any one of them can accept or decline it, and it goes through whole or not at all. Until it is answered, only the men in it are held. Accepting checks again that it still fits both squads. Trades are between clubs; a national side calls up its own nationals instead.",
    ] },
    { id: "players-managers", title: "Players And Managers", body: [
      "Players lists your nation's men and everyone at your sides, and Managers the same for managers, each under New Player or New Manager and a search. Edit Player on a player's page, and Edit Club or Edit Team on your own side's page, open that record here.",
      "A player's page shows his record, his positions among it, and his sides. Request A Change beside his positions sends new ones to the overseer. Release lets him go from your club, Move To or Sign For puts him at another of your clubs, and Call Up and Drop take him on and off your national side. A manager's page has Release and Appoint To; one at another nation's club comes by trade. The overseer can also change a man's record here, and retire a player.",
    ] },
    { id: "leagues", title: "Leagues", body: [
      "Leagues lists your nation's leagues by tier, with each one's number of clubs. A league's name, tier and cup sit at the top of its page, yours to change without a request: a tier from 1 to 5, or none, and a cup from your nation's, none, or a new one named there. Two leagues can share a tier, for regional divisions. Below come the league's clubs, each opening on Teams, the nation's pyramid tier by tier, and its cups with the leagues that enter each.",
      "A renamed league keeps its old names, so its past seasons, its badge and the clubs in saved tournaments still find it.",
    ] },
    { id: "new-records", title: "New Players, Managers And Clubs", body: [
      "New Player, New Manager and New Team, at the top of each list, make a request to the overseer, who may change anything in it before letting it in. The overseer's own go in when the cart is saved.",
      { dl: [
        ["New Player", "Name, nationality, date of birth, his position and a second if he has one, the side he joins (one of yours, or none), and a rating."],
        ["New Manager", "Name, nationality, date of birth, style and a rating."],
        ["New Team", "A club in one of your nation's leagues: name, code, kits, ground and capacity, a city from the map, league, formation and manager, and a squad of sixteen from free agents and your own players."],
      ] },
      "An editor makes men of their own nation only. Beside a date of birth, Or Age picks a random date that gives that age in the world's own time, and the die picks another. A rating can be proposed or left blank, and the overseer sets every blank one before letting the man in.",
    ] },
    { id: "many", title: "Many Players At Once", body: [
      "Many, at the top of New Player, sends a whole list as one request. Type or paste the players a line each, as a name, a comma and a position code, with a second position after another comma if he has one: Kenji MORISHITA, GK or Shohei KUWABARA, CB, RB. The codes are the ones in Positions, under Ratings. A tab does for the comma, so two columns copied from a spreadsheet work as they are. The list is sorted keepers first and on up the pitch.",
      "One nationality covers them all, and each man gets a random date of birth for an age in the range you set, 18 to 32 to start; the die draws them all again. Ratings start blank and can be typed into the table. A line that cannot be read is named under the box, and the list cannot be sent until it is fixed. The list joins one of your sides with room for every man on it, or none, and holds up to forty men.",
      "Import, on a squad in New League, takes the same lines into that squad, each man to the open place that fits him best. Its Add stays off while there are more men than open places.",
    ] },
    { id: "new-leagues", title: "New Leagues", body: [
      "New League asks for a league and its founding clubs, in three columns. The first holds the league (its name, tier, and a cup picked or named new) and its founding clubs, each ticked once it is ready, with Add Club for another. The second is the club open: name, code, kits, ground and capacity, city, formation, and a manager who is free or made new there. The third is that club's squad.",
      "Fill a squad with free agents and your own men from the search, make a man with New Player, or paste a list with Import (see Many Players At Once). Each club needs its eleven starters, and the bench can wait. A new man reopens from the pencil on his row, and two places swap by dragging one onto the other or clicking one and then the other.",
      "Roll Ratings, on the squad, rates the new men for you. Give it the team rating you want and Roll rates every new man left blank, or rolled before, so the squad averages it: the starters a little above it, and each bench man below the starter in his position. Ratings you typed, and men already on file, stay as they are.",
      "A league made here is listed among the leagues from its first club; an older one needs six. An editor whose nation has no leagues yet starts here, as the Leagues tab opens on New League.",
    ] },
    { id: "kept-forms", title: "Unfinished Forms", body: [
      "A New form you are filling in is kept in this browser until you send it or press Cancel, one for each tab. Going to another tab, picking a record from the list or reloading the page puts it aside, and New brings it back as you left it. A request the overseer is reviewing is not kept; it opens again from Requests.",
    ] },
    { id: "images", title: "Badges And Portraits", body: [
      "Images are not uploaded in the app: send them as a zip to @auroruse on Discord. A badge, for a club or a league, is 500 by 500 pixels with 50 pixels of padding on every side and a 25 pixel white outline. A portrait is a chest-up headshot, the subject in a plain white shirt.",
    ] },
  ] },
];

// What each trait does to how a man plays (src/engine/config.ts ME_BADGES), for the Traits table. Its name and tier are
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
  trickster: "Takes men on: feints, cuts and the knock past a man.",
  vision: "Reads the game better with time and options, takes the ball already knowing the next pass, and finds a runner early.",
  incisive: "Plays the ball into a runner's path and over the top, away from his marker.",
  disciplined: "Stays on his feet and picks his moment: his tackles are clean and he gives away fewer fouls.",
  longshot: "Shoots from distance whenever he has room.",
  firsttouch: "Wants the ball under pressure: team-mates find him even when he is marked, and his touch is cleaner.",
  crosser: "Crosses early, and from deep.",
  tikitaka: "Keeps it short and simple, into the receiver's stronger foot, and takes it already knowing the next one.",
  deadball: "Takes the corners, free kicks and penalties, and strikes them better.",
  composed: "Pressure does not hurry him: he keeps playing forward, strikes it clean and never panics it away.",
  commanding: "Comes off his line for balls in behind and for crosses.",
  tackler: "Dives in, early and often, and gives away fouls for it.",
  longball: "Goes long with switches and diagonals, dropped onto the receiver's foot.",
  shotstopper: "Stays on his line, and on it his reflexes are sharper.",
};

// The positions in the order the Positions table lists them.
export const POS_NAME = {
  GK: "Goalkeeper", LB: "Left Back", CB: "Centre Back", RB: "Right Back", LWB: "Left Wing Back", RWB: "Right Wing Back",
  DM: "Defensive Midfielder", CM: "Central Midfielder", AM: "Attacking Midfielder", LM: "Left Midfielder", RM: "Right Midfielder",
  LW: "Left Winger", RW: "Right Winger", ST: "Striker",
};
