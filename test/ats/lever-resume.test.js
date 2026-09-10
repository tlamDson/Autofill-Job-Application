/**
 * test/ats/lever-resume.test.js — P3.3 Lever resume upload
 *
 * Tests Lever's resume upload: the file input is typically either
 * `name="resume"` or inside a `.resume-upload` container.
 */

import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { uploadLeverResume } from '../../src/ats/lever.js';

function makeDoc(html) {
  return new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, {
    url: 'https://jobs.lever.co/acme/abc-123/apply',
  }).window.document;
}

const LEVER_RESUME_HTML = `
<div class="resume-upload">
  <label>Resume</label>
  <input type="file" name="resume" accept=".pdf,.doc,.docx" />
</div>
`;

const LEVER_RESUME_ALT_HTML = `
<div class="application-field">
  <label>Upload Resume</label>
  <input type="file" name="candidate_resume" />
</div>
`;

describe('uploadLeverResume', () => {
  it('attaches a File to name="resume" input', () => {
    const doc = makeDoc(LEVER_RESUME_HTML);
    const input = doc.querySelector('[name="resume"]');

    let changeFired = false;
    input.addEventListener('change', () => (changeFired = true));

    const file = new File(['%PDF'], 'my-resume.pdf', { type: 'application/pdf' });
    const result = uploadLeverResume(doc, file);

    expect(result).toBe(true);
    expect(input.files.length).toBe(1);
    expect(input.files[0].name).toBe('my-resume.pdf');
    expect(changeFired).toBe(true);
  });

  it('falls back to any file input when no name="resume"', () => {
    const doc = makeDoc(LEVER_RESUME_ALT_HTML);
    const file = new File(['content'], 'resume.pdf', { type: 'application/pdf' });
    const result = uploadLeverResume(doc, file);
    expect(result).toBe(true);
    const input = doc.querySelector('input[type="file"]');
    expect(input.files.length).toBe(1);
  });

  it('returns false when no file input found', () => {
    const doc = makeDoc('<form><input type="text" name="name" /></form>');
    const file = new File(['content'], 'resume.pdf', { type: 'application/pdf' });
    const result = uploadLeverResume(doc, file);
    expect(result).toBe(false);
  });

  it('returns false when file is null', () => {
    const doc = makeDoc(LEVER_RESUME_HTML);
    const result = uploadLeverResume(doc, null);
    expect(result).toBe(false);
  });
});
