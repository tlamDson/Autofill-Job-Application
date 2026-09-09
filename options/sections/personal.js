/**
 * personal.js — Options UI section for personal info + address.
 * Vanilla JS, no framework.
 *
 * @param {HTMLElement} container - Root element to render into
 * @param {object} profile - Current profile data
 * @param {(updatedProfile: object) => void} [onSave] - Called with updated profile on change
 */

import { validateProfile } from '../../src/profile/schema.js';

const FIELDS = [
  { key: 'personal.firstName', label: 'First Name', type: 'text' },
  { key: 'personal.lastName', label: 'Last Name', type: 'text' },
  { key: 'personal.preferredName', label: 'Preferred Name', type: 'text' },
  { key: 'personal.email', label: 'Email', type: 'email' },
  { key: 'personal.phone', label: 'Phone', type: 'tel' },
  { key: 'personal.address.line1', label: 'Address Line 1', type: 'text' },
  { key: 'personal.address.line2', label: 'Address Line 2', type: 'text' },
  { key: 'personal.address.city', label: 'City', type: 'text' },
  { key: 'personal.address.state', label: 'State / Province', type: 'text' },
  { key: 'personal.address.postalCode', label: 'Postal Code', type: 'text' },
  { key: 'personal.address.country', label: 'Country', type: 'text' },
  { key: 'personal.pronouns', label: 'Pronouns', type: 'text' },
];

/**
 * Get a nested value from an object by dot-path.
 */
function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o ?? {})[k], obj) ?? '';
}

/**
 * Set a nested value in an object by dot-path (mutates).
 */
function setPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) {
      cur[parts[i]] = {};
    }
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

export function renderPersonal(container, profile, onSave) {
  const section = document.createElement('section');
  section.className = 'options-section';

  const h2 = document.createElement('h2');
  h2.textContent = 'Personal Information';
  section.appendChild(h2);

  const fieldMap = {};

  for (const f of FIELDS) {
    const wrapper = document.createElement('div');
    wrapper.className = 'field-wrapper';

    const label = document.createElement('label');
    label.textContent = f.label;

    const input = document.createElement('input');
    input.type = f.type;
    input.setAttribute('data-field', f.key);
    input.value = getPath(profile, f.key);

    const error = document.createElement('span');
    error.setAttribute('data-error', f.key);
    error.className = 'field-error';
    error.style.color = 'red';
    error.style.display = 'none';

    input.addEventListener('change', () => {
      // Deep clone profile
      const updated = JSON.parse(JSON.stringify(profile));
      setPath(updated, f.key, input.value);

      // Validate and show errors inline
      const { errors } = validateProfile(updated);
      const fieldError = errors.find((e) => e.field === f.key);
      if (fieldError) {
        error.textContent = fieldError.message;
        error.style.display = '';
      } else {
        error.textContent = '';
        error.style.display = 'none';
      }

      // Merge back into profile reference for subsequent changes
      Object.assign(profile, updated);

      if (onSave) onSave(updated);
    });

    label.appendChild(input);
    wrapper.appendChild(label);
    wrapper.appendChild(error);
    section.appendChild(wrapper);
    fieldMap[f.key] = input;
  }

  container.appendChild(section);
}
