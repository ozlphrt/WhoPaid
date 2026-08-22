import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchHistoricalExchangeRate } from './fx';

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

describe('verified FX rates', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('localStorage', memoryStorage());
  });

  it('uses the ECB rate date returned for a weekend expense', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ date: '2026-08-21', rate: 0.01778 })
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchHistoricalExchangeRate('TRY', 'EUR', '2026-08-22');

    expect(result).toEqual({
      rate: 0.01778,
      source: 'Frankfurter / ECB (2026-08-21)'
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.frankfurter.dev/v2/rate/TRY/EUR?date=2026-08-22&providers=ECB',
      expect.any(Object)
    );
  });

  it('never substitutes an unverified hard-coded rate', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await expect(
      fetchHistoricalExchangeRate('TRY', 'EUR', '2026-08-22')
    ).rejects.toThrow('could not be verified');
  });

  it('reuses a previously verified exact-date rate when offline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ date: '2026-08-21', rate: 0.01778 })
    }));
    await fetchHistoricalExchangeRate('TRY', 'EUR', '2026-08-22');

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const cached = await fetchHistoricalExchangeRate('TRY', 'EUR', '2026-08-22');

    expect(cached.rate).toBe(0.01778);
    expect(cached.source).toContain('cached rate (2026-08-21)');
  });
});
