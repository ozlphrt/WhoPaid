import type { Expense, Trip, TripMember } from '../types';

export function assertTripContentsHydrated(
  trip: Trip,
  members: TripMember[],
  expenses: Expense[]
): void {
  if (members.length === 0) {
    throw new Error('Trip participants were not downloaded.');
  }
  if (trip.shareMemberCount !== undefined && members.length < trip.shareMemberCount) {
    throw new Error(`Only ${members.length} of ${trip.shareMemberCount} trip participants were downloaded.`);
  }
  if (trip.shareExpenseCount !== undefined && expenses.length < trip.shareExpenseCount) {
    throw new Error(`Only ${expenses.length} of ${trip.shareExpenseCount} trip expenses were downloaded.`);
  }
}
