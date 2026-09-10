/**
 * src/ats/workday.js — Workday ATS adapter
 *
 * Workday is the hardest ATS to automate:
 *  - Multi-step form with dynamic widget IDs
 *  - Custom combobox components (not native <select>)
 *  - Resume upload intercepts <input type="file"> with a click handler overlay
 *  - However, key fields in "My Information" have stable `data-automation-id` attributes
 *
 * Strategy:
 *  P5.1: Fill "My Information" text fields via data-automation-id
 *  P5.2: Custom dropdown fill
 *  P5.3: Multi-step detection + repeated sections
 *  P5.4: Resume upload click override
 *  P5.5: Questions + EEO step
 *
 * Exported API:
 *  fillWorkdayMyInfo(document, profile) → Promise<{filled, skipped}>
 *  fillWorkdayDropdown(container, value) → Promise<boolean>
 *  uploadWorkdayResume(doc, file) → boolean
 *  fillWorkdayForm(doc, profile) → Promise<{filled, skipped}>
 */

import { setNativeValue, fillSelect, attachFileToInput } from '../filler.js';
import { isFillable } from '../matcher.js';
import { runGenericFill } from '../adapters/generic.js';

// ─── data-automation-id field map ─────────────────────────────────────────────

/**
 * Map from Workday data-automation-id attribute values to profile dot-paths.
 * Only stable, well-known field IDs used across Workday tenants.
 */
const WD_AUTOMATION_MAP = [
  // Legal Name section
  { id: 'legalNameSection_firstName',  path: 'firstName' },
  { id: 'legalNameSection_lastName',   path: 'lastName' },
  { id: 'legalNameSection_middleName', path: 'middleName' },

  // Preferred name (some tenants)
  { id: 'preferredNameSection_firstName', path: 'firstName' },
  { id: 'preferredNameSection_lastName',  path: 'lastName' },

  // Contact
  { id: 'email',        path: 'email' },
  { id: 'phone-number', path: 'phone' },
  { id: 'phoneNumber',  path: 'phone' },

  // Address
  { id: 'addressSection_addressLine1', path: 'address.street' },
  { id: 'addressSection_addressLine2', path: 'address.street2' },
  { id: 'addressSection_city',         path: 'address.city' },
  { id: 'addressSection_postalCode',   path: 'address.zip' },
  { id: 'addressSection_zipCode',      path: 'address.zip' },

  // LinkedIn / Website (some Workday tenants)
  { id: 'linkedIn',  path: 'links.linkedin' },
  { id: 'website',   path: 'links.website' },
];

/**
 * Resolve a dot-path from a profile object.
 * E.g., 'address.city' → profile.address?.city
 *
 * @param {object} obj
 * @param {string} path
 * @returns {*}
 */
function resolvePath(obj, path) {
  return path.split('.').reduce((acc, key) => {
    if (acc == null) return undefined;
    return acc[key];
  }, obj);
}

// ─── fillWorkdayMyInfo ────────────────────────────────────────────────────────

/**
 * Fill Workday "My Information" text fields using data-automation-id selectors.
 *
 * @param {Document} doc
 * @param {object}   profile
 * @returns {Promise<{filled: number, skipped: number}>}
 */
export async function fillWorkdayMyInfo(doc, profile) {
  let filled = 0;
  let skipped = 0;

  for (const { id, path } of WD_AUTOMATION_MAP) {
    const el = doc.querySelector(`[data-automation-id="${id}"]`);
    if (!el || !isFillable(el)) continue;

    const value = resolvePath(profile, path);
    if (value == null || value === '') {
      skipped++;
      continue;
    }

    try {
      setNativeValue(el, String(value));
      filled++;
    } catch (err) {
      console.warn('[Autofill:workday] fill error', id, err);
      skipped++;
    }
  }

  return { filled, skipped };
}

// ─── fillWorkdayDropdown ──────────────────────────────────────────────────────

