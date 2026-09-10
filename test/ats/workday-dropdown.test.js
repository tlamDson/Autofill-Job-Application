/**
 * test/ats/workday-dropdown.test.js — P5.2 Workday custom dropdown
 *
 * Workday uses aria combobox components for many fields (country, state,
 * degree type, employment type, etc.). They are NOT native <select> elements.
 *
 * Structure:
 *   <div role="combobox" data-automation-id="...">
 *     <input type="text" aria-autocomplete="list" />
 *   </div>
 *   <!-- After typing, listbox appears: -->
 *   <ul role="listbox">
 *     <li role="option">United States</li>
 *     ...
 *   </ul>
 */

import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { fillWorkdayDropdown } from '../../src/ats/workday.js';

function makeDoc(html) {
  return new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, {
    url: 'https://wd3.myworkday.com/acme/d/task/apply',
  }).window.document;
}

// A Workday combobox that renders a listbox when the input changes
const WD_COMBOBOX_HTML = `
<div role="combobox" data-automation-id="country" aria-expanded="false">
  <input type="text" aria-autocomplete="list" value="" />
</div>
<ul role="listbox" id="country-options" style="display:none">
  <li role="option">United States</li>
  <li role="option">Canada</li>
  <li role="option">United Kingdom</li>
</ul>
`;

// Simulates a combobox where typing reveals the listbox
function makeComboboxDoc() {
  const dom = new JSDOM(`<!DOCTYPE html><html><body>${WD_COMBOBOX_HTML}</body></html>`, {
    url: 'https://wd3.myworkday.com/acme/d/task/apply',
  });
  const doc = dom.window.document;

  // Make the listbox visible (simulate Workday's autocomplete reveal)
  const input = doc.querySelector('input');
  input.addEventListener('input', () => {
    const listbox = doc.querySelector('[role="listbox"]');
    listbox.style.display = '';
  });

  return doc;
}

describe('fillWorkdayDropdown', () => {
  it('returns false when container is null', async () => {
    const result = await fillWorkdayDropdown(null, 'United States');
    expect(result).toBe(false);
  });

  it('returns false when value is empty', async () => {
    const doc = makeDoc(WD_COMBOBOX_HTML);
    const container = doc.querySelector('[role="combobox"]');
    const result = await fillWorkdayDropdown(container, '');
    expect(result).toBe(false);
  });

  it('returns false when no input found in container', async () => {
    const doc = makeDoc('<div role="combobox"></div>');
    const container = doc.querySelector('[role="combobox"]');
    const result = await fillWorkdayDropdown(container, 'US');
    expect(result).toBe(false);
  });

  it('types into the input to trigger autocomplete', async () => {
    const doc = makeComboboxDoc();
    const container = doc.querySelector('[role="combobox"]');
    await fillWorkdayDropdown(container, 'United States');
    expect(doc.querySelector('input').value).toBe('United States');
  });

  it('clicks the matching option in the listbox', async () => {
    const doc = makeComboboxDoc();
    const container = doc.querySelector('[role="combobox"]');

    let clicked = null;
    doc.querySelectorAll('[role="option"]').forEach((opt) => {
      opt.addEventListener('click', () => (clicked = opt.textContent.trim()));
    });

    const result = await fillWorkdayDropdown(container, 'United States');
    expect(result).toBe(true);
    expect(clicked).toBe('United States');
  });

  it('matches option case-insensitively', async () => {
    const doc = makeComboboxDoc();
    const container = doc.querySelector('[role="combobox"]');

    let clicked = null;
    doc.querySelectorAll('[role="option"]').forEach((opt) => {
      opt.addEventListener('click', () => (clicked = opt.textContent.trim()));
    });

    const result = await fillWorkdayDropdown(container, 'canada');
    expect(result).toBe(true);
    expect(clicked).toBe('Canada');
  });

  it('returns false when no matching option found', async () => {
    const doc = makeComboboxDoc();
    const container = doc.querySelector('[role="combobox"]');
    const result = await fillWorkdayDropdown(container, 'Elbonia');
    expect(result).toBe(false);
  });
});
