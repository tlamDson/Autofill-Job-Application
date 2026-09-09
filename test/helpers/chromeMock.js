/**
 * chromeMock.js — Minimal chrome.storage.local mock cho Vitest/jsdom.
 * Dùng Map làm backing store, simulate async API của chrome.storage.local.
 */

export function createChromeMock() {
  const store = new Map();
  const listeners = new Set();

  const storage = {
    local: {
      get(keys, callback) {
        const result = {};
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const k of keyList) {
          if (store.has(k)) result[k] = store.get(k);
        }
        if (callback) {
          // Simulate async
          Promise.resolve().then(() => callback(result));
        }
        return Promise.resolve(result);
      },

      set(items, callback) {
        const changes = {};
        for (const [k, v] of Object.entries(items)) {
          const oldValue = store.get(k);
          store.set(k, v);
          changes[k] = { oldValue, newValue: v };
        }
        // Notify listeners
        for (const fn of listeners) {
          fn(changes, 'local');
        }
        if (callback) Promise.resolve().then(() => callback());
        return Promise.resolve();
      },

      remove(keys, callback) {
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const k of keyList) store.delete(k);
        if (callback) Promise.resolve().then(() => callback());
        return Promise.resolve();
      },

      clear(callback) {
        store.clear();
        if (callback) Promise.resolve().then(() => callback());
        return Promise.resolve();
      },
    },

    onChanged: {
      addListener(fn) { listeners.add(fn); },
      removeListener(fn) { listeners.delete(fn); },
    },
  };

  return { chrome: { storage }, _store: store };
}
