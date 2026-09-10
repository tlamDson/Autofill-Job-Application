/**
 * test/ats/ashby.test.js — P6.2 Ashby adapter
 *
 * Ashby (ashbyhq.com) uses React forms. Key identifiers:
 *  - Forms at jobs.ashbyhq.com or {company}.ashbyhq.com
 *  - Field names like "name", "email", "phone", "_systemfield_name" for full name
 *  - Custom questions use distinctive field IDs
 *  - No data-automation-id; rely on label-based heuristics + name attributes
 */

import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { fillAshbyForm } from '../../src/ats/ashby.js';

function makeDoc(html) {
  return new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, {
    url: 'https://jobs.ashbyhq.com/acme/abc-123/application',
  }).window.document;
}

const ASHBY_FORM_HTML = `
<form>
  <!-- Full name field (Ashby combines first + last) -->
  <div>
    <label for="name">Full Name *</label>
    <input id="name" name="_systemfield_name" type="text" />
  </div>
  <!-- Email -->
  <div>
    <label for="email">Email *</label>
    <input id="email" name="_systemfield_email" type="email" />
  </div>
  <!-- Phone -->
  <div>
    <label for="phone">Phone</label>
    <input id="phone" name="_systemfield_phone" type="tel" />
  </div>
  <!-- LinkedIn URL -->
  <div>
    <label for="linkedin">LinkedIn Profile</label>
    <input id="linkedin" name="_systemfield_linkedin" type="url" />
  </div>
  <!-- Location (city) -->
  <div>
    <label for="location">Location</label>
    <input id="location" name="_systemfield_location" type="text" />
  </div>
</form>
`;

const PROFILE = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  phone: '4155552671',
  address: { city: 'San Francisco', state: 'CA' },
  links: { linkedin: 'https://linkedin.com/in/ada' },
};

describe('fillAshbyForm', () => {
  it('fills full name as "FirstName LastName"', async () => {
    const doc = makeDoc(ASHBY_FORM_HTML);
    await fillAshbyForm(doc, PROFILE);
    expect(doc.querySelector('[name="_systemfield_name"]').value).toBe('Ada Lovelace');
  });

  it('fills email', async () => {
    const doc = makeDoc(ASHBY_FORM_HTML);
    await fillAshbyForm(doc, PROFILE);
    expect(doc.querySelector('[name="_systemfield_email"]').value).toBe('ada@example.com');
  });

  it('fills phone', async () => {
    const doc = makeDoc(ASHBY_FORM_HTML);
    await fillAshbyForm(doc, PROFILE);
    expect(doc.querySelector('[name="_systemfield_phone"]').value).toBe('4155552671');
  });

  it('fills LinkedIn URL', async () => {
    const doc = makeDoc(ASHBY_FORM_HTML);
    await fillAshbyForm(doc, PROFILE);
    expect(doc.querySelector('[name="_systemfield_linkedin"]').value)
      .toBe('https://linkedin.com/in/ada');
  });

  it('fills location (city)', async () => {
    const doc = makeDoc(ASHBY_FORM_HTML);
    await fillAshbyForm(doc, PROFILE);
    expect(doc.querySelector('[name="_systemfield_location"]').value)
      .toBe('San Francisco, CA');
  });

  it('returns {filled, skipped}', async () => {
    const doc = makeDoc(ASHBY_FORM_HTML);
    const result = await fillAshbyForm(doc, PROFILE);
    expect(result).toHaveProperty('filled');
    expect(result).toHaveProperty('skipped');
    expect(result.filled).toBeGreaterThan(0);
  });
});
