import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { db, seedInitialDataIfNeeded } from '../lib/db';
import { User, Trip, TripMember, Household, Expense, Settlement, Activity, PushNotification, CurrencyCode } from '../types';
import { calculateParticipantBalances, resolveCurrentMemberUserId } from '../lib/balances';
import { calculateOptimizedSettlements } from '../lib/settlement';
import { fetchHistoricalExchangeRate, convertAmount } from '../lib/fx';
import { add, sub, roundMoney } from '../lib/decimal';
import { checkForDuplicateExpense } from '../lib/duplicate';
import { GlobalDialog, DialogOptions } from '../components/GlobalDialog';
import {
  isSupabaseConfigured,
  subscribeToAuthChanges, 
  loginWithGoogle as cloudLoginGoogle,
  loginEmail as cloudLoginEmail,
  signupEmail as cloudSignupEmail,
  logoutSupabase as cloudLogout
} from '../lib/supabase';
import { 
  subscribeToTrip, 
  syncTripToCloud, 
  deleteTripFromCloud,
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
  fetchTripHouseholdsFromCloud,
  fetchTripSettlementsFromCloud,
  transferTripOwnershipInCloud,
  ActiveTripListeners
} from '../lib/supabaseSync';
import { sendLocalNotification, requestNotificationPermission, isNotificationGranted } from '../lib/notifications';
import { createId } from '../lib/id';
import { retryOperation } from '../lib/asyncReliability';
import { assertTripContentsHydrated } from '../lib/tripHydration';
import { consolidateTripMembers, hasMemberWithEmail, isGuestMemberEmail, normalizeMemberEmail, uniqueInvitedEmails } from '../lib/memberIdentity';
import { memberPaidExpense, redistributeExpenseAfterMemberRemoval } from '../lib/memberRemoval';

interface UndoState {
  expense: Expense;
  timeoutId: any;
}

export interface StartupStatus {
  phase: 'loading-local' | 'syncing-cloud' | 'ready' | 'error';
  message: string;
  progress: number;
  indeterminate?: boolean;
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
  prepareTripForSharing: (tripId: string) => Promise<void>;

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
  isCloudActive: boolean;
  cloudSyncStatus: 'offline' | 'connected' | 'syncing' | 'error';
  authUser: any | null;
  isAuthReady: boolean;
  startupStatus: StartupStatus;
  loginWithGoogleAuth: () => Promise<void>;
  loginWithEmailAuth: (email: string, pass: string) => Promise<void>;
  signUpWithEmailAuth: (email: string, pass: string, name: string) => Promise<void>;
  logoutUser: () => Promise<void>;
  enableNotifications: () => Promise<boolean>;
  isNotificationsEnabled: boolean;
  isInitialized: boolean;
  refreshData: () => Promise<void>;
  syncWithCloud: () => Promise<void>;
  showAlert: (message: string, title?: string, type?: 'info' | 'success' | 'warning' | 'danger', highlight?: string) => void;
  showConfirm: (message: string, onConfirm: () => void | Promise<void>, options?: { title?: string; confirmText?: string; cancelText?: string; isDestructive?: boolean }) => void;
}

const appContextGlobal = globalThis as typeof globalThis & {
  __whopaidAppContext?: React.Context<AppContextType | null>;
};

// Keep the context identity stable when Vite replaces this module. Without
// this, consumers can briefly read a new context while the mounted provider is
// still using the previous one, producing a false "outside AppProvider" error.
const AppContext = appContextGlobal.__whopaidAppContext
  ?? createContext<AppContextType | null>(null);

if (import.meta.env.DEV) {
  appContextGlobal.__whopaidAppContext = AppContext;
}

const SIGNED_OUT_USER: User = {
  id: 'signed-out',
  name: '',
  email: '',
  defaultCurrency: 'EUR'
};

