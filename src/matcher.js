/**
 * matcher.js — Field matching engine: buildContext, stripExample, classifyField.
 * Pure functions — no DOM access (DOM access is in adapters/generic.js).
 * Test with Node/jsdom; no browser required.
 */

// ─── P1.1 — stripExample ─────────────────────────────────────────────────────

/**
 * Known placeholder-only strings that should collapse to empty.
 * Checked after removing example markers.
 */
// Known SPECIFIC placeholder names — only these exact names are cleared
const KNOWN_PLACEHOLDER_NAMES = [
  /^john\s+doe$/i,
  /^jane\s+doe$/i,
  /^nguyen\s+van\s+a$/i,
  /^your\s+name\s+here$/i,
];

/**
 * Regex patterns for example/vd markers that introduce sample text.
 * Ordered from most specific to least specific.
 */
const EXAMPLE_MARKERS = [
  // Parenthetical: "(e.g. ...)", "(VD: ...)", "(ví dụ: ...)"
  /\s*\(\s*(?:e\.?g\.?|eg|example|for example|vd|v\.d\.|ví dụ|vi du)[:\s.,]?[^)]*\)/gi,
  // Prefix patterns at start of string: "e.g. ...", "VD: ...", "Ví dụ: ...", "Example: ...", "For example, ..."
  /^(?:for\s+example[,\s]|example[:\s]|e\.?g\.?[:\s]|eg[:\s]|vd[:\s]|v\.d\.[:\s]|ví dụ[:\s]|vi du[:\s]).*/gi,
  // Inline after dash/em-dash: "Name — e.g. Smith" or "vd: Nguyen"
  /\s*[—–-]\s*(?:e\.?g\.?|eg|example|vd|v\.d\.|ví dụ|vi du)[:\s][^\n]*/gi,
  // "vd:" anywhere in string not in parens (catches "Name vd: Nguyen")
  /\s*\bvd[:\s][^\n]*/gi,
  /\s*\bví dụ[:\s][^\n]*/gi,
  /\s*\bexample[:\s][^\n]*/gi,
];

/**
 * Standalone placeholder strings (whole string) — these are example-only, no label.
 */
const STANDALONE_PLACEHOLDER = [
  /^https?:\/\/[\w./%-]+$/i,
  /^[\w.+-]+@[\w.-]+\.[a-z]{2,}$/i, // email
  /^\+?[\d\s()\-\.]{7,}$/,           // phone
  /^john\s+doe$/i,
  /^jane\s+doe$/i,
  /^your\s+\w+.*$/i,                  // "your name here" type
];

/**
 * Remove example/placeholder text from a label string.
 * Leaves the "real" label portion; returns empty string if the whole
 * string was just an example.
 *
 * @param {string} text
 * @returns {string}
 */
export function stripExample(text) {
  if (!text) return text;

  // Check if whole string is a standalone placeholder
  const trimmed = text.trim();
  for (const re of STANDALONE_PLACEHOLDER) {
    if (re.test(trimmed)) return '';
  }

  let result = text;

  // Apply example marker patterns
  for (const re of EXAMPLE_MARKERS) {
    result = result.replace(re, '');
  }

  result = result.trim();

  // After removal, check for known specific placeholder names
  if (KNOWN_PLACEHOLDER_NAMES.some((r) => r.test(result))) {
    return '';
  }

  return result;
}

// ─── P1.2 — buildContext ─────────────────────────────────────────────────────

/**
 * Relevant HTML attributes to collect from an input element.
 */
const CONTEXT_ATTRS = ['name', 'id', 'placeholder', 'aria-label', 'autocomplete', 'title', 'type'];

/**
 * Build context object for a form field element.
 * Collects: HTML attributes, associated label text, nearby text (th/dt/sibling spans).
 *
 * @param {HTMLElement} el - The input/select/textarea element
 * @returns {{ attrs: Record<string,string>, labelText: string, nearbyText: string }}
 */
