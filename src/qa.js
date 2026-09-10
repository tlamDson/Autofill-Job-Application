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

// ─── savedAnswers cache ───────────────────────────────────────────────────────

const DEFAULT_SIMILARITY_THRESHOLD = 0.5;

/**
 * Save a question+answer pair into the savedAnswers store.
 * Keyed by `questionFingerprint`. Does not mutate the input object.
 *
 * @param {string} question
 * @param {string} answer
 * @param {object} savedAnswers  — current store (fingerprint → {question, answer})
 * @returns {object}             — new savedAnswers with the entry added/updated
 */
export function saveAnswer(question, answer, savedAnswers) {
  const fp = questionFingerprint(question);
  return {
    ...savedAnswers,
    [fp]: { question, answer },
  };
}

/**
 * Look up the best matching cached answer for a question.
 *
 * Algorithm:
 *  1. Exact fingerprint match → score 1.0 (fast path).
 *  2. Otherwise scan all entries and pick the highest Jaccard similarity.
 *  3. If best score < threshold → return null (no useful match).
 *
 * @param {string} question
 * @param {object} savedAnswers
 * @param {number} [threshold=0.5]
 * @returns {{answer: string, score: number} | null}
 */
export function lookupAnswer(question, savedAnswers, threshold = DEFAULT_SIMILARITY_THRESHOLD) {
  if (!savedAnswers || Object.keys(savedAnswers).length === 0) return null;

  // Exact fingerprint match
  const fp = questionFingerprint(question);
  if (savedAnswers[fp]) {
    return { answer: savedAnswers[fp].answer, score: 1.0 };
  }

  // Fuzzy scan
  let bestScore = 0;
  let bestAnswer = null;

  for (const entry of Object.values(savedAnswers)) {
    const score = questionSimilarity(question, entry.question);
    if (score > bestScore) {
      bestScore = score;
      bestAnswer = entry.answer;
    }
  }

  if (bestScore >= threshold) {
    return { answer: bestAnswer, score: bestScore };
  }

  return null;
}

// ─── fillOpenQuestion ─────────────────────────────────────────────────────────

/**
 * Fill a textarea or text input from the savedAnswers cache.
 *
 * @param {HTMLElement} inputEl       — the textarea or input element
 * @param {string}      question      — the label text for this field
 * @param {object}      savedAnswers
 * @param {number}      [threshold]
 * @returns {boolean}  true if filled, false if no cache hit
 */
export function fillOpenQuestion(inputEl, question, savedAnswers, threshold) {
  if (!inputEl || !question) return false;

  const hit = lookupAnswer(question, savedAnswers, threshold);
  if (!hit) return false;

  // Use setNativeValue pattern inline (qa.js avoids importing filler.js to stay pure)
  const proto = inputEl.constructor?.prototype ?? Object.getPrototypeOf(inputEl);
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
  if (descriptor && descriptor.set) {
    descriptor.set.call(inputEl, hit.answer);
  } else {
    inputEl.value = hit.answer;
  }
  inputEl.dispatchEvent(new Event('input', { bubbles: true }));
  inputEl.dispatchEvent(new Event('change', { bubbles: true }));

  return true;
}
