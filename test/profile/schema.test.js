// schema.test.js — TDD RED→GREEN cho createEmptyProfile, validateProfile, normalizeProfile
import { describe, it, expect } from 'vitest';
import {
  createEmptyProfile,
  validateProfile,
  normalizeProfile,
} from '../../src/profile/schema.js';

// ─── createEmptyProfile ────────────────────────────────────────────────────────

describe('createEmptyProfile', () => {
  it('returns an object with all top-level sections', () => {
    const p = createEmptyProfile();
    expect(p).toHaveProperty('personal');
    expect(p).toHaveProperty('links');
    expect(p).toHaveProperty('workAuthorization');
    expect(p).toHaveProperty('eeo');
    expect(p).toHaveProperty('education');
    expect(p).toHaveProperty('workHistory');
    expect(p).toHaveProperty('skills');
    expect(p).toHaveProperty('resumeFiles');
    expect(p).toHaveProperty('compensation');
    expect(p).toHaveProperty('savedAnswers');
  });

  it('education and workHistory default to empty arrays', () => {
    const p = createEmptyProfile();
    expect(Array.isArray(p.education)).toBe(true);
    expect(p.education).toHaveLength(0);
    expect(Array.isArray(p.workHistory)).toBe(true);
    expect(p.workHistory).toHaveLength(0);
  });

  it('skills defaults to empty array', () => {
    const p = createEmptyProfile();
    expect(Array.isArray(p.skills)).toBe(true);
  });

  it('eeo fields default to empty string (decline to answer)', () => {
    const p = createEmptyProfile();
    expect(p.eeo.gender).toBe('');
    expect(p.eeo.race).toBe('');
    expect(p.eeo.veteranStatus).toBe('');
    expect(p.eeo.disabilityStatus).toBe('');
  });

  it('workAuthorization.needsSponsorship defaults to false', () => {
    const p = createEmptyProfile();
    expect(p.workAuthorization.needsSponsorship).toBe(false);
  });

  it('workAuthorization.authorizedToWork defaults to null (not set, not false)', () => {
    const p = createEmptyProfile();
    expect(p.workAuthorization.authorizedToWork).toBeNull();
  });

  it('has a consents section with agreeToTerms defaulting to false', () => {
    const p = createEmptyProfile();
    expect(p).toHaveProperty('consents');
    expect(p.consents.agreeToTerms).toBe(false);
  });
});

// ─── validateProfile ──────────────────────────────────────────────────────────

describe('validateProfile', () => {
  it('accepts a valid minimal profile', () => {
    const p = createEmptyProfile();
    p.personal.firstName = 'Nguyen';
    p.personal.lastName = 'Van A';
    p.personal.email = 'test@example.com';
    p.personal.phone = '+1 (555) 000-0000';
    const result = validateProfile(p);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects invalid email', () => {
    const p = createEmptyProfile();
    p.personal.email = 'not-an-email';
    const result = validateProfile(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field === 'personal.email')).toBe(true);
  });

  it('accepts empty email (profile not yet complete)', () => {
    const p = createEmptyProfile();
    p.personal.email = '';
    const result = validateProfile(p);
    // Empty email is OK — user may not have filled it yet
    expect(result.errors.some((e) => e.field === 'personal.email')).toBe(false);
  });

  it('rejects education entry missing school name', () => {
    const p = createEmptyProfile();
    p.education.push({ school: '', degree: "Bachelor's", fieldOfStudy: 'CS', startDate: '2020-09', endDate: '2024-05' });
    const result = validateProfile(p);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.field.startsWith('education[0]'))).toBe(true);
  });

  it('rejects workHistory entry where endDate is neither yyyy-mm nor "present"', () => {
    const p = createEmptyProfile();
    p.workHistory.push({
      company: 'Acme', title: 'Engineer', startDate: '2022-01', endDate: 'current', isCurrent: false, description: '',
    });
    const result = validateProfile(p);
    expect(result.errors.some((e) => e.field.includes('endDate'))).toBe(true);
  });

  it('accepts "present" as endDate for current job', () => {
    const p = createEmptyProfile();
    p.workHistory.push({
      company: 'Acme', title: 'Engineer', startDate: '2022-01', endDate: 'present', isCurrent: true, description: '',
    });
    const result = validateProfile(p);
    expect(result.errors.some((e) => e.field.includes('workHistory[0]') && e.field.includes('endDate'))).toBe(false);
  });
});

