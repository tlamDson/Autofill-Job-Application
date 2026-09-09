/**
 * education.js — List editor for education entries.
 * Supports add, remove; isCurrent locks endDate to "present".
 */

const EMPTY_ENTRY = () => ({
  school: '', degree: '', fieldOfStudy: '', gpa: '', startDate: '', endDate: '', location: '', isCurrent: false,
});

const EDU_FIELDS = [
  { key: 'school', label: 'School / University', type: 'text' },
  { key: 'degree', label: 'Degree', type: 'text', placeholder: "Bachelor's / Master's" },
  { key: 'fieldOfStudy', label: 'Field of Study', type: 'text' },
  { key: 'gpa', label: 'GPA (optional)', type: 'text' },
  { key: 'startDate', label: 'Start (yyyy-mm)', type: 'text', placeholder: '2020-09' },
  { key: 'endDate', label: 'End (yyyy-mm or present)', type: 'text', placeholder: '2024-05' },
  { key: 'location', label: 'Location (optional)', type: 'text' },
];

export function renderEducation(container, profile, onSave) {
  // Ensure profile.education exists
  profile.education = profile.education || [];

  const section = document.createElement('section');
  section.className = 'options-section';
  section.setAttribute('data-section', 'education');

  const h2 = document.createElement('h2');
  h2.textContent = 'Education';
  section.appendChild(h2);

  const list = document.createElement('div');
  list.className = 'entry-list';
  section.appendChild(list);

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.textContent = '+ Add Education';
  addBtn.setAttribute('data-action', 'add-education');
  section.appendChild(addBtn);

  container.appendChild(section);

  function renderList() {
    list.innerHTML = '';
    profile.education.forEach((entry, idx) => {
      const card = document.createElement('div');
      card.className = 'entry-card';

      for (const f of EDU_FIELDS) {
        const wrapper = document.createElement('div');
        const label = document.createElement('label');
        label.textContent = f.label;
        const input = document.createElement('input');
        input.type = f.type;
        input.setAttribute('data-field', `education.${idx}.${f.key}`);
        if (f.placeholder) input.placeholder = f.placeholder;
        input.value = entry[f.key] ?? '';

        // Disable endDate if isCurrent
        if (f.key === 'endDate' && entry.isCurrent) {
          input.value = 'present';
          input.disabled = true;
        }

        input.addEventListener('change', () => {
          profile.education[idx][f.key] = input.value;
          if (onSave) onSave(JSON.parse(JSON.stringify(profile)));
        });

        label.appendChild(input);
        wrapper.appendChild(label);
        card.appendChild(wrapper);
      }

      // isCurrent checkbox
      const cbWrapper = document.createElement('div');
      const cbLabel = document.createElement('label');
      cbLabel.textContent = 'Currently enrolled';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.setAttribute('data-field', `education.${idx}.isCurrent`);
      cb.checked = !!entry.isCurrent;
      cb.addEventListener('change', () => {
        profile.education[idx].isCurrent = cb.checked;
        if (cb.checked) profile.education[idx].endDate = 'present';
        if (onSave) onSave(JSON.parse(JSON.stringify(profile)));
        renderList(); // re-render to toggle endDate disabled state
      });
      cbLabel.prepend(cb);
      cbWrapper.appendChild(cbLabel);
      card.appendChild(cbWrapper);

      // Remove button
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = 'Remove';
      removeBtn.setAttribute('data-action', 'remove-education');
      removeBtn.addEventListener('click', () => {
        profile.education.splice(idx, 1);
        if (onSave) onSave(JSON.parse(JSON.stringify(profile)));
        renderList();
      });
      card.appendChild(removeBtn);

      list.appendChild(card);
    });
  }

  addBtn.addEventListener('click', () => {
    profile.education.push(EMPTY_ENTRY());
    if (onSave) onSave(JSON.parse(JSON.stringify(profile)));
    renderList();
  });

  renderList();
}
