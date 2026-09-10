// misc.test.js — TDD cho workAuth, eeo, compensation, skills sections
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createChromeMock } from '../helpers/chromeMock.js';

beforeEach(() => {
  const { chrome } = createChromeMock();
  globalThis.chrome = chrome;
  document.body.innerHTML = '';
});

async function imp(name) {
  return import(`../../options/sections/${name}.js?t=` + Date.now());
}

// ─── workAuthorization ────────────────────────────────────────────────────────

describe('workAuth section', () => {
  it('renders needsSponsorship checkbox', async () => {
    const { renderWorkAuth } = await imp('workAuth');
    renderWorkAuth(document.body, {});
    expect(document.querySelector('[data-field="workAuthorization.needsSponsorship"]')).toBeTruthy();
  });

  it('pre-fills from profile', async () => {
    const { renderWorkAuth } = await imp('workAuth');
    renderWorkAuth(document.body, { workAuthorization: { needsSponsorship: true } });
    expect(document.querySelector('[data-field="workAuthorization.needsSponsorship"]').checked).toBe(true);
  });

  it('calls onSave with updated needsSponsorship on change', async () => {
    const { renderWorkAuth } = await imp('workAuth');
    const onSave = vi.fn();
    renderWorkAuth(document.body, { workAuthorization: { needsSponsorship: false } }, onSave);
    const cb = document.querySelector('[data-field="workAuthorization.needsSponsorship"]');
    cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onSave).toHaveBeenCalled();
    expect(onSave.mock.calls[0][0].workAuthorization.needsSponsorship).toBe(true);
  });

  it('renders authorizedToWork unchecked when null (not set)', async () => {
    const { renderWorkAuth } = await imp('workAuth');
    renderWorkAuth(document.body, { workAuthorization: { authorizedToWork: null } });
    expect(document.querySelector('[data-field="workAuthorization.authorizedToWork"]').checked).toBe(false);
  });

  it('calls onSave with authorizedToWork: true when checked', async () => {
    const { renderWorkAuth } = await imp('workAuth');
    const onSave = vi.fn();
    renderWorkAuth(document.body, { workAuthorization: { authorizedToWork: null } }, onSave);
    const cb = document.querySelector('[data-field="workAuthorization.authorizedToWork"]');
    cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onSave.mock.calls[0][0].workAuthorization.authorizedToWork).toBe(true);
  });
});

// ─── EEO ─────────────────────────────────────────────────────────────────────

describe('eeo section', () => {
  it('renders gender, race, veteranStatus, disabilityStatus fields', async () => {
    const { renderEEO } = await imp('eeo');
    renderEEO(document.body, {});
    expect(document.querySelector('[data-field="eeo.gender"]')).toBeTruthy();
    expect(document.querySelector('[data-field="eeo.race"]')).toBeTruthy();
    expect(document.querySelector('[data-field="eeo.veteranStatus"]')).toBeTruthy();
    expect(document.querySelector('[data-field="eeo.disabilityStatus"]')).toBeTruthy();
  });

  it('defaults to empty string (decline to answer) when profile has no eeo', async () => {
    const { renderEEO } = await imp('eeo');
    renderEEO(document.body, {});
    expect(document.querySelector('[data-field="eeo.gender"]').value).toBe('');
  });

  it('calls onSave with updated gender on change', async () => {
    const { renderEEO } = await imp('eeo');
    const onSave = vi.fn();
    renderEEO(document.body, { eeo: { gender: '' } }, onSave);
    const input = document.querySelector('[data-field="eeo.gender"]');
    input.value = 'Male';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onSave).toHaveBeenCalled();
    expect(onSave.mock.calls[0][0].eeo.gender).toBe('Male');
  });

  it('renders a hispanicLatino field', async () => {
    const { renderEEO } = await imp('eeo');
    renderEEO(document.body, {});
    expect(document.querySelector('[data-field="eeo.hispanicLatino"]')).toBeTruthy();
  });

  it('offers a canonical "Decline to self-identify" option on race', async () => {
    const { renderEEO } = await imp('eeo');
    renderEEO(document.body, {});
    const select = document.querySelector('[data-field="eeo.race"]');
    const optionTexts = Array.from(select.options).map((o) => o.value);
    expect(optionTexts).toContain('Decline to self-identify');
  });
});

