/**
 * src/adapters/generic.js — Generic heuristic adapter
 *
 * Ties together matcher.js + filler.js to produce a fill plan for any form.
 * Runs in MAIN world (no Chrome APIs).
 *
 * Exported API:
 *   buildFillPlan(document, profile, settings?, stats?) → Array<{el, key, value}>
 *   fillField(el, key, value, document) → Promise<void>
 *   runGenericFill(document, profile, settings?) → Promise<{filled, skipped, skippedByUser}>
 */

import { buildContext, classifyField, isFillable } from '../matcher.js';
import { setNativeValue, fillSelect, fillCombobox, selectDeclineOption } from '../filler.js';
import { isFieldEnabled } from '../settings/fieldGroups.js';

/**
 * Keys where an explicit empty string in the profile means "decline to
 * answer" (as opposed to `null`/`undefined`, which means "no opinion, don't
 * touch this field"). Limited to EEO/demographic questions, where a real
 * "decline" option is a standard, expected choice — an empty string for,
 * say, a name or school field has no such equivalent and should just be
 * skipped.
 */
const DECLINE_ELIGIBLE_KEYS = new Set(['gender', 'race', 'veteranStatus', 'disabilityStatus', 'hispanicLatino']);

// ─── Profile value resolution ─────────────────────────────────────────────────

/**
 * Map from classifyField keys to profile field paths.
 * Simple keys map directly; list keys (education, workHistory) default to [0].
 */
const KEY_TO_PROFILE_PATH = {
  firstName: 'personal.firstName',
  lastName: 'personal.lastName',
  fullName: '__computed_fullName',
  preferredName: 'personal.preferredName',
  email: 'personal.email',
  phone: 'personal.phone',
  phoneCountryCode: '__computed_phoneCountryCode',
  addressLine1: 'personal.address.line1',
  addressLine2: 'personal.address.line2',
  city: 'personal.address.city',
  state: 'personal.address.state',
  postalCode: 'personal.address.postalCode',
  country: 'personal.address.country',
  linkedin: 'links.linkedin',
  github: 'links.github',
  portfolio: 'links.portfolio',
  website: 'links.website',
  pronouns: 'personal.pronouns',
  // Education [0]
  school: 'education.0.school',
  degree: 'education.0.degree',
  fieldOfStudy: 'education.0.fieldOfStudy',
  gpa: 'education.0.gpa',
  eduStartDate: 'education.0.startDate',
  eduEndDate: 'education.0.endDate',
  // Work history [0]
  company: 'workHistory.0.company',
  jobTitle: 'workHistory.0.title',
  workStartDate: 'workHistory.0.startDate',
  workEndDate: 'workHistory.0.endDate',
  jobDescription: 'workHistory.0.description',
  workLocation: 'workHistory.0.location',
  // Work auth
  needsSponsorship: 'workAuthorization.needsSponsorship',
  authorizedToWork: 'workAuthorization.authorizedToWork',
  visaStatus: 'workAuthorization.visaStatus',
  // EEO
  gender: 'eeo.gender',
  race: 'eeo.race',
  veteranStatus: 'eeo.veteranStatus',
  disabilityStatus: 'eeo.disabilityStatus',
  hispanicLatino: 'eeo.hispanicLatino',
  // Compensation
  desiredSalary: 'compensation.desiredSalaryMin',
  noticePeriod: 'compensation.noticePeriod',
  // Consent
  termsAgreement: 'consents.agreeToTerms',
};

/**
 * Resolve a dot-separated path from a profile object.
 * "workHistory.0.company" → profile.workHistory?.[0]?.company
 */
function resolvePath(obj, path) {
  if (!path || !obj) return undefined;
  return path.split('.').reduce((acc, key) => {
    if (acc == null) return undefined;
    // Handle numeric keys for arrays
    return acc[isNaN(key) ? key : +key];
  }, obj);
}

/**
 * Get the profile value for a classified field key.
 * Handles computed values like fullName and phoneCountryCode.
 */
function getProfileValue(key, profile) {
  const personal = profile.personal || {};

  if (key === '__computed_fullName' || key === 'fullName') {
    const fn = personal.firstName || '';
    const ln = personal.lastName || '';
    return [fn, ln].filter(Boolean).join(' ') || undefined;
  }
  if (key === '__computed_phoneCountryCode' || key === 'phoneCountryCode') {
    // Extract +XX from phone E.164
    const m = (personal.phone || '').match(/^(\+\d{1,3})/);
    return m ? m[1] : undefined;
  }

  const path = KEY_TO_PROFILE_PATH[key];
  if (!path) return undefined;
  if (path.startsWith('__computed')) return undefined;

  return resolvePath(profile, path);
}

/**
 * Whether `el` already holds a value, so a re-scan (e.g. after new fields
 * appear on a multi-step form) should leave it alone instead of re-filling it.
 * Checkbox/radio are excluded: their `.value` attribute is a fixed string
 * unrelated to `.checked`, and fillField() is already a no-op when the
 * checked state already matches the target.
 */
function alreadyHasValue(el) {
  const type = (el.type || '').toLowerCase();
  if (type === 'checkbox' || type === 'radio') return false;
  return !!el.value;
}

