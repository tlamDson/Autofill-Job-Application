/**
 * eeo.js — Equal Employment Opportunity / demographic section UI.
 * All fields default to empty string ("decline to answer"). Options are
 * fixed <select> lists using standard EEOC wording, rather than free text —
 * matching against a real form's own option text by exact/partial string
 * comparison is unreliable when the stored value is whatever the user
 * happened to type (e.g. "Male" vs "male" vs "I don't wish to answer").
 */

const DECLINE = 'Decline to self-identify';

const EEO_FIELDS = [
  {
    key: 'eeo.gender',
    label: 'Gender',
    options: ['Male', 'Female', 'Non-binary', DECLINE],
  },
  {
    key: 'eeo.race',
    label: 'Race / Ethnicity',
    options: [
      'American Indian or Alaska Native',
      'Asian',
      'Black or African American',
      'Native Hawaiian or Other Pacific Islander',
      'White',
      'Two or More Races',
      DECLINE,
    ],
  },
  {
    key: 'eeo.hispanicLatino',
    label: 'Hispanic or Latino',
    options: ['Yes', 'No', DECLINE],
  },
  {
    key: 'eeo.veteranStatus',
    label: 'Veteran Status',
    options: [
      'I am not a protected veteran',
      'I identify as one or more of the classifications of a protected veteran',
      "I don't wish to answer",
    ],
  },
  {
    key: 'eeo.disabilityStatus',
    label: 'Disability Status',
    options: [
      'Yes, I have a disability, or have had one in the past',
      'No, I do not have a disability and have not had one in the past',
      'I do not want to answer',
    ],
  },
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

    const select = document.createElement('select');
    select.setAttribute('data-field', f.key);

    const blankOpt = document.createElement('option');
    blankOpt.value = '';
    blankOpt.textContent = '-- Decline to answer --';
    select.appendChild(blankOpt);

    for (const optionText of f.options) {
      const opt = document.createElement('option');
      opt.value = optionText;
      opt.textContent = optionText;
      select.appendChild(opt);
    }

    select.value = getPath(profile, f.key);
    select.addEventListener('change', () => {
      setPath(profile, f.key, select.value);
      if (onSave) onSave(JSON.parse(JSON.stringify(profile)));
    });

    label.appendChild(select);
    wrapper.appendChild(label);
    section.appendChild(wrapper);
  }

  container.appendChild(section);
}
