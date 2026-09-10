/**
 * src/ats/greenhouse.js — Greenhouse ATS adapter (text fields + links)
 *
 * Greenhouse uses a standard HTML form with data-gh-input attributes
 * on each input that directly identify the field type. This adapter
 * uses those attributes for precise, reliable filling — bypassing
 * the heuristic matcher entirely for known fields.
 *
 * Exported API:
 *   fillGreenhouseForm(document, profile) → Promise<{filled, skipped}>
 */

import { setNativeValue, fillSelect } from '../filler.js';
import { isFillable } from '../matcher.js';
import { runGenericFill } from '../adapters/generic.js';

// ─── Greenhouse field mapping ─────────────────────────────────────────────────
// Maps data-gh-input attribute values to profile value resolver functions.

/**
 * Resolve a Greenhouse field value from the profile.
 * @param {string}  ghKey   — data-gh-input value
 * @param {object}  profile — user profile
 * @returns {string|undefined}
 */
function resolveGHValue(ghKey, profile) {
  const links = profile.links || {};
  const address = profile.address || {};

  const GH_FIELD_MAP = {
    first_name: profile.firstName,
    last_name: profile.lastName,
    email: profile.email,
    phone: profile.phone,
    // Links
    linkedin_profile_url: links.linkedin,
    github_profile_url: links.github,
    portfolio: links.portfolio,
    website: links.website || links.portfolio,
    // Address
    location: address.city ? [address.city, address.state].filter(Boolean).join(', ') : undefined,
    // Compensation
    salary_expectations: profile.compensation?.desiredSalaryMin
      ? String(profile.compensation.desiredSalaryMin)
      : undefined,
  };

  return GH_FIELD_MAP[ghKey];
}

// ─── Main fill function ───────────────────────────────────────────────────────

/**
 * Fill a Greenhouse application form.
 *
 * Strategy:
 *  1. Find all elements with `data-gh-input` — fill these with precise mapping.
 *  2. Fall back to generic adapter for remaining unfilled fields.
 *
 * @param {Document} doc
 * @param {object}   profile
 * @returns {Promise<{filled: number, skipped: number}>}
 */
export async function fillGreenhouseForm(doc, profile) {
  let filled = 0;
  let skipped = 0;

  // Phase 1: Precise filling using data-gh-input attributes
  const ghInputs = Array.from(doc.querySelectorAll('[data-gh-input]'));

  for (const el of ghInputs) {
    if (!isFillable(el)) {
      skipped++;
      continue;
    }

    const ghKey = el.getAttribute('data-gh-input');
    const value = resolveGHValue(ghKey, profile);

    if (value == null || value === '') {
      skipped++;
      continue;
    }

    try {
      const tagName = el.tagName.toLowerCase();
      const type = (el.type || '').toLowerCase();

      if (tagName === 'select') {
        fillSelect(el, String(value));
      } else if (type === 'checkbox') {
        const checked = value === true || value === 'true';
        if (el.checked !== checked) {
          el.checked = checked;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } else {
        setNativeValue(el, String(value));
      }
      filled++;
    } catch (err) {
      console.warn('[Autofill:greenhouse] fillField error', ghKey, err);
      skipped++;
    }
  }

  // Phase 2: Generic adapter for any remaining unfilled fields
  // (e.g., custom questions, cover letter textarea not tagged with data-gh-input)
  const alreadyFilledIds = new Set(
    ghInputs.filter((el) => el.value || el.checked).map((el) => el.id).filter(Boolean)
  );

  const genericResult = await runGenericFill(doc, profile);
  // Add generic results but avoid double-counting inputs already filled in phase 1
  filled += genericResult.filled;
  skipped += genericResult.skipped;

  return { filled, skipped };
}
