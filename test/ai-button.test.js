/**
 * test/ai-button.test.js — P4.5 Generate with AI button logic
 *
 * Tests:
 *   - handleGenerateAI(question, draftTextarea, profile, settings, sendMessage)
 *     → shows loading state, calls sendMessage, populates textarea on success,
 *       shows error on failure
 *
 * This function drives the "Generate with AI" button in the review panel.
 * It uses chrome.runtime.sendMessage via an injected `sendMessage` function
 * so we can test without a real extension context.
 */

import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { handleGenerateAI } from '../src/complexAnswer.js';

function makePanel() {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>
    <div id="panel">
      <button class="autofill-ai">Generate with AI</button>
      <textarea class="autofill-q-draft"></textarea>
      <span class="autofill-ai-status"></span>
    </div>
  </body></html>`, { url: 'http://localhost/' });
  return dom.window.document;
}

const PROFILE = { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com' };
const SETTINGS = { aiProvider: 'openai', aiApiKey: 'sk-test', aiModel: 'gpt-4o-mini' };
const QUESTION = 'Why do you want to work here?';

describe('handleGenerateAI', () => {
  it('calls sendMessage with AUTOFILL_AI_REQUEST', async () => {
    const doc = makePanel();
    const textarea = doc.querySelector('textarea');
    const btn = doc.querySelector('button');
    const statusEl = doc.querySelector('.autofill-ai-status');

    const sendMessage = vi.fn().mockResolvedValue({ draft: 'I love your mission.' });

    await handleGenerateAI({
      question: QUESTION,
      draftTextarea: textarea,
      aiButton: btn,
      statusEl,
      profile: PROFILE,
      settings: SETTINGS,
      sendMessage,
    });

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'AUTOFILL_AI_REQUEST',
        question: QUESTION,
        profile: PROFILE,
        settings: SETTINGS,
      })
    );
  });

  it('populates the textarea with the AI draft on success', async () => {
    const doc = makePanel();
    const textarea = doc.querySelector('textarea');
    const btn = doc.querySelector('button');
    const statusEl = doc.querySelector('.autofill-ai-status');

    const sendMessage = vi.fn().mockResolvedValue({ draft: 'I love your mission.' });

    await handleGenerateAI({
      question: QUESTION,
      draftTextarea: textarea,
      aiButton: btn,
      statusEl,
      profile: PROFILE,
      settings: SETTINGS,
      sendMessage,
    });

    expect(textarea.value).toBe('I love the mission.'.replace('the', 'your'));
    expect(textarea.value).toBe('I love your mission.');
  });

  it('disables the button while loading', async () => {
    const doc = makePanel();
    const textarea = doc.querySelector('textarea');
    const btn = doc.querySelector('button');
    const statusEl = doc.querySelector('.autofill-ai-status');

    let capturedDisabled = false;
    const sendMessage = vi.fn().mockImplementation(() => {
      capturedDisabled = btn.disabled;
      return Promise.resolve({ draft: 'Draft.' });
    });

    await handleGenerateAI({
      question: QUESTION,
      draftTextarea: textarea,
      aiButton: btn,
      statusEl,
      profile: PROFILE,
      settings: SETTINGS,
      sendMessage,
    });

    expect(capturedDisabled).toBe(true);  // disabled while loading
    expect(btn.disabled).toBe(false);     // re-enabled after
  });

  it('shows error status when sendMessage returns an error', async () => {
    const doc = makePanel();
    const textarea = doc.querySelector('textarea');
    const btn = doc.querySelector('button');
    const statusEl = doc.querySelector('.autofill-ai-status');

    const sendMessage = vi.fn().mockResolvedValue({ error: 'API key invalid.' });

    await handleGenerateAI({
      question: QUESTION,
      draftTextarea: textarea,
      aiButton: btn,
      statusEl,
      profile: PROFILE,
      settings: SETTINGS,
      sendMessage,
    });

    expect(statusEl.textContent).toContain('API key invalid.');
    expect(textarea.value).toBe('');
  });

  it('shows error status when sendMessage rejects', async () => {
    const doc = makePanel();
    const textarea = doc.querySelector('textarea');
    const btn = doc.querySelector('button');
    const statusEl = doc.querySelector('.autofill-ai-status');

    const sendMessage = vi.fn().mockRejectedValue(new Error('Network failure'));

    await handleGenerateAI({
      question: QUESTION,
      draftTextarea: textarea,
      aiButton: btn,
      statusEl,
      profile: PROFILE,
      settings: SETTINGS,
      sendMessage,
    });

    expect(statusEl.textContent).toContain('Network failure');
  });
});
