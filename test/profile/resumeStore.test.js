// resumeStore.test.js — TDD cho IndexedDB-backed resume file storage
import { describe, it, expect, beforeEach, vi } from 'vitest';

// jsdom không implement IndexedDB đầy đủ nên dùng fake-indexeddb.
// Cài qua globalThis trước khi import module.
import 'fake-indexeddb/auto';

async function importStore() {
  return import('../../src/profile/resumeStore.js?t=' + Date.now());
}

describe('resumeStore', () => {
  it('saveResume returns a fileRef string', async () => {
    const { saveResume } = await importStore();
    const blob = new Blob(['%PDF-1.4 hello'], { type: 'application/pdf' });
    const ref = await saveResume(blob, 'My Resume');
    expect(typeof ref).toBe('string');
    expect(ref.length).toBeGreaterThan(0);
  });

  it('loadResume returns the same blob by ref', async () => {
    const { saveResume, loadResume } = await importStore();
    const content = '%PDF-1.4 test content';
    const blob = new Blob([content], { type: 'application/pdf' });
    const ref = await saveResume(blob, 'Resume A');
    const loaded = await loadResume(ref);
    expect(loaded).toBeTruthy();
    expect(loaded.size).toBe(blob.size);
  });

  it('deleteResume removes the entry', async () => {
    const { saveResume, deleteResume, loadResume } = await importStore();
    const blob = new Blob(['%PDF delete me'], { type: 'application/pdf' });
    const ref = await saveResume(blob, 'Temp');
    await deleteResume(ref);
    const loaded = await loadResume(ref);
    expect(loaded).toBeNull();
  });

  it('listResumes returns all saved entries with label', async () => {
    const { saveResume, listResumes } = await importStore();
    // Each test run shares IDB, so just confirm we have at least the one we add
    const blob = new Blob(['%PDF list test'], { type: 'application/pdf' });
    await saveResume(blob, 'ListTest');
    const list = await listResumes();
    expect(Array.isArray(list)).toBe(true);
    const found = list.find((e) => e.label === 'ListTest');
    expect(found).toBeTruthy();
    expect(found.fileRef).toBeTruthy();
    expect(typeof found.size).toBe('number');
  });
});
