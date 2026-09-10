/**
 * test/complexAnswer.test.js — P4.3 Review panel câu hỏi mở
 *
 * Tests:
 *   - collectOpenQuestions(doc, filledEls) → [{el, label}] — find unanswered open questions
 *   - createReviewPanel(doc, questions, callbacks) → Element — builds the panel DOM
 */

import { describe, it, expect, vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { collectOpenQuestions, createReviewPanel } from '../src/complexAnswer.js';

function makeDoc(html) {
  return new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, {
    url: 'http://localhost/',
  }).window.document;
}

// ─── collectOpenQuestions ─────────────────────────────────────────────────────

describe('collectOpenQuestions', () => {
  it('finds textareas that have no value', () => {
    const doc = makeDoc(`
      <form>
        <div>
          <label for="q1">Why do you want to work here?</label>
          <textarea id="q1" name="q1"></textarea>
        </div>
      </form>
    `);
    const questions = collectOpenQuestions(doc, []);
    expect(questions.length).toBe(1);
    expect(questions[0].label).toContain('Why do you want to work here?');
    expect(questions[0].el.tagName.toLowerCase()).toBe('textarea');
  });

  it('excludes textareas that already have a value (fast-filled)', () => {
    const doc = makeDoc(`
      <form>
        <div>
          <label for="q1">Why do you want to work here?</label>
          <textarea id="q1" name="q1">I love the mission.</textarea>
        </div>
      </form>
    `);
    const questions = collectOpenQuestions(doc, []);
    expect(questions.length).toBe(0);
  });

  it('excludes elements in the filledEls list', () => {
    const doc = makeDoc(`
      <form>
        <div>
          <label for="q1">Open question</label>
          <textarea id="q1" name="q1"></textarea>
        </div>
      </form>
    `);
    const ta = doc.getElementById('q1');
    const questions = collectOpenQuestions(doc, [ta]);
    expect(questions.length).toBe(0);
  });

  it('extracts label from associated <label> element', () => {
    const doc = makeDoc(`
      <form>
        <label for="cq">What motivates you?</label>
        <textarea id="cq" name="cq"></textarea>
      </form>
    `);
    const questions = collectOpenQuestions(doc, []);
    expect(questions[0].label).toBe('What motivates you?');
  });

  it('returns empty array when no open questions', () => {
    const doc = makeDoc(`<form><input type="text" name="name" /></form>`);
    const questions = collectOpenQuestions(doc, []);
    expect(questions).toEqual([]);
  });
});

// ─── createReviewPanel ────────────────────────────────────────────────────────

const SAMPLE_QUESTIONS = [
  { el: null, label: 'Why do you want to work here?' },
  { el: null, label: 'Tell us about a challenge you overcame.' },
];

describe('createReviewPanel', () => {
  it('returns a DOM element', () => {
    const doc = makeDoc('');
    const panel = createReviewPanel(doc, SAMPLE_QUESTIONS, {});
    expect(panel).toBeTruthy();
    expect(panel.tagName).toBeDefined();
  });

  it('shows each question label in the panel', () => {
    const doc = makeDoc('');
    const panel = createReviewPanel(doc, SAMPLE_QUESTIONS, {});
    const text = panel.textContent;
    expect(text).toContain('Why do you want to work here?');
    expect(text).toContain('Tell us about a challenge you overcame.');
  });

  it('has a textarea per question for editing answers', () => {
    const doc = makeDoc('');
    const panel = createReviewPanel(doc, SAMPLE_QUESTIONS, {});
    const textareas = panel.querySelectorAll('textarea');
    expect(textareas.length).toBe(SAMPLE_QUESTIONS.length);
  });

  it('has an Accept button per question', () => {
    const doc = makeDoc('');
    const panel = createReviewPanel(doc, SAMPLE_QUESTIONS, {});
    // Check for buttons with accept/save/apply text
    const buttons = Array.from(panel.querySelectorAll('button'));
    const acceptBtns = buttons.filter((b) =>
      /accept|save|apply/i.test(b.textContent)
    );
    expect(acceptBtns.length).toBe(SAMPLE_QUESTIONS.length);
  });

  it('has a Generate with AI button per question', () => {
    const doc = makeDoc('');
    const panel = createReviewPanel(doc, SAMPLE_QUESTIONS, {});
    const buttons = Array.from(panel.querySelectorAll('button'));
    const aiBtns = buttons.filter((b) => /generate|ai/i.test(b.textContent));
    expect(aiBtns.length).toBe(SAMPLE_QUESTIONS.length);
  });

  it('calls onAccept callback when Accept button is clicked', () => {
    const doc = makeDoc('');
    const onAccept = vi.fn();
    const panel = createReviewPanel(doc, [SAMPLE_QUESTIONS[0]], { onAccept });

    const buttons = Array.from(panel.querySelectorAll('button'));
    const acceptBtn = buttons.find((b) => /accept|save|apply/i.test(b.textContent));
    acceptBtn.click();

    expect(onAccept).toHaveBeenCalledOnce();
  });

  it('calls onGenerateAI callback when Generate with AI button is clicked', () => {
    const doc = makeDoc('');
    const onGenerateAI = vi.fn();
    const panel = createReviewPanel(doc, [SAMPLE_QUESTIONS[0]], { onGenerateAI });

    const buttons = Array.from(panel.querySelectorAll('button'));
    const aiBtn = buttons.find((b) => /generate|ai/i.test(b.textContent));
    aiBtn.click();

    expect(onGenerateAI).toHaveBeenCalledOnce();
  });

  it('shows panel heading with question count', () => {
    const doc = makeDoc('');
    const panel = createReviewPanel(doc, SAMPLE_QUESTIONS, {});
    expect(panel.textContent).toContain('2');
  });

  it('omits the Generate with AI button when options.showAIButton is false', () => {
    const doc = makeDoc('');
    const panel = createReviewPanel(doc, SAMPLE_QUESTIONS, {}, { showAIButton: false });
    expect(panel.querySelectorAll('.autofill-ai').length).toBe(0);
    // Accept buttons should still be present
    expect(panel.querySelectorAll('.autofill-accept').length).toBe(SAMPLE_QUESTIONS.length);
  });

  it('shows the Generate with AI button by default (options omitted)', () => {
    const doc = makeDoc('');
    const panel = createReviewPanel(doc, SAMPLE_QUESTIONS, {});
    expect(panel.querySelectorAll('.autofill-ai').length).toBe(SAMPLE_QUESTIONS.length);
  });
});
