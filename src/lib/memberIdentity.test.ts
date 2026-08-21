import { describe, expect, it } from 'vitest';
import { consolidateTripMembers, hasMemberWithEmail, normalizeMemberEmail, uniqueInvitedEmails } from './memberIdentity';
import { TripMember } from '../types';

const member = (email: string): TripMember => ({
  id: `member-${email}`,
  tripId: 'trip-1',
  userId: `user-${email}`,
  name: 'Traveler',
  email,
  role: 'member',
  isActive: true,
  joinedAt: '2026-08-21T00:00:00.000Z'
});

describe('trip member email identity', () => {
  it('normalizes casing and surrounding whitespace', () => {
    expect(normalizeMemberEmail('  Traveler@Example.COM ')).toBe('traveler@example.com');
  });

  it('finds an existing member by normalized email', () => {
    expect(hasMemberWithEmail([member('Traveler@Example.com')], ' traveler@example.COM ')).toBe(true);
  });

  it('removes repeated invitations and excludes the owner email', () => {
    expect(uniqueInvitedEmails(
      ['friend@example.com', ' FRIEND@example.com ', 'owner@example.com', 'second@example.com'],
      ' OWNER@EXAMPLE.COM '
    )).toEqual(['friend@example.com', 'second@example.com']);
  });

  it('consolidates the same email into one participant and retains historical IDs', () => {
    const placeholder = { ...member('Person@Example.com'), id: 'first', userId: 'placeholder', joinedAt: '2026-08-20T00:00:00.000Z' };
    const authenticated = {
      ...member(' person@example.COM '),
      id: 'second',
      userId: 'auth-user',
      authUid: 'auth-user',
      name: 'Current Name',
      joinedAt: '2026-08-21T00:00:00.000Z'
    };

    expect(consolidateTripMembers([placeholder, authenticated])).toEqual([{
      ...placeholder,
      authUid: 'auth-user',
      name: 'Current Name',
      legacyUserIds: ['auth-user']
    }]);
  });

  it('claims a legacy guest placeholder when one real member has the same name', () => {
    const guest = { ...member('ozalphtr@whopaid.guest'), id: 'guest', userId: 'guest-user', name: 'ozalphTR' };
    const real = { ...member('real@example.com'), id: 'real', userId: 'real-user', authUid: 'real-user', name: 'ozalphTR' };

    expect(consolidateTripMembers([guest, real])).toEqual([{
      ...real,
      legacyUserIds: ['guest-user']
    }]);
  });
});
