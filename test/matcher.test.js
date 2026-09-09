// matcher.test.js — Tests for matcher.js (stripExample, buildContext, classifyField)
// TDD: tests are added incrementally per P1.x task.
import { describe, it, expect } from 'vitest';
import { stripExample } from '../src/matcher.js';

// ─── P1.1 — stripExample ─────────────────────────────────────────────────────

describe('stripExample', () => {
  // Vietnamese patterns
  it('strips "VD: Nguyễn Văn A" suffix', () => {
    expect(stripExample('Họ và tên (VD: Nguyễn Văn A)')).not.toContain('Nguyễn Văn A');
  });

  it('strips "ví dụ:" prefix (case-insensitive)', () => {
    const result = stripExample('Ví dụ: Nguyễn Văn A');
    expect(result.trim()).toBe('');
  });

  it('strips "vd:" short form', () => {
    const result = stripExample('vd: abc@example.com');
    expect(result.trim()).toBe('');
  });

  // English patterns
  it('strips "e.g. John Doe" suffix', () => {
    const result = stripExample('Full name (e.g. John Doe)');
    expect(result).not.toContain('John Doe');
    expect(result.toLowerCase()).toContain('full name');
  });

  it('strips "eg. Jane" suffix', () => {
    expect(stripExample('Email (eg. jane@test.com)')).not.toContain('jane@test.com');
  });

  it('strips "example:" prefix', () => {
    const result = stripExample('Example: John Smith');
    expect(result.trim()).toBe('');
  });

  it('strips "For example," prefix', () => {
    const result = stripExample('For example, https://github.com/user');
    expect(result.trim()).toBe('');
  });

  // Placeholder patterns
  it('strips "John Doe" placeholder text alone', () => {
    expect(stripExample('John Doe').trim()).toBe('');
  });

  it('strips "jane@example.com" placeholder text alone', () => {
    expect(stripExample('jane@example.com').trim()).toBe('');
  });

  // Important: must NOT strip actual labels
  it('does NOT strip label "First Name"', () => {
    expect(stripExample('First Name')).toBe('First Name');
  });

  it('does NOT strip label "Email Address"', () => {
    expect(stripExample('Email Address')).toBe('Email Address');
  });

  it('does NOT strip "Company" label', () => {
    expect(stripExample('Company')).toBe('Company');
  });

  // Parenthetical example removal
  it('removes parenthetical example text, preserves surrounding label', () => {
    const result = stripExample('Phone number (e.g. +1 555-123-4567)');
    expect(result.trim()).toBe('Phone number');
  });

  it('removes multiple example patterns if present', () => {
    const result = stripExample('Name vd: Nguyen — example: Smith');
    expect(result).not.toMatch(/Nguyen|Smith/i);
  });

  it('returns empty string for pure example text with no label', () => {
    expect(stripExample('e.g. https://linkedin.com/in/yourname').trim()).toBe('');
  });
});
