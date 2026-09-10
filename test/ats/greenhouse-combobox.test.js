/**
 * test/ats/greenhouse-combobox.test.js — P2.3 Greenhouse combobox/EEO/add-another
 *
 * Tests Greenhouse's custom combobox (autocomplete) for school/degree/EEO,
 * native <select> for EEO fields, and the "Add Another" button pattern.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { fillGreenhouseEEO, fillGreenhouseCombobox } from '../../src/ats/greenhouse.js';

function makeDoc(html) {
  return new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, {
    url: 'https://boards.greenhouse.io/test/jobs/1',
  }).window.document;
}

// ─── EEO native selects ───────────────────────────────────────────────────────

const EEO_FORM = `
<div id="eeoc_fields">
  <div class="field select optional">
    <label>Gender</label>
    <select name="job_application[eeoc_gender]" data-gh-input="eeoc_gender">
      <option value="">-- Please Select --</option>
      <option value="1">Male</option>
      <option value="2">Female</option>
      <option value="3">Decline To Self Identify</option>
    </select>
  </div>
  <div class="field select optional">
    <label>Race</label>
    <select name="job_application[eeoc_race]" data-gh-input="eeoc_race">
      <option value="">-- Please Select --</option>
      <option value="1">White</option>
      <option value="2">Asian</option>
      <option value="3">Two or More Races</option>
      <option value="4">Decline To Self Identify</option>
    </select>
  </div>
  <div class="field select optional">
    <label>Veteran Status</label>
    <select name="job_application[eeoc_veteran_status]" data-gh-input="eeoc_veteran_status">
      <option value="">-- Please Select --</option>
      <option value="1">I am not a protected veteran</option>
      <option value="2">I identify as one or more of the classifications of a protected veteran</option>
      <option value="3">I don't wish to answer</option>
    </select>
  </div>
  <div class="field select optional">
    <label>Disability Status</label>
    <select name="job_application[eeoc_disability_status]" data-gh-input="eeoc_disability_status">
      <option value="">-- Please Select --</option>
      <option value="1">Yes, I Have A Disability</option>
      <option value="2">No, I Don't Have A Disability</option>
      <option value="3">I Don't Wish To Answer</option>
    </select>
  </div>
</div>
`;

describe('fillGreenhouseEEO', () => {
  it('fills gender select', async () => {
    const doc = makeDoc(EEO_FORM);
    const profile = { eeo: { gender: 'Female' } };
    await fillGreenhouseEEO(doc, profile);
    expect(doc.querySelector('[data-gh-input="eeoc_gender"]').value).toBe('2');
  });

  it('fills race select', async () => {
    const doc = makeDoc(EEO_FORM);
    const profile = { eeo: { race: 'Asian' } };
    await fillGreenhouseEEO(doc, profile);
    expect(doc.querySelector('[data-gh-input="eeoc_race"]').value).toBe('2');
  });

  it('fills disability status', async () => {
    const doc = makeDoc(EEO_FORM);
    const profile = { eeo: { disabilityStatus: "No, I Don't Have A Disability" } };
    await fillGreenhouseEEO(doc, profile);
    expect(doc.querySelector('[data-gh-input="eeoc_disability_status"]').value).toBe('2');
  });

  it('selects "Decline" options when eeo values are empty string', async () => {
    const doc = makeDoc(EEO_FORM);
    const profile = { eeo: { gender: '', race: '', veteranStatus: '', disabilityStatus: '' } };
    await fillGreenhouseEEO(doc, profile);
    // Should pick "Decline To Self Identify" (value=3) for gender
    expect(doc.querySelector('[data-gh-input="eeoc_gender"]').value).toBe('3');
  });
});

// ─── Custom combobox (autocomplete) ──────────────────────────────────────────

const COMBOBOX_HTML = `
<div class="field" id="school-field">
  <label>School</label>
  <div role="combobox" aria-expanded="false" aria-haspopup="listbox" aria-owns="school-listbox">
    <input type="text" aria-autocomplete="list" aria-controls="school-listbox" placeholder="School" />
    <ul id="school-listbox" role="listbox" style="display:none">
      <li role="option" data-value="mit">Massachusetts Institute of Technology</li>
      <li role="option" data-value="stanford">Stanford University</li>
      <li role="option" data-value="harvard">Harvard University</li>
    </ul>
  </div>
</div>
`;

describe('fillGreenhouseCombobox', () => {
  it('types value and clicks matching option', async () => {
    const doc = makeDoc(COMBOBOX_HTML);
    const input = doc.querySelector('input');
    const listbox = doc.getElementById('school-listbox');

    // Show listbox when input is typed into
    input.addEventListener('input', () => { listbox.style.display = 'block'; });

    const result = await fillGreenhouseCombobox(
      doc.querySelector('[role="combobox"]'),
      'Stanford'
    );

    expect(result).toBe(true);
    expect(input.value.toLowerCase()).toContain('stanford');
  });

  it('returns false for no matching option', async () => {
    const doc = makeDoc(COMBOBOX_HTML);
    const result = await fillGreenhouseCombobox(
      doc.querySelector('[role="combobox"]'),
      'NonexistentSchool XYZ'
    );
    expect(result).toBe(false);
  });
});
