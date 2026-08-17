import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db, seedInitialDataIfNeeded } from '../lib/db';
import { User, Trip, TripMember, Household, Expense, Settlement, Activity, PushNotification, CurrencyCode } from '../types';
import { calculateParticipantBalances } from '../lib/balances';
import { calculateOptimizedSettlements } from '../lib/settlement';
import { fetchHistoricalExchangeRate, convertAmount } from '../lib/fx';
import { add, sub, roundMoney } from '../lib/decimal';
import { checkForDuplicateExpense } from '../lib/duplicate';

interface UndoState {
  expense: Expense;
  timeoutId: any;
}

interface AppContextType {
  currentUser: User;
  setCurrentUser: (u: User) => void;
  allUsers: User[];
  
  // Active Trip
  activeTrip: Trip | null;
  setActiveTripId: (id: string | null) => void;
  
  // Trip Data
  trips: Trip[];
  archivedTrips: Trip[];
  deletedTrips: Trip[];
  members: TripMember[];
  households: Household[];
  expenses: Expense[];
  settlements: Settlement[];
  activities: Activity[];
  notifications: PushNotification[];
  
  // Calculations for active trip
  balances: ReturnType<typeof calculateParticipantBalances>;
  recommendedTransfers: ReturnType<typeof calculateOptimizedSettlements>;
  userNetBalance: number;
  lastUsedCurrency: CurrencyCode;
  
  // Actions
  createTrip: (trip: Omit<Trip, 'id' | 'createdAt' | 'updatedAt'>, memberEmails: string[]) => Promise<string>;
  updateTrip: (trip: Trip) => Promise<void>;
  closeTrip: (tripId: string) => Promise<void>;
  reopenTrip: (tripId: string) => Promise<void>;
  deleteTrip: (tripId: string) => Promise<void>;
  restoreTrip: (tripId: string) => Promise<void>;
  permanentlyDeleteTrip: (tripId: string) => Promise<void>;
  
  // Member & Household Actions
  addMember: (tripId: string, email: string, name: string) => Promise<void>;
  setMemberActive: (memberId: string, isActive: boolean) => Promise<void>;
  saveHousehold: (household: Omit<Household, 'id' | 'createdAt'>, existingId?: string) => Promise<void>;
  deleteHousehold: (householdId: string) => Promise<void>;
  transferOwnership: (tripId: string, newOwnerUserId: string) => Promise<void>;

  // Expense Actions
  addExpense: (expenseData: Partial<Expense>) => Promise<{ expense: Expense; isDuplicate: boolean; duplicateReason?: string }>;
  updateExpense: (expense: Expense) => Promise<void>;
  deleteExpense: (expenseId: string) => Promise<void>;
  flagExpenseWrong: (expenseId: string, reason: Expense['flaggedReason']) => Promise<void>;
  undoLastExpense: () => Promise<void>;
  undoState: UndoState | null;
  dismissUndo: () => void;

  // Settlement Actions
  initiateSettlement: (data: {
    debtorId: string;
    creditorId: string;
    amount: number;
    currency: CurrencyCode;
    notes?: string;
  }) => Promise<void>;
  confirmSettlement: (settlementId: string) => Promise<void>;
  cancelSettlement: (settlementId: string) => Promise<void>;

