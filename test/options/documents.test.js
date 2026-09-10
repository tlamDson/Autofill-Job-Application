// documents.test.js — TDD for the resume upload options section.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { createChromeMock } from '../helpers/chromeMock.js';

beforeEach(() => {
  const { chrome } = createChromeMock();
  globalThis.chrome = chrome;
  document.body.innerHTML = '';
});

async function imp() {
  return import('../../options/sections/documents.js?t=' + Date.now());
}

/** Simulates a user picking `file` in a <input type="file">. jsdom does not
 * implement DataTransfer (same reason filler.js's attachFileToInput() has a
 * fallback path), so define a minimal FileList-like object directly. */
function selectFile(input, file) {
  const fakeFileList = {
    0: file,
    length: 1,
    item: (i) => (i === 0 ? file : null),
    [Symbol.iterator]: function* () { yield file; },
  };
  Object.defineProperty(input, 'files', { value: fakeFileList, writable: true, configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function makePdf(content = '%PDF-1.4 test', name = 'resume.pdf') {
  return new File([content], name, { type: 'application/pdf' });
}

describe('documents section', () => {
  it('renders a file input and "no resume" message when empty', async () => {
    const { renderDocuments } = await imp();
    renderDocuments(document.body, {});
    expect(document.querySelector('[data-field="resumeUpload"]')).toBeTruthy();
    expect(document.querySelector('[data-current-resume]').textContent).toMatch(/no resume/i);
  });

  it('shows the current resume label when profile already has one', async () => {
    const { renderDocuments } = await imp();
    renderDocuments(document.body, { resumeFiles: [{ id: 'r1', label: 'my-cv.pdf', fileRef: 'r1' }] });
    expect(document.querySelector('[data-current-resume]').textContent).toContain('my-cv.pdf');
  });

  it('uploading a file saves it and calls onSave with a resumeFiles entry', async () => {
    const { renderDocuments } = await imp();
    const profile = { resumeFiles: [] };
    const onSave = vi.fn();
    renderDocuments(document.body, profile, onSave);

    const input = document.querySelector('[data-field="resumeUpload"]');
    selectFile(input, makePdf('%PDF hello', 'Liam_Pham_Resume.pdf'));
    await vi.waitFor(() => expect(onSave).toHaveBeenCalled());

    const saved = onSave.mock.calls[onSave.mock.calls.length - 1][0];
    expect(saved.resumeFiles).toHaveLength(1);
    expect(saved.resumeFiles[0].label).toBe('Liam_Pham_Resume.pdf');
    expect(saved.resumeFiles[0].fileRef).toBeTruthy();
    expect(document.querySelector('[data-current-resume]').textContent).toContain('Liam_Pham_Resume.pdf');
  });

  it('uploading a second file replaces the first (single current-resume slot)', async () => {
    const { renderDocuments } = await imp();
    const profile = { resumeFiles: [] };
    const onSave = vi.fn();
    renderDocuments(document.body, profile, onSave);
    const input = document.querySelector('[data-field="resumeUpload"]');

    selectFile(input, makePdf('%PDF one', 'first.pdf'));
    await vi.waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    selectFile(input, makePdf('%PDF two', 'second.pdf'));
    await vi.waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));

    const saved = onSave.mock.calls[1][0];
    expect(saved.resumeFiles).toHaveLength(1);
    expect(saved.resumeFiles[0].label).toBe('second.pdf');
  });

  it('rejects a file over the max transport size with an inline error, and does not save it', async () => {
    const { renderDocuments } = await imp();
    const { MAX_TRANSPORT_BYTES } = await import('../../src/profile/resumeTransport.js?t=' + Date.now());
    const profile = { resumeFiles: [] };
    const onSave = vi.fn();
    renderDocuments(document.body, profile, onSave);

    const oversized = new File([new Uint8Array(MAX_TRANSPORT_BYTES + 1)], 'huge.pdf', { type: 'application/pdf' });
    const input = document.querySelector('[data-field="resumeUpload"]');
    selectFile(input, oversized);

    const error = document.querySelector('[data-error="resumeUpload"]');
    expect(error.style.display).not.toBe('none');
    expect(error.textContent).toMatch(/too large/i);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('removing the current resume clears it and calls onSave with an empty resumeFiles', async () => {
    const { renderDocuments } = await imp();
    const profile = { resumeFiles: [] };
    const onSave = vi.fn();
    renderDocuments(document.body, profile, onSave);
    const input = document.querySelector('[data-field="resumeUpload"]');
    selectFile(input, makePdf());
    await vi.waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    document.querySelector('[data-action="remove-resume"]').click();
    await vi.waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));

    const saved = onSave.mock.calls[1][0];
    expect(saved.resumeFiles).toHaveLength(0);
    expect(document.querySelector('[data-current-resume]').textContent).toMatch(/no resume/i);
  });
});
