/**
 * src/ats/lever.js — Lever ATS adapter
 *
 * Lever's application form uses:
 *  - `name="name"` for the single full-name field (not first/last split)
 *  - `name="email"`, `name="phone"` for contact info
 *  - `name="urls[LinkedIn]"`, `name="urls[GitHub]"` etc for links
 *  - Custom questions with `name="cards[][field_sets][][fields][][value]"` pattern
 *  - EEO selects with `name="eeo[...]"` pattern
 *
 * Exported API:
 *   fillLeverForm(document, profile) → Promise<{filled, skipped}>
 */

import { setNativeValue, fillSelect, attachFileToInput, resolveResumeFileName } from '../filler.js';
import { isFillable } from '../matcher.js';
import { runGenericFill } from '../adapters/generic.js';

// ─── Lever field mapping ──────────────────────────────────────────────────────

/**
 * Resolve a profile value for a given Lever field `name` attribute.
 * @param {string} fieldName
 * @param {object} profile
 * @returns {string|undefined}
 */
function resolveLeverValue(fieldName, profile) {
  const links = profile.links || {};

  const LEVER_MAP = {
    // Full name (Lever's main differentiator — uses a single "name" field)
    name: profile.firstName && profile.lastName
      ? `${profile.firstName} ${profile.lastName}`.trim()
      : profile.firstName || profile.lastName,

    // Contact
    email: profile.email,
    phone: profile.phone,

    // Links (Lever uses `urls[LinkedIn]` etc)
    'urls[LinkedIn]': links.linkedin,
    'urls[GitHub]': links.github,
    'urls[Portfolio]': links.portfolio,
    'urls[Twitter]': links.twitter,
    'urls[Other]': links.website,

    // Cover letter / summary (generic text)
    comments: undefined, // user-specific, skip
    org: undefined,       // company — don't pre-fill
  };

  return LEVER_MAP[fieldName];
}

// ─── Main fill function ───────────────────────────────────────────────────────

/**
 * Fill a Lever application form.
 *
 * Strategy:
 *  1. Find all standard Lever fields by `name` attribute.
 *  2. Fill with precise mapping (resolves fullName etc).
 *  3. Fall back to generic adapter for remaining fields.
 *
 * @param {Document} doc
 * @param {object}   profile
 * @returns {Promise<{filled: number, skipped: number}>}
 */
export async function fillLeverForm(doc, profile) {
  let filled = 0;
  let skipped = 0;

  // Known Lever field names to fill with precision
  const LEVER_FIELD_NAMES = [
    'name',
    'email',
    'phone',
    'urls[LinkedIn]',
    'urls[GitHub]',
    'urls[Portfolio]',
    'urls[Twitter]',
    'urls[Other]',
  ];

  for (const fieldName of LEVER_FIELD_NAMES) {
    const el = doc.querySelector(`[name="${fieldName}"]`);
    if (!el || !isFillable(el)) {
      // Not present or not fillable — not skipped, just absent
      continue;
    }

    const value = resolveLeverValue(fieldName, profile);
    if (value == null || value === '') {
      skipped++;
      continue;
    }

    try {
      const tagName = el.tagName.toLowerCase();
      if (tagName === 'select') {
        fillSelect(el, String(value));
      } else {
        setNativeValue(el, String(value));
      }
      filled++;
    } catch (err) {
      console.warn('[Autofill:lever] fillField error', fieldName, err);
      skipped++;
    }
  }

  // Generic fallback for remaining fields (custom questions, EEO, etc.)
  const genericResult = await runGenericFill(doc, profile);
  filled += genericResult.filled;
  skipped += genericResult.skipped;

  return { filled, skipped };
}

// ─── EEO fill ────────────────────────────────────────────────────────────────

const DECLINE_PATTERNS_LEVER = /decline|prefer not|don.?t wish|not to answer/i;

/**
 * Fill Lever's EEO section (selects with `name="eeo[...]"`).
 *
 * @param {Document} doc
 * @param {object}   profile
 */
export async function fillLeverEEO(doc, profile) {
  const eeo = profile.eeo || {};

  const EEO_MAP = {
    'eeo[gender]': eeo.gender,
    'eeo[race]': eeo.race,
    'eeo[veteran]': eeo.veteranStatus,
    'eeo[disability]': eeo.disabilityStatus,
  };

  for (const [selector, rawValue] of Object.entries(EEO_MAP)) {
    const el = doc.querySelector(`[name="${selector}"]`);
    if (!el || el.tagName.toLowerCase() !== 'select') continue;

    if (rawValue != null && rawValue !== '') {
      fillSelect(el, String(rawValue));
    } else if (rawValue === '') {
      // Auto-select "decline" option
      const opts = Array.from(el.options);
      const declineOpt = opts.find((o) => DECLINE_PATTERNS_LEVER.test(o.text));
      if (declineOpt) {
        el.value = declineOpt.value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }
}

// ─── Card question fill ───────────────────────────────────────────────────────

/**
 * Fill a single Lever card question field.
 * A card question is a `<div class="card-field">` containing either:
 *  - A set of radio inputs (single-choice)
 *  - A text/textarea input (open-ended)
 *  - A <select> (single-choice dropdown)
 *
 * @param {Element} fieldEl  — the .card-field container
 * @param {string}  value    — the value to fill
 */
export async function fillLeverCardQuestion(fieldEl, value) {
  if (!fieldEl || value == null) return;

  // Try radio buttons first
  const radios = Array.from(fieldEl.querySelectorAll('input[type="radio"]'));
  if (radios.length > 0) {
    const lower = String(value).toLowerCase();
    const match =
      radios.find((r) => r.value === String(value)) ||
      radios.find((r) => r.value.toLowerCase() === lower) ||
      radios.find((r) => r.value.toLowerCase().includes(lower));
    if (match) {
      match.checked = true;
      match.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return;
  }

  // Try <select>
  const select = fieldEl.querySelector('select');
  if (select) {
    fillSelect(select, String(value));
    return;
  }

  // Try text input / textarea
  const textInput = fieldEl.querySelector('input[type="text"], input[type="number"], textarea');
  if (textInput) {
    setNativeValue(textInput, String(value));
  }
}

// ─── Resume upload ────────────────────────────────────────────────────────────

/**
 * Attach a resume File to Lever's `<input type="file">`.
 * Lever's resume input typically has `name="resume"` or `id*="resume"`.
 *
 * @param {Document}  doc
 * @param {File|null} file
 * @param {object}    [profile]
 * @param {object}    [settings]
 * @returns {boolean}
 */
export function uploadLeverResume(doc, file, profile, settings) {
  if (!file) return false;

  const input =
    doc.querySelector('input[type="file"][name="resume"]') ||
    doc.querySelector('input[type="file"][name*="resume"]') ||
    doc.querySelector('input[type="file"]');

  if (!input) return false;

  attachFileToInput(input, file, resolveResumeFileName(profile, settings, file.name));
  return true;
}
