/**
 * workAuth.js — Work Authorization section UI.
 */

export function renderWorkAuth(container, profile, onSave) {
  profile.workAuthorization = profile.workAuthorization || {};
  const wa = profile.workAuthorization;

  const section = document.createElement('section');
  section.className = 'options-section';

  const h2 = document.createElement('h2');
  h2.textContent = 'Work Authorization';
  section.appendChild(h2);

  // needsSponsorship checkbox
  const wrapper = document.createElement('div');
  wrapper.className = 'field-wrapper';
  const label = document.createElement('label');
  label.textContent = 'Requires sponsorship (visa)';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.setAttribute('data-field', 'workAuthorization.needsSponsorship');
  cb.checked = !!wa.needsSponsorship;
  cb.addEventListener('change', () => {
    profile.workAuthorization.needsSponsorship = cb.checked;
    if (onSave) onSave(JSON.parse(JSON.stringify(profile)));
  });
  label.prepend(cb);
  wrapper.appendChild(label);
  section.appendChild(wrapper);

  // visaStatus text
  const vsWrapper = document.createElement('div');
  const vsLabel = document.createElement('label');
  vsLabel.textContent = 'Visa / Authorization Status';
  const vsInput = document.createElement('input');
  vsInput.type = 'text';
  vsInput.setAttribute('data-field', 'workAuthorization.visaStatus');
  vsInput.value = wa.visaStatus || '';
  vsInput.placeholder = 'e.g. US Citizen, H1-B, OPT';
  vsInput.addEventListener('change', () => {
    profile.workAuthorization.visaStatus = vsInput.value;
    if (onSave) onSave(JSON.parse(JSON.stringify(profile)));
  });
  vsLabel.appendChild(vsInput);
  vsWrapper.appendChild(vsLabel);
  section.appendChild(vsWrapper);

  container.appendChild(section);
}
