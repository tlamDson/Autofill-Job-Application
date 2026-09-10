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

  // authorizedToWork checkbox
  const authWrapper = document.createElement('div');
  authWrapper.className = 'field-wrapper';
  const authLabel = document.createElement('label');
  authLabel.textContent = 'Authorized to work in the US';
  const authCb = document.createElement('input');
  authCb.type = 'checkbox';
  authCb.setAttribute('data-field', 'workAuthorization.authorizedToWork');
  authCb.checked = wa.authorizedToWork === true;
  authCb.addEventListener('change', () => {
    profile.workAuthorization.authorizedToWork = authCb.checked;
    if (onSave) onSave(JSON.parse(JSON.stringify(profile)));
  });
  authLabel.prepend(authCb);
  authWrapper.appendChild(authLabel);
  section.appendChild(authWrapper);

  const authNote = document.createElement('p');
  authNote.textContent = 'Unchecked means this field is left blank on forms rather than answered "No" — check it once you know the answer.';
  authNote.style.fontSize = '12px';
  section.appendChild(authNote);

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