/**
 * Fill a Workday custom dropdown (not a native <select>).
 *
 * Workday dropdowns are aria comboboxes:
 *   <div role="combobox" data-automation-id="...">
 *     <input type="text" ... />
 *   </div>
 *
 * Strategy:
 *  1. Find the text input inside the combobox.
 *  2. Type the value to trigger the autocomplete.
 *  3. Wait a tick for options to render.
 *  4. Click the matching option.
 *
 * @param {Element} container  — the combobox container element
 * @param {string}  value
 * @returns {Promise<boolean>}
 */
export async function fillWorkdayDropdown(container, value) {
  if (!container || !value) return false;

  const input = container.querySelector('input[type="text"], input:not([type])');
  if (!input) return false;

  // Type into the input to trigger Workday's autocomplete
  setNativeValue(input, value);

  // Wait for options to render (Workday renders async)
  await new Promise((r) => setTimeout(r, 0));

  // Look for matching option in the listbox
  const doc = container.ownerDocument || container;
  const listbox =
    doc.querySelector('[role="listbox"]') ||
    container.querySelector('[role="listbox"]');

  if (!listbox) return false;

  const options = Array.from(listbox.querySelectorAll('[role="option"]'));
  if (options.length === 0) return false;

  const lower = value.toLowerCase();
  const match =
    options.find((o) => o.textContent.trim() === value) ||
    options.find((o) => o.textContent.trim().toLowerCase() === lower) ||
    options.find((o) => o.textContent.trim().toLowerCase().includes(lower));

  if (!match) return false;

  match.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  match.click();
  return true;
}

// ─── uploadWorkdayResume ──────────────────────────────────────────────────────

/**
 * Attach a resume file to Workday's file input.
 *
 * Workday typically overlays a custom button over a hidden file input.
 * The actual file input has data-automation-id containing "resumeUpload" or
 * is inside a [data-automation-id="resume-upload-area"] container.
 *
 * @param {Document}  doc
 * @param {File|null} file
 * @returns {boolean}
 */
export function uploadWorkdayResume(doc, file) {
  if (!file) return false;

  const input =
    doc.querySelector('[data-automation-id="file-upload-input"]') ||
    doc.querySelector('[data-automation-id*="resume"] input[type="file"]') ||
    doc.querySelector('input[type="file"]');

  if (!input) return false;

  attachFileToInput(input, file);
  return true;
}

// ─── Multi-step detection ─────────────────────────────────────────────────────

/**
 * Detect which Workday form step is currently visible by looking for
 * known data-automation-id markers.
 *
 * @param {Document} doc
 * @returns {string|null}  step name: 'myInformation' | 'experience' | 'education' |
 *                          'selfIdentify' | 'voluntaryDisclosures' | 'review' | null
 */
export function detectWorkdayStep(doc) {
  if (doc.querySelector('[data-automation-id="legalNameSection"]')) return 'myInformation';
  if (doc.querySelector('[data-automation-id="workExperienceSection"]')) return 'experience';
  if (doc.querySelector('[data-automation-id="educationSection"]')) return 'education';
  if (doc.querySelector('[data-automation-id="selfIdentifySection"]')) return 'selfIdentify';
  if (doc.querySelector('[data-automation-id="voluntaryDisclosuresSection"]')) return 'voluntaryDisclosures';
  if (doc.querySelector('[data-automation-id="reviewSection"]')) return 'review';
  return null;
}

// ─── Repeated section filler ──────────────────────────────────────────────────

/**
 * Map from sectionId to the Add button and entry automation IDs.
 */
const SECTION_REGISTRY = {
  workExperienceSection: {
    addButtonId: 'addWorkExperience',
    entryId: 'workExperienceEntry',
  },
  educationSection: {
    addButtonId: 'addEducation',
    entryId: 'educationEntry',
  },
};

