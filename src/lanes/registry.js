// Lane types. Each module shares one interface:
//   id, safe, hint
//   generate(lane, row, difficulty, rng, ctx)  fill the lane's data
//   update(lane, dt)                          move hazards
//   drawGround(ctx, lane, view, y)            flat ground for the row
//   drawObjects(ctx, lane, view, y)           raised objects for the row
//   collide(lane, player)                     null, or { cause }
//   blocks(lane, col)                         truthy if a static obstacle fills the tile
// Hazard lanes also have weight(difficulty) for how often they are picked.
// To add a lane type: write one module, register it here, add its hint to content.js.

import { focus } from './focus.js';
import { meetings } from './meetings.js';

export const LANES = { focus, meetings };

export const HAZARDS = [meetings];
