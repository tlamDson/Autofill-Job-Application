/**
 * serialize.js — Export / import profile as JSON.
 *
 * Export: strips resume blob refs (fileRef cleared) and savedAnswers (AI cache).
 * Import: parses JSON, merges missing sections from empty profile, validates.
 */

import { createEmptyProfile, validateProfile } from './schema.js';

/**
 * Export a profile to a JSON string suitable for download.
 * - Clears `resumeFiles[].fileRef` (IDB keys are local, not transferable)
 * - Omits `savedAnswers` (AI answer cache, can be large and context-specific)
 * @param {object} profile
 * @returns {string} JSON string
 */
export function exportProfile(profile) {
  // Deep clone
  const p = JSON.parse(JSON.stringify(profile));

  // Clear resume blob refs
  if (Array.isArray(p.resumeFiles)) {
    p.resumeFiles = p.resumeFiles.map((f) => ({ ...f, fileRef: '' }));
  }

  // Omit savedAnswers
  delete p.savedAnswers;

  return JSON.stringify(p, null, 2);
}

/**
 * Import a profile from a JSON string.
 * Returns { ok: true, profile } or { ok: false, error: string, errors?: array }
 * @param {string} json
 * @returns {{ ok: boolean, profile?: object, error?: string, errors?: array }}
 */
export function importProfile(json) {
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    return { ok: false, error: `JSON parse error: ${e.message}` };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'Not a valid profile object' };
  }

  // Merge with empty profile for forward compatibility
  const empty = createEmptyProfile();
  const merged = {
    ...empty,
    ...parsed,
    personal: { ...empty.personal, ...(parsed.personal || {}) },
    links: { ...empty.links, ...(parsed.links || {}) },
    workAuthorization: { ...empty.workAuthorization, ...(parsed.workAuthorization || {}) },
    eeo: { ...empty.eeo, ...(parsed.eeo || {}) },
    compensation: { ...empty.compensation, ...(parsed.compensation || {}) },
    education: Array.isArray(parsed.education) ? parsed.education : [],
    workHistory: Array.isArray(parsed.workHistory) ? parsed.workHistory : [],
    skills: Array.isArray(parsed.skills) ? parsed.skills : [],
    resumeFiles: Array.isArray(parsed.resumeFiles) ? parsed.resumeFiles : [],
    savedAnswers: Array.isArray(parsed.savedAnswers) ? parsed.savedAnswers : [],
    _version: parsed._version || 1,
  };

  // Validate
  const { valid, errors } = validateProfile(merged);
  if (!valid) {
    return { ok: false, error: 'Validation failed', errors };
  }

  return { ok: true, profile: merged };
}
