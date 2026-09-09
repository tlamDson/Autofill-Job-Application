// serialize.test.js — TDD cho exportProfile / importProfile
import { describe, it, expect } from 'vitest';
import { exportProfile, importProfile } from '../../src/profile/serialize.js';
import { createEmptyProfile } from '../../src/profile/schema.js';

describe('exportProfile', () => {
  it('returns a JSON string', () => {
    const p = createEmptyProfile();
    p.personal.firstName = 'Alice';
    const json = exportProfile(p);
    expect(typeof json).toBe('string');
    const parsed = JSON.parse(json);
    expect(parsed.personal.firstName).toBe('Alice');
  });

  it('strips resumeFiles blobs (keeps metadata, drops fileRef content)', () => {
    const p = createEmptyProfile();
    p.resumeFiles = [{ id: '1', label: 'Default', fileRef: 'resume-123-abc', isDefault: true }];
    const json = exportProfile(p);
    const parsed = JSON.parse(json);
    // resumeFiles array should exist but fileRef should be cleared (not a real blob path)
    expect(parsed.resumeFiles[0].label).toBe('Default');
    expect(parsed.resumeFiles[0].fileRef).toBe(''); // cleared on export
  });

  it('includes _version', () => {
    const p = createEmptyProfile();
    p._version = 1;
    const json = exportProfile(p);
    expect(JSON.parse(json)._version).toBe(1);
  });

  it('does not include savedAnswers AI cache', () => {
    const p = createEmptyProfile();
    p.savedAnswers = [{ questionFingerprint: 'abc', answer: 'test' }];
    const json = exportProfile(p);
    // savedAnswers should be omitted from export (sensitive / large)
    const parsed = JSON.parse(json);
    expect(parsed.savedAnswers).toBeUndefined();
  });
});

describe('importProfile', () => {
  it('parses valid JSON and validates it', () => {
    const p = createEmptyProfile();
    p.personal.firstName = 'Bob';
    const json = exportProfile(p);
    const result = importProfile(json);
    expect(result.ok).toBe(true);
    expect(result.profile.personal.firstName).toBe('Bob');
  });

  it('returns error for invalid JSON', () => {
    const result = importProfile('not json');
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns error for JSON that is not an object', () => {
    const result = importProfile('"hello"');
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/not a valid profile/i);
  });

  it('returns error if profile has invalid email', () => {
    const p = createEmptyProfile();
    p.personal.email = 'bad-email';
    const json = JSON.stringify(p);
    const result = importProfile(json);
    expect(result.ok).toBe(false);
    expect(result.errors).toBeTruthy();
  });

  it('merges missing sections from empty profile (forward compat)', () => {
    // Old export missing some section
    const partial = { personal: { firstName: 'Carl' }, _version: 1 };
    const json = JSON.stringify(partial);
    const result = importProfile(json);
    expect(result.ok).toBe(true);
    // Should have education array from empty profile merge
    expect(Array.isArray(result.profile.education)).toBe(true);
  });
});
