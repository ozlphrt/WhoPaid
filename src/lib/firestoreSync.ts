import { 
  collection, 
  doc, 
  getDoc,
  getDocs,
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  serverTimestamp, 
  Unsubscribe 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirebaseInstances } from './firebase';
import { Trip, TripMember, Household, Expense, Settlement, Activity } from '../types';

/* =========================================================================
   Firestore Sync Operations
========================================================================= */

export interface ActiveTripListeners {
  unsubscribeTrip: Unsubscribe;
  unsubscribeMembers: Unsubscribe;
  unsubscribeHouseholds: Unsubscribe;
  unsubscribeExpenses: Unsubscribe;
  unsubscribeSettlements: Unsubscribe;
  unsubscribeActivities: Unsubscribe;
}

/**
 * Subscribe in real-time to an active trip and its subcollections.
 */
export function subscribeToTrip(
  tripId: string,
  callbacks: {
    onTripUpdate: (trip: Trip | null) => void;
    onMembersUpdate: (members: TripMember[]) => void;
    onHouseholdsUpdate: (households: Household[]) => void;
    onExpensesUpdate: (expenses: Expense[]) => void;
    onSettlementsUpdate: (settlements: Settlement[]) => void;
    onActivitiesUpdate: (activities: Activity[]) => void;
    onError?: (err: any) => void;
  }
): ActiveTripListeners | null {
  const { db } = getFirebaseInstances();
  if (!db || !tripId) return null;

  try {
    // 1. Trip doc listener
    const tripDocRef = doc(db, 'trips', tripId);
    const unsubscribeTrip = onSnapshot(tripDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        callbacks.onTripUpdate({ id: snap.id, ...data } as Trip);
      } else {
        callbacks.onTripUpdate(null);
      }
    }, callbacks.onError);

    // 2. Members subcollection
    const membersRef = collection(db, 'trips', tripId, 'members');
    const unsubscribeMembers = onSnapshot(membersRef, (snap) => {
      const list: TripMember[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as TripMember));
      callbacks.onMembersUpdate(list);
    }, callbacks.onError);

    // 3. Households subcollection
    const householdsRef = collection(db, 'trips', tripId, 'households');
    const unsubscribeHouseholds = onSnapshot(householdsRef, (snap) => {
      const list: Household[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Household));
      callbacks.onHouseholdsUpdate(list);
    }, callbacks.onError);

    // 4. Expenses subcollection (listen to entire collection for 100% reliability)
    const expensesRef = collection(db, 'trips', tripId, 'expenses');
    const unsubscribeExpenses = onSnapshot(expensesRef, (snap) => {
      const list: Expense[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Expense));
      callbacks.onExpensesUpdate(list);
    }, callbacks.onError);

    // 5. Settlements subcollection
    const settlementsRef = collection(db, 'trips', tripId, 'settlements');
    const unsubscribeSettlements = onSnapshot(settlementsRef, (snap) => {
      const list: Settlement[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Settlement));
      callbacks.onSettlementsUpdate(list);
    }, callbacks.onError);

    // 6. Activities subcollection
    const activitiesRef = collection(db, 'trips', tripId, 'activities');
    const unsubscribeActivities = onSnapshot(activitiesRef, (snap) => {
      const list: Activity[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Activity));
      callbacks.onActivitiesUpdate(list);
    }, callbacks.onError);

    return {
      unsubscribeTrip,
      unsubscribeMembers,
      unsubscribeHouseholds,
      unsubscribeExpenses,
      unsubscribeSettlements,
      unsubscribeActivities
    };
  } catch (err) {
    console.error('[FirestoreSync] Failed to setup listeners for trip:', tripId, err);
    if (callbacks.onError) callbacks.onError(err);
    return null;
  }
}

/* =========================================================================
   Write Helpers (Upserts & Deletes) with undefined value sanitization
========================================================================= */

export function cleanForFirestore<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        clean[key] = value.map(item => (typeof item === 'object' && item !== null) ? cleanForFirestore(item) : item);
      } else if (typeof value === 'object' && value !== null) {
        clean[key] = cleanForFirestore(value);
      } else {
        clean[key] = value;
      }
    }
  }
  return clean;
}

