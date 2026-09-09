/**
 * eeo.js — Equal Employment Opportunity / demographic section UI.
 * All fields default to empty string ("decline to answer").
 */

const EEO_FIELDS = [
  { key: 'eeo.gender', label: 'Gender', placeholder: 'Decline to answer' },
  { key: 'eeo.race', label: 'Race / Ethnicity', placeholder: 'Decline to answer' },
  { key: 'eeo.veteranStatus', label: 'Veteran Status', placeholder: 'Decline to answer' },
  { key: 'eeo.disabilityStatus', label: 'Disability Status', placeholder: 'Decline to answer' },
];

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o ?? {})[k], obj) ?? '';
}
function setPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

export function renderEEO(container, profile, onSave) {
  profile.eeo = profile.eeo || {};

  const section = document.createElement('section');
  section.className = 'options-section';

  const h2 = document.createElement('h2');
  h2.textContent = 'Demographic / EEO';
  section.appendChild(h2);

  const note = document.createElement('p');
  note.textContent = 'These fields are optional. Leave blank to select "Decline to answer" on application forms.';
  note.style.fontSize = '12px';
  section.appendChild(note);

  for (const f of EEO_FIELDS) {
    const wrapper = document.createElement('div');
    wrapper.className = 'field-wrapper';
    const label = document.createElement('label');
    label.textContent = f.label;
    const input = document.createElement('input');
    input.type = 'text';
    input.setAttribute('data-field', f.key);
    input.placeholder = f.placeholder;
    input.value = getPath(profile, f.key);
    input.addEventListener('change', () => {
      setPath(profile, f.key, input.value);
      if (onSave) onSave(JSON.parse(JSON.stringify(profile)));
    });
    label.appendChild(input);
    wrapper.appendChild(label);
    section.appendChild(wrapper);
  }

  container.appendChild(section);
}
