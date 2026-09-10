/**
 * test/ats/workday-steps.test.js — P5.3 Workday multi-step + repeated sections
 *
 * Workday forms have multiple steps/pages. Each step has identifiable
 * data-automation-id markers. Key functions:
 *
 *   - detectWorkdayStep(doc) → step name or null
 *     Detects which step is currently shown (myInformation, experience,
 *     education, selfIdentify, voluntaryDisclosures, review)
 *
 *   - fillWorkdayRepeatedSection(doc, sectionId, items, fillFn)
 *     Fills repeated sections (e.g. work history entries) by:
 *      1. Clicking "Add" to create new entries
 *      2. Filling each entry with the appropriate profile data
 */

import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { detectWorkdayStep, fillWorkdayRepeatedSection } from '../../src/ats/workday.js';

function makeDoc(html) {
  return new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, {
    url: 'https://wd3.myworkday.com/acme/d/task/apply',
  }).window.document;
}

// ─── detectWorkdayStep ────────────────────────────────────────────────────────

describe('detectWorkdayStep', () => {
  it('detects myInformation step', () => {
    const doc = makeDoc(`
      <div data-automation-id="legalNameSection">
        <input data-automation-id="legalNameSection_firstName" />
      </div>
    `);
    expect(detectWorkdayStep(doc)).toBe('myInformation');
  });

  it('detects experience step', () => {
    const doc = makeDoc(`
      <div data-automation-id="workExperienceSection">
        <button data-automation-id="addWorkExperience">Add</button>
      </div>
    `);
    expect(detectWorkdayStep(doc)).toBe('experience');
  });

  it('detects education step', () => {
    const doc = makeDoc(`
      <div data-automation-id="educationSection">
        <button data-automation-id="addEducation">Add</button>
      </div>
    `);
    expect(detectWorkdayStep(doc)).toBe('education');
  });

  it('detects selfIdentify (EEO) step', () => {
    const doc = makeDoc(`
      <div data-automation-id="selfIdentifySection">
        <select data-automation-id="gender"></select>
      </div>
    `);
    expect(detectWorkdayStep(doc)).toBe('selfIdentify');
  });

  it('returns null for unknown step', () => {
    const doc = makeDoc('<form><input type="text" name="name" /></form>');
    expect(detectWorkdayStep(doc)).toBeNull();
  });
});

// ─── fillWorkdayRepeatedSection ───────────────────────────────────────────────

describe('fillWorkdayRepeatedSection', () => {
  it('calls fillFn for each item', async () => {
    const doc = makeDoc(`
      <div data-automation-id="workExperienceSection">
        <button data-automation-id="addWorkExperience">Add</button>
        <div class="WDIT-entry" data-automation-id="workExperienceEntry">
          <input data-automation-id="jobTitle" value="" />
        </div>
      </div>
    `);

    const fillFn = vi.fn().mockResolvedValue({ filled: 1, skipped: 0 });
    const items = [{ title: 'Software Engineer' }, { title: 'Senior Developer' }];

    // Simulate adding a new entry when "Add" is clicked
    const addBtn = doc.querySelector('[data-automation-id="addWorkExperience"]');
    addBtn.addEventListener('click', () => {
      const section = doc.querySelector('[data-automation-id="workExperienceSection"]');
      const newEntry = doc.createElement('div');
      newEntry.setAttribute('data-automation-id', 'workExperienceEntry');
      newEntry.innerHTML = '<input data-automation-id="jobTitle" value="" />';
      section.appendChild(newEntry);
    });

    await fillWorkdayRepeatedSection(
      doc,
      'workExperienceSection',
      items,
      fillFn
    );

    expect(fillFn).toHaveBeenCalledTimes(items.length);
  });

  it('passes each item and its entry element to fillFn', async () => {
    const doc = makeDoc(`
      <div data-automation-id="educationSection">
        <button data-automation-id="addEducation">Add</button>
        <div data-automation-id="educationEntry">
          <input data-automation-id="school" value="" />
        </div>
      </div>
    `);

    const capturedArgs = [];
    const fillFn = vi.fn().mockImplementation((entry, item) => {
      capturedArgs.push({ entry, item });
      return Promise.resolve({ filled: 1, skipped: 0 });
    });

    const addBtn = doc.querySelector('[data-automation-id="addEducation"]');
    addBtn.addEventListener('click', () => {
      const section = doc.querySelector('[data-automation-id="educationSection"]');
      const newEntry = doc.createElement('div');
      newEntry.setAttribute('data-automation-id', 'educationEntry');
      section.appendChild(newEntry);
    });

    const items = [{ school: 'MIT', degree: 'BS' }];
    await fillWorkdayRepeatedSection(doc, 'educationSection', items, fillFn);

    expect(capturedArgs[0].item).toEqual(items[0]);
    expect(capturedArgs[0].entry).toBeTruthy();
  });

  it('returns combined result', async () => {
    const doc = makeDoc(`
      <div data-automation-id="workExperienceSection">
        <button data-automation-id="addWorkExperience">Add</button>
        <div data-automation-id="workExperienceEntry"></div>
      </div>
    `);

    const fillFn = vi.fn().mockResolvedValue({ filled: 2, skipped: 1 });
    const items = [{ title: 'Engineer' }, { title: 'Manager' }];

    const addBtn = doc.querySelector('[data-automation-id="addWorkExperience"]');
    addBtn.addEventListener('click', () => {
      const section = doc.querySelector('[data-automation-id="workExperienceSection"]');
      const e = doc.createElement('div');
      e.setAttribute('data-automation-id', 'workExperienceEntry');
      section.appendChild(e);
    });

    const result = await fillWorkdayRepeatedSection(
      doc,
      'workExperienceSection',
      items,
      fillFn
    );

    expect(result.filled).toBe(4);   // 2 items × 2 filled each
    expect(result.skipped).toBe(2);  // 2 items × 1 skipped each
  });
});
