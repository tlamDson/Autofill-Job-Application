/**
 * resumeStore.js — IndexedDB-backed resume file storage.
 *
 * Each resume is stored as a Blob in IDB. The profile schema's
 * `resumeFiles[].fileRef` holds the IDB key (a string UUID).
 *
 * DB: "autofill-resumes" | Store: "resumes"
 * Record: { ref: string, blob: Blob, label: string, size: number, savedAt: string }
 */

const DB_NAME = 'autofill-resumes';
const STORE_NAME = 'resumes';
const DB_VERSION = 1;

/**
 * Open (or create) the IndexedDB database.
 * @returns {Promise<IDBDatabase>}
 */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = globalThis.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'ref' });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Generate a simple UUID-like key.
 * @returns {string}
 */
function genRef() {
  return `resume-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Save a Blob to IDB.
 * @param {Blob} blob
 * @param {string} label - Human-readable label, e.g. "Default resume"
 * @returns {Promise<string>} fileRef (IDB key)
 */
/**
 * Read a Blob as ArrayBuffer (compatible with jsdom / FileReader).
 * @param {Blob} blob
 * @returns {Promise<ArrayBuffer>}
 */
function readBlobAsArrayBuffer(blob) {
  // blob.arrayBuffer() is not available in jsdom; use FileReader fallback
  if (typeof blob.arrayBuffer === 'function') {
    return blob.arrayBuffer();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

export async function saveResume(blob, label) {
  const db = await openDB();
  const ref = genRef();
  // Store as ArrayBuffer + type for reliable structured-clone serialization
  const buffer = await readBlobAsArrayBuffer(blob);
  const record = {
    ref,
    buffer,
    mimeType: blob.type || 'application/pdf',
    label: label || 'Resume',
    size: blob.size,
    savedAt: new Date().toISOString(),
  };
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
  return ref;
}

/**
 * Load a Blob by fileRef.
 * @param {string} ref
 * @returns {Promise<Blob|null>}
 */
export async function loadResume(ref) {
  const db = await openDB();
  const record = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(ref);
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
  if (!record) return null;
  // Reconstruct Blob from stored ArrayBuffer
  return new Blob([record.buffer], { type: record.mimeType || 'application/pdf' });
}

/**
 * Delete a resume by fileRef.
 * @param {string} ref
 * @returns {Promise<void>}
 */
export async function deleteResume(ref) {
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(ref);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

/**
 * List all saved resumes (without the Blob data).
 * @returns {Promise<Array<{ref: string, label: string, size: number, savedAt: string}>>}
 */
export async function listResumes() {
  const db = await openDB();
  const records = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
  return records.map(({ ref, label, size, savedAt }) => ({
    fileRef: ref,
    label,
    size,
    savedAt,
  }));
}
