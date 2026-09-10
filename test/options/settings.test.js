// settings.test.js — TDD cho Settings tab UI (options/sections/settings.js)
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createChromeMock } from '../helpers/chromeMock.js';
import { DEFAULT_SETTINGS } from '../../src/settings/store.js';
import { FIELD_GROUPS } from '../../src/settings/fieldGroups.js';

beforeEach(() => {
  const { chrome } = createChromeMock();
  globalThis.chrome = chrome;
  document.body.innerHTML = '';
});

async function importSettings() {
  return import('../../options/sections/settings.js?t=' + Date.now());
}

function freshSettings(overrides = {}) {
  return JSON.parse(JSON.stringify({ ...DEFAULT_SETTINGS, ...overrides }));
}

describe('AI provider block', () => {
  it('renders provider select, api key input, and model input', async () => {
    const { renderSettings } = await importSettings();
    renderSettings(document.body, freshSettings());
    expect(document.querySelector('[data-field="ai.provider"]')).toBeTruthy();
    expect(document.querySelector('[data-field="ai.apiKey"]')).toBeTruthy();
    expect(document.querySelector('[data-field="ai.model"]')).toBeTruthy();
  });

  it('pre-fills from provided settings', async () => {
    const { renderSettings } = await importSettings();
    renderSettings(document.body, freshSettings({ ai: { provider: 'openai', apiKey: 'sk-1', model: 'gpt-4o' } }));
    expect(document.querySelector('[data-field="ai.provider"]').value).toBe('openai');
    expect(document.querySelector('[data-field="ai.apiKey"]').value).toBe('sk-1');
    expect(document.querySelector('[data-field="ai.model"]').value).toBe('gpt-4o');
  });

  it('api key input starts masked and toggles visible on button click', async () => {
    const { renderSettings } = await importSettings();
    renderSettings(document.body, freshSettings());
    const input = document.querySelector('[data-field="ai.apiKey"]');
    const toggleBtn = document.querySelector('[data-action="toggle-apikey-visibility"]');
    expect(input.type).toBe('password');
    toggleBtn.dispatchEvent(new Event('click', { bubbles: true }));
    expect(input.type).toBe('text');
  });

  it('calls onSave with updated ai settings on change', async () => {
    const { renderSettings } = await importSettings();
    const onSave = vi.fn();
    renderSettings(document.body, freshSettings(), onSave);
    const select = document.querySelector('[data-field="ai.provider"]');
    select.value = 'openai';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onSave).toHaveBeenCalled();
    expect(onSave.mock.calls[0][0].ai.provider).toBe('openai');
  });

  it('shows a validation error when api key is set without provider', async () => {
    const { renderSettings } = await importSettings();
    renderSettings(document.body, freshSettings());
    const apiKeyInput = document.querySelector('[data-field="ai.apiKey"]');
    apiKeyInput.value = 'sk-test';
    apiKeyInput.dispatchEvent(new Event('change', { bubbles: true }));
    const errorEl = document.querySelector('[data-error="ai"]');
    expect(errorEl.textContent).toBeTruthy();
  });
});

describe('Autofill behavior block', () => {
  it('renders toggles for autoAnswerOpenQuestions, showGenerateAIButton, continuousMultipage', async () => {
    const { renderSettings } = await importSettings();
    renderSettings(document.body, freshSettings());
    expect(document.querySelector('[data-field="autoAnswerOpenQuestions"]')).toBeTruthy();
    expect(document.querySelector('[data-field="showGenerateAIButton"]')).toBeTruthy();
    expect(document.querySelector('[data-field="continuousMultipage"]')).toBeTruthy();
  });

  it('renders resume filename select with both options', async () => {
    const { renderSettings } = await importSettings();
    renderSettings(document.body, freshSettings());
    const select = document.querySelector('[data-field="resumeFileName"]');
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toEqual(['useMyName', 'original']);
  });

  it('pre-fills toggle checked state from settings', async () => {
    const { renderSettings } = await importSettings();
    renderSettings(document.body, freshSettings({ showGenerateAIButton: false }));
    expect(document.querySelector('[data-field="showGenerateAIButton"]').checked).toBe(false);
  });

  it('calls onSave with flipped boolean on toggle click', async () => {
    const { renderSettings } = await importSettings();
    const onSave = vi.fn();
    renderSettings(document.body, freshSettings({ continuousMultipage: true }), onSave);
    const toggle = document.querySelector('[data-field="continuousMultipage"]');
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onSave).toHaveBeenCalled();
    expect(onSave.mock.calls[0][0].continuousMultipage).toBe(false);
  });
});

describe('Fields to autofill block', () => {
  it('renders a master toggle and one row per key for every group', async () => {
    const { renderSettings } = await importSettings();
    renderSettings(document.body, freshSettings());
    for (const group of FIELD_GROUPS) {
      expect(document.querySelector(`[data-group-toggle="${group.id}"]`)).toBeTruthy();
      for (const key of group.keys) {
        expect(document.querySelector(`[data-field-toggle="${key}"]`)).toBeTruthy();
      }
    }
  });

  it('checks all field toggles by default (disabledFields empty)', async () => {
    const { renderSettings } = await importSettings();
    renderSettings(document.body, freshSettings());
    expect(document.querySelector('[data-field-toggle="firstName"]').checked).toBe(true);
  });

  it('unchecks a field toggle when its key is in disabledFields', async () => {
    const { renderSettings } = await importSettings();
    renderSettings(document.body, freshSettings({ disabledFields: ['firstName'] }));
    expect(document.querySelector('[data-field-toggle="firstName"]').checked).toBe(false);
  });

  it('marks the group master toggle indeterminate when only some keys are disabled', async () => {
    const { renderSettings } = await importSettings();
    renderSettings(document.body, freshSettings({ disabledFields: ['firstName'] }));
    expect(document.querySelector('[data-group-toggle="personal"]').indeterminate).toBe(true);
  });

  it('toggling a field off calls onSave with the key added to disabledFields', async () => {
    const { renderSettings } = await importSettings();
    const onSave = vi.fn();
    renderSettings(document.body, freshSettings(), onSave);
    const toggle = document.querySelector('[data-field-toggle="firstName"]');
    toggle.checked = false;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onSave).toHaveBeenCalled();
    expect(onSave.mock.calls[0][0].disabledFields).toContain('firstName');
  });

  it('toggling the group master off disables every key in that group', async () => {
    const { renderSettings } = await importSettings();
    const onSave = vi.fn();
    const linksGroup = FIELD_GROUPS.find((g) => g.id === 'links');
    renderSettings(document.body, freshSettings(), onSave);
    const master = document.querySelector('[data-group-toggle="links"]');
    master.checked = false;
    master.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onSave).toHaveBeenCalled();
    const disabled = onSave.mock.calls[0][0].disabledFields;
    for (const key of linksGroup.keys) {
      expect(disabled).toContain(key);
    }
  });
});
