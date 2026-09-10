/**
 * test/filler.test.js — tests for src/filler.js
 * Each section is tagged with the Plan phase it covers.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { setNativeValue, fillSelect, detectDateRole } from '../src/filler.js';

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
