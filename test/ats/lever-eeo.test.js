/**
 * test/ats/lever-eeo.test.js — P3.2 Lever EEO selects + card questions
 *
 * Tests Lever's EEO section (diversity questions) and card-style questions
 * that appear on Lever application forms.
 */

import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { fillLeverEEO, fillLeverCardQuestion } from '../../src/ats/lever.js';

function makeDoc(html) {
  return new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, {
    url: 'https://jobs.lever.co/acme/abc-123/apply',
  }).window.document;
}

// ─── Lever EEO section ────────────────────────────────────────────────────────

const LEVER_EEO_FORM = `
<div class="application-eeo">
  <div class="eeo-row">
    <label>Gender</label>
    <select name="eeo[gender]">
      <option value="">--</option>
      <option value="male">Male</option>
      <option value="female">Female</option>
      <option value="decline">Prefer not to say</option>
    </select>
  </div>
  <div class="eeo-row">
    <label>Race</label>
    <select name="eeo[race]">
      <option value="">--</option>
      <option value="asian">Asian</option>
      <option value="white">White</option>
      <option value="decline">Decline to identify</option>
    </select>
  </div>
  <div class="eeo-row">
    <label>Veteran Status</label>
    <select name="eeo[veteran]">
      <option value="">--</option>
      <option value="not_veteran">I am not a protected veteran</option>
      <option value="decline">I don't wish to answer</option>
    </select>
  </div>
</div>
`;

describe('fillLeverEEO', () => {
  it('fills gender select', async () => {
    const doc = makeDoc(LEVER_EEO_FORM);
    await fillLeverEEO(doc, { eeo: { gender: 'Female' } });
    expect(doc.querySelector('[name="eeo[gender]"]').value).toBe('female');
  });

  it('fills race select', async () => {
    const doc = makeDoc(LEVER_EEO_FORM);
    await fillLeverEEO(doc, { eeo: { race: 'Asian' } });
    expect(doc.querySelector('[name="eeo[race]"]').value).toBe('asian');
  });

  it('fills veteran status', async () => {
    const doc = makeDoc(LEVER_EEO_FORM);
    await fillLeverEEO(doc, { eeo: { veteranStatus: 'not_veteran' } });
    expect(doc.querySelector('[name="eeo[veteran]"]').value).toBe('not_veteran');
  });

  it('selects "decline" option when eeo value is empty', async () => {
    const doc = makeDoc(LEVER_EEO_FORM);
    await fillLeverEEO(doc, { eeo: { gender: '' } });
    expect(doc.querySelector('[name="eeo[gender]"]').value).toBe('decline');
  });
});

// ─── Lever card questions ─────────────────────────────────────────────────────

const CARD_QUESTION_FORM = `
<div class="application-card">
  <div class="card-field">
    <label>Are you authorized to work in the US?</label>
    <div class="lever-radio-group">
      <label><input type="radio" name="cards[][field_sets][][fields][][value]" value="yes" /> Yes</label>
      <label><input type="radio" name="cards[][field_sets][][fields][][value]" value="no" /> No</label>
    </div>
  </div>
  <div class="card-field">
    <label>Do you require visa sponsorship?</label>
    <div class="lever-radio-group">
      <label><input type="radio" name="cards[][field_sets][][fields][][value]" value="yes" /> Yes</label>
      <label><input type="radio" name="cards[][field_sets][][fields][][value]" value="no" /> No</label>
    </div>
  </div>
</div>
`;

describe('fillLeverCardQuestion', () => {
  it('fills a single-answer radio card question', async () => {
    const doc = makeDoc(`
      <div class="card-field">
        <label>Are you authorized to work?</label>
        <div class="lever-radio-group">
          <label><input type="radio" name="auth_q" value="yes" /> Yes</label>
          <label><input type="radio" name="auth_q" value="no" /> No</label>
        </div>
      </div>
    `);
    const field = doc.querySelector('.card-field');
    await fillLeverCardQuestion(field, 'yes');
    const checked = doc.querySelector('input[type="radio"]:checked');
    expect(checked?.value).toBe('yes');
  });

  it('fills a text card question', async () => {
    const doc = makeDoc(`
      <div class="card-field">
        <label>What is your expected salary?</label>
        <input type="text" name="salary_q" />
      </div>
    `);
    const field = doc.querySelector('.card-field');
    await fillLeverCardQuestion(field, '100000');
    expect(doc.querySelector('[name="salary_q"]').value).toBe('100000');
  });
});
