/**
 * test/adapters/generic.test.js — P1.14 Generic adapter
 *
 * Tests the fill plan generator and field routing logic in the generic adapter.
 * Uses jsdom; no real browser needed for these unit tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { buildFillPlan, fillField, runGenericFill } from '../../src/adapters/generic.js';
import { createEmptyProfile } from '../../src/profile/schema.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeDoc(html) {
  return new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, {
    url: 'http://localhost/',
  }).window.document;
}

/** Minimal profile for testing, built on the real nested schema */
const PROFILE = {
  ...createEmptyProfile(),
  personal: {
    ...createEmptyProfile().personal,
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    phone: '+14155550100',
    address: {
      ...createEmptyProfile().personal.address,
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94103',
      country: 'United States',
    },
  },
  links: {
    ...createEmptyProfile().links,
    linkedin: 'https://linkedin.com/in/ada',
  },
};

// ─── buildFillPlan ────────────────────────────────────────────────────────────

describe('buildFillPlan', () => {
  it('returns an array of { el, key, value } for fillable classified inputs', () => {
    const doc = makeDoc(`
      <form>
        <label for="fn">First Name</label>
        <input id="fn" name="first_name" type="text" />
        <label for="em">Email</label>
        <input id="em" name="email" type="email" />
        <!-- honeypot: display:none -->
        <input id="hp" name="trap" type="text" style="display:none" />
      </form>
    `);

    const plan = buildFillPlan(doc, PROFILE);

    // Should include first_name and email
    const keys = plan.map((p) => p.key);
    expect(keys.includes('firstName')).toBe(true);
    expect(keys.includes('email')).toBe(true);

    // Should NOT include the honeypot (identified by id)
    const planIds = plan.map((p) => p.el.id);
    expect(planIds.includes('hp')).toBe(false);
  });

  it('skips fields with no matching profile key (null classifyField)', () => {
    const doc = makeDoc(`
      <input name="unknown_custom_field_xyz" type="text" />
    `);
    const plan = buildFillPlan(doc, PROFILE);
    expect(plan.length).toBe(0);
  });

  it('skips fields whose profile value is empty/undefined', () => {
    const doc = makeDoc(`
      <label for="gpa">GPA</label>
      <input id="gpa" name="gpa" type="text" />
    `);
    // PROFILE has no gpa field — value would be undefined/empty
    const plan = buildFillPlan(doc, PROFILE);
    expect(plan.length).toBe(0);
  });

  it('resolves nested profile paths like workHistory[0].company', () => {
    const profileWithWork = {
      ...PROFILE,
      workHistory: [{ company: 'Acme Corp', title: 'Engineer' }],
    };
    // Company classification requires sectionHint='workHistory'
    // _detectSection looks for h1-h4/legend text with "experience|employment|..."
    const doc = makeDoc(`
      <div>
        <h3>Work Experience</h3>
        <label for="company">Company</label>
        <input id="company" name="company" type="text" />
      </div>
    `);
    const plan = buildFillPlan(doc, profileWithWork);
    expect(plan.some((p) => p.key === 'company')).toBe(true);
  });

  it('excludes a field disabled via settings.disabledFields', () => {
    const doc = makeDoc(`
      <label for="fn">First Name</label>
      <input id="fn" name="first_name" type="text" />
      <label for="em">Email</label>
      <input id="em" name="email" type="email" />
    `);
    const plan = buildFillPlan(doc, PROFILE, { disabledFields: ['firstName'] });
    const keys = plan.map((p) => p.key);
    expect(keys.includes('firstName')).toBe(false);
    expect(keys.includes('email')).toBe(true);
  });

  it('includes all classified fields when settings is omitted', () => {
    const doc = makeDoc(`
      <label for="fn">First Name</label>
      <input id="fn" name="first_name" type="text" />
    `);
    const plan = buildFillPlan(doc, PROFILE);
    expect(plan.some((p) => p.key === 'firstName')).toBe(true);
  });

  it('skips a text field that already holds a value (idempotent re-fill)', () => {
    const doc = makeDoc(`
      <label for="fn">First Name</label>
      <input id="fn" name="first_name" type="text" value="Grace" />
      <label for="ln">Last Name</label>
      <input id="ln" name="last_name" type="text" />
    `);
    const plan = buildFillPlan(doc, PROFILE);
    const keys = plan.map((p) => p.key);
    expect(keys.includes('firstName')).toBe(false); // already has "Grace" — left alone
    expect(keys.includes('lastName')).toBe(true); // still blank — fill it
  });

  it('does not skip an unchecked checkbox/radio for having a static value attribute', () => {
    const doc = makeDoc(`
      <label for="sponsor">Requires sponsorship</label>
      <input id="sponsor" name="needsSponsorship" type="checkbox" value="yes" />
    `);
    const profileWithSponsorship = { ...PROFILE, workAuthorization: { needsSponsorship: true } };
    const plan = buildFillPlan(doc, profileWithSponsorship);
    expect(plan.some((p) => p.key === 'needsSponsorship')).toBe(true);
  });

  it('counts fields skipped by settings into the stats object', () => {
    const doc = makeDoc(`
      <label for="fn">First Name</label>
      <input id="fn" name="first_name" type="text" />
      <label for="ln">Last Name</label>
      <input id="ln" name="last_name" type="text" />
    `);
    const stats = {};
    buildFillPlan(doc, PROFILE, { disabledFields: ['firstName', 'lastName'] }, stats);
    expect(stats.skippedByUser).toBe(2);
  });
});

