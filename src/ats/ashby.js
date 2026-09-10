/**
 * src/ats/ashby.js — Ashby HQ ATS adapter
 *
 * Ashby uses React forms hosted on jobs.ashbyhq.com or {company}.ashbyhq.com.
 * Key field names follow the `_systemfield_*` pattern for standard fields:
 *  - _systemfield_name      (full name)
 *  - _systemfield_email
 *  - _systemfield_phone
 *  - _systemfield_linkedin
 *  - _systemfield_location  (city)
 *  - _systemfield_resume    (resume upload)
 *
 * Custom application questions have arbitrary IDs.
 *
 * Exported API:
 *   fillAshbyForm(document, profile) → Promise<{filled, skipped}>
 */

import { setNativeValue, attachFileToInput } from '../filler.js';
import { isFillable } from '../matcher.js';
import { runGenericFill } from '../adapters/generic.js';

// ─── Field map ────────────────────────────────────────────────────────────────

/**
 * Resolve profile value for a given Ashby _systemfield_ name.
 *
 * @param {string} fieldName
 * @param {object} profile
 * @returns {string|undefined}
 */
function resolveAshbyValue(fieldName, profile) {
  const links = profile.links || {};
  const address = profile.address || {};

  const MAP = {
    // Full name (Ashby's primary name field)
    '_systemfield_name': profile.firstName && profile.lastName
      ? `${profile.firstName} ${profile.lastName}`.trim()
      : profile.firstName || profile.lastName,

    // First/last when split (some Ashby tenants)
    '_systemfield_first_name': profile.firstName,
    '_systemfield_last_name':  profile.lastName,

    // Contact
    '_systemfield_email':   profile.email,
    '_systemfield_phone':   profile.phone,

    // Links
    '_systemfield_linkedin':  links.linkedin,
    '_systemfield_website':   links.website,
    '_systemfield_github':    links.github,
    '_systemfield_portfolio': links.portfolio,

    // Location
    '_systemfield_location': address.city && address.state
      ? `${address.city}, ${address.state}`
      : address.city || address.state,
  };

  return MAP[fieldName];
}

// ─── fillAshbyForm ────────────────────────────────────────────────────────────

const ASHBY_SYSTEM_FIELDS = [
  '_systemfield_name',
  '_systemfield_first_name',
  '_systemfield_last_name',
  '_systemfield_email',
  '_systemfield_phone',
  '_systemfield_linkedin',
  '_systemfield_website',
  '_systemfield_github',
  '_systemfield_portfolio',
  '_systemfield_location',
];

/**
 * Fill an Ashby application form.
 *
 * @param {Document} doc
 * @param {object}   profile
 * @returns {Promise<{filled: number, skipped: number}>}
 */
export async function fillAshbyForm(doc, profile) {
  let filled = 0;
  let skipped = 0;

  for (const fieldName of ASHBY_SYSTEM_FIELDS) {
    const el = doc.querySelector(`[name="${fieldName}"]`);
    if (!el || !isFillable(el)) continue;

    const value = resolveAshbyValue(fieldName, profile);
    if (value == null || value === '') {
      skipped++;
      continue;
    }

    try {
      setNativeValue(el, String(value));
      filled++;
    } catch (err) {
      console.warn('[Autofill:ashby] fill error', fieldName, err);
      skipped++;
    }
  }

  // Generic fallback for custom questions and other fields
  const genericResult = await runGenericFill(doc, profile);
  filled += genericResult.filled;
  skipped += genericResult.skipped;

  return { filled, skipped };
}

// ─── Resume upload ────────────────────────────────────────────────────────────

/**
 * Attach a resume file to Ashby's file input.
 *
 * @param {Document}  doc
 * @param {File|null} file
 * @returns {boolean}
 */
export function uploadAshbyResume(doc, file) {
  if (!file) return false;

  const input =
    doc.querySelector('[name="_systemfield_resume"]') ||
    doc.querySelector('input[type="file"]');

  if (!input) return false;

  attachFileToInput(input, file);
  return true;
}