/**
 * Fill a Workday repeated section (e.g. work experience, education).
 *
 * For each item:
 *  1. Count existing entries; if needed, click "Add" to create new ones.
 *  2. Get the entry element at the correct position.
 *  3. Call fillFn(entryEl, item) to fill the fields inside.
 *
 * @param {Document}  doc
 * @param {string}    sectionId   — data-automation-id of the section container
 * @param {object[]}  items       — array of profile items (work history entries, etc.)
 * @param {Function}  fillFn      — async (entryEl, item) → {filled, skipped}
 * @returns {Promise<{filled: number, skipped: number}>}
 */
export async function fillWorkdayRepeatedSection(doc, sectionId, items, fillFn) {
  let totalFilled = 0;
  let totalSkipped = 0;

  const section = doc.querySelector(`[data-automation-id="${sectionId}"]`);
  if (!section || items.length === 0) return { filled: 0, skipped: 0 };

  const registry = SECTION_REGISTRY[sectionId] || {};
  const entryId = registry.entryId;
  const addButtonId = registry.addButtonId;

  for (let i = 0; i < items.length; i++) {
    // Get existing entries
    const existingEntries = entryId
      ? section.querySelectorAll(`[data-automation-id="${entryId}"]`)
      : [];

    // If we need more entries, click "Add"
    if (existingEntries.length <= i) {
      const addBtn = addButtonId
        ? section.querySelector(`[data-automation-id="${addButtonId}"]`)
        : null;
      if (addBtn) {
        addBtn.click();
        // Wait for DOM update
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    // Re-query after potential "Add" click
    const entries = entryId
      ? section.querySelectorAll(`[data-automation-id="${entryId}"]`)
      : [];
    const entryEl = entries[i] || section; // fallback to section if no specific entry

    try {
      const result = await fillFn(entryEl, items[i]);
      totalFilled += result?.filled ?? 0;
      totalSkipped += result?.skipped ?? 0;
    } catch (err) {
      console.warn('[Autofill:workday] fillRepeatedSection error', sectionId, i, err);
      totalSkipped++;
    }
  }

  return { filled: totalFilled, skipped: totalSkipped };
}

// ─── Click intercept for Workday resume upload ───────────────────────────────

/**
 * Override `HTMLInputElement.prototype.click` so that when Workday's overlay
 * button dynamically creates a file input and calls `.click()` on it, we
 * intercept and attach the file programmatically instead of opening the
 * native file dialog.
 *
 * @param {Document}  doc
 * @param {File}      file  — the file to attach when any file input is clicked
 * @returns {Function}      — cleanup: call to restore the original click
 */
export function interceptWorkdayFileInput(doc, file) {
  const win = doc.defaultView || doc.ownerDocument?.defaultView;
  if (!win) return () => {};

  const InputProto = win.HTMLInputElement.prototype;
  const originalClick = InputProto.click;

  InputProto.click = function interceptedClick() {
    if (this.type === 'file') {
      // Attach the file instead of opening the native picker
      attachFileToInput(this, file);
      return;
    }
    // Not a file input — call original
    return originalClick.call(this);
  };

  // Return cleanup function
  return function cleanup() {
    InputProto.click = originalClick;
  };
}

// ─── fillWorkdayForm ─────────────────────────────────────────────────────────

/**
 * Fill a full Workday application form.
 *
 * Strategy:
 *  1. Fill known fields via data-automation-id (fillWorkdayMyInfo).
 *  2. Fall back to generic adapter for remaining fields.
 *
 * @param {Document} doc
 * @param {object}   profile
 * @returns {Promise<{filled: number, skipped: number}>}
 */
export async function fillWorkdayForm(doc, profile) {
  const myInfoResult = await fillWorkdayMyInfo(doc, profile);

  const genericResult = await runGenericFill(doc, profile);

  return {
    filled: myInfoResult.filled + genericResult.filled,
    skipped: myInfoResult.skipped + genericResult.skipped,
  };
}
