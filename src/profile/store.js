/**
 * store.js — Profile persistence via chrome.storage.local.
 * Runs in both content scripts and background service worker (globalThis.chrome).
 *
 * Schema version: 1
 * Migration: v0 (no _version) → v1 (add _version, merge missing sections)
 */

import { createEmptyProfile } from './schema.js';

const STORAGE_KEY = 'profile';
const CURRENT_VERSION = 1;

// ─── Migrations ───────────────────────────────────────────────────────────────

/**
 * Migrate a stored profile to the current version.
 * @param {object} stored - Raw object from chrome.storage.local
 * @returns {object} Migrated profile with _version set
 */
function migrate(stored) {
  const empty = createEmptyProfile();

  // v0 → v1: add _version, fill in any missing top-level sections
  if (!stored._version) {
    return {
      ...empty,
      ...stored,
      _version: 1,
    };
  }

  return stored;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Load profile from chrome.storage.local.
 * Returns createEmptyProfile() if nothing is stored yet.
 * Runs migration automatically.
 * @returns {Promise<object>}
 */
export async function loadProfile() {
  const result = await globalThis.chrome.storage.local.get(STORAGE_KEY);
  if (!result[STORAGE_KEY]) {
    return { ...createEmptyProfile(), _version: CURRENT_VERSION };
  }
  return migrate(result[STORAGE_KEY]);
}

/**
 * Save profile to chrome.storage.local.
 * Stamps _version if missing.
 * @param {object} profile
 * @returns {Promise<void>}
 */
export async function saveProfile(profile) {
  const toSave = { ...profile, _version: profile._version ?? CURRENT_VERSION };
  await globalThis.chrome.storage.local.set({ [STORAGE_KEY]: toSave });
}

/**
 * Register a listener for profile changes.
 * @param {(newProfile: object) => void} listener
 * @returns {() => void} unsubscribe function
 */
export function onProfileChange(listener) {
  function handler(changes, area) {
    if (area !== 'local') return;
    if (!changes[STORAGE_KEY]) return;
    listener(changes[STORAGE_KEY].newValue);
  }
  globalThis.chrome.storage.onChanged.addListener(handler);
  return () => globalThis.chrome.storage.onChanged.removeListener(handler);
}
