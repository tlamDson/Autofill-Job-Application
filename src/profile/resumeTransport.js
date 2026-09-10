/**
 * resumeTransport.js — chrome.storage.local mirror of the current resume's
 * bytes, used to cross the origin boundary between the options page and
 * content scripts.
 *
 * resumeStore.js's IndexedDB is scoped to the page it was opened from: the
 * options page runs at the chrome-extension:// origin, but a content script
 * (isolated OR main world) sees the *tab's own page* origin, so a blob saved
 * from options is an entirely different (empty) database as far as a
 * content script is concerned. chrome.storage.local has no such split — it's
 * a real extension API bound to the extension's ID, not to any page's
 * origin, and is already used this way elsewhere in this codebase
 * (profile/store.js, settings/store.js).
 *
 * IndexedDB stays the source of truth for the options page (it can hold a
 * real Blob without base64 overhead). This module mirrors only the one
 * resume actively selected for autofill, base64-encoded since
 * chrome.storage.local is JSON-only.
 */

const STORAGE_KEY_PREFIX = 'resumeBytes:';

// chrome.storage.local's default total quota is ~10MB; capping a single
// resume well under that leaves room for profile/settings and avoids a
// QUOTA_BYTES_EXCEEDED error most of the way through a save.
export const MAX_TRANSPORT_BYTES = 4 * 1024 * 1024;

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function readBlobAsArrayBuffer(blob) {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * Mirror a resume's bytes to chrome.storage.local so a content script can
 * read them at fill time. No-ops (returns false) if the blob is over
 * MAX_TRANSPORT_BYTES — it is still saved to IndexedDB by resumeStore.js
 * via saveResume(); it just won't be available to auto-attach.
 *
 * @param {string} ref       — the IndexedDB fileRef this mirrors
 * @param {Blob}   blob
 * @param {string} fileName
 * @returns {Promise<boolean>} whether the mirror write happened
 */
export async function mirrorResumeForFill(ref, blob, fileName) {
  if (blob.size > MAX_TRANSPORT_BYTES) return false;

  const buffer = await readBlobAsArrayBuffer(blob);
  const record = {
    base64: arrayBufferToBase64(buffer),
    mimeType: blob.type || 'application/pdf',
    fileName: fileName || 'resume.pdf',
    savedAt: new Date().toISOString(),
  };
  await globalThis.chrome.storage.local.set({ [STORAGE_KEY_PREFIX + ref]: record });
  return true;
}

/**
 * Read a mirrored resume back as a File, for attaching at fill time.
 * @param {string} ref
 * @returns {Promise<File|null>}
 */
export async function loadMirroredResume(ref) {
  if (!ref) return null;
  const key = STORAGE_KEY_PREFIX + ref;
  const result = await globalThis.chrome.storage.local.get(key);
  const record = result[key];
  if (!record) return null;
  const buffer = base64ToArrayBuffer(record.base64);
  return new File([buffer], record.fileName || 'resume.pdf', { type: record.mimeType || 'application/pdf' });
}

/**
 * Remove a mirrored resume — call alongside resumeStore.js's deleteResume()
 * so the transport copy doesn't outlive the IndexedDB record it mirrors.
 * @param {string} ref
 */
export async function deleteMirroredResume(ref) {
  await globalThis.chrome.storage.local.remove(STORAGE_KEY_PREFIX + ref);
}
