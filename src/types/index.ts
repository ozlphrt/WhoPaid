export type CurrencyCode = 'EUR' | 'USD' | 'GBP' | 'TRY' | 'JPY' | 'CHF' | 'CAD' | 'AUD' | 'SEK' | 'NOK' | 'DKK' | 'PLN' | 'CZK' | 'HUF' | 'RON' | 'BGN' | 'ILS' | 'BRL' | 'MXN' | 'SGD' | 'HKD' | 'NZD' | 'THB' | 'IDR' | 'MYR' | 'PHP' | 'KRW' | 'INR' | 'ZAR' | string;

export type ExpenseCategory = 'Food' | 'Drinks' | 'Transport' | 'Hotel' | 'Tickets' | 'Other';

export type AppView = 'trips' | 'trip-home' | 'expenses' | 'balances' | 'settle' | 'report' | 'settings' | 'activity' | 'archive' | 'profile';

export interface User {
  id: string;
  name: string;
  email: string;
  defaultCurrency: CurrencyCode;
  avatarUrl?: string;
}

export interface Trip {
  id: string;
  name: string;
  emoji: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  mainCurrency: CurrencyCode;
  ownerId: string;
  /** Legacy compatibility only; authorization uses per-user membership docs. */
  memberUids?: string[];
  /** Cryptographically random bearer token used by share links. */
  inviteToken?: string;
  /** Content counts captured when the owner last prepared an invitation. */
  shareMemberCount?: number;
  shareExpenseCount?: number;
  sharePreparedAt?: string;
  isClosed: boolean;
  closedAt?: string;
  isDeleted: boolean;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
  clientSyncStatus?: 'synced' | 'pending' | 'conflict' | 'failed';
}

export interface TripMember {
  id: string;
  tripId: string;
  userId: string;
  /** Supabase Auth user ID when this participant has joined the trip. */
  authUid?: string;
  /** Exact historical IDs retained when an invited placeholder is claimed. */
  legacyUserIds?: string[];
  name: string;
  email: string;
  role: 'owner' | 'member';
  isActive: boolean;
  joinedAt: string;
}

export interface Household {
  id: string;
  tripId: string;
  name: string;
  memberUserIds: string[]; // List of user IDs in this household
  createdAt: string;
}

export interface ExpensePayer {
  userId: string;
  amount: number; // in originalCurrency
}

export interface ExpenseParticipant {
  userId: string;
  amount: number; // in originalCurrency (their share)
  convertedAmount?: number; // in mainCurrency
}

export interface Expense {
  id: string;
  tripId: string;
  description: string;
  category: ExpenseCategory;
  originalAmount: number;
  originalCurrency: CurrencyCode;
  convertedAmount: number; // In trip's mainCurrency at rate of expense date
  mainCurrency: CurrencyCode;
  exchangeRate: number; // 1 originalCurrency = exchangeRate mainCurrency
  isManualExchangeRate: boolean;
  exchangeRateDate: string; // YYYY-MM-DD
  exchangeRateSource?: string; // e.g. "ECB / Frankfurter" or "Manual Override"
  paidByUserId: string; // Primary payer if single payer
  addedByUserId: string; // Who created the entry
  payers: ExpensePayer[]; // Supports multiple payers
  participants: ExpenseParticipant[]; // Included people
  splitMode: 'equal' | 'custom';
  note?: string;
  receiptUrl?: string; // Base64 or Blob storage URL
  date: string; // ISO string / YYYY-MM-DDTHH:mm
  isDeleted: boolean;
  deletedAt?: string;
  isFlaggedWrong: boolean;
  flaggedReason?: 'I wasn\'t there' | 'Wrong amount' | 'Wrong split' | 'Duplicate' | 'Other';
  flaggedByUserId?: string;
  flaggedAt?: string;
  clientSyncStatus: 'synced' | 'pending' | 'conflict' | 'failed';
  createdAt: string;
  updatedAt: string;
  isPossibleDuplicate?: boolean;
}

export interface Settlement {
  id: string;
  tripId: string;
  debtorId: string; // Person who owes money / marked paid
  creditorId: string; // Person who was owed money / confirms receipt
  amount: number; // in settlement currency
  currency: CurrencyCode;
  convertedAmount: number; // in trip mainCurrency
  mainCurrency: CurrencyCode;
  exchangeRate: number;
  status: 'pending_confirmation' | 'completed' | 'cancelled';
  paidAt?: string;
  confirmedAt?: string;
  reminderSentAt?: string;
  createdAt: string;
  notes?: string;
}

export interface Activity {
  id: string;
  tripId: string;
  userId: string;
  userName: string;
  type: 
    | 'expense_added'
    | 'expense_edited'
    | 'expense_deleted'
    | 'expense_flagged'
    | 'settlement_initiated'
    | 'settlement_confirmed'
    | 'trip_closed'
    | 'trip_reopened'
    | 'trip_created'
    | 'member_joined'
    | 'member_left';
  description: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface PushNotification {
  id: string;
  userId: string;
  tripId?: string;
  title: string;
  body: string;
  type: 'expense_added' | 'expense_edited' | 'expense_deleted' | 'settlement_requested' | 'settlement_marked_paid' | 'settlement_confirmed' | 'settlement_reminder' | 'trip_invitation';
  isRead: boolean;
  actionPayload?: any;
  createdAt: string;
}

export interface RecommendedTransfer {
  debtorId: string;
  debtorName: string;
  debtorHouseholdName?: string;
  creditorId: string;
  creditorName: string;
  creditorHouseholdName?: string;
  amount: number; // in main currency
  currency: CurrencyCode;
}

export interface ParticipantBalance {
  userId: string;
  name: string;
  householdId?: string;
  householdName?: string;
  paid: number;   // Total paid in main currency
  share: number;  // Total share/consumed in main currency
  net: number;    // paid - share (+ means owed, - means owes)
}

export interface HouseholdBalance {
  householdId: string;
  name: string;
  memberUserIds: string[];
  paid: number;
  share: number;
  net: number;
}
