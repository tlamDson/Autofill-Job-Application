/**
 * compensation.js — Desired salary + notice period section UI.
 */

const FIELDS = [
  { key: 'compensation.desiredSalaryMin', label: 'Desired Salary Min', type: 'number', placeholder: '80000' },
  { key: 'compensation.desiredSalaryMax', label: 'Desired Salary Max', type: 'number', placeholder: '120000' },
  { key: 'compensation.currency', label: 'Currency', type: 'text', placeholder: 'USD' },
  { key: 'compensation.noticePeriod', label: 'Notice Period', type: 'text', placeholder: '2 weeks / immediate' },
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

export function renderCompensation(container, profile, onSave) {
  profile.compensation = profile.compensation || {};

  const section = document.createElement('section');
  section.className = 'options-section';

  const h2 = document.createElement('h2');
  h2.textContent = 'Compensation Expectations';
  section.appendChild(h2);

  for (const f of FIELDS) {
    const wrapper = document.createElement('div');
    const label = document.createElement('label');
    label.textContent = f.label;
    const input = document.createElement('input');
    input.type = f.type;
    input.setAttribute('data-field', f.key);
    input.placeholder = f.placeholder;
    const val = getPath(profile, f.key);
    input.value = val !== null && val !== undefined ? val : '';
    input.addEventListener('change', () => {
      const v = f.type === 'number' ? (input.value === '' ? null : Number(input.value)) : input.value;
      setPath(profile, f.key, v);
      if (onSave) onSave(JSON.parse(JSON.stringify(profile)));
    });
    label.appendChild(input);
    wrapper.appendChild(label);
    section.appendChild(wrapper);
  }

  container.appendChild(section);
}
