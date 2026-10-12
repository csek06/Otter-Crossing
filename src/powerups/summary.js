// Summary (skip ahead): auto-hops the otter 5 lanes forward to a safe lane.

export default {
  id: 'summary',
  featureId: 'summary',
  unreleased: false,
  duration: 0,
  weight: 0.9,
  lanes: 5,

  apply(game) {
    game.autoHop(this.lanes);
    game.sfx.whoosh();
  },
};
