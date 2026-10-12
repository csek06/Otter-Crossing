// Otter Notetaker (shield): absorbs one hit from meeting traffic or the all-hands.
// Lasts until used or 12 seconds.

export default {
  id: 'notetaker',
  featureId: 'notetaker',
  unreleased: false,
  duration: 12,
  weight: 1,

  apply(game) {
    game.addActive(this);
  },

  // Return true to absorb a hit.
  absorb(game, cause) {
    if (cause !== 'meeting' && cause !== 'allhands') return false;
    game.removeActive(this.id);
    game.message('notetakerSaved');
    game.player.invuln = 1;
    game.sfx.shield();
    return true;
  },
};
