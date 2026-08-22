import { describe, expect, it } from 'vitest';
import type { Expense } from '../types';
import { addMemberToEqualExpense } from './expenseParticipation';

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
