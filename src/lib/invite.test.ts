import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PENDING_INVITE_KEY,
  buildInviteUrl,
  capturePendingInviteFromBrowser,
  clearPendingInvite,
  hasFreshPendingInvite,
  markPendingInviteAttempt,
  readInviteToken,
  shouldResetInterruptedInvite,
  wasPendingInviteAttempted
} from './invite';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null,
    removeItem: key => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); }
  };
}

describe('trip invitation URLs', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
    vi.stubGlobal('sessionStorage', memoryStorage());
  });

  it('builds an invite at the application base path regardless of the current screen', () => {
    expect(buildInviteUrl('https://ozlphrt.github.io', '/WhoPaid/', 'invite/with spaces')).toBe(
      'https://ozlphrt.github.io/WhoPaid/?join=invite%2Fwith+spaces'
    );
  });

  it('reads current and legacy invitation parameters', () => {
    expect(readInviteToken('https://example.test/WhoPaid/?join=invite-123')).toBe('invite-123');
    expect(readInviteToken('https://example.test/WhoPaid/#/?tripId=legacy-456')).toBe('legacy-456');
  });

  it('ignores malformed or empty invitation URLs', () => {
    expect(readInviteToken('not a url')).toBeNull();
    expect(readInviteToken('https://example.test/WhoPaid/?join=')).toBeNull();
  });

  it('marks one join attempt and clears all persistent invite state', () => {
    localStorage.setItem(PENDING_INVITE_KEY, 'invite-123');
    sessionStorage.setItem(PENDING_INVITE_KEY, 'invite-123');

    expect(wasPendingInviteAttempted('invite-123')).toBe(false);
    markPendingInviteAttempt('invite-123');
    expect(wasPendingInviteAttempted('invite-123')).toBe(true);

    clearPendingInvite();
    expect(localStorage.getItem(PENDING_INVITE_KEY)).toBeNull();
    expect(sessionStorage.getItem(PENDING_INVITE_KEY)).toBeNull();
    expect(wasPendingInviteAttempted('invite-123')).toBe(false);
  });

  it('discards legacy stale tokens before app startup', () => {
    localStorage.setItem(PENDING_INVITE_KEY, 'old-invite');
    vi.stubGlobal('window', {
      location: { href: 'https://example.test/WhoPaid/' },
      history: { replaceState: vi.fn() }
    });

    expect(capturePendingInviteFromBrowser()).toBeNull();
    expect(localStorage.getItem(PENDING_INVITE_KEY)).toBeNull();
  });

  it('keeps a freshly captured token through an OAuth-style clean return URL', () => {
    const replaceState = vi.fn();
    vi.stubGlobal('window', {
      location: { href: 'https://example.test/WhoPaid/?join=fresh-invite' },
      history: { replaceState }
    });

    expect(capturePendingInviteFromBrowser()).toBe('fresh-invite');
    expect(hasFreshPendingInvite()).toBe(true);
    expect(replaceState).toHaveBeenCalledOnce();

    window.location.href = 'https://example.test/WhoPaid/';
    expect(capturePendingInviteFromBrowser()).toBeNull();
    expect(localStorage.getItem(PENDING_INVITE_KEY)).toBe('fresh-invite');
  });

  it('does not reset the invitation that is actively joining in this session', () => {
    expect(shouldResetInterruptedInvite('invite-123', 'invite-123', true)).toBe(false);
    expect(shouldResetInterruptedInvite('invite-123', null, true)).toBe(true);
    expect(shouldResetInterruptedInvite('invite-123', null, false)).toBe(false);
  });
});
