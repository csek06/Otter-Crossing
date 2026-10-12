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
    leaderboard: 'Top 10',
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
    powerState: { off: 'not found yet', active: 'active', held: 'ready', used: 'used' },
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
      tagline: 'Ask what you missed, mid-meeting',
      description: 'Ask AI Chat what you missed while the meeting is still going.',
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
  },

  // Messages shown when a power-up does its job.
  powerupMessages: {
    draft: true,
    notetakerSaved: 'Otter Notetaker took that one for you.',
    aiChatRevive: 'AI Chat caught you up.',
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
    river: 'Ride the highlighted logs across.',
    allhands: 'Watch for the all-hands signal.',
    hawk: 'Keep moving. The Deadline Hawk is circling.',
  },

  // Meeting block titles, keyed by length in tiles (1 = 30 min, 2 = 60 min, 3 = 90 min).
  // Clearly fictional. Keep them short so they fit on the block.
  meetingTitles: {
    draft: true,
    external: {
      1: ['Sync?', '1:1', 'Huddle', 'Coffee', 'Check-in', 'Prep'],
      2: ['Quick sync?', 'Weekly 1:1', 'Budget review', 'Team retro', 'Design crit', 'Stand-up'],
      3: ['Quarterly planning', 'Vendor demo', 'Roadmap review', 'Interview loop', 'Launch readiness'],
    },
    internal: {
      1: ['Sync?', '1:1', 'Deal desk', 'SE huddle', 'Prep'],
      2: ['Quick sync?', 'Weekly 1:1', 'Forecast call', 'Demo dry run', 'Account plan', 'QBR prep'],
      3: ['MEDDPICC deal review', 'Territory planning', 'Win/loss review', 'Renewal strategy'],
    },
  },

  // The river. Its water is a stream of feature blurbs: each feature's name and
  // tagline, built from the features above so it always matches reviewed copy.
  // Extra blurbs below are added to the stream. The floating logs carry the short
  // phrases on a highlighter stripe. Keep phrases to about 15 characters so they fit.
  river: {
    draft: true,
    extraBlurbs: [],
    phrases: [
      'Otter Notetaker',
      'Takes notes',
      'AI Chat',
      'Ask what you missed',
      'Summary',
      'Get the gist',
      'Action Items',
      'Who owns them',
      'Highlights',
      'Key moments',
    ],
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