// ─── normalizeProfile ─────────────────────────────────────────────────────────

describe('normalizeProfile', () => {
  it('trims whitespace from firstName and lastName', () => {
    const p = createEmptyProfile();
    p.personal.firstName = '  John  ';
    p.personal.lastName = '  Doe  ';
    const n = normalizeProfile(p);
    expect(n.personal.firstName).toBe('John');
    expect(n.personal.lastName).toBe('Doe');
  });

  it('normalizes US phone to digits only (E.164-style storage)', () => {
    const p = createEmptyProfile();
    p.personal.phone = '+1 (555) 123-4567';
    const n = normalizeProfile(p);
    // Stored as E.164: +15551234567
    expect(n.personal.phone).toBe('+15551234567');
  });

  it('normalizes Vietnamese phone +84', () => {
    const p = createEmptyProfile();
    p.personal.phone = '+84 (0) 912 345 678';
    const n = normalizeProfile(p);
    expect(n.personal.phone).toBe('+84912345678');
  });

  it('keeps phone unchanged if already E.164', () => {
    const p = createEmptyProfile();
    p.personal.phone = '+15551234567';
    const n = normalizeProfile(p);
    expect(n.personal.phone).toBe('+15551234567');
  });

  it('normalizes date to yyyy-mm format', () => {
    const p = createEmptyProfile();
    p.education.push({ school: 'MIT', degree: "Bachelor's", fieldOfStudy: 'CS', startDate: '2020-9', endDate: '2024-5', location: '' });
    const n = normalizeProfile(p);
    expect(n.education[0].startDate).toBe('2020-09');
    expect(n.education[0].endDate).toBe('2024-05');
  });

  it('keeps "present" as endDate unchanged', () => {
    const p = createEmptyProfile();
    p.workHistory.push({ company: 'X', title: 'SWE', startDate: '2023-01', endDate: 'present', isCurrent: true, description: '' });
    const n = normalizeProfile(p);
    expect(n.workHistory[0].endDate).toBe('present');
  });

  it('trims email and lowercases it', () => {
    const p = createEmptyProfile();
    p.personal.email = '  Test@Example.COM  ';
    const n = normalizeProfile(p);
    expect(n.personal.email).toBe('test@example.com');
  });

  it('does not mutate original profile', () => {
    const p = createEmptyProfile();
    p.personal.firstName = '  Alice  ';
    normalizeProfile(p);
    expect(p.personal.firstName).toBe('  Alice  ');
  });

  it('migrates a legacy authorizedToWorkInCountry map (true for any country) to authorizedToWork: true', () => {
    const p = createEmptyProfile();
    p.workAuthorization.authorizedToWorkInCountry = { 'United States': true };
    delete p.workAuthorization.authorizedToWork;
    const n = normalizeProfile(p);
    expect(n.workAuthorization.authorizedToWork).toBe(true);
    expect(n.workAuthorization.authorizedToWorkInCountry).toBeUndefined();
  });

  it('migrates a legacy authorizedToWorkInCountry map (no true values) to authorizedToWork: null', () => {
    const p = createEmptyProfile();
    p.workAuthorization.authorizedToWorkInCountry = { Vietnam: false };
    delete p.workAuthorization.authorizedToWork;
    const n = normalizeProfile(p);
    expect(n.workAuthorization.authorizedToWork).toBeNull();
    expect(n.workAuthorization.authorizedToWorkInCountry).toBeUndefined();
  });

  it('does not override an already-set authorizedToWork during migration', () => {
    const p = createEmptyProfile();
    p.workAuthorization.authorizedToWork = false;
    p.workAuthorization.authorizedToWorkInCountry = { 'United States': true };
    const n = normalizeProfile(p);
    expect(n.workAuthorization.authorizedToWork).toBe(false);
  });
});
