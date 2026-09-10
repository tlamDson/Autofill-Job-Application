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
 * @param {string}           [fileName] — when given, the attached file is renamed to this
 *                                        (overrides the original File's own name)
 */
export function attachFileToInput(input, file, fileName) {
  if (!file) return;

  function toNamedFile(f) {
    if (fileName) return new File([f], fileName, { type: f.type || 'application/pdf' });
    return f instanceof File ? f : new File([f], 'resume.pdf', { type: f.type || 'application/pdf' });
  }

  try {
    if (typeof DataTransfer !== 'undefined') {
      const dt = new DataTransfer();
      const f = toNamedFile(file);
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
    const f = toNamedFile(file);
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

/**
 * Resolve the filename to use when attaching a resume, per settings.resumeFileName.
 *
 * - 'useMyName' (default): "First_Last_Resume.<ext>" from profile.personal, keeping
 *   the original extension. Falls back to originalName if the profile has no name.
 * - anything else (e.g. 'original'), or missing profile/settings: originalName unchanged.
 *
 * @param {object} [profile]
 * @param {object} [settings]
 * @param {string} [originalName]
 * @returns {string}
 */
export function resolveResumeFileName(profile, settings, originalName) {
  if (settings?.resumeFileName !== 'useMyName') return originalName;

  const firstName = (profile?.personal?.firstName || '').trim();
  const lastName = (profile?.personal?.lastName || '').trim();
  const nameParts = [firstName, lastName].filter(Boolean);
  if (nameParts.length === 0) return originalName;

  const base = nameParts.join('_').replace(/\s+/g, '_');
  const dotIdx = (originalName || '').lastIndexOf('.');
  const ext = dotIdx > -1 ? originalName.slice(dotIdx + 1) : 'pdf';
  return `${base}_Resume.${ext}`;
}

// ─── P1.12 — fillCombobox ────────────────────────────────────────────────────

/**
 * Build the ordered list of candidate strings to try against a combobox's
 * options for a given target value. Plain (non-date) values pass through
 * unchanged. A "yyyy-mm" date string (as stored for education/work-history
 * start/end dates) expands to month-name/abbreviation/numeric and bare-year
 * variants, since a real form commonly renders start/end dates as two
 * *separate* comboboxes (month, year) rather than one combined picker — each
 * one only recognizes its own half. Candidates are ordered most→least likely
 * to be real option text; the raw "yyyy-mm" string itself is deliberately not
 * included, since no observed real form renders it verbatim as an option.
 *
 * @param {string} value
 * @returns {string[]}
 */
function dateCandidates(value) {
  const str = String(value).trim();
  const m = str.match(/^(\d{4})-(\d{2})$/);
  if (!m) return [str];

  const [, year, monthNum] = m;
  const monthName = MONTH_NAMES[parseInt(monthNum, 10) - 1];
  if (!monthName) return [str, year];

  const capitalized = monthName[0].toUpperCase() + monthName.slice(1);
  const abbrev = capitalized.slice(0, 3);
  const unpadded = String(parseInt(monthNum, 10));

  return [capitalized, abbrev, unpadded, monthNum, year];
}

/**
 * Fill a custom aria-combobox widget (e.g. React-Select).
 *
 * Handles two DOM shapes:
 *  (a) role="combobox" on a wrapper <div> with a nested <input> — the shape
 *      test fixtures have historically assumed.
 *  (b) role="combobox" directly on the <input> itself — what real React-Select
 *      widgets (e.g. Greenhouse's application form) actually render. Since
 *      buildFillPlan() only ever queries input/select/textarea, this is in
 *      practice the *only* shape that ever reaches this function outside tests.
 *
 * Strategy:
 *  1. Resolve the text input: `container` itself if it already is one, else
 *     search its descendants.
 *  2. Open the menu the way React-Select does — mousedown (not just focus)
 *     opens it.
 *  3. For each date candidate (see dateCandidates — a single candidate for
 *     non-date values), type it to trigger the widget's filter and poll
 *     briefly for the listbox to render, since real widgets render options
 *     asynchronously and a single setTimeout(0) can fire too early.
 *  4. Resolve the listbox via aria-controls / aria-owns / a container-scoped
 *     search, falling back to a document-wide search — real widgets commonly
 *     portal their menu outside the input's DOM subtree entirely.
 *  5. Match by text (exact → starts-with → includes) and fire
 *     mousedown + mouseup + click on the option, mirroring real user input.
 *  6. If no [role="option"] ever appears for any candidate, fall back to
 *     ArrowDown + Enter, which commits React-Select's own highlighted (first
 *     filtered) option.
 *  7. Verify by reading the input's own value back, and return an honest
 *     boolean — never claim success when nothing actually matched.
 *
 * @param {HTMLElement} container  — element with role="combobox" (input or wrapper)
 * @param {string}      value      — desired option text, or a "yyyy-mm" date string
 * @returns {Promise<boolean>}
 */
export async function fillCombobox(container, value) {
  const doc = container.ownerDocument || document;

  const input = container.matches?.('input')
    ? container
    : container.querySelector('input[type="text"], input[aria-autocomplete]') ||
      container.querySelector('input');
  if (!input) return false;

  // React-Select opens its menu on mousedown, not merely on focus.
  input.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  input.focus();

  function resolveListbox() {
    const controlsId = input.getAttribute('aria-controls') || container.getAttribute('aria-controls');
    const ownsId = input.getAttribute('aria-owns') || container.getAttribute('aria-owns');
    return (
      (controlsId && doc.getElementById(controlsId)) ||
      (ownsId && doc.getElementById(ownsId)) ||
      container.querySelector('[role="listbox"]') ||
      doc.querySelector('[role="listbox"]') ||
      container
    );
  }

  function findMatch(listbox, lower) {
    const options = Array.from(listbox.querySelectorAll('[role="option"]'));
    // The "includes" fallback is skipped for short candidates (e.g. an
    // unpadded month digit like "9") — otherwise it can false-positive match
    // an unrelated option purely because it contains that digit as a
    // substring (e.g. "9" inside the year "2019"). exact/startsWith are safe
    // at any length: "2019" does not start with "9".
    return (
      options.find((o) => o.textContent.trim().toLowerCase() === lower) ||
      options.find((o) => o.textContent.trim().toLowerCase().startsWith(lower)) ||
      (lower.length >= 3 && options.find((o) => o.textContent.trim().toLowerCase().includes(lower))) ||
      null
    );
  }

  for (const candidate of dateCandidates(value)) {
    setNativeValue(input, candidate);
    const lower = candidate.toLowerCase().trim();

    // Poll briefly for the listbox/options to render — real widgets update
    // asynchronously in response to the input event dispatched above.
    let match = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      match = findMatch(resolveListbox(), lower);
      if (match) break;
      await new Promise((resolve) => setTimeout(resolve, 30));
    }

    if (match) {
      match.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      match.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      match.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      setNativeValue(input, match.textContent.trim());
      return true;
    }
  }

  // Keyboard fallback: no [role="option"] ever rendered via ARIA for any
  // candidate (e.g. the widget virtualizes its list), but a real combobox
  // commonly still highlights a best match internally that Enter commits.
  const beforeKeyboard = (input.value || '').trim().toLowerCase();
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 30));

  // Only claim success if the widget itself changed the input's value in
  // response — e.g. replacing the typed filter text with the committed
  // option's label. If it's unchanged, nothing was actually confirmed and
  // claiming success would be exactly the silent false-positive this
  // function used to produce.
  const afterKeyboard = (input.value || '').trim().toLowerCase();
  return Boolean(afterKeyboard) && afterKeyboard !== beforeKeyboard;
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
