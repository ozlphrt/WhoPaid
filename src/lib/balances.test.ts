import { describe, expect, it } from 'vitest';
import { resolveMemberUserId } from './balances';
import type { TripMember } from '../types';

const members: TripMember[] = [
  {
    id: 'member-a',
    tripId: 'trip-a',
    userId: 'firebase-uid-a',
    legacyUserIds: ['placeholder-alice'],
    name: 'Alice',
    email: 'alice@example.test',
    role: 'member',
    isActive: true,
    joinedAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'member-b',
    tripId: 'trip-a',
    userId: 'firebase-uid-b',
    name: 'Al',
    email: 'al@example.test',
    role: 'member',
    isActive: true,
    joinedAt: '2026-01-01T00:00:00.000Z'
  }
];

describe('resolveMemberUserId', () => {
  it('maps exact legacy aliases to the claimed Firebase UID', () => {
    expect(resolveMemberUserId('placeholder-alice', members)).toBe('firebase-uid-a');
  });

  it('does not associate partial names or partial identifiers', () => {
    expect(resolveMemberUserId('ali', members)).toBe('ali');
    expect(resolveMemberUserId('firebase-uid', members)).toBe('firebase-uid');
  });
});
