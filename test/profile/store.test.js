// store.test.js — TDD cho loadProfile, saveProfile, onProfileChange
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createChromeMock } from '../helpers/chromeMock.js';

// We inject chrome mock into global before importing store
// (store reads globalThis.chrome at call time, not at import time)

let chromeMock;

beforeEach(() => {
  const { chrome } = createChromeMock();
  chromeMock = chrome;
  globalThis.chrome = chrome;
});

// Lazy import so chrome mock is set up first
async function importStore() {
  // Reset module cache for fresh import each test
  const mod = await import('../../src/profile/store.js?t=' + Date.now());
  return mod;
}

describe('loadProfile', () => {
  it('returns createEmptyProfile() when storage is empty', async () => {
    const { loadProfile } = await importStore();
    const profile = await loadProfile();
    expect(profile).toHaveProperty('personal');
    expect(profile.personal.firstName).toBe('');
    expect(profile.education).toHaveLength(0);
  });

  it('returns stored profile when it exists', async () => {
    const { loadProfile, saveProfile } = await importStore();
    await saveProfile({ personal: { firstName: 'Alice' }, _version: 1 });
    const profile = await loadProfile();
    expect(profile.personal.firstName).toBe('Alice');
  });

  it('migrates v0 profile (missing _version) to v1', async () => {
    const { loadProfile } = await importStore();
    // Manually write a v0 profile (no _version field)
    await chromeMock.storage.local.set({
      profile: { personal: { firstName: 'Bob' }, education: [] },
    });
    const profile = await loadProfile();
    expect(profile._version).toBe(1);
    expect(profile.personal.firstName).toBe('Bob');
  });
});

describe('saveProfile', () => {
  it('persists profile to storage', async () => {
    const { saveProfile, loadProfile } = await importStore();
    await saveProfile({ personal: { firstName: 'Carol' }, _version: 1 });
    const loaded = await loadProfile();
    expect(loaded.personal.firstName).toBe('Carol');
  });

  it('stamps _version: 1 if missing', async () => {
    const { saveProfile, loadProfile } = await importStore();
    await saveProfile({ personal: { firstName: 'Dave' } });
    const loaded = await loadProfile();
    expect(loaded._version).toBe(1);
  });
});

describe('onProfileChange', () => {
  it('calls listener when profile changes', async () => {
    const { saveProfile, onProfileChange } = await importStore();
    const listener = vi.fn();
    const unsubscribe = onProfileChange(listener);

    await saveProfile({ personal: { firstName: 'Eve' }, _version: 1 });

    // Wait for async listener dispatch
    await new Promise((r) => setTimeout(r, 10));
    expect(listener).toHaveBeenCalled();

    unsubscribe();
  });

  it('does not call listener after unsubscribe', async () => {
    const { saveProfile, onProfileChange } = await importStore();
    const listener = vi.fn();
    const unsubscribe = onProfileChange(listener);
    unsubscribe();

    await saveProfile({ personal: { firstName: 'Frank' }, _version: 1 });
    await new Promise((r) => setTimeout(r, 10));
    expect(listener).not.toHaveBeenCalled();
  });
});
