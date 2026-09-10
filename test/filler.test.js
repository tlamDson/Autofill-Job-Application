/**
 * test/filler.test.js — tests for src/filler.js
 * Each section is tagged with the Plan phase it covers.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { setNativeValue, fillSelect, detectDateRole, fillSplitNumber, fillCombobox, attachFileToInput } from '../src/filler.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeDoc(html) {
  return new JSDOM(html).window.document;
}

// ─── P1.9 — setNativeValue ────────────────────────────────────────────────────

describe('setNativeValue (plain input)', () => {
  it('sets value on a plain text input and dispatches input+change events', () => {
    const doc = makeDoc('<input type="text" />');
    const input = doc.querySelector('input');

    let inputFired = false;
    let changeFired = false;
    input.addEventListener('input', () => (inputFired = true));
    input.addEventListener('change', () => (changeFired = true));

    setNativeValue(input, 'hello world');

    expect(input.value).toBe('hello world');
    expect(inputFired).toBe(true);
    expect(changeFired).toBe(true);
  });

  it('sets value on a textarea and dispatches events', () => {
    const doc = makeDoc('<textarea></textarea>');
    const ta = doc.querySelector('textarea');

    let inputFired = false;
    ta.addEventListener('input', () => (inputFired = true));

    setNativeValue(ta, 'multi\nline');

    expect(ta.value).toBe('multi\nline');
    expect(inputFired).toBe(true);
  });

  it('clears value when passed empty string', () => {
    const doc = makeDoc('<input type="text" value="existing" />');
    const input = doc.querySelector('input');
    setNativeValue(input, '');
    expect(input.value).toBe('');
  });

  it('handles numeric value as string', () => {
    const doc = makeDoc('<input type="number" />');
    const input = doc.querySelector('input');
    setNativeValue(input, '42');
    expect(input.value).toBe('42');
  });
});

describe('setNativeValue (React-style — nativeInputValueSetter override)', () => {
  it('bypasses React own-property setter and still sets value + fires events', () => {
    const doc = makeDoc('<input type="text" />');
    const input = doc.querySelector('input');

    // Simulate React's controlled component: own property setter that intercepts
    // the value assignment but does NOT forward it (React holds state separately).
    let ownSetterCalled = false;
    Object.defineProperty(input, 'value', {
      configurable: true,
      get() {
        // Read via prototype
        return Object.getOwnPropertyDescriptor(
          input.constructor.prototype,
          'value'
        )?.get?.call(input);
      },
      set(v) {
        ownSetterCalled = true;
        // React would NOT call the prototype setter here — we simulate that by
        // intentionally NOT forwarding, so the real value stays unchanged
        // unless setNativeValue bypasses us via the prototype setter.
        //
        // Actually in jsdom the prototype setter IS reachable, so let's
        // simply record the call and forward to prototype to avoid test
        // diverging from real behavior.
        Object.getOwnPropertyDescriptor(
          input.constructor.prototype,
          'value'
        )?.set?.call(input, v);
      },
    });

    let inputFired = false;
    input.addEventListener('input', () => (inputFired = true));

    // setNativeValue should use the prototype setter (bypassing own property)
    // so value gets set and events fire even in the React scenario.
    setNativeValue(input, 'react-val');

    // Value is set correctly
    expect(input.value).toBe('react-val');
    // Events fire
    expect(inputFired).toBe(true);
    // Own-property setter was NOT called (we went straight to prototype)
    expect(ownSetterCalled).toBe(false);
  });
});

// ─── P1.10 — fillSelect + detectDateRole ─────────────────────────────────────

describe('detectDateRole', () => {
  it('detects "month" from aria-label', () => {
    const doc = makeDoc('<select aria-label="Month"></select>');
    expect(detectDateRole(doc.querySelector('select'))).toBe('month');
  });
  it('detects "year" from name', () => {
    const doc = makeDoc('<select name="birth_year"></select>');
    expect(detectDateRole(doc.querySelector('select'))).toBe('year');
  });
  it('detects "day" from id', () => {
    const doc = makeDoc('<select id="start_day"></select>');
    expect(detectDateRole(doc.querySelector('select'))).toBe('day');
  });
  it('detects "month" when options contain month names', () => {
    const doc = makeDoc(`<select>
      <option value="">--</option>
      <option value="1">January</option>
      <option value="2">February</option>
      <option value="3">March</option>
    </select>`);
    expect(detectDateRole(doc.querySelector('select'))).toBe('month');
  });
  it('detects "year" when options contain 4-digit years', () => {
    const doc = makeDoc(`<select>
      <option value="">--</option>
      <option value="2020">2020</option>
      <option value="2021">2021</option>
      <option value="2022">2022</option>
    </select>`);
    expect(detectDateRole(doc.querySelector('select'))).toBe('year');
  });
  it('returns null for unrecognized select', () => {
    const doc = makeDoc('<select name="country"><option value="US">US</option></select>');
    expect(detectDateRole(doc.querySelector('select'))).toBeNull();
  });
});

describe('fillSelect', () => {
  it('selects option by exact value', () => {
    const doc = makeDoc(`<select>
      <option value="">--</option>
      <option value="US">United States</option>
      <option value="VN">Vietnam</option>
    </select>`);
    const sel = doc.querySelector('select');
    let changed = false;
    sel.addEventListener('change', () => (changed = true));
    fillSelect(sel, 'US');
    expect(sel.value).toBe('US');
    expect(changed).toBe(true);
  });

  it('selects option by case-insensitive text match', () => {
    const doc = makeDoc(`<select>
      <option value="">--</option>
      <option value="yes">Yes</option>
      <option value="no">No</option>
    </select>`);
    const sel = doc.querySelector('select');
    fillSelect(sel, 'yes');
    expect(sel.value).toBe('yes');
  });

  it('selects month option from date string yyyy-mm', () => {
    const doc = makeDoc(`<select name="start_month">
      <option value="">--</option>
      <option value="1">January</option>
      <option value="2">February</option>
      <option value="3">March</option>
    </select>`);
    const sel = doc.querySelector('select');
    // Date string "2023-03" → month=3
    fillSelect(sel, '2023-03');
    expect(sel.value).toBe('3');
  });

  it('selects year option from date string yyyy-mm', () => {
    const doc = makeDoc(`<select name="start_year">
      <option value="">--</option>
      <option value="2022">2022</option>
      <option value="2023">2023</option>
    </select>`);
    const sel = doc.querySelector('select');
    fillSelect(sel, '2023-03');
    expect(sel.value).toBe('2023');
  });

  it('does nothing when no matching option', () => {
    const doc = makeDoc(`<select>
      <option value="">--</option>
      <option value="yes">Yes</option>
    </select>`);
    const sel = doc.querySelector('select');
    fillSelect(sel, 'maybe');
    expect(sel.value).toBe('');
  });
});

// ─── P1.11 — fillSplitNumber ──────────────────────────────────────────────────

describe('fillSplitNumber', () => {
  it('splits a phone number across country-code + number inputs', () => {
    const doc = makeDoc(`
      <div>
        <input id="country-code" name="phone_country_code" type="text" />
        <input id="phone-number" name="phone_number" type="tel" />
      </div>
    `);
    const countryInput = doc.getElementById('country-code');
    const phoneInput = doc.getElementById('phone-number');
    let inputFired = false;
    phoneInput.addEventListener('input', () => (inputFired = true));

    fillSplitNumber([countryInput, phoneInput], '+1', '4155552671');

    expect(countryInput.value).toBe('+1');
    expect(phoneInput.value).toBe('4155552671');
    expect(inputFired).toBe(true);
  });

  it('fills a single combined phone input with full number', () => {
    const doc = makeDoc('<input type="tel" />');
    const input = doc.querySelector('input');
    fillSplitNumber([input], null, '+14155552671');
    expect(input.value).toBe('+14155552671');
  });

  it('fills area + exchange + number 3-part split', () => {
    const doc = makeDoc(`
      <div>
        <input id="area" maxlength="3" />
        <input id="exch" maxlength="3" />
        <input id="num"  maxlength="4" />
      </div>
    `);
    const area = doc.getElementById('area');
    const exch = doc.getElementById('exch');
    const num = doc.getElementById('num');

    // Phone: +1-415-555-2671 → area=415, exch=555, num=2671
    fillSplitNumber([area, exch, num], null, '+14155552671');

    expect(area.value).toBe('415');
    expect(exch.value).toBe('555');
    expect(num.value).toBe('2671');
  });

  it('skips country-code input when first input name hints at country code', () => {
    const doc = makeDoc(`
      <input id="cc"    name="country_code" maxlength="4" />
      <input id="phone" name="phone_local"  maxlength="10" />
    `);
    const cc = doc.getElementById('cc');
    const phone = doc.getElementById('phone');

    fillSplitNumber([cc, phone], '+84', '0912345678');

    expect(cc.value).toBe('+84');
    expect(phone.value).toBe('0912345678');
  });
});

// ─── P1.12 — fillCombobox ─────────────────────────────────────────────────────

describe('fillCombobox', () => {
  // Helper to build a typical aria-combobox widget:
  //   <div role="combobox"> → <input type="text"> + <ul role="listbox"> → <li role="option">
  function makeCombobox(options, inputAttrs = '') {
    const lis = options
      .map((o, i) => `<li role="option" data-value="${o}" id="opt-${i}">${o}</li>`)
      .join('');
    return makeDoc(`
      <div role="combobox" aria-expanded="false" aria-haspopup="listbox">
        <input type="text" aria-autocomplete="list" ${inputAttrs} />
        <ul role="listbox" style="display:none">${lis}</ul>
      </div>
    `);
  }

  it('types into the input triggering the listbox', async () => {
    const doc = makeCombobox(['Software Engineer', 'Product Manager', 'Designer']);
    const input = doc.querySelector('input');
    const ul = doc.querySelector('[role="listbox"]');

    // Simulate listbox appearing when input fires
    input.addEventListener('input', () => {
      ul.style.display = 'block';
    });

    const result = await fillCombobox(doc.querySelector('[role="combobox"]'), 'Software Engineer');
    expect(result).toBe(true);
    expect(input.value).toBe('Software Engineer');
  });

  it('clicks the matching listbox option', async () => {
    const doc = makeCombobox(['United States', 'Vietnam', 'Canada']);
    const input = doc.querySelector('input');
    const ul = doc.querySelector('[role="listbox"]');
    const options = doc.querySelectorAll('[role="option"]');

    let clickedOption = null;
    options.forEach((opt) => {
      opt.addEventListener('click', () => { clickedOption = opt.textContent; });
      opt.addEventListener('mousedown', () => { clickedOption = opt.textContent; });
    });

    // Show listbox when input changes
    input.addEventListener('input', () => { ul.style.display = 'block'; });

    await fillCombobox(doc.querySelector('[role="combobox"]'), 'Vietnam');

    // Either click or mousedown should have fired on "Vietnam"
    expect(clickedOption).toBe('Vietnam');
  });

  it('returns false when no matching option found', async () => {
    const doc = makeCombobox(['Option A', 'Option B']);
    const result = await fillCombobox(doc.querySelector('[role="combobox"]'), 'Option Z');
    expect(result).toBe(false);
  });

  it('matches option case-insensitively', async () => {
    const doc = makeCombobox(['Yes', 'No', 'Prefer not to say']);
    const input = doc.querySelector('input');
    const ul = doc.querySelector('[role="listbox"]');
    input.addEventListener('input', () => { ul.style.display = 'block'; });

    const result = await fillCombobox(doc.querySelector('[role="combobox"]'), 'yes');
    expect(result).toBe(true);
    expect(input.value.toLowerCase()).toBe('yes');
  });
});

// ─── P1.13 — attachFileToInput ────────────────────────────────────────────────

describe('attachFileToInput', () => {
  it('attaches a Blob/File to an <input type="file"> via DataTransfer', () => {
    const doc = makeDoc('<input type="file" accept=".pdf" />');
    const input = doc.querySelector('input');

    const file = new File(['%PDF-1.4 content'], 'resume.pdf', { type: 'application/pdf' });

    let changeFired = false;
    input.addEventListener('change', () => (changeFired = true));

    attachFileToInput(input, file);

    // jsdom supports DataTransfer and files property
    expect(input.files).toBeTruthy();
    expect(input.files.length).toBe(1);
    expect(input.files[0].name).toBe('resume.pdf');
    expect(changeFired).toBe(true);
  });

  it('fires change event even if DataTransfer is unavailable (polyfill path)', () => {
    const doc = makeDoc('<input type="file" />');
    const input = doc.querySelector('input');

    // Simulate environment without DataTransfer support
    const savedDT = globalThis.DataTransfer;
    globalThis.DataTransfer = undefined;

    let changeFired = false;
    input.addEventListener('change', () => (changeFired = true));

    try {
      attachFileToInput(input, new File(['content'], 'cv.pdf', { type: 'application/pdf' }));
    } finally {
      globalThis.DataTransfer = savedDT;
    }

    // Change should still fire (best-effort)
    expect(changeFired).toBe(true);
  });

  it('does nothing if no file provided', () => {
    const doc = makeDoc('<input type="file" />');
    const input = doc.querySelector('input');
    let changeFired = false;
    input.addEventListener('change', () => (changeFired = true));
    attachFileToInput(input, null);
    expect(changeFired).toBe(false);
  });
});
