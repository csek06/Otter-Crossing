// Power-ups teach Otter features. Each module shares one interface:
//   id, featureId (key in CONTENT.features), unreleased, duration (seconds, 0 if not timed),
//   weight (how often it spawns), apply(game)
// Optional hooks:
//   update(game, dt, entry)   every frame while active
//   absorb(game, cause)       return true to cancel a hit
//   revive(game, cause)       return true to cancel a death (held power-ups)
//   oncePerRun                spawn at most once a run
// To add a power-up: write one module, import it below, add its feature to content.js.

import { FLAGS } from '../config.js';
import notetaker from './notetaker.js';
import aiChat from './aichat.js';
import summary from './summary.js';
import actionItems from './actionitems.js';
import liveAssist from './liveassist.js';

export const POWERUPS = [notetaker, aiChat, summary, actionItems, liveAssist];

export const POWERUP_BY_ID = Object.fromEntries(POWERUPS.map((p) => [p.id, p]));

// Power-ups that can spawn in a run.
export function spawnable(showUnreleased = FLAGS.SHOW_UNRELEASED) {
  return POWERUPS.filter((p) => showUnreleased || !p.unreleased);
}
