import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadString } from 'firebase/storage';

const PROJECT_ID = 'demo-whopaid-rules-test';
let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    storage: { rules: readFileSync('storage.rules', 'utf8') }
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.clearStorage();
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', 'owner'), { id: 'owner', email: 'owner@example.test' });
    await setDoc(doc(db, 'users', 'member'), { id: 'member', email: 'member@example.test' });
    await setDoc(doc(db, 'trips', 'trip-a'), {
      name: 'Trip A',
      ownerId: 'owner',
      memberUids: ['owner', 'member'],
      isClosed: false,
      isDeleted: false,
      updatedAt: '2026-01-01T00:00:00.000Z'
    });
    await setDoc(doc(db, 'trips', 'trip-b'), {
      name: 'Trip B',
      ownerId: 'other-owner',
      memberUids: ['other-owner'],
      isClosed: false,
      isDeleted: false,
      updatedAt: '2026-01-01T00:00:00.000Z'
    });
    await setDoc(doc(db, 'trips', 'trip-legacy'), {
      name: 'Legacy Shared Trip',
      ownerId: 'other-owner',
      isClosed: false,
      isDeleted: false,
      updatedAt: '2026-01-01T00:00:00.000Z'
    });
    await setDoc(doc(db, 'trips', 'trip-legacy', 'members', 'legacy-member'), {
      tripId: 'trip-legacy',
      userId: 'old-local-id',
      authUid: 'legacy-user',
      email: 'legacy@example.test',
      role: 'member',
      isActive: true
    });
    await setDoc(doc(db, 'trips', 'trip-a', 'expenses', 'expense-a'), {
      description: 'Dinner',
      tripId: 'trip-a'
    });
    await setDoc(doc(db, 'trips', 'trip-b', 'expenses', 'expense-b'), {
      description: 'Private dinner',
      tripId: 'trip-b'
    });
    await setDoc(doc(db, 'users', 'owner', 'tripMemberships', 'trip-a'), {
      tripId: 'trip-a', userId: 'owner', role: 'owner'
    });
    await setDoc(doc(db, 'users', 'member', 'tripMemberships', 'trip-a'), {
      tripId: 'trip-a', userId: 'member', role: 'member'
    });
    await setDoc(doc(db, 'users', 'other-owner', 'tripMemberships', 'trip-b'), {
      tripId: 'trip-b', userId: 'other-owner', role: 'owner'
    });
    await setDoc(doc(db, 'tripInvites', 'invite-b'), {
      tripId: 'trip-b', createdBy: 'other-owner', revoked: false
    });
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('Firestore authorization', () => {
  it('keeps user profiles private', async () => {
    const memberDb = testEnv.authenticatedContext('member').firestore();
    await assertSucceeds(getDoc(doc(memberDb, 'users', 'member')));
    await assertFails(getDoc(doc(memberDb, 'users', 'owner')));
  });

  it('allows members to read indexed trips without listing the whole collection', async () => {
    const memberDb = testEnv.authenticatedContext('member').firestore();
    const membershipResult = await assertSucceeds(getDocs(collection(memberDb, 'users', 'member', 'tripMemberships')));
    expect(membershipResult.docs.map(item => item.id)).toEqual(['trip-a']);
    await assertSucceeds(getDoc(doc(memberDb, 'trips', 'trip-a')));
    await assertFails(getDocs(collection(memberDb, 'trips')));
  });

  it('blocks non-members from trip contents even when they know the trip ID', async () => {
    const outsiderDb = testEnv.authenticatedContext('outsider').firestore();
    await assertFails(getDoc(doc(outsiderDb, 'trips', 'trip-b')));
    await assertFails(getDoc(doc(outsiderDb, 'trips', 'trip-b', 'expenses', 'expense-b')));
  });

  it('lets a legacy member discover and self-index only their own shared trip', async () => {
    const legacyDb = testEnv.authenticatedContext('legacy-user', { email: 'legacy@example.test' }).firestore();
    const matchingMembers = await assertSucceeds(getDocs(query(
      collectionGroup(legacyDb, 'members'),
      where('authUid', '==', 'legacy-user')
    )));
    expect(matchingMembers.docs.map(item => item.id)).toEqual(['legacy-member']);

    await assertSucceeds(setDoc(doc(legacyDb, 'users', 'legacy-user', 'tripMemberships', 'trip-legacy'), {
      tripId: 'trip-legacy',
      userId: 'legacy-user',
      role: 'member',
      memberId: 'legacy-member'
    }));
    await assertSucceeds(getDoc(doc(legacyDb, 'trips', 'trip-legacy')));

    const outsiderDb = testEnv.authenticatedContext('outsider').firestore();
    await assertFails(getDocs(query(
      collectionGroup(outsiderDb, 'members'),
      where('authUid', '==', 'legacy-user')
    )));
  });

  it('allows a valid bearer invite to create only the caller membership', async () => {
    const outsiderDb = testEnv.authenticatedContext('outsider').firestore();
    await assertSucceeds(setDoc(doc(outsiderDb, 'users', 'outsider', 'tripMemberships', 'trip-b'), {
      tripId: 'trip-b',
      userId: 'outsider',
      role: 'member',
      inviteToken: 'invite-b'
    }));
    await assertSucceeds(getDoc(doc(outsiderDb, 'trips', 'trip-b', 'expenses', 'expense-b')));
  });

  it('rejects invalid invites and membership creation for another UID', async () => {
    const outsiderDb = testEnv.authenticatedContext('outsider').firestore();
    await assertFails(setDoc(doc(outsiderDb, 'users', 'outsider', 'tripMemberships', 'trip-b'), {
      tripId: 'trip-b', userId: 'outsider', role: 'member', inviteToken: 'wrong-token'
    }));
    await assertFails(setDoc(doc(outsiderDb, 'users', 'victim', 'tripMemberships', 'trip-b'), {
      tripId: 'trip-b', userId: 'victim', role: 'member', inviteToken: 'invite-b'
    }));
  });

  it('rejects invite-based role escalation and unexpected membership fields', async () => {
    const outsiderDb = testEnv.authenticatedContext('outsider').firestore();
    await assertFails(setDoc(doc(outsiderDb, 'users', 'outsider', 'tripMemberships', 'trip-b'), {
      tripId: 'trip-b', userId: 'outsider', role: 'owner', inviteToken: 'invite-b'
    }));
    await assertFails(setDoc(doc(outsiderDb, 'users', 'outsider', 'tripMemberships', 'trip-b'), {
      tripId: 'trip-b', userId: 'outsider', role: 'member', inviteToken: 'invite-b', admin: true
    }));
  });

  it('does not let a member promote their existing membership role', async () => {
    const memberDb = testEnv.authenticatedContext('member').firestore();
    await assertFails(updateDoc(doc(memberDb, 'users', 'member', 'tripMemberships', 'trip-a'), {
      role: 'owner'
    }));
  });

  it('does not let an owner repoint an invite to somebody else\'s trip', async () => {
    const ownerDb = testEnv.authenticatedContext('other-owner').firestore();
    await assertFails(updateDoc(doc(ownerDb, 'tripInvites', 'invite-b'), {
      tripId: 'trip-a'
    }));
  });

  it('allows members to edit expenses but only owners to delete trips', async () => {
    const memberDb = testEnv.authenticatedContext('member').firestore();
    await assertSucceeds(updateDoc(doc(memberDb, 'trips', 'trip-a', 'expenses', 'expense-a'), {
      description: 'Updated dinner'
    }));
    await assertFails(updateDoc(doc(memberDb, 'trips', 'trip-a'), { name: 'Unauthorized rename' }));
  });
});

describe('Storage authorization', () => {
  it('allows members to upload and read trip receipts', async () => {
    const memberStorage = testEnv.authenticatedContext('member').storage();
    const receiptRef = ref(memberStorage, 'trips/trip-a/receipts/receipt.webp');
    await assertSucceeds(uploadString(receiptRef, 'receipt', 'raw', { contentType: 'image/webp' }));
    await assertSucceeds(getDownloadURL(receiptRef));
  });

  it('blocks non-members and rejects non-image uploads', async () => {
    const outsiderStorage = testEnv.authenticatedContext('outsider').storage();
    await assertFails(uploadString(
      ref(outsiderStorage, 'trips/trip-a/receipts/receipt.webp'),
      'receipt',
      'raw',
      { contentType: 'image/webp' }
    ));

    const memberStorage = testEnv.authenticatedContext('member').storage();
    await assertFails(uploadString(
      ref(memberStorage, 'trips/trip-a/receipts/not-an-image.txt'),
      'not an image',
      'raw',
      { contentType: 'text/plain' }
    ));
  });
});
