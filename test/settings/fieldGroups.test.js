import { describe, it, expect } from 'vitest';
import {
  FIELD_GROUPS,
  isFieldEnabled,
  setFieldEnabled,
  setGroupEnabled,
  groupState,
} from '../../src/settings/fieldGroups.js';

describe('isFieldEnabled', () => {
  it('returns true for any key when disabledFields is empty', () => {
    expect(isFieldEnabled({ disabledFields: [] }, 'firstName')).toBe(true);
  });

  it('returns false when the key is in disabledFields', () => {
    expect(isFieldEnabled({ disabledFields: ['firstName'] }, 'firstName')).toBe(false);
  });

  it('treats a missing disabledFields as empty (all enabled)', () => {
    expect(isFieldEnabled({}, 'gpa')).toBe(true);
  });
});

describe('setFieldEnabled', () => {
  it('adds the key to disabledFields when disabling', () => {
    const next = setFieldEnabled({ disabledFields: [] }, 'firstName', false);
    expect(next.disabledFields).toContain('firstName');
  });

  it('removes the key from disabledFields when enabling', () => {
    const next = setFieldEnabled({ disabledFields: ['firstName', 'email'] }, 'firstName', true);
    expect(next.disabledFields).not.toContain('firstName');
    expect(next.disabledFields).toContain('email');
  });

  it('does not mutate the input settings object', () => {
    const settings = { disabledFields: [] };
    setFieldEnabled(settings, 'firstName', false);
    expect(settings.disabledFields).toEqual([]);
  });
});

describe('groupState', () => {
  it('returns "on" when no keys in the group are disabled', () => {
    expect(groupState({ disabledFields: [] }, 'personal')).toBe('on');
  });

  it('returns "off" when every key in the group is disabled', () => {
    const personalGroup = FIELD_GROUPS.find((g) => g.id === 'personal');
    expect(groupState({ disabledFields: personalGroup.keys }, 'personal')).toBe('off');
  });

  it('returns "mixed" when some but not all keys in the group are disabled', () => {
    expect(groupState({ disabledFields: ['firstName'] }, 'personal')).toBe('mixed');
  });

  it('returns "on" for an unknown groupId', () => {
    expect(groupState({ disabledFields: ['firstName'] }, 'not-a-real-group')).toBe('on');
  });
});

describe('setGroupEnabled', () => {
  it('disables every key in the group', () => {
    const linksGroup = FIELD_GROUPS.find((g) => g.id === 'links');
    const next = setGroupEnabled({ disabledFields: [] }, 'links', false);
    for (const key of linksGroup.keys) {
      expect(next.disabledFields).toContain(key);
    }
  });

  it('re-enables every key in the group without touching other disabled keys', () => {
    const linksGroup = FIELD_GROUPS.find((g) => g.id === 'links');
    const settings = { disabledFields: [...linksGroup.keys, 'gpa'] };
    const next = setGroupEnabled(settings, 'links', true);
    for (const key of linksGroup.keys) {
      expect(next.disabledFields).not.toContain(key);
    }
    expect(next.disabledFields).toContain('gpa');
  });

  it('returns settings unchanged for an unknown groupId', () => {
    const settings = { disabledFields: ['firstName'] };
    expect(setGroupEnabled(settings, 'not-a-real-group', true)).toBe(settings);
  });
});

describe('FIELD_GROUPS', () => {
  it('has unique group ids', () => {
    const ids = FIELD_GROUPS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has no duplicate keys across groups', () => {
    const allKeys = FIELD_GROUPS.flatMap((g) => g.keys);
    expect(new Set(allKeys).size).toBe(allKeys.length);
  });
});
