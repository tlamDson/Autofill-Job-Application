/**
 * test/qa.test.js — P4.1 questionFingerprint + similarity
 *
 * Tests question fingerprinting (normalize + hash) and similarity scoring
 * for matching open-ended questions across job applications.
 */

import { describe, it, expect } from 'vitest';
import { questionFingerprint, questionSimilarity } from '../src/qa.js';

// ─── questionFingerprint ──────────────────────────────────────────────────────

describe('questionFingerprint', () => {
  it('normalizes whitespace', () => {
    const a = questionFingerprint('Why  do   you want  to join us?');
    const b = questionFingerprint('Why do you want to join us?');
    expect(a).toBe(b);
  });

  it('normalizes case', () => {
    const a = questionFingerprint('Why do you want to JOIN US?');
    const b = questionFingerprint('why do you want to join us?');
    expect(a).toBe(b);
  });

  it('strips leading/trailing whitespace', () => {
    const a = questionFingerprint('  What are your greatest strengths?  ');
    const b = questionFingerprint('What are your greatest strengths?');
    expect(a).toBe(b);
  });

  it('strips trailing punctuation', () => {
    const a = questionFingerprint('Tell us about yourself.');
    const b = questionFingerprint('Tell us about yourself');
    expect(a).toBe(b);
  });

  it('produces different fingerprints for different questions', () => {
    const a = questionFingerprint('Why do you want to join us?');
    const b = questionFingerprint('What are your greatest strengths?');
    expect(a).not.toBe(b);
  });

  it('returns a non-empty string', () => {
    const fp = questionFingerprint('What is your experience with React?');
    expect(typeof fp).toBe('string');
    expect(fp.length).toBeGreaterThan(0);
  });

  it('handles empty string without throwing', () => {
    const fp = questionFingerprint('');
    expect(typeof fp).toBe('string');
  });
});

// ─── questionSimilarity ───────────────────────────────────────────────────────

describe('questionSimilarity', () => {
  it('returns 1.0 for identical questions', () => {
    const score = questionSimilarity(
      'Why do you want to work here?',
      'Why do you want to work here?'
    );
    expect(score).toBeCloseTo(1.0);
  });

  it('returns 1.0 for questions that differ only by case/whitespace', () => {
    const score = questionSimilarity(
      'Why do you want to work here?',
      'WHY DO YOU WANT TO WORK HERE?'
    );
    expect(score).toBeCloseTo(1.0);
  });

  it('returns a high score for very similar questions', () => {
    const score = questionSimilarity(
      'Why do you want to join our company?',
      'Why would you like to join our company?'
    );
    expect(score).toBeGreaterThan(0.4);
  });

  it('returns a low score for completely different questions', () => {
    const score = questionSimilarity(
      'Tell us about yourself.',
      'What is your expected salary?'
    );
    expect(score).toBeLessThan(0.5);
  });

  it('returns a score between 0 and 1', () => {
    const score = questionSimilarity(
      'Describe a challenge you overcame.',
      'What motivates you?'
    );
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('is symmetric (a,b) == (b,a)', () => {
    const q1 = 'Why do you want to work here?';
    const q2 = 'What are your greatest strengths?';
    expect(questionSimilarity(q1, q2)).toBeCloseTo(questionSimilarity(q2, q1));
  });
});
