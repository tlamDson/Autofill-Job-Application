/**
 * test/filler.test.js — tests for src/filler.js
 * Each section is tagged with the Plan phase it covers.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { setNativeValue } from '../src/filler.js';

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
