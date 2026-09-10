/**
 * test/ats/icims.test.js — P6.1 iCIMS adapter (iframe)
 *
 * iCIMS forms use PortalApplicant.* prefixed field names.
 * Real iCIMS fills would be inside an iframe (same origin), but for unit
 * tests we simulate the inner document directly.
 *
 * Key iCIMS field names:
 *   PortalApplicant.FirstName, PortalApplicant.LastName
 *   PortalApplicant.EmailAddress
 *   PortalApplicant.CellPhone
 *   PortalApplicant.Address1, PortalApplicant.City, PortalApplicant.Zip
 *   PortalApplicant.LinkedInURL
 */

import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { fillICIMSForm } from '../../src/ats/icims.js';

function makeDoc(html) {
  return new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, {
    url: 'https://careers.icims.com/jobs/apply',
  }).window.document;
}

const ICIMS_FORM_HTML = `
<form>
  <input type="text" name="PortalApplicant.FirstName" value="" />
  <input type="text" name="PortalApplicant.LastName" value="" />
  <input type="email" name="PortalApplicant.EmailAddress" value="" />
  <input type="tel" name="PortalApplicant.CellPhone" value="" />
  <input type="text" name="PortalApplicant.Address1" value="" />
  <input type="text" name="PortalApplicant.City" value="" />
  <input type="text" name="PortalApplicant.Zip" value="" />
  <input type="url" name="PortalApplicant.LinkedInURL" value="" />
</form>
`;

const PROFILE = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  phone: '4155552671',
  address: { street: '123 Main St', city: 'San Francisco', zip: '94102' },
  links: { linkedin: 'https://linkedin.com/in/ada' },
};

describe('fillICIMSForm', () => {
  it('fills first name', async () => {
    const doc = makeDoc(ICIMS_FORM_HTML);
    await fillICIMSForm(doc, PROFILE);
    expect(doc.querySelector('[name="PortalApplicant.FirstName"]').value).toBe('Ada');
  });

  it('fills last name', async () => {
    const doc = makeDoc(ICIMS_FORM_HTML);
    await fillICIMSForm(doc, PROFILE);
    expect(doc.querySelector('[name="PortalApplicant.LastName"]').value).toBe('Lovelace');
  });

  it('fills email', async () => {
    const doc = makeDoc(ICIMS_FORM_HTML);
    await fillICIMSForm(doc, PROFILE);
    expect(doc.querySelector('[name="PortalApplicant.EmailAddress"]').value).toBe('ada@example.com');
  });

  it('fills phone', async () => {
    const doc = makeDoc(ICIMS_FORM_HTML);
    await fillICIMSForm(doc, PROFILE);
    expect(doc.querySelector('[name="PortalApplicant.CellPhone"]').value).toBe('4155552671');
  });

  it('fills street address', async () => {
    const doc = makeDoc(ICIMS_FORM_HTML);
    await fillICIMSForm(doc, PROFILE);
    expect(doc.querySelector('[name="PortalApplicant.Address1"]').value).toBe('123 Main St');
  });

  it('fills city', async () => {
    const doc = makeDoc(ICIMS_FORM_HTML);
    await fillICIMSForm(doc, PROFILE);
    expect(doc.querySelector('[name="PortalApplicant.City"]').value).toBe('San Francisco');
  });

  it('fills zip', async () => {
    const doc = makeDoc(ICIMS_FORM_HTML);
    await fillICIMSForm(doc, PROFILE);
    expect(doc.querySelector('[name="PortalApplicant.Zip"]').value).toBe('94102');
  });

  it('fills LinkedIn URL', async () => {
    const doc = makeDoc(ICIMS_FORM_HTML);
    await fillICIMSForm(doc, PROFILE);
    expect(doc.querySelector('[name="PortalApplicant.LinkedInURL"]').value)
      .toBe('https://linkedin.com/in/ada');
  });

  it('returns {filled, skipped}', async () => {
    const doc = makeDoc(ICIMS_FORM_HTML);
    const result = await fillICIMSForm(doc, PROFILE);
    expect(result.filled).toBeGreaterThan(0);
    expect(result).toHaveProperty('skipped');
  });
});
