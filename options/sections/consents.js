/**
 * consents.js — Options UI for auto-ticking consent checkboxes.
 *
 * Off by default. classifyField's termsAgreement rule only ever matches an
 * ordinary "I agree to the Terms and Conditions / Privacy Policy" checkbox —
 * it deliberately excludes background checks, credit checks, drug
 * screening, arbitration clauses, and at-will employment acknowledgments,
 * which stay unticked regardless of this setting.
 */

export function renderConsents(container, profile, onSave) {
  profile.consents = profile.consents || {};

  const section = document.createElement('section');
  section.className = 'options-section';

  const h2 = document.createElement('h2');
  h2.textContent = 'Consents';
  section.appendChild(h2);

  const wrapper = document.createElement('div');
  wrapper.className = 'field-wrapper';
  const label = document.createElement('label');
  label.textContent = 'Automatically agree to Terms & Conditions / Privacy Policy checkboxes';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.setAttribute('data-field', 'consents.agreeToTerms');
  cb.checked = !!profile.consents.agreeToTerms;
  cb.addEventListener('change', () => {
    profile.consents.agreeToTerms = cb.checked;
    if (onSave) onSave(JSON.parse(JSON.stringify(profile)));
  });
  label.prepend(cb);
  wrapper.appendChild(label);
  section.appendChild(wrapper);

  const note = document.createElement('p');
  note.textContent =
    'Never applies to background checks, credit checks, drug screening, arbitration clauses, or at-will employment acknowledgments — those are always left for you to review and tick yourself.';
  note.style.fontSize = '12px';
  section.appendChild(note);

  container.appendChild(section);
}
