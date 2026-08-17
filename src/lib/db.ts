import Dexie, { type Table } from 'dexie';
import { Trip, TripMember, Household, Expense, Settlement, Activity, PushNotification, User } from '../types';

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

export const TEST_20_EXPENSES: Expense[] = [
  {
    id: 'exp_1',
    tripId: 'trip_leros_2026',
    description: 'Dinner at Mylos',
    category: 'Food',
    originalAmount: 125,
    originalCurrency: 'EUR',
    convertedAmount: 125,
    mainCurrency: 'EUR',
    exchangeRate: 1,
    isManualExchangeRate: false,
    exchangeRateDate: '2026-08-12',
    exchangeRateSource: 'Direct (1:1)',
    paidByUserId: 'user_sevket',
    addedByUserId: 'user_sevket',
    payers: [{ userId: 'user_sevket', amount: 125 }],
    participants: [
      { userId: 'user_ozalp', amount: 25 },
      { userId: 'user_betul', amount: 25 },
      { userId: 'user_sevket', amount: 25 },
      { userId: 'user_erhan', amount: 25 },
      { userId: 'user_janna', amount: 25 }
    ],
    splitMode: 'equal',
    date: '2026-08-12T20:30:00.000Z',
    isDeleted: false,
    isFlaggedWrong: false,
    clientSyncStatus: 'synced',
    createdAt: '2026-08-12T20:35:00.000Z',
    updatedAt: '2026-08-12T20:35:00.000Z'
  },
  {
    id: 'exp_2',
    tripId: 'trip_leros_2026',
    description: 'Airport Taxi',
    category: 'Transport',
    originalAmount: 30,
    originalCurrency: 'EUR',
    convertedAmount: 30,
    mainCurrency: 'EUR',
    exchangeRate: 1,
    isManualExchangeRate: false,
    exchangeRateDate: '2026-08-12',
    exchangeRateSource: 'Direct (1:1)',
    paidByUserId: 'user_ozalp',
    addedByUserId: 'user_ozalp',
    payers: [{ userId: 'user_ozalp', amount: 30 }],
    participants: [
      { userId: 'user_ozalp', amount: 6 },
      { userId: 'user_betul', amount: 6 },
      { userId: 'user_sevket', amount: 6 },
      { userId: 'user_erhan', amount: 6 },
      { userId: 'user_janna', amount: 6 }
    ],
    splitMode: 'equal',
    date: '2026-08-12T14:15:00.000Z',
    isDeleted: false,
    isFlaggedWrong: false,
    clientSyncStatus: 'synced',
    createdAt: '2026-08-12T14:20:00.000Z',
    updatedAt: '2026-08-12T14:20:00.000Z'
  },
  {
    id: 'exp_3',
    tripId: 'trip_leros_2026',
    description: 'Boutique Hotel Deposit',
    category: 'Hotel',
    originalAmount: 250,
    originalCurrency: 'EUR',
    convertedAmount: 250,
    mainCurrency: 'EUR',
    exchangeRate: 1,
    isManualExchangeRate: false,
    exchangeRateDate: '2026-08-13',
    exchangeRateSource: 'Direct (1:1)',
    paidByUserId: 'user_ozalp',
    addedByUserId: 'user_ozalp',
    payers: [
      { userId: 'user_ozalp', amount: 150 },
      { userId: 'user_erhan', amount: 100 }
    ],
    participants: [
      { userId: 'user_ozalp', amount: 50 },
      { userId: 'user_betul', amount: 50 },
      { userId: 'user_sevket', amount: 50 },
      { userId: 'user_erhan', amount: 50 },
      { userId: 'user_janna', amount: 50 }
    ],
    splitMode: 'equal',
    note: 'Split payment between Ozalp and Erhan',
    date: '2026-08-13T11:00:00.000Z',
    isDeleted: false,
    isFlaggedWrong: false,
    clientSyncStatus: 'synced',
    createdAt: '2026-08-13T11:05:00.000Z',
    updatedAt: '2026-08-13T11:05:00.000Z'
  },
  {
    id: 'exp_4',
    tripId: 'trip_leros_2026',
    description: 'Bodrum Taverna',
    category: 'Drinks',
    originalAmount: 5000,
    originalCurrency: 'TRY',
    convertedAmount: 104.17,
    mainCurrency: 'EUR',
    exchangeRate: 0.020833,
    isManualExchangeRate: false,
    exchangeRateDate: '2026-08-14',
    exchangeRateSource: 'Frankfurter ECB (2026-08-14)',
    paidByUserId: 'user_erhan',
    addedByUserId: 'user_erhan',
    payers: [{ userId: 'user_erhan', amount: 5000 }],
    participants: [
      { userId: 'user_ozalp', amount: 1000 },
      { userId: 'user_betul', amount: 1000 },
      { userId: 'user_sevket', amount: 1000 },
      { userId: 'user_erhan', amount: 1000 },
      { userId: 'user_janna', amount: 1000 }
    ],
    splitMode: 'equal',
    date: '2026-08-14T22:00:00.000Z',
    isDeleted: false,
    isFlaggedWrong: false,
    clientSyncStatus: 'synced',
    createdAt: '2026-08-14T22:05:00.000Z',
    updatedAt: '2026-08-14T22:05:00.000Z'
  },
  {
    id: 'exp_5',
    tripId: 'trip_leros_2026',
    description: 'Castle Tickets',
    category: 'Tickets',
    originalAmount: 40,
    originalCurrency: 'EUR',
    convertedAmount: 40,
    mainCurrency: 'EUR',
    exchangeRate: 1,
    isManualExchangeRate: false,
    exchangeRateDate: '2026-08-15',
    exchangeRateSource: 'Direct (1:1)',
    paidByUserId: 'user_ozalp',
    addedByUserId: 'user_ozalp',
    payers: [{ userId: 'user_ozalp', amount: 40 }],
    participants: [
      { userId: 'user_ozalp', amount: 10 },
      { userId: 'user_betul', amount: 10 },
      { userId: 'user_erhan', amount: 10 },
      { userId: 'user_janna', amount: 10 }
    ],
    splitMode: 'equal',
    note: 'Sevket was resting at hotel',
    date: '2026-08-15T15:30:00.000Z',
    isDeleted: false,
    isFlaggedWrong: false,
    clientSyncStatus: 'synced',
    createdAt: '2026-08-15T15:35:00.000Z',
    updatedAt: '2026-08-15T15:35:00.000Z'
  },
  {
    id: 'exp_6',
    tripId: 'trip_leros_2026',
    description: 'Ferry to Kalymnos',
    category: 'Transport',
    originalAmount: 90,
    originalCurrency: 'EUR',
    convertedAmount: 90,
    mainCurrency: 'EUR',
    exchangeRate: 1,
    isManualExchangeRate: false,
    exchangeRateDate: '2026-08-13',
    exchangeRateSource: 'Direct (1:1)',
    paidByUserId: 'user_betul',
    addedByUserId: 'user_betul',
    payers: [{ userId: 'user_betul', amount: 90 }],
    participants: [
      { userId: 'user_ozalp', amount: 18 },
      { userId: 'user_betul', amount: 18 },
      { userId: 'user_sevket', amount: 18 },
      { userId: 'user_erhan', amount: 18 },
      { userId: 'user_janna', amount: 18 }
    ],
    splitMode: 'equal',
    date: '2026-08-13T09:15:00.000Z',
    isDeleted: false,
    isFlaggedWrong: false,
    clientSyncStatus: 'synced',
    createdAt: '2026-08-13T09:20:00.000Z',
    updatedAt: '2026-08-13T09:20:00.000Z'
  },
  {
    id: 'exp_7',
    tripId: 'trip_leros_2026',
    description: 'Supermarket Groceries',
    category: 'Food',
    originalAmount: 75,
    originalCurrency: 'EUR',
    convertedAmount: 75,
    mainCurrency: 'EUR',
    exchangeRate: 1,
    isManualExchangeRate: false,
    exchangeRateDate: '2026-08-13',
    exchangeRateSource: 'Direct (1:1)',
    paidByUserId: 'user_janna',
    addedByUserId: 'user_janna',
    payers: [{ userId: 'user_janna', amount: 75 }],
    participants: [
      { userId: 'user_ozalp', amount: 15 },
      { userId: 'user_betul', amount: 15 },
      { userId: 'user_sevket', amount: 15 },
      { userId: 'user_erhan', amount: 15 },
      { userId: 'user_janna', amount: 15 }
    ],
    splitMode: 'equal',
    date: '2026-08-13T17:40:00.000Z',
    isDeleted: false,
    isFlaggedWrong: false,
    clientSyncStatus: 'synced',
    createdAt: '2026-08-13T17:45:00.000Z',
    updatedAt: '2026-08-13T17:45:00.000Z'
  },
  {
    id: 'exp_8',
    tripId: 'trip_leros_2026',
    description: 'Beach Bar Cocktails',
    category: 'Drinks',
    originalAmount: 55,
    originalCurrency: 'EUR',
    convertedAmount: 55,
    mainCurrency: 'EUR',
    exchangeRate: 1,
    isManualExchangeRate: false,
    exchangeRateDate: '2026-08-14',
    exchangeRateSource: 'Direct (1:1)',
    paidByUserId: 'user_ozalp',
    addedByUserId: 'user_ozalp',
    payers: [{ userId: 'user_ozalp', amount: 55 }],
    participants: [
      { userId: 'user_ozalp', amount: 27.50 },
      { userId: 'user_betul', amount: 27.50 }
    ],
    splitMode: 'equal',
    note: 'Ozalp & Betül afternoon drinks',
    date: '2026-08-14T16:20:00.000Z',
    isDeleted: false,
    isFlaggedWrong: false,
    clientSyncStatus: 'synced',
    createdAt: '2026-08-14T16:25:00.000Z',
    updatedAt: '2026-08-14T16:25:00.000Z'
  },
  {
    id: 'exp_9',
    tripId: 'trip_leros_2026',
    description: 'Scooter Rental (2 days)',
    category: 'Transport',
    originalAmount: 90,
    originalCurrency: 'EUR',
    convertedAmount: 90,
    mainCurrency: 'EUR',
    exchangeRate: 1,
    isManualExchangeRate: false,
    exchangeRateDate: '2026-08-14',
    exchangeRateSource: 'Direct (1:1)',
    paidByUserId: 'user_erhan',
    addedByUserId: 'user_erhan',
    payers: [{ userId: 'user_erhan', amount: 90 }],
    participants: [
      { userId: 'user_erhan', amount: 45 },
      { userId: 'user_janna', amount: 45 }
    ],
    splitMode: 'equal',
    note: 'Erhan and Janna island exploration',
    date: '2026-08-14T10:00:00.000Z',
    isDeleted: false,
    isFlaggedWrong: false,
    clientSyncStatus: 'synced',
    createdAt: '2026-08-14T10:05:00.000Z',
    updatedAt: '2026-08-14T10:05:00.000Z'
  },
  {
    id: 'exp_10',
    tripId: 'trip_leros_2026',
    description: 'Seafood Lunch at Panteli',
    category: 'Food',
    originalAmount: 160,
    originalCurrency: 'EUR',
    convertedAmount: 160,
    mainCurrency: 'EUR',
    exchangeRate: 1,
    isManualExchangeRate: false,
    exchangeRateDate: '2026-08-14',
    exchangeRateSource: 'Direct (1:1)',
    paidByUserId: 'user_erhan',
    addedByUserId: 'user_erhan',
    payers: [{ userId: 'user_erhan', amount: 160 }],
    participants: [
      { userId: 'user_ozalp', amount: 32 },
      { userId: 'user_betul', amount: 32 },
      { userId: 'user_sevket', amount: 32 },
      { userId: 'user_erhan', amount: 32 },
      { userId: 'user_janna', amount: 32 }
    ],
    splitMode: 'equal',
    date: '2026-08-14T13:30:00.000Z',
    isDeleted: false,
    isFlaggedWrong: false,
    clientSyncStatus: 'synced',
    createdAt: '2026-08-14T13:35:00.000Z',
    updatedAt: '2026-08-14T13:35:00.000Z'
  },
  {
    id: 'exp_11',
    tripId: 'trip_leros_2026',
    description: 'Souvenirs & Greek Olive Oil',
    category: 'Other',
    originalAmount: 50,
    originalCurrency: 'USD',
    convertedAmount: 46.00,
    mainCurrency: 'EUR',
    exchangeRate: 0.92,
    isManualExchangeRate: false,
    exchangeRateDate: '2026-08-15',
    exchangeRateSource: 'Frankfurter ECB (2026-08-15)',
    paidByUserId: 'user_janna',
    addedByUserId: 'user_janna',
    payers: [{ userId: 'user_janna', amount: 50 }],
    participants: [
      { userId: 'user_ozalp', amount: 10 },
      { userId: 'user_betul', amount: 10 },
      { userId: 'user_sevket', amount: 10 },
      { userId: 'user_erhan', amount: 10 },
      { userId: 'user_janna', amount: 10 }
    ],
    splitMode: 'equal',
    date: '2026-08-15T11:20:00.000Z',
    isDeleted: false,
    isFlaggedWrong: false,
    clientSyncStatus: 'synced',
    createdAt: '2026-08-15T11:25:00.000Z',
    updatedAt: '2026-08-15T11:25:00.000Z'
  },
  {
    id: 'exp_12',
    tripId: 'trip_leros_2026',
    description: 'Pharmacy & Sunscreen',
    category: 'Other',
    originalAmount: 25,
    originalCurrency: 'EUR',
    convertedAmount: 25,
    mainCurrency: 'EUR',
    exchangeRate: 1,
    isManualExchangeRate: false,
    exchangeRateDate: '2026-08-13',
    exchangeRateSource: 'Direct (1:1)',
    paidByUserId: 'user_ozalp',
    addedByUserId: 'user_ozalp',
    payers: [{ userId: 'user_ozalp', amount: 25 }],
    participants: [
      { userId: 'user_ozalp', amount: 5 },
      { userId: 'user_betul', amount: 5 },
      { userId: 'user_sevket', amount: 5 },
      { userId: 'user_erhan', amount: 5 },
      { userId: 'user_janna', amount: 5 }
    ],
    splitMode: 'equal',
    date: '2026-08-13T12:10:00.000Z',
    isDeleted: false,
    isFlaggedWrong: false,
    clientSyncStatus: 'synced',
    createdAt: '2026-08-13T12:15:00.000Z',
    updatedAt: '2026-08-13T12:15:00.000Z'
  },
  {
    id: 'exp_13',
    tripId: 'trip_leros_2026',
    description: 'Boat Trip to Aspronisi',
    category: 'Tickets',
    originalAmount: 175,
    originalCurrency: 'EUR',
    convertedAmount: 175,
    mainCurrency: 'EUR',
    exchangeRate: 1,
    isManualExchangeRate: false,
    exchangeRateDate: '2026-08-15',
    exchangeRateSource: 'Direct (1:1)',
    paidByUserId: 'user_erhan',
    addedByUserId: 'user_erhan',
    payers: [
      { userId: 'user_erhan', amount: 95 },
      { userId: 'user_ozalp', amount: 80 }
    ],
    participants: [
      { userId: 'user_ozalp', amount: 35 },
      { userId: 'user_betul', amount: 35 },
      { userId: 'user_sevket', amount: 35 },
      { userId: 'user_erhan', amount: 35 },
      { userId: 'user_janna', amount: 35 }
    ],
    splitMode: 'equal',
    note: 'Co-paid by Erhan & Ozalp',
    date: '2026-08-15T10:00:00.000Z',
    isDeleted: false,
    isFlaggedWrong: false,
    clientSyncStatus: 'synced',
    createdAt: '2026-08-15T10:05:00.000Z',
    updatedAt: '2026-08-15T10:05:00.000Z'
  },
  {
    id: 'exp_14',
    tripId: 'trip_leros_2026',
    description: 'Windmill Cafe & Desserts',
    category: 'Food',
    originalAmount: 35,
    originalCurrency: 'EUR',
    convertedAmount: 35,
    mainCurrency: 'EUR',
    exchangeRate: 1,
    isManualExchangeRate: false,
    exchangeRateDate: '2026-08-15',
    exchangeRateSource: 'Direct (1:1)',
    paidByUserId: 'user_betul',
    addedByUserId: 'user_betul',
    payers: [{ userId: 'user_betul', amount: 35 }],
    participants: [
      { userId: 'user_ozalp', amount: 7 },
      { userId: 'user_betul', amount: 7 },
      { userId: 'user_sevket', amount: 7 },
      { userId: 'user_erhan', amount: 7 },
      { userId: 'user_janna', amount: 7 }
    ],
    splitMode: 'equal',
    date: '2026-08-15T18:00:00.000Z',
    isDeleted: false,
    isFlaggedWrong: false,
    clientSyncStatus: 'synced',
    createdAt: '2026-08-15T18:05:00.000Z',
    updatedAt: '2026-08-15T18:05:00.000Z'
  },
  {
    id: 'exp_15',
    tripId: 'trip_leros_2026',
    description: 'SIM Card Roaming Data',
    category: 'Other',
    originalAmount: 1500,
    originalCurrency: 'TRY',
    convertedAmount: 31.25,
    mainCurrency: 'EUR',
    exchangeRate: 0.020833,
    isManualExchangeRate: false,
    exchangeRateDate: '2026-08-12',
    exchangeRateSource: 'Frankfurter ECB (2026-08-12)',
    paidByUserId: 'user_sevket',
    addedByUserId: 'user_sevket',
    payers: [{ userId: 'user_sevket', amount: 1500 }],
    participants: [
      { userId: 'user_ozalp', amount: 500 },
      { userId: 'user_sevket', amount: 500 },
      { userId: 'user_erhan', amount: 500 }
    ],
    splitMode: 'equal',
    date: '2026-08-12T16:00:00.000Z',
    isDeleted: false,
    isFlaggedWrong: false,
    clientSyncStatus: 'synced',
    createdAt: '2026-08-12T16:05:00.000Z',
    updatedAt: '2026-08-12T16:05:00.000Z'
  },
  {
    id: 'exp_16',
    tripId: 'trip_leros_2026',
    description: 'Harbor Parking Fee',
    category: 'Transport',
    originalAmount: 15,
    originalCurrency: 'EUR',
    convertedAmount: 15,
    mainCurrency: 'EUR',
    exchangeRate: 1,
    isManualExchangeRate: false,
    exchangeRateDate: '2026-08-14',
    exchangeRateSource: 'Direct (1:1)',
    paidByUserId: 'user_janna',
    addedByUserId: 'user_janna',
    payers: [{ userId: 'user_janna', amount: 15 }],
    participants: [
      { userId: 'user_ozalp', amount: 3 },
      { userId: 'user_betul', amount: 3 },
      { userId: 'user_sevket', amount: 3 },
      { userId: 'user_erhan', amount: 3 },
      { userId: 'user_janna', amount: 3 }
    ],
    splitMode: 'equal',
    date: '2026-08-14T23:30:00.000Z',
    isDeleted: false,
    isFlaggedWrong: false,
    clientSyncStatus: 'synced',
    createdAt: '2026-08-14T23:35:00.000Z',
    updatedAt: '2026-08-14T23:35:00.000Z'
  },
  {
    id: 'exp_17',
    tripId: 'trip_leros_2026',
    description: 'Sunset Wine & Cheese',
    category: 'Drinks',
    originalAmount: 50,
    originalCurrency: 'EUR',
    convertedAmount: 50,
    mainCurrency: 'EUR',
    exchangeRate: 1,
    isManualExchangeRate: false,
    exchangeRateDate: '2026-08-15',
    exchangeRateSource: 'Direct (1:1)',
    paidByUserId: 'user_ozalp',
    addedByUserId: 'user_ozalp',
    payers: [{ userId: 'user_ozalp', amount: 50 }],
    participants: [
      { userId: 'user_ozalp', amount: 10 },
      { userId: 'user_betul', amount: 10 },
      { userId: 'user_sevket', amount: 10 },
      { userId: 'user_erhan', amount: 10 },
      { userId: 'user_janna', amount: 10 }
    ],
    splitMode: 'equal',
    date: '2026-08-15T20:15:00.000Z',
    isDeleted: false,
    isFlaggedWrong: false,
    clientSyncStatus: 'synced',
    createdAt: '2026-08-15T20:20:00.000Z',
    updatedAt: '2026-08-15T20:20:00.000Z'
  },
  {
    id: 'exp_18',
    tripId: 'trip_leros_2026',
    description: 'Scuba Diving Session',
    category: 'Tickets',
    originalAmount: 240,
    originalCurrency: 'EUR',
    convertedAmount: 240,
    mainCurrency: 'EUR',
    exchangeRate: 1,
    isManualExchangeRate: false,
    exchangeRateDate: '2026-08-16',
    exchangeRateSource: 'Direct (1:1)',
    paidByUserId: 'user_sevket',
    addedByUserId: 'user_sevket',
    payers: [{ userId: 'user_sevket', amount: 240 }],
    participants: [
      { userId: 'user_sevket', amount: 80 },
      { userId: 'user_erhan', amount: 80 },
      { userId: 'user_janna', amount: 80 }
    ],
    splitMode: 'equal',
    note: 'Sevket, Erhan, and Janna reef diving',
    date: '2026-08-16T11:00:00.000Z',
    isDeleted: false,
    isFlaggedWrong: false,
    clientSyncStatus: 'synced',
    createdAt: '2026-08-16T11:05:00.000Z',
    updatedAt: '2026-08-16T11:05:00.000Z'
  },
  {
    id: 'exp_19',
    tripId: 'trip_leros_2026',
    description: 'Bakery Morning Pastries',
    category: 'Food',
    originalAmount: 20,
    originalCurrency: 'EUR',
    convertedAmount: 20,
    mainCurrency: 'EUR',
    exchangeRate: 1,
    isManualExchangeRate: false,
    exchangeRateDate: '2026-08-16',
    exchangeRateSource: 'Direct (1:1)',
    paidByUserId: 'user_betul',
    addedByUserId: 'user_betul',
    payers: [{ userId: 'user_betul', amount: 20 }],
    participants: [
      { userId: 'user_ozalp', amount: 4 },
      { userId: 'user_betul', amount: 4 },
      { userId: 'user_sevket', amount: 4 },
      { userId: 'user_erhan', amount: 4 },
      { userId: 'user_janna', amount: 4 }
    ],
    splitMode: 'equal',
    date: '2026-08-16T08:45:00.000Z',
    isDeleted: false,
    isFlaggedWrong: false,
    clientSyncStatus: 'synced',
    createdAt: '2026-08-16T08:50:00.000Z',
    updatedAt: '2026-08-16T08:50:00.000Z'
  },
  {
    id: 'exp_20',
    tripId: 'trip_leros_2026',
    description: 'Farewell Dinner at Alinda',
    category: 'Food',
    originalAmount: 225,
    originalCurrency: 'EUR',
    convertedAmount: 225,
    mainCurrency: 'EUR',
    exchangeRate: 1,
    isManualExchangeRate: false,
    exchangeRateDate: '2026-08-16',
    exchangeRateSource: 'Direct (1:1)',
    paidByUserId: 'user_ozalp',
    addedByUserId: 'user_ozalp',
    payers: [{ userId: 'user_ozalp', amount: 225 }],
    participants: [
      { userId: 'user_ozalp', amount: 45 },
      { userId: 'user_betul', amount: 45 },
      { userId: 'user_sevket', amount: 45 },
      { userId: 'user_erhan', amount: 45 },
      { userId: 'user_janna', amount: 45 }
    ],
    splitMode: 'equal',
    date: '2026-08-16T21:00:00.000Z',
    isDeleted: false,
    isFlaggedWrong: false,
    clientSyncStatus: 'synced',
    createdAt: '2026-08-16T21:05:00.000Z',
    updatedAt: '2026-08-16T21:05:00.000Z'
  }
];

