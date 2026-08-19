import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { db, seedInitialDataIfNeeded } from '../lib/db';
import { User, Trip, TripMember, Household, Expense, Settlement, Activity, PushNotification, CurrencyCode } from '../types';
import { calculateParticipantBalances } from '../lib/balances';
import { calculateOptimizedSettlements } from '../lib/settlement';
import { fetchHistoricalExchangeRate, convertAmount } from '../lib/fx';
import { add, sub, roundMoney } from '../lib/decimal';
import { checkForDuplicateExpense } from '../lib/duplicate';
import { 
  isFirebaseConfigured, 
  subscribeToAuthChanges, 
  loginAnonymously, 
  loginWithGoogle as fbLoginGoogle, 
  logoutFirebase as fbLogout,
  initFirebase
} from '../lib/firebase';
import { 
  subscribeToTrip, 
  syncTripToCloud, 
  syncMemberToCloud, 
  syncHouseholdToCloud, 
  deleteHouseholdFromCloud, 
  syncExpenseToCloud, 
  deleteExpenseFromCloud, 
  syncSettlementToCloud, 
  syncActivityToCloud,
  syncUserToCloud,
  fetchUserFromCloud,
  fetchTripFromCloud,
  fetchUserTripsFromCloud,
  fetchTripExpensesFromCloud,
  fetchTripMembersFromCloud,
  ActiveTripListeners
} from '../lib/firestoreSync';
import { sendLocalNotification, requestNotificationPermission, isNotificationGranted } from '../lib/notifications';

interface UndoState {
  expense: Expense;
  timeoutId: any;
}

interface AppContextType {
  currentUser: User;
  setCurrentUser: (u: User) => void;
  isAuthenticated: boolean;
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
  joinTrip: (tripId: string) => Promise<void>;
  clearAllData: () => Promise<void>;
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
  
