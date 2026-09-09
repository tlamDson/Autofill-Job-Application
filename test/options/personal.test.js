// personal.test.js — TDD cho personal + links section của options UI
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createChromeMock } from '../helpers/chromeMock.js';

// Setup chrome mock trước khi import store
let saveMock;

beforeEach(() => {
  const { chrome } = createChromeMock();
  globalThis.chrome = chrome;
  saveMock = vi.spyOn(chrome.storage.local, 'set');
  document.body.innerHTML = '';
});

async function importPersonal() {
  return import('../../options/sections/personal.js?t=' + Date.now());
}
async function importLinks() {
  return import('../../options/sections/links.js?t=' + Date.now());
}

describe('personal section', () => {
  it('renders firstName, lastName, email, phone inputs', async () => {
    const { renderPersonal } = await importPersonal();
    renderPersonal(document.body, {});
    expect(document.querySelector('[data-field="personal.firstName"]')).toBeTruthy();
    expect(document.querySelector('[data-field="personal.lastName"]')).toBeTruthy();
    expect(document.querySelector('[data-field="personal.email"]')).toBeTruthy();
    expect(document.querySelector('[data-field="personal.phone"]')).toBeTruthy();
  });

  it('pre-fills inputs from provided profile', async () => {
    const { renderPersonal } = await importPersonal();
    renderPersonal(document.body, { personal: { firstName: 'Tung', lastName: 'Lam', email: 'tung@test.com', phone: '+1555' } });
    expect(document.querySelector('[data-field="personal.firstName"]').value).toBe('Tung');
    expect(document.querySelector('[data-field="personal.email"]').value).toBe('tung@test.com');
  });

  it('calls onSave with updated payload on input change', async () => {
    const { renderPersonal } = await importPersonal();
    const onSave = vi.fn();
    renderPersonal(document.body, { personal: { firstName: '' } }, onSave);
    const input = document.querySelector('[data-field="personal.firstName"]');
    input.value = 'Alice';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onSave).toHaveBeenCalled();
    const payload = onSave.mock.calls[0][0];
    expect(payload.personal.firstName).toBe('Alice');
  });

  it('shows validation error for invalid email inline', async () => {
    const { renderPersonal } = await importPersonal();
    const onSave = vi.fn();
    renderPersonal(document.body, { personal: { email: '' } }, onSave);
    const input = document.querySelector('[data-field="personal.email"]');
    input.value = 'not-valid';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    // Error message should appear somewhere near the input
    const errorEl = document.querySelector('[data-error="personal.email"]');
    expect(errorEl).toBeTruthy();
    expect(errorEl.textContent).toBeTruthy();
  });
});

describe('links section', () => {
  it('renders linkedin, github, portfolio, website inputs', async () => {
    const { renderLinks } = await importLinks();
    renderLinks(document.body, {});
    expect(document.querySelector('[data-field="links.linkedin"]')).toBeTruthy();
    expect(document.querySelector('[data-field="links.github"]')).toBeTruthy();
    expect(document.querySelector('[data-field="links.portfolio"]')).toBeTruthy();
    expect(document.querySelector('[data-field="links.website"]')).toBeTruthy();
  });

  it('pre-fills from profile', async () => {
    const { renderLinks } = await importLinks();
    renderLinks(document.body, { links: { linkedin: 'https://linkedin.com/in/test', github: '' } });
    expect(document.querySelector('[data-field="links.linkedin"]').value).toBe('https://linkedin.com/in/test');
  });

  it('calls onSave with updated links on change', async () => {
    const { renderLinks } = await importLinks();
    const onSave = vi.fn();
    renderLinks(document.body, { links: { github: '' } }, onSave);
    const input = document.querySelector('[data-field="links.github"]');
    input.value = 'https://github.com/user';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    expect(onSave).toHaveBeenCalled();
    expect(onSave.mock.calls[0][0].links.github).toBe('https://github.com/user');
  });
});