  // Activity & Notifications
  addActivity: (type: Activity['type'], description: string, metadata?: any) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  
  // Sync state
  isOnline: boolean;
  isSyncing: boolean;
  isInitialized: boolean;
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User>({
    id: 'user_ozalp',
    name: 'Ozalp',
    email: 'ozalp@example.com',
    defaultCurrency: 'EUR'
  });

  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTripId, setActiveTripId] = useState<string | null>('trip_leros_2026');
  const [members, setMembers] = useState<TripMember[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [notifications, setNotifications] = useState<PushNotification[]>([]);
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Online / Offline listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // Initial load
  const refreshData = useCallback(async () => {
    try {
      await seedInitialDataIfNeeded();

      const uList = await db.users.toArray();
      setAllUsers(uList);

      const loggedIn = uList.find(u => u.id === currentUser.id) || uList[0];
      if (loggedIn) setCurrentUser(loggedIn);

      const allTrips = await db.trips.toArray();
      setTrips(allTrips);

      if (activeTripId) {
        const tripMembers = await db.tripMembers.where('tripId').equals(activeTripId).toArray();
        setMembers(tripMembers);

        const tripHouseholds = await db.households.where('tripId').equals(activeTripId).toArray();
        setHouseholds(tripHouseholds);

        const tripExpenses = await db.expenses.where('tripId').equals(activeTripId).toArray();
        // Sort newest first
        tripExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setExpenses(tripExpenses);

        const tripSettlements = await db.settlements.where('tripId').equals(activeTripId).toArray();
        setSettlements(tripSettlements);

        const tripActivities = await db.activities.where('tripId').equals(activeTripId).toArray();
        tripActivities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setActivities(tripActivities);

        const tripNotifs = await db.notifications.where('userId').equals(currentUser.id).toArray();
        setNotifications(tripNotifs);
      }
    } catch (err) {
      console.warn('IndexedDB initial load error, continuing with fallback:', err);
    } finally {
      setIsInitialized(true);
    }
  }, [activeTripId, currentUser.id]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const activeTrip = trips.find(t => t.id === activeTripId && !t.isDeleted) || (trips.length > 0 ? trips[0] : null);
  const archivedTrips = trips.filter(t => t.isClosed && !t.isDeleted);
  const deletedTrips = trips.filter(t => t.isDeleted);

  // Balances & Settlements calculations
  const balances = calculateParticipantBalances(
    members,
    expenses,
    settlements,
    households
  );

  const recommendedTransfers = calculateOptimizedSettlements(
    balances.individualBalances,
    balances.householdBalances,
    activeTrip?.mainCurrency || 'EUR',
    true
  );

  // Current User's Net balance
  const userBalanceObj = balances.individualBalances.find(b => b.userId === currentUser.id);
  const userNetBalance = userBalanceObj ? userBalanceObj.net : 0;

  // Last-used currency for Quick Add (Section 10 & 32)
  const lastUsedCurrency = (expenses.length > 0 && expenses[0].originalCurrency)
    ? expenses[0].originalCurrency
    : (activeTrip?.mainCurrency || currentUser.defaultCurrency || 'EUR');

  // Activity logger helper
  const addActivity = async (type: Activity['type'], description: string, metadata?: any) => {
    if (!activeTripId) return;
    const act: Activity = {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      tripId: activeTripId,
      userId: currentUser.id,
      userName: currentUser.name,
      type,
      description,
      metadata,
      createdAt: new Date().toISOString()
    };
    await db.activities.put(act);
    await refreshData();
  };

  // Add Expense
  const addExpense = async (expenseData: Partial<Expense>) => {
    if (!activeTrip) throw new Error('No active trip');

    const now = new Date().toISOString();
    const dateStr = (expenseData.date || now).split('T')[0];
    const originalCurrency = expenseData.originalCurrency || lastUsedCurrency;
    const originalAmount = expenseData.originalAmount || 0;

    // Check FX rate
    let exchangeRate = expenseData.exchangeRate || 1;
    let exchangeRateSource = expenseData.exchangeRateSource;

    if (!expenseData.isManualExchangeRate && originalCurrency !== activeTrip.mainCurrency) {
      const fxResult = await fetchHistoricalExchangeRate(originalCurrency, activeTrip.mainCurrency, dateStr);
      exchangeRate = fxResult.rate;
      exchangeRateSource = fxResult.source;
    } else if (originalCurrency === activeTrip.mainCurrency) {
      exchangeRate = 1;
      exchangeRateSource = 'Direct (1:1)';
    }

    const convertedAmount = convertAmount(originalAmount, exchangeRate);

    // Duplicate detection check
    const dupCheck = checkForDuplicateExpense(
      {
        description: expenseData.description || '',
        originalAmount,
        originalCurrency,
        paidByUserId: expenseData.paidByUserId || currentUser.id,
        date: expenseData.date || now
      },
      expenses
    );

    const newExpense: Expense = {
      id: `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      tripId: activeTrip.id,
      description: expenseData.description || 'Expense',
      category: expenseData.category || 'Food',
      originalAmount,
      originalCurrency,
      convertedAmount,
      mainCurrency: activeTrip.mainCurrency,
      exchangeRate,
      isManualExchangeRate: !!expenseData.isManualExchangeRate,
      exchangeRateDate: dateStr,
      exchangeRateSource,
      paidByUserId: expenseData.paidByUserId || currentUser.id,
      addedByUserId: currentUser.id,
      payers: expenseData.payers && expenseData.payers.length > 0 
        ? expenseData.payers 
        : [{ userId: expenseData.paidByUserId || currentUser.id, amount: originalAmount }],
      participants: expenseData.participants && expenseData.participants.length > 0
        ? expenseData.participants
        : members.filter(m => m.isActive).map(m => ({
            userId: m.userId,
            amount: roundMoney(originalAmount / (members.filter(mem => mem.isActive).length || 1), 2)
          })),
      splitMode: expenseData.splitMode || 'equal',
      note: expenseData.note,
      receiptUrl: expenseData.receiptUrl,
      date: expenseData.date || now,
      isDeleted: false,
      isFlaggedWrong: false,
      isPossibleDuplicate: dupCheck.isDuplicate,
      clientSyncStatus: isOnline ? 'synced' : 'pending',
      createdAt: now,
      updatedAt: now
    };

    await db.expenses.put(newExpense);

    await addActivity(
      'expense_added',
      `added ${originalCurrency} ${originalAmount.toFixed(2)} ${newExpense.description}${originalCurrency !== activeTrip.mainCurrency ? ` (≈ ${activeTrip.mainCurrency} ${convertedAmount.toFixed(2)})` : ''}`
    );

    // Setup Undo Toast (Section 26)
    if (undoState?.timeoutId) clearTimeout(undoState.timeoutId);
    const timeoutId = setTimeout(() => {
      setUndoState(null);
    }, 7000); // 7 seconds undo window

    setUndoState({
      expense: newExpense,
      timeoutId
    });

    await refreshData();
    return { expense: newExpense, isDuplicate: dupCheck.isDuplicate, duplicateReason: dupCheck.reason };
  };

  const undoLastExpense = async () => {
    if (!undoState) return;
    const exp = undoState.expense;
    clearTimeout(undoState.timeoutId);
    setUndoState(null);

    await db.expenses.delete(exp.id);
    await addActivity('expense_deleted', `undid added expense: ${exp.description}`);
    await refreshData();
  };

  const dismissUndo = () => {
    if (undoState?.timeoutId) clearTimeout(undoState.timeoutId);
    setUndoState(null);
  };

  const updateExpense = async (updated: Expense) => {
    // Preserve original rate unless explicitly changed (Section 36)
    const now = new Date().toISOString();
    const savePayload: Expense = {
      ...updated,
      updatedAt: now,
      clientSyncStatus: isOnline ? 'synced' : 'pending'
    };
    await db.expenses.put(savePayload);
    await addActivity('expense_edited', `edited expense ${updated.description}`);
    await refreshData();
  };

  const deleteExpense = async (expenseId: string) => {
    const exp = await db.expenses.get(expenseId);
    if (!exp) return;
    const now = new Date().toISOString();
    // Soft delete according to Section 25
    await db.expenses.update(expenseId, {
      isDeleted: true,
      deletedAt: now,
      updatedAt: now
    });
    await addActivity('expense_deleted', `deleted expense ${exp.description}`);
    await refreshData();
  };

  const flagExpenseWrong = async (expenseId: string, reason: Expense['flaggedReason']) => {
    const exp = await db.expenses.get(expenseId);
    if (!exp) return;
    const now = new Date().toISOString();
    await db.expenses.update(expenseId, {
      isFlaggedWrong: true,
      flaggedReason: reason,
      flaggedByUserId: currentUser.id,
      flaggedAt: now,
      updatedAt: now
    });
    await addActivity('expense_flagged', `flagged ${exp.description} as "${reason}"`);
    await refreshData();
  };

  // Settlements
  const initiateSettlement = async (data: {
    debtorId: string;
    creditorId: string;
    amount: number;
    currency: CurrencyCode;
    notes?: string;
  }) => {
    if (!activeTrip) return;

    let exchangeRate = 1;
    if (data.currency !== activeTrip.mainCurrency) {
      const fx = await fetchHistoricalExchangeRate(data.currency, activeTrip.mainCurrency, new Date().toISOString().split('T')[0]);
      exchangeRate = fx.rate;
    }
    const convertedAmount = convertAmount(data.amount, exchangeRate);
    const now = new Date().toISOString();

    const settlement: Settlement = {
      id: `stl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      tripId: activeTrip.id,
      debtorId: data.debtorId,
      creditorId: data.creditorId,
      amount: data.amount,
      currency: data.currency,
      convertedAmount,
      mainCurrency: activeTrip.mainCurrency,
      exchangeRate,
      status: 'pending_confirmation',
      paidAt: now,
      createdAt: now,
      notes: data.notes
    };

    await db.settlements.put(settlement);

    const debtor = members.find(m => m.userId === data.debtorId)?.name || 'Debtor';
    const creditor = members.find(m => m.userId === data.creditorId)?.name || 'Creditor';

    await addActivity(
      'settlement_initiated',
      `${debtor} marked payment of ${data.currency} ${data.amount.toFixed(2)} to ${creditor} as Paid (Pending confirmation)`
    );

    await refreshData();
  };

  const confirmSettlement = async (settlementId: string) => {
    const stl = await db.settlements.get(settlementId);
    if (!stl) return;
    const now = new Date().toISOString();
    await db.settlements.update(settlementId, {
      status: 'completed',
      confirmedAt: now
    });

    const creditor = members.find(m => m.userId === stl.creditorId)?.name || 'Creditor';
    await addActivity('settlement_confirmed', `${creditor} confirmed receipt of ${stl.currency} ${stl.amount.toFixed(2)} payment`);
    await refreshData();
  };

  const cancelSettlement = async (settlementId: string) => {
    await db.settlements.update(settlementId, { status: 'cancelled' });
    await refreshData();
  };

  // Trips Management
  const createTrip = async (tripData: Omit<Trip, 'id' | 'createdAt' | 'updatedAt'>, memberEmails: string[]) => {
    const now = new Date().toISOString();
    const tripId = `trip_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newTrip: Trip = {
      ...tripData,
      id: tripId,
      createdAt: now,
      updatedAt: now,
      isClosed: false,
      isDeleted: false,
      clientSyncStatus: isOnline ? 'synced' : 'pending'
    };
    await db.trips.put(newTrip);

    // Add owner as member
    const ownerMember: TripMember = {
      id: `m_${Date.now()}_owner`,
      tripId,
      userId: currentUser.id,
      name: currentUser.name,
      email: currentUser.email,
      role: 'owner',
      isActive: true,
      joinedAt: now
    };
    await db.tripMembers.put(ownerMember);

    // Add initial invited members
    for (const email of memberEmails) {
      if (!email.trim() || email.trim() === currentUser.email) continue;
      const cleanEmail = email.trim();
      const name = cleanEmail.split('@')[0];
      const memberId = `m_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const memberUserId = `user_${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

      // ensure user exists
      await db.users.put({
        id: memberUserId,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        email: cleanEmail,
        defaultCurrency: newTrip.mainCurrency
      });

      await db.tripMembers.put({
        id: memberId,
        tripId,
        userId: memberUserId,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        email: cleanEmail,
        role: 'member',
        isActive: true,
        joinedAt: now
      });
    }

    setActiveTripId(tripId);
    await refreshData();
    return tripId;
  };

  const updateTrip = async (trip: Trip) => {
    const now = new Date().toISOString();
    // If mainCurrency changed, recalculate converted amounts for all active expenses (Section 31)
    const existing = await db.trips.get(trip.id);
    if (existing && existing.mainCurrency !== trip.mainCurrency) {
      const tripExps = await db.expenses.where('tripId').equals(trip.id).toArray();
      for (const exp of tripExps) {
        const dateStr = exp.date.split('T')[0];
        const fx = await fetchHistoricalExchangeRate(exp.originalCurrency, trip.mainCurrency, dateStr);
        const newConverted = convertAmount(exp.originalAmount, fx.rate);
        await db.expenses.update(exp.id, {
          mainCurrency: trip.mainCurrency,
          exchangeRate: fx.rate,
          convertedAmount: newConverted,
          exchangeRateSource: fx.source
        });
      }
    }

    await db.trips.put({ ...trip, updatedAt: now });
    await refreshData();
  };

  const closeTrip = async (tripId: string) => {
    const now = new Date().toISOString();
    await db.trips.update(tripId, { isClosed: true, closedAt: now, updatedAt: now });
    await addActivity('trip_closed', 'closed this trip (archived)');
    await refreshData();
  };

  const reopenTrip = async (tripId: string) => {
    const now = new Date().toISOString();
    await db.trips.update(tripId, { isClosed: false, updatedAt: now });
    await addActivity('trip_reopened', 'reopened this trip');
    await refreshData();
  };

  const deleteTrip = async (tripId: string) => {
    const now = new Date().toISOString();
    await db.trips.update(tripId, { isDeleted: true, deletedAt: now, updatedAt: now });
    if (activeTripId === tripId) {
      const remaining = trips.find(t => t.id !== tripId && !t.isDeleted);
      setActiveTripId(remaining ? remaining.id : null);
    }
    await refreshData();
  };

  const restoreTrip = async (tripId: string) => {
    const now = new Date().toISOString();
    await db.trips.update(tripId, { isDeleted: false, deletedAt: undefined, updatedAt: now });
    setActiveTripId(tripId);
    await refreshData();
  };

  const permanentlyDeleteTrip = async (tripId: string) => {
    await db.expenses.where('tripId').equals(tripId).delete();
    await db.tripMembers.where('tripId').equals(tripId).delete();
    await db.households.where('tripId').equals(tripId).delete();
    await db.settlements.where('tripId').equals(tripId).delete();
    await db.activities.where('tripId').equals(tripId).delete();
    await db.trips.delete(tripId);
    if (activeTripId === tripId) {
      const remaining = trips.find(t => t.id !== tripId && !t.isDeleted);
      setActiveTripId(remaining ? remaining.id : null);
    }
    await refreshData();
  };

  const addMember = async (tripId: string, email: string, name: string) => {
    const now = new Date().toISOString();
    const userId = `user_${name.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Math.random().toString(36).substring(2, 5)}`;
    await db.users.put({
      id: userId,
      name,
      email,
      defaultCurrency: activeTrip?.mainCurrency || 'EUR'
    });

    const member: TripMember = {
      id: `m_${Date.now()}`,
      tripId,
      userId,
      name,
      email,
      role: 'member',
      isActive: true,
      joinedAt: now
    };
    await db.tripMembers.put(member);
    await addActivity('member_joined', `${name} joined the trip`);
    await refreshData();
  };

  const setMemberActive = async (memberId: string, isActive: boolean) => {
    await db.tripMembers.update(memberId, { isActive });
    await refreshData();
  };

  const saveHousehold = async (hh: Omit<Household, 'id' | 'createdAt'>, existingId?: string) => {
    const now = new Date().toISOString();
    if (existingId) {
      await db.households.update(existingId, { name: hh.name, memberUserIds: hh.memberUserIds });
    } else {
      await db.households.put({
        id: `hh_${Date.now()}`,
        tripId: hh.tripId,
        name: hh.name,
        memberUserIds: hh.memberUserIds,
        createdAt: now
      });
    }
    await refreshData();
  };

  const deleteHousehold = async (householdId: string) => {
    await db.households.delete(householdId);
    await refreshData();
  };

  const transferOwnership = async (tripId: string, newOwnerUserId: string) => {
    const allTripMembers = await db.tripMembers.where('tripId').equals(tripId).toArray();
    for (const m of allTripMembers) {
      if (m.userId === newOwnerUserId) {
        await db.tripMembers.update(m.id, { role: 'owner' });
      } else if (m.role === 'owner') {
        await db.tripMembers.update(m.id, { role: 'member' });
      }
    }
    await db.trips.update(tripId, { ownerId: newOwnerUserId });
    await refreshData();
  };

  const markNotificationRead = async (id: string) => {
    await db.notifications.update(id, { isRead: true });
    await refreshData();
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        allUsers,
        activeTrip,
        setActiveTripId,
        trips,
        archivedTrips,
        deletedTrips,
        members,
        households,
        expenses,
        settlements,
        activities,
        notifications,
        balances,
        recommendedTransfers,
        userNetBalance,
        lastUsedCurrency,
        createTrip,
        updateTrip,
        closeTrip,
        reopenTrip,
        deleteTrip,
        restoreTrip,
        permanentlyDeleteTrip,
        addMember,
        setMemberActive,
        saveHousehold,
        deleteHousehold,
        transferOwnership,
        addExpense,
        updateExpense,
        deleteExpense,
        flagExpenseWrong,
        undoLastExpense,
        undoState,
        dismissUndo,
        initiateSettlement,
        confirmSettlement,
        cancelSettlement,
        addActivity,
        markNotificationRead,
        isOnline,
        isSyncing,
        isInitialized,
        refreshData
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
