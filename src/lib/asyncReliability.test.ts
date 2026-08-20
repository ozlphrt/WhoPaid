import { describe, expect, it, vi } from 'vitest';
import { acquireSingleFlight, releaseSingleFlight, retryOperation } from './asyncReliability';

describe('async reliability helpers', () => {
  it('permits only one submission until the lock is released', () => {
    const lock = { current: false };

    expect(acquireSingleFlight(lock)).toBe(true);
    expect(acquireSingleFlight(lock)).toBe(false);

    releaseSingleFlight(lock);
    expect(acquireSingleFlight(lock)).toBe(true);
  });

  it('retries transient failures and returns the successful result', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValueOnce('synced');

    await expect(retryOperation(operation, 3, 0)).resolves.toBe('synced');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('preserves the final error after all attempts fail', async () => {
    const failure = new Error('permission denied');
    const operation = vi.fn().mockRejectedValue(failure);

    await expect(retryOperation(operation, 2, 0)).rejects.toBe(failure);
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