export function buildContext(el) {
  const attrs = {};
  for (const attr of CONTEXT_ATTRS) {
    const val = el.getAttribute(attr);
    if (val) attrs[attr] = val;
  }

  let labelText = '';
  let nearbyText = '';

  const doc = el.ownerDocument;

  // 1. label[for=id]
  if (el.id) {
    // Use attribute selector with double quotes; escape only double-quotes in id
    const escapedId = el.id.replace(/"/g, '\\"');
    const label = doc.querySelector(`label[for="${escapedId}"]`);
    if (label) {
      labelText = label.textContent.trim();
    }
  }

  // 2. Wrapping <label>
  if (!labelText) {
    let ancestor = el.parentElement;
    while (ancestor) {
      if (ancestor.tagName === 'LABEL') {
        // Get label text minus the input's own text
        const clone = ancestor.cloneNode(true);
        // Remove any nested inputs to get just the label text
        clone.querySelectorAll('input,select,textarea').forEach((n) => n.remove());
        labelText = clone.textContent.trim();
        break;
      }
      // Stop at form-level boundaries
      if (['FORM', 'FIELDSET', 'BODY'].includes(ancestor.tagName)) break;
      ancestor = ancestor.parentElement;
    }
  }

  // 3. aria-labelledby
  if (!labelText && el.hasAttribute('aria-labelledby')) {
    const ids = el.getAttribute('aria-labelledby').split(/\s+/);
    const parts = ids.map((id) => doc.getElementById(id)?.textContent?.trim()).filter(Boolean);
    if (parts.length) labelText = parts.join(' ');
  }

  // 4. Scan ancestors for nearby text: <th>, <dt>, sibling span/text
  if (!nearbyText) {
    nearbyText = _findNearbyText(el);
  }

  return { attrs, labelText, nearbyText };
}

/**
 * Walk up the DOM (max 5 levels) looking for:
 *   - <th> in the same row
 *   - <dt> sibling in a dl
 *   - sibling text/span before the input
 * @param {HTMLElement} el
 * @returns {string}
 */
function _findNearbyText(el) {
  let node = el;
  for (let depth = 0; depth < 5; depth++) {
    const parent = node.parentElement;
    if (!parent) break;

    // <th> in same <tr>
    if (parent.tagName === 'TR' || parent.tagName === 'TD') {
      const row = parent.closest('tr');
      if (row) {
        const ths = row.querySelectorAll('th');
        if (ths.length) return ths[0].textContent.trim();
      }
    }

    // <dt> sibling (dl layout)
    if (parent.tagName === 'DD') {
      const dt = parent.previousElementSibling;
      if (dt && dt.tagName === 'DT') return dt.textContent.trim();
    }

    // Sibling span/text before the input
    const sibs = Array.from(parent.children);
    const myIdx = sibs.indexOf(node);
    for (let i = myIdx - 1; i >= 0; i--) {
      const sib = sibs[i];
      if (!['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(sib.tagName)) {
        const text = sib.textContent.trim();
        if (text) return text;
      }
    }

    node = parent;
  }
  return '';
}

// ─── P1.3+ — classifyField ───────────────────────────────────────────────────

/**
 * Build a combined text string from context for regex matching.
 * @param {{ attrs: object, labelText: string, nearbyText: string }} ctx
 * @returns {string} lowercase combined text
 */
function _ctxText(ctx) {
  const parts = [
    ctx.labelText,
    ctx.nearbyText,
    ctx.attrs.placeholder || '',
    ctx.attrs.title || '',
  ];
  return parts.join(' ').toLowerCase();
}

/**
 * Ordered classify rules. Each rule: { key, test(ctx) → bool }.
 * Order matters — more specific rules first.
 */
const CLASSIFY_RULES = [
  // ── Identity group (P1.3) ──────────────────────────────────────
  // preferredName — more specific than firstName
  {
    key: 'preferredName',
    test: (ctx) => {
      const t = _ctxText(ctx);
      const n = ctx.attrs.name || '';
      return /prefer|nickname|known\s*as|goes\s*by/.test(t) ||
             /prefer|nickname/.test(n);
    },
  },
  // firstName — must NOT match when "company" is in context
  {
    key: 'firstName',
    test: (ctx) => {
      const t = _ctxText(ctx);
      const n = ctx.attrs.name || '';
      const ac = ctx.attrs.autocomplete || '';
      if (/company|employer|organization|school|university/.test(t)) return false;
      return /first\s*name|given\s*name|first$/i.test(t) ||
             /first[_-]?name|given[_-]?name/i.test(n) ||
             ac === 'given-name';
    },
  },
  // lastName
  {
    key: 'lastName',
    test: (ctx) => {
      const t = _ctxText(ctx);
      const n = ctx.attrs.name || '';
      const ac = ctx.attrs.autocomplete || '';
      if (/company|employer|organization/.test(t)) return false;
      return /last\s*name|family\s*name|surname|last$/i.test(t) ||
             /last[_-]?name|family[_-]?name|surname/i.test(n) ||
             ac === 'family-name';
    },
  },
  // fullName — only when "full name" or autocomplete=name, NOT when company/school
  {
    key: 'fullName',
    test: (ctx) => {
      const t = _ctxText(ctx);
      const n = ctx.attrs.name || '';
      const ac = ctx.attrs.autocomplete || '';
      if (/company|employer|organization|school|university|job|position/.test(t)) return false;
      return /full\s*name|your\s*name\b/i.test(t) ||
             /\bfull[_-]?name\b/i.test(n) ||
             ac === 'name';
    },
  },
  // email
  {
    key: 'email',
    test: (ctx) => {
      const t = _ctxText(ctx);
      const n = ctx.attrs.name || '';
      const ac = ctx.attrs.autocomplete || '';
      const type = ctx.attrs.type || '';
      return /\bemail\b/.test(t) ||
             /\bemail\b/i.test(n) ||
             ac === 'email' ||
             type === 'email';
    },
  },
  // phone
  {
    key: 'phone',
    test: (ctx) => {
      const t = _ctxText(ctx);
      const n = ctx.attrs.name || '';
      const ac = ctx.attrs.autocomplete || '';
      const type = ctx.attrs.type || '';
      // Must have "phone" or "mobile" or "tel" somewhere in context
      if (!/phone|mobile|telephone|\btel\b/.test(t) &&
          !/phone|mobile|tel/.test(n) &&
          ac !== 'tel' && type !== 'tel') return false;
      // Negative: pure "type" field with no phone context in label AND no phone in name
      if (/\btype\b/.test(t) &&
          !/phone|mobile|tel/.test(t.replace(/\btype\b/, '')) &&
          !/phone|mobile|tel/.test(n)) return false;
      return true;
    },
  },
];

/**
 * Classify a form field into a profile key.
 * Runs CLASSIFY_RULES in order; first match wins.
 *
 * @param {{ attrs: Record<string,string>, labelText: string, nearbyText: string }} ctx
 * @returns {string|null} profile key or null if unrecognized
 */
export function classifyField(ctx) {
  for (const rule of CLASSIFY_RULES) {
    if (rule.test(ctx)) return rule.key;
  }
  return null;
}
