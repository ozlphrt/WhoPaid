import { describe, expect, it } from 'vitest';
import type { Expense } from '../types';
import { addMemberToEqualExpense, getExpenseExclusions } from './expenseParticipation';

const expense = (overrides: Partial<Expense> = {}): Expense => ({
  id: 'expense-1',
  tripId: 'trip-1',
  description: 'Dinner',
  category: 'Food',
  originalAmount: 120,
  originalCurrency: 'EUR',
  convertedAmount: 120,
  mainCurrency: 'EUR',
  exchangeRate: 1,
  isManualExchangeRate: false,
  exchangeRateDate: '2026-08-21',
  paidByUserId: 'a',
  addedByUserId: 'a',
  payers: [{ userId: 'a', amount: 120 }],
  participants: ['a', 'b', 'c', 'd'].map(userId => ({ userId, amount: 30 })),
  splitMode: 'equal',
  date: '2026-08-21T00:00:00.000Z',
  isDeleted: false,
  isFlaggedWrong: false,
  clientSyncStatus: 'synced',
  createdAt: '2026-08-21T00:00:00.000Z',
  updatedAt: '2026-08-21T00:00:00.000Z',
  ...overrides
});

describe('new member expense participation', () => {
  it('adds a new member and redistributes an equal expense exactly', () => {
    const revised = addMemberToEqualExpense(expense(), 'e');

    expect(revised?.participants).toEqual(
      ['a', 'b', 'c', 'd', 'e'].map(userId => ({ userId, amount: 24 }))
    );
  });

  it('preserves the exact total when cents cannot divide evenly', () => {
    const revised = addMemberToEqualExpense(expense({
      originalAmount: 100,
      participants: ['a', 'b'].map(userId => ({ userId, amount: 50 }))
    }), 'c');

    expect(revised?.participants).toEqual([
      { userId: 'a', amount: 33.33 },
      { userId: 'b', amount: 33.33 },
      { userId: 'c', amount: 33.34 }
    ]);
  });

  it('does not touch a custom-split expense', () => {
    expect(addMemberToEqualExpense(expense({ splitMode: 'custom' }), 'e')).toBeNull();
  });

  it('does not duplicate an invited placeholder identity', () => {
    expect(addMemberToEqualExpense(expense(), 'authenticated-b', ['b'])).toBeNull();
  });

  it('does not alter deleted expenses', () => {
    expect(addMemberToEqualExpense(expense({ isDeleted: true }), 'e')).toBeNull();
  });

  it('leaves legacy empty-participant expenses on their all-members fallback', () => {
    expect(addMemberToEqualExpense(expense({ participants: [] }), 'e')).toBeNull();
  });
});

