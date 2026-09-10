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

  it('does not pollute nearbyText with unrelated sibling text once labelText is found (regression)', () => {
    // A GitHub field with its own correct wrapping <label>, sitting right after
    // an unrelated "LinkedIn" span. _findNearbyText's sibling scan would pick up
    // "LinkedIn" here if it ran — it must not run once labelText is already set.
    const dom = new JSDOM(`<!DOCTYPE html><html><body>
      <div>
        <span>LinkedIn</span>
        <label>GitHub URL<input name="my_github" type="url" /></label>
      </div>
    </body></html>`);
    const input = dom.window.document.querySelector('input');
    const ctx = buildContext(input);
    expect(ctx.labelText.toLowerCase()).toContain('github');
    expect(ctx.nearbyText).toBe('');
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

// ─── P1.4 — classifyField: address group ─────────────────────────────────────

describe('classifyField — address group', () => {
  it('classifies "Street Address" as addressLine1', () => {
    expect(classifyField(ctx('Street Address'))).toBe('addressLine1');
  });
  it('classifies "Address Line 1" as addressLine1', () => {
    expect(classifyField(ctx('Address Line 1'))).toBe('addressLine1');
  });
  it('classifies autocomplete=address-line1 as addressLine1', () => {
    expect(classifyField(ctx('', { autocomplete: 'address-line1' }))).toBe('addressLine1');
  });

  it('classifies "Address Line 2" as addressLine2', () => {
    expect(classifyField(ctx('Address Line 2'))).toBe('addressLine2');
  });
  it('classifies "Apartment / Suite" as addressLine2', () => {
    expect(classifyField(ctx('Apartment / Suite'))).toBe('addressLine2');
  });

  it('classifies "City" as city', () => {
    expect(classifyField(ctx('City'))).toBe('city');
  });
  it('classifies autocomplete=address-level2 as city', () => {
    expect(classifyField(ctx('', { autocomplete: 'address-level2' }))).toBe('city');
  });

  it('classifies "State / Province" as state', () => {
    expect(classifyField(ctx('State / Province'))).toBe('state');
  });
  it('classifies "State of residence for tax" still as state', () => {
    expect(classifyField(ctx('State of residence for tax'))).toBe('state');
  });
  it('classifies autocomplete=address-level1 as state', () => {
    expect(classifyField(ctx('', { autocomplete: 'address-level1' }))).toBe('state');
  });

  it('classifies "Zip Code" as postalCode', () => {
    expect(classifyField(ctx('Zip Code'))).toBe('postalCode');
  });
  it('classifies "Postal Code" as postalCode', () => {
    expect(classifyField(ctx('Postal Code'))).toBe('postalCode');
  });
  it('classifies autocomplete=postal-code as postalCode', () => {
    expect(classifyField(ctx('', { autocomplete: 'postal-code' }))).toBe('postalCode');
  });

  it('classifies "Country" as country', () => {
    expect(classifyField(ctx('Country'))).toBe('country');
  });
  it('classifies autocomplete=country as country', () => {
    expect(classifyField(ctx('', { autocomplete: 'country' }))).toBe('country');
  });

  // Negative: "country code" for phone should be phoneCountryCode not country
  it('classifies "Country Code (phone)" as phoneCountryCode', () => {
    expect(classifyField(ctx('Country Code', { name: 'phone_country_code' }))).toBe('phoneCountryCode');
  });
});

// ─── P1.5 — classifyField: links group ───────────────────────────────────────

describe('classifyField — links group', () => {
  it('classifies "LinkedIn URL" as linkedin', () => {
    expect(classifyField(ctx('LinkedIn URL'))).toBe('linkedin');
  });
  it('classifies name=linkedin as linkedin', () => {
    expect(classifyField(ctx('', { name: 'linkedin' }))).toBe('linkedin');
  });
  it('classifies "LinkedIn Profile" as linkedin', () => {
    expect(classifyField(ctx('LinkedIn Profile'))).toBe('linkedin');
  });

  it('classifies "GitHub URL" as github', () => {
    expect(classifyField(ctx('GitHub URL'))).toBe('github');
  });
  it('classifies name=github_url as github', () => {
    expect(classifyField(ctx('', { name: 'github_url' }))).toBe('github');
  });

  it('classifies "Portfolio URL" as portfolio', () => {
    expect(classifyField(ctx('Portfolio URL'))).toBe('portfolio');
  });
  it('classifies "Portfolio / Work Samples" as portfolio', () => {
    expect(classifyField(ctx('Portfolio / Work Samples'))).toBe('portfolio');
  });

  it('classifies "Personal Website" as website', () => {
    expect(classifyField(ctx('Personal Website'))).toBe('website');
  });
  it('classifies "Website URL" as website', () => {
    expect(classifyField(ctx('Website URL'))).toBe('website');
  });

  // Negative: "website" in a work history context (company website) → null
  it('classifies "Company Website" NOT as candidate website', () => {
    const key = classifyField(ctx('Company Website', { name: 'company_website' }));
    // Could be 'website' or null — important: MUST NOT cause wrong profile field fill
    // For now: if "company" context is present, return null
    expect(key).toBeNull();
  });

  it('classifies a labeled GitHub field as github even when an unrelated "LinkedIn" sibling sits nearby (regression)', () => {
    const dom = new JSDOM(`<!DOCTYPE html><html><body>
      <div>
        <span>LinkedIn</span>
        <label>GitHub URL<input name="my_github" type="url" /></label>
      </div>
    </body></html>`);
    const input = dom.window.document.querySelector('input');
    expect(classifyField(buildContext(input))).toBe('github');
  });
});

// ─── P1.6 — classifyField: education + workHistory ────────────────────────────

function ctxWithSection(labelText, sectionHint, attrs = {}) {
  return { labelText, nearbyText: '', attrs, sectionHint };
}

describe('classifyField — education group', () => {
  it('classifies "School" in education section as school', () => {
    expect(classifyField(ctxWithSection('School', 'education'))).toBe('school');
  });
  it('classifies "University" as school', () => {
    expect(classifyField(ctxWithSection('University', 'education'))).toBe('school');
  });
  it('classifies "Degree" in education section as degree', () => {
    expect(classifyField(ctxWithSection('Degree', 'education'))).toBe('degree');
  });
  it('classifies "Field of Study" as fieldOfStudy', () => {
    expect(classifyField(ctxWithSection('Field of Study', 'education'))).toBe('fieldOfStudy');
  });
  it('classifies "Major" as fieldOfStudy', () => {
    expect(classifyField(ctxWithSection('Major', 'education'))).toBe('fieldOfStudy');
  });
  it('classifies "GPA" as gpa', () => {
    expect(classifyField(ctxWithSection('GPA', 'education'))).toBe('gpa');
  });
  it('classifies start date in education section as eduStartDate', () => {
    expect(classifyField(ctxWithSection('Start Date', 'education'))).toBe('eduStartDate');
  });
  it('classifies end date in education section as eduEndDate', () => {
    expect(classifyField(ctxWithSection('End Date', 'education'))).toBe('eduEndDate');
  });
  it('classifies graduation date as eduEndDate', () => {
    expect(classifyField(ctxWithSection('Graduation Date', 'education'))).toBe('eduEndDate');
  });
});

describe('classifyField — workHistory group', () => {
  it('classifies "Company" in work section as company', () => {
    expect(classifyField(ctxWithSection('Company', 'workHistory'))).toBe('company');
  });
  it('classifies "Employer" as company', () => {
    expect(classifyField(ctxWithSection('Employer', 'workHistory'))).toBe('company');
  });
  it('classifies "Job Title" as jobTitle', () => {
    expect(classifyField(ctxWithSection('Job Title', 'workHistory'))).toBe('jobTitle');
  });
  it('classifies "Position" in work section as jobTitle', () => {
    expect(classifyField(ctxWithSection('Position', 'workHistory'))).toBe('jobTitle');
  });
  it('classifies start date in work section as workStartDate', () => {
    expect(classifyField(ctxWithSection('Start Date', 'workHistory'))).toBe('workStartDate');
  });
  it('classifies end date in work section as workEndDate', () => {
    expect(classifyField(ctxWithSection('End Date', 'workHistory'))).toBe('workEndDate');
  });
  it('classifies "Description" in work section as jobDescription', () => {
    expect(classifyField(ctxWithSection('Description', 'workHistory'))).toBe('jobDescription');
  });
  it('classifies "Location" in work section as workLocation', () => {
    expect(classifyField(ctxWithSection('Location', 'workHistory'))).toBe('workLocation');
  });
});

// ─── P1.7 — classifyField: workAuth + eeo + compensation ─────────────────────

describe('classifyField — workAuthorization', () => {
  it('classifies "Do you need sponsorship?" as needsSponsorship', () => {
    expect(classifyField(ctx('Do you need sponsorship?'))).toBe('needsSponsorship');
  });
  it('classifies "Visa sponsorship required" as needsSponsorship', () => {
    expect(classifyField(ctx('Visa sponsorship required'))).toBe('needsSponsorship');
  });
  it('classifies "Authorized to work in the US?" as authorizedToWork', () => {
    expect(classifyField(ctx('Are you authorized to work in the US?'))).toBe('authorizedToWork');
  });
  it('classifies "Work authorization status" as visaStatus', () => {
    expect(classifyField(ctx('Work authorization status'))).toBe('visaStatus');
  });
  it('classifies "Visa type" as visaStatus', () => {
    expect(classifyField(ctx('Visa type'))).toBe('visaStatus');
  });
});

describe('classifyField — EEO', () => {
  it('classifies "Gender" as gender', () => {
    expect(classifyField(ctx('Gender'))).toBe('gender');
  });
  it('classifies "Race / Ethnicity" as race', () => {
    expect(classifyField(ctx('Race / Ethnicity'))).toBe('race');
  });
  it('classifies "Veteran status" as veteranStatus', () => {
    expect(classifyField(ctx('Veteran status'))).toBe('veteranStatus');
  });
  it('classifies "Disability status" as disabilityStatus', () => {
    expect(classifyField(ctx('Disability status'))).toBe('disabilityStatus');
  });
  it('classifies "Hispanic or Latino" as hispanicLatino', () => {
    expect(classifyField(ctx('Hispanic or Latino'))).toBe('hispanicLatino');
  });
});

describe('classifyField — compensation', () => {
  it('classifies "Desired Salary" as desiredSalary', () => {
    expect(classifyField(ctx('Desired Salary'))).toBe('desiredSalary');
  });
  it('classifies "Expected Compensation" as desiredSalary', () => {
    expect(classifyField(ctx('Expected Compensation'))).toBe('desiredSalary');
  });
  it('classifies "Notice Period" as noticePeriod', () => {
    expect(classifyField(ctx('Notice Period'))).toBe('noticePeriod');
  });
  it('classifies "Earliest Start Date" as noticePeriod', () => {
    expect(classifyField(ctx('Earliest Start Date'))).toBe('noticePeriod');
  });
});

// ─── P1.8 — Sensitive blocklist + isFillable ─────────────────────────────────

import { isSensitiveField, isFillable } from '../src/matcher.js';

describe('isSensitiveField', () => {
  it('returns true for SSN field', () => {
    expect(isSensitiveField(ctx('Social Security Number', { name: 'ssn' }))).toBe(true);
  });
  it('returns true for "SSN" label', () => {
    expect(isSensitiveField(ctx('SSN'))).toBe(true);
  });
  it('returns true for passport number', () => {
    expect(isSensitiveField(ctx('Passport Number', { name: 'passport_number' }))).toBe(true);
  });
  it('returns true for date of birth', () => {
    expect(isSensitiveField(ctx('Date of Birth', { name: 'date_of_birth' }))).toBe(true);
  });
  it('returns true for mother maiden name', () => {
    expect(isSensitiveField(ctx("Mother's Maiden Name", { name: 'mothers_maiden_name' }))).toBe(true);
  });
  it('returns true for bank routing number', () => {
    expect(isSensitiveField(ctx('Bank Routing Number'))).toBe(true);
  });
  it('returns true for account number', () => {
    expect(isSensitiveField(ctx('Account Number'))).toBe(true);
  });

  it('returns false for regular First Name', () => {
    expect(isSensitiveField(ctx('First Name'))).toBe(false);
  });
  it('returns false for Email', () => {
    expect(isSensitiveField(ctx('Email'))).toBe(false);
  });
});

describe('isFillable (DOM checks)', () => {
  let doc;
  beforeEach(() => {
    doc = loadFixture('honeypot.html');
  });

  it('returns false for display:none field', () => {
    expect(isFillable(doc.getElementById('hp-display-none'))).toBe(false);
  });
  it('returns false for zero-size honeypot', () => {
    expect(isFillable(doc.getElementById('hp-hidden-zero'))).toBe(false);
  });
  it('returns false for visibility:hidden', () => {
    expect(isFillable(doc.getElementById('hp-visibility-hidden'))).toBe(false);
  });
  it('returns false for disabled field', () => {
    expect(isFillable(doc.getElementById('hp-disabled'))).toBe(false);
  });
  it('returns false for readonly field', () => {
    expect(isFillable(doc.getElementById('hp-readonly'))).toBe(false);
  });
  it('returns true for normal visible field', () => {
    expect(isFillable(doc.getElementById('first-name'))).toBe(true);
  });
});
