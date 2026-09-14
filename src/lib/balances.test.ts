import { describe, expect, it } from 'vitest';
import { resolveCurrentMemberUserId, resolveMemberUserId, getBalancesForCurrency } from './balances';
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

describe('getBalancesForCurrency', () => {
  const testMembers: TripMember[] = [
    {
      id: 'm1',
      tripId: 'trip-1',
      userId: 'user-1',
      name: 'Ozalp',
      email: 'ozalp@example.test',
      role: 'owner',
      isActive: true,
      joinedAt: '2026-01-01T00:00:00.000Z'
    }
  ];

  const testExpenses: import('../types').Expense[] = [
    {
      id: 'exp-1',
      tripId: 'trip-1',
      description: 'Pera Residence',
      originalAmount: 963,
      originalCurrency: 'USD',
      convertedAmount: 46823,
      mainCurrency: 'TRY',
      exchangeRate: 48.6220145,
      isManualExchangeRate: false,
      exchangeRateDate: '2026-09-14',
      paidByUserId: 'user-1',
      addedByUserId: 'user-1',
      payers: [{ userId: 'user-1', amount: 963 }],
      participants: [{ userId: 'user-1', amount: 963 }],
      splitMode: 'equal',
      category: 'Hotel',
      date: '2026-09-14T10:00:00.000Z',
      createdAt: '2026-09-14T10:00:00.000Z',
      updatedAt: '2026-09-14T10:00:00.000Z',
      isFlaggedWrong: false,
      clientSyncStatus: 'synced',
      isDeleted: false
    }
  ];

  it('preserves exact original amounts when target currency matches original currency', () => {
    const usdBalances = getBalancesForCurrency('USD', 'TRY', testMembers, testExpenses);
    expect(usdBalances.totalSpend).toBe(963);
    expect(usdBalances.individualBalances[0].paid).toBe(963);
    expect(usdBalances.individualBalances[0].share).toBe(963);
    expect(usdBalances.individualBalances[0].net).toBe(0);
  });

  it('returns standard main currency balances when target currency is main currency', () => {
    const tryBalances = getBalancesForCurrency('TRY', 'TRY', testMembers, testExpenses);
    expect(tryBalances.totalSpend).toBe(46823);
    expect(tryBalances.individualBalances[0].paid).toBe(46823);
    expect(tryBalances.individualBalances[0].share).toBe(46823);
    expect(tryBalances.individualBalances[0].net).toBe(0);
  });
});

