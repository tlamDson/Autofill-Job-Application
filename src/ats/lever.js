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

import { setNativeValue, fillSelect, attachFileToInput } from '../filler.js';
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

// ─── Resume upload ────────────────────────────────────────────────────────────

/**
 * Attach a resume File to Lever's `<input type="file">`.
 * Lever's resume input typically has `name="resume"` or `id*="resume"`.
 *
 * @param {Document}  doc
 * @param {File|null} file
 * @returns {boolean}
 */
export function uploadLeverResume(doc, file) {
  if (!file) return false;

  const input =
    doc.querySelector('input[type="file"][name="resume"]') ||
    doc.querySelector('input[type="file"][name*="resume"]') ||
    doc.querySelector('input[type="file"]');

  if (!input) return false;

  attachFileToInput(input, file);
  return true;
}