  // Cloud & Sync state
  isOnline: boolean;
  isSyncing: boolean;
  isFirebaseActive: boolean;
  cloudSyncStatus: 'offline' | 'connected' | 'syncing' | 'error';
  firebaseUser: any | null;
  loginAsGuest: () => Promise<void>;
  loginWithGoogleAuth: () => Promise<void>;
  logoutUser: () => Promise<void>;
  enableNotifications: () => Promise<boolean>;
  isNotificationsEnabled: boolean;
  isInitialized: boolean;
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

const DEFAULT_USER: User = {
  id: 'guest',
  name: 'Guest',
  email: 'guest@whopaid.app',
  defaultCurrency: 'EUR'
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [storedUser, setStoredUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('whopaid_auth_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const currentUser: User = storedUser || DEFAULT_USER;
  const isAuthenticated = storedUser !== null;

  const setCurrentUser = (u: User) => {
    setStoredUser(u);
    localStorage.setItem('whopaid_auth_user', JSON.stringify(u));
    db.users.put(u);
    if (isFirebaseConfigured() && isOnline) {
      syncUserToCloud(u).catch(console.warn);
    }
  };

  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTripId, setActiveTripIdState] = useState<string | null>(() => {
    return localStorage.getItem('whopaid_active_trip');
  });

  const setActiveTripId = useCallback((id: string | null) => {
    setActiveTripIdState(id);
    if (id) {
      localStorage.setItem('whopaid_active_trip', id);
      // Immediately load local expenses
      db.expenses.where('tripId').equals(id).toArray().then((localExps) => {
        localExps.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setExpenses(localExps);
      });
      // And pull latest cloud expenses if online
      if (isFirebaseConfigured() && navigator.onLine) {
        fetchTripExpensesFromCloud(id).then(async (remoteExps) => {
          if (remoteExps && remoteExps.length > 0) {
            await db.expenses.bulkPut(remoteExps);
            const currentLocal = await db.expenses.where('tripId').equals(id).toArray();
            currentLocal.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setExpenses(currentLocal);
          }
        }).catch(console.warn);
      }
    } else {
      localStorage.removeItem('whopaid_active_trip');
    }
  }, []);

  const [members, setMembers] = useState<TripMember[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [notifications, setNotifications] = useState<PushNotification[]>([]);
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [firebaseUser, setFirebaseUser] = useState<any | null>(null);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'offline' | 'connected' | 'syncing' | 'error'>('offline');

  const tripListenersRef = useRef<ActiveTripListeners | null>(null);
  const isSyncingTripsRef = useRef<boolean>(false);

  // Online / Offline listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (isFirebaseConfigured()) setCloudSyncStatus('connected');
    };
    const handleOffline = () => {
      setIsOnline(false);
      setCloudSyncStatus('offline');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Firebase Auth listener
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setCloudSyncStatus('offline');
      return;
    }

    setCloudSyncStatus('connected');
    const unsubscribeAuth = subscribeToAuthChanges(async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        // Retrieve customized display name and currency if previously saved
        const localExisting = await db.users.get(fbUser.uid);
        const cloudExisting = isFirebaseConfigured() ? await fetchUserFromCloud(fbUser.uid) : null;
        const savedAuth = localStorage.getItem('whopaid_auth_user');
        let savedUserObj: User | null = null;
        try {
          if (savedAuth) savedUserObj = JSON.parse(savedAuth);
        } catch {}

        const resolvedName = (savedUserObj && savedUserObj.id === fbUser.uid && savedUserObj.name && savedUserObj.name !== 'User')
          ? savedUserObj.name
          : (localExisting?.name && localExisting.name !== 'User')
          ? localExisting.name
          : (cloudExisting?.name && cloudExisting.name !== 'User')
          ? cloudExisting.name
          : fbUser.displayName || savedUserObj?.name || 'Guest';

        const resolvedCurrency = localExisting?.defaultCurrency || cloudExisting?.defaultCurrency || savedUserObj?.defaultCurrency || 'EUR';
        const resolvedAvatar = fbUser.photoURL || localExisting?.avatarUrl || cloudExisting?.avatarUrl || savedUserObj?.avatarUrl;

        const updatedUser: User = {
          id: fbUser.uid,
          name: resolvedName,
          email: fbUser.email || localExisting?.email || savedUserObj?.email || `${resolvedName.toLowerCase()}@whopaid.app`,
          defaultCurrency: resolvedCurrency,
          avatarUrl: resolvedAvatar
        };
        await db.users.put(updatedUser);
        setCurrentUser(updatedUser);
      }
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // Local IndexedDB refresh
  const refreshData = useCallback(async () => {
    try {
      // One-time clean wipe of old mock trips
      const WIPE_MOCK_KEY = 'whopaid_wipe_mock_trips_v2';
      if (!localStorage.getItem(WIPE_MOCK_KEY)) {
        await db.trips.clear();
        await db.expenses.clear();
        await db.tripMembers.clear();
        await db.households.clear();
        await db.settlements.clear();
        await db.activities.clear();
        localStorage.removeItem('whopaid_active_trip');
        localStorage.setItem(WIPE_MOCK_KEY, 'true');
      }

      await seedInitialDataIfNeeded();

      const uList = await db.users.toArray();
      setAllUsers(uList);

      if (storedUser) {
        const loggedIn = uList.find(u => u.id === storedUser.id);
        if (loggedIn) setStoredUser(loggedIn);
      }

      const allTrips = await db.trips.toArray();
      const allMyMemberships = await db.tripMembers.where('userId').equals(currentUser.id).toArray();
      const memberTripIds = new Set(allMyMemberships.map(m => m.tripId));

      const allMembers = await db.tripMembers.toArray();
      for (const m of allMembers) {
        if (
          (currentUser.email && m.email && m.email.toLowerCase() === currentUser.email.toLowerCase()) ||
          (currentUser.email && m.name && m.name.toLowerCase() === currentUser.email.toLowerCase()) ||
          (currentUser.name && m.name && m.name.toLowerCase() === currentUser.name.toLowerCase())
        ) {
          memberTripIds.add(m.tripId);
        }
      }

      // Strictly filter trips: user is owner or invited member
      const userTrips = allTrips.filter(t => 
        t.ownerId === currentUser.id || 
        memberTripIds.has(t.id)
      );
      setTrips(userTrips);

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

      // Sync trips and expenses from cloud across all devices once
      if (isFirebaseConfigured() && navigator.onLine && currentUser.id && !isSyncingTripsRef.current) {
        isSyncingTripsRef.current = true;
        fetchUserTripsFromCloud(currentUser.id, currentUser.email).then(async (remoteTrips) => {
          if (remoteTrips && remoteTrips.length > 0) {
            for (const rTrip of remoteTrips) {
              await db.trips.put(rTrip);
              const rMembers = await fetchTripMembersFromCloud(rTrip.id);
              if (rMembers.length > 0) {
                await db.tripMembers.bulkPut(rMembers);
              }
              const rExpenses = await fetchTripExpensesFromCloud(rTrip.id);
              if (rExpenses.length > 0) {
                await db.expenses.bulkPut(rExpenses);
              }
            }

            const freshTrips = await db.trips.toArray();
            const freshMemberships = await db.tripMembers.where('userId').equals(currentUser.id).toArray();
            const freshMemberTripIds = new Set(freshMemberships.map(m => m.tripId));
            const freshAllMembers = await db.tripMembers.toArray();
            for (const m of freshAllMembers) {
              if (
                (currentUser.email && m.email && m.email.toLowerCase() === currentUser.email.toLowerCase()) ||
                (currentUser.name && m.name && m.name.toLowerCase() === currentUser.name.toLowerCase())
              ) {
                freshMemberTripIds.add(m.tripId);
              }
            }
            const updatedTrips = freshTrips.filter(t => 
              t.ownerId === currentUser.id || freshMemberTripIds.has(t.id)
            );
            setTrips(updatedTrips);
          }
        }).catch(console.warn).finally(() => {
          isSyncingTripsRef.current = false;
        });
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

  // Realtime Firestore Subscriptions for Active Trip
  useEffect(() => {
    if (tripListenersRef.current) {
      tripListenersRef.current.unsubscribeTrip();
      tripListenersRef.current.unsubscribeMembers();
      tripListenersRef.current.unsubscribeHouseholds();
      tripListenersRef.current.unsubscribeExpenses();
      tripListenersRef.current.unsubscribeSettlements();
      tripListenersRef.current.unsubscribeActivities();
      tripListenersRef.current = null;
    }

    if (!activeTripId || !isFirebaseConfigured() || !isOnline) {
      return;
    }

    setCloudSyncStatus('syncing');

    const listeners = subscribeToTrip(activeTripId, {
      onTripUpdate: async (remoteTrip) => {
        if (remoteTrip) {
          await db.trips.put(remoteTrip);
          setTrips(prev => {
            const idx = prev.findIndex(t => t.id === remoteTrip.id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = remoteTrip;
              return updated;
            }
            return [...prev, remoteTrip];
          });
        }
      },
      onMembersUpdate: async (remoteMembers) => {
        if (remoteMembers && remoteMembers.length > 0) {
          await db.tripMembers.bulkPut(remoteMembers);
        }
        const currentLocalMembers = await db.tripMembers.where('tripId').equals(activeTripId).toArray();
        setMembers(currentLocalMembers);
      },
      onHouseholdsUpdate: async (remoteHouseholds) => {
        if (remoteHouseholds && remoteHouseholds.length > 0) {
          await db.households.bulkPut(remoteHouseholds);
        }
        const currentLocalHouseholds = await db.households.where('tripId').equals(activeTripId).toArray();
        setHouseholds(currentLocalHouseholds);
      },
      onExpensesUpdate: async (remoteExpenses) => {
        if (remoteExpenses && remoteExpenses.length > 0) {
          await db.expenses.bulkPut(remoteExpenses);
        }
        const currentLocal = await db.expenses.where('tripId').equals(activeTripId).toArray();
        currentLocal.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setExpenses(currentLocal);
        setCloudSyncStatus('connected');
      },
      onSettlementsUpdate: async (remoteSettlements) => {
        if (remoteSettlements && remoteSettlements.length > 0) {
          await db.settlements.bulkPut(remoteSettlements);
        }
        const currentLocalStl = await db.settlements.where('tripId').equals(activeTripId).toArray();
        setSettlements(currentLocalStl);
      },
      onActivitiesUpdate: async (remoteActs) => {
        if (remoteActs.length > 0) {
          await db.activities.bulkPut(remoteActs);
          setActivities(remoteActs);
        }
      },
      onError: (err) => {
        console.warn('[Firestore Sync] Listener warning:', err);
        setCloudSyncStatus('error');
      }
    });

    if (listeners) {
      tripListenersRef.current = listeners;
    }

    // Auto-sync any existing local expenses to cloud that may have been blocked
    if (isFirebaseConfigured() && isOnline) {
      db.expenses.where('tripId').equals(activeTripId).toArray().then(async (localExps) => {
        for (const exp of localExps) {
          if (!exp.isDeleted) {
            syncExpenseToCloud(activeTripId, exp).catch(console.warn);
          }
        }
      }).catch(console.warn);
    }

    return () => {
      if (tripListenersRef.current) {
        tripListenersRef.current.unsubscribeTrip();
        tripListenersRef.current.unsubscribeMembers();
        tripListenersRef.current.unsubscribeHouseholds();
        tripListenersRef.current.unsubscribeExpenses();
        tripListenersRef.current.unsubscribeSettlements();
        tripListenersRef.current.unsubscribeActivities();
        tripListenersRef.current = null;
      }
    };
  }, [activeTripId, isOnline]);

  const activeTrip = trips.find(t => t.id === activeTripId && !t.isDeleted) || (activeTripId === null && trips.length > 0 ? trips[0] : null);
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

  // Last-used currency for Quick Add
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
    if (isFirebaseConfigured() && isOnline) {
      syncActivityToCloud(activeTripId, act).catch(console.warn);
    }
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
    setExpenses(prev => [newExpense, ...prev.filter(e => e.id !== newExpense.id)]);

    if (isFirebaseConfigured() && isOnline) {
      syncExpenseToCloud(activeTrip.id, newExpense).catch(console.warn);
    }

    await addActivity(
      'expense_added',
      `added ${originalCurrency} ${originalAmount.toFixed(2)} ${newExpense.description}${originalCurrency !== activeTrip.mainCurrency ? ` (≈ ${activeTrip.mainCurrency} ${convertedAmount.toFixed(2)})` : ''}`
    );

    // Setup Undo Toast
    if (undoState?.timeoutId) clearTimeout(undoState.timeoutId);
    const timeoutId = setTimeout(() => {
      setUndoState(null);
    }, 7000);

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
    setExpenses(prev => prev.filter(e => e.id !== exp.id));
    if (isFirebaseConfigured() && isOnline && activeTrip) {
      deleteExpenseFromCloud(activeTrip.id, exp.id).catch(console.warn);
    }
    await addActivity('expense_deleted', `undid added expense: ${exp.description}`);
    await refreshData();
  };

  const dismissUndo = () => {
    if (undoState?.timeoutId) clearTimeout(undoState.timeoutId);
    setUndoState(null);
  };

  const updateExpense = async (updated: Expense) => {
    const now = new Date().toISOString();
    const savePayload: Expense = {
      ...updated,
      updatedAt: now,
      clientSyncStatus: isOnline ? 'synced' : 'pending'
    };
    await db.expenses.put(savePayload);
    setExpenses(prev => prev.map(e => e.id === savePayload.id ? savePayload : e));
    if (isFirebaseConfigured() && isOnline && activeTrip) {
      syncExpenseToCloud(activeTrip.id, savePayload).catch(console.warn);
    }
    await addActivity('expense_edited', `edited expense ${updated.description}`);
    await refreshData();
  };

  const deleteExpense = async (expenseId: string) => {
    const exp = await db.expenses.get(expenseId);
    if (!exp) return;
    const now = new Date().toISOString();
    const updatedExp: Expense = {
      ...exp,
      isDeleted: true,
      deletedAt: now,
      updatedAt: now
    };
    await db.expenses.put(updatedExp);
    setExpenses(prev => prev.filter(e => e.id !== expenseId));
    if (isFirebaseConfigured() && isOnline && activeTrip) {
      syncExpenseToCloud(activeTrip.id, updatedExp).catch(console.warn);
    }
    await addActivity('expense_deleted', `deleted expense ${exp.description}`);
    await refreshData();
  };

  const flagExpenseWrong = async (expenseId: string, reason: Expense['flaggedReason']) => {
    const exp = await db.expenses.get(expenseId);
    if (!exp) return;
    const now = new Date().toISOString();
    const updatedExp: Expense = {
      ...exp,
      isFlaggedWrong: true,
      flaggedReason: reason,
      flaggedByUserId: currentUser.id,
      flaggedAt: now,
      updatedAt: now
    };
    await db.expenses.put(updatedExp);
    if (isFirebaseConfigured() && isOnline && activeTrip) {
      syncExpenseToCloud(activeTrip.id, updatedExp).catch(console.warn);
    }
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
    if (isFirebaseConfigured() && isOnline) {
      syncSettlementToCloud(activeTrip.id, settlement).catch(console.warn);
    }

    const debtor = members.find(m => m.userId === data.debtorId)?.name || 'Debtor';
    const creditor = members.find(m => m.userId === data.creditorId)?.name || 'Creditor';

    await addActivity(
      'settlement_initiated',
      `${debtor} marked payment of ${data.currency} ${data.amount.toFixed(2)} to ${creditor} as Paid (Pending confirmation)`
    );

    sendLocalNotification(`💳 Settlement Paid: ${data.currency} ${data.amount.toFixed(2)}`, {
      body: `${debtor} sent ${data.currency} ${data.amount.toFixed(2)} to ${creditor}. Tap to review and confirm.`
    });

    await refreshData();
  };

  const confirmSettlement = async (settlementId: string) => {
    const stl = await db.settlements.get(settlementId);
    if (!stl) return;
    const now = new Date().toISOString();
    const updated: Settlement = {
      ...stl,
      status: 'completed',
      confirmedAt: now
    };
    await db.settlements.put(updated);
    if (isFirebaseConfigured() && isOnline && activeTrip) {
      syncSettlementToCloud(activeTrip.id, updated).catch(console.warn);
    }

    const creditor = members.find(m => m.userId === stl.creditorId)?.name || 'Creditor';
    await addActivity('settlement_confirmed', `${creditor} confirmed receipt of ${stl.currency} ${stl.amount.toFixed(2)} payment`);

    sendLocalNotification(`✅ Settlement Confirmed!`, {
      body: `${creditor} confirmed receipt of ${stl.currency} ${stl.amount.toFixed(2)}. Balance updated!`
    });

    await refreshData();
  };

  const cancelSettlement = async (settlementId: string) => {
    const stl = await db.settlements.get(settlementId);
    if (!stl) return;
    const updated: Settlement = { ...stl, status: 'cancelled' };
    await db.settlements.put(updated);
    if (isFirebaseConfigured() && isOnline && activeTrip) {
      syncSettlementToCloud(activeTrip.id, updated).catch(console.warn);
    }
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

      await db.users.put({
        id: memberUserId,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        email: cleanEmail,
        defaultCurrency: newTrip.mainCurrency
      });

      const member: TripMember = {
        id: memberId,
        tripId,
        userId: memberUserId,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        email: cleanEmail,
        role: 'member',
        isActive: true,
        joinedAt: now
      };
      await db.tripMembers.put(member);

      if (isFirebaseConfigured() && isOnline) {
        syncMemberToCloud(tripId, member).catch(console.warn);
      }
    }

    if (isFirebaseConfigured() && isOnline) {
      syncTripToCloud(newTrip).catch(console.warn);
      syncMemberToCloud(tripId, ownerMember).catch(console.warn);
    }

    setActiveTripId(tripId);
    await refreshData();
    return newTrip.id;
  };

  const joinTrip = async (tripId: string) => {
    try {
      if (isFirebaseConfigured()) {
        const remoteTrip = await fetchTripFromCloud(tripId);
        if (remoteTrip) {
          await db.trips.put(remoteTrip);
          setTrips(prev => {
            const idx = prev.findIndex(t => t.id === remoteTrip.id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = remoteTrip;
              return updated;
            }
            return [...prev, remoteTrip];
          });
        }
      }

      const existing = await db.tripMembers.where('tripId').equals(tripId).and(m => m.userId === currentUser.id).first();
      if (!existing || existing.name === 'User' || existing.name === 'Member' || existing.name !== currentUser.name) {
        const newMember: TripMember = {
          id: existing ? existing.id : `member_${currentUser.id}_${tripId}`,
          tripId,
          userId: currentUser.id,
          name: currentUser.name || 'Member',
          email: currentUser.email || `${(currentUser.name || 'guest').toLowerCase()}@whopaid.app`,
          role: existing ? existing.role : 'member',
          isActive: true,
          joinedAt: existing ? existing.joinedAt : new Date().toISOString()
        };
        await db.tripMembers.put(newMember);
        if (isFirebaseConfigured() && isOnline) {
          syncMemberToCloud(tripId, newMember).catch(console.warn);
        }
      }
      setActiveTripId(tripId);
      await refreshData();
    } catch (err) {
      console.warn('Failed to join trip:', err);
    }
  };

  const updateTrip = async (trip: Trip) => {
    const now = new Date().toISOString();
    const existing = await db.trips.get(trip.id);
    if (existing && existing.mainCurrency !== trip.mainCurrency) {
      const tripExps = await db.expenses.where('tripId').equals(trip.id).toArray();
      for (const exp of tripExps) {
        const dateStr = exp.date.split('T')[0];
        const fx = await fetchHistoricalExchangeRate(exp.originalCurrency, trip.mainCurrency, dateStr);
        const newConverted = convertAmount(exp.originalAmount, fx.rate);
        const updatedExp: Expense = {
          ...exp,
          mainCurrency: trip.mainCurrency,
          exchangeRate: fx.rate,
          convertedAmount: newConverted,
          exchangeRateSource: fx.source
        };
        await db.expenses.put(updatedExp);
        if (isFirebaseConfigured() && isOnline) {
          syncExpenseToCloud(trip.id, updatedExp).catch(console.warn);
        }
      }
    }

    const updatedTrip = { ...trip, updatedAt: now };
    await db.trips.put(updatedTrip);
    if (isFirebaseConfigured() && isOnline) {
      syncTripToCloud(updatedTrip).catch(console.warn);
    }
    await refreshData();
  };

  const closeTrip = async (tripId: string) => {
    const now = new Date().toISOString();
    const t = await db.trips.get(tripId);
    if (t) {
      const updated = { ...t, isClosed: true, closedAt: now, updatedAt: now };
      await db.trips.put(updated);
      if (isFirebaseConfigured() && isOnline) syncTripToCloud(updated).catch(console.warn);
    }
    await addActivity('trip_closed', 'closed this trip (archived)');
    await refreshData();
  };

  const reopenTrip = async (tripId: string) => {
    const now = new Date().toISOString();
    const t = await db.trips.get(tripId);
    if (t) {
      const updated = { ...t, isClosed: false, updatedAt: now };
      await db.trips.put(updated);
      if (isFirebaseConfigured() && isOnline) syncTripToCloud(updated).catch(console.warn);
    }
    await addActivity('trip_reopened', 'reopened this trip');
    await refreshData();
  };

  const deleteTrip = async (tripId: string) => {
    const now = new Date().toISOString();
    const t = await db.trips.get(tripId);
    if (t) {
      const updated = { ...t, isDeleted: true, deletedAt: now, updatedAt: now };
      await db.trips.put(updated);
      if (isFirebaseConfigured() && isOnline) syncTripToCloud(updated).catch(console.warn);
    }
    if (activeTripId === tripId) {
      const remaining = trips.find(trip => trip.id !== tripId && !trip.isDeleted);
      setActiveTripId(remaining ? remaining.id : null);
    }
    await refreshData();
  };

  const restoreTrip = async (tripId: string) => {
    const now = new Date().toISOString();
    const t = await db.trips.get(tripId);
    if (t) {
      const updated = { ...t, isDeleted: false, deletedAt: undefined, updatedAt: now };
      await db.trips.put(updated);
      if (isFirebaseConfigured() && isOnline) syncTripToCloud(updated).catch(console.warn);
    }
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
    if (isFirebaseConfigured() && isOnline) {
      syncMemberToCloud(tripId, member).catch(console.warn);
    }
    await addActivity('member_joined', `${name} joined the trip`);
    await refreshData();
  };

  const setMemberActive = async (memberId: string, isActive: boolean) => {
    const m = await db.tripMembers.get(memberId);
    if (m) {
      const updated = { ...m, isActive };
      await db.tripMembers.put(updated);
      if (isFirebaseConfigured() && isOnline && activeTrip) {
        syncMemberToCloud(activeTrip.id, updated).catch(console.warn);
      }
    }
    await refreshData();
  };

  const saveHousehold = async (hh: Omit<Household, 'id' | 'createdAt'>, existingId?: string) => {
    const now = new Date().toISOString();
    const id = existingId || `hh_${Date.now()}`;
    const household: Household = {
      id,
      tripId: hh.tripId,
      name: hh.name,
      memberUserIds: hh.memberUserIds,
      createdAt: now
    };
    await db.households.put(household);
    if (isFirebaseConfigured() && isOnline) {
      syncHouseholdToCloud(hh.tripId, household).catch(console.warn);
    }
    await refreshData();
  };

  const deleteHousehold = async (householdId: string) => {
    const hh = await db.households.get(householdId);
    await db.households.delete(householdId);
    if (hh && isFirebaseConfigured() && isOnline) {
      deleteHouseholdFromCloud(hh.tripId, householdId).catch(console.warn);
    }
    await refreshData();
  };

  const transferOwnership = async (tripId: string, newOwnerUserId: string) => {
    const allTripMembers = await db.tripMembers.where('tripId').equals(tripId).toArray();
    for (const m of allTripMembers) {
      let newRole = m.role;
      if (m.userId === newOwnerUserId) {
        newRole = 'owner';
      } else if (m.role === 'owner') {
        newRole = 'member';
      }
      if (newRole !== m.role) {
        const updated = { ...m, role: newRole };
        await db.tripMembers.put(updated);
        if (isFirebaseConfigured() && isOnline) {
          syncMemberToCloud(tripId, updated).catch(console.warn);
        }
      }
    }
    const t = await db.trips.get(tripId);
    if (t) {
      const updatedTrip = { ...t, ownerId: newOwnerUserId };
      await db.trips.put(updatedTrip);
      if (isFirebaseConfigured() && isOnline) {
        syncTripToCloud(updatedTrip).catch(console.warn);
      }
    }
    await refreshData();
  };

  const markNotificationRead = async (id: string) => {
    await db.notifications.update(id, { isRead: true });
    await refreshData();
  };

  // Auth Operations
  const loginAsGuest = async () => {
    try {
      await loginAnonymously();
    } catch (err) {
      console.error('Guest login failed:', err);
    }
  };

  const loginWithGoogleAuth = async () => {
    try {
      const fbUser = await fbLoginGoogle();
      if (fbUser) {
        const localExisting = await db.users.get(fbUser.uid);
        const cloudExisting = isFirebaseConfigured() ? await fetchUserFromCloud(fbUser.uid) : null;

        const resolvedName = localExisting?.name || cloudExisting?.name || fbUser.displayName || 'User';
        const resolvedCurrency = localExisting?.defaultCurrency || cloudExisting?.defaultCurrency || 'EUR';
        const resolvedAvatar = fbUser.photoURL || localExisting?.avatarUrl || cloudExisting?.avatarUrl;

        const u: User = {
          id: fbUser.uid,
          name: resolvedName,
          email: fbUser.email || localExisting?.email || 'user@whopaid.app',
          defaultCurrency: resolvedCurrency,
          avatarUrl: resolvedAvatar
        };
        setCurrentUser(u);
      }
    } catch (err: any) {
      console.error('Google login failed:', err);
      throw err;
    }
  };

  const clearAllData = async () => {
    await db.trips.clear();
    await db.expenses.clear();
    await db.tripMembers.clear();
    await db.households.clear();
    await db.settlements.clear();
    await db.activities.clear();
    setActiveTripId(null);
    localStorage.removeItem('whopaid_active_trip');
    await refreshData();
  };

  const logoutUser = async () => {
    try {
      await fbLogout();
    } catch (err) {
      console.error('Logout failed:', err);
    }
    localStorage.removeItem('whopaid_auth_user');
    localStorage.removeItem('whopaid_active_trip');
    localStorage.removeItem('whopaid_last_view');
    sessionStorage.clear();
    setStoredUser(null);
    setActiveTripId(null);
  };

  const enableNotifications = async () => {
    const perm = await requestNotificationPermission();
    return perm === 'granted';
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        isAuthenticated,
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
        joinTrip,
        clearAllData,
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
        isFirebaseActive: isFirebaseConfigured(),
        cloudSyncStatus,
        firebaseUser,
        loginAsGuest,
        loginWithGoogleAuth,
        logoutUser,
        enableNotifications,
        isNotificationsEnabled: isNotificationGranted(),
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
