import { describe, expect, it } from 'vitest';
import { resolveCurrentMemberUserId, resolveMemberUserId, calculateParticipantBalances, getBalancesForCurrency } from './balances';
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

  const multiCurrencyExpenses: import('../types').Expense[] = [
    {
      id: 'exp-1',
      tripId: 'trip-1',
      description: 'dinner',
      originalAmount: 100,
      originalCurrency: 'EUR',
      convertedAmount: 5616,
      mainCurrency: 'TRY',
      exchangeRate: 56.16,
      isManualExchangeRate: false,
      exchangeRateDate: '2026-09-14',
      paidByUserId: 'user-1',
      addedByUserId: 'user-1',
      payers: [{ userId: 'user-1', amount: 100 }],
      participants: [{ userId: 'user-1', amount: 100 }],
      splitMode: 'equal',
      category: 'Food',
      date: '2026-09-14T10:00:00.000Z',
      createdAt: '2026-09-14T10:00:00.000Z',
      updatedAt: '2026-09-14T10:00:00.000Z',
      isFlaggedWrong: false,
      clientSyncStatus: 'synced',
      isDeleted: false
    },
    {
      id: 'exp-2',
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

  it('preserves exact mathematical integrity with 0 net balance in EUR, USD, and TRY', () => {
    const canonical = calculateParticipantBalances(testMembers, multiCurrencyExpenses, []);
    expect(canonical.totalSpend).toBe(52439);
    expect(canonical.individualBalances[0].paid).toBe(52439);
    expect(canonical.individualBalances[0].share).toBe(52439);
    expect(canonical.individualBalances[0].net).toBe(0);

    // In TRY
    const tryBal = getBalancesForCurrency('TRY', 'TRY', canonical, multiCurrencyExpenses);
    expect(tryBal.individualBalances[0].paid).toBe(52439);
    expect(tryBal.individualBalances[0].share).toBe(52439);
    expect(tryBal.individualBalances[0].net).toBe(0);

    // In EUR (must be 0 net balance, NOT -€112)
    const eurBal = getBalancesForCurrency('EUR', 'TRY', canonical, multiCurrencyExpenses);
    expect(eurBal.individualBalances[0].paid).toBe(933.74);
    expect(eurBal.individualBalances[0].share).toBe(933.74);
    expect(eurBal.individualBalances[0].net).toBe(0);

    // In USD (must be 0 net balance, NOT +$18)
    const usdBal = getBalancesForCurrency('USD', 'TRY', canonical, multiCurrencyExpenses);
    expect(usdBal.individualBalances[0].paid).toBe(1078.5);
    expect(usdBal.individualBalances[0].share).toBe(1078.5);
    expect(usdBal.individualBalances[0].net).toBe(0);
  });
});

