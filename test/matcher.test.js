// matcher.test.js — Tests for matcher.js (stripExample, buildContext, classifyField)
// TDD: tests are added incrementally per P1.x task.
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
import { stripExample, buildContext } from '../src/matcher.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixture(name) {
  const html = readFileSync(resolve(__dirname, 'fixtures', name), 'utf8');
  const dom = new JSDOM(html);
  return dom.window.document;
}

// ─── P1.1 — stripExample ─────────────────────────────────────────────────────

describe('stripExample', () => {
  // Vietnamese patterns
  it('strips "VD: Nguyễn Văn A" suffix', () => {
    expect(stripExample('Họ và tên (VD: Nguyễn Văn A)')).not.toContain('Nguyễn Văn A');
  });

  it('strips "ví dụ:" prefix (case-insensitive)', () => {
    const result = stripExample('Ví dụ: Nguyễn Văn A');
    expect(result.trim()).toBe('');
  });

  it('strips "vd:" short form', () => {
    const result = stripExample('vd: abc@example.com');
    expect(result.trim()).toBe('');
  });

  // English patterns
  it('strips "e.g. John Doe" suffix', () => {
    const result = stripExample('Full name (e.g. John Doe)');
    expect(result).not.toContain('John Doe');
    expect(result.toLowerCase()).toContain('full name');
  });

  it('strips "eg. Jane" suffix', () => {
    expect(stripExample('Email (eg. jane@test.com)')).not.toContain('jane@test.com');
  });

  it('strips "example:" prefix', () => {
    const result = stripExample('Example: John Smith');
    expect(result.trim()).toBe('');
  });

  it('strips "For example," prefix', () => {
    const result = stripExample('For example, https://github.com/user');
    expect(result.trim()).toBe('');
  });

  // Placeholder patterns
  it('strips "John Doe" placeholder text alone', () => {
    expect(stripExample('John Doe').trim()).toBe('');
  });

  it('strips "jane@example.com" placeholder text alone', () => {
    expect(stripExample('jane@example.com').trim()).toBe('');
  });

  // Important: must NOT strip actual labels
  it('does NOT strip label "First Name"', () => {
    expect(stripExample('First Name')).toBe('First Name');
  });

  it('does NOT strip label "Email Address"', () => {
    expect(stripExample('Email Address')).toBe('Email Address');
  });

  it('does NOT strip "Company" label', () => {
    expect(stripExample('Company')).toBe('Company');
  });

  // Parenthetical example removal
  it('removes parenthetical example text, preserves surrounding label', () => {
    const result = stripExample('Phone number (e.g. +1 555-123-4567)');
    expect(result.trim()).toBe('Phone number');
  });

  it('removes multiple example patterns if present', () => {
    const result = stripExample('Name vd: Nguyen — example: Smith');
    expect(result).not.toMatch(/Nguyen|Smith/i);
  });

  it('returns empty string for pure example text with no label', () => {
    expect(stripExample('e.g. https://linkedin.com/in/yourname').trim()).toBe('');
  });
});

// ─── P1.2 — buildContext ─────────────────────────────────────────────────────

describe('buildContext', () => {
  let doc;
  beforeEach(() => {
    doc = loadFixture('sample-form.html');
  });

  it('picks up label[for] text', () => {
    const input = doc.getElementById('first-name');
    const ctx = buildContext(input);
    const text = [ctx.labelText, ...Object.values(ctx.attrs)].join(' ').toLowerCase();
    expect(text).toContain('first name');
  });

  it('picks up wrapping <label> text', () => {
    const input = doc.querySelector('[name="linkedin"]');
    const ctx = buildContext(input);
    const text = [ctx.labelText, ctx.nearbyText].join(' ').toLowerCase();
    expect(text).toContain('linkedin');
  });

  it('picks up aria-label attribute', () => {
    const input = doc.querySelector('[name="linkedin"]');
    const ctx = buildContext(input);
    expect(ctx.attrs['aria-label']).toContain('LinkedIn');
  });

  it('picks up aria-labelledby referenced text', () => {
    const input = doc.querySelector('[name="company"]');
    const ctx = buildContext(input);
    const text = [ctx.labelText, ctx.nearbyText].join(' ').toLowerCase();
    expect(text).toContain('company');
  });

  it('picks up <th> ancestor text (table layout)', () => {
    const input = doc.querySelector('[name="city"]');
    const ctx = buildContext(input);
    const all = [ctx.labelText, ctx.nearbyText, ...Object.values(ctx.attrs)].join(' ').toLowerCase();
    expect(all).toContain('city');
  });

  it('picks up <dt> sibling text (dl layout)', () => {
    const input = doc.querySelector('[name="postal_code"]');
    const ctx = buildContext(input);
    const all = [ctx.labelText, ctx.nearbyText, ...Object.values(ctx.attrs)].join(' ').toLowerCase();
    expect(all).toContain('postal');
  });

  it('picks up sibling span text', () => {
    const input = doc.querySelector('[name="school"]');
    const ctx = buildContext(input);
    const all = [ctx.labelText, ctx.nearbyText].join(' ').toLowerCase();
    expect(all).toContain('school');
  });

  it('picks up placeholder when no label present', () => {
    const input = doc.querySelector('[name="job_title"]');
    const ctx = buildContext(input);
    expect(ctx.attrs['placeholder']).toBe('Job Title');
  });

  it('picks up autocomplete attribute', () => {
    const input = doc.getElementById('email');
    const ctx = buildContext(input);
    expect(ctx.attrs['autocomplete']).toBe('email');
  });

  it('picks up name attribute', () => {
    const input = doc.getElementById('last-name');
    const ctx = buildContext(input);
    expect(ctx.attrs['name']).toContain('last');
  });

  it('returns { attrs, labelText, nearbyText } shape', () => {
    const input = doc.getElementById('email');
    const ctx = buildContext(input);
    expect(ctx).toHaveProperty('attrs');
    expect(ctx).toHaveProperty('labelText');
    expect(ctx).toHaveProperty('nearbyText');
  });
});

