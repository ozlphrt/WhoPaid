import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchHistoricalExchangeRate,
  formatHumanExchangeRate,
  getExchangeRateDisplayParts,
  isLegacyUnverifiedFxSource
} from './fx';

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

  it('bypasses an exact-date cache when a fresh rate is requested', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ date: '2026-08-21', rate: 37.5 })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ date: '2026-08-21', rate: 56.2318 })
      });
    vi.stubGlobal('fetch', fetchMock);

    await fetchHistoricalExchangeRate('EUR', 'TRY', '2026-08-22');
    const refreshed = await fetchHistoricalExchangeRate(
      'EUR',
      'TRY',
      '2026-08-22',
      { forceRefresh: true }
    );

    expect(refreshed.rate).toBe(56.2318);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('exchange-rate presentation', () => {
  it('displays the bigger value currency first to avoid 0.00xxx conversions', () => {
    // When TRY is original and EUR is main (rate ~ 0.01778)
    expect(formatHumanExchangeRate('TRY', 'EUR', 1 / 56.2318))
      .toBe('1 EUR = 56.23 TRY');

    // When EUR is original and TRY is main (rate = 56.2318)
    expect(formatHumanExchangeRate('EUR', 'TRY', 56.2318))
      .toBe('1 EUR = 56.23 TRY');

    // When USD is original and TRY is main (as in user screenshot: 1 USD = 48.61 TRY)
    expect(formatHumanExchangeRate('USD', 'TRY', 48.6145))
      .toBe('1 USD = 48.61 TRY');

    // When TRY is original and USD is main (rate = 0.02057)
    expect(formatHumanExchangeRate('TRY', 'USD', 0.02057))
      .toBe('1 USD = 48.61 TRY');

    // Close currencies (EUR vs USD)
    expect(formatHumanExchangeRate('EUR', 'USD', 1.0825))
      .toBe('1 EUR = 1.0825 USD');
    expect(formatHumanExchangeRate('USD', 'EUR', 1 / 1.0825))
      .toBe('1 EUR = 1.0825 USD');

    // Same currency
    expect(formatHumanExchangeRate('USD', 'USD', 1))
      .toBe('1 USD = 1 USD');
  });

  it('breaks down exchange rates into structured parts with base currency first', () => {
    const parts = getExchangeRateDisplayParts('USD', 'TRY', 48.6145);
    expect(parts).toEqual({
      baseCurrency: 'USD',
      quoteCurrency: 'TRY',
      displayedRate: 48.6145,
      formattedRate: '48.61',
      isOriginalBase: true
    });

    const invertedParts = getExchangeRateDisplayParts('TRY', 'USD', 1 / 48.6145);
    expect(invertedParts.baseCurrency).toBe('USD');
    expect(invertedParts.quoteCurrency).toBe('TRY');
    expect(invertedParts.formattedRate).toBe('48.61');
    expect(invertedParts.isOriginalBase).toBe(false);
  });

  it('identifies only pre-verification Frankfurter sources as legacy', () => {
    expect(isLegacyUnverifiedFxSource('Frankfurter (Cached)')).toBe(true);
    expect(isLegacyUnverifiedFxSource('Frankfurter')).toBe(true);
    expect(isLegacyUnverifiedFxSource('Frankfurter / ECB (2026-08-21)')).toBe(false);
    expect(isLegacyUnverifiedFxSource('Manual rate entered by user')).toBe(false);
  });
});
