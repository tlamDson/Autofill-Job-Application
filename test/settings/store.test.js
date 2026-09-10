// store.test.js — TDD cho loadSettings, saveSettings, onSettingsChange
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createChromeMock } from '../helpers/chromeMock.js';

let chromeMock;

beforeEach(() => {
  const { chrome } = createChromeMock();
  chromeMock = chrome;
  globalThis.chrome = chrome;
});

// Lazy import so chrome mock is set up first, fresh module per test
async function importStore() {
  const mod = await import('../../src/settings/store.js?t=' + Date.now());
  return mod;
}

describe('loadSettings', () => {
  it('returns DEFAULT_SETTINGS when storage is empty', async () => {
    const { loadSettings, DEFAULT_SETTINGS } = await importStore();
    const settings = await loadSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it('returns stored settings merged with defaults', async () => {
    const { loadSettings, saveSettings } = await importStore();
    await saveSettings({ continuousMultipage: false, disabledFields: ['gpa'] });
    const settings = await loadSettings();
    expect(settings.continuousMultipage).toBe(false);
    expect(settings.disabledFields).toEqual(['gpa']);
    // untouched defaults still present
    expect(settings.showGenerateAIButton).toBe(true);
    expect(settings.resumeFileName).toBe('useMyName');
  });

  it('deep-merges nested ai settings so new sub-keys are not lost', async () => {
    const { loadSettings } = await importStore();
    await chromeMock.storage.local.set({
      settings: { ai: { provider: 'openai', apiKey: 'sk-test' } },
    });
    const settings = await loadSettings();
    expect(settings.ai.provider).toBe('openai');
    expect(settings.ai.apiKey).toBe('sk-test');
    // model wasn't in stored data — default should survive
    expect(settings.ai.model).toBe('');
  });

  it('does not choke on a stored settings object missing _version', async () => {
    const { loadSettings } = await importStore();
    await chromeMock.storage.local.set({ settings: { autoAnswerOpenQuestions: true } });
    const settings = await loadSettings();
    expect(settings._version).toBe(1);
    expect(settings.autoAnswerOpenQuestions).toBe(true);
  });
});

describe('saveSettings', () => {
  it('persists settings to storage', async () => {
    const { saveSettings, loadSettings } = await importStore();
    await saveSettings({ resumeFileName: 'original' });
    const loaded = await loadSettings();
    expect(loaded.resumeFileName).toBe('original');
  });

  it('stamps _version: 1 if missing', async () => {
    const { saveSettings, loadSettings } = await importStore();
    await saveSettings({ showGenerateAIButton: false });
    const loaded = await loadSettings();
    expect(loaded._version).toBe(1);
  });
});

describe('onSettingsChange', () => {
  it('calls listener when settings change', async () => {
    const { saveSettings, onSettingsChange } = await importStore();
    const listener = vi.fn();
    const unsubscribe = onSettingsChange(listener);

    await saveSettings({ resumeFileName: 'original' });

    await new Promise((r) => setTimeout(r, 10));
    expect(listener).toHaveBeenCalled();

    unsubscribe();
  });

  it('does not call listener after unsubscribe', async () => {
    const { saveSettings, onSettingsChange } = await importStore();
    const listener = vi.fn();
    const unsubscribe = onSettingsChange(listener);
    unsubscribe();

    await saveSettings({ resumeFileName: 'original' });
    await new Promise((r) => setTimeout(r, 10));
    expect(listener).not.toHaveBeenCalled();
  });
});
