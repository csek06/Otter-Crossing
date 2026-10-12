// Lane types. Each module shares one interface:
//   id, safe, hint
//   generate(lane, row, difficulty, rng, ctx)  fill the lane's data
//   update(lane, dt)                          move hazards
//   drawGround(ctx, lane, view, y)            flat ground for the row
//   drawObjects(ctx, lane, view, y)           raised objects for the row
//   collide(lane, player)                     null, or { cause }
//   blocks(lane, col)                         truthy if a static obstacle fills the tile
// Optional:
//   carry(lane, player, dt)                   move the otter while it stands in the lane
//   hitboxes(lane)                            [[left, right], ...] for ?debug=1
//   safeAt(lane, col)                         true if the tile is safe right now (Live Assist)
//   drawSignals(ctx, lane, view, y)           art in the facade margins
// Hazard lanes also have weight(difficulty, row) for how often they are picked.
// To add a lane type: write one module, register it here, add its hint to content.js.

import { focus } from './focus.js';
import { meetings } from './meetings.js';
import { river } from './river.js';
import { allhands } from './allhands.js';

export const LANES = { focus, meetings, river, allhands };

export const HAZARDS = [meetings, river, allhands];
