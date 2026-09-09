/**
 * skills.js — Tag-based skills input section.
 * Add skill: type in input + press Enter.
 * Remove skill: click × on tag.
 */

export function renderSkills(container, profile, onSave) {
  profile.skills = profile.skills || [];

  const section = document.createElement('section');
  section.className = 'options-section';
  section.setAttribute('data-section', 'skills');

  const h2 = document.createElement('h2');
  h2.textContent = 'Skills';
  section.appendChild(h2);

  const tagsContainer = document.createElement('div');
  tagsContainer.className = 'skills-tags';
  section.appendChild(tagsContainer);

  const inputWrapper = document.createElement('div');
  const skillInput = document.createElement('input');
  skillInput.type = 'text';
  skillInput.setAttribute('data-skill-input', '');
  skillInput.placeholder = 'Type a skill and press Enter';

  skillInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const val = skillInput.value.trim();
      if (val && !profile.skills.includes(val)) {
        profile.skills.push(val);
        skillInput.value = '';
        renderTags();
        if (onSave) onSave(JSON.parse(JSON.stringify(profile)));
      }
    }
  });

  inputWrapper.appendChild(skillInput);
  section.appendChild(inputWrapper);
  container.appendChild(section);

  function renderTags() {
    tagsContainer.innerHTML = '';
    for (const skill of profile.skills) {
      const tag = document.createElement('span');
      tag.setAttribute('data-skill-tag', skill);
      tag.textContent = skill + ' ';

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.textContent = '×';
      removeBtn.setAttribute('data-remove-skill', skill);
      removeBtn.addEventListener('click', () => {
        profile.skills = profile.skills.filter((s) => s !== skill);
        renderTags();
        if (onSave) onSave(JSON.parse(JSON.stringify(profile)));
      });
      tag.appendChild(removeBtn);
      tagsContainer.appendChild(tag);
    }
  }

  renderTags();
}
