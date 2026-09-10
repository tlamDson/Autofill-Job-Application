/**
 * documents.js — Options UI for the current resume file.
 *
 * A single "current resume" slot (uploading a new file replaces the old
 * one) rather than a multi-resume manager — matches the target of getting
 * one resume auto-attached to every application, not resume A/B testing.
 * Bytes are saved to IndexedDB (resumeStore.js, the options page's own
 * storage) and mirrored to chrome.storage.local (resumeTransport.js) so a
 * content script — which cannot see the options page's IndexedDB, a
 * different origin entirely — can attach it at fill time.
 */

import { saveResume, deleteResume } from '../../src/profile/resumeStore.js';
import { mirrorResumeForFill, deleteMirroredResume, MAX_TRANSPORT_BYTES } from '../../src/profile/resumeTransport.js';

export function renderDocuments(container, profile, onSave) {
  profile.resumeFiles = profile.resumeFiles || [];

  const section = document.createElement('section');
  section.className = 'options-section';
  section.setAttribute('data-section', 'documents');

  const h2 = document.createElement('h2');
  h2.textContent = 'Resume';
  section.appendChild(h2);

  const note = document.createElement('p');
  note.textContent = `Uploading a new file replaces the current one. Max ${Math.floor(MAX_TRANSPORT_BYTES / (1024 * 1024))}MB.`;
  note.style.fontSize = '12px';
  section.appendChild(note);

  const current = document.createElement('p');
  current.setAttribute('data-current-resume', '');
  section.appendChild(current);

  function renderCurrent() {
    const entry = profile.resumeFiles[0];
    current.textContent = entry ? `Current resume: ${entry.label}` : 'No resume uploaded yet.';
  }
  renderCurrent();

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.pdf,application/pdf';
  fileInput.setAttribute('data-field', 'resumeUpload');
  section.appendChild(fileInput);

  const error = document.createElement('span');
  error.setAttribute('data-error', 'resumeUpload');
  error.className = 'field-error';
  error.style.color = 'red';
  error.style.display = 'none';
  section.appendChild(error);

  function showError(message) {
    error.textContent = message;
    error.style.display = '';
  }
  function clearError() {
    error.textContent = '';
    error.style.display = 'none';
  }

  async function persist() {
    if (onSave) onSave(JSON.parse(JSON.stringify(profile)));
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    clearError();

    if (file.size > MAX_TRANSPORT_BYTES) {
      showError(`File is too large (max ${Math.floor(MAX_TRANSPORT_BYTES / (1024 * 1024))}MB).`);
      fileInput.value = '';
      return;
    }

    const previous = profile.resumeFiles[0];
    if (previous) {
      await Promise.all([
        deleteResume(previous.fileRef).catch(() => {}),
        deleteMirroredResume(previous.fileRef).catch(() => {}),
      ]);
    }

    const fileRef = await saveResume(file, file.name);
    const mirrored = await mirrorResumeForFill(fileRef, file, file.name);
    if (!mirrored) {
      showError('Saved, but this file could not be prepared for auto-attach — you may need to attach it manually.');
    }

    profile.resumeFiles = [{ id: fileRef, label: file.name, fileRef }];
    renderCurrent();
    await persist();
  });

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.textContent = 'Remove';
  removeBtn.setAttribute('data-action', 'remove-resume');
  removeBtn.addEventListener('click', async () => {
    const entry = profile.resumeFiles[0];
    if (!entry) return;
    await Promise.all([
      deleteResume(entry.fileRef).catch(() => {}),
      deleteMirroredResume(entry.fileRef).catch(() => {}),
    ]);
    profile.resumeFiles = [];
    clearError();
    renderCurrent();
    await persist();
  });
  section.appendChild(removeBtn);

  container.appendChild(section);
}