// Seed initial mock trip and data
export async function seedInitialDataIfNeeded(force = false) {
  const existingTrip = await db.trips.get('trip_leros_2026');
  if (existingTrip && !force) {
    return;
  }

  const ozalpUser: User = {
    id: 'user_ozalp',
    name: 'Ozalp',
    email: 'ozalp@example.com',
    defaultCurrency: 'EUR'
  };

  const betulUser: User = {
    id: 'user_betul',
    name: 'Betül',
    email: 'betul@example.com',
    defaultCurrency: 'EUR'
  };

  const sevketUser: User = {
    id: 'user_sevket',
    name: 'Sevket',
    email: 'sevket@example.com',
    defaultCurrency: 'EUR'
  };

  const erhanUser: User = {
    id: 'user_erhan',
    name: 'Erhan',
    email: 'erhan@example.com',
    defaultCurrency: 'EUR'
  };

  const jannaUser: User = {
    id: 'user_janna',
    name: 'Janna',
    email: 'janna@example.com',
    defaultCurrency: 'EUR'
  };

  // Keep users updated with Ozalp, Betül, Sevket, Erhan, and Janna
  await db.users.clear();
  await db.users.bulkPut([ozalpUser, betulUser, sevketUser, erhanUser, jannaUser]);

  const tripId = 'trip_leros_2026';
  const lerosTrip: Trip = {
    id: tripId,
    name: 'Leros 2026',
    emoji: '',
    startDate: '2026-08-12',
    endDate: '2026-08-16',
    mainCurrency: 'EUR',
    ownerId: 'user_ozalp',
    isClosed: false,
    isDeleted: false,
    createdAt: '2026-08-12T10:00:00.000Z',
    updatedAt: '2026-08-17T12:00:00.000Z',
    clientSyncStatus: 'synced'
  };
  await db.trips.put(lerosTrip);

  const members: TripMember[] = [
    { id: 'm_1', tripId, userId: 'user_ozalp', name: 'Ozalp', email: 'ozalp@example.com', role: 'owner', isActive: true, joinedAt: '2026-08-12T10:00:00.000Z' },
    { id: 'm_2', tripId, userId: 'user_betul', name: 'Betül', email: 'betul@example.com', role: 'member', isActive: true, joinedAt: '2026-08-12T10:05:00.000Z' },
    { id: 'm_3', tripId, userId: 'user_sevket', name: 'Sevket', email: 'sevket@example.com', role: 'member', isActive: true, joinedAt: '2026-08-12T10:10:00.000Z' },
    { id: 'm_4', tripId, userId: 'user_erhan', name: 'Erhan', email: 'erhan@example.com', role: 'member', isActive: true, joinedAt: '2026-08-12T10:15:00.000Z' },
    { id: 'm_5', tripId, userId: 'user_janna', name: 'Janna', email: 'janna@example.com', role: 'member', isActive: true, joinedAt: '2026-08-12T10:20:00.000Z' },
  ];
  await db.tripMembers.where('tripId').equals(tripId).delete();
  await db.tripMembers.bulkPut(members);

  const households: Household[] = [
    {
      id: 'hh_ozalp_betul',
      tripId,
      name: 'Ozalp + Betül',
      memberUserIds: ['user_ozalp', 'user_betul'],
      createdAt: '2026-08-12T10:20:00.000Z'
    },
    {
      id: 'hh_erhan_janna',
      tripId,
      name: 'Erhan + Janna',
      memberUserIds: ['user_erhan', 'user_janna'],
      createdAt: '2026-08-12T10:25:00.000Z'
    }
  ];
  await db.households.where('tripId').equals(tripId).delete();
  await db.households.bulkPut(households);

  // Bulk put the 20 test expenses
  await db.expenses.where('tripId').equals(tripId).delete();
  await db.expenses.bulkPut(TEST_20_EXPENSES);

  // Seed rich audit log
  const activities: Activity[] = [
    {
      id: 'act_1',
      tripId,
      userId: 'user_ozalp',
      userName: 'Ozalp',
      type: 'trip_created',
      description: 'created trip Leros 2026',
      createdAt: '2026-08-12T10:00:00.000Z'
    },
    ...TEST_20_EXPENSES.map((e, idx) => ({
      id: `act_exp_${idx + 1}`,
      tripId,
      userId: e.addedByUserId,
      userName: e.addedByUserId === 'user_ozalp' ? 'Ozalp' : e.addedByUserId === 'user_betul' ? 'Betül' : e.addedByUserId === 'user_sevket' ? 'Sevket' : e.addedByUserId === 'user_erhan' ? 'Erhan' : 'Janna',
      type: 'expense_added' as const,
      description: `added ${e.originalCurrency === 'EUR' ? '€' : e.originalCurrency === 'TRY' ? '₺' : '$'}${e.originalAmount} ${e.description}`,
      createdAt: e.createdAt
    }))
  ];

  await db.activities.where('tripId').equals(tripId).delete();
  await db.activities.bulkPut(activities);
}
