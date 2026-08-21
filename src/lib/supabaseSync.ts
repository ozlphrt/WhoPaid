import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Activity, Expense, Household, Settlement, Trip, TripMember, User } from '../types';
import { supabase } from './supabase';

export interface ActiveTripListeners {
  unsubscribeTrip: () => void;
  unsubscribeMembers: () => void;
  unsubscribeHouseholds: () => void;
  unsubscribeExpenses: () => void;
  unsubscribeSettlements: () => void;
  unsubscribeActivities: () => void;
}

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

function withoutUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map(withoutUndefined) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, nested]) => nested !== undefined)
        .map(([key, nested]) => [key, withoutUndefined(nested)])
    ) as T;
  }
  return value;
}

function unwrap<T>(rows: Array<{ payload: T }> | null): T[] {
  return (rows || []).map(row => row.payload);
}

async function upsertPayload(table: string, value: { id: string; tripId: string }, extras: Record<string, unknown> = {}) {
  const { error } = await requireClient().from(table).upsert({
    id: value.id,
    trip_id: value.tripId,
    payload: withoutUndefined(value),
    updated_at: new Date().toISOString(),
    ...extras
  });
  if (error) throw error;
}

async function deleteRow(table: string, id: string) {
  const { error } = await requireClient().from(table).delete().eq('id', id);
  if (error) throw error;
}

async function fetchTripRows<T>(table: string, tripId: string, strict = false): Promise<T[]> {
  if (!supabase || !tripId) {
    if (strict) throw new Error('Cloud access is unavailable.');
    return [];
  }
  const { data, error } = await supabase.from(table).select('payload').eq('trip_id', tripId);
  if (error) {
    if (strict) throw error;
    console.warn(`[Supabase] Could not fetch ${table}:`, error.message);
    return [];
  }
  return unwrap(data as Array<{ payload: T }>);
}

export async function syncTripToCloud(trip: Trip): Promise<void> {
  const payload: Trip = {
    ...trip,
    clientSyncStatus: 'synced',
    updatedAt: new Date().toISOString()
  };
  const { error } = await requireClient().rpc('upsert_owned_trip', {
    target_trip_id: trip.id,
    target_invite_token: trip.inviteToken ?? null,
    target_is_deleted: trip.isDeleted,
    target_payload: withoutUndefined(payload),
    target_updated_at: payload.updatedAt
  });
  if (error) throw error;
}

export async function deleteTripFromCloud(tripId: string): Promise<void> {
  const { error } = await requireClient().from('trips').delete().eq('id', tripId);
  if (error) throw error;
}

export async function syncTripInvite(trip: Trip): Promise<void> {
  if (!trip.inviteToken) return;
  const { error } = await requireClient().from('trip_invites').upsert({
    token: trip.inviteToken,
    trip_id: trip.id,
    created_by: trip.ownerId,
    revoked: false,
    updated_at: new Date().toISOString()
  });
  if (error) throw error;
}

export async function revokeTripInvite(inviteToken: string): Promise<void> {
  const { error } = await requireClient().from('trip_invites')
    .update({ revoked: true, updated_at: new Date().toISOString() })
    .eq('token', inviteToken);
  if (error) throw error;
}

export async function syncUserTripMembership(
  tripId: string,
  userId: string,
  role: 'owner' | 'member',
  _inviteToken?: string,
  memberId?: string
): Promise<void> {
  const { error } = await requireClient().from('trip_memberships').upsert({
    trip_id: tripId,
    user_id: userId,
    role,
    member_id: memberId ?? null
  });
  if (error) throw error;
}

export async function joinTripInCloud(inviteToken: string, userId: string): Promise<Trip> {
  const client = requireClient();
  const { data: { session } } = await client.auth.getSession();
  const user = session?.user;
  if (!user || user.id !== userId) throw new Error('Please sign in again before joining this trip.');
  const { data, error } = await client.rpc('join_trip', { invitation_token: inviteToken });
  if (error) throw error;
  if (!data) throw new Error('This invitation is invalid or has expired.');
  return data as Trip;
}

