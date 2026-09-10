/**
 * test/background.test.js — P4.4 AI provider settings + background proxy
 *
 * Tests:
 *   - validateAISettings(settings) → {valid, error}
 *   - makeAIMessageHandler(fetch) → message handler function
 *     (the real chrome.runtime.onMessage wiring happens in background.js module scope)
 */

import { describe, it, expect, vi } from 'vitest';
import { validateAISettings, makeAIMessageHandler } from '../src/background.js';

// ─── validateAISettings ───────────────────────────────────────────────────────

describe('validateAISettings', () => {
  it('returns valid: false when no api key', () => {
    const result = validateAISettings({ aiProvider: 'openai', aiApiKey: '' });
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns valid: false when provider is missing', () => {
    const result = validateAISettings({ aiApiKey: 'sk-abc' });
    expect(result.valid).toBe(false);
  });

  it('returns valid: false for unknown provider', () => {
    const result = validateAISettings({ aiProvider: 'unknown-ai', aiApiKey: 'key' });
    expect(result.valid).toBe(false);
  });

  it('returns valid: true for openai with api key', () => {
    const result = validateAISettings({ aiProvider: 'openai', aiApiKey: 'sk-abc123' });
    expect(result.valid).toBe(true);
    expect(result.error).toBeFalsy();
  });

  it('returns valid: true for gemini with api key', () => {
    const result = validateAISettings({ aiProvider: 'gemini', aiApiKey: 'AIza-xyz' });
    expect(result.valid).toBe(true);
  });

  it('returns valid: false when settings is null/undefined', () => {
    expect(validateAISettings(null).valid).toBe(false);
    expect(validateAISettings(undefined).valid).toBe(false);
  });
});

// ─── makeAIMessageHandler ─────────────────────────────────────────────────────

const SETTINGS = { aiProvider: 'openai', aiApiKey: 'sk-test', aiModel: 'gpt-4o-mini' };
const AI_REQUEST = {
  type: 'AUTOFILL_AI_REQUEST',
  question: 'Why do you want to work here?',
  label: 'Why do you want to work here?',
  profile: { firstName: 'Ada', lastName: 'Lovelace' },
  settings: SETTINGS,
};

describe('makeAIMessageHandler', () => {
  it('returns a function', () => {
    const handler = makeAIMessageHandler(() => {});
    expect(typeof handler).toBe('function');
  });

  it('ignores messages that are not AUTOFILL_AI_REQUEST', () => {
    const mockFetch = vi.fn();
    const handler = makeAIMessageHandler(mockFetch);
    const sendResponse = vi.fn();
    const result = handler({ type: 'OTHER_MSG' }, {}, sendResponse);
    expect(result).toBeFalsy(); // not handled
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('calls fetch with the AI provider URL when request received', async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Because I love your mission.' } }],
      }),
    };
    const mockFetch = vi.fn().mockResolvedValue(mockResponse);
    const handler = makeAIMessageHandler(mockFetch);
    const sendResponse = vi.fn();

    const isAsync = handler(AI_REQUEST, {}, sendResponse);
    // Must return true to keep the message channel open for async response
    expect(isAsync).toBe(true);

    // Wait for the async IIFE to resolve (micro + macro task)
    await new Promise((r) => setTimeout(r, 20));
    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ draft: expect.any(String) })
    );
  });

  it('returns error in response when fetch fails', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const handler = makeAIMessageHandler(mockFetch);
    const sendResponse = vi.fn();

    handler(AI_REQUEST, {}, sendResponse);
    await new Promise((r) => setTimeout(r, 20));
    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) })
    );
  });

  it('returns error when API key validation fails', async () => {
    const mockFetch = vi.fn();
    const handler = makeAIMessageHandler(mockFetch);
    const sendResponse = vi.fn();

    const badRequest = { ...AI_REQUEST, settings: { aiProvider: 'openai', aiApiKey: '' } };
    handler(badRequest, {}, sendResponse);
    await new Promise((r) => setTimeout(r, 20));
    expect(sendResponse).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.any(String) })
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