export async function syncTripToCloud(trip: Trip): Promise<void> {
  const { db } = getFirebaseInstances();
  if (!db || !trip?.id) return;
  const tripRef = doc(db, 'trips', trip.id);
  const payload = cleanForFirestore({
    ...trip,
    clientSyncStatus: 'synced',
    updatedAt: new Date().toISOString()
  });
  await setDoc(tripRef, payload, { merge: true });
}

export async function syncMemberToCloud(tripId: string, member: TripMember): Promise<void> {
  const { db } = getFirebaseInstances();
  if (!db || !tripId || !member?.id) return;
  const memberRef = doc(db, 'trips', tripId, 'members', member.id);
  await setDoc(memberRef, cleanForFirestore(member), { merge: true });
}

export async function syncHouseholdToCloud(tripId: string, household: Household): Promise<void> {
  const { db } = getFirebaseInstances();
  if (!db || !tripId || !household?.id) return;
  const hRef = doc(db, 'trips', tripId, 'households', household.id);
  await setDoc(hRef, cleanForFirestore(household), { merge: true });
}

export async function deleteHouseholdFromCloud(tripId: string, householdId: string): Promise<void> {
  const { db } = getFirebaseInstances();
  if (!db || !tripId || !householdId) return;
  const hRef = doc(db, 'trips', tripId, 'households', householdId);
  await deleteDoc(hRef);
}

export async function syncExpenseToCloud(tripId: string, expense: Expense): Promise<void> {
  const { db } = getFirebaseInstances();
  if (!db || !tripId || !expense?.id) return;
  try {
    const expRef = doc(db, 'trips', tripId, 'expenses', expense.id);
    const payload = cleanForFirestore({
      ...expense,
      clientSyncStatus: 'synced',
      updatedAt: new Date().toISOString()
    });
    await setDoc(expRef, payload, { merge: true });
  } catch (err) {
    console.error('[Firestore] syncExpenseToCloud failed:', err);
    throw err;
  }
}

export async function deleteExpenseFromCloud(tripId: string, expenseId: string): Promise<void> {
  const { db } = getFirebaseInstances();
  if (!db || !tripId || !expenseId) return;
  const expRef = doc(db, 'trips', tripId, 'expenses', expenseId);
  await deleteDoc(expRef);
}

export async function syncSettlementToCloud(tripId: string, settlement: Settlement): Promise<void> {
  const { db } = getFirebaseInstances();
  if (!db || !tripId || !settlement?.id) return;
  const setRef = doc(db, 'trips', tripId, 'settlements', settlement.id);
  await setDoc(setRef, cleanForFirestore(settlement), { merge: true });
}

export async function deleteSettlementFromCloud(tripId: string, settlementId: string): Promise<void> {
  const { db } = getFirebaseInstances();
  if (!db || !tripId || !settlementId) return;
  const setRef = doc(db, 'trips', tripId, 'settlements', settlementId);
  await deleteDoc(setRef);
}

export async function syncActivityToCloud(tripId: string, activity: Activity): Promise<void> {
  const { db } = getFirebaseInstances();
  if (!db || !tripId || !activity?.id) return;
  const actRef = doc(db, 'trips', tripId, 'activities', activity.id);
  await setDoc(actRef, cleanForFirestore(activity), { merge: true });
}

/* =========================================================================
   Storage Helper for Receipts with WebP Compression
========================================================================= */

export async function compressAndUploadReceipt(
  tripId: string,
  file: File | Blob,
  fileName?: string
): Promise<string> {
  const { storage } = getFirebaseInstances();

  // Compress image to lightweight WebP Data URL (< 35 KB)
  const compressedDataUrl = await compressImageToWebpDataUrl(file, 1200, 0.75);

  if (!storage) {
    // Return compressed DataURL directly (works 100% free with Firestore Spark Plan)
    return compressedDataUrl;
  }

  try {
    const compressedBlob = await compressImageToWebp(file, 1400, 0.80);
    const name = fileName || `receipt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.webp`;
    const storageRef = ref(storage, `trips/${tripId}/receipts/${name}`);

    const snapshot = await uploadBytes(storageRef, compressedBlob, {
      contentType: 'image/webp'
    });

    return await getDownloadURL(snapshot.ref);
  } catch (storageErr) {
    console.warn('[Storage] Upload failed, falling back to compressed inline WebP:', storageErr);
    return compressedDataUrl;
  }
}

