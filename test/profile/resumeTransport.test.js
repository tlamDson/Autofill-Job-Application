// resumeTransport.test.js — TDD for the chrome.storage.local resume mirror
// that crosses the options-page/content-script origin boundary.
import { describe, it, expect, beforeEach } from 'vitest';
import { createChromeMock } from '../helpers/chromeMock.js';

beforeEach(() => {
  const { chrome } = createChromeMock();
  globalThis.chrome = chrome;
});

async function importTransport() {
  return import('../../src/profile/resumeTransport.js?t=' + Date.now());
}

describe('resumeTransport', () => {
  it('mirrorResumeForFill returns true and loadMirroredResume reads back the same bytes', async () => {
    const { mirrorResumeForFill, loadMirroredResume } = await importTransport();
    const content = '%PDF-1.4 hello world';
    const blob = new Blob([content], { type: 'application/pdf' });

    const ok = await mirrorResumeForFill('ref-1', blob, 'Liam_Pham_Resume.pdf');
    expect(ok).toBe(true);

    const file = await loadMirroredResume('ref-1');
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('Liam_Pham_Resume.pdf');
    expect(file.type).toBe('application/pdf');
    expect(file.size).toBe(blob.size);
  });

  it('loadMirroredResume returns null for an unknown ref', async () => {
    const { loadMirroredResume } = await importTransport();
    expect(await loadMirroredResume('nonexistent')).toBeNull();
  });

  it('loadMirroredResume returns null when ref is falsy', async () => {
    const { loadMirroredResume } = await importTransport();
    expect(await loadMirroredResume(null)).toBeNull();
    expect(await loadMirroredResume(undefined)).toBeNull();
  });

  it('mirrorResumeForFill refuses a blob over MAX_TRANSPORT_BYTES', async () => {
    const { mirrorResumeForFill, loadMirroredResume, MAX_TRANSPORT_BYTES } = await importTransport();
    const oversized = new Blob([new Uint8Array(MAX_TRANSPORT_BYTES + 1)], { type: 'application/pdf' });

    const ok = await mirrorResumeForFill('ref-big', oversized, 'big.pdf');

    expect(ok).toBe(false);
    expect(await loadMirroredResume('ref-big')).toBeNull();
  });

  it('deleteMirroredResume removes the entry', async () => {
    const { mirrorResumeForFill, loadMirroredResume, deleteMirroredResume } = await importTransport();
    const blob = new Blob(['%PDF delete me'], { type: 'application/pdf' });
    await mirrorResumeForFill('ref-del', blob, 'temp.pdf');

    await deleteMirroredResume('ref-del');

    expect(await loadMirroredResume('ref-del')).toBeNull();
  });
});