// ─── Consents ────────────────────────────────────────────────────────────────

describe('consents section', () => {
  it('renders agreeToTerms checkbox, unchecked by default', async () => {
    const { renderConsents } = await imp('consents');
    renderConsents(document.body, {});
    const cb = document.querySelector('[data-field="consents.agreeToTerms"]');
    expect(cb).toBeTruthy();
    expect(cb.checked).toBe(false);
  });

  it('pre-fills from profile', async () => {
    const { renderConsents } = await imp('consents');
    renderConsents(document.body, { consents: { agreeToTerms: true } });
    expect(document.querySelector('[data-field="consents.agreeToTerms"]').checked).toBe(true);
  });

  it('calls onSave with updated agreeToTerms on change', async () => {
    const { renderConsents } = await imp('consents');
    const onSave = vi.fn();
    renderConsents(document.body, { consents: { agreeToTerms: false } }, onSave);
    const cb = document.querySelector('[data-field="consents.agreeToTerms"]');
    cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onSave).toHaveBeenCalled();
    expect(onSave.mock.calls[0][0].consents.agreeToTerms).toBe(true);
  });
});

// ─── Compensation ─────────────────────────────────────────────────────────────

describe('compensation section', () => {
  it('renders salary min, max, currency, noticePeriod', async () => {
    const { renderCompensation } = await imp('compensation');
    renderCompensation(document.body, {});
    expect(document.querySelector('[data-field="compensation.desiredSalaryMin"]')).toBeTruthy();
    expect(document.querySelector('[data-field="compensation.desiredSalaryMax"]')).toBeTruthy();
    expect(document.querySelector('[data-field="compensation.currency"]')).toBeTruthy();
    expect(document.querySelector('[data-field="compensation.noticePeriod"]')).toBeTruthy();
  });

  it('calls onSave with updated salary on change', async () => {
    const { renderCompensation } = await imp('compensation');
    const onSave = vi.fn();
    renderCompensation(document.body, { compensation: { desiredSalaryMin: null } }, onSave);
    const input = document.querySelector('[data-field="compensation.desiredSalaryMin"]');
    input.value = '100000';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onSave).toHaveBeenCalled();
  });
});

// ─── Skills ──────────────────────────────────────────────────────────────────

describe('skills section', () => {
  it('renders tag input area', async () => {
    const { renderSkills } = await imp('skills');
    renderSkills(document.body, { skills: [] });
    expect(document.querySelector('[data-section="skills"]')).toBeTruthy();
  });

  it('renders existing skills as tags', async () => {
    const { renderSkills } = await imp('skills');
    renderSkills(document.body, { skills: ['JavaScript', 'Go'] });
    const tags = document.querySelectorAll('[data-skill-tag]');
    expect(tags).toHaveLength(2);
    expect(tags[0].textContent).toContain('JavaScript');
  });

  it('adds skill on input + Enter and calls onSave', async () => {
    const { renderSkills } = await imp('skills');
    const onSave = vi.fn();
    renderSkills(document.body, { skills: [] }, onSave);
    const input = document.querySelector('[data-skill-input]');
    input.value = 'Python';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onSave).toHaveBeenCalled();
    expect(onSave.mock.calls[0][0].skills).toContain('Python');
  });

  it('removes skill on tag remove click and calls onSave', async () => {
    const { renderSkills } = await imp('skills');
    const onSave = vi.fn();
    renderSkills(document.body, { skills: ['Java', 'Rust'] }, onSave);
    document.querySelector('[data-remove-skill="Java"]').click();
    const last = onSave.mock.calls[onSave.mock.calls.length - 1][0];
    expect(last.skills).not.toContain('Java');
    expect(last.skills).toContain('Rust');
  });
});