export async function removeUserFromTripAccess(tripId: string, userId: string): Promise<void> {
  const { error } = await requireClient().from('trip_memberships').delete()
    .eq('trip_id', tripId).eq('user_id', userId);
  if (error) throw error;
}

export const syncMemberToCloud = (tripId: string, member: TripMember) => upsertPayload('trip_members', { ...member, tripId });
export const deleteMemberFromCloud = (_tripId: string, memberId: string) => deleteRow('trip_members', memberId);
export const syncHouseholdToCloud = (tripId: string, household: Household) => upsertPayload('households', { ...household, tripId });
export const deleteHouseholdFromCloud = (_tripId: string, householdId: string) => deleteRow('households', householdId);

export async function syncExpenseToCloud(tripId: string, expense: Expense): Promise<void> {
  const payload: Expense = {
    ...expense,
    tripId,
    clientSyncStatus: 'synced',
    updatedAt: new Date().toISOString()
  };
  await upsertPayload('expenses', payload);
}

export const deleteExpenseFromCloud = (_tripId: string, expenseId: string) => deleteRow('expenses', expenseId);
export const syncSettlementToCloud = (tripId: string, settlement: Settlement) => upsertPayload('settlements', { ...settlement, tripId });
export const deleteSettlementFromCloud = (_tripId: string, settlementId: string) => deleteRow('settlements', settlementId);
export const syncActivityToCloud = (tripId: string, activity: Activity) => upsertPayload('activities', { ...activity, tripId });

export async function fetchTripFromCloud(tripId: string): Promise<Trip | null> {
  if (!supabase || !tripId) return null;
  const { data, error } = await supabase.from('trips').select('payload').eq('id', tripId).maybeSingle();
  if (error) return null;
  return (data?.payload as Trip) ?? null;
}

export async function fetchUserTripsFromCloud(userId: string, strict = false): Promise<Trip[]> {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase.from('trips').select('payload').eq('is_deleted', false);
  if (error) {
    if (strict) throw error;
    console.warn('[Supabase] Could not fetch trips:', error.message);
    return [];
  }
  return unwrap(data as Array<{ payload: Trip }>);
}

export const fetchTripExpensesFromCloud = (tripId: string, strict = false) => fetchTripRows<Expense>('expenses', tripId, strict);
export const fetchTripMembersFromCloud = (tripId: string, strict = false) => fetchTripRows<TripMember>('trip_members', tripId, strict);
export const fetchTripHouseholdsFromCloud = (tripId: string, strict = false) => fetchTripRows<Household>('households', tripId, strict);
export const fetchTripSettlementsFromCloud = (tripId: string, strict = false) => fetchTripRows<Settlement>('settlements', tripId, strict);

export async function syncUserToCloud(user: User): Promise<void> {
  const { error } = await requireClient().from('profiles').upsert({
    id: user.id,
    name: user.name,
    email: user.email,
    default_currency: user.defaultCurrency || 'EUR',
    avatar_url: user.avatarUrl ?? null,
    updated_at: new Date().toISOString()
  });
  if (error) throw error;
}

export async function fetchUserFromCloud(uid: string): Promise<User | null> {
  if (!supabase || !uid) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    defaultCurrency: data.default_currency,
    avatarUrl: data.avatar_url ?? undefined
  };
}

function watch(table: string, tripId: string, refresh: () => void, onError?: (error: unknown) => void): RealtimeChannel {
  return requireClient().channel(`trip:${tripId}:${table}`)
    // DELETE events cannot be reliably filtered by non-primary-key columns.
    // RLS limits this stream to the user's trips; refetching the active trip is
    // inexpensive and ensures removals appear on every device immediately.
    .on('postgres_changes', { event: '*', schema: 'public', table }, refresh)
    .subscribe(status => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') onError?.(new Error(`${table} realtime connection failed.`));
    });
}

