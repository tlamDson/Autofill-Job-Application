/**
 * test/logger.test.js — P7.1 Log field không classify được + P7.2 Log viewer
 *
 * Tests:
 *   P7.1:
 *     - logUnclassified(field) — appends entry to in-memory log
 *     - getLog() — returns current log array
 *     - clearLog() — resets log
 *     - persistLog(storage) — saves log to chrome.storage.local
 *     - loadLog(storage) — restores log from storage
 *
 *   P7.2:
 *     - renderLogViewer(doc, entries) → Element — builds log viewer DOM
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  logUnclassified,
  getLog,
  clearLog,
  persistLog,
  loadLog,
  renderLogViewer,
} from '../src/logger.js';

function makeDoc(html = '') {
  return new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, {
    url: 'http://localhost/',
  }).window.document;
}

// ─── P7.1 Logging ─────────────────────────────────────────────────────────────

describe('logUnclassified', () => {
  beforeEach(() => clearLog());

  it('adds an entry to the log', () => {
    logUnclassified({ label: 'Company Name', name: 'company_x', url: 'https://example.com' });
    expect(getLog().length).toBe(1);
  });

  it('stores label, name, and url', () => {
    logUnclassified({ label: 'Company Name', name: 'comp', url: 'https://ex.com' });
    const entry = getLog()[0];
    expect(entry.label).toBe('Company Name');
    expect(entry.name).toBe('comp');
    expect(entry.url).toBe('https://ex.com');
  });

  it('stores a timestamp', () => {
    logUnclassified({ label: 'X', name: 'x', url: '' });
    expect(typeof getLog()[0].timestamp).toBe('number');
  });

  it('accumulates multiple entries', () => {
    logUnclassified({ label: 'A', name: 'a', url: '' });
    logUnclassified({ label: 'B', name: 'b', url: '' });
    expect(getLog().length).toBe(2);
  });
});

describe('clearLog', () => {
  it('empties the log', () => {
    logUnclassified({ label: 'A', name: 'a', url: '' });
    clearLog();
    expect(getLog().length).toBe(0);
  });
});

describe('persistLog / loadLog', () => {
  beforeEach(() => clearLog());

  it('saves and restores log via storage', async () => {
    const store = {};
    const mockStorage = {
      set: vi.fn((data) => { Object.assign(store, data); }),
      get: vi.fn((key) => ({ [key]: store[key] })),
    };

    logUnclassified({ label: 'Test', name: 't', url: 'https://test.com' });
    await persistLog(mockStorage);
    clearLog();

    await loadLog(mockStorage);
    expect(getLog().length).toBe(1);
    expect(getLog()[0].label).toBe('Test');
  });

  it('handles empty storage gracefully', async () => {
    const mockStorage = {
      get: vi.fn(() => ({})),
    };
    await loadLog(mockStorage);
    expect(getLog().length).toBe(0);
  });
});

// ─── P7.2 Log viewer DOM ─────────────────────────────────────────────────────

describe('renderLogViewer', () => {
  it('returns a DOM element', () => {
    const doc = makeDoc();
    const el = renderLogViewer(doc, []);
    expect(el).toBeTruthy();
    expect(el.tagName).toBeDefined();
  });

  it('shows "No unclassified fields" when log is empty', () => {
    const doc = makeDoc();
    const el = renderLogViewer(doc, []);
    expect(el.textContent).toContain('No unclassified');
  });

  it('renders one row per log entry', () => {
    const doc = makeDoc();
    const entries = [
      { label: 'Foo', name: 'foo', url: 'https://a.com', timestamp: Date.now() },
      { label: 'Bar', name: 'bar', url: 'https://b.com', timestamp: Date.now() },
    ];
    const el = renderLogViewer(doc, entries);
    // Each entry should have its label visible
    expect(el.textContent).toContain('Foo');
    expect(el.textContent).toContain('Bar');
  });

  it('shows the URL for each entry', () => {
    const doc = makeDoc();
    const entries = [
      { label: 'Foo', name: 'foo', url: 'https://example.com/apply', timestamp: Date.now() },
    ];
    const el = renderLogViewer(doc, entries);
    expect(el.textContent).toContain('example.com');
  });

  it('has a "Clear Log" button', () => {
    const doc = makeDoc();
    const el = renderLogViewer(doc, []);
    const buttons = Array.from(el.querySelectorAll('button'));
    const clearBtn = buttons.find((b) => /clear/i.test(b.textContent));
    expect(clearBtn).toBeTruthy();
  });
});
