/**
 * src/ats/icims.js — iCIMS ATS adapter
 *
 * iCIMS embeds application forms inside same-origin iframes. The form fields
 * use the naming convention `PortalApplicant.<FieldName>`.
 *
 * In real usage, `fillICIMSForm` would be called with the iframe's
 * contentDocument. For unit tests, we pass any document with the same
 * field structure.
 *
 * Exported API:
 *   fillICIMSForm(document, profile) → Promise<{filled, skipped}>
 */

import { setNativeValue, attachFileToInput } from '../filler.js';
import { isFillable } from '../matcher.js';
import { runGenericFill } from '../adapters/generic.js';

// ─── Field map ────────────────────────────────────────────────────────────────

/**
 * Map from iCIMS PortalApplicant field names to profile dot-paths.
 */
const ICIMS_FIELD_MAP = [
  // Personal
  { name: 'PortalApplicant.FirstName',  path: 'firstName' },
  { name: 'PortalApplicant.LastName',   path: 'lastName' },
  { name: 'PortalApplicant.MiddleName', path: 'middleName' },

  // Contact
  { name: 'PortalApplicant.EmailAddress', path: 'email' },
  { name: 'PortalApplicant.CellPhone',    path: 'phone' },
  { name: 'PortalApplicant.HomePhone',    path: 'phone' },

  // Address
  { name: 'PortalApplicant.Address1', path: 'address.street' },
  { name: 'PortalApplicant.Address2', path: 'address.street2' },
  { name: 'PortalApplicant.City',     path: 'address.city' },
  { name: 'PortalApplicant.State',    path: 'address.state' },
  { name: 'PortalApplicant.Zip',      path: 'address.zip' },
  { name: 'PortalApplicant.Country',  path: 'address.country' },

  // Links
  { name: 'PortalApplicant.LinkedInURL', path: 'links.linkedin' },
  { name: 'PortalApplicant.Website',     path: 'links.website' },
];

/**
 * Resolve dot-path from profile.
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

// ─── fillICIMSForm ────────────────────────────────────────────────────────────

/**
 * Fill an iCIMS application form.
 *
 * @param {Document} doc     — the form document (may be iframe.contentDocument)
 * @param {object}   profile
 * @returns {Promise<{filled: number, skipped: number}>}
 */
export async function fillICIMSForm(doc, profile) {
  let filled = 0;
  let skipped = 0;

  for (const { name, path } of ICIMS_FIELD_MAP) {
    const el = doc.querySelector(`[name="${name}"]`);
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
      console.warn('[Autofill:icims] fill error', name, err);
      skipped++;
    }
  }

  // Generic fallback for any remaining fields
  const genericResult = await runGenericFill(doc, profile);
  filled += genericResult.filled;
  skipped += genericResult.skipped;

  return { filled, skipped };
}

// ─── Resume upload ────────────────────────────────────────────────────────────

/**
 * Attach a resume file to iCIMS's file upload input.
 *
 * @param {Document}  doc
 * @param {File|null} file
 * @returns {boolean}
 */
export function uploadICIMSResume(doc, file) {
  if (!file) return false;

  const input =
    doc.querySelector('input[type="file"][name*="Resume"]') ||
    doc.querySelector('input[type="file"][name*="resume"]') ||
    doc.querySelector('input[type="file"]');

  if (!input) return false;

  attachFileToInput(input, file);
  return true;
}
