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
        ["Settings", "The gear: the colour theme, the Arterra switch, and this Documentation. With Arterra off, the app shows Avium only: no world switches, and no Arterra sides, players or managers in any list, search or picker. It is saved in your browser and changes nothing for anyone else. The overseer's also has Viewer Mode, which shows the app as someone signed out sees it."],
        ["Sign In", "With a GitHub account, for the ACU's editors. Reading needs no account. See Editing."],
        ["Requests And Cart", "An editor's: what is waiting on an answer, and the changes not yet saved. See Editing."],
        ["Play Match", "The match screen. See Matches."],
      ] },
    ] },
    { id: "registry", title: "Registry", body: [
      "Registry is the record of who exists today: every nation, club, player and manager. Its pages are Overview, Teams, Players, Managers and Rating Changes. Overview has five panels.",
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
      "A club has two pages. Overview runs left to right: the club's profile (its crest, kits, ground, manager, strength by line, and its squad's age and value); its squad, as a list of every man with his age, value, traits and season's figures, the bench's open places shown, or on a pitch in the club's formation with the bench beside it; its season and its honours; and every result of the current season in every competition.",
      "History is a row a season, newest first: the division, the finish, the record, the cup and continental runs, titles in gold and the manager. Every honour sits beside it, by competition, with the years it was won.",
      "A national side has the same two pages. Its squad shows each man's club and the year's international figures, and its latest tournament stands where a club's season is. Its History has columns for the World Cup, its qualifying, the Nations League and its AFA ranking that year.",
    ] },
    { id: "players", title: "Players", body: [
      "Players searches every player in the world picked. Filter by name, position, nationality, competition, club and age; the club filter also holds Free Agents and the Hall Of Fame. The table has three views: Overview, Season (one year in every competition) and Career. Click a column head to sort by it.",
      "Clicking a row puts the player's card on the right. His name, or View Player on the card, opens his page, and the arrow keys move through the rows.",
      "A player's page opens on a banner in his club's colours with his crests, rating, positions, age and value. Under it come Positions (his own positions lit, each with the sides that play him there, a place a side plays him out of position in red with a line under the pitch for that side, and the role each side's style gives him), Traits, Season Stats for the season picked, Performance (his career per game against the average career at his position), Career (a row a spell at a side, with one total) and Honours. His History lists every competition season he played, with his figures and the rating change each one brought.",
    ] },
    { id: "managers", title: "Managers", body: [
      "Managers works like Players. Filter by name, style, seat (clubs, national sides, both, or free agents) and nationality, with the manager's card on the right. Win rates at clubs and with national sides are kept apart. A rate from fewer than ten matches is grey and sorts below the rest.",
      "A manager's page has his banner (style, rating, both win rates, age), then Tactics, his side on a pitch with the role he gives each man; Sides, each side's record this season; and Results. His History has his Career, a row a side, the Competitions he managed in, and his Honours. A free agent's page is his banner over his history.",
    ] },
    { id: "teams", title: "Teams", body: [
      "Teams lists every club, or every national side by the switch in its title, with its nation and league (a national side's conference), its rating, its eleven's attack, midfield and defence, its bench, its city, its style and formation, and its squad's value. Filter by name, nation and league, or conference; click a heading to sort. Click a side for its card on the right; double-click it, or click the card's banner, to open it.",
      "The card has the side's crest on its colours fading into its ground, its rating, style, formation and squad value, and its manager; then its strength by line, its best players and its honours.",
    ] },
    { id: "trades", title: "Trades", body: [
      "Trades is every move of a man the registry has made, season by season: trades between nations' clubs, free agent signings, releases, moves between one nation's own clubs and managers changing club. A season runs from one World Cup to the next. Each deal shows the real date it was made and its kind, every man in it with his rating, age and value when he moved, the clubs he left and joined, and each club's value in and out. Clubs, on the right, lists who bought and who sold that season; picking one shows only its deals.",
    ] },
    { id: "rating-changes", title: "Rating Changes", body: [
      "Rating Changes lists every ratings refresh on file. Batches, down the left, lists each refresh, newest first, with its rises and falls. Changes, in the middle, lists the picked batch a player a row, searchable and filtered by side or by rises and falls. Sides, on the right, gives each side's net change; picking a side filters Changes to it, and picking it again clears it.",
    ] },
    { id: "competitions", title: "Competitions", body: [
      "Competitions is the archive: every competition on file and every season of each. Overview lists them with their seasons on file, the holder and the side with the most titles. Years shows every competition that finished in a year. Head To Head sets two clubs or two national sides against each other: their record, every meeting, and every season they played in the same competition.",
      "A competition has three pages. Overview is its Roll Of Honour and its Titles. Season shows one season: its table, or its groups and knockouts, the results round by round, a summary of the champion, the runner-up and the season's best players, and Player Stats. A league's final table marks the champion and the places that went up, into a playoff and down, with an arrow by each club that went; the newest season marks who its rules send before anyone moves. Records holds the all-time table, the team records and, from 1931/32, the player records.",
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
      "Full Time puts the whole match on one page, made to be screenshotted. The result sits in big type over the whole of the ground's photograph, uncropped. Down the middle come the theme's competition mark, drawn large over a tournament's fixture, then the competition and round, the score level with the names, FULL TIME level with the managers, Pens, AET or Agg where they apply, and the ground. Each side has its code, its eleven's rating, its shape, and its manager with his style. Below come the timeline of cards, injuries and missed or saved penalties; both team sheets, with every man's figures and the minute each substitute came on or went off; the momentum chart, with the minute of every goal, over possession and seventeen more numbers; and every goal along the bottom, replayed on hover. The match's top player has a star by his name.",
      "Copy Image, or Command-C (Ctrl-C) with nothing selected, puts the page on the clipboard as a 1920 by 1310 picture, ready to paste into Discord. A friendly then offers New and Replay, and a tournament's fixture Import, Replay and Abandon.",
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
      "A shot's expected goals are set as it is struck: the distance and the angle, the shooter's finishing, the pressure on him, the bodies in the way, his run-up and where the keeper really stands. A header is worth about three-fifths as much, and a penalty about three in four. Better finishers aim nearer the post, and every strike carries some error.",
      "A man does not shoot into a defender a stride in front of him, or at a keeper who covers the goal from where he stands; he looks for another way. With the goal packed in front of him, he has a go from the edge of the area, through a body or two if he can see the goal. A cross, a corner or a free kick swung into the box is attacked in the air and headed at goal.",
      "The keeper reacts to the shot as it comes. Better keepers react sooner, and bodies in front of him slow him down. Close in, he saves only what he already covers standing. A slow ball is always held; otherwise he catches more easily the nearer it is to him, the slower it is and the fewer men are in front of him. Anything he does not hold is a parry still in play. He may not handle a deliberate back-pass.",
      "A shot or a cross that comes off a defender in his own area carries on the way a ball comes off a body, now and then into his own net. A deflected shot is the shooter's goal if it was on target and an own goal if it was going wide, and a cross or a pass a defender turns in is an own goal.",
    ] },
    { id: "set-pieces", title: "Set Pieces", body: [
      "The restarts are kick-offs, goal kicks, corners, throw-ins, free kicks and penalties. Each is taken once the men who matter are in place, never later than a set time. The best shooter takes the penalties, the keeper the goal kicks, the side's specialist the corners and the free kicks near goal, a strong man the long throws, and the nearest man the rest. Free kicks far out, goal kicks and throws are played quickly to a free man when there is one.",
      "A free kick within about 27 metres of the goal, from where enough of the goal can be seen, is shot over a wall; from out wide it is crossed in. Corners use three routines, the centre-backs go up, and the ball favours the best headers; one down at the end, the keeper goes up too. A penalty goes to a random corner and the keeper guesses, better keepers guessing right more often. Offside is judged at the moment of the pass and called when the offside man plays the ball.",
    ] },
    { id: "discipline", title: "Fouls, Cards And Injuries", body: [
      "Fouls come from challenges: a mistimed tackle, a hold, or a foul on purpose to stop a break. There is no advantage, and a foul in the box is a penalty, so defenders go into challenges there far more carefully. Denying a clear chance is usually a red outside the box and a yellow inside it; stopping a promising attack is a yellow; any other foul is judged on the pace of the challenge and the danger. Two yellows make a red. Time wasting can be booked, and now and then a man is sent off for violent conduct or abuse away from the ball. A handball in the box is a penalty, and a red if it stopped a shot.",
      "Injuries come only from fouls, more often at pace. Most are knocks that slow a man for a few minutes; the rest end his match, with a body part and a severity that can keep him out for anything up to a season.",
      "After a red card a side gives up its most advanced position, and its manager turns cautious unless he is behind. A sent-off keeper is replaced by the reserve keeper, at the cost of the weakest outfielder; with no keeper left, the deepest outfielder goes in goal at half his rating.",
    ] },
    { id: "stamina", title: "Stamina And Substitutions", body: [
      "Every man starts fresh, and his stamina drains with every metre he runs, faster while his side presses and at a quicker tempo. A man presses only as hard as his legs allow: the extra cost of pressing falls away as he tires, and once he is tired he stops chasing the ball just because he was told to, so a pressing side eases off in the last half hour. Nobody recovers during a match, and a tired man loses pace and touch.",
      "A side has five substitutions when its bench has eleven places, named or not, and three with a smaller one, made at a dead ball. The managers make them for both sides, in a live match too: an injured man at once (a keeper only for a keeper); before the hour only a man who is spent, from the hour the tired ones, a better manager a few minutes sooner. Chasing late, a manager freshens his forwards first and sends on the most attacking man who can play the place; holding a lead, the men at the back and the most defensive. Like the law, a side makes its changes at no more than three stoppages, half time not counted. The man who comes on takes the slot of the man he replaces and always plays it at no cost by his own positions, the best of those who can; if nobody on the bench can, the tired man stays on. Only an injured man is replaced out of position, by whoever plays the place best. In a live match you can make them yourself from Subs.",
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
        ["Substitutions", "Made at a dead ball: injuries at once, a spent man before the hour and tired men after it, fresh legs up front when chasing and at the back when protecting, always by a man who plays the place at no cost, at three stoppages at most besides half time."],
      ] },
    ] },
    { id: "formations", title: "Formations", body: [
      "A formation is a set of slots, and whoever stands in a slot plays its role, on his own position's skills if the slot is not one of his positions (see Positions). Without the ball a side drops into the shape its formation becomes:",
      { live: "formations" },
      "Changing a side's formation moves every man to the slot nearest his own positions. A manager who changes shape in a match only moves to a neighbouring one, and keeps his men in their own positions where the shape allows.",
    ] },
    { id: "roles", title: "Roles", body: [
      "Every man is given a role from his side's style, his slot and the side of the pitch the slot is on. A role decides where he stands in each phase, the runs he makes, how much he stays back, how readily he presses and tackles, and how much risk he takes with the ball. Where two men share a role, such as two defensive midfielders or two strikers, the better-rated takes the leading part, and team-mates look for him a little more. When the ball goes wide in the last third the striker is already on their last line, so the runs into the box come mostly from midfield. Roles are dealt again after a substitution, a red card, or a change of style or formation.",
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
    { id: "college-players", title: "College Players", body: [
      "The All-Nichirin Collegiate Championship is Nichirin's third tier: thirty-two college sides in four conferences. A player at a college shows no rating, value or traits, and no rating changes, to anyone but the overseer. Everyone sees his name, positions, age, college, year and figures, his match ratings included. A college side's own rating, its lines and its squad's value still show, and the moment a man leaves a college he shows like anyone else.",
      "A college course runs four years, First Year to Final Year. A player's year stands on his page where a value would, and beside his name on the Sheet.",
    ] },
    { id: "positions", title: "Positions", body: [
      { live: "positions" },
      "Every player has one or two positions of his own, kept on his record, and plays both at his full rating. His page lights them, with the sides that play him there, and lists show them as CM or CM/DM.",
      "Anywhere else he keeps the skills of his own position, whichever of his two costs him less there: a striker at centre-back tackles like a striker, and a centre-back up front shoots like one. He is never better than the man who belongs there at anything, so it can only cost him. Team sheets, pitches and the eleven's rating show him at about the rating he plays the place at. Where the place costs him he is out of position: on a pitch his rating is ringed in red, with what the place costs him over it and a red warning triangle over his place, and in a list the triangle and the cost follow his place. Hovering either opens a card with his own positions, where he is playing and what he plays it as. A move that costs nothing is not flagged. A move within a line, a left back on the right or a central midfielder sitting deeper, costs little or nothing; a move between lines costs most:",
      { live: "posdrop" },
      "Keeping goal is apart: an outfielder who goes in goal plays it at half his rating, and a keeper played outfield plays on a keeper's skills and is shown at half his.",
      "Managers, tournaments and the Editor place men by their own positions: a formation change, a substitution, cover for an injury or a ban, and a signing all go to the place a man fits best. Positions are set by the overseer; an editor asks for a change by request (see Editing).",
    ] },
    { id: "traits", title: "Traits", body: [
      "A trait is what a player is known for: a habit in how he plays, and an edge in the one skill the habit needs. A trait does the same for everyone who has it, and a player without one plays exactly to his rating. Traits come in three tiers, gold, silver and bronze, by how much they are worth in a match.",
      "A trait costs its pips: a gold three points, a silver two, a bronze one. A player's rating gives him a budget to spend on any tiers: two points at 75 to 79, three at 80 to 84, four at 85 to 89 and six from 90, in at most two traits below 90 and three from 90. Nobody under 75 carries any. So players of one rating come in different shapes: at 80 to 84 a single gold, or a silver and a bronze. A keeper carries Shot Stopper or Commanding, and from 80 one of Long Ball, Short Passing or Composed. A trait usually belongs to a player's position, though about one in four crosses into another, and players of the same position and rating are spread across many traits rather than sharing one. Inside a tier every trait is held by about as many players as every other.",
      "Hovering a trait anywhere in the app shows its card: its name, its tier and what it does.",
      { live: "traits" },
    ] },
    { id: "side-strength", title: "Side Strength", body: [
      "A side's rating is the average of the men in its squad, bench included. Every side has twenty-two places, eleven and a bench of eleven, and a club's open places count for nothing until a man fills them. Play Match's Strength Comparison shows the eleven's attack, midfield and defence, each man counted at the rating he plays his place at, and the bench's rating; Teams shows the same for every side. The scorebug and Full Time show the eleven's rating the same way, and it moves when a substitute comes on.",
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
      "Each editor keeps their own nation: its national side, its clubs and its leagues. An editor may also be given another nation's clubs and leagues without its national side. Sign in with the GitHub account the overseer has listed for you, and the top bar gains the Editor section, Requests and the Cart. The Editor has three pages: the Sheet, Trades and Requests. Edit Player on a player's page, and Edit Club or Edit Team on a side's page, open the sheet at that man or that side. The overseer can change anything, and answers the requests editors send.",
      { dl: [
        ["Yours To Change", "A side's name, kits, time wasting and formation, and who plays where; men and managers moved between your own sides, free agents signed and men released; your national side's call-ups; and a league's name, tier and cup."],
        ["By Request", "A side's ground, capacity and city, a club's code, one of your players' positions, and every new player, manager, club and league. The overseer answers these."],
        ["On Trades", "Any move between clubs can also be made on Trades, which shows every man's value. A move to or from another nation's club is made only there, as an offer that nation accepts."],
        ["The Overseer's", "Every man's own record: his name, nationality, date of birth, rating and traits, shown locked; his positions too, which you may ask to change. A club plays its manager's style, so a new manager brings his with him."],
      ] },
    ] },
    { id: "cart", title: "The Cart", body: [
      "Nothing in the Editor is saved until the cart is. Each change goes into the Cart in the top bar, a block for each player, manager, side or league with every field it changes, old to new. Live on a block means saving puts it on the site; Request means it waits for an answer. Remove takes a block out, with Undo to put it back, and Empty Cart clears the lot after asking twice. The cart is kept in this browser until it is saved.",
      "Save checks the whole cart against the rules first and lists anything wrong at its foot. A cart with a problem saves nothing. Saved changes are on the site in a minute or two, and any requests in the cart are sent at the same time.",
      "Deals never go into the cart: they are sent from Trades, and take the cart's changes to their clubs with them.",
    ] },
    { id: "requests", title: "Requests", body: [
      "Requests, in the top bar, lists what is waiting: For You, the requests you can answer, then Yours, the ones you sent. The Editor's Requests tab shows the same in full, with a third list, New Records, for the overseer. Each request shows its side, who asked and when, the men coming in and going out, and who it is waiting for, with a tick against each who has agreed. Offers from Trades show in the top bar too, each with Open, which takes you to it on Trades; the Requests tab leaves them to Trades.",
      { dl: [
        ["Accept, Decline", "Answer a request sent to you."],
        ["Withdraw", "Takes back one of yours before it is answered."],
        ["Dismiss", "Clears one of yours that was declined. It stays in Yours, with the note it was declined with, until you do."],
        ["Review", "The overseer's, on a new record: it opens in the Editor with every field open. Approve lets it in as it then stands, once every blank rating is set, and Reject sends it back with a note."],
      ] },
      "Decline, Withdraw and Dismiss each ask twice.",
    ] },
    { id: "sheet", title: "The Sheet", body: [
      "The Sheet is the registry as a spreadsheet. Each nation has a tab along the foot, yours first and then every nation with clubs; the rest are under All Nations, and Arterra's national sides share the ARTERRA tab while Arterra is on. Every tab can be read, and another nation's is locked. A tab is one table: the national side first, then the clubs league by league, each league under a strip with its badge and name. Clubs stand best first, sorted when the tab opens, so a row stays put while you work on it.",
      "The badge, code and name stay in place while the rest scrolls: OVR, XI, Bench and Value, worked out as men move; formation and time wasting; the manager; home and away kits; city, ground and capacity; and then the places, twenty-two for every side, eleven and a bench of eleven. Each place starts with its position in the side's formation, and on the bench its group, keeper, defenders, midfielders and forwards in that order. A man is a chip with his rating, his name, and his nation's code when he is not the tab's. One out of position, a substitute in another group's place too, shows the rating he plays the place at, ringed in red, with what it costs him. A manager's chip carries his style.",
      "One click opens any cell you can change: a list for formation and time wasting, a colour picker for a kit, a search for the city, a box for the rest. Enter or Tab keeps the change and Escape drops it. The arrow keys and Tab move around the sheet, typing on a cell starts on it, Enter on a chip opens his record, and Delete releases a man or sacks a manager. The bar over the grid shows the picked cell in full.",
      "A changed cell stays marked until the cart is saved, and an editor's change to a code, ground, capacity or city shows Requested until the overseer answers. Undo and Redo, beside the bar, or Ctrl+Z and Ctrl+Y, step back and forward through your changes.",
      { dl: [
        ["Sort And Filter", "A column's name sorts every league by it, and its funnel keeps only the values you tick."],
        ["Find", "Looks across every tab for a player, a manager or a side, and takes you to his cell."],
        ["Fullscreen", "Lays the sheet and the dock over the whole screen. Escape brings it back."],
      ] },
    ] },
    { id: "moving-men", title: "Moving Men", body: [
      "Drag a chip onto a place. Onto a man, the two change places, wherever each came from: two of your clubs, or the eleven and the bench. Onto an open place, he moves there. A club's man dragged onto his national side is called up and stays at his club; dropped onto a man already there, that man leaves the squad. Managers move the same way between your sides. A starting place can't be left empty, and a man in an offer or request that is still waiting carries a lock and can't move. A move to another nation's club is made on Trades.",
      "The dock, beside the sheet, has four panels:",
      { dl: [
        ["Record", "The chip you clicked: his details, the sides he plays for, his traits and his value. Sub Out on a starter and Sub In on a substitute list the men he can change places with. Trade opens Trades with him in a deal; on another nation's man it reads Make An Offer. The overseer edits the record here and can retire a player."],
        ["Lineup", "The picked side on a pitch, with its bench under it and its formation at the top. Drag men around it, or between it and the sheet. Clicking a side's badge opens it here."],
        ["Free Agents", "Every player and manager without a club, best first, on two tabs, Players and Managers, each with a search; a man who plays only for his national side is one. They are Avium's, or Arterra's on the Arterra tab. Drag one onto an open place to sign him, or onto a man to sign him in that man's place. Drag a man from the sheet onto this panel to release him, or a manager to sack him. New Player and New Manager are at the top, and new men in the cart without a side show first in the list."],
        ["Nationals", "With a national side picked: its men not called up, best first. Drag one up into the squad."],
      ] },
    ] },
    { id: "new-records", title: "New Players, Managers, Clubs And Leagues", body: [
      "New Player, at the top of Free Agents, opens the form on the dock: name, nationality, date of birth (or an age, which draws a date for it, and the die another), position and second position, the side he joins if any, rating and traits. Add To Cart puts him in the cart, and Cancel throws the form away. A form left for something else is kept in this browser, and New Player brings it back. The + in an open place opens the same form for that place. New Manager, and the + in an empty manager cell, do the same for a manager, with his style in place of positions; one made for a side takes it over when he is let in.",
      "Typing into an open place is quicker: a man a line, as (86) Kenji MORISHITA, ST, 24, Finisher, Composed: his rating in brackets, his name, his position (a second after another comma), his age and up to three traits by name. Only the name is needed: a man with no position plays the place's, one with no age gets one drawn, and a college's man starts in the year his age gives. A surname typed in lower case is put in capitals. Paste several lines to make one in each open place from there on, or a row copied from a sheet, a man a cell as the registry writes him, (76) Cihan KARTACA [SEL], with his nation in brackets when it is not the side's: the men go to the places one after another, an empty cell leaves its place as it is, and a cell holding only a position gives it to the man before it. A man without a rating stays blank, and one without an age starts with a date of birth for an age from 18 to 32 (18 to 21 at a college): Roll Ratings and Roll Ages, below, change them a side at a time. A manager's name typed into an empty manager cell makes him the same way. A new man's chip, typed or made with the form, opens him in the form, where Done keeps a change and Remove takes him out.",
      "Many, at the top of the New Player form, opens a list across the page for a whole squad or a group of free agents: a line a man as above, one nationality unless a line tags his own, an age range for the lines without an age, and each man rated in the table if his line has no rating. A free agent's line needs his position; a man joining a side plays the place he takes. It goes to the overseer as one request, and its men show in the places they will take, or at the top of Free Agents.",
      "+ New Club, at the foot of each league, adds a row to fill in place: name, code, kits, city, ground and capacity, formation and time wasting. Its men come from Free Agents and your own clubs, or are made in its places; its manager comes from Free Agents or the + in its manager cell. It needs its eleven starters, and the bench can wait. New League, under the last league, adds a strip for the league's name, tier and cup, with + New Club for its founding clubs.",
      { dl: [
        ["Roll Ratings", "In the menu on a side's row number, wherever it has new men: a new club's, or the new men in the cart in one of your sides. Give it a team rating and it rates every new man left blank, or rolled before, so the side averages it: the starters about a point above it and each bench man below the starter at his position. Ratings you typed, and men already on file, stay as they are."],
        ["Roll Ages", "Beside it. Give it an age range, 18 to 32 to start, and every new man there gets a new date of birth for an age in it. A date set by hand on his form stays."],
        ["Remove", "In a new club's menu: takes it out of the cart, with its men made there."],
      ] },
      "Everything new is sent when the cart is saved. For an editor each new man, each new club with its men, and each new league with its clubs is one request, which the overseer may change before letting it in; the overseer's own go in at once. A rating can be left blank for the overseer to set, and a new player's traits are those his rating affords. A new player can be of any nation, but one from outside your own needs a rating below that nation's level, its national side's rating, which the Rating box shows. New managers are of your own nation.",
    ] },
    { id: "leagues", title: "Leagues", body: [
      "A league's name, on its strip, opens it on the dock: its name, tier and cup are yours to change without a request. Two leagues can share a tier, for regional divisions. The overseer also sees how many places go up and down, and moves a club into another league by dragging its row number onto that league's strip.",
      "The overseer removes a club from its row number's menu: Remove Club, then Confirm Remove. When the cart is saved the club leaves the records, its men and manager become free agents, and its seasons stay in the archive. A club named in a waiting offer or request, or holding a man who is, can't be removed.",
      "A renamed league keeps its old names, so its past seasons, its badge and the clubs in saved tournaments still find it.",
      "A league split into conferences, as the collegiate championship is, lists them on its dock with their clubs, and its editor renames them there.",
    ] },
    { id: "trades", title: "Trades", body: [
      "Trades is where men change clubs: signings, releases, moves between your own clubs and swaps with other nations' clubs, managers as well as players, between as many clubs as you like. Down the left are your offers: Your Move, the ones waiting on you; Waiting, yours and the ones you have accepted that still wait on others; and Declined. New Deal starts another.",
      "Your club stands on the left. Add, on the right, brings in another club, or Free Agents to sign from; each gets a tab, and the cross on a tab takes it out. Click a man to put him in the deal: with one other club he goes to it, and with more the click asks where he goes, to a club or to free agency. Click him again to take him out. Each club counts its places as the deal stands, and one that would hold too many asks who makes way, with Release beside each of its men; the deal cannot go until every squad fits. A man coming in takes the place of a man leaving, but a keeper's place only ever goes to a keeper, and a starting place left empty is filled from the bench.",
      "Each player shows his transfer value where he stands now. The Deal lists what each club gets and gives, with the value coming in and going out, and where each man coming in will play. A deal between your own clubs, or with free agents, goes live with Confirm. One with another nation's club is an offer: Send Offer sends it to that nation's editors, or to the overseer where it has none. The overseer has Apply Now as well, to put it straight in.",
      "Every club in an offer accepts the same version. Accept, Decline (with a note) or Counter answer it: a counter changes the deal from your side and sends it back to every other club to accept again. Withdraw takes back one of yours. Until it is settled only the men in it are held, and each accept checks again that it still fits.",
      "Sending or accepting a deal also saves the cart's changes to its clubs, so nothing you arranged is lost. National sides are not traded: they call up their own nationals in the sheet (see Moving Men).",
    ] },
    { id: "college-draft", title: "The College Draft", body: [
      "After each NL season the final-year college players are drafted in one round of 44 picks, NL2's last club picking first and NL1's champion last, except where a pick has been traded. Its board is the Draft page in the Editor, which the overseer and every editor holding a pick see.",
      { dl: [
        ["On The Clock", "A pick has two hours. When one of your clubs is on the clock the Draft tab carries a dot, and every man still on the board has a Draft button; Draft asks to confirm. With no open place in your squad, you name who makes way, and he leaves for free agency."],
        ["Automatic Picks", "A club whose two hours run out gets the best season match rating left, among the men with a sixth of the most minutes first. That is the list's order."],
        ["The Board", "Each pick shows the club holding it and, once made, the man, his position and his college. The list under it is every final-year player left, with his season's figures; his rating stays hidden until he is drafted."],
        ["Afterwards", "Every final-year player nobody took goes to free agency, and any club can sign him through the usual save, first come first served. The draft is then filed under the Championship, and each man's page shows his pick."],
      ] },
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
