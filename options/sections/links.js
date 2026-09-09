/**
 * links.js — Options UI section for social/portfolio links.
 * Vanilla JS, no framework.
 */

const LINK_FIELDS = [
  { key: 'links.linkedin', label: 'LinkedIn URL', placeholder: 'https://linkedin.com/in/yourname' },
  { key: 'links.github', label: 'GitHub URL', placeholder: 'https://github.com/yourname' },
  { key: 'links.portfolio', label: 'Portfolio URL', placeholder: 'https://yourportfolio.com' },
  { key: 'links.website', label: 'Personal Website', placeholder: 'https://example.com' },
];

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o ?? {})[k], obj) ?? '';
}

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

export function renderLinks(container, profile, onSave) {
  const section = document.createElement('section');
  section.className = 'options-section';

  const h2 = document.createElement('h2');
  h2.textContent = 'Links & Profiles';
  section.appendChild(h2);

  for (const f of LINK_FIELDS) {
    const wrapper = document.createElement('div');
    wrapper.className = 'field-wrapper';

    const label = document.createElement('label');
    label.textContent = f.label;

    const input = document.createElement('input');
    input.type = 'url';
    input.setAttribute('data-field', f.key);
    input.placeholder = f.placeholder;
    input.value = getPath(profile, f.key);

    input.addEventListener('change', () => {
      const updated = JSON.parse(JSON.stringify(profile));
      setPath(updated, f.key, input.value);
      Object.assign(profile, updated);
      if (onSave) onSave(updated);
    });

    label.appendChild(input);
    wrapper.appendChild(label);
    section.appendChild(wrapper);
  }

  container.appendChild(section);
}
