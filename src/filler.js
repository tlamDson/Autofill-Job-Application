/**
 * src/filler.js — DOM filling helpers
 *
 * These run in the MAIN world (injected.js) and in unit tests (jsdom).
 * No Chrome APIs here — pure DOM manipulation only.
 *
 * Exported API:
 *   setNativeValue(el, value)       — P1.9
 *   detectDateRole(selectEl)        — P1.10
 *   fillSelect(selectEl, value)     — P1.10
 */

// ─── P1.10 — detectDateRole + fillSelect ─────────────────────────────────────

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

/**
 * Determine whether a <select> is a date-part picker: 'month', 'year', or 'day'.
 * Returns null if not recognisable.
 *
 * Strategy:
 *  1. Check name/id/aria-label attributes for keywords.
 *  2. Sniff option values/text content.
 *
 * @param {HTMLSelectElement} el
 * @returns {'month'|'year'|'day'|null}
 */
export function detectDateRole(el) {
  const hint = [
    el.name || '',
    el.id || '',
    el.getAttribute('aria-label') || '',
    el.getAttribute('placeholder') || '',
  ].join(' ').toLowerCase();

  // Use \b only on word/non-word boundaries; underscores are word chars,
  // so "birth_year" would not match \byear\b. Use (^|[^a-z]) lookahead instead.
  if (/(?:^|[^a-z])month(?:[^a-z]|$)/.test(hint)) return 'month';
  if (/(?:^|[^a-z])year(?:[^a-z]|$)/.test(hint)) return 'year';
  if (/(?:^|[^a-z])day(?:[^a-z]|$)/.test(hint)) return 'day';

  // Sniff options
  const optTexts = Array.from(el.options).map((o) => (o.text || '').trim().toLowerCase());
  const optVals = Array.from(el.options).map((o) => (o.value || '').trim());

  if (optTexts.some((t) => MONTH_NAMES.includes(t))) return 'month';
  if (optVals.filter((v) => /^\d{4}$/.test(v)).length >= 2) return 'year';
  if (optVals.filter((v) => /^\d{1,2}$/.test(v) && +v >= 1 && +v <= 31).length >= 10) return 'day';

  return null;
}

/**
 * Fill a <select> element.
 *
 * Logic:
 *  1. If value looks like a yyyy-mm date string, detect the role of this
 *     select (month/year) and extract the appropriate part.
 *  2. Try to match by option value (exact).
 *  3. Try to match by option text (case-insensitive).
 *  4. Try partial text match as last resort.
 *  5. Dispatch change event on success.
 *
 * @param {HTMLSelectElement} el
 * @param {string} value  — may be a raw value or a "yyyy-mm" date string
 */
