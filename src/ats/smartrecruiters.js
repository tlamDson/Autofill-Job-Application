/**
 * src/ats/smartrecruiters.js — SmartRecruiters ATS adapter
 *
 * SmartRecruiters forms use well-known `name` attributes:
 *  - firstName, lastName, email, phoneNumber
 *  - location.city, location.country, location.region (state)
 *  - web.linkedin, web.portfolio, web.github
 *  - Custom questions have `data-field-id` containers
 *
 * Exported API:
 *   fillSmartRecruitersForm(document, profile) → Promise<{filled, skipped}>
 *   uploadSmartRecruitersResume(document, file) → boolean
 */

import { setNativeValue, fillSelect, attachFileToInput, resolveResumeFileName } from '../filler.js';
import { isFillable } from '../matcher.js';
import { runGenericFill } from '../adapters/generic.js';

// ─── Field map ────────────────────────────────────────────────────────────────

/**
 * Resolve a SmartRecruiters field name to a profile value.
 *
 * @param {string} fieldName
 * @param {object} profile
 * @returns {string|undefined}
 */
function resolveSRValue(fieldName, profile) {
  const links = profile.links || {};
  const address = profile.address || {};

  const MAP = {
    // Identity
    firstName:    profile.firstName,
    lastName:     profile.lastName,

    // Contact
    email:        profile.email,
    phoneNumber:  profile.phone,
    phone:        profile.phone,  // some tenants

    // Location
    'location.city':    address.city,
    'location.region':  address.state,
    'location.country': address.country,
    'location.zip':     address.zip,

    // Web links
    'web.linkedin':   links.linkedin,
    'web.portfolio':  links.portfolio,
    'web.github':     links.github,
    'web.twitter':    links.twitter,
    'web.website':    links.website,
  };

  return MAP[fieldName];
}

// ─── fillSmartRecruitersForm ──────────────────────────────────────────────────

const SR_FIELD_NAMES = [
  'firstName', 'lastName',
  'email', 'phoneNumber', 'phone',
  'location.city', 'location.region', 'location.country', 'location.zip',
  'web.linkedin', 'web.portfolio', 'web.github', 'web.twitter', 'web.website',
];

/**
 * Fill a SmartRecruiters application form.
 *
 * @param {Document} doc
 * @param {object}   profile
 * @returns {Promise<{filled: number, skipped: number}>}
 */
export async function fillSmartRecruitersForm(doc, profile) {
  let filled = 0;
  let skipped = 0;

  for (const fieldName of SR_FIELD_NAMES) {
    const el = doc.querySelector(`[name="${fieldName}"]`);
    if (!el || !isFillable(el)) continue;

    const value = resolveSRValue(fieldName, profile);
    if (value == null || value === '') {
      skipped++;
      continue;
    }

    try {
      const tag = el.tagName.toLowerCase();
      if (tag === 'select') {
        fillSelect(el, String(value));
      } else {
        setNativeValue(el, String(value));
      }
      filled++;
    } catch (err) {
      console.warn('[Autofill:sr] fill error', fieldName, err);
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
 * Attach a resume to SmartRecruiters' file input.
 *
 * @param {Document}  doc
 * @param {File|null} file
 * @param {object}    [profile]
 * @param {object}    [settings]
 * @returns {boolean}
 */
export function uploadSmartRecruitersResume(doc, file, profile, settings) {
  if (!file) return false;

  const input =
    doc.querySelector('input[type="file"][name*="resume"]') ||
    doc.querySelector('input[type="file"][name*="Resume"]') ||
    doc.querySelector('input[type="file"]');

  if (!input) return false;

  attachFileToInput(input, file, resolveResumeFileName(profile, settings, file.name));
  return true;
}
