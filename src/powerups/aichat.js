// AI Chat (revive): held until needed, once per run. On death, respawn on the last
// safe lane with 2 seconds of invulnerability.

export default {
  id: 'aiChat',
  featureId: 'aiChat',
  unreleased: false,
  duration: 0,      // held, not timed
  weight: 0.8,
  oncePerRun: true,

  apply(game) {
    game.hold(this);
  },

  // Return true to cancel a death.
  revive(game) {
    game.release(this.id);
    game.respawnSafe(2);
    game.message('aiChatRevive');
    game.sfx.revive();
    return true;
  },
};
