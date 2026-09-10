/**
 * schema.js — Profile schema, validation, normalization.
 * Pure functions: không cần DOM, không cần browser.
 *
 * @typedef {Object} Profile
 * @property {PersonalInfo} personal
 * @property {LinksInfo} links
 * @property {WorkAuthInfo} workAuthorization
 * @property {EEOInfo} eeo
 * @property {EducationEntry[]} education
 * @property {WorkHistoryEntry[]} workHistory
 * @property {string[]} skills
 * @property {ResumeFile[]} resumeFiles
 * @property {CompensationInfo} compensation
 * @property {SavedAnswer[]} savedAnswers
 */

// ─── Factories ────────────────────────────────────────────────────────────────

/**
 * Creates an empty profile with all sections and sensible defaults.
 * @returns {Profile}
 */
export function createEmptyProfile() {
  return {
    personal: {
      firstName: '',
      lastName: '',
      preferredName: '',
      email: '',
      phone: '',
      phoneCountryCode: '',
      address: {
        line1: '',
        line2: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
      },
      dateOfBirth: '',
      pronouns: '',
    },
    links: {
      linkedin: '',
      github: '',
      portfolio: '',
      website: '',
      other: [],
    },
    workAuthorization: {
      needsSponsorship: false,
      // null = not set (skip the field on any form rather than guess); the
      // options page writes an explicit true/false once the user answers.
      // Previously a map keyed by the candidate's own free-text country
      // (authorizedToWorkInCountry), which required an exact string match
      // against personal.address.country ("USA" vs "United States") and had
      // no options-page UI to populate it, so it was always undefined.
      authorizedToWork: null,
      visaStatus: '',
    },
    eeo: {
      gender: '',
      race: '',
      veteranStatus: '',
      disabilityStatus: '',
      hispanicLatino: null,
    },
    consents: {
      // Only ever auto-ticked on this explicit, deliberate opt-in — see
      // classifyField's termsAgreement rule for what it will and won't match.
      agreeToTerms: false,
    },
    education: [],
    workHistory: [],
    skills: [],
    resumeFiles: [],
    compensation: {
      desiredSalaryMin: null,
      desiredSalaryMax: null,
      currency: 'USD',
      noticePeriod: '',
    },
    savedAnswers: [],
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}$/;

/**
 * Validates a profile object.
 * @param {Profile} profile
 * @returns {{ valid: boolean, errors: Array<{field: string, message: string}> }}
 */
export function validateProfile(profile) {
  const errors = [];

  // personal.email — validate only if non-empty
  if (profile.personal.email && !EMAIL_RE.test(profile.personal.email.trim())) {
    errors.push({ field: 'personal.email', message: 'Invalid email format' });
  }

  // education entries
  (profile.education || []).forEach((entry, i) => {
    if (!entry.school || !entry.school.trim()) {
      errors.push({ field: `education[${i}].school`, message: 'School name is required' });
    }
    _validateDateField(errors, entry.startDate, `education[${i}].startDate`);
    _validateDateField(errors, entry.endDate, `education[${i}].endDate`);
  });

  // workHistory entries
  (profile.workHistory || []).forEach((entry, i) => {
    if (!entry.company || !entry.company.trim()) {
      errors.push({ field: `workHistory[${i}].company`, message: 'Company is required' });
    }
    _validateDateField(errors, entry.startDate, `workHistory[${i}].startDate`);
    _validateDateField(errors, entry.endDate, `workHistory[${i}].endDate`);
  });

  return { valid: errors.length === 0, errors };
}

/**
 * @param {Array} errors
 * @param {string} value
 * @param {string} field
 */
function _validateDateField(errors, value, field) {
  if (!value) return; // empty is OK (not yet filled)
  if (value === 'present') return; // valid sentinel
  if (!DATE_RE.test(value)) {
    errors.push({ field, message: 'Date must be yyyy-mm or "present"' });
  }
}

// ─── Normalization ────────────────────────────────────────────────────────────

/**
 * Returns a new profile with normalized values.
 * Does NOT mutate the input.
 * @param {Profile} profile
 * @returns {Profile}
 */
export function normalizeProfile(profile) {
  // Deep clone via JSON — profile should only contain JSON-serializable data
  const p = JSON.parse(JSON.stringify(profile));

  // personal string fields: trim
  const pers = p.personal;
  for (const key of ['firstName', 'lastName', 'preferredName', 'pronouns', 'dateOfBirth', 'visaStatus']) {
    if (pers[key] !== undefined) pers[key] = (pers[key] || '').trim();
  }

  // email: trim + lowercase
  if (pers.email !== undefined) {
    pers.email = (pers.email || '').trim().toLowerCase();
  }

  // phone → E.164 (strip formatting, keep leading +)
  if (pers.phone) {
    pers.phone = _toE164(pers.phone);
  }

  // Migrate the old authorizedToWorkInCountry map (removed: required an
  // exact free-text country match and had no options-page UI, so it was
  // always undefined in practice) to the plain authorizedToWork boolean.
  // Best-effort: true if the map says so for ANY country, since a profile
  // stored under the old shape predates this extension supporting more than
  // one target country anyway.
  if (p.workAuthorization && p.workAuthorization.authorizedToWorkInCountry) {
    const map = p.workAuthorization.authorizedToWorkInCountry;
    if (p.workAuthorization.authorizedToWork == null) {
      const anyTrue = Object.values(map).some((v) => v === true);
      p.workAuthorization.authorizedToWork = anyTrue ? true : null;
    }
    delete p.workAuthorization.authorizedToWorkInCountry;
  }

  // education dates
  p.education = (p.education || []).map((entry) => ({
    ...entry,
    school: (entry.school || '').trim(),
    degree: (entry.degree || '').trim(),
    fieldOfStudy: (entry.fieldOfStudy || '').trim(),
    startDate: _normalizeDate(entry.startDate),
    endDate: _normalizeDate(entry.endDate),
  }));

  // workHistory dates
  p.workHistory = (p.workHistory || []).map((entry) => ({
    ...entry,
    company: (entry.company || '').trim(),
    title: (entry.title || '').trim(),
    startDate: _normalizeDate(entry.startDate),
    endDate: _normalizeDate(entry.endDate),
  }));

  return p;
}

/**
 * Normalize a phone string to E.164 format.
 * Keeps leading '+', strips all non-digit chars from the rest.
 * E.g. "+1 (555) 123-4567" → "+15551234567"
 *      "+84 (0) 912 345 678" → "+84912345678"
 * @param {string} phone
 * @returns {string}
 */
function _toE164(phone) {
  const s = (phone || '').trim();
  if (!s) return s;
  if (s.startsWith('+')) {
    // Strip trunk-code marker "(0)" that some countries write after country code
    // e.g. "+84 (0) 912 345 678" → "+84 912 345 678" → "+84912345678"
    const withoutTrunk = s.replace(/\(0\)/g, '');
    const digits = withoutTrunk.slice(1).replace(/\D/g, '');
    return '+' + digits;
  }
  // No leading +: strip all non-digits (local number, leave as-is)
  return s.replace(/\D/g, '');
}

/**
 * Normalize a date string to yyyy-mm or "present".
 * Accepts "2020-9" → "2020-09", "present" → "present", already "yyyy-mm" → unchanged.
 * @param {string} date
 * @returns {string}
 */
function _normalizeDate(date) {
  if (!date) return date;
  const s = (date || '').trim().toLowerCase();
  if (s === 'present') return 'present';
  // Match yyyy-m or yyyy-mm
  const m = s.match(/^(\d{4})-(\d{1,2})$/);
  if (m) {
    const year = m[1];
    const month = m[2].padStart(2, '0');
    return `${year}-${month}`;
  }
  return date; // return as-is if unrecognized, validator will catch it
}