describe('getExpenseExclusions', () => {
  const members = [
    { id: 'm1', tripId: 'trip-1', userId: 'u1', name: 'Alice', email: 'alice@test.com', role: 'owner' as const, isActive: true, joinedAt: '2026-08-01' },
    { id: 'm2', tripId: 'trip-1', userId: 'u2', name: 'Bob', email: 'bob@test.com', role: 'member' as const, isActive: true, joinedAt: '2026-08-01' },
    { id: 'm3', tripId: 'trip-1', userId: 'u3', name: 'Charlie', email: 'charlie@test.com', role: 'member' as const, isActive: true, joinedAt: '2026-08-01' }
  ];

  it('returns zero exclusions when all members participate in all expenses', () => {
    const expenses = [
      expense({
        id: 'exp-1',
        description: 'Hotel',
        convertedAmount: 300,
        participants: [
          { userId: 'u1', amount: 100 },
          { userId: 'u2', amount: 100 },
          { userId: 'u3', amount: 100 }
        ]
      })
    ];

    const result = getExpenseExclusions(members, expenses);
    expect(result.totalExclusionsCount).toBe(0);
    expect(result.expensesWithExclusionsCount).toBe(0);
    expect(result.membersWithExclusionsCount).toBe(0);
    expect(result.byMember).toHaveLength(0);
    expect(result.byExpense).toHaveLength(0);
  });

  it('identifies excluded members in selective equal split expenses', () => {
    const expenses = [
      expense({
        id: 'exp-1',
        description: 'Museum Ticket',
        convertedAmount: 40,
        participants: [
          { userId: 'u1', amount: 20 },
          { userId: 'u2', amount: 20 }
        ]
      })
    ];

    const result = getExpenseExclusions(members, expenses);
    expect(result.totalExclusionsCount).toBe(1);
    expect(result.expensesWithExclusionsCount).toBe(1);
    expect(result.membersWithExclusionsCount).toBe(1);

    expect(result.byMember[0].member.userId).toBe('u3');
    expect(result.byMember[0].excludedExpenses[0].description).toBe('Museum Ticket');
    expect(result.byMember[0].totalExcludedSpend).toBe(40);

    expect(result.byExpense[0].expense.description).toBe('Museum Ticket');
    expect(result.byExpense[0].excludedMembers.map(m => m.userId)).toEqual(['u3']);
    expect(result.byExpense[0].participatingMembers.map(m => m.userId)).toEqual(['u1', 'u2']);
  });

  it('identifies excluded members with custom split where someone has 0 share', () => {
    const expenses = [
      expense({
        id: 'exp-2',
        description: 'Dinner with Drinks',
        splitMode: 'custom',
        convertedAmount: 100,
        participants: [
          { userId: 'u1', amount: 60 },
          { userId: 'u2', amount: 40 },
          { userId: 'u3', amount: 0 }
        ]
      })
    ];

    const result = getExpenseExclusions(members, expenses);
    expect(result.totalExclusionsCount).toBe(1);
    expect(result.byMember[0].member.userId).toBe('u3');
    expect(result.byExpense[0].excludedMembers[0].userId).toBe('u3');
  });

  it('correctly aggregates multiple exclusions across members and expenses', () => {
    const expenses = [
      expense({
        id: 'exp-1',
        description: 'Lunch',
        convertedAmount: 50,
        participants: [{ userId: 'u1', amount: 50 }] // u2 and u3 excluded
      }),
      expense({
        id: 'exp-2',
        description: 'Taxi',
        convertedAmount: 30,
        participants: [{ userId: 'u1', amount: 15 }, { userId: 'u2', amount: 15 }] // u3 excluded
      }),
      expense({
        id: 'exp-3',
        description: 'Dinner (all)',
        convertedAmount: 90,
        participants: [{ userId: 'u1', amount: 30 }, { userId: 'u2', amount: 30 }, { userId: 'u3', amount: 30 }]
      })
    ];

    const result = getExpenseExclusions(members, expenses);
    expect(result.totalExclusionsCount).toBe(3); // u2 (1) + u3 (2)
    expect(result.expensesWithExclusionsCount).toBe(2);
    expect(result.membersWithExclusionsCount).toBe(2);

    // u3 should be first in byMember since u3 has 2 excluded expenses
    expect(result.byMember[0].member.userId).toBe('u3');
    expect(result.byMember[0].excludedExpenses).toHaveLength(2);
    expect(result.byMember[0].totalExcludedSpend).toBe(80); // 50 + 30

    expect(result.byMember[1].member.userId).toBe('u2');
    expect(result.byMember[1].excludedExpenses).toHaveLength(1);
    expect(result.byMember[1].totalExcludedSpend).toBe(50);
  });

  it('ignores deleted expenses and handles aliases', () => {
    const membersWithAlias = [
      { id: 'm1', tripId: 'trip-1', userId: 'u1', legacyUserIds: ['u1-old'], name: 'Alice', email: 'alice@test.com', role: 'owner' as const, isActive: true, joinedAt: '2026-08-01' },
      { id: 'm2', tripId: 'trip-1', userId: 'u2', name: 'Bob', email: 'bob@test.com', role: 'member' as const, isActive: true, joinedAt: '2026-08-01' }
    ];

    const expenses = [
      expense({
        id: 'exp-deleted',
        description: 'Deleted Exp',
        isDeleted: true,
        participants: [{ userId: 'u1', amount: 50 }]
      }),
      expense({
        id: 'exp-with-alias',
        description: 'Active Exp',
        isDeleted: false,
        participants: [{ userId: 'u1-old', amount: 25 }, { userId: 'u2', amount: 25 }]
      })
    ];

    const result = getExpenseExclusions(membersWithAlias, expenses);
    expect(result.totalExclusionsCount).toBe(0);
  });
});

