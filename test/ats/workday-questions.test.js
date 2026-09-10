/**
 * test/ats/workday-questions.test.js — P5.5 Workday questions + EEO step
 *
 * Workday's "Self Identify" step uses data-automation-id for EEO selects.
 * Application questions use radio buttons or text inputs.
 *
 * Tests:
 *   - fillWorkdayEEO(doc, profile) — fill gender, race, veteran, disability
 *   - fillWorkdayRadioQuestion(container, value) — find + click radio by text
 */

import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { fillWorkdayEEO, fillWorkdayRadioQuestion } from '../../src/ats/workday.js';

function makeDoc(html) {
  return new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, {
    url: 'https://wd3.myworkday.com/acme/d/task/apply',
  }).window.document;
}

// ─── Workday EEO HTML fixture ─────────────────────────────────────────────────

const WD_EEO_HTML = `
<div data-automation-id="selfIdentifySection">
  <select data-automation-id="gender">
    <option value="">-- Select --</option>
    <option value="female">Female</option>
    <option value="male">Male</option>
    <option value="decline">Prefer not to say</option>
  </select>
  <select data-automation-id="race">
    <option value="">-- Select --</option>
    <option value="asian">Asian</option>
    <option value="white">White/Caucasian</option>
    <option value="decline">Decline to Identify</option>
  </select>
  <select data-automation-id="veteranStatus">
    <option value="">-- Select --</option>
    <option value="not_veteran">Not a veteran</option>
    <option value="decline">I don't wish to answer</option>
  </select>
  <select data-automation-id="disability">
    <option value="">-- Select --</option>
    <option value="no">No, I don't have a disability</option>
    <option value="decline">I don't wish to answer</option>
  </select>
</div>
`;

describe('fillWorkdayEEO', () => {
  it('fills gender select', async () => {
    const doc = makeDoc(WD_EEO_HTML);
    await fillWorkdayEEO(doc, { eeo: { gender: 'Female' } });
    expect(doc.querySelector('[data-automation-id="gender"]').value).toBe('female');
  });

  it('fills race select', async () => {
    const doc = makeDoc(WD_EEO_HTML);
    await fillWorkdayEEO(doc, { eeo: { race: 'Asian' } });
    expect(doc.querySelector('[data-automation-id="race"]').value).toBe('asian');
  });

  it('fills veteran status', async () => {
    const doc = makeDoc(WD_EEO_HTML);
    await fillWorkdayEEO(doc, { eeo: { veteranStatus: 'not_veteran' } });
    expect(doc.querySelector('[data-automation-id="veteranStatus"]').value).toBe('not_veteran');
  });

  it('selects decline when eeo value is empty string', async () => {
    const doc = makeDoc(WD_EEO_HTML);
    await fillWorkdayEEO(doc, { eeo: { gender: '' } });
    expect(doc.querySelector('[data-automation-id="gender"]').value).toBe('decline');
  });
});

// ─── Radio question filler ────────────────────────────────────────────────────

const WD_RADIO_QUESTION_HTML = `
<div class="workday-radio-group" data-automation-id="applicationQuestion-workAuth">
  <label>Are you authorized to work in the US?</label>
  <div>
    <input type="radio" id="auth-yes" name="workAuth" value="yes" />
    <label for="auth-yes">Yes</label>
  </div>
  <div>
    <input type="radio" id="auth-no" name="workAuth" value="no" />
    <label for="auth-no">No</label>
  </div>
</div>
`;

describe('fillWorkdayRadioQuestion', () => {
  it('checks the radio matching the value', () => {
    const doc = makeDoc(WD_RADIO_QUESTION_HTML);
    const container = doc.querySelector('[data-automation-id="applicationQuestion-workAuth"]');
    fillWorkdayRadioQuestion(container, 'yes');
    expect(doc.getElementById('auth-yes').checked).toBe(true);
    expect(doc.getElementById('auth-no').checked).toBe(false);
  });

  it('matches by label text (case-insensitive)', () => {
    const doc = makeDoc(WD_RADIO_QUESTION_HTML);
    const container = doc.querySelector('[data-automation-id="applicationQuestion-workAuth"]');
    fillWorkdayRadioQuestion(container, 'Yes');
    expect(doc.getElementById('auth-yes').checked).toBe(true);
  });

  it('returns false when no matching radio found', () => {
    const doc = makeDoc(WD_RADIO_QUESTION_HTML);
    const container = doc.querySelector('[data-automation-id="applicationQuestion-workAuth"]');
    const result = fillWorkdayRadioQuestion(container, 'Maybe');
    expect(result).toBe(false);
  });

  it('returns true when radio is successfully checked', () => {
    const doc = makeDoc(WD_RADIO_QUESTION_HTML);
    const container = doc.querySelector('[data-automation-id="applicationQuestion-workAuth"]');
    const result = fillWorkdayRadioQuestion(container, 'no');
    expect(result).toBe(true);
    expect(doc.getElementById('auth-no').checked).toBe(true);
  });
});
