/**
 * src/content.js — Isolated world content script
 *
 * Responsibilities:
 *  1. Listen for AUTOFILL_TRIGGER message from popup/background.
 *  2. Load the user's profile from chrome.storage.local.
 *  3. Post a FILL_WITH_PROFILE message to the MAIN world (injected.js)
 *     via window.postMessage (isolated ↔ MAIN bridge).
 *  4. Relay the result back to the popup via sendResponse.
 *
 * The actual DOM filling runs in injected.js (MAIN world) so it has access
 * to page JS globals (React internals, DataTransfer, etc.).
 *
 * Exported for unit testing:
 *   makeMessageHandler({ runFill }) — factory that returns the onMessage handler
 *   postFillRequest()               — send AUTOFILL_TRIGGER to the active tab
 */

import { loadProfile } from './profile/store.js';
import { loadSettings } from './settings/store.js';
import { loadMirroredResume } from './profile/resumeTransport.js';
import { createFormObserver } from './observer.js';
import { collectOpenQuestions, createReviewPanel, handleGenerateAI } from './complexAnswer.js';
import { fillOpenQuestion } from './qa.js';
import { setNativeValue } from './filler.js';

// ─── Constants ────────────────────────────────────────────────────────────────

export const MSG_AUTOFILL_TRIGGER = 'AUTOFILL_TRIGGER';
export const MSG_FILL_RESULT = 'FILL_RESULT';

// ─── Message handler factory (testable) ──────────────────────────────────────

/**
 * Create the chrome.runtime.onMessage handler.
 *
 * @param {{ runFill: () => Promise<{filled:number, skipped:number}> }} deps
 * @returns {Function}
 */
export function makeMessageHandler({ runFill }) {
  return function onMessage(message, _sender, sendResponse) {
    if (!message || message.type !== MSG_AUTOFILL_TRIGGER) {
      return false; // not handled
    }

    // Handle async — must return true to keep channel open
    runFill()
      .then((result) => {
        sendResponse({
          ok: true,
          filled: result.filled,
          skipped: result.skipped,
          skippedByUser: result.skippedByUser,
        });
      })
      .catch((err) => {
        console.error('[Autofill] fill error', err);
        sendResponse({ ok: false, error: String(err) });
      });

    return true; // async response
  };
}

/**
 * Map settings.ai (provider/apiKey/model) to the flat shape background.js's
 * validateAISettings/callOpenAI/callGemini expect (aiProvider/aiApiKey/aiModel).
 *
 * @param {{provider?: string, apiKey?: string, model?: string}} [ai]
 * @returns {{aiProvider?: string, aiApiKey?: string, aiModel?: string}}
 */
export function toAIRequestSettings(ai) {
  return {
    aiProvider: ai?.provider,
    aiApiKey: ai?.apiKey,
    aiModel: ai?.model,
  };
}

// ─── Active-tab fill request (called from popup) ──────────────────────────────

/**
 * Send AUTOFILL_TRIGGER to the active tab and return the result.
 * Called by the popup when user clicks "Autofill".
 *
 * @returns {Promise<{ok:boolean, filled:number, skipped:number}|{ok:boolean, error:string}>}
 */
export async function postFillRequest() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return { ok: false, error: 'No active tab' };
  return chrome.tabs.sendMessage(tab.id, { type: MSG_AUTOFILL_TRIGGER });
}

// ─── Live registration (runs in real extension, not during tests) ─────────────

