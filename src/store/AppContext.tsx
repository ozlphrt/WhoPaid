import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { db, seedInitialDataIfNeeded } from '../lib/db';
import { User, Trip, TripMember, Household, Expense, Settlement, Activity, PushNotification, CurrencyCode } from '../types';
import { calculateParticipantBalances } from '../lib/balances';
import { calculateOptimizedSettlements } from '../lib/settlement';
import { fetchHistoricalExchangeRate, convertAmount } from '../lib/fx';
import { add, sub, roundMoney } from '../lib/decimal';
import { checkForDuplicateExpense } from '../lib/duplicate';
import { GlobalDialog, DialogOptions } from '../components/GlobalDialog';
import { 
  isFirebaseConfigured, 
  subscribeToAuthChanges, 
  loginAnonymously, 
  loginWithGoogle as fbLoginGoogle, 
  loginApple as fbLoginApple,
  loginMicrosoft as fbLoginMicrosoft,
  loginFacebook as fbLoginFacebook,
  loginEmail as fbLoginEmail,
  signupEmail as fbSignupEmail,
  logoutFirebase as fbLogout,
  initFirebase
} from '../lib/firebase';
import { 
  subscribeToTrip, 
  syncTripToCloud, 
  syncTripInvite,
  revokeTripInvite,
  syncUserTripMembership,
  syncMemberToCloud, 
  deleteMemberFromCloud,
  syncHouseholdToCloud, 
  deleteHouseholdFromCloud, 
  syncExpenseToCloud, 
  deleteExpenseFromCloud, 
  syncSettlementToCloud, 
  syncActivityToCloud,
  syncUserToCloud,
  fetchUserFromCloud,
  joinTripInCloud,
  removeUserFromTripAccess,
  fetchUserTripsFromCloud,
  fetchTripExpensesFromCloud,
  fetchTripMembersFromCloud,
  ActiveTripListeners
} from '../lib/firestoreSync';
import { sendLocalNotification, requestNotificationPermission, isNotificationGranted } from '../lib/notifications';
import { createId } from '../lib/id';

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
  deleteMember: (memberId: string) => Promise<void>;
  saveHousehold: (household: Omit<Household, 'id' | 'createdAt'>, existingId?: string) => Promise<void>;
  deleteHousehold: (householdId: string) => Promise<void>;
  transferOwnership: (tripId: string, newOwnerUserId: string) => Promise<void>;
  rotateTripInvite: (tripId: string) => Promise<void>;

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
  loginWithAppleAuth: () => Promise<void>;
  loginWithMicrosoftAuth: () => Promise<void>;
  loginWithFacebookAuth: () => Promise<void>;
  loginWithEmailAuth: (email: string, pass: string) => Promise<void>;
  signUpWithEmailAuth: (email: string, pass: string, name: string) => Promise<void>;
  logoutUser: () => Promise<void>;
  enableNotifications: () => Promise<boolean>;
  isNotificationsEnabled: boolean;
  isInitialized: boolean;
  refreshData: () => Promise<void>;
  showAlert: (message: string, title?: string, type?: 'info' | 'success' | 'warning' | 'danger') => void;
  showConfirm: (message: string, onConfirm: () => void | Promise<void>, options?: { title?: string; confirmText?: string; cancelText?: string; isDestructive?: boolean }) => void;
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

    // Propagate updated display name across all trip memberships in local DB and Firestore
    db.tripMembers.toArray().then(async (allMembers) => {
      for (const m of allMembers) {
        const isMatch = (u.id && (m.authUid === u.id || m.userId === u.id || m.legacyUserIds?.includes(u.id))) ||
                         (u.email && m.email && m.email.toLowerCase() === u.email.toLowerCase());
        if (isMatch && m.name !== u.name) {
          const updatedMember: TripMember = {
            ...m,
            name: u.name,
            userId: u.id,
            authUid: u.id,
            legacyUserIds: m.userId !== u.id
              ? [...new Set([...(m.legacyUserIds || []), m.userId])]
              : m.legacyUserIds
          };
          await db.tripMembers.put(updatedMember);
          if (isFirebaseConfigured() && isOnline) {
            syncMemberToCloud(m.tripId, updatedMember).catch(console.warn);
          }
        }
      }
    }).catch(console.warn);
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

  // In-App Global Modal Dialog State
  const [dialogState, setDialogState] = useState<DialogOptions | null>(null);

  const showAlert = useCallback((message: string, title?: string, type: 'info' | 'success' | 'warning' | 'danger' = 'info') => {
    setDialogState({
      message,
      title,
      type,
      confirmText: 'OK'
    });
  }, []);

  const showConfirm = useCallback((message: string, onConfirm: () => void | Promise<void>, options?: { title?: string; confirmText?: string; cancelText?: string; isDestructive?: boolean }) => {
    setDialogState({
      message,
      title: options?.title || 'Confirm Action',
      type: options?.isDestructive ? 'danger' : 'confirm',
      confirmText: options?.confirmText || 'Confirm',
      cancelText: options?.cancelText || 'Cancel',
      isDestructive: options?.isDestructive,
      onConfirm
    });
  }, []);

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

  // Local IndexedDB & Cloud refresh
  const refreshData = useCallback(async () => {
    try {
      await seedInitialDataIfNeeded();

      const uList = await db.users.toArray();
      setAllUsers(uList);

      if (storedUser) {
        const loggedIn = uList.find(u => u.id === storedUser.id);
        if (loggedIn) setStoredUser(loggedIn);
      }

      const allTrips = await db.trips.toArray();
      const allMembers = await db.tripMembers.toArray();
      const memberTripIds = new Set<string>();
      for (const m of allMembers) {
        if (
          m.userId === currentUser.id ||
          m.authUid === currentUser.id ||
          m.legacyUserIds?.includes(currentUser.id) ||
          (currentUser.email && m.email && m.email.toLowerCase() === currentUser.email.toLowerCase())
        ) {
          memberTripIds.add(m.tripId);
        }
      }

      // Filter active non-deleted trips for THIS user only
      const userTrips = allTrips.filter(t => 
        !t.isDeleted && (
          t.ownerId === currentUser.id || 
          t.memberUids?.includes(currentUser.id) ||
          memberTripIds.has(t.id)
        )
      );
      setTrips(userTrips);

      if (activeTripId) {
        const tripMembers = await db.tripMembers.where('tripId').equals(activeTripId).toArray();
        
        // Auto-sync current user's actual email & ID into their member record if placeholder/outdated
        const myMem = tripMembers.find(m => 
          m.userId === currentUser.id || 
          m.authUid === currentUser.id ||
          m.legacyUserIds?.includes(currentUser.id) ||
          (currentUser.email && m.email.toLowerCase() === currentUser.email.toLowerCase())
        );
        if (myMem && currentUser.email && (!myMem.email || myMem.email !== currentUser.email || myMem.userId !== currentUser.id)) {
          if (myMem.userId !== currentUser.id) {
            myMem.legacyUserIds = [...new Set([...(myMem.legacyUserIds || []), myMem.userId])];
          }
          myMem.email = currentUser.email;
          myMem.userId = currentUser.id;
          myMem.authUid = currentUser.id;
          await db.tripMembers.put(myMem);
          if (isFirebaseConfigured() && navigator.onLine) {
            syncMemberToCloud(activeTripId, myMem).catch(console.warn);
          }
        }

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

      // Full 2-Way Sync: Upload local trips and download cloud trips
      if (isFirebaseConfigured() && navigator.onLine) {
        // 1. Upload any local active trips to cloud if present
        for (const localTrip of allTrips) {
          if (!localTrip.isDeleted) {
            if (localTrip.ownerId === currentUser.id) {
              const migratedTrip = localTrip.inviteToken
                ? localTrip
                : { ...localTrip, inviteToken: createId('invite') };
              await db.trips.put(migratedTrip);
              try {
                await syncTripToCloud(migratedTrip);
                await syncTripInvite(migratedTrip);
                await syncUserTripMembership(migratedTrip.id, currentUser.id, 'owner');
              } catch (error) {
                console.warn('[Firestore Sync] Could not migrate trip access metadata:', error);
              }
            }
            const lMembers = await db.tripMembers.where('tripId').equals(localTrip.id).toArray();
            for (const lm of lMembers) {
              syncMemberToCloud(localTrip.id, lm).catch(console.warn);
            }
            const lExpenses = await db.expenses.where('tripId').equals(localTrip.id).toArray();
            for (const le of lExpenses) {
              syncExpenseToCloud(localTrip.id, le).catch(console.warn);
            }
          }
        }

        // 2. Fetch all user trips from cloud
        fetchUserTripsFromCloud(currentUser.id).then(async (remoteTrips) => {
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
            const freshMembers = await db.tripMembers.toArray();
            const freshMemberTripIds = new Set<string>();
            for (const m of freshMembers) {
              if (
                m.userId === currentUser.id ||
                m.authUid === currentUser.id ||
                m.legacyUserIds?.includes(currentUser.id) ||
                (currentUser.email && m.email && m.email.toLowerCase() === currentUser.email.toLowerCase())
              ) {
                freshMemberTripIds.add(m.tripId);
              }
            }
            setTrips(freshTrips.filter(t => !t.isDeleted && (
              t.ownerId === currentUser.id ||
              t.memberUids?.includes(currentUser.id) ||
              freshMemberTripIds.has(t.id)
            )));
          }
        }).catch(console.warn);
      }
    } catch (err) {
      console.warn('IndexedDB initial load error, continuing with fallback:', err);
    } finally {
      setIsInitialized(true);
    }
  }, [activeTripId, currentUser.id, currentUser.email, currentUser.name]);

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
          if (exp.clientSyncStatus === 'pending' || exp.clientSyncStatus === 'failed') {
            try {
              await syncExpenseToCloud(activeTripId, exp);
              await db.expenses.put({ ...exp, clientSyncStatus: 'synced' });
            } catch (error) {
              await db.expenses.put({ ...exp, clientSyncStatus: 'failed' });
              console.warn('[Firestore Sync] Retry failed:', error);
            }
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
    households,
    allUsers
  );

  const recommendedTransfers = calculateOptimizedSettlements(
    balances.individualBalances,
    balances.householdBalances,
    activeTrip?.mainCurrency || 'EUR',
    true
  );

  // Current User's Net balance (match by id, email, or display name)
  const userBalanceObj = balances.individualBalances.find(b => 
    b.userId === currentUser.id || 
    (currentUser.email && b.userId.toLowerCase() === currentUser.email.toLowerCase()) ||
    (currentUser.name && b.name.toLowerCase() === currentUser.name.toLowerCase())
  );
  const userNetBalance = userBalanceObj ? userBalanceObj.net : 0;

  // Last-used currency for Quick Add
  const lastUsedCurrency = (expenses.length > 0 && expenses[0].originalCurrency)
    ? expenses[0].originalCurrency
    : (activeTrip?.mainCurrency || currentUser.defaultCurrency || 'EUR');

  // Activity logger helper
  const addActivity = async (type: Activity['type'], description: string, metadata?: any) => {
    if (!activeTripId) return;
    const act: Activity = {
      id: createId('act'),
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

  const syncExpenseAndPersistStatus = async (expense: Expense): Promise<Expense> => {
    if (!isFirebaseConfigured() || !isOnline) {
      const pending = { ...expense, clientSyncStatus: 'pending' as const };
      await db.expenses.put(pending);
      setExpenses(prev => prev.map(item => item.id === pending.id ? pending : item));
      return pending;
    }

    setCloudSyncStatus('syncing');
    try {
      await syncExpenseToCloud(expense.tripId, expense);
      const synced = { ...expense, clientSyncStatus: 'synced' as const };
      await db.expenses.put(synced);
      setExpenses(prev => prev.map(item => item.id === synced.id ? synced : item));
      setCloudSyncStatus('connected');
      return synced;
    } catch (error) {
      const failed = { ...expense, clientSyncStatus: 'failed' as const };
      await db.expenses.put(failed);
      setExpenses(prev => prev.map(item => item.id === failed.id ? failed : item));
      setCloudSyncStatus('error');
      console.warn('[Firestore Sync] Expense remains local after upload failure:', error);
      return failed;
    }
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
      id: createId('exp'),
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
      clientSyncStatus: 'pending',
      createdAt: now,
      updatedAt: now
    };

    await db.expenses.put(newExpense);
    setExpenses(prev => [newExpense, ...prev.filter(e => e.id !== newExpense.id)]);

    const persistedExpense = await syncExpenseAndPersistStatus(newExpense);

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
      expense: persistedExpense,
      timeoutId
    });

    await refreshData();
    return { expense: persistedExpense, isDuplicate: dupCheck.isDuplicate, duplicateReason: dupCheck.reason };
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
      clientSyncStatus: 'pending'
    };
    await db.expenses.put(savePayload);
    setExpenses(prev => prev.map(e => e.id === savePayload.id ? savePayload : e));
    await syncExpenseAndPersistStatus(savePayload);
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
      updatedAt: now,
      clientSyncStatus: 'pending'
    };
    await db.expenses.put(updatedExp);
    setExpenses(prev => prev.filter(e => e.id !== expenseId));
    await syncExpenseAndPersistStatus(updatedExp);
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
      updatedAt: now,
      clientSyncStatus: 'pending'
    };
    await db.expenses.put(updatedExp);
    await syncExpenseAndPersistStatus(updatedExp);
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
      id: createId('stl'),
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
    const tripId = createId('trip');
    const newTrip: Trip = {
      ...tripData,
      id: tripId,
      ownerId: currentUser.id,
      memberUids: [currentUser.id],
      inviteToken: createId('invite'),
      createdAt: now,
      updatedAt: now,
      isClosed: false,
      isDeleted: false,
      clientSyncStatus: isOnline ? 'synced' : 'pending'
    };
    await db.trips.put(newTrip);

    // Add owner as member
    const ownerMember: TripMember = {
      id: createId('member'),
      tripId,
      userId: currentUser.id,
      authUid: currentUser.id,
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
      const memberId = createId('member');
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

    }

    if (isFirebaseConfigured() && isOnline) {
      try {
        // The parent trip must exist before membership-scoped rules permit
        // writes to any of its subcollections.
        await syncTripToCloud(newTrip);
        await syncTripInvite(newTrip);
        await syncUserTripMembership(tripId, currentUser.id, 'owner');
        const localMembers = await db.tripMembers.where('tripId').equals(tripId).toArray();
        await Promise.all(localMembers.map(member => syncMemberToCloud(tripId, member)));
        const syncedTrip = { ...newTrip, clientSyncStatus: 'synced' as const };
        await db.trips.put(syncedTrip);
      } catch (error) {
        await db.trips.put({ ...newTrip, clientSyncStatus: 'failed' });
        setCloudSyncStatus('error');
        console.warn('[Firestore Sync] Trip remains local after upload failure:', error);
      }
    }

    setActiveTripId(tripId);
    await refreshData();
    return newTrip.id;
  };

  const joinTrip = async (inviteToken: string) => {
    if (!currentUser.id || currentUser.id === 'guest') throw new Error('Sign in before joining a trip.');
    if (!isFirebaseConfigured() || !isOnline) throw new Error('An internet connection is required to join a trip.');

    const remoteTrip = await joinTripInCloud(inviteToken, currentUser.id);
    const tripId = remoteTrip.id;
    await db.trips.put(remoteTrip);

    // Membership is now authorized, so protected trip data can be loaded.
    const [remoteMembers, remoteExpenses] = await Promise.all([
      fetchTripMembersFromCloud(tripId),
      fetchTripExpensesFromCloud(tripId)
    ]);
    if (remoteMembers.length > 0) await db.tripMembers.bulkPut(remoteMembers);
    if (remoteExpenses.length > 0) await db.expenses.bulkPut(remoteExpenses);

    const normalizedEmail = currentUser.email.trim().toLowerCase();
    const existing = remoteMembers.find(member =>
      member.userId === currentUser.id ||
      member.legacyUserIds?.includes(currentUser.id) ||
      (normalizedEmail && member.email.trim().toLowerCase() === normalizedEmail)
    );
    const legacyUserIds = existing && existing.userId !== currentUser.id
      ? [...new Set([...(existing.legacyUserIds || []), existing.userId])]
      : existing?.legacyUserIds;
    const memberRecord: TripMember = {
      id: existing?.id || createId('member'),
      tripId,
      userId: currentUser.id,
      authUid: currentUser.id,
      legacyUserIds,
      name: existing?.name || currentUser.name || 'Member',
      email: currentUser.email,
      role: existing?.role === 'owner' && remoteTrip.ownerId === currentUser.id ? 'owner' : 'member',
      isActive: true,
      joinedAt: existing?.joinedAt || new Date().toISOString()
    };
    await db.tripMembers.put(memberRecord);
    await syncMemberToCloud(tripId, memberRecord);

    setTrips(prev => [...prev.filter(trip => trip.id !== remoteTrip.id), remoteTrip]);
    setActiveTripId(tripId);
    await refreshData();
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
    const userId = createId(`user_${name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'member'}`);
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

  const deleteMember = async (memberId: string) => {
    const m = await db.tripMembers.get(memberId);
    if (!m || !activeTrip) return;
    
    // Owner cannot be deleted
    if (m.role === 'owner' || m.userId === activeTrip.ownerId) {
      showAlert('The trip owner cannot be removed. Transfer ownership first if needed.', 'Action Not Allowed', 'warning');
      return;
    }

    // Remove member from households in this trip
    const tripHouseholds = await db.households.where('tripId').equals(activeTrip.id).toArray();
    for (const hh of tripHouseholds) {
      if (hh.memberUserIds.includes(m.userId)) {
        const updatedIds = hh.memberUserIds.filter(id => id !== m.userId);
        if (updatedIds.length < 2) {
          await db.households.delete(hh.id);
          if (isFirebaseConfigured() && isOnline) {
            deleteHouseholdFromCloud(activeTrip.id, hh.id).catch(console.warn);
          }
        } else {
          const updatedHh = { ...hh, memberUserIds: updatedIds };
          await db.households.put(updatedHh);
          if (isFirebaseConfigured() && isOnline) {
            syncHouseholdToCloud(activeTrip.id, updatedHh).catch(console.warn);
          }
        }
      }
    }

    // Delete from Dexie
    await db.tripMembers.delete(memberId);

    // Delete from Cloud
    if (isFirebaseConfigured() && isOnline) {
      deleteMemberFromCloud(activeTrip.id, memberId).catch(console.warn);
      removeUserFromTripAccess(activeTrip.id, m.authUid || m.userId).catch(console.warn);
    }

    const removedUid = m.authUid || m.userId;
    if (activeTrip.memberUids?.includes(removedUid)) {
      const updatedTrip = {
        ...activeTrip,
        memberUids: activeTrip.memberUids.filter(uid => uid !== removedUid),
        updatedAt: new Date().toISOString()
      };
      await db.trips.put(updatedTrip);
      setTrips(prev => prev.map(trip => trip.id === updatedTrip.id ? updatedTrip : trip));
    }

    await addActivity('member_left', `${m.name} was removed from the trip by the owner.`);
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

  const rotateTripInvite = async (tripId: string) => {
    const trip = await db.trips.get(tripId);
    if (!trip || trip.ownerId !== currentUser.id) {
      throw new Error('Only the trip owner can reset its invitation link.');
    }
    if (!isFirebaseConfigured() || !isOnline) {
      throw new Error('An internet connection is required to reset an invitation link.');
    }

    const previousToken = trip.inviteToken;
    const updatedTrip: Trip = {
      ...trip,
      inviteToken: createId('invite'),
      updatedAt: new Date().toISOString(),
      clientSyncStatus: 'pending'
    };

    await syncTripInvite(updatedTrip);
    await syncTripToCloud(updatedTrip);
    if (previousToken) await revokeTripInvite(previousToken);

    const syncedTrip = { ...updatedTrip, clientSyncStatus: 'synced' as const };
    await db.trips.put(syncedTrip);
    setTrips(prev => prev.map(item => item.id === tripId ? syncedTrip : item));
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

  const handlePostLogin = async (fbUser: any) => {
    if (!fbUser) return;
    try {
      const resolvedName = fbUser.displayName || (fbUser.email ? fbUser.email.split('@')[0] : 'User');
      const resolvedAvatar = fbUser.photoURL;

      const u: User = {
        id: fbUser.uid,
        name: resolvedName,
        email: fbUser.email || 'user@whopaid.app',
        defaultCurrency: 'EUR',
        avatarUrl: resolvedAvatar
      };

      // 1. Instant optimistic state update
      setCurrentUser(u);
      localStorage.setItem('whopaid_auth_user', JSON.stringify(u));
      localStorage.removeItem('whopaid_last_view');

      // 2. Persist locally in parallel
      db.users.put(u).catch(console.warn);

      // 3. Background sync without blocking login response
      if (isFirebaseConfigured()) {
        syncUserToCloud(u).catch(console.warn);
      }

      // App.tsx owns invitation processing so it happens exactly once and only
      // clears the pending token after a successful join.
      refreshData().catch(console.warn);
    } catch (err: any) {
      console.error('Post-login sync failed:', err);
      throw err;
    }
  };

  const loginWithGoogleAuth = async () => {
    try {
      const fbUser = await fbLoginGoogle();
      await handlePostLogin(fbUser);
    } catch (err: any) {
      console.error('Google login failed:', err);
      throw err;
    }
  };

  const loginWithAppleAuth = async () => {
    try {
      const fbUser = await fbLoginApple();
      await handlePostLogin(fbUser);
    } catch (err: any) {
      console.error('Apple login failed:', err);
      throw err;
    }
  };

  const loginWithMicrosoftAuth = async () => {
    try {
      const fbUser = await fbLoginMicrosoft();
      await handlePostLogin(fbUser);
    } catch (err: any) {
      console.error('Microsoft login failed:', err);
      throw err;
    }
  };

  const loginWithFacebookAuth = async () => {
    try {
      const fbUser = await fbLoginFacebook();
      await handlePostLogin(fbUser);
    } catch (err: any) {
      console.error('Facebook login failed:', err);
      throw err;
    }
  };

  const loginWithEmailAuth = async (email: string, pass: string) => {
    try {
      const fbUser = await fbLoginEmail(email, pass);
      await handlePostLogin(fbUser);
    } catch (err: any) {
      console.error('Email login failed:', err);
      throw err;
    }
  };

  const signUpWithEmailAuth = async (email: string, pass: string, name: string) => {
    try {
      const fbUser = await fbSignupEmail(email, pass, name);
      await handlePostLogin(fbUser);
    } catch (err: any) {
      console.error('Email signup failed:', err);
      throw err;
    }
  };

  const clearAllData = async () => {
    const allTrips = await db.trips.toArray();
    const now = new Date().toISOString();
    for (const t of allTrips) {
      const deleted = { ...t, isDeleted: true, deletedAt: now, updatedAt: now };
      await db.trips.put(deleted);
      if (isFirebaseConfigured() && isOnline) {
        syncTripToCloud(deleted).catch(console.warn);
      }
    }
    await db.trips.clear();
    await db.expenses.clear();
    await db.tripMembers.clear();
    await db.households.clear();
    await db.settlements.clear();
    await db.activities.clear();
    setActiveTripId(null);
    localStorage.removeItem('whopaid_active_trip');
    localStorage.removeItem('whopaid_last_view');
    setTrips([]);
    setExpenses([]);
    setMembers([]);
    setHouseholds([]);
    setSettlements([]);
    setActivities([]);
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
        deleteMember,
        saveHousehold,
        deleteHousehold,
        transferOwnership,
        rotateTripInvite,
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
        loginWithAppleAuth,
        loginWithMicrosoftAuth,
        loginWithFacebookAuth,
        loginWithEmailAuth,
        signUpWithEmailAuth,
        logoutUser,
        enableNotifications,
        isNotificationsEnabled: isNotificationGranted(),
        isInitialized,
        refreshData,
        showAlert,
        showConfirm
      }}
    >
      {children}
      <GlobalDialog 
        isOpen={dialogState !== null} 
        options={dialogState} 
        onClose={() => setDialogState(null)} 
      />
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
