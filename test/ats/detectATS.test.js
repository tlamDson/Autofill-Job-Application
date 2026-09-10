/**
 * test/ats/detectATS.test.js — P2.1 detectATS registry
 *
 * Tests the ATS detection function that inspects a page URL / DOM signals
 * to determine which ATS adapter to use.
 */

import { describe, it, expect } from 'vitest';
import { detectATS } from '../../src/ats/detectATS.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a minimal document-like context with a URL and optional body HTML.
 */
function makeCtx(url, bodyHtml = '') {
  return { url, bodyHtml };
}

// ─── Greenhouse ───────────────────────────────────────────────────────────────

describe('detectATS — Greenhouse', () => {
  it('detects boards.greenhouse.io URL', () => {
    expect(detectATS(makeCtx('https://boards.greenhouse.io/acme/jobs/1234'))).toBe('greenhouse');
  });

  it('detects job-boards.greenhouse.io URL', () => {
    expect(detectATS(makeCtx('https://job-boards.greenhouse.io/acme/jobs/5678'))).toBe('greenhouse');
  });

  it('detects greenhouse via data-gh-input attribute in DOM', () => {
    expect(detectATS(makeCtx('https://example.com/careers/apply', '<input data-gh-input="true" />'))).toBe('greenhouse');
  });
});

// ─── Lever ────────────────────────────────────────────────────────────────────

describe('detectATS — Lever', () => {
  it('detects jobs.lever.co URL', () => {
    expect(detectATS(makeCtx('https://jobs.lever.co/acme/abc-123/apply'))).toBe('lever');
  });

  it('detects lever via lever-specific input class', () => {
    expect(detectATS(makeCtx('https://example.com', '<form class="lever-form"><input /></form>'))).toBe('lever');
  });
});

// ─── Workday ─────────────────────────────────────────────────────────────────

describe('detectATS — Workday', () => {
  it('detects myworkdayjobs.com URL', () => {
    expect(detectATS(makeCtx('https://acme.wd1.myworkdayjobs.com/en-US/jobs/job/123'))).toBe('workday');
  });

  it('detects workday.com URL', () => {
    expect(detectATS(makeCtx('https://wd3.myworkdayjobs.com/acme'))).toBe('workday');
  });

  it('detects workday via data-automation-id in DOM', () => {
    expect(detectATS(makeCtx('https://example.com', '<div data-automation-id="legalNameSection"></div>'))).toBe('workday');
  });
});

// ─── iCIMS ───────────────────────────────────────────────────────────────────

describe('detectATS — iCIMS', () => {
  it('detects icims.com URL', () => {
    expect(detectATS(makeCtx('https://careers-acme.icims.com/jobs/apply'))).toBe('icims');
  });
});

// ─── Ashby ───────────────────────────────────────────────────────────────────

describe('detectATS — Ashby', () => {
  it('detects jobs.ashbyhq.com URL', () => {
    expect(detectATS(makeCtx('https://jobs.ashbyhq.com/acme/123/application'))).toBe('ashby');
  });
});

// ─── SmartRecruiters ─────────────────────────────────────────────────────────

describe('detectATS — SmartRecruiters', () => {
  it('detects jobs.smartrecruiters.com URL', () => {
    expect(detectATS(makeCtx('https://jobs.smartrecruiters.com/acme/1234'))).toBe('smartrecruiters');
  });
});

// ─── Unknown ─────────────────────────────────────────────────────────────────

describe('detectATS — unknown', () => {
  it('returns null for unrecognised URL', () => {
    expect(detectATS(makeCtx('https://random-company.com/apply'))).toBeNull();
  });

  it('returns null for empty context', () => {
    expect(detectATS(makeCtx(''))).toBeNull();
  });
});
