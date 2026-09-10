/**
 * src/injected.js — MAIN world injected script
 *
 * Runs in the page's MAIN JavaScript world so it can:
 *  - Use native React/Vue property setters (setNativeValue bypass)
 *  - Access DataTransfer for file uploads
 *  - Interact with page-level JS globals
 *
 * Receives AUTOFILL_TRIGGER messages via window.postMessage from content.js
 * (isolated world) and posts FILL_RESULT back.
 */

// NOTE: In the MAIN world, we cannot use ES module imports (Chrome MV3 content
// scripts in MAIN world do not support type:module for injected scripts).
// All dependencies must be available in the global scope or bundled.
//
// For now this file uses dynamic import-like IIFEs that will be replaced
// by a bundling step in a future phase. The functional logic is exported
// to a separate module for testability.

const MSG_AUTOFILL_TRIGGER = 'AUTOFILL_TRIGGER';
const MSG_FILL_RESULT = 'FILL_RESULT';

(function () {
  'use strict';

  if (window.__AUTOFILL_INJECTED__) return; // idempotent
  window.__AUTOFILL_INJECTED__ = true;

  window.addEventListener('message', async function onAutofillMessage(event) {
    // Only handle messages from our own content script
    if (event.source !== window) return;
    if (!event.data || event.data.type !== MSG_AUTOFILL_TRIGGER) return;
    if (event.data.source !== '__autofill_content__') return;

    const { requestId, profile, settings } = event.data;

    try {
      // Dynamic import of the generic adapter (works in bundled output)
      // In development, this file is loaded alongside the bundled adapter.
      const { runGenericFill } = await import('./adapters/generic.js');
      const result = await runGenericFill(document, profile, settings);

      window.postMessage({
        type: MSG_FILL_RESULT,
        requestId,
        ok: true,
        filled: result.filled,
        skipped: result.skipped,
        skippedByUser: result.skippedByUser,
      }, '*');
    } catch (err) {
      window.postMessage({
        type: MSG_FILL_RESULT,
        requestId,
        ok: false,
        error: String(err),
      }, '*');
    }
  });

  console.debug('[Autofill] injected script loaded (MAIN world)');
})();
