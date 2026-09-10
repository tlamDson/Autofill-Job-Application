/**
 * test/qa-cache.test.js — P4.2 Fill từ savedAnswers cache
 *
 * Tests the question cache lookup and fill logic:
 *   - lookupAnswer(question, savedAnswers, threshold) → {answer, score} | null
 *   - saveAnswer(question, answer, savedAnswers) → updatedSavedAnswers
 *   - fillOpenQuestion(fieldEl, question, savedAnswers, threshold) → boolean
 */

import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import { lookupAnswer, saveAnswer, fillOpenQuestion } from '../src/qa.js';

function makeDoc(html) {
  return new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, {
    url: 'http://localhost/',
  }).window.document;
}

// ─── lookupAnswer ─────────────────────────────────────────────────────────────

const SAVED_ANSWERS = {
  // fingerprint of "Why do you want to work here?"
  // stored via saveAnswer below — use actual fingerprints from the module
};

describe('lookupAnswer', () => {
  it('returns null when savedAnswers is empty', () => {
    const result = lookupAnswer('Why do you want to work here?', {});
    expect(result).toBeNull();
  });

  it('returns the exact match when fingerprint matches', () => {
    // Build a savedAnswers with a known entry
    const q = 'Why do you want to work here?';
    const saved = saveAnswer(q, 'I love the mission.', {});
    const result = lookupAnswer(q, saved);
    expect(result).not.toBeNull();
    expect(result.answer).toBe('I love the mission.');
    expect(result.score).toBeCloseTo(1.0);
  });

  it('returns a match when question is similar above threshold', () => {
    const q = 'Why do you want to work here?';
    const saved = saveAnswer(q, 'I love the mission.', {});

    // Slightly different question (same key words)
    const result = lookupAnswer('Why do you want to join our company?', saved, 0.2);
    expect(result).not.toBeNull();
    expect(result.answer).toBe('I love the mission.');
  });

  it('returns null when best similarity is below threshold', () => {
    const q = 'Why do you want to work here?';
    const saved = saveAnswer(q, 'I love the mission.', {});

    const result = lookupAnswer('What is your expected salary?', saved, 0.5);
    expect(result).toBeNull();
  });

  it('returns the best match when multiple answers stored', () => {
    let saved = {};
    saved = saveAnswer('Tell us about yourself.', 'I am a software engineer.', saved);
    saved = saveAnswer('Why do you want to work here?', 'I love the mission.', saved);

    const result = lookupAnswer('Why do you want to join this company?', saved, 0.2);
    expect(result?.answer).toBe('I love the mission.');
  });
});

// ─── saveAnswer ───────────────────────────────────────────────────────────────

describe('saveAnswer', () => {
  it('adds a new entry to savedAnswers', () => {
    const saved = saveAnswer('Tell us about yourself.', 'I am a dev.', {});
    expect(Object.keys(saved).length).toBe(1);
  });

  it('stores the question text and answer', () => {
    const q = 'Tell us about yourself.';
    const a = 'I am a dev.';
    const saved = saveAnswer(q, a, {});
    const entry = Object.values(saved)[0];
    expect(entry.question).toBe(q);
    expect(entry.answer).toBe(a);
  });

  it('overwrites an existing entry for the same question', () => {
    const q = 'Tell us about yourself.';
    let saved = saveAnswer(q, 'First answer.', {});
    saved = saveAnswer(q, 'Updated answer.', saved);
    expect(Object.keys(saved).length).toBe(1);
    expect(Object.values(saved)[0].answer).toBe('Updated answer.');
  });

  it('does not mutate the input savedAnswers object', () => {
    const original = {};
    saveAnswer('A question.', 'An answer.', original);
    expect(Object.keys(original).length).toBe(0);
  });
});

// ─── fillOpenQuestion ─────────────────────────────────────────────────────────

describe('fillOpenQuestion', () => {
  it('fills a textarea when a cached answer is found', () => {
    const doc = makeDoc(`
      <div class="card-field">
        <label>Why do you want to work here?</label>
        <textarea name="open_q"></textarea>
      </div>
    `);
    const field = doc.querySelector('.card-field');
    const saved = saveAnswer('Why do you want to work here?', 'I love the mission.', {});

    const filled = fillOpenQuestion(
      field.querySelector('textarea'),
      'Why do you want to work here?',
      saved
    );

    expect(filled).toBe(true);
    expect(doc.querySelector('textarea').value).toBe('I love the mission.');
  });

  it('fills a text input when a cached answer is found', () => {
    const doc = makeDoc(`
      <div>
        <input type="text" name="open_q" />
      </div>
    `);
    const input = doc.querySelector('input');
    const saved = saveAnswer('What are your greatest strengths?', '...', {});

    const filled = fillOpenQuestion(input, 'What are your greatest strengths?', saved);
    expect(filled).toBe(true);
    expect(input.value).toBe('...');
  });

  it('returns false when no cached answer found', () => {
    const doc = makeDoc(`<textarea name="open_q"></textarea>`);
    const ta = doc.querySelector('textarea');
    const filled = fillOpenQuestion(ta, 'A brand new question nobody answered before.', {});
    expect(filled).toBe(false);
    expect(ta.value).toBe('');
  });
});
