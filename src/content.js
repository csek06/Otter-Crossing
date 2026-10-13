// All on-screen copy lives here so it can be edited without touching game code.
//
// Rules for editors:
// - Sentence case, plain and active.
// - Taglines are 6 words max.
// - Descriptions stay within what the tagline claims. No statistics or invented claims.
// - No em-dashes.
// - Anything marked draft: true is waiting on review. See COPY_REVIEW.md.
// - Links marked REVIEW point at general pages. Swap in specific ones before launch.
// - Every reviewable line is listed in COPY_REVIEW.md.

export const CONTENT = {
  game: {
    title: 'Otter Crossing',
    signTag: 'Next exit: end of day',
    play: 'Play',
    howTo: 'How to play',
    back: 'Back',
    resume: 'Resume',
    restart: 'Restart',
    quit: 'Back to title',
    playAgain: 'Play again',
    paused: 'Paused',
    pause: 'Pause',
    muteOn: 'Sound on',
    muteOff: 'Sound off',
    lanes: 'lanes',
    actionItems: 'Action items',
    score: 'Lanes crossed',
    best: 'Best',
    newBest: 'New best',
    logoAlt: 'Otter logo',
    sound: 'Sound',
    music: 'Music',
    musicOn: 'Music on',
    musicOff: 'Music off',
    leaderboard: 'Leaderboards',
    leaderboardHeading: 'Top 10 on this device',
    noScores: 'No scores yet. Play a run to set one.',
    madeTop10: 'You made the top 10',
    initialsLabel: 'Your initials',
    nextLetter: 'Next letter',
    prevLetter: 'Previous letter',
    letter: 'Letter',
    saveScore: 'Save score',
    recapHeading: 'Features you used',
    recapEmpty: 'Grab a glowing pickup next run to try an Otter feature.',
    learnMore: 'Learn more',
    powerTracker: 'Power-ups',
    powerPanels: 'Power-ups and the Otter features behind them',
    // The HUD countdown to the Deadline Hawk. {n} is whole seconds left.
    hawkTimer: 'Seconds until the hawk strikes: {n}. Hop forward to reset it.',
    powerState: { off: 'not found yet', got: 'collected', active: 'active', held: 'ready', used: 'used' },
    // Badges on the desktop power-up panels.
    powerBadge: { off: 'Not found yet', got: 'Collected', active: 'Active', held: 'Ready', used: 'Used this run' },
    // The pickup counter on each panel card, and the game over count. {n} is a number.
    pickCount: '×{n}',
    pickCountLabel: 'Collected {n} times this run',
    rideCountLabel: 'Rode {n} logs this run',
    powerupsShort: 'Power-ups',
    itemsShort: 'items',
    daily: 'Daily',
    outfits: 'Outfits',
    todayBest: 'Today\'s best',
    walletLine: 'Action items to spend on outfits: {n}',
  },

  // Daily challenge: the same course for everyone on a given date.
  daily: {
    draft: true,
    tag: 'Daily challenge, {date}',
    copyResult: 'Copy result',
    copied: 'Copied. Paste it in Slack.',
    copyManual: 'Select the text above to copy it.',
    // {date}, {lanes} and {items} are filled in. Keep it to one line.
    share: 'Otter Crossing daily challenge, {date}. Lanes: {lanes}. Action items: {items}.',
  },

  // Outfits bought with action items. Costs are in src/game/wardrobe.js.
  outfits: {
    draft: true,
    heading: 'Outfits',
    walletLabel: 'Action items to spend',
    wear: 'Wear',
    wearing: 'Wearing',
    buy: 'Buy for {cost}',
    need: 'Need {more} more',
    items: {
      classic: { name: 'Classic', line: 'The headset. Always the headset.' },
      sales: { name: 'Sales', line: 'A sharp tie for the big demo.' },
      cs: { name: 'Customer success', line: 'A cozy scarf for every check-in.' },
      recruiting: { name: 'Recruiting', line: 'A badge for interview day.' },
      education: { name: 'Education', line: 'Cap and glasses for office hours.' },
    },
  },

  // Booth mode only (FLAGS.BOOTH_MODE). Consent text and the privacy link wait on Legal.
  booth: {
    draft: true,
    emailHeading: 'Want news from Otter?',
    emailLabel: 'Email',
    consent: 'Placeholder consent text pending Legal review. Yes, Otter.ai can email me.',
    privacyLabel: 'Privacy policy',
    privacyUrl: 'https://otter.ai/privacy-policy', // REVIEW: Legal to confirm the link and consent text
    submit: 'Sign up',
    thanks: 'Thanks. You are on the list.',
    invalid: 'Check the email address.',
    needConsent: 'Tick the box to sign up.',
  },

  // Hidden booth admin screen for staff. Open it by holding the logo for 3 seconds,
  // or with Alt+Shift+O on a keyboard.
  admin: {
    heading: 'Booth admin',
    note: 'Everything here is stored only in this browser on this device.',
    signups: 'Sign-ups saved: {n}',
    scores: 'Top 10 scores saved: {n}',
    exportCsv: 'Export sign-ups (CSV)',
    clearSignups: 'Clear sign-ups',
    clearScores: 'Clear scores and outfits',
    confirm: 'Tap again to confirm',
    cleared: 'Cleared.',
    exported: 'Saved {file}.',
    eventLabel: 'Event code for the online event board',
    eventSave: 'Save event code',
    eventSaved: 'Event code saved: {code}',
    eventCleared: 'No event code. Scores go to the global board only.',
    eventBad: 'Use 2 to 40 lowercase letters, numbers or dashes.',
  },

  // Online boards (Supabase). Only shown when the build has a Supabase project.
  online: {
    draft: true,
    saveHeading: 'Save your score',
    postLabel: 'Post to the online boards (initials only)',
    companyLabel: 'Also post to the {domain} board',
    posting: 'Posting your score...',
    posted: 'Posted: {ranks}.',
    rankGlobal: '#{n} worldwide',
    rankDaily: '#{n} in today\'s challenge',
    rankEvent: '#{n} at {event}',
    rankCompany: '#{n} at {domain}',
    queued: 'You\'re offline. Your score will post when you\'re back online.',
    failed: 'Couldn\'t post that score.',
    tabsLabel: 'Leaderboards',
    tabDevice: 'This device',
    tabGlobal: 'Global',
    tabDaily: 'Today',
    tabEvent: 'Event',
    tabCompany: 'My company',
    headingGlobal: 'Top 100 worldwide',
    headingDaily: "Today's top 100",
    headingEvent: 'Top 100 at {event}',
    headingCompany: 'Top 100 at your company',
    // Drawn across the lane where your best run ended.
    markerYou: 'Your best',
    loading: 'Loading...',
    unreachable: 'Can\'t reach the online boards right now.',
    emptyOnline: 'No scores here yet. Be the first.',
    companyHeading: 'Players at {domain}',
    you: 'You',
    companyIntro: 'Compete with your company. Sign in with your work email and we\'ll send you a 6-digit code. Your company board only shows initials, and only people at your company can see it.',
    emailLabel: 'Work email',
    codeLabel: '6-digit code',
    sendCode: 'Send code',
    verify: 'Sign in',
    codeSent: 'Check your inbox for a 6-digit code.',
    badEmail: 'Enter a valid email address.',
    badCode: 'That code didn\'t work. Check it and try again.',
    sendFailed: 'Couldn\'t send a code right now. Try again in a minute.',
    personal: 'Personal email addresses like Gmail don\'t get a company board. Sign out and try your work email.',
    signedIn: 'Signed in as {email}',
    signOut: 'Sign out',
    forget: 'Remove my online scores',
    forgetConfirm: 'Tap again to remove them',
    forgotten: 'Your online scores are removed.',
  },

  howTo: {
    draft: true,
    heading: 'How to play',
    lines: [
      'Tap to hop forward. Swipe left, right or back to dodge.',
      'On a keyboard, use the arrow keys or WASD. Esc pauses.',
      'Cross as many lanes of your workday as you can.',
      'Keep moving. Stall too long and the Deadline Hawk swoops in.',
      'Grab glowing pickups to try an Otter feature.',
    ],
  },

  // Feature entries share a shape with our other game so verified copy can be reused:
  // { name, tagline, description, helpUrl }
  features: {
    notetaker: {
      draft: true,
      name: 'Otter Notetaker',
      tagline: 'Joins your meetings and takes notes',
      description: 'Otter Notetaker can join your Zoom, Google Meet and Microsoft Teams meetings and take notes for you.',
      helpUrl: 'https://help.otter.ai/hc/en-us/articles/4425393298327-Otter-Notetaker-Overview',
    },
    aiChat: {
      draft: true,
      name: 'AI Chat',
      tagline: 'Ask anything about your meetings',
      description: 'Ask AI Chat about a meeting while it is still going or after it ends, or across many meetings at once. Catch up on what you missed, pull out the decisions, concerns and next steps, compare interview candidates, or draft a follow-up email.',
      helpUrl: 'https://help.otter.ai/hc/en-us/articles/19682180167575-Otter-AI-Chat-Overview',
    },
    summary: {
      draft: true,
      name: 'Summary',
      tagline: 'Get the gist without listening back',
      description: 'Read the summary to get the gist of a meeting without listening back to it.',
      helpUrl: 'https://help.otter.ai/hc/en-us/articles/9156381229079-Meeting-Summary-Overview',
    },
    actionItems: {
      draft: true,
      name: 'Action Items',
      tagline: 'Captures to-dos and who owns them',
      description: 'Action Items capture the to-dos from a meeting and who each one is assigned to.',
      helpUrl: 'https://help.otter.ai/hc/en-us/articles/25983095114519-Action-Items-Overview',
    },
    highlights: {
      draft: true,
      name: 'Highlights',
      tagline: 'Mark key moments as they happen',
      description: 'Highlight key moments in a conversation as they happen, during the live recording or after.',
      helpUrl: 'https://help.otter.ai/hc/en-us/articles/21557292299287-Add-highlights-to-your-conversation',
    },
    // Live for Enterprise since July 21, 2026, with positioning still being finalized.
    // No help center article yet, so the link is the launch how-to blog post.
    liveAssist: {
      draft: true,
      name: 'Live Assist',
      tagline: 'Private tips during your live calls',
      description: 'Live Assist follows your call and shows tips only you can see, like the next question to ask.',
      helpUrl: 'https://otter.ai/blog/your-calls-have-a-coach-now-how-to-use-live-assist',
    },
    // Work Mode in AI Chat. External launch October 15, 2026. Help center article
    // "Otter AI Chat Overview V2" covers Chat and Work, and is still rolling out.
    workMode: {
      draft: true,
      name: 'Work Mode',
      tagline: 'Hand Otter the whole task',
      description: 'Switch AI Chat to Work and Otter completes tasks for you from your meetings and connected apps, like drafting a follow-up email in Gmail.',
      helpUrl: 'https://help.otter.ai/hc/en-us/articles/43427281705623-Otter-AI-Chat-Overview-V2',
    },
  },

  // Messages shown when a power-up does its job.
  // What each power-up does in the game, for the first-pickup explainer. The
  // "Inside Otter" half of that explainer is the feature description above.
  powers: {
    draft: true,
    notetaker: 'Shields you from one hit for 12 seconds.',
    aiChat: 'Saves you once. If you get caught, you pop back on the last safe lane.',
    summary: 'Hops you 5 lanes ahead to a safe spot.',
    actionItems: 'Pulls nearby action items to you for 6 seconds.',
    liveAssist: 'Lights a safe path through the next 4 lanes for 4 seconds.',
    workMode: 'Starts a Work run. Cross 8 new lanes and it pulls in the action items ahead, plus 3 for the follow-up doc.',
  },
  learn: {
    draft: true,
    newPower: 'New power-up',
    inGame: 'In the game',
    insideOtter: 'Inside Otter',
    keys: 'Press up or W to keep going',
    touch: 'Tap or swipe up to keep going',
  },

  powerupMessages: {
    draft: true,
    notetakerSaved: 'Otter Notetaker took that one for you.',
    aiChatRevive: 'AI Chat caught you up.',
    workModeDone: 'Work run done. Your follow-up doc is worth {n} action items.',
    workModeLeft: 'Your Work run had {n} of {total} lanes left.',
  },

  // Death causes, each with the game over tip that names the feature that would have helped.
  deaths: {
    meeting: {
      draft: true,
      title: 'Pulled into a meeting',
      tip: 'Otter Notetaker could have joined that meeting for you.',
    },
    river: {
      draft: true,
      title: 'Swept away by notes',
      tip: 'Highlights and summaries keep you out of the flood.',
    },
    allhands: {
      draft: true,
      title: 'Steamrolled by the all-hands',
      tip: 'Missed it? AI Chat can catch you up.',
    },
    hawk: {
      draft: true,
      title: 'The Deadline Hawk',
      tip: 'Summaries and action items save time on follow-up.',
    },
  },

  // One-line hints shown the first time each lane type appears in a run.
  hints: {
    draft: true,
    meetings: 'Meetings incoming. Hop through the gaps.',
    river: 'Ride the logs across.',
    allhands: 'Watch for the all-hands signal.',
    hawk: 'Keep moving. The Deadline Hawk is circling.',
  },

  // The daily challenge runs through the otter's habitat: animals on the trail,
  // geese on the flyway, logs on the river. Same lanes, outdoor copy.
  habitat: {
    draft: true,
    deaths: {
      meeting: {
        title: 'Bowled over on the trail',
        tip: 'Grab Otter Notetaker and it takes the next hit for you.',
      },
      river: {
        title: 'Carried off downstream',
        tip: 'Even otters tire. Reach a log within a second.',
      },
      allhands: {
        title: 'Caught on the goose flyway',
        tip: 'Red lights mean the flock is coming in low.',
      },
      hawk: {
        title: 'Snatched by the hawk',
        tip: 'Keep moving. Hawks watch for anything sitting still.',
      },
    },
    hints: {
      meetings: 'Animals on the trail. Hop through the gaps.',
      river: 'Hop across on the floating logs.',
      allhands: 'Red lights mean geese are coming in low.',
      hawk: 'Keep moving. A hawk is circling.',
    },
  },

  // Meeting block titles, keyed by length in tiles (1 = 30 min, 2 = 60 min, 3 = 90 min).
  // Each block picks one at random. Clearly fictional, and the kinds of meetings
  // Otter records: sales, customer success, recruiting, product and engineering,
  // marketing, leadership, HR, finance and education. Keep them short so they fit
  // the block: at most 9, 14 and 20 characters (checked by a test).
  meetingTitles: {
    draft: true,
    external: {
      1: ['Sync?', '1:1', 'Huddle', 'Coffee', 'Check-in', 'Prep', 'Debrief', 'Demo', 'Intro', 'Kickoff',
        'Recap', 'Q&A', 'Lunch', 'Retro', 'Triage', 'Pairing', 'Catch-up', 'Review', 'Pitch', 'Training',
        'Screen', 'Standup', 'Planning', 'Lecture', 'Seminar', 'Tutoring', 'Advising', 'Feedback', 'Pulse'],
      2: ['Quick sync?', 'Weekly 1:1', 'Budget review', 'Team retro', 'Design crit', 'Stand-up',
        'Sprint review', 'Pipeline call', 'Deal review', 'Discovery call', 'Product demo', 'QBR prep',
        'Renewal call', 'Onboarding', 'Phone screen', 'Panel prep', 'Hiring sync', 'Offer review',
        'Office hours', 'Study group', 'Board prep', 'Town hall', 'Roadmap sync', 'Bug bash', 'Launch sync',
        'Content review', 'Brand review', 'Vendor call', 'Legal review', 'Security sync', 'Forecast call',
        'Ops review', 'Skip level', 'Team lunch', 'Brainstorm', 'Interview', 'Coaching call', 'Escalation',
        'Health check', 'Partner sync', 'Press prep', 'Webinar prep', 'Expense review', 'Benefits Q&A',
        'Policy review', 'Lesson plan', 'Parent meeting', 'Faculty sync', 'Research sync', 'Lab meeting',
        'Advisor 1:1', 'Campaign sync', 'Data review', 'Hiring panel'],
      3: ['Quarterly planning', 'Vendor demo', 'Roadmap review', 'Interview loop', 'Launch readiness',
        'Annual kickoff', 'Board meeting', 'All-hands prep', 'Customer onboarding', 'Executive briefing',
        'Account planning', 'Pipeline review', 'Sales kickoff', 'Contract negotiation', 'Renewal strategy',
        'Churn risk review', 'Hiring committee', 'Candidate debrief', 'Performance review', 'Comp planning',
        'Org design review', 'Incident postmortem', 'Architecture review', 'Sprint planning',
        'Product strategy', 'User research', 'Usability testing', 'Campaign kickoff', 'Brand workshop',
        'Earnings prep', 'Budget planning', 'Audit walkthrough', 'Investor update', 'Partner summit',
        'Leadership offsite', 'Strategy workshop', 'Department meeting', 'Faculty meeting', 'Thesis defense',
        'Guest lecture', 'Study session', 'Parent conference', 'Grant review', 'Research seminar',
        'Training workshop', 'Compliance training', 'New hire orientation', 'Benefits enrollment'],
    },
    internal: {
      1: ['Sync?', '1:1', 'Deal desk', 'SE huddle', 'Prep', 'Pipeline', 'Forecast', 'Win room', 'Debrief',
        'Coaching', 'Standup', 'Kickoff', 'Demo', 'Recap', 'Q&A'],
      2: ['Quick sync?', 'Weekly 1:1', 'Forecast call', 'Demo dry run', 'Account plan', 'QBR prep',
        'Discovery call', 'Deal review', 'Pipeline scrub', 'Renewal call', 'POC check-in', 'Pricing review',
        'SE sync', 'Champion call', 'Security Q&A', 'Legal redlines', 'Handoff to CS', 'Onboarding',
        'Expansion call', 'Win/loss chat', 'Call coaching', 'Deal strategy'],
      3: ['MEDDPICC deal review', 'Territory planning', 'Win/loss review', 'Renewal strategy',
        'Mutual action plan', 'Executive briefing', 'Procurement call', 'Sales kickoff', 'Proof of concept',
        'Security review', 'Competitive review', 'Quarterly review', 'Champion enablement',
        'Pricing negotiation', 'Account planning', 'Pipeline generation', 'Forecast deep dive',
        'Customer onboarding'],
    },
  },

  links: {
    tryOtter: {
      draft: true,
      label: 'Try Otter',
      url: 'https://otter.ai', // REVIEW: add campaign tracking if marketing wants it
    },
  },

  // Short labels drawn on game art.
  labels: {
    allHandsTrain: 'All-hands',
  },

  debug: {
    invincible: 'Invincible',
    hitboxes: 'Hitboxes',
  },
};
