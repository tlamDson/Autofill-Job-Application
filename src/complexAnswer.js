/**
 * src/complexAnswer.js — Complex-answer (open question) flow
 *
 * Handles the "review panel" for questions that weren't covered by fast-fill:
 *   - collectOpenQuestions(doc, filledEls) — find unanswered textarea/long-text fields
 *   - createReviewPanel(doc, questions, callbacks) — build the in-page panel DOM
 *
 * The panel is injected into the live page so the user can:
 *   1. See which open questions need attention.
 *   2. Edit the answer in a textarea.
 *   3. Click "Accept" to write the answer back to the real form field.
 *   4. Click "Generate with AI" to trigger the AI draft flow (P4.5).
 */

// ─── Open question collector ──────────────────────────────────────────────────

/**
 * Extract the text label associated with a form element.
 * Priority: <label for="id"> → aria-label → placeholder → name → ''
 *
 * @param {Element} el
 * @returns {string}
 */
function getLabelText(el) {
  const doc = el.ownerDocument;

  // <label for="...">
  if (el.id) {
    const labelEl = doc.querySelector(`label[for="${el.id}"]`);
    if (labelEl) return labelEl.textContent.trim();
  }

  // Aria
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.trim();

  // Enclosing <label>
  const parent = el.closest('label');
  if (parent) return parent.textContent.trim();

  // Nearby <label> (sibling scan)
  if (el.parentElement) {
    const sibling = el.parentElement.querySelector('label');
    if (sibling) return sibling.textContent.trim();
  }

  return el.getAttribute('placeholder') || el.getAttribute('name') || '';
}

/**
 * Find all textarea (and large text inputs) on the page that:
 *  - Are not in the `filledEls` list (already handled by fast-fill).
 *  - Are currently empty (no value set).
 *
 * @param {Document}  doc
 * @param {Element[]} filledEls  — elements already filled by the adapter
 * @returns {{el: Element, label: string}[]}
 */
export function collectOpenQuestions(doc, filledEls = []) {
  const filledSet = new Set(filledEls);

  // Collect textarea elements that are empty and not already filled
  const candidates = Array.from(doc.querySelectorAll('textarea'));

  return candidates
    .filter((el) => {
      if (filledSet.has(el)) return false;
      if ((el.value || '').trim() !== '') return false; // already has content
      return true;
    })
    .map((el) => ({
      el,
      label: getLabelText(el),
    }));
}

// ─── Review panel builder ─────────────────────────────────────────────────────

const PANEL_ID = 'autofill-review-panel';

/**
 * Create the review panel DOM element.
 *
 * Structure:
 * ```
 * <div id="autofill-review-panel" ...>
 *   <header>N questions need your review</header>
 *   <div class="autofill-question-item">
 *     <p class="autofill-q-label">...</p>
 *     <textarea class="autofill-q-draft">...</textarea>
 *     <div class="autofill-q-actions">
 *       <button class="autofill-accept">Accept</button>
 *       <button class="autofill-ai">Generate with AI</button>
 *     </div>
 *   </div>
 *   ...
 * </div>
 * ```
 *
 * @param {Document} doc
 * @param {{el: Element|null, label: string}[]} questions
 * @param {{onAccept?: (i, answer) => void, onGenerateAI?: (i, label) => void}} callbacks
 * @param {{showAIButton?: boolean}} [options] — showAIButton (default true) controls
 *        whether the "Generate with AI" button is rendered, per settings.showGenerateAIButton
 * @returns {Element}
 */
export function createReviewPanel(doc, questions, callbacks = {}, options = {}) {
  const { onAccept, onGenerateAI } = callbacks;
  const { showAIButton = true } = options;

  // Remove any existing panel (idempotent)
  const existing = doc.getElementById(PANEL_ID);
  if (existing) existing.remove();

  const panel = doc.createElement('div');
  panel.id = PANEL_ID;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Open questions review panel');

  // Header
  const header = doc.createElement('header');
  const n = questions.length;
  header.textContent = `${n} question${n !== 1 ? 's' : ''} need your review`;
  panel.appendChild(header);

  // Question items
  questions.forEach((q, i) => {
    const item = doc.createElement('div');
    item.className = 'autofill-question-item';
    item.dataset.index = String(i);

    // Question label
    const labelEl = doc.createElement('p');
    labelEl.className = 'autofill-q-label';
    labelEl.textContent = q.label;
    item.appendChild(labelEl);

    // Draft textarea
    const draft = doc.createElement('textarea');
    draft.className = 'autofill-q-draft';
    draft.rows = 4;
    draft.setAttribute('placeholder', 'Your answer…');
    item.appendChild(draft);

    // Action buttons
    const actions = doc.createElement('div');
    actions.className = 'autofill-q-actions';

    const acceptBtn = doc.createElement('button');
    acceptBtn.type = 'button';
    acceptBtn.className = 'autofill-accept';
    acceptBtn.textContent = 'Accept';
    acceptBtn.addEventListener('click', () => {
      if (typeof onAccept === 'function') {
        onAccept(i, draft.value);
      }
    });
    actions.appendChild(acceptBtn);

    if (showAIButton) {
      const aiBtn = doc.createElement('button');
      aiBtn.type = 'button';
      aiBtn.className = 'autofill-ai';
      aiBtn.textContent = 'Generate with AI';
      aiBtn.addEventListener('click', () => {
        if (typeof onGenerateAI === 'function') {
          onGenerateAI(i, q.label);
        }
      });
      actions.appendChild(aiBtn);
    }

    item.appendChild(actions);
    panel.appendChild(item);
  });

  return panel;
}

// ─── Generate with AI button handler ─────────────────────────────────────────

const MSG_AI_REQUEST = 'AUTOFILL_AI_REQUEST';

/**
 * Handle the "Generate with AI" button click for a single open question.
 *
 * Flow:
 *  1. Disable the button + show loading state.
 *  2. Send AUTOFILL_AI_REQUEST to the background service worker via sendMessage.
 *  3. On success: populate the draft textarea with the AI-generated text.
 *  4. On error: show the error in statusEl.
 *  5. Re-enable the button.
 *
 * @param {object} opts
 * @param {string}      opts.question       — question label text
 * @param {Element}     opts.draftTextarea  — the textarea to populate
 * @param {Element}     opts.aiButton       — the Generate with AI button
 * @param {Element}     [opts.statusEl]     — optional status/error text element
 * @param {object}      opts.profile        — user profile for context
 * @param {object}      opts.settings       — AI provider settings
 * @param {Function}    opts.sendMessage    — async function mirroring chrome.runtime.sendMessage
 */
export async function handleGenerateAI({
  question,
  draftTextarea,
  aiButton,
  statusEl,
  profile,
  settings,
  sendMessage,
}) {
  // Loading state
  if (aiButton) {
    aiButton.disabled = true;
    aiButton.textContent = 'Generating…';
  }
  if (statusEl) statusEl.textContent = '';

  try {
    const response = await sendMessage({
      type: MSG_AI_REQUEST,
      question,
      label: question,
      profile,
      settings,
    });

    if (response && response.error) {
      if (statusEl) statusEl.textContent = `Error: ${response.error}`;
    } else if (response && response.draft) {
      if (draftTextarea) draftTextarea.value = response.draft;
    }
  } catch (err) {
    if (statusEl) statusEl.textContent = err.message || String(err);
  } finally {
    // Re-enable button
    if (aiButton) {
      aiButton.disabled = false;
      aiButton.textContent = 'Generate with AI';
    }
  }
}
