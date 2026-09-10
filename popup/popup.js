/**
 * popup/popup.js — Autofill popup controller
 *
 * Wires the Autofill button to postFillRequest() (content.js),
 * shows loading state, and displays results.
 *
 * Exported for unit testing:
 *   initPopup(deps) — factory receiving { button, statusArea, sendFill }
 */

// ─── Testable controller ──────────────────────────────────────────────────────

/**
 * @param {{
 *   button: HTMLButtonElement,
 *   statusArea: HTMLElement,
 *   sendFill: () => Promise<{ok:boolean, filled:number, skipped:number}|{ok:boolean, error:string}>
 * }} deps
 */
export function initPopup({ button, statusArea, sendFill }) {
  function setStatus(type, text) {
    statusArea.className = `status-area visible ${type}`;
    statusArea.textContent = text;
  }

  function setLoading(isLoading) {
    button.disabled = isLoading;
    if (isLoading) {
      button.classList.add('loading');
      button.querySelector('.btn-label').textContent = 'Filling…';
    } else {
      button.classList.remove('loading');
      button.querySelector('.btn-label').textContent = 'Autofill';
    }
  }

  button.addEventListener('click', async () => {
    setLoading(true);
    statusArea.className = 'status-area'; // hide previous status

    try {
      const result = await sendFill();
      if (result.ok) {
        const noun = result.filled === 1 ? 'field' : 'fields';
        setStatus(
          'success',
          `✓ Filled ${result.filled} ${noun}` +
            (result.skipped ? ` (${result.skipped} skipped)` : '')
        );
      } else {
        setStatus('error', `✗ Error: ${result.error || 'Unknown error'}`);
      }
    } catch (err) {
      setStatus('error', `✗ ${err.message || String(err)}`);
    } finally {
      setLoading(false);
    }
  });
}

// ─── Live registration ────────────────────────────────────────────────────────

if (typeof document !== 'undefined' && typeof chrome !== 'undefined') {
  document.addEventListener('DOMContentLoaded', async () => {
    const { postFillRequest } = await import('../src/content.js');

    const button = document.getElementById('autofill-btn');
    const statusArea = document.getElementById('status-area');

    initPopup({
      button,
      statusArea,
      sendFill: postFillRequest,
    });
  });
}
