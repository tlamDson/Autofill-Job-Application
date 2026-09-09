/**
 * workHistory.js — List editor for work history entries.
 * Supports add, remove; isCurrent locks endDate to "present".
 */

const EMPTY_ENTRY = () => ({
  company: '', title: '', location: '', startDate: '', endDate: '', description: '', isCurrent: false,
});

const WORK_FIELDS = [
  { key: 'company', label: 'Company', type: 'text' },
  { key: 'title', label: 'Job Title', type: 'text' },
  { key: 'location', label: 'Location (optional)', type: 'text' },
  { key: 'startDate', label: 'Start (yyyy-mm)', type: 'text', placeholder: '2022-01' },
  { key: 'endDate', label: 'End (yyyy-mm or present)', type: 'text', placeholder: '2024-12' },
  { key: 'description', label: 'Description / Bullets', type: 'textarea' },
];

export function renderWorkHistory(container, profile, onSave) {
  profile.workHistory = profile.workHistory || [];

  const section = document.createElement('section');
  section.className = 'options-section';
  section.setAttribute('data-section', 'workHistory');

  const h2 = document.createElement('h2');
  h2.textContent = 'Work History';
  section.appendChild(h2);

  const list = document.createElement('div');
  list.className = 'entry-list';
  section.appendChild(list);

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.textContent = '+ Add Position';
  addBtn.setAttribute('data-action', 'add-work');
  section.appendChild(addBtn);

  container.appendChild(section);

  function renderList() {
    list.innerHTML = '';
    profile.workHistory.forEach((entry, idx) => {
      const card = document.createElement('div');
      card.className = 'entry-card';

      for (const f of WORK_FIELDS) {
        const wrapper = document.createElement('div');
        const label = document.createElement('label');
        label.textContent = f.label;

        let input;
        if (f.type === 'textarea') {
          input = document.createElement('textarea');
        } else {
          input = document.createElement('input');
          input.type = f.type;
          if (f.placeholder) input.placeholder = f.placeholder;
        }
        input.setAttribute('data-field', `workHistory.${idx}.${f.key}`);
        input.value = entry[f.key] ?? '';

        if (f.key === 'endDate' && entry.isCurrent) {
          input.value = 'present';
          input.disabled = true;
        }

        input.addEventListener('change', () => {
          profile.workHistory[idx][f.key] = input.value;
          if (onSave) onSave(JSON.parse(JSON.stringify(profile)));
        });

        label.appendChild(input);
        wrapper.appendChild(label);
        card.appendChild(wrapper);
      }

      // isCurrent checkbox
      const cbWrapper = document.createElement('div');
      const cbLabel = document.createElement('label');
      cbLabel.textContent = 'Current position';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.setAttribute('data-field', `workHistory.${idx}.isCurrent`);
      cb.checked = !!entry.isCurrent;
      cb.addEventListener('change', () => {
        profile.workHistory[idx].isCurrent = cb.checked;
        if (cb.checked) profile.workHistory[idx].endDate = 'present';
        if (onSave) onSave(JSON.parse(JSON.stringify(profile)));
        renderList();
      });
      cbLabel.prepend(cb);
      cbWrapper.appendChild(cbLabel);
      card.appendChild(cbWrapper);

      // Remove button
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = 'Remove';
      removeBtn.setAttribute('data-action', 'remove-work');
      removeBtn.addEventListener('click', () => {
        profile.workHistory.splice(idx, 1);
        if (onSave) onSave(JSON.parse(JSON.stringify(profile)));
        renderList();
      });
      card.appendChild(removeBtn);

      list.appendChild(card);
    });
  }

  addBtn.addEventListener('click', () => {
    profile.workHistory.push(EMPTY_ENTRY());
    if (onSave) onSave(JSON.parse(JSON.stringify(profile)));
    renderList();
  });

  renderList();
}
