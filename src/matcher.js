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
// (to be added in P1.2)

// ─── P1.3+ — classifyField ───────────────────────────────────────────────────
// (to be added in P1.3+)
