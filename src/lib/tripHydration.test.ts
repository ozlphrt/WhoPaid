import { describe, expect, it } from 'vitest';
import type { Expense, Trip, TripMember } from '../types';
import { assertTripContentsHydrated } from './tripHydration';

const trip = (overrides: Partial<Trip> = {}) => ({
  id: 'trip-1',
  name: 'Trip',
  emoji: '',
  startDate: '2026-08-01',
  endDate: '2026-08-02',
  mainCurrency: 'EUR',
  ownerId: 'owner',
  isClosed: false,
  isDeleted: false,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  ...overrides
}) as Trip;

const member = { id: 'member-1', tripId: 'trip-1' } as TripMember;
const expense = { id: 'expense-1', tripId: 'trip-1' } as Expense;

describe('joined trip hydration', () => {
  it('accepts a complete trip bundle', () => {
    expect(() => assertTripContentsHydrated(
      trip({ shareMemberCount: 1, shareExpenseCount: 1 }),
      [member],
      [expense]
    )).not.toThrow();
  });

  it('rejects missing participants even for legacy invitations', () => {
    expect(() => assertTripContentsHydrated(trip(), [], [])).toThrow('participants were not downloaded');
  });

  it('rejects partial expense downloads when the share contract has counts', () => {
    expect(() => assertTripContentsHydrated(
      trip({ shareMemberCount: 1, shareExpenseCount: 2 }),
      [member],
      [expense]
    )).toThrow('Only 1 of 2 trip expenses');
  });
});
