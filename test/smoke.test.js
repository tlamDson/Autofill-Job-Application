// smoke.test.js — Kiểm tra môi trường test chạy được
// Không test logic — chỉ confirm Vitest + jsdom setup đúng.

import { describe, it, expect } from 'vitest';

describe('smoke test', () => {
  it('runs in a jsdom environment', () => {
    expect(typeof window).toBe('object');
    expect(typeof document).toBe('object');
  });

  it('can create DOM elements', () => {
    const input = document.createElement('input');
    input.type = 'text';
    input.value = 'hello';
    expect(input.value).toBe('hello');
  });

  it('basic arithmetic works', () => {
    expect(1 + 1).toBe(2);
  });
});