function watchTrip(tripId: string, refresh: () => void, onError?: (error: unknown) => void): RealtimeChannel {
  return requireClient().channel(`trip:${tripId}:trip`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'trips', filter: `id=eq.${tripId}` }, refresh)
    .subscribe(status => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') onError?.(new Error('Trip realtime connection failed.'));
    });
}

export function subscribeToTrip(
  tripId: string,
  callbacks: {
    onTripUpdate: (trip: Trip | null) => void;
    onMembersUpdate: (members: TripMember[]) => void;
    onHouseholdsUpdate: (households: Household[]) => void;
    onExpensesUpdate: (expenses: Expense[]) => void;
    onSettlementsUpdate: (settlements: Settlement[]) => void;
    onActivitiesUpdate: (activities: Activity[]) => void;
    onError?: (err: unknown) => void;
  }
): ActiveTripListeners | null {
  if (!supabase || !tripId) return null;
  void Promise.all([
    fetchTripFromCloud(tripId).then(callbacks.onTripUpdate),
    fetchTripMembersFromCloud(tripId).then(callbacks.onMembersUpdate),
    fetchTripHouseholdsFromCloud(tripId).then(callbacks.onHouseholdsUpdate),
    fetchTripExpensesFromCloud(tripId).then(callbacks.onExpensesUpdate),
    fetchTripSettlementsFromCloud(tripId).then(callbacks.onSettlementsUpdate),
    fetchTripRows<Activity>('activities', tripId).then(callbacks.onActivitiesUpdate)
  ]).catch(callbacks.onError);
  const channels = {
    trip: watchTrip(tripId, () => void fetchTripFromCloud(tripId).then(callbacks.onTripUpdate), callbacks.onError),
    members: watch('trip_members', tripId, () => void fetchTripMembersFromCloud(tripId).then(callbacks.onMembersUpdate), callbacks.onError),
    households: watch('households', tripId, () => void fetchTripHouseholdsFromCloud(tripId).then(callbacks.onHouseholdsUpdate), callbacks.onError),
    expenses: watch('expenses', tripId, () => void fetchTripExpensesFromCloud(tripId).then(callbacks.onExpensesUpdate), callbacks.onError),
    settlements: watch('settlements', tripId, () => void fetchTripSettlementsFromCloud(tripId).then(callbacks.onSettlementsUpdate), callbacks.onError),
    activities: watch('activities', tripId, () => void fetchTripRows<Activity>('activities', tripId).then(callbacks.onActivitiesUpdate), callbacks.onError)
  };
  const remove = (channel: RealtimeChannel) => () => { void supabase?.removeChannel(channel); };
  return {
    unsubscribeTrip: remove(channels.trip),
    unsubscribeMembers: remove(channels.members),
    unsubscribeHouseholds: remove(channels.households),
    unsubscribeExpenses: remove(channels.expenses),
    unsubscribeSettlements: remove(channels.settlements),
    unsubscribeActivities: remove(channels.activities)
  };
}

export async function transferTripOwnershipInCloud(tripId: string, newOwnerUserId: string): Promise<void> {
  const { error } = await requireClient().rpc('transfer_trip_ownership', {
    target_trip_id: tripId,
    new_owner_id: newOwnerUserId
  });
  if (error) throw error;
}

export async function compressAndUploadReceipt(_tripId: string, file: File | Blob): Promise<string> {
  return compressImageToWebpDataUrl(file, 1200, 0.75);
}

function compressImageToWebpDataUrl(source: File | Blob, maxDim: number, quality: number): Promise<string> {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onerror = () => resolve('');
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => resolve(String(reader.result || ''));
      image.onload = () => {
        let { width, height } = image;
        const scale = Math.min(1, maxDim / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) return resolve(String(reader.result || ''));
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/webp', quality));
      };
      image.src = String(reader.result || '');
    };
    reader.readAsDataURL(source);
  });
}
