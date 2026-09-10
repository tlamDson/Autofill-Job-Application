/**
 * test/filler.test.js — tests for src/filler.js
 * Each section is tagged with the Plan phase it covers.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { setNativeValue, fillSelect, detectDateRole, fillSplitNumber, fillCombobox, attachFileToInput, resolveResumeFileName, selectDeclineOption } from '../src/filler.js';

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

// ─── fillCombobox — real React-Select shape ──────────────────────────────────
//
// On real React-Select widgets (e.g. Greenhouse's application form),
// role="combobox" sits directly on the <input>, not on a wrapper <div> with a
// nested input. buildFillPlan() only ever queries input/select/textarea, so
// this is in practice the *only* shape that ever reaches fillCombobox outside
// the wrapper-div tests above. React-Select also commonly portals its menu
// outside the input's own DOM subtree entirely, rather than nesting it inside
// a shared container.

describe('fillCombobox — role="combobox" directly on the <input>', () => {
  // Builds a fixture where the listbox is NOT a descendant of the input —
  // it's portalled into a sibling container, addressed only via aria-controls,
  // mirroring how React-Select actually renders.
  function makePortalledCombobox(options) {
    const lis = options
      .map((o, i) => `<li role="option" id="opt-${i}">${o}</li>`)
      .join('');
    const doc = makeDoc(`
      <div class="select__control">
        <input role="combobox" aria-autocomplete="list" aria-controls="rs-listbox" aria-expanded="false" />
      </div>
      <div id="menu-portal"></div>
    `);
    const input = doc.querySelector('input[role="combobox"]');
    // Simulate the menu rendering asynchronously in response to input,
    // appended to a sibling portal rather than inside the input's container.
    input.addEventListener('input', () => {
      const portal = doc.getElementById('menu-portal');
      if (portal.querySelector('#rs-listbox')) return;
      const ul = doc.createElement('ul');
      ul.id = 'rs-listbox';
      ul.setAttribute('role', 'listbox');
      ul.innerHTML = lis;
      portal.appendChild(ul);
    });
    return doc;
  }

  it('fills when the input itself is the combobox container (previously always returned false)', async () => {
    const doc = makePortalledCombobox(['Massachusetts Institute of Technology', 'Stanford University']);
    const input = doc.querySelector('input[role="combobox"]');

    const result = await fillCombobox(input, 'Stanford University');

    expect(result).toBe(true);
    expect(input.value).toBe('Stanford University');
  });

  it('finds a listbox portalled outside the container via aria-controls', async () => {
    const doc = makePortalledCombobox(['United States', 'Vietnam', 'Canada']);
    const input = doc.querySelector('input[role="combobox"]');
    let clicked = null;
    doc.addEventListener('click', (e) => {
      if (e.target.getAttribute?.('role') === 'option') clicked = e.target.textContent;
    });

    await fillCombobox(input, 'Vietnam');

    expect(clicked).toBe('Vietnam');
  });

  it('returns false honestly when nothing ever renders — no silent false positive', async () => {
    const doc = makeDoc('<input role="combobox" aria-autocomplete="list" />');
    const input = doc.querySelector('input');

    const result = await fillCombobox(input, 'Anything');

    expect(result).toBe(false);
  });

  it('falls back to keyboard commit when no [role="option"] ever renders via ARIA', async () => {
    const doc = makeDoc('<input role="combobox" aria-autocomplete="list" />');
    const input = doc.querySelector('input');
    // Simulate a virtualized widget that has no ARIA-exposed option list but
    // does commit a value to the input itself when Enter is pressed.
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.value = 'Committed Label';
    });

    const result = await fillCombobox(input, 'anything');

    expect(result).toBe(true);
    expect(input.value).toBe('Committed Label');
  });

  it('keyboard fallback returns false when the input value never changes', async () => {
    const doc = makeDoc('<input role="combobox" aria-autocomplete="list" />');
    const input = doc.querySelector('input');
    // No keydown handler at all — nothing will ever change input.value.

    const result = await fillCombobox(input, 'anything');

    expect(result).toBe(false);
  });
});

// ─── fillCombobox — "yyyy-mm" date splitting for separate month/year widgets ──
//
// Education/work-history dates are stored as one "yyyy-mm" string, but a real
// form commonly renders start/end date as two SEPARATE comboboxes (month,
// year) rather than one combined picker. Each one only recognizes its own
// half, so fillCombobox must try month-name/numeric and bare-year candidates
// rather than only the literal "yyyy-mm" string.

describe('fillCombobox — date value splitting', () => {
  function makePortalledCombobox(options) {
    const lis = options.map((o, i) => `<li role="option" id="opt-${i}">${o}</li>`).join('');
    const doc = makeDoc(`
      <input role="combobox" aria-autocomplete="list" aria-controls="rs-listbox" />
      <div id="menu-portal"></div>
    `);
    const input = doc.querySelector('input[role="combobox"]');
    input.addEventListener('input', () => {
      const portal = doc.getElementById('menu-portal');
      const existing = portal.querySelector('#rs-listbox');
      if (existing) existing.remove(); // re-filter on each keystroke, like a real widget
      const ul = doc.createElement('ul');
      ul.id = 'rs-listbox';
      ul.setAttribute('role', 'listbox');
      const lower = input.value.trim().toLowerCase();
      ul.innerHTML = options
        .filter((o) => o.toLowerCase().includes(lower))
        .map((o, i) => `<li role="option" id="opt-${i}">${o}</li>`)
        .join('');
      portal.appendChild(ul);
    });
    return doc;
  }

  it('fills a month-only combobox from a "yyyy-mm" value using the month name', async () => {
    const doc = makePortalledCombobox([
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ]);
    const input = doc.querySelector('input[role="combobox"]');

    const result = await fillCombobox(input, '2021-09');

    expect(result).toBe(true);
    expect(input.value).toBe('September');
  });

  it('fills a year-only combobox from a "yyyy-mm" value using the bare year', async () => {
    const doc = makePortalledCombobox(['2019', '2020', '2021', '2022', '2023']);
    const input = doc.querySelector('input[role="combobox"]');

    const result = await fillCombobox(input, '2021-09');

    expect(result).toBe(true);
    expect(input.value).toBe('2021');
  });

  it('matches a numeric month option (no month names rendered)', async () => {
    const doc = makePortalledCombobox(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
    const input = doc.querySelector('input[role="combobox"]');

    const result = await fillCombobox(input, '2021-09');

    expect(result).toBe(true);
    expect(input.value).toBe('9');
  });

  it('non-date values are unaffected — still tried as a single literal candidate', async () => {
    const doc = makePortalledCombobox(['Massachusetts Institute of Technology', 'Stanford University']);
    const input = doc.querySelector('input[role="combobox"]');

    const result = await fillCombobox(input, 'Stanford University');

    expect(result).toBe(true);
    expect(input.value).toBe('Stanford University');
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

  it('renames the attached file when fileName is given', () => {
    const doc = makeDoc('<input type="file" />');
    const input = doc.querySelector('input');
    const file = new File(['%PDF-1.4'], 'original.pdf', { type: 'application/pdf' });

    attachFileToInput(input, file, 'Ada_Lovelace_Resume.pdf');

    expect(input.files[0].name).toBe('Ada_Lovelace_Resume.pdf');
  });

  it('keeps the original filename when fileName is omitted', () => {
    const doc = makeDoc('<input type="file" />');
    const input = doc.querySelector('input');
    const file = new File(['%PDF-1.4'], 'original.pdf', { type: 'application/pdf' });

    attachFileToInput(input, file);

    expect(input.files[0].name).toBe('original.pdf');
  });
});

// ─── resolveResumeFileName ──────────────────────────────────────────────────

describe('resolveResumeFileName', () => {
  const profile = { personal: { firstName: 'Ada', lastName: 'Lovelace' } };

  it('builds "First_Last_Resume.<ext>" when resumeFileName is useMyName', () => {
    const result = resolveResumeFileName(profile, { resumeFileName: 'useMyName' }, 'cv.pdf');
    expect(result).toBe('Ada_Lovelace_Resume.pdf');
  });

  it('preserves the original extension', () => {
    const result = resolveResumeFileName(profile, { resumeFileName: 'useMyName' }, 'cv.docx');
    expect(result).toBe('Ada_Lovelace_Resume.docx');
  });

  it('returns the original name when resumeFileName is "original"', () => {
    const result = resolveResumeFileName(profile, { resumeFileName: 'original' }, 'my-cv.pdf');
    expect(result).toBe('my-cv.pdf');
  });

  it('returns the original name when settings is missing', () => {
    expect(resolveResumeFileName(profile, undefined, 'my-cv.pdf')).toBe('my-cv.pdf');
  });

  it('returns the original name when profile has no name', () => {
    const emptyProfile = { personal: { firstName: '', lastName: '' } };
    const result = resolveResumeFileName(emptyProfile, { resumeFileName: 'useMyName' }, 'my-cv.pdf');
    expect(result).toBe('my-cv.pdf');
  });
});

// ─── selectDeclineOption ──────────────────────────────────────────────────────

describe('selectDeclineOption', () => {
  it('selects a decline-worded option on a <select>', () => {
    const doc = makeDoc(`
      <select>
        <option value="">--</option>
        <option value="male">Male</option>
        <option value="female">Female</option>
        <option value="decline">I don't wish to answer</option>
      </select>
    `);
    const select = doc.querySelector('select');
    let changed = false;
    select.addEventListener('change', () => (changed = true));

    const result = selectDeclineOption(select);

    expect(result).toBe(true);
    expect(select.value).toBe('decline');
    expect(changed).toBe(true);
  });

  it('recognizes "Decline to self-identify" wording', () => {
    const doc = makeDoc(`
      <select>
        <option value="white">White</option>
        <option value="decline">Decline to self-identify</option>
      </select>
    `);
    const result = selectDeclineOption(doc.querySelector('select'));
    expect(result).toBe(true);
    expect(doc.querySelector('select').value).toBe('decline');
  });

  it('returns false when no select option matches decline wording', () => {
    const doc = makeDoc(`
      <select>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    `);
    const result = selectDeclineOption(doc.querySelector('select'));
    expect(result).toBe(false);
  });

  it('selects a decline-worded radio by its value', () => {
    const doc = makeDoc(`
      <input type="radio" name="veteran" value="yes" />
      <input type="radio" name="veteran" value="no" />
      <input type="radio" name="veteran" value="I don't wish to answer" />
    `);
    const radios = doc.querySelectorAll('input[type="radio"]');

    const result = selectDeclineOption(radios[0]);

    expect(result).toBe(true);
    expect(radios[2].checked).toBe(true);
    expect(radios[0].checked).toBe(false);
  });

  it('selects a decline-worded radio by its associated label text', () => {
    const doc = makeDoc(`
      <input type="radio" name="disability" value="opt1" id="r1" />
      <label for="r1">Yes</label>
      <input type="radio" name="disability" value="opt2" id="r2" />
      <label for="r2">Prefer not to answer</label>
    `);
    const radios = doc.querySelectorAll('input[type="radio"]');

    const result = selectDeclineOption(radios[0]);

    expect(result).toBe(true);
    expect(radios[1].checked).toBe(true);
  });

  it('returns false for a radio group with no decline option', () => {
    const doc = makeDoc(`
      <input type="radio" name="veteran" value="yes" />
      <input type="radio" name="veteran" value="no" />
    `);
    const result = selectDeclineOption(doc.querySelector('input[type="radio"]'));
    expect(result).toBe(false);
  });

  it('returns false for element types it does not handle (e.g. combobox)', () => {
    const doc = makeDoc('<input role="combobox" />');
    const result = selectDeclineOption(doc.querySelector('input'));
    expect(result).toBe(false);
  });
});
