/**
 * src/qa.js — Question fingerprinting + similarity for savedAnswers cache
 *
 * Purpose:
 *  - `questionFingerprint(text)`: normalize + produce stable key for a question
 *  - `questionSimilarity(a, b)`: score [0,1] for how similar two questions are
 *
 * Used by the complex-answer router (P4.2) to look up cached answers before
 * prompting AI.
 *
 * Design constraints:
 *  - Pure functions (no DOM, no async) — safe for jsdom unit tests
 *  - No external dependencies (runs in content script MAIN world)
 *  - Similarity uses token-overlap (Jaccard), which is fast and good enough
 *    for job application questions (typically 5–30 words)
 */

// ─── Normalization ────────────────────────────────────────────────────────────

/**
 * Normalize a question string for stable comparison/hashing.
 *  1. Trim whitespace
 *  2. Lowercase
 *  3. Collapse internal whitespace → single spaces
 *  4. Strip trailing punctuation (. ? ! ,)
 *
 * @param {string} text
 * @returns {string}
 */
function normalize(text) {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.?!,]+$/g, '')
    .trim();
}

// ─── Fingerprint ──────────────────────────────────────────────────────────────

/**
 * Produce a stable fingerprint (string) for a question.
 *
 * Uses a simple djb2-style hash converted to hex — compact and deterministic
 * across JS environments without requiring crypto APIs.
 *
 * @param {string} text
 * @returns {string}  hex string, e.g. "1a2b3c4d"
 */
export function questionFingerprint(text) {
  const norm = normalize(text);
  // djb2 hash
  let hash = 5381;
  for (let i = 0; i < norm.length; i++) {
    // (hash << 5) + hash + charCode  — keep as 32-bit integer via bitwise OR
    hash = ((hash << 5) + hash + norm.charCodeAt(i)) | 0;
  }
  // Convert signed 32-bit to unsigned hex
  return (hash >>> 0).toString(16);
}

// ─── Tokenizer ────────────────────────────────────────────────────────────────

// Common English stop-words to exclude from similarity tokens
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have',
  'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'may', 'might', 'can', 'this', 'that', 'these', 'those', 'it', 'its',
  'you', 'your', 'we', 'our', 'they', 'their', 'us', 'not', 'no', 'if',
  'how', 'what', 'why', 'when', 'where', 'who', 'which', 'about', 'as',
]);

/**
 * Tokenize a normalized question into meaningful word tokens.
 * Removes stop-words, punctuation, and very short words (≤1 char).
 *
 * @param {string} text
 * @returns {Set<string>}
 */
function tokenize(text) {
  const norm = normalize(text);
  const tokens = norm
    .split(/\W+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
  return new Set(tokens);
}

// ─── Similarity ───────────────────────────────────────────────────────────────

/**
 * Compute Jaccard similarity between two questions.
 * Score: |intersection| / |union| — 0.0 (no overlap) to 1.0 (identical).
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}  [0, 1]
 */
export function questionSimilarity(a, b) {
  const setA = tokenize(a);
  const setB = tokenize(b);

  if (setA.size === 0 && setB.size === 0) return 1.0;
  if (setA.size === 0 || setB.size === 0) return 0.0;

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return intersection / union;
}