export async function fetchTripFromCloud(tripId: string): Promise<Trip | null> {
  const { db } = getFirebaseInstances();
  if (!db || !tripId) return null;
  try {
    const tripRef = doc(db, 'trips', tripId);
    const snap = await getDoc(tripRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as Trip;
    }
  } catch (err) {
    console.warn('[Firestore] Failed to fetch trip from cloud:', err);
  }
  return null;
}

export async function fetchUserTripsFromCloud(userId: string, userEmail?: string): Promise<Trip[]> {
  const { db } = getFirebaseInstances();
  if (!db || !userId) return [];
  try {
    const tripsRef = collection(db, 'trips');
    const allSnap = await getDocs(tripsRef);
    const resultTrips: Trip[] = [];

    for (const docSnap of allSnap.docs) {
      const tripData = { id: docSnap.id, ...docSnap.data() } as Trip;
      if (tripData.isDeleted) continue;

      if (tripData.ownerId === userId) {
        resultTrips.push(tripData);
        continue;
      }

      // Check if user is member of this trip in cloud
      try {
        const memRef = collection(db, 'trips', docSnap.id, 'members');
        const memSnap = await getDocs(memRef);
        let isMem = false;
        memSnap.forEach(mDoc => {
          const m = mDoc.data() as TripMember;
          if (
            m.userId === userId ||
            (userEmail && m.email && m.email.toLowerCase() === userEmail.toLowerCase())
          ) {
            isMem = true;
          }
        });
        if (isMem) {
          resultTrips.push(tripData);
        }
      } catch (memErr) {
        console.warn('Error checking membership for trip:', docSnap.id, memErr);
      }
    }
    return resultTrips;
  } catch (err) {
    console.warn('[Firestore] fetchUserTripsFromCloud error:', err);
    return [];
  }
}

export async function fetchTripExpensesFromCloud(tripId: string): Promise<Expense[]> {
  const { db } = getFirebaseInstances();
  if (!db || !tripId) return [];
  try {
    const expensesRef = collection(db, 'trips', tripId, 'expenses');
    const snap = await getDocs(expensesRef);
    const list: Expense[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Expense));
    return list;
  } catch (err) {
    console.warn('[Firestore] Failed to fetch trip expenses from cloud:', err);
    return [];
  }
}

export async function fetchTripMembersFromCloud(tripId: string): Promise<TripMember[]> {
  const { db } = getFirebaseInstances();
  if (!db || !tripId) return [];
  try {
    const membersRef = collection(db, 'trips', tripId, 'members');
    const snap = await getDocs(membersRef);
    const list: TripMember[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() } as TripMember));
    return list;
  } catch (err) {
    console.warn('[Firestore] Failed to fetch trip members from cloud:', err);
    return [];
  }
}

export async function syncUserToCloud(user: { id: string; name: string; email: string; defaultCurrency?: string; avatarUrl?: string }): Promise<void> {
  const { db } = getFirebaseInstances();
  if (!db || !user?.id) return;
  try {
    const userRef = doc(db, 'users', user.id);
    await setDoc(userRef, {
      id: user.id,
      name: user.name,
      email: user.email,
      defaultCurrency: user.defaultCurrency || 'EUR',
      avatarUrl: user.avatarUrl || null,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.warn('[Firestore] Failed to sync user profile:', err);
  }
}

export async function fetchUserFromCloud(uid: string): Promise<any | null> {
  const { db } = getFirebaseInstances();
  if (!db || !uid) return null;
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data();
    }
  } catch (err) {
    console.warn('[Firestore] Failed to fetch user profile:', err);
  }
  return null;
}

function compressImageToWebpDataUrl(source: File | Blob, maxDim = 1200, quality = 0.75): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve('');
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => resolve(reader.result as string);
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(reader.result as string);

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/webp', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(source);
  });
}

function compressImageToWebp(source: File | Blob, maxDim = 1600, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(source); // fallback
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              resolve(source);
            }
          },
          'image/webp',
          quality
        );
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(source);
  });
}
