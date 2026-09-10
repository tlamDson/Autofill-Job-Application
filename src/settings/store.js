/**
 * store.js — Settings persistence via chrome.storage.local.
 * Runs in both content scripts and background service worker (globalThis.chrome).
 *
 * Schema version: 1
 */

const STORAGE_KEY = 'settings';
const CURRENT_VERSION = 1;

export const DEFAULT_SETTINGS = {
  _version: CURRENT_VERSION,
  ai: { provider: '', apiKey: '', model: '' },
  autoAnswerOpenQuestions: false,
  showGenerateAIButton: true,
  continuousMultipage: true,
  resumeFileName: 'useMyName', // 'useMyName' | 'original'
  disabledFields: [],
};

// ─── Merge ──────────────────────────────────────────────────────────────────

/**
 * Deep-merge `stored` on top of DEFAULT_SETTINGS so newly added default keys
 * (top-level or nested) are always present, without discarding user values.
 * Arrays and other non-plain-object values are taken from `stored` wholesale.
 * @param {object} defaults
 * @param {object} stored
 * @returns {object}
 */
function deepMerge(defaults, stored) {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
    return stored === undefined ? defaults : stored;
  }
  const result = { ...defaults };
  for (const key of Object.keys(stored)) {
    const defaultVal = defaults[key];
    const storedVal = stored[key];
    if (
      defaultVal &&
      typeof defaultVal === 'object' &&
      !Array.isArray(defaultVal) &&
      storedVal &&
      typeof storedVal === 'object' &&
      !Array.isArray(storedVal)
    ) {
      result[key] = deepMerge(defaultVal, storedVal);
    } else {
      result[key] = storedVal;
    }
  }
  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Load settings from chrome.storage.local, deep-merged with DEFAULT_SETTINGS
 * so new default keys are always present.
 * @returns {Promise<object>}
 */
export async function loadSettings() {
  const result = await globalThis.chrome.storage.local.get(STORAGE_KEY);
  return deepMerge(DEFAULT_SETTINGS, result[STORAGE_KEY]);
}

/**
 * Save settings to chrome.storage.local.
 * Stamps _version if missing.
 * @param {object} settings
 * @returns {Promise<void>}
 */
export async function saveSettings(settings) {
  const toSave = { ...settings, _version: settings._version ?? CURRENT_VERSION };
  await globalThis.chrome.storage.local.set({ [STORAGE_KEY]: toSave });
}

/**
 * Register a listener for settings changes.
 * @param {(newSettings: object) => void} listener
 * @returns {() => void} unsubscribe function
 */
export function onSettingsChange(listener) {
  function handler(changes, area) {
    if (area !== 'local') return;
    if (!changes[STORAGE_KEY]) return;
    listener(changes[STORAGE_KEY].newValue);
  }
  globalThis.chrome.storage.onChanged.addListener(handler);
  return () => globalThis.chrome.storage.onChanged.removeListener(handler);
}
