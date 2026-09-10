/**
 * src/observer.js — MutationObserver for multi-step form opt-in
 *
 * Watches for new fillable fields appearing in the DOM (e.g., when a
 * multi-step ATS form navigates to the next step) and calls a callback.
 *
 * Design:
 *  - Debounced: rapid DOM mutations are batched into a single callback.
 *  - Opt-in: consumer decides what to do with new fields (re-fill, highlight, etc).
 *  - No auto-submit: never triggers fill automatically — only signals.
 *
 * Exported API:
 *   createFormObserver(root, onNewFields, options?) → { start(), stop() }
 */

// Tags considered "fillable" for triggering the observer callback
const FILLABLE_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA']);

/**
 * Create a form observer that watches `root` for new fillable fields.
 *
 * @param {Element}  root           — DOM element to observe (usually document.body)
 * @param {Function} onNewFields    — called when new fillable fields are detected
 * @param {{ debounceMs?: number }} [options]
 * @returns {{ start: () => void, stop: () => void }}
 */
export function createFormObserver(root, onNewFields, options = {}) {
  const { debounceMs = 300 } = options;

  let debounceTimer = null;
  let observer = null;

  function scheduleCallback() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      onNewFields();
    }, debounceMs);
  }

  function onMutation(mutations) {
    let hasFillable = false;

    for (const mutation of mutations) {
      if (mutation.type !== 'childList') continue;
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== 1 /* ELEMENT_NODE */) continue;

        // Check the added node itself
        if (FILLABLE_TAGS.has(node.tagName)) {
          hasFillable = true;
          break;
        }

        // Check descendants of the added node
        if (node.querySelector) {
          const found = node.querySelector('input, select, textarea');
          if (found) {
            hasFillable = true;
            break;
          }
        }
      }
      if (hasFillable) break;
    }

    if (hasFillable) {
      scheduleCallback();
    }
  }

  return {
    start() {
      if (observer) return; // already started
      observer = new MutationObserver(onMutation);
      observer.observe(root, { childList: true, subtree: true });
    },

    stop() {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    },
  };
}
