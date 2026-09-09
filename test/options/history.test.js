// history.test.js — TDD cho education + workHistory list editor
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createChromeMock } from '../helpers/chromeMock.js';

beforeEach(() => {
  const { chrome } = createChromeMock();
  globalThis.chrome = chrome;
  document.body.innerHTML = '';
});

async function importEducation() {
  return import('../../options/sections/education.js?t=' + Date.now());
}
async function importWorkHistory() {
  return import('../../options/sections/workHistory.js?t=' + Date.now());
}

// ─── Education ───────────────────────────────────────────────────────────────

describe('education section', () => {
  it('renders an Add button when list is empty', async () => {
    const { renderEducation } = await importEducation();
    renderEducation(document.body, { education: [] });
    expect(document.querySelector('[data-action="add-education"]')).toBeTruthy();
  });

  it('renders existing entries', async () => {
    const { renderEducation } = await importEducation();
    renderEducation(document.body, {
      education: [
        { school: 'MIT', degree: "Bachelor's", fieldOfStudy: 'CS', startDate: '2020-09', endDate: '2024-05' },
      ],
    });
    const schoolInput = document.querySelector('[data-field="education.0.school"]');
    expect(schoolInput).toBeTruthy();
    expect(schoolInput.value).toBe('MIT');
  });

  it('calls onSave with new entry after clicking Add', async () => {
    const { renderEducation } = await importEducation();
    const onSave = vi.fn();
    renderEducation(document.body, { education: [] }, onSave);
    document.querySelector('[data-action="add-education"]').click();
    expect(onSave).toHaveBeenCalled();
    const profile = onSave.mock.calls[0][0];
    expect(profile.education).toHaveLength(1);
  });

  it('calls onSave after adding 2 entries and removing 1 — correct order', async () => {
    const { renderEducation } = await importEducation();
    const saved = { education: [] };
    const onSave = vi.fn((p) => { saved.education = [...p.education]; });

    renderEducation(document.body, saved, onSave);
    document.querySelector('[data-action="add-education"]').click();
    document.querySelector('[data-action="add-education"]').click();

    // Last saved should have 2 entries
    expect(saved.education).toHaveLength(2);

    // Set distinct values
    document.querySelectorAll('[data-field="education.0.school"]')[0].value = 'MIT';
    document.querySelectorAll('[data-field="education.0.school"]')[0].dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelectorAll('[data-field="education.1.school"]')[0].value = 'Stanford';
    document.querySelectorAll('[data-field="education.1.school"]')[0].dispatchEvent(new Event('change', { bubbles: true }));

    // Remove first entry
    document.querySelectorAll('[data-action="remove-education"]')[0].click();
    const last = onSave.mock.calls[onSave.mock.calls.length - 1][0];
    expect(last.education).toHaveLength(1);
    expect(last.education[0].school).toBe('Stanford');
  });

  it('locks endDate to "present" when isCurrent checkbox is checked', async () => {
    const { renderEducation } = await importEducation();
    const onSave = vi.fn();
    renderEducation(document.body, { education: [{ school: '', degree: '', fieldOfStudy: '', startDate: '', endDate: '', isCurrent: false }] }, onSave);
    const cb = document.querySelector('[data-field="education.0.isCurrent"]');
    cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    const profile = onSave.mock.calls[onSave.mock.calls.length - 1][0];
    expect(profile.education[0].endDate).toBe('present');
  });
});

// ─── workHistory ─────────────────────────────────────────────────────────────

describe('workHistory section', () => {
  it('renders Add button for empty list', async () => {
    const { renderWorkHistory } = await importWorkHistory();
    renderWorkHistory(document.body, { workHistory: [] });
    expect(document.querySelector('[data-action="add-work"]')).toBeTruthy();
  });

  it('renders existing entries', async () => {
    const { renderWorkHistory } = await importWorkHistory();
    renderWorkHistory(document.body, {
      workHistory: [{ company: 'Google', title: 'SWE', startDate: '2022-01', endDate: 'present', isCurrent: true, description: '' }],
    });
    expect(document.querySelector('[data-field="workHistory.0.company"]').value).toBe('Google');
  });

  it('calls onSave after add', async () => {
    const { renderWorkHistory } = await importWorkHistory();
    const onSave = vi.fn();
    renderWorkHistory(document.body, { workHistory: [] }, onSave);
    document.querySelector('[data-action="add-work"]').click();
    expect(onSave).toHaveBeenCalled();
    expect(onSave.mock.calls[0][0].workHistory).toHaveLength(1);
  });

  it('sets endDate to "present" when isCurrent is checked', async () => {
    const { renderWorkHistory } = await importWorkHistory();
    const onSave = vi.fn();
    renderWorkHistory(document.body, { workHistory: [{ company: '', title: '', startDate: '', endDate: '', isCurrent: false, description: '' }] }, onSave);
    const cb = document.querySelector('[data-field="workHistory.0.isCurrent"]');
    cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    const profile = onSave.mock.calls[onSave.mock.calls.length - 1][0];
    expect(profile.workHistory[0].endDate).toBe('present');
    expect(profile.workHistory[0].isCurrent).toBe(true);
  });
});
