/**
 * test/ats/smartrecruiters.test.js — P6.3 SmartRecruiters adapter
 *
 * SmartRecruiters (smartrecruiters.com) forms use:
 *  - Standard HTML form fields with well-known name attributes
 *  - `data-field-id` attributes on field containers
 *  - Sections: personal (firstName, lastName, email, phone), address, etc.
 */

import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { fillSmartRecruitersForm } from '../../src/ats/smartrecruiters.js';

function makeDoc(html) {
  return new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, {
    url: 'https://jobs.smartrecruiters.com/one/acme/apply',
  }).window.document;
}

const SR_FORM_HTML = `
<form>
  <div data-field-id="firstName">
    <label>First Name *</label>
    <input type="text" name="firstName" value="" />
  </div>
  <div data-field-id="lastName">
    <label>Last Name *</label>
    <input type="text" name="lastName" value="" />
  </div>
  <div data-field-id="email">
    <label>Email *</label>
    <input type="email" name="email" value="" />
  </div>
  <div data-field-id="phoneNumber">
    <label>Phone</label>
    <input type="tel" name="phoneNumber" value="" />
  </div>
  <div data-field-id="location.city">
    <label>City</label>
    <input type="text" name="location.city" value="" />
  </div>
  <div data-field-id="location.country">
    <label>Country</label>
    <select name="location.country">
      <option value="">Select...</option>
      <option value="US">United States</option>
      <option value="CA">Canada</option>
    </select>
  </div>
  <div data-field-id="web.linkedin">
    <label>LinkedIn</label>
    <input type="url" name="web.linkedin" value="" />
  </div>
  <div data-field-id="web.portfolio">
    <label>Portfolio</label>
    <input type="url" name="web.portfolio" value="" />
  </div>
</form>
`;

const PROFILE = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  phone: '4155552671',
  address: { city: 'San Francisco', country: 'US' },
  links: {
    linkedin: 'https://linkedin.com/in/ada',
    portfolio: 'https://ada.dev',
  },
};

describe('fillSmartRecruitersForm', () => {
  it('fills first name', async () => {
    const doc = makeDoc(SR_FORM_HTML);
    await fillSmartRecruitersForm(doc, PROFILE);
    expect(doc.querySelector('[name="firstName"]').value).toBe('Ada');
  });

  it('fills last name', async () => {
    const doc = makeDoc(SR_FORM_HTML);
    await fillSmartRecruitersForm(doc, PROFILE);
    expect(doc.querySelector('[name="lastName"]').value).toBe('Lovelace');
  });

  it('fills email', async () => {
    const doc = makeDoc(SR_FORM_HTML);
    await fillSmartRecruitersForm(doc, PROFILE);
    expect(doc.querySelector('[name="email"]').value).toBe('ada@example.com');
  });

  it('fills phone', async () => {
    const doc = makeDoc(SR_FORM_HTML);
    await fillSmartRecruitersForm(doc, PROFILE);
    expect(doc.querySelector('[name="phoneNumber"]').value).toBe('4155552671');
  });

  it('fills city', async () => {
    const doc = makeDoc(SR_FORM_HTML);
    await fillSmartRecruitersForm(doc, PROFILE);
    expect(doc.querySelector('[name="location.city"]').value).toBe('San Francisco');
  });

  it('fills country select', async () => {
    const doc = makeDoc(SR_FORM_HTML);
    await fillSmartRecruitersForm(doc, PROFILE);
    expect(doc.querySelector('[name="location.country"]').value).toBe('US');
  });

  it('fills LinkedIn URL', async () => {
    const doc = makeDoc(SR_FORM_HTML);
    await fillSmartRecruitersForm(doc, PROFILE);
    expect(doc.querySelector('[name="web.linkedin"]').value)
      .toBe('https://linkedin.com/in/ada');
  });

  it('returns {filled, skipped}', async () => {
    const doc = makeDoc(SR_FORM_HTML);
    const result = await fillSmartRecruitersForm(doc, PROFILE);
    expect(result.filled).toBeGreaterThan(0);
    expect(result).toHaveProperty('skipped');
  });
});
