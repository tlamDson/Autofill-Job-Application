/**
 * src/ats/detectATS.js — ATS detection registry
 *
 * Determines which ATS adapter to use for the current page.
 * Detection is based on:
 *  1. URL pattern matching (fastest, most reliable)
 *  2. DOM signal matching (fallback for embedded ATSes)
 *
 * Exported API:
 *   detectATS({ url, bodyHtml }) → 'greenhouse'|'lever'|'workday'|'icims'|'ashby'|'smartrecruiters'|null
 */

/**
 * Each entry: { id, urlPatterns, domPatterns }
 * - urlPatterns: array of RegExp tested against the page URL
 * - domPatterns: array of CSS selectors or attr tests against bodyHtml
 */
const ATS_REGISTRY = [
  {
    id: 'greenhouse',
    urlPatterns: [
      /\bboards\.greenhouse\.io\b/,
      /\bjob-boards\.greenhouse\.io\b/,
      /\bghio\.io\b/,
    ],
    domSignals: [
      // Greenhouse uses data-gh-input on its inputs
      /data-gh-input/,
      // Greenhouse job board meta tag
      /greenhouse-job-board/,
    ],
  },
  {
    id: 'lever',
    urlPatterns: [
      /\bjobs\.lever\.co\b/,
    ],
    domSignals: [
      /\blever-form\b/,
      /\blever-button\b/,
      /data-lever-/,
    ],
  },
  {
    id: 'workday',
    urlPatterns: [
      /\bmyworkdayjobs\.com\b/,
      /\bworkday\.com\b.*\/jobs?\b/,
    ],
    domSignals: [
      /data-automation-id=/,
    ],
  },
  {
    id: 'icims',
    urlPatterns: [
      /\bicims\.com\b/,
      /\bicimscandidateportal\.com\b/,
    ],
    domSignals: [
      /icims-/,
    ],
  },
  {
    id: 'ashby',
    urlPatterns: [
      /\bjobs\.ashbyhq\.com\b/,
      /\bashbyhq\.com\b/,
    ],
    domSignals: [
      /ashby-application/,
    ],
  },
  {
    id: 'smartrecruiters',
    urlPatterns: [
      /\bjobs\.smartrecruiters\.com\b/,
      /\bsmartrecruiters\.com\b/,
    ],
    domSignals: [
      /smartrecruiters/,
    ],
  },
];

/**
 * Detect which ATS is being used on a page.
 *
 * @param {{ url: string, bodyHtml?: string }} ctx
 * @returns {string|null} ATS id or null if unknown
 */
export function detectATS({ url = '', bodyHtml = '' } = {}) {
  for (const ats of ATS_REGISTRY) {
    // 1. URL pattern check (fastest)
    if (ats.urlPatterns.some((re) => re.test(url))) {
      return ats.id;
    }

    // 2. DOM signal check (fallback for embedded ATSes)
    if (bodyHtml && ats.domSignals.some((re) => re.test(bodyHtml))) {
      return ats.id;
    }
  }

  return null;
}

/**
 * Convenience: build context from the current browser tab.
 * Call this from content.js when you have access to `document`.
 *
 * @param {Document} doc
 * @returns {{ url: string, bodyHtml: string }}
 */
export function buildATSContext(doc) {
  return {
    url: doc?.location?.href || (typeof location !== 'undefined' ? location.href : ''),
    bodyHtml: doc?.body?.innerHTML || '',
  };
}
