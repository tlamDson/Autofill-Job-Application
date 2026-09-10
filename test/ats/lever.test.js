/**
 * test/ats/lever.test.js — P3.1 Lever adapter: text fields (fullName)
 *
 * Tests the Lever-specific adapter against a jsdom replica of the
 * standard Lever job application form structure.
 *
 * Lever uses a single "Full Name" field (not split first/last).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { fillLeverForm } from '../../src/ats/lever.js';

function makeDoc(html) {
  return new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, {
    url: 'https://jobs.lever.co/acme/abc-123/apply',
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
};

// ─── Lever standard form (simplified from real Lever application) ─────────────

const LEVER_FORM = `
<div class="application-form">
  <!-- Lever uses "name" for full name, not first/last split -->
  <div class="application-form-field">
    <label class="application-label" for="field-name">Full Name *</label>
    <input id="field-name" name="name" type="text" placeholder="Full name" />
  </div>

  <div class="application-form-field">
    <label class="application-label" for="field-email">Email *</label>
    <input id="field-email" name="email" type="email" placeholder="Email" />
  </div>

  <div class="application-form-field">
    <label class="application-label" for="field-phone">Phone</label>
    <input id="field-phone" name="phone" type="tel" placeholder="Phone" />
  </div>

  <!-- Links section -->
  <div class="application-form-field">
    <label class="application-label" for="field-urls[LinkedIn]">LinkedIn URL</label>
    <input id="field-urls[LinkedIn]" name="urls[LinkedIn]" type="url" placeholder="LinkedIn" />
  </div>
  <div class="application-form-field">
    <label class="application-label" for="field-urls[GitHub]">GitHub URL</label>
    <input id="field-urls[GitHub]" name="urls[GitHub]" type="url" placeholder="GitHub" />
  </div>
  <div class="application-form-field">
    <label class="application-label" for="field-urls[Portfolio]">Portfolio</label>
    <input id="field-urls[Portfolio]" name="urls[Portfolio]" type="url" placeholder="Portfolio" />
  </div>
</div>
`;

describe('fillLeverForm — text fields', () => {
  let doc;

  beforeEach(() => {
    doc = makeDoc(LEVER_FORM);
  });

  it('fills full name from firstName + lastName', async () => {
    await fillLeverForm(doc, PROFILE);
    expect(doc.getElementById('field-name').value).toBe('Ada Lovelace');
  });

  it('fills email', async () => {
    await fillLeverForm(doc, PROFILE);
    expect(doc.getElementById('field-email').value).toBe('ada@example.com');
  });

  it('fills phone', async () => {
    await fillLeverForm(doc, PROFILE);
    expect(doc.getElementById('field-phone').value).toBe('+14155550100');
  });

  it('fills LinkedIn URL', async () => {
    await fillLeverForm(doc, PROFILE);
    expect(doc.querySelector('[name="urls[LinkedIn]"]').value).toBe('https://linkedin.com/in/ada');
  });

  it('fills GitHub URL', async () => {
    await fillLeverForm(doc, PROFILE);
    expect(doc.querySelector('[name="urls[GitHub]"]').value).toBe('https://github.com/ada');
  });

  it('fills Portfolio URL', async () => {
    await fillLeverForm(doc, PROFILE);
    expect(doc.querySelector('[name="urls[Portfolio]"]').value).toBe('https://ada.dev');
  });

  it('returns fill result with counts', async () => {
    const result = await fillLeverForm(doc, PROFILE);
    expect(result.filled).toBeGreaterThan(0);
    expect(typeof result.skipped).toBe('number');
  });
});
