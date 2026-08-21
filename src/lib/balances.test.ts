import { describe, expect, it } from 'vitest';
import { resolveCurrentMemberUserId, resolveMemberUserId } from './balances';
import type { TripMember } from '../types';

const members: TripMember[] = [
  {
    id: 'member-a',
    tripId: 'trip-a',
    userId: 'auth-uid-a',
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
    userId: 'auth-uid-b',
    name: 'Al',
    email: 'al@example.test',
    role: 'member',
    isActive: true,
    joinedAt: '2026-01-01T00:00:00.000Z'
  }
];

describe('resolveMemberUserId', () => {
  it('maps exact legacy aliases to the claimed Auth UID', () => {
    expect(resolveMemberUserId('placeholder-alice', members)).toBe('auth-uid-a');
  });

  it('does not associate partial names or partial identifiers', () => {
    expect(resolveMemberUserId('ali', members)).toBe('ali');
    expect(resolveMemberUserId('auth-uid', members)).toBe('auth-uid');
  });
});

describe('resolveCurrentMemberUserId', () => {
  it('uses the authenticated identity when two participants have the same name', () => {
    const duplicateNames: TripMember[] = [
      { ...members[0], userId: 'owner-uid', authUid: 'owner-uid', name: 'Ozalp Harut' },
      { ...members[1], userId: 'member-uid', authUid: 'member-uid', name: 'Ozalp Harut' }
    ];

    expect(resolveCurrentMemberUserId({
      id: 'owner-uid',
      email: 'owner@example.test',
      name: 'Ozalp Harut'
    }, duplicateNames)).toBe('owner-uid');

    expect(resolveCurrentMemberUserId({
      id: 'member-uid',
      email: 'member@example.test',
      name: 'Ozalp Harut'
    }, duplicateNames)).toBe('member-uid');
  });

  it('does not guess from an ambiguous display name', () => {
    const duplicateNames: TripMember[] = [
      { ...members[0], name: 'Same Name' },
      { ...members[1], name: 'Same Name' }
    ];

    expect(resolveCurrentMemberUserId({
      id: 'unknown-uid',
      email: 'unknown@example.test',
      name: 'Same Name'
    }, duplicateNames)).toBe('unknown-uid');
  });
});