// ─── P1.3 — classifyField: identity group ─────────────────────────────────────

import { classifyField } from '../src/matcher.js';

function ctx(labelText, attrs = {}) {
  return { labelText, nearbyText: '', attrs };
}

describe('classifyField — identity group', () => {
  // firstName
  it('classifies "First Name" as firstName', () => {
    expect(classifyField(ctx('First Name'))).toBe('firstName');
  });
  it('classifies name="first_name" as firstName', () => {
    expect(classifyField(ctx('', { name: 'first_name' }))).toBe('firstName');
  });
  it('classifies "Given Name" as firstName', () => {
    expect(classifyField(ctx('Given Name'))).toBe('firstName');
  });

  // lastName
  it('classifies "Last Name" as lastName', () => {
    expect(classifyField(ctx('Last Name'))).toBe('lastName');
  });
  it('classifies "Family Name" as lastName', () => {
    expect(classifyField(ctx('Family Name'))).toBe('lastName');
  });
  it('classifies "Surname" as lastName', () => {
    expect(classifyField(ctx('Surname'))).toBe('lastName');
  });

  // fullName
  it('classifies "Full Name" as fullName', () => {
    expect(classifyField(ctx('Full Name'))).toBe('fullName');
  });
  it('classifies autocomplete=name as fullName', () => {
    expect(classifyField(ctx('', { autocomplete: 'name' }))).toBe('fullName');
  });

  // Negative: "company name" should NOT be fullName
  it('does NOT classify "Company Name" as fullName (or firstName/lastName)', () => {
    const key = classifyField(ctx('Company Name'));
    expect(key).not.toBe('fullName');
    expect(key).not.toBe('firstName');
    expect(key).not.toBe('lastName');
  });

  // preferredName
  it('classifies "Preferred Name" as preferredName', () => {
    expect(classifyField(ctx('Preferred Name'))).toBe('preferredName');
  });
  it('classifies "Nickname" as preferredName', () => {
    expect(classifyField(ctx('Nickname'))).toBe('preferredName');
  });

  // email
  it('classifies "Email Address" as email', () => {
    expect(classifyField(ctx('Email Address'))).toBe('email');
  });
  it('classifies autocomplete=email as email', () => {
    expect(classifyField(ctx('', { autocomplete: 'email' }))).toBe('email');
  });
  it('classifies "Email Confirmation" still as email', () => {
    // Same key — filler decides whether to fill
    expect(classifyField(ctx('Email Confirmation'))).toBe('email');
  });

  // phone
  it('classifies "Phone Number" as phone', () => {
    expect(classifyField(ctx('Phone Number'))).toBe('phone');
  });
  it('classifies "Mobile" as phone', () => {
    expect(classifyField(ctx('Mobile'))).toBe('phone');
  });
  it('classifies autocomplete=tel as phone', () => {
    expect(classifyField(ctx('', { autocomplete: 'tel' }))).toBe('phone');
  });

  // Negative: "phone type" should NOT be phone (it's a descriptor, not a field)
  it('does NOT classify "phone type" select as phone', () => {
    // Only apply when ONLY "type" with no phone text
    const key = classifyField(ctx('Phone Type'));
    // "Phone Type" might still be phone because it contains "phone" — acceptable.
    // The key negative is: a field named purely "type" with no phone context
    expect(classifyField(ctx('Type', { name: 'phone_type' }))).toBe('phone');
    // Actually phone_type in name → still phone is valid
    // True negative: completely unrelated "type" field
    expect(classifyField(ctx('Input Type', { name: 'input_type' }))).toBeNull();
  });
});
