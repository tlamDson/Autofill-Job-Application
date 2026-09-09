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

  // 5. sectionHint — look for nearest section heading to distinguish edu vs work
  const sectionHint = _detectSection(el);

  return { attrs, labelText, nearbyText, sectionHint };
}

/**
 * Detect section context by scanning ancestor headings.
 * @param {HTMLElement} el
 * @returns {'education'|'workHistory'|null}
 */
function _detectSection(el) {
  let node = el.parentElement;
  for (let depth = 0; depth < 10; depth++) {
    if (!node) break;
    const text = (node.getAttribute('data-section') ||
                  node.querySelector('h1,h2,h3,h4,legend')?.textContent || '').toLowerCase();
    if (/education|school|university|degree/.test(text)) return 'education';
    if (/experience|employment|work\s*history|position/.test(text)) return 'workHistory';
    node = node.parentElement;
  }
  return null;
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
  // ── Address group (P1.4) — before identity to avoid conflicts ──
  // phoneCountryCode — before country rule
  {
    key: 'phoneCountryCode',
    test: (ctx) => {
      const n = ctx.attrs.name || '';
      const t = _ctxText(ctx);
      return (/country\s*code/i.test(t) && (/phone|tel|mobile/.test(t) || /phone|tel|mobile/.test(n))) ||
             /phone[_-]?country[_-]?code|country[_-]?code[_-]?phone/i.test(n);
    },
  },
  // addressLine2 — more specific than addressLine1
  {
    key: 'addressLine2',
    test: (ctx) => {
      const t = _ctxText(ctx);
      const n = ctx.attrs.name || '';
      const ac = ctx.attrs.autocomplete || '';
      return /address\s*(line\s*)?2|apt\.?|apartment|suite|unit|floor/i.test(t) ||
             /address[_-]?line[_-]?2|addr2|apt|suite/i.test(n) ||
             ac === 'address-line2';
    },
  },
  // addressLine1
  {
    key: 'addressLine1',
    test: (ctx) => {
      const t = _ctxText(ctx);
      const n = ctx.attrs.name || '';
      const ac = ctx.attrs.autocomplete || '';
      // Don't match "email address" or "email confirmation" etc.
      if (/\bemail\b/.test(t) || (ctx.attrs.type || '') === 'email') return false;
      return /street\s*address|address\s*(line\s*)?1|\baddress\b/i.test(t) ||
             /address[_-]?line[_-]?1|addr1|street/i.test(n) ||
             ac === 'address-line1';
    },
  },
  // city
  {
    key: 'city',
    test: (ctx) => {
      const t = _ctxText(ctx);
      const n = ctx.attrs.name || '';
      const ac = ctx.attrs.autocomplete || '';
      return /\bcity\b|town|municipality/i.test(t) ||
             /\bcity\b|town/i.test(n) ||
             ac === 'address-level2';
    },
  },
  // state
  {
    key: 'state',
    test: (ctx) => {
      const t = _ctxText(ctx);
      const n = ctx.attrs.name || '';
      const ac = ctx.attrs.autocomplete || '';
      return /\bstate\b|province|region/i.test(t) ||
             /\bstate\b|province/i.test(n) ||
             ac === 'address-level1';
    },
  },
  // postalCode
  {
    key: 'postalCode',
    test: (ctx) => {
      const t = _ctxText(ctx);
      const n = ctx.attrs.name || '';
      const ac = ctx.attrs.autocomplete || '';
      return /postal\s*code|zip\s*code|\bzip\b/i.test(t) ||
             /postal|zip[_-]?code/i.test(n) ||
             ac === 'postal-code';
    },
  },
  // country — after phoneCountryCode rule
  {
    key: 'country',
    test: (ctx) => {
      const t = _ctxText(ctx);
      const n = ctx.attrs.name || '';
      const ac = ctx.attrs.autocomplete || '';
      // Don't match "country code" for phone (handled by phoneCountryCode rule above)
      if (/country\s*code/i.test(t) && /phone|tel|mobile/.test(t)) return false;
      return /\bcountry\b/i.test(t) ||
             /\bcountry\b/i.test(n) ||
             ac === 'country' || ac === 'country-name';
    },
  },
  // ── WorkAuth group (P1.7) ─────────────────────────────────────
  {
    key: 'needsSponsorship',
    test: (ctx) => {
      const t = _ctxText(ctx);
      return /sponsorship|require\s*visa|visa\s*required/i.test(t);
    },
  },
  {
    key: 'authorizedToWork',
    test: (ctx) => {
      const t = _ctxText(ctx);
      return /authorized?\s*to\s*work|legally\s*authorized|right\s*to\s*work/i.test(t);
    },
  },
  {
    key: 'visaStatus',
    test: (ctx) => {
      const t = _ctxText(ctx);
      return /\bvisa\b|work\s*authorization\s*status|immigration\s*status/i.test(t);
    },
  },
  // ── EEO group (P1.7) ───────────────────────────────────────────
  {
    key: 'hispanicLatino',
    test: (ctx) => /hispanic|latino/i.test(_ctxText(ctx)),
  },
  {
    key: 'gender',
    test: (ctx) => /\bgender\b|sex\b/i.test(_ctxText(ctx)),
  },
  {
    key: 'race',
    test: (ctx) => /\brace\b|ethnicity/i.test(_ctxText(ctx)),
  },
  {
    key: 'veteranStatus',
    test: (ctx) => /veteran|military\s*status/i.test(_ctxText(ctx)),
  },
  {
    key: 'disabilityStatus',
    test: (ctx) => /disabilit/i.test(_ctxText(ctx)),
  },
  // ── Compensation group (P1.7) ──────────────────────────────────
  {
    key: 'noticePeriod',
    test: (ctx) => {
      const t = _ctxText(ctx);
      return /notice\s*period|earliest\s*start\s*date|when\s*can\s*you\s*start/i.test(t);
    },
  },
  {
    key: 'desiredSalary',
    test: (ctx) => {
      const t = _ctxText(ctx);
      return /desired\s*salary|expected\s*(salary|compensation|pay)|salary\s*expectation/i.test(t);
    },
  },
  // ── Education group (P1.6) — sectionHint='education' preferred ─
  {
    key: 'school',
    test: (ctx) => {
      const t = _ctxText(ctx);
      const n = ctx.attrs.name || '';
      return ctx.sectionHint === 'education' &&
             (/\bschool\b|university|college|institution/i.test(t) || /school|university/i.test(n));
    },
  },
  {
    key: 'degree',
    test: (ctx) => {
      const t = _ctxText(ctx);
      return ctx.sectionHint === 'education' &&
             /\bdegree\b|level\s*of\s*education/i.test(t);
    },
  },
  {
    key: 'fieldOfStudy',
    test: (ctx) => {
      const t = _ctxText(ctx);
      return ctx.sectionHint === 'education' &&
             /field\s*of\s*study|major|discipline|concentration/i.test(t);
    },
  },
  {
    key: 'gpa',
    test: (ctx) => {
      const t = _ctxText(ctx);
      return /\bgpa\b|grade\s*point\s*average/i.test(t);
    },
  },
  {
    key: 'eduStartDate',
    test: (ctx) => {
      const t = _ctxText(ctx);
      return ctx.sectionHint === 'education' && /start\s*date|\bfrom\b/i.test(t);
    },
  },
  {
    key: 'eduEndDate',
    test: (ctx) => {
      const t = _ctxText(ctx);
      return ctx.sectionHint === 'education' &&
             /end\s*date|graduation|to\b|through\b/i.test(t);
    },
  },
  // ── workHistory group (P1.6) ────────────────────────────────────
  {
    key: 'company',
    test: (ctx) => {
      const t = _ctxText(ctx);
      const n = ctx.attrs.name || '';
      return ctx.sectionHint === 'workHistory' &&
             (/\bcompany\b|employer|organization/i.test(t) || /company|employer/i.test(n));
    },
  },
  {
    key: 'jobTitle',
    test: (ctx) => {
      const t = _ctxText(ctx);
      return ctx.sectionHint === 'workHistory' &&
             /job\s*title|position|role|title/i.test(t);
    },
  },
  {
    key: 'workStartDate',
    test: (ctx) => {
      const t = _ctxText(ctx);
      return ctx.sectionHint === 'workHistory' && /start\s*date|\bfrom\b/i.test(t);
    },
  },
  {
    key: 'workEndDate',
    test: (ctx) => {
      const t = _ctxText(ctx);
      return ctx.sectionHint === 'workHistory' && /end\s*date|to\b|through\b/i.test(t);
    },
  },
  {
    key: 'jobDescription',
    test: (ctx) => {
      const t = _ctxText(ctx);
      return ctx.sectionHint === 'workHistory' &&
             /description|responsibilities|duties|summary/i.test(t);
    },
  },
  {
    key: 'workLocation',
    test: (ctx) => {
      const t = _ctxText(ctx);
      return ctx.sectionHint === 'workHistory' && /\blocation\b/i.test(t);
    },
  },
  // ── Links group (P1.5) ─────────────────────────────────────────
  {
    key: 'linkedin',
    test: (ctx) => {
      const t = _ctxText(ctx);
      const n = ctx.attrs.name || '';
      return /linkedin/i.test(t) || /linkedin/i.test(n);
    },
  },
  {
    key: 'github',
    test: (ctx) => {
      const t = _ctxText(ctx);
      const n = ctx.attrs.name || '';
      return /github/i.test(t) || /github/i.test(n);
    },
  },
  {
    key: 'portfolio',
    test: (ctx) => {
      const t = _ctxText(ctx);
      const n = ctx.attrs.name || '';
      return /portfolio|work\s*sample/i.test(t) || /portfolio/i.test(n);
    },
  },
  {
    key: 'website',
    test: (ctx) => {
      const t = _ctxText(ctx);
      const n = ctx.attrs.name || '';
      // Negative: company website should not fill candidate's personal website
      if (/company|employer|organization/i.test(t) || /company|employer/i.test(n)) return false;
      return /\bwebsite\b|personal\s*site|homepage/i.test(t) || /\bwebsite\b|homepage/i.test(n);
    },
  },
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
