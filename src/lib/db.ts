import Dexie, { type Table } from 'dexie';
import type {
  Activity,
  Expense,
  Household,
  PushNotification,
  Settlement,
  Trip,
  TripMember,
  User
} from '../types';

export class WhoPaidDatabase extends Dexie {
  users!: Table<User, string>;
  trips!: Table<Trip, string>;
  tripMembers!: Table<TripMember, string>;
  households!: Table<Household, string>;
  expenses!: Table<Expense, string>;
  settlements!: Table<Settlement, string>;
  activities!: Table<Activity, string>;
  notifications!: Table<PushNotification, string>;

  constructor() {
    super('WhoPaidDatabase');
    this.version(1).stores({
      users: 'id, email',
      trips: 'id, ownerId, isClosed, isDeleted, updatedAt',
      tripMembers: 'id, tripId, userId, role, isActive',
      households: 'id, tripId',
      expenses: 'id, tripId, paidByUserId, addedByUserId, date, isDeleted, isFlaggedWrong, clientSyncStatus',
      settlements: 'id, tripId, debtorId, creditorId, status',
      activities: 'id, tripId, userId, createdAt',
      notifications: 'id, userId, tripId, isRead, createdAt'
    });
  }
}

export const db = new WhoPaidDatabase();

/** Retained as a no-op for existing initialization call sites. */
export async function seedInitialDataIfNeeded(): Promise<void> {
  // Production data is created only through explicit user actions.
}
