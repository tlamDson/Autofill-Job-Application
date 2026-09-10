/**
 * test/popup.test.js — P1.16 Popup trigger + state
 *
 * Tests the initPopup controller with jsdom elements.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import { initPopup } from '../popup/popup.js';

function makePopupDom() {
  const { window } = new JSDOM(`
    <button id="autofill-btn" class="btn btn-primary" type="button">
      <span class="btn-icon">▶</span>
      <span class="btn-label">Autofill</span>
    </button>
    <div id="status-area" class="status-area"></div>
  `);
  const button = window.document.getElementById('autofill-btn');
  const statusArea = window.document.getElementById('status-area');
  return { window, button, statusArea };
}

describe('initPopup', () => {
  it('disables button and shows loading state while filling', async () => {
    const { button, statusArea } = makePopupDom();

    let resolveFill;
    const sendFill = vi.fn().mockReturnValue(new Promise((r) => { resolveFill = r; }));

    initPopup({ button, statusArea, sendFill });
    button.click();

    // Should be loading immediately
    expect(button.disabled).toBe(true);
    expect(button.querySelector('.btn-label').textContent).toBe('Filling…');

    // Resolve the fill
    resolveFill({ ok: true, filled: 2, skipped: 0 });
    await new Promise((r) => setTimeout(r, 0));

    // Should re-enable
    expect(button.disabled).toBe(false);
    expect(button.querySelector('.btn-label').textContent).toBe('Autofill');
  });

  it('shows success status with field count', async () => {
    const { button, statusArea } = makePopupDom();
    const sendFill = vi.fn().mockResolvedValue({ ok: true, filled: 5, skipped: 1 });

    initPopup({ button, statusArea, sendFill });
    button.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(statusArea.className).toContain('success');
    expect(statusArea.textContent).toContain('5 fields');
    expect(statusArea.textContent).toContain('1 skipped');
  });

  it('shows success with singular "field" when filled=1', async () => {
    const { button, statusArea } = makePopupDom();
    const sendFill = vi.fn().mockResolvedValue({ ok: true, filled: 1, skipped: 0 });

    initPopup({ button, statusArea, sendFill });
    button.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(statusArea.textContent).toContain('1 field');
    expect(statusArea.textContent).not.toContain('1 fields');
  });

  it('shows error status when fill returns ok=false', async () => {
    const { button, statusArea } = makePopupDom();
    const sendFill = vi.fn().mockResolvedValue({ ok: false, error: 'Tab not found' });

    initPopup({ button, statusArea, sendFill });
    button.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(statusArea.className).toContain('error');
    expect(statusArea.textContent).toContain('Tab not found');
  });

  it('shows error status when sendFill throws', async () => {
    const { button, statusArea } = makePopupDom();
    const sendFill = vi.fn().mockRejectedValue(new Error('Network error'));

    initPopup({ button, statusArea, sendFill });
    button.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(statusArea.className).toContain('error');
    expect(statusArea.textContent).toContain('Network error');
  });

  it('calls sendFill when button is clicked', async () => {
    const { button, statusArea } = makePopupDom();
    const sendFill = vi.fn().mockResolvedValue({ ok: true, filled: 0, skipped: 0 });

    initPopup({ button, statusArea, sendFill });
    button.click();
    await new Promise((r) => setTimeout(r, 0));

    expect(sendFill).toHaveBeenCalledOnce();
  });
});
