/**
 * src/logger.js — Unclassified field logger + log viewer
 *
 * P7.1: Log fields that `classifyField()` returned null for. This data
 *   feeds a feedback loop: review which fields aren't being matched, then
 *   improve the regex rules in matcher.js accordingly.
 *
 * P7.2: A log viewer DOM component for the Options page to display entries.
 *
 * Design:
 *  - In-memory log (module-level array) for the current session.
 *  - persistLog/loadLog for optional chrome.storage.local persistence.
 *  - renderLogViewer creates the Options-page DOM table.
 *
 * Exported API:
 *   logUnclassified({label, name, url}) — add entry
 *   getLog() → entry[]
 *   clearLog()
 *   persistLog(storage) → Promise<void>
 *   loadLog(storage) → Promise<void>
 *   renderLogViewer(doc, entries) → Element
 */

// ─── In-memory log ────────────────────────────────────────────────────────────

/** @type {{label: string, name: string, url: string, timestamp: number}[]} */
let _log = [];

const STORAGE_KEY = 'autofill_unclassified_log';
const MAX_LOG_SIZE = 500; // cap to avoid unbounded growth

/**
 * Log an unclassified field.
 *
 * @param {{label: string, name: string, url: string}} field
 */
export function logUnclassified({ label = '', name = '', url = '' } = {}) {
  _log.push({ label, name, url, timestamp: Date.now() });
  // Trim if over cap
  if (_log.length > MAX_LOG_SIZE) {
    _log = _log.slice(-MAX_LOG_SIZE);
  }
}

/**
 * Get the current log (shallow copy).
 * @returns {{label: string, name: string, url: string, timestamp: number}[]}
 */
export function getLog() {
  return [..._log];
}

/**
 * Clear all log entries.
 */
export function clearLog() {
  _log = [];
}

// ─── Persistence ──────────────────────────────────────────────────────────────

/**
 * Save the current log to chrome.storage.local (or any storage-like object).
 *
 * @param {object} storage  — { set(data) } interface (e.g. chrome.storage.local)
 * @returns {Promise<void>}
 */
export async function persistLog(storage) {
  await storage.set({ [STORAGE_KEY]: _log });
}

/**
 * Load the log from storage into the in-memory array.
 *
 * @param {object} storage  — { get(key) → {key: value} } interface
 * @returns {Promise<void>}
 */
export async function loadLog(storage) {
  const result = await storage.get(STORAGE_KEY);
  if (result && Array.isArray(result[STORAGE_KEY])) {
    _log = result[STORAGE_KEY];
  }
}

// ─── Log viewer DOM ───────────────────────────────────────────────────────────

/**
 * Build the log viewer element for the Options page.
 *
 * @param {Document}  doc
 * @param {object[]}  entries  — log entries (from getLog())
 * @returns {Element}
 */
export function renderLogViewer(doc, entries = []) {
  const container = doc.createElement('div');
  container.id = 'autofill-log-viewer';

  // Header
  const header = doc.createElement('h3');
  header.textContent = 'Unclassified Fields Log';
  container.appendChild(header);

  // Clear button
  const clearBtn = doc.createElement('button');
  clearBtn.type = 'button';
  clearBtn.textContent = 'Clear Log';
  clearBtn.addEventListener('click', () => {
    clearLog();
    // Re-render in-place
    const table = container.querySelector('table');
    const empty = container.querySelector('.autofill-log-empty');
    if (table) table.remove();
    if (empty) empty.remove();
    container.appendChild(buildContent(doc, []));
  });
  container.appendChild(clearBtn);

  container.appendChild(buildContent(doc, entries));
  return container;
}

/**
 * Build the content (empty notice or table) for the log viewer.
 *
 * @param {Document} doc
 * @param {object[]} entries
 * @returns {Element}
 */
function buildContent(doc, entries) {
  if (!entries || entries.length === 0) {
    const empty = doc.createElement('p');
    empty.className = 'autofill-log-empty';
    empty.textContent = 'No unclassified fields logged yet.';
    return empty;
  }

  const table = doc.createElement('table');
  table.setAttribute('role', 'grid');

  // Header row
  const thead = doc.createElement('thead');
  const headerRow = doc.createElement('tr');
  ['Label', 'Name attr', 'URL', 'Time'].forEach((col) => {
    const th = doc.createElement('th');
    th.textContent = col;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body
  const tbody = doc.createElement('tbody');
  for (const entry of entries) {
    const row = doc.createElement('tr');

    const tdLabel = doc.createElement('td');
    tdLabel.textContent = entry.label || '—';
    row.appendChild(tdLabel);

    const tdName = doc.createElement('td');
    tdName.textContent = entry.name || '—';
    row.appendChild(tdName);

    const tdUrl = doc.createElement('td');
    // Show host only to keep it brief
    try {
      tdUrl.textContent = new URL(entry.url).hostname;
    } catch {
      tdUrl.textContent = entry.url || '—';
    }
    row.appendChild(tdUrl);

    const tdTime = doc.createElement('td');
    tdTime.textContent = entry.timestamp
      ? new Date(entry.timestamp).toLocaleTimeString()
      : '—';
    row.appendChild(tdTime);

    tbody.appendChild(row);
  }
  table.appendChild(tbody);

  return table;
}