// ─── buildFillPlan ────────────────────────────────────────────────────────────

/**
 * Scan all form fields in `document` and produce a fill plan.
 * Idempotent: a field that already holds a value is left alone, so calling
 * this again after new fields appear (multi-step forms) only targets those.
 *
 * @param {Document}  doc
 * @param {object}    profile   — normalised user profile
 * @param {object}    [settings] — user settings (disabledFields); all fields enabled if omitted
 * @param {object}    [stats]    — optional mutable counter object; stats.skippedByUser is
 *                                 incremented for each classified field skipped by settings
 * @returns {Array<{el: HTMLElement, key: string, value: any}>}
 */
export function buildFillPlan(doc, profile, settings = {}, stats) {
  const plan = [];

  const inputs = Array.from(
    doc.querySelectorAll(
      'input:not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]):not([type="hidden"]), select, textarea'
    )
  );

  for (const el of inputs) {
    if (!isFillable(el)) continue;

    const ctx = buildContext(el);
    const key = classifyField(ctx);
    if (!key) continue;

    if (!isFieldEnabled(settings, key)) {
      if (stats) stats.skippedByUser = (stats.skippedByUser || 0) + 1;
      continue;
    }

    if (alreadyHasValue(el)) continue;

    const value = getProfileValue(key, profile);

    // Consent checkboxes are only ever auto-ticked on an explicit, deliberate
    // opt-in — false/null/undefined all mean "leave this field alone".
    if (key === 'termsAgreement') {
      if (value !== true) continue;
      plan.push({ el, key, value });
      continue;
    }

    // An explicit empty string on a decline-eligible (EEO/demographic) key
    // means "decline to answer" — a real, expected choice on such forms —
    // rather than "no value available", which is what an empty string means
    // for every other field.
    const declined = value === '' && DECLINE_ELIGIBLE_KEYS.has(key);
    if (value == null) continue;
    if (value === '' && !declined) continue;

    plan.push({ el, key, value, declined });
  }

  return plan;
}

// ─── fillField ────────────────────────────────────────────────────────────────

/**
 * Fill a single field element given its classified key and value.
 * Routes to the correct filler based on element type.
 *
 * @param {HTMLElement}  el
 * @param {string}       key       — classified profile key
 * @param {any}          value     — profile value to fill
 * @param {Document}     doc       — owning document (for radio siblings)
 * @param {boolean}      [declined] — when true, select a "decline to answer"
 *   option instead of `value` (see DECLINE_ELIGIBLE_KEYS in buildFillPlan)
 * @returns {Promise<boolean>} whether the field was actually filled — false
 *   (rather than a thrown error) is how a combobox with no matching option
 *   reports failure, so callers must check this instead of assuming any
 *   non-throwing call succeeded.
 */
export async function fillField(el, key, value, doc, declined = false) {
  if (declined) return selectDeclineOption(el);
  if (value == null || value === '') return false;

  const tagName = el.tagName.toLowerCase();
  const type = (el.type || '').toLowerCase();

  // Checkbox
  if (type === 'checkbox') {
    const checked = value === true || value === 'true' || value === '1' || value === 'yes';
    if (el.checked !== checked) {
      el.checked = checked;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  }

  // Radio group — find sibling with matching value
  if (type === 'radio') {
    const name = el.getAttribute('name');
    // CSS.escape not available in Node/jsdom — escape double-quotes manually
    const escapedName = name ? name.replace(/"/g, '\\"') : '';
    const radios = name
      ? Array.from((doc || el.ownerDocument).querySelectorAll(`input[type="radio"][name="${escapedName}"]`))
      : [el];
    const lower = String(value).toLowerCase();
    const match =
      radios.find((r) => r.value === String(value)) ||
      radios.find((r) => r.value.toLowerCase() === lower) ||
      radios.find((r) => r.value.toLowerCase().includes(lower));
    if (match && !match.checked) {
      match.checked = true;
      match.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return Boolean(match);
  }

  // Native <select>
  if (tagName === 'select') {
    fillSelect(el, String(value));
    return true;
  }

  // aria-combobox container (custom dropdown)
  const role = el.getAttribute('role');
  if (role === 'combobox') {
    return fillCombobox(el, String(value));
  }

  // textarea / text input (default)
  setNativeValue(el, String(value));
  return true;
}

// ─── runGenericFill ───────────────────────────────────────────────────────────

/**
 * Run the full generic fill pipeline on the current document.
 *
 * @param {Document}  doc
 * @param {object}    profile
 * @param {object}    [settings] — user settings (disabledFields); all fields enabled if omitted
 * @returns {Promise<{filled: number, skipped: number, skippedByUser: number}>}
 */
export async function runGenericFill(doc, profile, settings = {}) {
  const stats = { skippedByUser: 0 };
  const plan = buildFillPlan(doc, profile, settings, stats);
  let filled = 0;
  let skipped = 0;

  for (const { el, key, value, declined } of plan) {
    try {
      const ok = await fillField(el, key, value, doc, declined);
      if (ok) filled++;
      else skipped++;
    } catch (err) {
      console.warn('[Autofill] fillField error', key, err);
      skipped++;
    }
  }

  return { filled, skipped, skippedByUser: stats.skippedByUser };
}
