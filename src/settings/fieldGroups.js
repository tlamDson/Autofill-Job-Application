/**
 * fieldGroups.js — Field toggle groups for the Settings "Fields to autofill" section.
 * Pure functions: no DOM, no chrome APIs.
 *
 * Keys mirror the `classifyField` keys in src/matcher.js (L298–636), grouped by
 * category for display. `disabledFields` in settings is a blacklist — a key
 * absent from it is enabled, so newly added keys are enabled by default.
 */

export const FIELD_GROUPS = [
  {
    id: 'personal',
    label: 'Personal',
    keys: ['firstName', 'lastName', 'fullName', 'preferredName', 'email', 'phone', 'phoneCountryCode'],
  },
  {
    id: 'location',
    label: 'Location',
    keys: ['addressLine1', 'addressLine2', 'city', 'state', 'postalCode', 'country'],
  },
  {
    id: 'links',
    label: 'Links',
    keys: ['linkedin', 'github', 'portfolio', 'website'],
  },
  {
    id: 'documents',
    label: 'Documents',
    keys: ['resume'],
  },
  {
    id: 'education',
    label: 'Education',
    keys: ['school', 'degree', 'fieldOfStudy', 'gpa', 'eduStartDate', 'eduEndDate'],
  },
  {
    id: 'workHistory',
    label: 'Work History',
    keys: ['company', 'jobTitle', 'workStartDate', 'workEndDate', 'jobDescription', 'workLocation'],
  },
  {
    id: 'workAuthorization',
    label: 'Work Authorization',
    keys: ['needsSponsorship', 'authorizedToWork', 'visaStatus'],
  },
  {
    id: 'eeo',
    label: 'EEO',
    keys: ['gender', 'race', 'veteranStatus', 'disabilityStatus', 'hispanicLatino'],
  },
  {
    id: 'compensation',
    label: 'Compensation',
    keys: ['desiredSalary', 'noticePeriod'],
  },
];

function findGroup(groupId) {
  return FIELD_GROUPS.find((g) => g.id === groupId);
}

/**
 * @param {{disabledFields?: string[]}} settings
 * @param {string} key
 * @returns {boolean}
 */
export function isFieldEnabled(settings, key) {
  return !(settings.disabledFields || []).includes(key);
}

/**
 * Returns a new settings object with `key` enabled/disabled. Does not mutate.
 * @param {object} settings
 * @param {string} key
 * @param {boolean} enabled
 * @returns {object}
 */
export function setFieldEnabled(settings, key, enabled) {
  const disabled = new Set(settings.disabledFields || []);
  if (enabled) {
    disabled.delete(key);
  } else {
    disabled.add(key);
  }
  return { ...settings, disabledFields: Array.from(disabled) };
}

/**
 * Returns a new settings object with every key in `groupId` enabled/disabled.
 * Unknown groupId returns settings unchanged.
 * @param {object} settings
 * @param {string} groupId
 * @param {boolean} enabled
 * @returns {object}
 */
export function setGroupEnabled(settings, groupId, enabled) {
  const group = findGroup(groupId);
  if (!group) return settings;

  const disabled = new Set(settings.disabledFields || []);
  for (const key of group.keys) {
    if (enabled) {
      disabled.delete(key);
    } else {
      disabled.add(key);
    }
  }
  return { ...settings, disabledFields: Array.from(disabled) };
}

/**
 * @param {object} settings
 * @param {string} groupId
 * @returns {'on'|'off'|'mixed'}
 */
export function groupState(settings, groupId) {
  const group = findGroup(groupId);
  if (!group || group.keys.length === 0) return 'on';

  const enabledFlags = group.keys.map((key) => isFieldEnabled(settings, key));
  if (enabledFlags.every(Boolean)) return 'on';
  if (enabledFlags.every((e) => !e)) return 'off';
  return 'mixed';
}
