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

const PERSISTENCE_BACKEND_KEY = 'whopaid_persistence_backend';
const CURRENT_PERSISTENCE_BACKEND = 'supabase-v1';
let backendMigrationPromise: Promise<void> | null = null;

/**
 * Removes the previous Firebase-era browser cache exactly once per origin.
 * Supabase Auth uses a separate storage key and remains signed in; authorized
 * trips are downloaded again after the app starts.
 */
export function clearLegacyBackendCacheIfNeeded(): Promise<void> {
  if (localStorage.getItem(PERSISTENCE_BACKEND_KEY) === CURRENT_PERSISTENCE_BACKEND) {
    return Promise.resolve();
  }
  if (backendMigrationPromise) return backendMigrationPromise;

  backendMigrationPromise = db.transaction(
    'rw',
    [
      db.users,
      db.trips,
      db.tripMembers,
      db.households,
      db.expenses,
      db.settlements,
      db.activities,
      db.notifications
    ],
    async () => {
      await Promise.all([
        db.users.clear(),
        db.trips.clear(),
        db.tripMembers.clear(),
        db.households.clear(),
        db.expenses.clear(),
        db.settlements.clear(),
        db.activities.clear(),
        db.notifications.clear()
      ]);
    }
  ).then(() => {
    localStorage.removeItem('whopaid_auth_user');
    localStorage.removeItem('whopaid_last_auth_uid');
    localStorage.removeItem('whopaid_active_trip');
    localStorage.removeItem('whopaid_last_view');
    localStorage.setItem(PERSISTENCE_BACKEND_KEY, CURRENT_PERSISTENCE_BACKEND);
  }).finally(() => {
    backendMigrationPromise = null;
  });

  return backendMigrationPromise;
}

/** Retained as a no-op for existing initialization call sites. */
export async function seedInitialDataIfNeeded(): Promise<void> {
  // Production data is created only through explicit user actions.
}
