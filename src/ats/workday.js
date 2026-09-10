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
