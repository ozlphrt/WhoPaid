import { describe, expect, it } from 'vitest';
import { Expense } from '../types';
import { memberPaidExpense, redistributeExpenseAfterMemberRemoval } from './memberRemoval';

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

describe('member removal expense redistribution', () => {
  it('redistributes an equal expense across the remaining participants', () => {
    const revised = redistributeExpenseAfterMemberRemoval(expense(), new Set(['b']), ['a', 'c', 'd']);
    expect(revised?.participants).toEqual([
      { userId: 'a', amount: 40 },
      { userId: 'c', amount: 40 },
      { userId: 'd', amount: 40 }
    ]);
  });

  it('redistributes a custom share proportionally and preserves the exact total', () => {
    const revised = redistributeExpenseAfterMemberRemoval(expense({
      originalAmount: 100,
      participants: [
        { userId: 'a', amount: 20 },
        { userId: 'b', amount: 40 },
        { userId: 'c', amount: 40 }
      ],
      splitMode: 'custom'
    }), new Set(['b']), ['a', 'c']);

    expect(revised?.participants).toEqual([
      { userId: 'a', amount: 33.33 },
      { userId: 'c', amount: 66.67 }
    ]);
  });

  it('uses all remaining trip members when the removed person was the sole participant', () => {
    const revised = redistributeExpenseAfterMemberRemoval(expense({
      participants: [{ userId: 'b', amount: 120 }],
      splitMode: 'custom'
    }), new Set(['b']), ['a', 'c', 'd']);

    expect(revised?.splitMode).toBe('equal');
    expect(revised?.participants.map(participant => participant.amount)).toEqual([40, 40, 40]);
  });

  it('detects when the removed member paid an expense', () => {
    expect(memberPaidExpense(expense(), new Set(['a']))).toBe(true);
    expect(memberPaidExpense(expense(), new Set(['b']))).toBe(false);
  });
});
