/**
 * test/ats/workday-upload.test.js — P5.4 Workday resume upload click override
 *
 * Workday's resume upload uses a styled button that dynamically creates
 * a hidden <input type="file"> when clicked, then destroys it after selection.
 *
 * Our strategy:
 *  - `interceptWorkdayFileInput(doc, file)`: override `HTMLInputElement.prototype.click`
 *    so when Workday's overlay button calls input.click(), we intercept and
 *    programmatically set the files instead of opening the native file picker.
 *
 * Also tests fallback to uploadWorkdayResume for simpler cases.
 */

import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { uploadWorkdayResume, interceptWorkdayFileInput } from '../../src/ats/workday.js';

function makeDoc(html) {
  return new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, {
    url: 'https://wd3.myworkday.com/acme/d/task/apply',
  }).window.document;
}

// ─── uploadWorkdayResume (basic fallback) ─────────────────────────────────────

describe('uploadWorkdayResume', () => {
  it('attaches file to data-automation-id="file-upload-input"', () => {
    const doc = makeDoc(`
      <div data-automation-id="resumeSection">
        <input data-automation-id="file-upload-input" type="file" />
      </div>
    `);
    const file = new File(['content'], 'resume.pdf', { type: 'application/pdf' });
    const result = uploadWorkdayResume(doc, file);
    expect(result).toBe(true);
    const input = doc.querySelector('[data-automation-id="file-upload-input"]');
    expect(input.files.length).toBe(1);
  });

  it('falls back to any file input', () => {
    const doc = makeDoc(`<input type="file" name="resume_file" />`);
    const file = new File(['content'], 'resume.pdf', { type: 'application/pdf' });
    const result = uploadWorkdayResume(doc, file);
    expect(result).toBe(true);
  });

  it('returns false when no file input found', () => {
    const doc = makeDoc('<form><input type="text" /></form>');
    const result = uploadWorkdayResume(doc, new File([], 'r.pdf'));
    expect(result).toBe(false);
  });

  it('returns false when file is null', () => {
    const doc = makeDoc(`<input type="file" />`);
    expect(uploadWorkdayResume(doc, null)).toBe(false);
  });
});

// ─── interceptWorkdayFileInput ────────────────────────────────────────────────

describe('interceptWorkdayFileInput', () => {
  it('returns a cleanup function', () => {
    const doc = makeDoc('');
    const file = new File(['pdf'], 'resume.pdf', { type: 'application/pdf' });
    const cleanup = interceptWorkdayFileInput(doc, file);
    expect(typeof cleanup).toBe('function');
    cleanup(); // clean up
  });

  it('intercepts click() on file inputs to set files instead', () => {
    const doc = makeDoc('');
    const file = new File(['pdf'], 'resume.pdf', { type: 'application/pdf' });

    const cleanup = interceptWorkdayFileInput(doc, file);

    // Simulate Workday creating a new file input and calling .click()
    const input = doc.createElement('input');
    input.type = 'file';
    doc.body.appendChild(input);

    // Workday would call: input.click()
    // Our interceptor should attach the file instead
    input.click();

    expect(input.files.length).toBe(1);
    expect(input.files[0].name).toBe('resume.pdf');

    cleanup();
  });

  it('cleanup restores original click behavior', () => {
    const doc = makeDoc('');
    const file = new File(['pdf'], 'resume.pdf', { type: 'application/pdf' });

    const origClick = doc.defaultView.HTMLInputElement.prototype.click;
    const cleanup = interceptWorkdayFileInput(doc, file);
    cleanup();

    expect(doc.defaultView.HTMLInputElement.prototype.click).toBe(origClick);
  });
});
