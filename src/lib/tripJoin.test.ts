import { describe, expect, it, vi } from 'vitest';
import { acceptTripInvite } from './tripJoin';

const jsonResponse = (status: number, body: any) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' }
});

const inviteDocument = (overrides: Record<string, any> = {}) => ({
  fields: {
    tripId: { stringValue: 'trip-izmir' },
    revoked: { booleanValue: false },
    ...overrides
  }
});

const tripDocument = (overrides: Record<string, any> = {}) => ({
  fields: {
    name: { stringValue: 'Izmir trip' },
    emoji: { stringValue: '🌊' },
    startDate: { stringValue: '2026-08-20' },
    endDate: { stringValue: '2026-08-22' },
    mainCurrency: { stringValue: 'TRY' },
    ownerId: { stringValue: 'owner' },
    inviteToken: { stringValue: 'invite-izmir' },
    isClosed: { booleanValue: false },
    isDeleted: { booleanValue: false },
    createdAt: { stringValue: '2026-08-20T00:00:00.000Z' },
    updatedAt: { stringValue: '2026-08-20T00:00:00.000Z' },
    ...overrides
  }
});

const baseOptions = {
  projectId: 'test-project',
  inviteToken: 'invite-izmir',
  userId: 'recipient',
  idToken: 'firebase-id-token',
  now: () => new Date('2026-08-20T12:00:00.000Z')
};

describe('acceptTripInvite', () => {
  it('creates membership and returns the protected trip for a new member', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, inviteDocument()))
      .mockResolvedValueOnce(jsonResponse(403, { error: { message: 'denied' } }))
      .mockResolvedValueOnce(jsonResponse(200, {}))
      .mockResolvedValueOnce(jsonResponse(200, tripDocument()));

    const trip = await acceptTripInvite({ ...baseOptions, fetchImpl });

    expect(trip.id).toBe('trip-izmir');
    expect(trip.name).toBe('Izmir trip');
    expect(fetchImpl).toHaveBeenCalledTimes(4);
    expect(fetchImpl.mock.calls[2][1]).toMatchObject({ method: 'PATCH' });
    expect(fetchImpl.mock.calls[2][1]?.body).toContain('invite-izmir');
  });

  it('does not rewrite membership for an existing member or owner', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, inviteDocument()))
      .mockResolvedValueOnce(jsonResponse(200, tripDocument()));

    await expect(acceptTripInvite({ ...baseOptions, fetchImpl })).resolves.toMatchObject({ id: 'trip-izmir' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false);
  });

  it('rejects revoked invitations without creating membership', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, inviteDocument({
      revoked: { booleanValue: true }
    })));

    await expect(acceptTripInvite({ ...baseOptions, fetchImpl })).rejects.toThrow('no longer active');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('removes a newly created membership when the trip is closed', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, inviteDocument()))
      .mockResolvedValueOnce(jsonResponse(403, {}))
      .mockResolvedValueOnce(jsonResponse(200, {}))
      .mockResolvedValueOnce(jsonResponse(200, tripDocument({ isClosed: { booleanValue: true } })))
      .mockResolvedValueOnce(jsonResponse(200, {}));

    await expect(acceptTripInvite({ ...baseOptions, fetchImpl })).rejects.toThrow('no longer accepting');
    expect(fetchImpl.mock.calls[4][1]).toMatchObject({ method: 'DELETE' });
  });

  it('terminates a stalled handshake with a clear timeout', async () => {
    const fetchImpl = vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }));

    await expect(acceptTripInvite({ ...baseOptions, fetchImpl, timeoutMs: 5 })).rejects.toThrow('Joining timed out');
  });
});