export function fillSelect(el, value) {
  const str = String(value).trim();

  // Resolve date-part selects
  let targetValue = str;
  const dateMatch = str.match(/^(\d{4})-(\d{2})$/);
  if (dateMatch) {
    const role = detectDateRole(el);
    if (role === 'year') {
      targetValue = dateMatch[1];
    } else if (role === 'month') {
      targetValue = String(parseInt(dateMatch[2], 10)); // strip leading zero
    }
    // day role: date strings rarely drive day pickers — pass through as-is
  }

  // Try exact value match
  const opts = Array.from(el.options);
  let match = opts.find((o) => o.value === targetValue);

  // Try case-insensitive text match
  if (!match) {
    const lower = targetValue.toLowerCase();
    match = opts.find((o) => o.text.trim().toLowerCase() === lower);
  }

  // Try partial text match as last resort
  if (!match) {
    const lower = targetValue.toLowerCase();
    match = opts.find((o) => o.text.trim().toLowerCase().includes(lower));
  }

  if (!match) return; // no match — leave unchanged

  el.value = match.value;
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

// ─── P1.13 — attachFileToInput ───────────────────────────────────────────────

/**
 * Attach a File/Blob to an <input type="file"> element.
 *
 * Strategy:
 *  1. Build a DataTransfer, add the file, assign dt.files to input.files.
 *  2. If DataTransfer is unavailable (extension sandbox), fall back to
 *     Object.defineProperty to set a minimal FileList-like object.
 *  3. Dispatch `change` event.
 *
 * NOTE: This requires MAIN world execution (injected.js) because content scripts
 * cannot assign input.files in some browser versions.
 *
 * @param {HTMLInputElement} input
 * @param {File|Blob|null}   file
 */
export function attachFileToInput(input, file) {
  if (!file) return;

  try {
    if (typeof DataTransfer !== 'undefined') {
      const dt = new DataTransfer();
      // DataTransfer.items.add requires a File, not a Blob
      const f = file instanceof File ? file : new File([file], 'resume.pdf', { type: file.type || 'application/pdf' });
      dt.items.add(f);
      // In MAIN world, input.files is assignable via the descriptor
      const proto = input.constructor?.prototype ?? Object.getPrototypeOf(input);
      const desc = Object.getOwnPropertyDescriptor(proto, 'files');
      if (desc && desc.set) {
        desc.set.call(input, dt.files);
      } else {
        input.files = dt.files;
      }
    } else {
      throw new Error('DataTransfer unavailable');
    }
  } catch {
    // Best-effort fallback: define a minimal FileList-like own property
    const f = file instanceof File ? file : new File([file], 'resume.pdf', { type: file.type || 'application/pdf' });
    const fakeFileList = {
      0: f,
      length: 1,
      item: (i) => (i === 0 ? f : null),
      [Symbol.iterator]: function* () { yield f; },
    };
    try {
      Object.defineProperty(input, 'files', {
        value: fakeFileList,
        writable: true,
        configurable: true,
      });
    } catch {
      // Cannot set files — continue to fire event anyway
    }
  }

  input.dispatchEvent(new Event('change', { bubbles: true }));
}

// ─── P1.12 — fillCombobox ────────────────────────────────────────────────────

/**
 * Fill a custom aria-combobox widget.
 *
 * Strategy:
 *  1. Find the text input inside the combobox container.
 *  2. Type the target value into it (triggers input event → listbox should appear).
 *  3. Wait a tick for the listbox to render.
 *  4. Find a matching [role="option"] by text (case-insensitive).
 *  5. Fire mousedown + click on that option.
 *  6. Return true if an option was matched, false otherwise.
 *
 * This is intentionally synchronous-friendly: it uses a minimal setTimeout(0)
 * to allow the DOM to react to the input event before scanning for options.
 *
 * @param {HTMLElement} container  — element with role="combobox"
 * @param {string}      value      — desired option text
 * @returns {Promise<boolean>}
 */
export async function fillCombobox(container, value) {
  // Find the text input inside the combobox
  const input = container.querySelector('input[type="text"], input[aria-autocomplete]') ||
                container.querySelector('input');
  if (!input) return false;

  // Type into the input to trigger filtering
  setNativeValue(input, value);

  // Wait a tick for the listbox to appear
  await new Promise((resolve) => setTimeout(resolve, 0));

  // Find the listbox
  const listbox = container.querySelector('[role="listbox"]') ||
                  document.getElementById(container.getAttribute('aria-controls') || '') ||
                  container;

  // Find matching option
  const lower = value.toLowerCase().trim();
  const options = Array.from(
    listbox.querySelectorAll('[role="option"]')
  );

  // Prefer exact match, then starts-with, then includes
  let match =
    options.find((o) => o.textContent.trim().toLowerCase() === lower) ||
    options.find((o) => o.textContent.trim().toLowerCase().startsWith(lower)) ||
    options.find((o) => o.textContent.trim().toLowerCase().includes(lower));

  if (!match) return false;

  // Fire mousedown then click (mimics real user interaction)
  match.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  match.dispatchEvent(new MouseEvent('click', { bubbles: true }));

  // Update the input value to the matched option's text
  setNativeValue(input, match.textContent.trim());

  return true;
}

// ─── P1.11 — fillSplitNumber ─────────────────────────────────────────────────

/**
 * Fill phone number fields that are split across multiple inputs.
 *
 * Supported layouts:
 *  1. Single input — fills with `countryCode + localNumber` (or just localNumber).
 *  2. Two inputs where first looks like country-code (name/id hint) — fills
 *     countryCode into first, localNumber into second.
 *  3. Three inputs (area/exchange/number) — splits the local portion into
 *     3+3+4 digit groups (US style) using each input's maxlength as guidance.
 *
 * @param {HTMLInputElement[]} inputs   — ordered list of input elements
 * @param {string|null}        countryCode  — e.g. "+1", "+84"; may be null
 * @param {string}             localNumber  — digits only or full E.164 string
 */
export function fillSplitNumber(inputs, countryCode, localNumber) {
  if (!inputs || inputs.length === 0) return;

  // Normalise localNumber: strip leading country code if full E.164 was passed
  let local = String(localNumber || '').trim();
  let cc = String(countryCode || '').trim();

  // Helper: is this input a country-code picker?
  function isCountryCodeInput(el) {
    const hint = ((el.name || '') + ' ' + (el.id || '')).toLowerCase();
    return /country.?code|phone.?code|dial.?code|cc\b|isd/.test(hint);
  }

  // Single input — fill with cc+local or just local
  if (inputs.length === 1) {
    const full = cc ? `${cc}${local}` : local;
    setNativeValue(inputs[0], full);
    return;
  }

  // Two inputs — detect country-code role on first input
  if (inputs.length === 2) {
    if (cc && (isCountryCodeInput(inputs[0]) || !isCountryCodeInput(inputs[1]))) {
      setNativeValue(inputs[0], cc);
      setNativeValue(inputs[1], local);
    } else {
      // No country code split — fill first with cc+local, second with local
      setNativeValue(inputs[0], cc || local);
      setNativeValue(inputs[1], local);
    }
    return;
  }

  // Three+ inputs — split local digits into chunks guided by maxlength
  // Strip all non-digits from local (and leading country code digits)
  let digits = local.replace(/\D/g, '');
  // If country code passed and local starts with its digits, strip them
  if (cc) {
    const ccDigits = cc.replace(/\D/g, '');
    if (digits.startsWith(ccDigits)) digits = digits.slice(ccDigits.length);
  }

  // Calculate total capacity from maxlength attributes
  const maxLens = inputs.map((el) => parseInt(el.getAttribute('maxlength') || '0', 10));
  const totalCapacity = maxLens.reduce((s, n) => s + n, 0);
  // If digits exceed capacity, strip excess from the front (country code prefix)
  if (totalCapacity > 0 && digits.length > totalCapacity) {
    digits = digits.slice(digits.length - totalCapacity);
  }

  inputs.forEach((input, i) => {
    const chunkLen = maxLens[i] > 0 ? maxLens[i] : (i === inputs.length - 1 ? digits.length : 3);
    const chunk = digits.slice(0, chunkLen);
    digits = digits.slice(chunkLen);
    setNativeValue(input, chunk);
  });
}

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
