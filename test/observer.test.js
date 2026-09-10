/**
 * test/observer.test.js — P1.17 MutationObserver multi-step form opt-in
 *
 * Tests the createFormObserver utility that watches for new form fields
 * appearing in the DOM (e.g., multi-step forms) and signals the extension
 * to re-fill newly visible fields.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { createFormObserver } from '../src/observer.js';

function makeDoc(html = '') {
  return new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, {
    url: 'http://localhost/',
  }).window.document;
}

describe('createFormObserver', () => {
  it('calls onNewFields when new input is added to observed root', async () => {
    const doc = makeDoc('<div id="form-root"></div>');
    const root = doc.getElementById('form-root');

    const onNewFields = vi.fn();
    const obs = createFormObserver(root, onNewFields, { debounceMs: 10 });
    obs.start();

    // Add a new input to trigger mutation
    const input = doc.createElement('input');
    input.type = 'text';
    input.name = 'first_name';
    root.appendChild(input);

    // Wait past the short debounce
    await new Promise((r) => setTimeout(r, 30));

    expect(onNewFields).toHaveBeenCalled();
    obs.stop();
  });

  it('does NOT call onNewFields when non-fillable element added', async () => {
    const doc = makeDoc('<div id="form-root"></div>');
    const root = doc.getElementById('form-root');

    const onNewFields = vi.fn();
    const obs = createFormObserver(root, onNewFields, { debounceMs: 10 });
    obs.start();

    // Add a non-input element
    const div = doc.createElement('div');
    div.textContent = 'Some text';
    root.appendChild(div);

    await new Promise((r) => setTimeout(r, 30));

    expect(onNewFields).not.toHaveBeenCalled();
    obs.stop();
  });

  it('debounces rapid DOM changes into a single callback', async () => {
    const doc = makeDoc('<div id="form-root"></div>');
    const root = doc.getElementById('form-root');

    const onNewFields = vi.fn();
    const obs = createFormObserver(root, onNewFields, { debounceMs: 50 });
    obs.start();

    // Add 5 inputs rapidly
    for (let i = 0; i < 5; i++) {
      const input = doc.createElement('input');
      input.type = 'text';
      root.appendChild(input);
    }

    // Wait less than debounce
    await new Promise((r) => setTimeout(r, 20));
    expect(onNewFields).not.toHaveBeenCalled();

    // Wait past debounce
    await new Promise((r) => setTimeout(r, 50));
    expect(onNewFields).toHaveBeenCalledTimes(1);
    obs.stop();
  });

  it('start() is idempotent — calling it again while already observing does not duplicate callbacks', async () => {
    const doc = makeDoc('<div id="form-root"></div>');
    const root = doc.getElementById('form-root');

    const onNewFields = vi.fn();
    const obs = createFormObserver(root, onNewFields, { debounceMs: 10 });
    obs.start();
    obs.start(); // re-arm, as content.js does on every runFill() when continuousMultipage is on

    const input = doc.createElement('input');
    input.type = 'text';
    root.appendChild(input);

    await new Promise((r) => setTimeout(r, 30));

    expect(onNewFields).toHaveBeenCalledTimes(1);
    obs.stop();
  });

  it('stop() disconnects the observer — no more callbacks', async () => {
    const doc = makeDoc('<div id="form-root"></div>');
    const root = doc.getElementById('form-root');

    const onNewFields = vi.fn();
    const obs = createFormObserver(root, onNewFields);
    obs.start();
    obs.stop();

    // Add input after stop
    const input = doc.createElement('input');
    root.appendChild(input);

    await new Promise((r) => setTimeout(r, 20));

    expect(onNewFields).not.toHaveBeenCalled();
  });
});
