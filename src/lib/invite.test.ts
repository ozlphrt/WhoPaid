import { describe, expect, it } from 'vitest';
import { buildInviteUrl, readInviteToken } from './invite';

describe('trip invitation URLs', () => {
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
});
