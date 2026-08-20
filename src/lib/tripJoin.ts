import type { Trip } from '../types';

interface AcceptTripInviteOptions {
  projectId: string;
  inviteToken: string;
  userId: string;
  idToken: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

interface FirestoreRestResult {
  response: Response;
  body: any;
}

function decodeFirestoreValue(value: any): any {
  if (!value || typeof value !== 'object') return undefined;
  if ('nullValue' in value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeFirestoreValue);
  if ('mapValue' in value) {
    return Object.fromEntries(
      Object.entries(value.mapValue.fields || {}).map(([key, nested]) => [key, decodeFirestoreValue(nested)])
    );
  }
  return undefined;
}

function decodeFirestoreFields(fields: Record<string, any> = {}): Record<string, any> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, decodeFirestoreValue(value)])
  );
}

function errorMessage(result: FirestoreRestResult, fallback: string): string {
  if (result.response.status === 401) return 'Your sign-in session expired. Please sign in again.';
  return result.body?.error?.message || fallback;
}

/**
 * Accepts a trip invitation using Firebase Auth plus Firestore security rules.
 *
 * This is intentionally the only client boundary that knows the multi-step
 * free-plan protocol. It is idempotent for existing members and applies one
 * deadline to the complete handshake so the UI cannot wait forever.
 */
export async function acceptTripInvite(options: AcceptTripInviteOptions): Promise<Trip> {
  const {
    projectId,
    inviteToken,
    userId,
    idToken,
    timeoutMs = 8_000,
    fetchImpl = fetch,
    now = () => new Date()
  } = options;

  if (!projectId || !userId || !idToken) throw new Error('Cloud authentication is unavailable.');
  if (!inviteToken || inviteToken.length > 256) throw new Error('This invitation is invalid or has expired.');

  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents`;
  const headers = { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' };
  let membershipCreated = false;
  let membershipUrl = '';

  const readJson = async (url: string, init?: RequestInit): Promise<FirestoreRestResult> => {
    const response = await fetchImpl(url, {
      ...init,
      headers: { ...headers, ...(init?.headers || {}) },
      signal: controller.signal
    });
    const body = await response.json().catch(() => ({}));
    return { response, body };
  };

  try {
    const inviteResult = await readJson(`${baseUrl}/tripInvites/${encodeURIComponent(inviteToken)}`);
    if (inviteResult.response.status === 404) throw new Error('This invitation is invalid or has expired.');
    if (!inviteResult.response.ok) throw new Error(errorMessage(inviteResult, 'The invitation could not be checked.'));
    const invite = decodeFirestoreFields(inviteResult.body.fields) as { tripId?: string; revoked?: boolean };
    if (!invite.tripId || invite.revoked) throw new Error('This invitation is no longer active.');

    const tripUrl = `${baseUrl}/trips/${encodeURIComponent(invite.tripId)}`;
    let tripResult = await readJson(tripUrl);

    // Existing members already have trip read access. Skipping the write keeps
    // repeat scans safe and preserves owner membership roles.
    if (tripResult.response.status === 403) {
      membershipUrl = `${baseUrl}/users/${encodeURIComponent(userId)}/tripMemberships/${encodeURIComponent(invite.tripId)}`;
      const membershipResult = await readJson(membershipUrl, {
        method: 'PATCH',
        body: JSON.stringify({
          fields: {
            tripId: { stringValue: invite.tripId },
            userId: { stringValue: userId },
            role: { stringValue: 'member' },
            inviteToken: { stringValue: inviteToken },
            joinedAt: { stringValue: now().toISOString() }
          }
        })
      });
      if (!membershipResult.response.ok) {
        throw new Error(errorMessage(membershipResult, 'The trip membership could not be created.'));
      }
      membershipCreated = true;
      tripResult = await readJson(tripUrl);
    }

    if (tripResult.response.status === 404) throw new Error('The trip is no longer available.');
    if (!tripResult.response.ok) throw new Error(errorMessage(tripResult, 'The trip could not be opened.'));
    const trip = { id: invite.tripId, ...decodeFirestoreFields(tripResult.body.fields) } as Trip;

    if (trip.isClosed || trip.isDeleted) {
      if (membershipCreated) {
        await readJson(membershipUrl, { method: 'DELETE' }).catch(() => undefined);
      }
      throw new Error('This trip is no longer accepting members.');
    }
    return trip;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Joining timed out. Please check your connection and try once more.');
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}
