import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createTripPDFDocument } from '../src/lib/export';
import type { Expense, ParticipantBalance, RecommendedTransfer, Trip, TripMember } from '../src/types';

const trip: Trip = {
  id: 'trip-preview',
  name: 'Lisbon & Sintra Summer Escape',
  emoji: '',
  startDate: '2026-07-04',
  endDate: '2026-07-12',
  mainCurrency: 'EUR',
  ownerId: 'member-1',
  isClosed: false,
  isDeleted: false,
  createdAt: '2026-07-01T08:00:00Z',
  updatedAt: '2026-07-12T20:00:00Z'
};

const memberNames = [
  'Alex Morgan',
  'Jordan Lee',
  'Samira Benali',
  'Christopher Montgomery',
  'Elena Rossi',
  'Mert Yilmaz'
];

const members: TripMember[] = memberNames.map((name, index) => ({
  id: `member-${index + 1}`,
  tripId: trip.id,
  userId: `member-${index + 1}`,
  name,
  email: `traveler${index + 1}@example.com`,
  role: index === 0 ? 'owner' : 'member',
  isActive: true,
  joinedAt: '2026-07-01T08:00:00Z'
}));

const descriptions = [
  'Welcome dinner near Praca do Comercio',
  'Airport transfer and luggage surcharge',
  'Three-night apartment deposit',
  'Sintra palace entry tickets',
  'Coffee, pastries and fresh orange juice',
  'Late-night groceries for the apartment',
  'Train tickets to Cascais',
  'Seafood lunch overlooking the marina'
];
const categories: Expense['category'][] = ['Food', 'Transport', 'Hotel', 'Tickets', 'Drinks', 'Other'];

const expenses: Expense[] = Array.from({ length: 38 }, (_, index) => {
  const amount = 18.5 + ((index * 17.35) % 146);
  const payer = members[index % members.length];
  return {
    id: `expense-${index + 1}`,
    tripId: trip.id,
    description: descriptions[index % descriptions.length],
    category: categories[index % categories.length],
    originalAmount: amount,
    originalCurrency: index % 7 === 0 ? 'USD' : 'EUR',
    convertedAmount: index % 7 === 0 ? amount * 0.92 : amount,
    mainCurrency: 'EUR',
    exchangeRate: index % 7 === 0 ? 0.92 : 1,
    isManualExchangeRate: false,
    exchangeRateDate: `2026-07-${String(4 + (index % 9)).padStart(2, '0')}`,
    paidByUserId: payer.userId,
    addedByUserId: payer.userId,
    payers: [{ userId: payer.userId, amount }],
    participants: members.map(member => ({
      userId: member.userId,
      amount: amount / members.length,
      convertedAmount: amount / members.length
    })),
    splitMode: 'equal',
    date: `2026-07-${String(4 + (index % 9)).padStart(2, '0')}T12:00:00Z`,
    isDeleted: false,
    isFlaggedWrong: false,
    clientSyncStatus: 'synced',
    createdAt: '2026-07-04T12:00:00Z',
    updatedAt: '2026-07-04T12:00:00Z'
  };
});

const totalSpend = expenses.reduce((sum, expense) => sum + expense.convertedAmount, 0);
const balances: ParticipantBalance[] = [
  { userId: 'member-1', name: memberNames[0], paid: 985.42, share: 640.2, net: 345.22 },
  { userId: 'member-2', name: memberNames[1], paid: 312.2, share: 592.44, net: -280.24 },
  { userId: 'member-3', name: memberNames[2], householdName: 'Benali Family', paid: 710.1, share: 610.05, net: 100.05 },
  { userId: 'member-4', name: memberNames[3], householdName: 'Montgomery Household', paid: 260.5, share: 496.41, net: -235.91 },
  { userId: 'member-5', name: memberNames[4], paid: 502.7, share: 468.32, net: 34.38 },
  { userId: 'member-6', name: memberNames[5], paid: 366.65, share: 330.43, net: 36.22 }
];

const transfers: RecommendedTransfer[] = [
  { debtorId: 'member-2', debtorName: memberNames[1], creditorId: 'member-1', creditorName: memberNames[0], amount: 280.24, currency: 'EUR' },
  { debtorId: 'member-4', debtorName: memberNames[3], debtorHouseholdName: 'Montgomery Household', creditorId: 'member-1', creditorName: memberNames[0], amount: 64.98, currency: 'EUR' },
  { debtorId: 'member-4', debtorName: memberNames[3], creditorId: 'member-3', creditorName: memberNames[2], creditorHouseholdName: 'Benali Family', amount: 100.05, currency: 'EUR' },
  { debtorId: 'member-4', debtorName: memberNames[3], creditorId: 'member-5', creditorName: memberNames[4], amount: 34.38, currency: 'EUR' },
  { debtorId: 'member-4', debtorName: memberNames[3], creditorId: 'member-6', creditorName: memberNames[5], amount: 36.22, currency: 'EUR' }
];

const categorySpend = categories.map(category => {
  const amount = expenses
    .filter(expense => expense.category === category)
    .reduce((sum, expense) => sum + expense.convertedAmount, 0);
  return { category, amount, percentage: totalSpend > 0 ? (amount / totalSpend) * 100 : 0 };
});

const document = createTripPDFDocument(
  trip,
  members,
  expenses,
  balances,
  transfers,
  categorySpend,
  totalSpend
);
const outputDirectory = resolve('output/pdf');
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(
  resolve(outputDirectory, 'WhoPaid_Sample_Report.pdf'),
  Buffer.from(document.output('arraybuffer'))
);
