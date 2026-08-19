import { describe, expect, it } from 'vitest';
import { createId } from './id';

describe('createId', () => {
  it('creates prefixed, unique identifiers with enough entropy for invite links', () => {
    const ids = new Set(Array.from({ length: 100 }, () => createId('trip')));

    expect(ids.size).toBe(100);
    for (const id of ids) {
      expect(id).toMatch(/^trip_[a-f0-9-]{32,36}$/i);
    }
  });
});
