/**
 * test/ats/greenhouse-resume.test.js — P2.4 Greenhouse resume upload
 *
 * Tests the Greenhouse-specific resume upload that attaches a File
 * to the `<input type="file">` element with data-gh-input="resume".
 */

import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { uploadGreenhouseResume } from '../../src/ats/greenhouse.js';

function makeDoc(html) {
  return new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, {
    url: 'https://boards.greenhouse.io/test/jobs/1',
  }).window.document;
}

const RESUME_FIELD_HTML = `
<div class="field file optional">
  <label for="resume">Resume/CV <span class="required">*</span></label>
  <input id="resume"
         name="job_application[resume]"
         type="file"
         accept=".pdf,.doc,.docx,.txt,.rtf"
         data-gh-input="resume" />
</div>
`;

describe('uploadGreenhouseResume', () => {
  it('attaches a File to the resume input', () => {
    const doc = makeDoc(RESUME_FIELD_HTML);
    const input = doc.getElementById('resume');

    let changeFired = false;
    input.addEventListener('change', () => (changeFired = true));

    const file = new File(['%PDF-1.4 content'], 'my-resume.pdf', { type: 'application/pdf' });
    const result = uploadGreenhouseResume(doc, file);

    expect(result).toBe(true);
    expect(input.files.length).toBe(1);
    expect(input.files[0].name).toBe('my-resume.pdf');
    expect(changeFired).toBe(true);
  });

  it('returns false when no resume input found', () => {
    const doc = makeDoc('<form><input type="text" name="name" /></form>');
    const file = new File(['content'], 'resume.pdf', { type: 'application/pdf' });
    const result = uploadGreenhouseResume(doc, file);
    expect(result).toBe(false);
  });

  it('returns false when file is null', () => {
    const doc = makeDoc(RESUME_FIELD_HTML);
    const result = uploadGreenhouseResume(doc, null);
    expect(result).toBe(false);
  });

  it('renames the file per settings.resumeFileName === "useMyName"', () => {
    const doc = makeDoc(RESUME_FIELD_HTML);
    const input = doc.getElementById('resume');
    const file = new File(['%PDF-1.4 content'], 'my-resume.pdf', { type: 'application/pdf' });
    const profile = { personal: { firstName: 'Ada', lastName: 'Lovelace' } };

    uploadGreenhouseResume(doc, file, profile, { resumeFileName: 'useMyName' });

    expect(input.files[0].name).toBe('Ada_Lovelace_Resume.pdf');
  });
});
