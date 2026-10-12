// Outfits bought with action items. Every run adds its action items to a wallet
// that persists on the device. Names and descriptions are in CONTENT.outfits.

import { load, save } from '../core/storage.js';

export const OUTFITS = [
  { id: 'classic', cost: 0 },
  { id: 'sales', cost: 15 },
  { id: 'cs', cost: 25 },
  { id: 'recruiting', cost: 40 },
  { id: 'education', cost: 60 },
];

const BY_ID = Object.fromEntries(OUTFITS.map((o) => [o.id, o]));

// store is { load, save } so tests can use a plain object.
export function createWardrobe(store = { load, save }) {
  const state = {
    wallet: Math.max(0, store.load('wallet', 0) | 0),
    owned: new Set(['classic', ...store.load('outfits', []).filter((id) => BY_ID[id])]),
    wearing: store.load('outfit', 'classic'),
  };
  if (!state.owned.has(state.wearing)) state.wearing = 'classic';

  function persist() {
    store.save('wallet', state.wallet);
    store.save('outfits', [...state.owned].filter((id) => id !== 'classic'));
    store.save('outfit', state.wearing);
  }

  return {
    wallet: () => state.wallet,
    owns: (id) => state.owned.has(id),
    wearing: () => state.wearing,
    earn(n) {
      if (n > 0) {
        state.wallet += n | 0;
        persist();
      }
      return state.wallet;
    },
    // Returns true if bought. Buying puts the outfit on.
    buy(id) {
      const o = BY_ID[id];
      if (!o || state.owned.has(id) || state.wallet < o.cost) return false;
      state.wallet -= o.cost;
      state.owned.add(id);
      state.wearing = id;
      persist();
      return true;
    },
    wear(id) {
      if (!state.owned.has(id)) return false;
      state.wearing = id;
      persist();
      return true;
    },
    reset() {
      state.wallet = 0;
      state.owned = new Set(['classic']);
      state.wearing = 'classic';
      persist();
    },
  };
}
