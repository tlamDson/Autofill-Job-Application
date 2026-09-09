/**
 * src/filler.js — DOM filling helpers
 *
 * These run in the MAIN world (injected.js) and in unit tests (jsdom).
 * No Chrome APIs here — pure DOM manipulation only.
 */

// ─── P1.9 — setNativeValue ────────────────────────────────────────────────────

/**
 * Set the value of an <input> or <textarea> in a way that React/Vue
 * controlled components will acknowledge. Dispatches `input` + `change`
 * synthetic events after updating the value.
 *
 * Strategy:
 *  1. Try to find and call the *prototype*-level native setter
 *     (bypasses React's own property override which blocks value updates).
 *  2. Fall back to direct assignment.
 *  3. Dispatch `input` then `change` events.
 *
 * @param {HTMLInputElement|HTMLTextAreaElement} el
 * @param {string} value
 */
export function setNativeValue(el, value) {
  // Get the prototype-level "value" setter so we can bypass React/Vue overrides.
  const proto = el.constructor?.prototype ?? Object.getPrototypeOf(el);
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');

  if (descriptor && descriptor.set) {
    descriptor.set.call(el, value);
  } else {
    // Fallback: check for own property descriptor (e.g., test mocks)
    const ownDescriptor = Object.getOwnPropertyDescriptor(el, 'value');
    if (ownDescriptor && ownDescriptor.set) {
      ownDescriptor.set.call(el, value);
    } else {
      el.value = value;
    }
  }

  // Dispatch events so React/Vue synthesize the onChange
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}
