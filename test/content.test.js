/**
 * test/content.test.js — P1.15 Content script + bridge messaging
 *
 * Tests the message routing logic in the content script bridge.
 * Chrome APIs are mocked — no actual extension runtime.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createChromeMock } from './helpers/chromeMock.js';

// ─── Message bridge logic (extracted for testability) ─────────────────────────
// The actual content.js uses chrome.runtime.onMessage.addListener.
// We test the routing logic by importing the handler factory.

import {
  makeMessageHandler,
  postFillRequest,
} from '../src/content.js';

describe('makeMessageHandler', () => {
  let chromeMock;

  beforeEach(() => {
    chromeMock = createChromeMock();
    globalThis.chrome = chromeMock;
  });

  it('responds to AUTOFILL_TRIGGER with { ok: true, filled, skipped }', async () => {
    // Mock a filler that returns counts
    const mockFill = vi.fn().mockResolvedValue({ filled: 3, skipped: 0, skippedByUser: 0 });
    const handler = makeMessageHandler({ runFill: mockFill });

    let sentResponse = null;
    const sendResponse = (resp) => { sentResponse = resp; };

    // Simulate message from popup
    const result = handler(
      { type: 'AUTOFILL_TRIGGER' },
      { id: 'popup' },
      sendResponse
    );

    // Handler should return true (async) so port stays open
    expect(result).toBe(true);

    // Wait for async fill to complete (flush Promise microtasks)
    await new Promise((r) => setTimeout(r, 0));

    expect(sentResponse.ok).toBe(true);
    expect(sentResponse.filled).toBe(3);
    expect(sentResponse.skipped).toBe(0);
    expect(mockFill).toHaveBeenCalledOnce();
  });

  it('propagates skippedByUser from runFill into the response', async () => {
    const mockFill = vi.fn().mockResolvedValue({ filled: 2, skipped: 0, skippedByUser: 4 });
    const handler = makeMessageHandler({ runFill: mockFill });

    let sentResponse = null;
    const sendResponse = (resp) => { sentResponse = resp; };

    handler({ type: 'AUTOFILL_TRIGGER' }, {}, sendResponse);
    await new Promise((r) => setTimeout(r, 0));

    expect(sentResponse.skippedByUser).toBe(4);
  });

  it('returns error response when fill throws', async () => {
    const mockFill = vi.fn().mockRejectedValue(new Error('fill failed'));
    const handler = makeMessageHandler({ runFill: mockFill });

    let sentResponse = null;
    const sendResponse = (resp) => { sentResponse = resp; };

    handler({ type: 'AUTOFILL_TRIGGER' }, {}, sendResponse);

    await new Promise((r) => setTimeout(r, 0));

    expect(sentResponse.ok).toBe(false);
    expect(sentResponse.error).toBeTruthy();
  });

  it('ignores unknown message types', () => {
    const mockFill = vi.fn();
    const handler = makeMessageHandler({ runFill: mockFill });

    const result = handler({ type: 'UNKNOWN_MSG' }, {}, () => {});

    // Should return false/undefined (no async response)
    expect(result).toBeFalsy();
    expect(mockFill).not.toHaveBeenCalled();
  });
});

describe('postFillRequest', () => {
  let chromeMock;

  beforeEach(() => {
    chromeMock = createChromeMock();
    globalThis.chrome = chromeMock;
  });

  it('sends AUTOFILL_TRIGGER to the active tab', async () => {
    // Stub chrome.tabs.query and tabs.sendMessage
    let sentMsg = null;
    chromeMock.tabs = {
      query: vi.fn().mockResolvedValue([{ id: 42 }]),
      sendMessage: vi.fn().mockImplementation((tabId, msg) => {
        sentMsg = { tabId, msg };
        return Promise.resolve({ ok: true, filled: 2, skipped: 0 });
      }),
    };

    const result = await postFillRequest();

    expect(sentMsg.tabId).toBe(42);
    expect(sentMsg.msg.type).toBe('AUTOFILL_TRIGGER');
    expect(result.ok).toBe(true);
    expect(result.filled).toBe(2);
  });
});
