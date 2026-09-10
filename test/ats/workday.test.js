/**
 * test/ats/workday.test.js — P5.1 Workday text fields (My Information)
 *
 * Workday uses `data-automation-id` attributes on key elements.
 * The "My Information" section has stable automation IDs for:
 *  - legalName (first, last, middle)
 *  - email
 *  - phone
 *  - address fields
 *
 * Key Workday patterns:
 *  - Input elements: <input data-automation-id="legalNameSection_firstName" ...>
 *  - Labels are not always <label> elements — often aria-label on the input
 *  - Widget containers: [data-automation-id="formField-<fieldId>"]
 */

import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { fillWorkdayMyInfo } from '../../src/ats/workday.js';

function makeDoc(html) {
  return new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, {
    url: 'https://wd3.myworkday.com/acme/d/task/apply',
  }).window.document;
}

// ─── Workday My Information HTML fixture ──────────────────────────────────────

const WD_MY_INFO_HTML = `
<div data-automation-id="legalNameSection">
  <input data-automation-id="legalNameSection_firstName" type="text" value="" />
  <input data-automation-id="legalNameSection_lastName" type="text" value="" />
  <input data-automation-id="legalNameSection_middleName" type="text" value="" />
</div>
<div data-automation-id="emailSection">
  <input data-automation-id="email" type="email" value="" />
</div>
<div data-automation-id="phoneSection">
  <input data-automation-id="phone-number" type="tel" value="" />
</div>
<div data-automation-id="addressSection">
  <input data-automation-id="addressSection_addressLine1" type="text" value="" />
  <input data-automation-id="addressSection_city" type="text" value="" />
  <input data-automation-id="addressSection_postalCode" type="text" value="" />
</div>
`;

const PROFILE = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  phone: '+1-415-555-2671',
  address: {
    street: '123 Main St',
    city: 'San Francisco',
    state: 'CA',
    zip: '94102',
  },
};

describe('fillWorkdayMyInfo', () => {
  it('fills first name', async () => {
    const doc = makeDoc(WD_MY_INFO_HTML);
    await fillWorkdayMyInfo(doc, PROFILE);
    expect(doc.querySelector('[data-automation-id="legalNameSection_firstName"]').value)
      .toBe('Ada');
  });

  it('fills last name', async () => {
    const doc = makeDoc(WD_MY_INFO_HTML);
    await fillWorkdayMyInfo(doc, PROFILE);
    expect(doc.querySelector('[data-automation-id="legalNameSection_lastName"]').value)
      .toBe('Lovelace');
  });

  it('fills email', async () => {
    const doc = makeDoc(WD_MY_INFO_HTML);
    await fillWorkdayMyInfo(doc, PROFILE);
    expect(doc.querySelector('[data-automation-id="email"]').value)
      .toBe('ada@example.com');
  });

  it('fills phone', async () => {
    const doc = makeDoc(WD_MY_INFO_HTML);
    await fillWorkdayMyInfo(doc, PROFILE);
    expect(doc.querySelector('[data-automation-id="phone-number"]').value)
      .toBe('+1-415-555-2671');
  });

  it('fills street address', async () => {
    const doc = makeDoc(WD_MY_INFO_HTML);
    await fillWorkdayMyInfo(doc, PROFILE);
    expect(doc.querySelector('[data-automation-id="addressSection_addressLine1"]').value)
      .toBe('123 Main St');
  });

  it('fills city', async () => {
    const doc = makeDoc(WD_MY_INFO_HTML);
    await fillWorkdayMyInfo(doc, PROFILE);
    expect(doc.querySelector('[data-automation-id="addressSection_city"]').value)
      .toBe('San Francisco');
  });

  it('fills postal code', async () => {
    const doc = makeDoc(WD_MY_INFO_HTML);
    await fillWorkdayMyInfo(doc, PROFILE);
    expect(doc.querySelector('[data-automation-id="addressSection_postalCode"]').value)
      .toBe('94102');
  });

  it('returns {filled, skipped} result', async () => {
    const doc = makeDoc(WD_MY_INFO_HTML);
    const result = await fillWorkdayMyInfo(doc, PROFILE);
    expect(result).toHaveProperty('filled');
    expect(result).toHaveProperty('skipped');
    expect(result.filled).toBeGreaterThan(0);
  });

  it('skips a field when profile value is missing', async () => {
    const doc = makeDoc(WD_MY_INFO_HTML);
    const partialProfile = { firstName: 'Ada', lastName: 'Lovelace' };
    const result = await fillWorkdayMyInfo(doc, partialProfile);
    expect(result.filled).toBeGreaterThanOrEqual(2); // firstName + lastName at minimum
  });
});
