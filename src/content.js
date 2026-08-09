// Terre Bonne — all the writing lives here.
//
// Ground rules the document sets and this file keeps:
//  · Nearly every artifact is a pair — the plaque the county wrote, and the
//    document underneath it. Reading the plaque warms the light. Reading the
//    record cools it. You can read both. You cannot hold both.
//  · The enslaved are never the monster, never a jump scare, never a ghost that
//    menaces the player. The ledger names below are fictional composites.
//  · Elizabeth, Samuel, Ann and Edward Bellamy existed. What the record supports
//    is depicted; past that line it is fiction and says so.

export const MEMORIES = [
  {
    soft: 'Junie laughed like a screen door. That is how he tells it, and it is close enough that nobody has ever corrected him.',
    true: 'She laughed with her mouth closed, mostly. A short sound through the nose, and then she would look at you to see if you had caught it. He has been remembering somebody else\'s laugh for eight months.',
  },
  {
    soft: 'She loved the water. She said the Chattahoochee smelled like the inside of a church.',
    true: 'She hated the water. She went because he wanted to go, and she sat in the truck with the door open and her feet on the running board and waited for him to be done.',
  },
  {
    soft: 'At the end she was not frightened. Everyone said so. The hospice nurse said so.',
    true: 'She was frightened for eleven days and she asked him twice, out loud, whether he thought anybody would be there. He said yes both times. He did not think so either time.',
  },
  {
    soft: 'The last thing he said to her was that he loved her.',
    true: 'The last thing he said to her was "I\'ll be right back, I\'m going to move the truck." He was gone nine minutes. He has told the other version so many times that it took a swamp at two in the morning to get the real one back.',
  },
];

// Ray, out loud, to a recorder, because there is nobody else to say it to.
export const LINES = {
  gate1: [
    ['RAY', 'Recorder\'s on. It\'s… two in the morning, Bellamy Bridge trail, Jackson County.'],
    ['RAY', 'I\'m not expecting anything. I want that on the tape.'],
  ],
  laugh1: [
    ['RAY', 'Barred owl.'],
    ['RAY', 'They do that. They sound just like a person. That\'s an owl.'],
  ],
  laugh2: [
    ['RAY', '…'],
    ['RAY', 'Okay.'],
  ],
  boardwalk: [
    ['RAY', 'Somebody left something behind the sign.'],
  ],
  firstWarm: [
    ['RAY', 'Light\'s gone funny. Battery, probably.'],
  ],
  firstCold: [
    ['RAY', 'That\'s better. That\'s — I can see less and I like it more. That\'s a hell of a thing.'],
  ],
  fork: [
    ['RAY', 'That path isn\'t on the map.'],
    ['RAY', 'I\'m looking at the map. It isn\'t on the map.'],
  ],
  grove: [
    ['RAY', 'Elizabeth Jane Croom Bellamy. Eighteen years old.'],
    ['RAY', 'There\'s a little one next to her.'],
  ],
  grave2: [
    ['RAY', 'Alexander. Died the week after his mother.'],
    ['RAY', 'Nobody puts that part in the ghost tour.'],
  ],
  field: [
    ['RAY', 'This is a field. This has been swamp since before my grandfather.'],
    ['RAY', 'I can hear people working. I can\'t see anybody.'],
    ['RAY', 'I\'m not going to pretend I don\'t know what this was.'],
  ],
  bridge: [
    ['RAY', 'Nineteen fourteen. Hundred and nineteen feet of steel and not one plank left on it.'],
    ['RAY', 'Can\'t cross. Never could.'],
  ],
  turnaround: [
    ['RAY', 'Half a mile out, half a mile back. That\'s what the sign said.'],
  ],
  loop2: [
    ['RAY', 'This is the boardwalk. I already did the boardwalk.'],
    ['RAY', 'Phone still says two o\'clock.'],
  ],
  loop3: [
    ['RAY', 'The bugs stopped.'],
    ['RAY', 'Everything stopped. There\'s nothing out here making a sound but me.'],
  ],
  prayFirst: [
    ['RAY', 'I don\'t do this anymore. Junie did this.'],
  ],
  prayWarm: [
    ['RAY', 'Nothing. That\'s all right. That\'s what it always was.'],
  ],
  prayCold: [
    ['RAY', 'Something moved. Something moved back.'],
  ],
  memoryLost: [
    ['RAY', 'Wait. Wait, that\'s not — '],
  ],
  presence: [
    ['RAY', 'There\'s somebody at the treeline.'],
    ['RAY', 'She doesn\'t get closer. She never gets closer.'],
  ],
  ledgerDone: [
    ['RAY', 'I\'ve got all of it. Every page.'],
    ['RAY', 'Nobody has said these out loud in a hundred and eighty years.'],
  ],
  refuse: [
    ['RAY', 'No. I\'m not walking out of here.'],
    ['RAY', 'Junie. If you\'re looking, I\'m right here. I\'ll wait.'],
  ],
};