// Guard: only register listeners when running as a real content script
// (i.e., when chrome.runtime is available and we're not in a test environment).
if (
  typeof chrome !== 'undefined' &&
  chrome.runtime?.onMessage &&
  typeof window !== 'undefined' &&
  !window.__AUTOFILL_TEST__
) {
  // Multipage form observer — created lazily, started only when
  // settings.continuousMultipage is on. start()/createFormObserver are both
  // idempotent, so re-arming on every runFill() call is safe.
  let multipageObserver = null;

  function armMultipageObserver() {
    if (!multipageObserver) {
      multipageObserver = createFormObserver(document.body, () => {
        runFill().catch((err) => console.error('[Autofill] multipage re-fill error', err));
      });
    }
    multipageObserver.start();
  }

  /**
   * runFill: loads profile from storage, posts to MAIN world, awaits result.
   * Uses window.postMessage to cross the isolated/MAIN world boundary.
   */
  async function runFill() {
    const [profile, settings] = await Promise.all([loadProfile(), loadSettings()]);

    // Best-effort: attach the currently-saved resume as a File so injected.js
    // (MAIN world) can attach it to a resume upload input. resumeStore.js's
    // IndexedDB is unreachable from here (it's scoped to the options page's
    // chrome-extension:// origin, not this page's), so the bytes are read
    // back from the chrome.storage.local mirror written at upload time
    // (resumeTransport.js). A missing/oversized/not-yet-uploaded resume is
    // not an error — the rest of the fill should proceed regardless.
    let resumeFile = null;
    const resumeRef = profile.resumeFiles?.[0]?.fileRef;
    if (resumeRef) {
      try {
        resumeFile = await loadMirroredResume(resumeRef);
      } catch (err) {
        console.warn('[Autofill] could not load resume for attach', err);
      }
    }

    const result = await new Promise((resolve, reject) => {
      const requestId = `fill_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      function onResult(event) {
        if (
          event.source !== window ||
          event.data?.type !== MSG_FILL_RESULT ||
          event.data?.requestId !== requestId
        )
          return;
        window.removeEventListener('message', onResult);
        if (event.data.ok) {
          resolve({
            filled: event.data.filled,
            skipped: event.data.skipped,
            skippedByUser: event.data.skippedByUser,
          });
        } else {
          reject(new Error(event.data.error));
        }
      }

      window.addEventListener('message', onResult);

      // Post to MAIN world (injected.js receives this). structured clone
      // (unlike chrome.runtime.sendMessage's JSON serialization) preserves
      // File objects intact, so resumeFile survives the world boundary.
      window.postMessage(
        {
          type: MSG_AUTOFILL_TRIGGER,
          requestId,
          profile,
          settings,
          resumeFile,
          source: '__autofill_content__',
        },
        '*'
      );

      // Timeout after 30s
      setTimeout(() => {
        window.removeEventListener('message', onResult);
        reject(new Error('Fill timeout'));
      }, 30000);
    });

    if (settings.continuousMultipage) armMultipageObserver();

    await maybeShowReviewPanel(profile, settings);

    return result;
  }

  /**
   * After a fill pass, resolve any open (long-text) questions:
   *  1. Try the savedAnswers cache first — silent, no review needed.
   *  2. Show a review panel for whatever is still blank (cache misses).
   *  3. If autoAnswerOpenQuestions is on, draft those via AI into both the
   *     panel textarea and the real field — the panel still lets the user
   *     edit/confirm before they submit the form themselves.
   * Safe to call repeatedly (e.g. once per multipage re-fill): createReviewPanel
   * is idempotent and collectOpenQuestions naturally excludes already-answered fields.
   */
  async function maybeShowReviewPanel(profile, settings) {
    const candidates = collectOpenQuestions(document, []);
    for (const q of candidates) {
      fillOpenQuestion(q.el, q.label, profile.savedAnswers);
    }

    const openQuestions = collectOpenQuestions(document, []); // re-scan: cache hits are now non-empty
    if (openQuestions.length === 0) return;

    const panel = createReviewPanel(
      document,
      openQuestions,
      {
        onAccept(i, answer) {
          const q = openQuestions[i];
          if (q?.el) setNativeValue(q.el, answer);
        },
        onGenerateAI(i, label) {
          const item = panel.querySelector(`[data-index="${i}"]`);
          handleGenerateAI({
            question: label,
            draftTextarea: item?.querySelector('.autofill-q-draft'),
            aiButton: item?.querySelector('.autofill-ai'),
            profile,
            settings: toAIRequestSettings(settings.ai),
            sendMessage: (msg) => chrome.runtime.sendMessage(msg),
          });
        },
      },
      { showAIButton: settings.showGenerateAIButton }
    );

    document.body.appendChild(panel);

    if (settings.autoAnswerOpenQuestions) {
      for (let i = 0; i < openQuestions.length; i++) {
        const q = openQuestions[i];
        const item = panel.querySelector(`[data-index="${i}"]`);
        const draftTextarea = item?.querySelector('.autofill-q-draft');
        await handleGenerateAI({
          question: q.label,
          draftTextarea,
          aiButton: item?.querySelector('.autofill-ai'),
          profile,
          settings: toAIRequestSettings(settings.ai),
          sendMessage: (msg) => chrome.runtime.sendMessage(msg),
        });
        if (q.el && draftTextarea?.value) {
          setNativeValue(q.el, draftTextarea.value);
        }
      }
    }
  }

  chrome.runtime.onMessage.addListener(makeMessageHandler({ runFill }));

  console.debug('[Autofill] content script loaded');
}