// ─── fillField ────────────────────────────────────────────────────────────────

describe('fillField', () => {
  it('fills a plain text input', async () => {
    const doc = makeDoc('<input type="text" />');
    const el = doc.querySelector('input');
    await fillField(el, 'firstName', 'Ada', doc);
    expect(el.value).toBe('Ada');
  });

  it('fills an email input', async () => {
    const doc = makeDoc('<input type="email" />');
    const el = doc.querySelector('input');
    await fillField(el, 'email', 'ada@example.com', doc);
    expect(el.value).toBe('ada@example.com');
  });

  it('fills a native <select> by value match', async () => {
    const doc = makeDoc(`
      <select name="country">
        <option value="">--</option>
        <option value="US">United States</option>
        <option value="VN">Vietnam</option>
      </select>
    `);
    const el = doc.querySelector('select');
    await fillField(el, 'country', 'United States', doc);
    expect(el.value).toBe('US');
  });

  it('fills a checkbox input', async () => {
    const doc = makeDoc('<input type="checkbox" />');
    const el = doc.querySelector('input');
    await fillField(el, 'needsSponsorship', true, doc);
    expect(el.checked).toBe(true);
  });

  it('fills a radio button group', async () => {
    const doc = makeDoc(`
      <div>
        <input type="radio" name="gender" value="male" />
        <input type="radio" name="gender" value="female" />
        <input type="radio" name="gender" value="non_binary" />
      </div>
    `);
    const el = doc.querySelector('input[type="radio"]');
    await fillField(el, 'gender', 'female', doc);
    const checked = doc.querySelector('input[type="radio"]:checked');
    expect(checked?.value).toBe('female');
  });

  it('fills a textarea', async () => {
    const doc = makeDoc('<textarea></textarea>');
    const el = doc.querySelector('textarea');
    await fillField(el, 'jobDescription', 'Built things', doc);
    expect(el.value).toBe('Built things');
  });

  it('skips filling when value is null/undefined', async () => {
    const doc = makeDoc('<input type="text" value="original" />');
    const el = doc.querySelector('input');
    await fillField(el, 'firstName', undefined, doc);
    expect(el.value).toBe('original');
  });
});

// ─── runGenericFill ─────────────────────────────────────────────────────────

describe('runGenericFill', () => {
  it('reports skippedByUser separately from filled/skipped', async () => {
    const doc = makeDoc(`
      <label for="fn">First Name</label>
      <input id="fn" name="first_name" type="text" />
      <label for="em">Email</label>
      <input id="em" name="email" type="email" />
    `);
    const result = await runGenericFill(doc, PROFILE, { disabledFields: ['firstName'] });
    expect(result.filled).toBe(1); // only email
    expect(result.skippedByUser).toBe(1); // firstName
    expect(doc.getElementById('fn').value).toBe('');
    expect(doc.getElementById('em').value).toBe('ada@example.com');
  });

  it('fills every classified field when settings is omitted', async () => {
    const doc = makeDoc(`
      <label for="fn">First Name</label>
      <input id="fn" name="first_name" type="text" />
    `);
    const result = await runGenericFill(doc, PROFILE);
    expect(result.filled).toBe(1);
    expect(result.skippedByUser).toBe(0);
  });
});