// stop: which trail marker the artifact sits at. side: -1 left of the trail, +1 right.
// belief: +1 warms toward Legend, -1 cools toward Record.
// pairId groups a plaque with the document tucked behind it.
export const ARTIFACTS = [
  {
    id: 'sign-trailhead', stop: 0.00, side: 1, kind: 'plaque', pairId: 'trailhead',
    belief: +1, tex: 'plaque',
    title: 'Bellamy Bridge Heritage Trail',
    label: 'the trailhead sign',
    body: [
      ['plaque', 'HALF-MILE INTERPRETIVE LOOP. Please remain on the marked path. The trail is open dawn to dusk.'],
      ['plaque', 'Ahead: the 1914 steel truss bridge and the Bellamy family cemetery. Ask a guide about the famous Bride of Bellamy Bridge — Jackson County\'s best-loved ghost.'],
      ['ray', 'Dawn to dusk. Well.'],
    ],
  },
  {
    id: 'note-trailhead', stop: 0.00, side: 1, kind: 'document', pairId: 'trailhead',
    belief: -1, tex: 'paper',
    title: 'Sheriff\'s office notice, laminated, zip-tied below',
    label: 'a laminated notice',
    body: [
      ['doc', 'NOTICE: Trail closed after dark following repeated incidents. Persons found on this property between sunset and sunrise may be cited for trespass.'],
      ['doc', 'Emergency: the nearest cell coverage is at the county road, 1.2 miles north.'],
      ['ray', 'One-point-two miles. Good to know.'],
    ],
  },

  {
    id: 'sign-boardwalk', stop: 0.10, side: -1, kind: 'plaque', pairId: 'bride',
    belief: +1, tex: 'plaque',
    title: 'The Bride of Bellamy Bridge',
    label: 'an interpretive sign',
    body: [
      ['plaque', 'On her wedding night in 1837, young Elizabeth Bellamy\'s gown brushed a candle. Wrapped in flame, she ran from the house toward the river. Her husband could not save her.'],
      ['plaque', 'Visitors still report a woman in white along this stretch of the Chipola, searching the water for the man she lost.'],
      ['ray', 'That\'s the one from the documentary. Word for word, near enough.'],
    ],
    loop3: [
      ['plaque', 'On her wedding night in 1837, young Elizabeth Bellamy\'s gown brushed a candle.'],
      ['ray', 'It says the same thing. It says the exact same thing and I\'ve read it three times now and it has never once said how she actually died.'],
    ],
  },
  {
    id: 'doc-obituary', stop: 0.10, side: -1, kind: 'document', pairId: 'bride',
    belief: -1, tex: 'paper',
    title: 'Photocopy, tucked behind the sign',
    label: 'a photocopied page',
    body: [
      ['doc', 'DIED — at the residence of her husband, in Jackson County, on the 24th of May, 1837, Mrs. ELIZABETH JANE BELLAMY, consort of Samuel C. Bellamy, in the eighteenth year of her age.'],
      ['doc', 'Of the fever now prevailing. She leaves an infant son.'],
      ['ray', 'Fever. In May.'],
      ['ray', 'No candle. No gown. Somebody photocopied this and drove out here and left it behind a sign where maybe one person a year would find it.'],
    ],
  },

  {
    id: 'sign-fork', stop: 0.20, side: 1, kind: 'plaque', pairId: 'fork',
    belief: +1, tex: 'plaque',
    title: 'Trail map',
    label: 'the trail map',
    body: [
      ['plaque', 'YOU ARE HERE — 0.2 mi. The loop continues straight ahead to the cemetery and the bridge. There are no side trails on this property.'],
      ['ray', 'There are no side trails on this property.'],
      ['ray', 'Okay.'],
    ],
  },
  {
    id: 'doc-survey', stop: 0.20, side: 1, kind: 'document', pairId: 'fork',
    belief: -1, tex: 'paper', ledger: false,
    title: 'County survey sheet, folded into eighths',
    label: 'a folded survey sheet',
    body: [
      ['doc', 'PARCEL 12-4N-9W — "TERRE BONNE" — 1,840 ac. Field notes: old cart road bearing SW from the burial ground toward the quarter, overgrown, not maintained. Not shown on public trail signage.'],
      ['ray', 'The quarter.'],
      ['ray', 'That\'s a word for a place people lived.'],
    ],
  },

  {
    id: 'stone-elizabeth', stop: 0.30, side: -1, kind: 'document', pairId: null,
    belief: -1, tex: 'stone', prop: 'grave',
    title: 'A headstone',
    label: 'the headstone',
    body: [
      ['doc', 'ELIZABETH JANE CROOM\nWIFE OF SAMUEL C. BELLAMY\nDIED MAY 24 1837\nAGED 18 YEARS'],
      ['ray', 'Eighteen.'],
      ['ray', 'Junie was thirty-one and I thought that was a robbery.'],
    ],
  },
  {
    id: 'stone-alexander', stop: 0.30, side: -1, kind: 'document', pairId: null,
    belief: -1, tex: 'stone', prop: 'grave-small',
    title: 'A smaller headstone, beside it',
    label: 'the smaller stone',
    body: [
      ['doc', 'ALEXANDER\nINFANT SON OF S. & E. BELLAMY\nDIED MAY 31 1837'],
      ['ray', 'A week. He made it one week without her.'],
      ['ray', 'Nobody put you in the ghost story at all, did they.'],
    ],
  },
  {
    id: 'letter-samuel', stop: 0.30, side: 1, kind: 'document', pairId: null,
    belief: -1, tex: 'paper',
    title: 'Letter, S. Bellamy to his brother, 1851 — transcript',
    label: 'a transcribed letter',
    body: [
      ['doc', 'Bro. — you write that fourteen years is long enough and that I should marry again. I have no answer for you that would satisfy. I did not lose a wife. I lost the only account of myself I ever believed.'],
      ['doc', 'I ask only this, and I ask it soberly for once: when it comes, put me beside her. It is not much to ask of the living.'],
      ['ray', 'They didn\'t do it.'],
      ['ray', 'He drank another year and then he did it himself at Chattahoochee Landing, and they buried him somewhere else, and there\'s no stone on him at all.'],
      ['ray', 'That\'s the real ghost story. That\'s a man asking one thing and not getting it.'],
    ],
  },
  {
    id: 'sign-grove', stop: 0.30, side: 1, kind: 'plaque', pairId: null,
    belief: +1, tex: 'plaque',
    title: 'Bellamy Family Cemetery',
    label: 'the cemetery sign',
    body: [
      ['plaque', 'The Bellamys were among the county\'s leading families. Their home, Terre Bonne — "good earth" — stood on the rise beyond these trees. Please be respectful of the burials.'],
      ['plaque', 'These grounds are maintained by volunteers.'],
      ['ray', 'These burials. These ones.'],
    ],
  },

  {
    id: 'ledger-1', stop: 0.40, side: -1, kind: 'document', pairId: null,
    belief: -1, tex: 'paper', ledger: true, record: true,
    title: 'Terre Bonne estate inventory — leaf one',
    label: 'a ledger leaf',
    body: [
      ['doc', 'INVENTORY AND APPRAISEMENT OF THE ESTATE, JANUARY 1838. Land, 1,840 acres. Cotton in the gin, 41 bales. Rice, sugar in small lot. Mules, 9.'],
      ['doc', 'And, entered on the same page and in the same hand, in the same column as the mules:'],
      ['doc', 'HANNAH, 40, cook — PRINCE, 38, sawyer — DELIA, 19 — YOUNG PRINCE, 4 — MARY ANN, 17, house'],
      ['ray', 'Same page. Same column.'],
      ['ray', 'Hannah. Prince. Delia.'],
    ],
    note: 'Names in this ledger are fictional composites, not individuals lifted from archives.',
  },
  {
    id: 'ledger-2', stop: 0.40, side: 1, kind: 'document', pairId: null,
    belief: -1, tex: 'paper', ledger: true, record: true,
    title: 'Terre Bonne estate inventory — leaf two',
    label: 'a second ledger leaf',
    body: [
      ['doc', 'ISAAC, 52, driver — RHODA, 34 — TITUS, 16 — LUCY, 30, and infant, not named — MOSES, 45, carpenter, hired out at Marianna'],
      ['doc', 'CHARLOTTE, 22 — BURRELL, 27 — EVE, 60, "past labor"'],
      ['ray', 'Lucy, and infant, not named.'],
      ['ray', 'They wrote down every mule by name.'],
    ],
    note: 'Names in this ledger are fictional composites, not individuals lifted from archives.',
  },
  {
    id: 'ledger-3', stop: 0.40, side: -1, kind: 'document', pairId: null,
    belief: -1, tex: 'paper', ledger: true, record: true,
    title: 'Terre Bonne estate inventory — leaf three',
    label: 'a third ledger leaf',
    body: [
      ['doc', 'Memorandum: the burial ground for the quarter lies SW of the family plot, unfenced, unmarked at the request of no one.'],
      ['doc', 'The field beyond has gone back to swamp since the works were abandoned. It is of no further value to the estate.'],
      ['ray', 'Unmarked at the request of no one.'],
      ['ray', 'That\'s the whole county in one line. Nobody asked for it. It just got done, and then it got quiet, and then somebody made up a girl on fire so there\'d be something nicer to talk about.'],
    ],
    note: 'Names in this ledger are fictional composites, not individuals lifted from archives.',
  },

  {
    id: 'sign-bridge', stop: 0.50, side: 1, kind: 'plaque', pairId: 'bridge',
    belief: +1, tex: 'plaque',
    title: 'Bellamy Bridge — 1914',
    label: 'the bridge plaque',
    body: [
      ['plaque', 'This steel Parker through-truss carried the Marianna–Campbellton road across the Chipola River. 119 feet. The timber deck was lost to flood and rot; the span is closed to all traffic.'],
      ['plaque', 'It is on this bridge that the Bride is most often seen.'],
      ['ray', 'It\'s got no deck. She\'s most often seen standing on a bridge that hasn\'t had a floor since before I was born.'],
    ],
  },
  {
    id: 'doc-samuel-death', stop: 0.50, side: 1, kind: 'document', pairId: 'bridge',
    belief: -1, tex: 'paper',
    title: 'Newspaper column, 1853 — clipping',
    label: 'a clipping',
    body: [
      ['doc', 'MELANCHOLY OCCURRENCE. — We are pained to record the death, by his own hand, of Col. Samuel C. Bellamy, at Chattahoochee Landing on Tuesday last. He had been for some years in declining habits.'],
      ['doc', 'He was in the thirty-ninth year of his age. Of the family there now remain none in the county.'],
      ['ray', 'Declining habits.'],
      ['ray', 'He was drunk for fifteen years because his wife and his baby died in the same month and there wasn\'t one single person on God\'s earth he was allowed to say that to.'],
    ],
  },
];