async function removeTripFromLocalCache(tripId: string): Promise<void> {
  await Promise.all([
    db.tripMembers.where('tripId').equals(tripId).delete(),
    db.households.where('tripId').equals(tripId).delete(),
    db.expenses.where('tripId').equals(tripId).delete(),
    db.settlements.where('tripId').equals(tripId).delete(),
    db.activities.where('tripId').equals(tripId).delete(),
    db.notifications.where('tripId').equals(tripId).delete(),
    db.trips.delete(tripId)
  ]);
}

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

  const currentUser: User = storedUser || SIGNED_OUT_USER;
  const isAuthenticated = storedUser !== null;

  const setCurrentUser = (u: User) => {
    setStoredUser(u);
    localStorage.setItem('whopaid_auth_user', JSON.stringify(u));
    db.users.put(u);
    if (isSupabaseConfigured() && isOnline) {
      syncUserToCloud(u).catch(console.warn);
    }

    // Propagate updated display name across local and cloud trip memberships.
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
          if (isSupabaseConfigured() && isOnline) {
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
  const [authUser, setAuthUser] = useState<any | null>(null);
  const [isAuthReady, setIsAuthReady] = useState<boolean>(false);
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'offline' | 'connected' | 'syncing' | 'error'>('offline');
  const [startupStatus, setStartupStatus] = useState<StartupStatus>({
    phase: 'loading-local',
    message: 'Opening your saved trips...',
    progress: 12
  });

  const tripListenersRef = useRef<ActiveTripListeners | null>(null);
  const hasHydratedRef = useRef<boolean>(false);
  const cloudSyncInFlightRef = useRef<Promise<void> | null>(null);

  // In-App Global Modal Dialog State
  const [dialogState, setDialogState] = useState<DialogOptions | null>(null);

  const showAlert = useCallback((message: string, title?: string, type: 'info' | 'success' | 'warning' | 'danger' = 'info', highlight?: string) => {
    setDialogState({
      message,
      title,
      type,
      highlight,
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
      if (isSupabaseConfigured()) setCloudSyncStatus('connected');
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

  // Supabase Auth listener
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setCloudSyncStatus('offline');
      setStoredUser(null);
      localStorage.removeItem('whopaid_auth_user');
      setIsAuthReady(true);
      return;
    }

    setCloudSyncStatus('connected');
    const unsubscribeAuth = subscribeToAuthChanges(async (cloudUser) => {
      setAuthUser(cloudUser);
      setIsAuthReady(true);
      if (cloudUser) {
        // Retrieve customized display name and currency if previously saved
        const localExisting = await db.users.get(cloudUser.id);
        const cloudExisting = isSupabaseConfigured() ? await fetchUserFromCloud(cloudUser.id) : null;
        const savedAuth = localStorage.getItem('whopaid_auth_user');
        let savedUserObj: User | null = null;
        try {
          if (savedAuth) savedUserObj = JSON.parse(savedAuth);
        } catch {}

        const previousAuthId = savedUserObj?.id || localStorage.getItem('whopaid_last_auth_uid');
        if (previousAuthId && previousAuthId !== cloudUser.id) {
          // IndexedDB is an offline cache, not cross-account storage. Never
          // expose one user's cached trips after another user signs in.
          await Promise.all([
            db.trips.clear(),
            db.tripMembers.clear(),
            db.households.clear(),
            db.expenses.clear(),
            db.settlements.clear(),
            db.activities.clear(),
            db.notifications.clear()
          ]);
          setTrips([]);
          setMembers([]);
          setHouseholds([]);
          setExpenses([]);
          setSettlements([]);
          setActivities([]);
          setActiveTripId(null);
        }
        localStorage.setItem('whopaid_last_auth_uid', cloudUser.id);

        const identityData = cloudUser.identities?.find((identity: any) => identity.provider === 'google')?.identity_data
          || cloudUser.identities?.[0]?.identity_data
          || {};
        const metadataName = cloudUser.user_metadata?.full_name
          || cloudUser.user_metadata?.name
          || identityData.full_name
          || identityData.name;
        const metadataAvatar = cloudUser.user_metadata?.avatar_url
          || cloudUser.user_metadata?.picture
          || identityData.avatar_url
          || identityData.picture;
        const resolvedName = (savedUserObj && savedUserObj.id === cloudUser.id && savedUserObj.name && savedUserObj.name !== 'User')
          ? savedUserObj.name
          : (localExisting?.name && localExisting.name !== 'User')
          ? localExisting.name
          : (cloudExisting?.name && cloudExisting.name !== 'User')
          ? cloudExisting.name
          : metadataName || savedUserObj?.name || 'Guest';

        const resolvedCurrency = localExisting?.defaultCurrency || cloudExisting?.defaultCurrency || savedUserObj?.defaultCurrency || 'EUR';
        const resolvedAvatar = metadataAvatar || localExisting?.avatarUrl || cloudExisting?.avatarUrl || savedUserObj?.avatarUrl;

        const updatedUser: User = {
          id: cloudUser.id,
          name: resolvedName,
          email: cloudUser.email || localExisting?.email || savedUserObj?.email || `${resolvedName.toLowerCase()}@whopaid.app`,
          defaultCurrency: resolvedCurrency,
          avatarUrl: resolvedAvatar
        };
        await db.users.put(updatedUser);
        setCurrentUser(updatedUser);
      } else {
        setStoredUser(null);
        localStorage.removeItem('whopaid_auth_user');
      }
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // Local IndexedDB & Cloud refresh
  const refreshData = useCallback(async () => {
    const isInitialHydration = !hasHydratedRef.current;
    try {
      if (isInitialHydration) {
        setStartupStatus({
          phase: 'loading-local',
          message: 'Loading saved trip data...',
          progress: 28
        });
      }

      await seedInitialDataIfNeeded();

      const [uList, allTrips, allMembers] = await Promise.all([
        db.users.toArray(),
        db.trips.toArray(),
        db.tripMembers.toArray()
      ]);
      setAllUsers(uList);

      if (storedUser) {
        const loggedIn = uList.find(u => u.id === storedUser.id);
        if (loggedIn) setStoredUser(loggedIn);
      }

      // Display all active non-deleted trips stored in this user's database
      const userTrips = allTrips.filter(t => !t.isDeleted);
      setTrips(userTrips);

      if (activeTripId) {
        const [
          tripMembers,
          tripHouseholds,
          tripExpenses,
          tripSettlements,
          tripActivities,
          tripNotifs
        ] = await Promise.all([
          db.tripMembers.where('tripId').equals(activeTripId).toArray(),
          db.households.where('tripId').equals(activeTripId).toArray(),
          db.expenses.where('tripId').equals(activeTripId).toArray(),
          db.settlements.where('tripId').equals(activeTripId).toArray(),
          db.activities.where('tripId').equals(activeTripId).toArray(),
          db.notifications.where('userId').equals(currentUser.id).toArray()
        ]);
        
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
          if (isSupabaseConfigured() && navigator.onLine) {
            syncMemberToCloud(activeTripId, myMem).catch(console.warn);
          }
        }

        setMembers(consolidateTripMembers(tripMembers));
        setHouseholds(tripHouseholds);
        tripExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setExpenses(tripExpenses);
        setSettlements(tripSettlements);
        tripActivities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setActivities(tripActivities);
        setNotifications(tripNotifs);
      }
    } catch (err) {
      console.warn('IndexedDB initial load error, continuing with fallback:', err);
    } finally {
      if (isInitialHydration) {
        hasHydratedRef.current = true;
        setStartupStatus({
          phase: 'ready',
          message: 'Saved trips loaded',
          progress: 100
        });
        setIsInitialized(true);
      }
    }
  }, [activeTripId, currentUser.id, currentUser.email, currentUser.name]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Reusable cloud sync function – fetches shared trips from PostgreSQL and
  // merges them into local IndexedDB. Called both at startup and when the user
  // taps "Sync".
  const syncWithCloud = useCallback(async () => {
    if (
      !isAuthenticated ||
      !isSupabaseConfigured() ||
      !navigator.onLine
    ) {
      // Offline or not logged in – just refresh from local DB
      await refreshData();
      return;
    }

    if (cloudSyncInFlightRef.current) {
      // A sync is already running – skip duplicate
      return;
    }

    setIsSyncing(true);
    setCloudSyncStatus('syncing');
    let syncPromise: Promise<void> | null = null;

    try {
      syncPromise = (async () => {
        const localTrips = await db.trips.toArray();
        // Read the server first. A previously synced local row is only a cache,
        // so it must never recreate a trip that was deleted on another device.
        // Only explicitly pending/failed local creations may bootstrap a row
        // that does not exist remotely yet.
        const initialRemoteTrips = await fetchUserTripsFromCloud(currentUser.id, true, true);
        const initialRemoteTripIds = new Set(initialRemoteTrips.map(trip => trip.id));
        const staleCachedTrips = localTrips.filter(trip =>
          !initialRemoteTripIds.has(trip.id) &&
          trip.clientSyncStatus !== 'pending' &&
          trip.clientSyncStatus !== 'failed'
        );

        for (const trip of staleCachedTrips) {
          await removeTripFromLocalCache(trip.id);
        }

        const staleCachedTripIds = new Set(staleCachedTrips.map(trip => trip.id));
        const retainedLocalTrips = localTrips.filter(trip => !staleCachedTripIds.has(trip.id));

        // Sync remote-owned trips plus genuinely new/failed local creations.
        const ownedTrips = retainedLocalTrips.filter(trip =>
          !trip.isDeleted &&
          trip.ownerId === currentUser.id &&
          (initialRemoteTripIds.has(trip.id) ||
            trip.clientSyncStatus === 'pending' ||
            trip.clientSyncStatus === 'failed')
        );

        await Promise.all(ownedTrips.map(async localTrip => {
          try {
            const migratedTrip: Trip = localTrip.inviteToken
              ? localTrip
              : { ...localTrip, inviteToken: createId('invite') };
            await db.trips.put(migratedTrip);
            // PostgreSQL foreign keys and RLS require the trip to exist before
            // its invitation and membership rows are created.
            await syncTripToCloud(migratedTrip);
            await Promise.all([
              syncTripInvite(migratedTrip),
              syncUserTripMembership(migratedTrip.id, currentUser.id, 'owner')
            ]);

            let localMembers = await db.tripMembers.where('tripId').equals(localTrip.id).toArray();
            const hasOwnerParticipant = localMembers.some(member =>
              member.authUid === currentUser.id || member.userId === currentUser.id
            );
            if (!hasOwnerParticipant) {
              const repairedOwner: TripMember = {
                id: `member_owner_${localTrip.id}`,
                tripId: localTrip.id,
                userId: currentUser.id,
                authUid: currentUser.id,
                name: currentUser.name || 'Owner',
                email: currentUser.email,
                role: 'owner',
                isActive: true,
                joinedAt: localTrip.createdAt || new Date().toISOString()
              };
              await db.tripMembers.put(repairedOwner);
              localMembers = [...localMembers, repairedOwner];
            }
            const consolidatedMembers = consolidateTripMembers(localMembers);
            const canonicalMemberIds = new Set(consolidatedMembers.map(member => member.id));
            const duplicateMemberIds = localMembers
              .filter(member => !canonicalMemberIds.has(member.id))
              .map(member => member.id);
            await db.tripMembers.bulkPut(consolidatedMembers);
            if (duplicateMemberIds.length > 0) {
              await Promise.all(duplicateMemberIds.map(memberId => deleteMemberFromCloud(localTrip.id, memberId)));
              await db.tripMembers.bulkDelete(duplicateMemberIds);
              localMembers = consolidatedMembers;
            }
            await Promise.all(localMembers.flatMap(member => {
              const writes: Promise<void>[] = [syncMemberToCloud(localTrip.id, member)];
              if (member.authUid && member.authUid !== currentUser.id) {
                writes.push(syncUserTripMembership(
                  localTrip.id,
                  member.authUid,
                  'member',
                  undefined,
                  member.id
                ));
              }
              return writes;
            }));
            await db.trips.put({ ...migratedTrip, clientSyncStatus: 'synced' });
          } catch (error) {
            await db.trips.put({ ...localTrip, clientSyncStatus: 'failed' });
            console.warn('[Supabase] Owned trip sync will retry:', localTrip.id, error);
          }
        }));

        // Publish any owner-participant repairs immediately to the active UI.
        await refreshData();

        const pendingExpenses = (await db.expenses
          .where('clientSyncStatus')
          .anyOf('pending', 'failed')
          .toArray());

        if (pendingExpenses.length > 0) {
          await Promise.all(pendingExpenses.map(async expense => {
            try {
              await syncExpenseToCloud(expense.tripId, expense);
              await db.expenses.put({ ...expense, clientSyncStatus: 'synced' });
            } catch (error) {
              await db.expenses.put({ ...expense, clientSyncStatus: 'failed' });
              console.warn('[Supabase] Pending expense sync will retry:', expense.id, error);
            }
          }));
        }

        // A successful strict fetch is authoritative for shared-trip access.
        // Trips absent from this response were deleted or access was revoked;
        // retain only locally owned rows so owners can restore soft deletions.
        const remoteTrips = await fetchUserTripsFromCloud(currentUser.id, true, true);
        const remoteTripIds = new Set(remoteTrips.map(trip => trip.id));
        const cachedTrips = await db.trips.toArray();
        const inaccessibleTrips = cachedTrips.filter(trip =>
          !remoteTripIds.has(trip.id) &&
          trip.clientSyncStatus !== 'pending' &&
          trip.clientSyncStatus !== 'failed'
        );

        for (const trip of inaccessibleTrips) {
          await removeTripFromLocalCache(trip.id);
        }

        if (remoteTrips.length > 0) await db.trips.bulkPut(remoteTrips);

        const retainedPendingTrips = retainedLocalTrips.filter(trip =>
          (trip.clientSyncStatus === 'pending' || trip.clientSyncStatus === 'failed') &&
          !remoteTripIds.has(trip.id)
        );
        const visibleTrips = new Map(retainedPendingTrips.map(trip => [trip.id, trip]));
        remoteTrips.forEach(trip => visibleTrips.set(trip.id, trip));
        setTrips([...visibleTrips.values()].filter(trip => !trip.isDeleted));

      })();
      cloudSyncInFlightRef.current = syncPromise;

      // Fast, responsive sync timeout (6s maximum)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Cloud sync timed out')), 6000)
      );

      await Promise.race([syncPromise, timeoutPromise]);

      setCloudSyncStatus('connected');
      setStartupStatus({
        phase: 'ready',
        message: 'Everything is up to date',
        progress: 100
      });
    } catch (error) {
      console.warn('[Supabase Sync] Background reconciliation warning:', error);
      setCloudSyncStatus('connected');
      setStartupStatus({
        phase: 'ready',
        message: 'Using saved data',
        progress: 100
      });
    } finally {
      setIsSyncing(false);
      if (syncPromise) {
        const activeSync = syncPromise;
        void activeSync.then(
          () => {
            if (cloudSyncInFlightRef.current === activeSync) cloudSyncInFlightRef.current = null;
          },
          () => {
            if (cloudSyncInFlightRef.current === activeSync) cloudSyncInFlightRef.current = null;
          }
        );
      } else {
        cloudSyncInFlightRef.current = null;
      }
    }
  }, [isAuthenticated, currentUser.id, currentUser.email, refreshData]);

  // Reconcile cloud state after local data is already visible on first load
  useEffect(() => {
    if (
      !isInitialized ||
      !isAuthenticated ||
      !isSupabaseConfigured() ||
      !isOnline ||
      cloudSyncInFlightRef.current
    ) {
      return;
    }

    setStartupStatus({
      phase: 'syncing-cloud',
      message: 'Checking for trip updates...',
      progress: 45,
      indeterminate: true
    });

    syncWithCloud();
  }, [isInitialized, isAuthenticated, isOnline, currentUser.id]);

  // Supabase Realtime subscriptions for the active trip.
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

    if (!activeTripId || !isSupabaseConfigured() || !isOnline) {
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
        const local = await db.tripMembers.where('tripId').equals(activeTripId).toArray();
        const remoteIds = new Set(remoteMembers.map(member => member.id));
        const localTrip = await db.trips.get(activeTripId);
        const isLocalBootstrap = localTrip?.ownerId === currentUser.id
          && localTrip.clientSyncStatus !== 'synced';
        if (!isLocalBootstrap) {
          await db.tripMembers.bulkDelete(local.filter(member => !remoteIds.has(member.id)).map(member => member.id));
        }
        if (remoteMembers.length > 0) await db.tripMembers.bulkPut(remoteMembers);
        const currentLocalMembers = await db.tripMembers.where('tripId').equals(activeTripId).toArray();
        setMembers(consolidateTripMembers(currentLocalMembers));
      },
      onHouseholdsUpdate: async (remoteHouseholds) => {
        const local = await db.households.where('tripId').equals(activeTripId).toArray();
        const remoteIds = new Set(remoteHouseholds.map(household => household.id));
        const localTrip = await db.trips.get(activeTripId);
        const isLocalBootstrap = localTrip?.ownerId === currentUser.id
          && localTrip.clientSyncStatus !== 'synced';
        if (!isLocalBootstrap) {
          await db.households.bulkDelete(local.filter(household => !remoteIds.has(household.id)).map(household => household.id));
        }
        if (remoteHouseholds.length > 0) await db.households.bulkPut(remoteHouseholds);
        const currentLocalHouseholds = await db.households.where('tripId').equals(activeTripId).toArray();
        setHouseholds(currentLocalHouseholds);
      },
      onExpensesUpdate: async (remoteExpenses) => {
        const local = await db.expenses.where('tripId').equals(activeTripId).toArray();
        const remoteIds = new Set(remoteExpenses.map(expense => expense.id));
        await db.expenses.bulkDelete(local.filter(expense =>
          !remoteIds.has(expense.id) && expense.clientSyncStatus === 'synced'
        ).map(expense => expense.id));
        if (remoteExpenses.length > 0) await db.expenses.bulkPut(remoteExpenses);
        const currentLocal = await db.expenses.where('tripId').equals(activeTripId).toArray();
        currentLocal.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setExpenses(currentLocal);
        setCloudSyncStatus('connected');
      },
      onSettlementsUpdate: async (remoteSettlements) => {
        const local = await db.settlements.where('tripId').equals(activeTripId).toArray();
        const remoteIds = new Set(remoteSettlements.map(settlement => settlement.id));
        const localTrip = await db.trips.get(activeTripId);
        const isLocalBootstrap = localTrip?.ownerId === currentUser.id
          && localTrip.clientSyncStatus !== 'synced';
        if (!isLocalBootstrap) {
          await db.settlements.bulkDelete(local.filter(settlement => !remoteIds.has(settlement.id)).map(settlement => settlement.id));
        }
        if (remoteSettlements.length > 0) await db.settlements.bulkPut(remoteSettlements);
        const currentLocalStl = await db.settlements.where('tripId').equals(activeTripId).toArray();
        setSettlements(currentLocalStl);
      },
      onActivitiesUpdate: async (remoteActs) => {
        const local = await db.activities.where('tripId').equals(activeTripId).toArray();
        const remoteIds = new Set(remoteActs.map(activity => activity.id));
        const localTrip = await db.trips.get(activeTripId);
        const isLocalBootstrap = localTrip?.ownerId === currentUser.id
          && localTrip.clientSyncStatus !== 'synced';
        if (!isLocalBootstrap) {
          await db.activities.bulkDelete(local.filter(activity => !remoteIds.has(activity.id)).map(activity => activity.id));
        }
        if (remoteActs.length > 0) await db.activities.bulkPut(remoteActs);
        setActivities(await db.activities.where('tripId').equals(activeTripId).toArray());
      },
      onError: (err) => {
        console.warn('[Supabase Sync] Listener warning:', err);
        setCloudSyncStatus('error');
      }
    });

    if (listeners) {
      tripListenersRef.current = listeners;
    }

    // Auto-sync any existing local expenses to cloud that may have been blocked
    if (isSupabaseConfigured() && isOnline) {
      db.expenses.where('tripId').equals(activeTripId).toArray().then(async (localExps) => {
        for (const exp of localExps) {
          if (exp.clientSyncStatus === 'pending' || exp.clientSyncStatus === 'failed') {
            try {
              await syncExpenseToCloud(activeTripId, exp);
              await db.expenses.put({ ...exp, clientSyncStatus: 'synced' });
            } catch (error) {
              await db.expenses.put({ ...exp, clientSyncStatus: 'failed' });
              console.warn('[Supabase Sync] Retry failed:', error);
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
  }, [activeTripId, isOnline, currentUser.id]);

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

  // Display names are not identifiers and may legitimately be identical.
  const currentMemberUserId = resolveCurrentMemberUserId(currentUser, members);
  const userBalanceObj = balances.individualBalances.find(b =>
    b.userId === currentMemberUserId
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
    if (isSupabaseConfigured() && isOnline) {
      syncActivityToCloud(activeTripId, act).catch(console.warn);
    }
    await refreshData();
  };

  const syncExpenseAndPersistStatus = async (expense: Expense): Promise<Expense> => {
    if (!isSupabaseConfigured() || !isOnline) {
      const pending = { ...expense, clientSyncStatus: 'pending' as const };
      await db.expenses.put(pending);
      setExpenses(prev => prev.map(item => item.id === pending.id ? pending : item));
      return pending;
    }

    setCloudSyncStatus('syncing');
    try {
      await retryOperation(() => syncExpenseToCloud(expense.tripId, expense));
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
      console.warn('[Supabase Sync] Expense remains local after upload failure:', error);
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
    if (persistedExpense.clientSyncStatus === 'failed') {
      showAlert(
        'The expense is saved on this device and will retry automatically when cloud access is available.',
        'Waiting to Sync',
        'warning'
      );
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
    if (isSupabaseConfigured() && isOnline && activeTrip) {
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
    const expenseTrip = activeTrip?.id === updated.tripId
      ? activeTrip
      : await db.trips.get(updated.tripId);
    if (!expenseTrip) throw new Error('The expense trip is no longer available.');

    const exchangeRateDate = (updated.date || now).split('T')[0];
    let exchangeRate = updated.exchangeRate || 1;
    let exchangeRateSource = updated.exchangeRateSource;

    if (!updated.isManualExchangeRate && updated.originalCurrency !== expenseTrip.mainCurrency) {
      const fxResult = await fetchHistoricalExchangeRate(
        updated.originalCurrency,
        expenseTrip.mainCurrency,
        exchangeRateDate
      );
      exchangeRate = fxResult.rate;
      exchangeRateSource = fxResult.source;
    } else if (updated.originalCurrency === expenseTrip.mainCurrency) {
      exchangeRate = 1;
      exchangeRateSource = 'Direct (1:1)';
    }

    const savePayload: Expense = {
      ...updated,
      mainCurrency: expenseTrip.mainCurrency,
      exchangeRate,
      exchangeRateDate,
      exchangeRateSource,
      convertedAmount: convertAmount(updated.originalAmount, exchangeRate),
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
    if (isSupabaseConfigured() && isOnline) {
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
    if (isSupabaseConfigured() && isOnline && activeTrip) {
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
    if (isSupabaseConfigured() && isOnline && activeTrip) {
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
      clientSyncStatus: 'pending'
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
    for (const cleanEmail of uniqueInvitedEmails(memberEmails, currentUser.email)) {
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

    setActiveTripId(tripId);
    await refreshData();

    // The local trip is complete and usable now. Cloud publication continues
    // in the background; the sharing screen verifies it before exposing a link.
    if (isSupabaseConfigured() && isOnline) {
      void (async () => {
        try {
          // The parent trip must exist before membership-scoped rules permit
          // writes to any of its subcollections.
          await retryOperation(() => syncTripToCloud(newTrip));
          await retryOperation(() => syncTripInvite(newTrip));
          await retryOperation(() => syncUserTripMembership(tripId, currentUser.id, 'owner'));
          const localMembers = await db.tripMembers.where('tripId').equals(tripId).toArray();
          await Promise.all(localMembers.map(member => retryOperation(() => syncMemberToCloud(tripId, member))));
          const syncedTrip = { ...newTrip, clientSyncStatus: 'synced' as const };
          await db.trips.put(syncedTrip);
          setTrips(previous => previous.map(trip => trip.id === tripId ? syncedTrip : trip));
        } catch (error) {
          const failedTrip = { ...newTrip, clientSyncStatus: 'failed' as const };
          await db.trips.put(failedTrip);
          setTrips(previous => previous.map(trip => trip.id === tripId ? failedTrip : trip));
          setCloudSyncStatus('error');
          console.warn('[Supabase Sync] Trip remains local after upload failure:', error);
        }
      })();
    }

    return newTrip.id;
  };

  const joinTrip = async (inviteToken: string) => {
    if (!isAuthenticated) throw new Error('Sign in before joining a trip.');
    if (!isSupabaseConfigured() || !isOnline) throw new Error('An internet connection is required to join a trip.');

    const remoteTrip = await joinTripInCloud(inviteToken, currentUser.id);
    const tripId = remoteTrip.id;

    // Persist before publishing. Otherwise an overlapping refresh can read
    // IndexedDB before this write finishes and remove the newly joined trip
    // from the home list again.
    await db.trips.put(remoteTrip);
    setTrips(prev => [...prev.filter(trip => trip.id !== remoteTrip.id), remoteTrip]);
    setActiveTripId(tripId);

    // A join is complete only when its critical contents are available. This
    // keeps the success message honest and prevents an empty trip shell from
    // being mistaken for a successful synchronization.
    try {
      const [remoteMembers, remoteExpenses, remoteHouseholds, remoteSettlements] = await retryOperation(
        async () => {
          const bundle = await Promise.all([
            fetchTripMembersFromCloud(tripId, true),
            fetchTripExpensesFromCloud(tripId, true),
            fetchTripHouseholdsFromCloud(tripId, true),
            fetchTripSettlementsFromCloud(tripId, true)
          ]);
          assertTripContentsHydrated(remoteTrip, bundle[0], bundle[1]);
          return bundle;
        }
      );
      if (remoteMembers.length > 0) await db.tripMembers.bulkPut(remoteMembers);
      if (remoteExpenses.length > 0) await db.expenses.bulkPut(remoteExpenses);
      if (remoteHouseholds.length > 0) await db.households.bulkPut(remoteHouseholds);
      if (remoteSettlements.length > 0) await db.settlements.bulkPut(remoteSettlements);

      const normalizedEmail = currentUser.email.trim().toLowerCase();
      const exactExisting = remoteMembers.find(member =>
        member.userId === currentUser.id ||
        member.legacyUserIds?.includes(currentUser.id) ||
        (normalizedEmail && member.email.trim().toLowerCase() === normalizedEmail)
      );
      const normalizedName = currentUser.name.trim().toLowerCase();
      const guestNameMatches = remoteMembers.filter(member =>
        isGuestMemberEmail(member.email) &&
        normalizedName &&
        member.name.trim().toLowerCase() === normalizedName
      );
      const existing = exactExisting || (guestNameMatches.length === 1 ? guestNameMatches[0] : undefined);
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
      await retryOperation(() => syncMemberToCloud(tripId, memberRecord));

      setMembers(consolidateTripMembers(await db.tripMembers.where('tripId').equals(tripId).toArray()));
      const hydratedExpenses = await db.expenses.where('tripId').equals(tripId).toArray();
      hydratedExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setExpenses(hydratedExpenses);
      setHouseholds(await db.households.where('tripId').equals(tripId).toArray());
      setSettlements(await db.settlements.where('tripId').equals(tripId).toArray());
      setTrips(previous => [...previous.filter(trip => trip.id !== remoteTrip.id), remoteTrip]);
    } catch (error) {
      console.warn('[Supabase] Trip membership created but content hydration failed:', error);
      throw new Error(
        `Trip access was added, but its participants and expenses could not be synchronized. ${error instanceof Error ? error.message : 'Please reopen WhoPaid and use Sync.'}`
      );
    }

    showAlert('You now have access to this trip and its shared expenses.', 'Trip Joined 🎉', 'success', remoteTrip.name);
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
        if (isSupabaseConfigured() && isOnline) {
          syncExpenseToCloud(trip.id, updatedExp).catch(console.warn);
        }
      }
    }

    const updatedTrip = { ...trip, updatedAt: now };
    await db.trips.put(updatedTrip);
    if (isSupabaseConfigured() && isOnline) {
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
      if (isSupabaseConfigured() && isOnline) syncTripToCloud(updated).catch(console.warn);
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
      if (isSupabaseConfigured() && isOnline) syncTripToCloud(updated).catch(console.warn);
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
      if (isSupabaseConfigured() && isOnline) syncTripToCloud(updated).catch(console.warn);
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
      if (isSupabaseConfigured() && isOnline) syncTripToCloud(updated).catch(console.warn);
    }
    setActiveTripId(tripId);
    await refreshData();
  };

  const permanentlyDeleteTrip = async (tripId: string) => {
    if (isSupabaseConfigured() && isOnline) {
      await deleteTripFromCloud(tripId);
    }
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
    const cleanEmail = email.trim();
    if (!normalizeMemberEmail(cleanEmail)) {
      throw new Error('Enter an email address for this participant.');
    }

    const tripMembers = await db.tripMembers.where('tripId').equals(tripId).toArray();
    if (hasMemberWithEmail(tripMembers, cleanEmail)) {
      throw new Error('A participant with this email is already in the trip.');
    }

    const userId = createId(`user_${name.toLowerCase().replace(/[^a-z0-9]/g, '') || 'member'}`);
    await db.users.put({
      id: userId,
      name,
      email: cleanEmail,
      defaultCurrency: activeTrip?.mainCurrency || 'EUR'
    });

    const member: TripMember = {
      id: `m_${Date.now()}`,
      tripId,
      userId,
      name,
      email: cleanEmail,
      role: 'member',
      isActive: true,
      joinedAt: now
    };
    await db.tripMembers.put(member);
    if (isSupabaseConfigured() && isOnline) {
      try {
        await syncMemberToCloud(tripId, member);
      } catch (error) {
        if ((error as { code?: string } | null)?.code === '23505') {
          await db.tripMembers.delete(member.id);
          await db.users.delete(userId);
          throw new Error('A participant with this email is already in the trip.');
        }
        console.warn('[Supabase] Member remains local after upload failure:', error);
      }
    }
    await addActivity('member_joined', `${name} joined the trip`);
    await refreshData();
  };

  const setMemberActive = async (memberId: string, isActive: boolean) => {
    const m = await db.tripMembers.get(memberId);
    if (m) {
      const updated = { ...m, isActive };
      await db.tripMembers.put(updated);
      if (isSupabaseConfigured() && isOnline && activeTrip) {
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

    const memberUserIds = new Set([m.userId, m.authUid, ...(m.legacyUserIds || [])].filter(Boolean) as string[]);
    const tripExpenses = await db.expenses.where('tripId').equals(activeTrip.id).toArray();
    const paidExpense = tripExpenses.find(expense => memberPaidExpense(expense, memberUserIds));
    if (paidExpense) {
      showAlert(
        `${m.name} paid “${paidExpense.description}”. Reassign that expense’s payer before removing this member.`,
        'Payer Must Be Reassigned',
        'warning'
      );
      return;
    }

    const remainingMemberIds = (await db.tripMembers.where('tripId').equals(activeTrip.id).toArray())
      .filter(member => member.id !== memberId && member.isActive)
      .map(member => member.userId);
    const revisedExpenses = tripExpenses
      .map(expense => redistributeExpenseAfterMemberRemoval(expense, memberUserIds, remainingMemberIds))
      .filter((expense): expense is Expense => expense !== null);

    if (isSupabaseConfigured() && isOnline && revisedExpenses.length > 0) {
      try {
        await Promise.all(revisedExpenses.map(expense => retryOperation(() => syncExpenseToCloud(activeTrip.id, expense))));
      } catch (error) {
        console.warn('[Supabase] Member removal redistribution failed:', error);
        showAlert(
          'The affected expenses could not be updated in the cloud. The member was not removed; please try again.',
          'Removal Not Completed',
          'warning'
        );
        return;
      }
    }

    if (revisedExpenses.length > 0) {
      await db.expenses.bulkPut(revisedExpenses.map(expense => ({
        ...expense,
        clientSyncStatus: isSupabaseConfigured() && isOnline ? 'synced' as const : expense.clientSyncStatus
      })));
    }

    // Remove member from households in this trip
    const tripHouseholds = await db.households.where('tripId').equals(activeTrip.id).toArray();
    for (const hh of tripHouseholds) {
      if (hh.memberUserIds.includes(m.userId)) {
        const updatedIds = hh.memberUserIds.filter(id => id !== m.userId);
        if (updatedIds.length < 2) {
          await db.households.delete(hh.id);
          if (isSupabaseConfigured() && isOnline) {
            deleteHouseholdFromCloud(activeTrip.id, hh.id).catch(console.warn);
          }
        } else {
          const updatedHh = { ...hh, memberUserIds: updatedIds };
          await db.households.put(updatedHh);
          if (isSupabaseConfigured() && isOnline) {
            syncHouseholdToCloud(activeTrip.id, updatedHh).catch(console.warn);
          }
        }
      }
    }

    // Delete from Dexie
    await db.tripMembers.delete(memberId);

    // Delete from Cloud
    if (isSupabaseConfigured() && isOnline) {
      deleteMemberFromCloud(activeTrip.id, memberId).catch(console.warn);
      if (m.authUid) removeUserFromTripAccess(activeTrip.id, m.authUid).catch(console.warn);
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

    await addActivity(
      'member_left',
      `${m.name} was removed from the trip by the owner.${revisedExpenses.length > 0 ? ` ${revisedExpenses.length} expense${revisedExpenses.length === 1 ? '' : 's'} redistributed.` : ''}`
    );
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
    if (isSupabaseConfigured() && isOnline) {
      syncHouseholdToCloud(hh.tripId, household).catch(console.warn);
    }
    await refreshData();
  };

  const deleteHousehold = async (householdId: string) => {
    const hh = await db.households.get(householdId);
    await db.households.delete(householdId);
    if (hh && isSupabaseConfigured() && isOnline) {
      deleteHouseholdFromCloud(hh.tripId, householdId).catch(console.warn);
    }
    await refreshData();
  };

  const transferOwnership = async (tripId: string, newOwnerUserId: string) => {
    if (!isSupabaseConfigured() || !isOnline) {
      throw new Error('An internet connection is required to transfer trip ownership.');
    }
    // The database function changes the owner and membership roles atomically.
    // Only update the device cache after the authoritative transaction succeeds.
    await transferTripOwnershipInCloud(tripId, newOwnerUserId);

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
        syncMemberToCloud(tripId, updated).catch(console.warn);
      }
    }
    const t = await db.trips.get(tripId);
    if (t) {
      const updatedTrip = { ...t, ownerId: newOwnerUserId };
      await db.trips.put(updatedTrip);
    }
    await refreshData();
  };

  const rotateTripInvite = async (tripId: string) => {
    const trip = await db.trips.get(tripId);
    if (!trip || trip.ownerId !== currentUser.id) {
      throw new Error('Only the trip owner can reset its invitation link.');
    }
    if (!isSupabaseConfigured() || !isOnline) {
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

  const prepareTripForSharing = async (tripId: string) => {
    const trip = await db.trips.get(tripId);
    if (!trip?.inviteToken) throw new Error('This trip does not have a valid invitation link.');
    if (!isSupabaseConfigured() || !isOnline) {
      throw new Error('Connect to the internet before sharing this trip.');
    }

    // Members may forward an existing owner-created link and must still flush
    // expenses created on their device. Owners additionally publish the trip,
    // invitation, membership roster, households, and settlements.
    const isOwner = trip.ownerId === currentUser.id;

    try {
      if (isOwner) {
        await retryOperation(() => syncTripToCloud(trip));
        await retryOperation(() => syncTripInvite(trip));
        await retryOperation(() => syncUserTripMembership(tripId, currentUser.id, 'owner'));
      }

      const [localMembers, localHouseholds, localExpenses, localSettlements, remoteMembers, remoteExpenses] = await Promise.all([
        db.tripMembers.where('tripId').equals(tripId).toArray(),
        db.households.where('tripId').equals(tripId).toArray(),
        db.expenses.where('tripId').equals(tripId).toArray(),
        db.settlements.where('tripId').equals(tripId).toArray(),
        fetchTripMembersFromCloud(tripId, true),
        fetchTripExpensesFromCloud(tripId, true)
      ]);

      const remoteExpensesById = new Map(remoteExpenses.map(expense => [expense.id, expense]));
      const expensesToUpload = localExpenses.filter(expense => {
        const remoteExpense = remoteExpensesById.get(expense.id);
        return !remoteExpense ||
          !remoteExpense.updatedAt ||
          expense.clientSyncStatus !== 'synced' ||
          expense.updatedAt > remoteExpense.updatedAt;
      });

      const writes: Array<Promise<void>> = [
        ...expensesToUpload.map(expense => retryOperation(() => syncExpenseToCloud(tripId, expense))),
        ...(isOwner ? localMembers.map(member => retryOperation(() => syncMemberToCloud(tripId, member))) : []),
        ...(isOwner ? localHouseholds.map(household => retryOperation(() => syncHouseholdToCloud(tripId, household))) : []),
        ...(isOwner ? localSettlements.map(settlement => retryOperation(() => syncSettlementToCloud(tripId, settlement))) : [])
      ];

      await Promise.all(writes);

      const preparedTrip: Trip = {
        ...trip,
        shareMemberCount: new Set([...remoteMembers.map(member => member.id), ...localMembers.map(member => member.id)]).size,
        shareExpenseCount: new Set([...remoteExpenses.map(expense => expense.id), ...localExpenses.map(expense => expense.id)]).size,
        sharePreparedAt: new Date().toISOString(),
        clientSyncStatus: 'synced'
      };
      if (isOwner) await retryOperation(() => syncTripToCloud(preparedTrip));

      if (localExpenses.length > 0) {
        await db.expenses.bulkPut(localExpenses.map(expense => ({ ...expense, clientSyncStatus: 'synced' as const })));
      }
      const syncedTrip = isOwner ? preparedTrip : { ...trip, clientSyncStatus: 'synced' as const };
      await db.trips.put(syncedTrip);
      setTrips(previous => previous.map(item => item.id === tripId ? syncedTrip : item));
      if (activeTripId === tripId) {
        setExpenses(await db.expenses.where('tripId').equals(tripId).toArray());
      }
    } catch (error) {
      const failedTrip = { ...trip, clientSyncStatus: 'failed' as const };
      await db.trips.put(failedTrip);
      setTrips(previous => previous.map(item => item.id === tripId ? failedTrip : item));
      console.warn('[Supabase Sync] Trip share preparation failed:', error);
      throw new Error('WhoPaid could not finish uploading this trip. Nothing was shared; please check the connection and try again.');
    }
  };

  const markNotificationRead = async (id: string) => {
    await db.notifications.update(id, { isRead: true });
    await refreshData();
  };

  // Auth Operations
  const handlePostLogin = async (cloudUser: any) => {
    if (!cloudUser) return;
    try {
      const identityData = cloudUser.identities?.find((identity: any) => identity.provider === 'google')?.identity_data
        || cloudUser.identities?.[0]?.identity_data
        || {};
      const resolvedName = cloudUser.user_metadata?.full_name
        || cloudUser.user_metadata?.name
        || identityData.full_name
        || identityData.name
        || (cloudUser.email ? cloudUser.email.split('@')[0] : 'User');
      const resolvedAvatar = cloudUser.user_metadata?.avatar_url
        || cloudUser.user_metadata?.picture
        || identityData.avatar_url
        || identityData.picture;

      const u: User = {
        id: cloudUser.id,
        name: resolvedName,
        email: cloudUser.email || 'user@whopaid.app',
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
      if (isSupabaseConfigured()) {
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
      const cloudUser = await cloudLoginGoogle();
      await handlePostLogin(cloudUser);
    } catch (err: any) {
      console.error('Google login failed:', err);
      throw err;
    }
  };

  const loginWithEmailAuth = async (email: string, pass: string) => {
    try {
      const cloudUser = await cloudLoginEmail(email, pass);
      await handlePostLogin(cloudUser);
    } catch (err: any) {
      console.error('Email login failed:', err);
      throw err;
    }
  };

  const signUpWithEmailAuth = async (email: string, pass: string, name: string) => {
    try {
      const cloudUser = await cloudSignupEmail(email, pass, name);
      await handlePostLogin(cloudUser);
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
      if (isSupabaseConfigured() && isOnline) {
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
    if (isAuthenticated && currentUser.id) {
      localStorage.setItem('whopaid_last_auth_uid', currentUser.id);
    }
    try {
      await cloudLogout();
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
        prepareTripForSharing,
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
        isCloudActive: isSupabaseConfigured(),
        cloudSyncStatus,
        authUser,
        isAuthReady,
        startupStatus,
        loginWithGoogleAuth,
        loginWithEmailAuth,
        signUpWithEmailAuth,
        logoutUser,
        enableNotifications,
        isNotificationsEnabled: isNotificationGranted(),
        isInitialized,
        refreshData,
        syncWithCloud,
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
