/**
 * test/ats/greenhouse.test.js — P2.2 Greenhouse adapter: text fields + links
 *
 * Tests the Greenhouse-specific adapter against a jsdom replica of the
 * standard Greenhouse job application form structure.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { fillGreenhouseForm } from '../../src/ats/greenhouse.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeDoc(html) {
  return new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, {
    url: 'https://boards.greenhouse.io/test/jobs/1',
  }).window.document;
}

const PROFILE = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  phone: '+14155550100',
  links: {
    linkedin: 'https://linkedin.com/in/ada',
    github: 'https://github.com/ada',
    portfolio: 'https://ada.dev',
    website: 'https://ada.io',
  },
  address: {
    city: 'San Francisco',
    state: 'CA',
    postalCode: '94103',
    country: 'United States',
  },
};

// ─── Greenhouse form HTML (simplified from real Greenhouse board) ─────────────

const GH_FORM = `
<form id="application_form" action="/applications" method="post">
  <!-- Personal info -->
  <div class="field">
    <label for="first_name">First Name <span class="required">*</span></label>
    <input id="first_name" name="job_application[first_name]" type="text" data-gh-input="first_name" />
  </div>
  <div class="field">
    <label for="last_name">Last Name <span class="required">*</span></label>
    <input id="last_name" name="job_application[last_name]" type="text" data-gh-input="last_name" />
  </div>
  <div class="field">
    <label for="email">Email <span class="required">*</span></label>
    <input id="email" name="job_application[email]" type="email" data-gh-input="email" />
  </div>
  <div class="field">
    <label for="phone">Phone</label>
    <input id="phone" name="job_application[phone]" type="tel" data-gh-input="phone" />
  </div>

  <!-- Links -->
  <div class="field">
    <label for="job_application_linkedin_profile_url">LinkedIn Profile</label>
    <input id="job_application_linkedin_profile_url"
           name="job_application[linkedin_profile_url]"
           type="url"
           data-gh-input="linkedin_profile_url" />
  </div>
  <div class="field">
    <label for="job_application_website">Website</label>
    <input id="job_application_website"
           name="job_application[website]"
           type="url"
           data-gh-input="website" />
  </div>
</form>
`;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('fillGreenhouseForm — text fields', () => {
  let doc;

  beforeEach(() => {
    doc = makeDoc(GH_FORM);
  });

  it('fills first name', async () => {
    await fillGreenhouseForm(doc, PROFILE);
    expect(doc.getElementById('first_name').value).toBe('Ada');
  });

  it('fills last name', async () => {
    await fillGreenhouseForm(doc, PROFILE);
    expect(doc.getElementById('last_name').value).toBe('Lovelace');
  });

  it('fills email', async () => {
    await fillGreenhouseForm(doc, PROFILE);
    expect(doc.getElementById('email').value).toBe('ada@example.com');
  });

  it('fills phone', async () => {
    await fillGreenhouseForm(doc, PROFILE);
    expect(doc.getElementById('phone').value).toBe('+14155550100');
  });

  it('fills LinkedIn URL', async () => {
    await fillGreenhouseForm(doc, PROFILE);
    expect(doc.getElementById('job_application_linkedin_profile_url').value)
      .toBe('https://linkedin.com/in/ada');
  });

  it('fills website URL', async () => {
    await fillGreenhouseForm(doc, PROFILE);
    expect(doc.getElementById('job_application_website').value).toBe('https://ada.io');
  });

  it('returns fill result with counts', async () => {
    const result = await fillGreenhouseForm(doc, PROFILE);
    expect(result.filled).toBeGreaterThan(0);
    expect(typeof result.skipped).toBe('number');
  });
});