export const ENDINGS = {
  owl: {
    tag: 'Ending 01 · Legend',
    title: 'Barred Owl',
    body: [
      ['', 'The clock moves. It says 5:41, and then it says 5:42, and the sky over the parking area goes the colour of a dirty nickel and then the colour of a peach.'],
      ['', 'It is a genuinely pleasant walk back to the truck. Birds start up in the pines. Ray\'s boots are wet to the ankle and he is thinking about breakfast, and about how he will tell this — the trail, the fog, the owl that sounded like a girl laughing — and how it will be a good story, and how everyone will agree with him, because agreeing is easier.'],
      ['', 'He drives home to Dothan with the windows down.'],
      ['tape', 'On the credits, the recorder plays. Unedited. The 2:00 file, the first one, made in the gravel lot before anything had happened yet.'],
      ['tape', 'The laugh is on it.'],
      ['tape', 'It was always on it.'],
      ['credit', 'You accepted the story the town tells. The game does not think less of you for it. It was simply a shorter walk.'],
    ],
  },
  register: {
    tag: 'Ending 02 · Record',
    title: 'The Register',
    body: [
      ['', 'He stands at the end of a bridge with no floor and he holds the recorder up like it is a thing that matters, and he reads the names.'],
      ['', 'Hannah, forty, cook. Prince, thirty-eight, sawyer. Delia, nineteen. Young Prince, four. Mary Ann, seventeen. Isaac, fifty-two. Rhoda. Titus. Lucy, and infant, not named. Moses, hired out at Marianna. Charlotte. Burrell. Eve, sixty, past labor.'],
      ['', 'Elizabeth Jane Croom, eighteen. Alexander, one week. Samuel, who asked one thing.'],
      ['', 'The shape at the fog line was never one woman and it was never only her. It does not come closer, because it never was coming closer. It goes quiet — not banished. Answered.'],
      ['', 'He walks out at first light with an accurate memory of his wife instead of a kind one. It is worse. It is also his, which the kind one never was.'],
      ['credit', 'No music. The birds start up on their own about a minute in.'],
    ],
  },
  refusal: {
    tag: 'Ending 03 · Refusal',
    title: 'Always and Forever',
    body: [
      ['', 'He sits down on the bank with his back against a cypress knee and turns the recorder off to save the battery, which is the single most hopeful thing he has done in eight months.'],
      ['', 'The camera lets go of him. It slides back through the palmetto, back down the boardwalk, back past the mile markers in reverse — 0.30, 0.20, 0.10 — and comes to rest at the trailhead, facing the treeline, and holds.'],
      ['', 'Somewhere out past the draw distance, a light moves through the trees. It does not get closer.'],
      ['credit', 'Four years later.'],
      ['credit', 'You are now the thing the next visitor will fail to explain.'],
    ],
  },
  zero: {
    tag: 'Ending 04 · Hidden',
    title: '0.00',
    body: [
      ['', 'He hears it the second time and he does not say barred owl.'],
      ['', 'He stands in the gravel with his hand on the door of the truck for a while. Then he gets in, and he sets the recorder on the passenger seat where Junie used to put her feet up on the dash, and he backs out onto the county road.'],
      ['', 'He never finds out. He wanted to know whether the dead look for us and he drives home at two in the morning still not knowing, which is the condition every living person is in.'],
      ['credit', 'Ninety seconds. Nobody was hurt. It is deliberately the easiest ending to miss.'],
    ],
  },
};

export const CREDITS = [
  'TERRE BONNE',
  'Bellamy Bridge · Jackson County, Florida',
  '',
  'Elizabeth, Samuel, Ann and Edward Bellamy were real people.',
  'Elizabeth died of fever in May 1837, aged eighteen.',
  'Her son Alexander died a week later.',
  'Samuel\'s death is documented, not invented.',
  'The burning-bride story was grafted on in the twentieth century, from a novel.',
  '',
  'Terre Bonne was a working plantation.',
  'The people who cleared that ground are on no plaque and in no ghost tour.',
  'The ledger names in this game are fictional composites.',
  '',
  'Made small, on purpose.',
];
