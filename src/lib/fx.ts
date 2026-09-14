import { roundMoney, mul } from './decimal';

// v3 invalidates legacy fallback values that could have been labelled as
// Frankfurter rates before provider responses were strictly verified.
const FX_CACHE_KEY = 'whopaid_fx_cache_v3';

interface CachedRate {
  rate: number;
  rateDate: string;
  cachedAt: string;
}

interface CachedRates {
  [dateAndCurrencies: string]: CachedRate;
}

/** Rates saved by the pre-ECB-verification implementation must be refreshed. */
export function isLegacyUnverifiedFxSource(source?: string): boolean {
  if (!source) return false;
  return /^Frankfurter(?: \(Cached\))?$/.test(source.trim());
}

function getLocalFxCache(): CachedRates {
  try {
    const raw = localStorage.getItem(FX_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalFxCache(cache: CachedRates) {
  try {
    localStorage.setItem(FX_CACHE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn('Failed to save FX cache to localStorage', error);
  }
}

function cacheKey(date: string, from: string, to: string): string {
  return `${date}:${from}:${to}`;
}

function findMostRecentVerifiedRate(
  cache: CachedRates,
  requestedDate: string,
  from: string,
  to: string
): CachedRate | undefined {
  return Object.entries(cache)
    .filter(([key, entry]) =>
      key.endsWith(`:${from}:${to}`) &&
      entry.rateDate <= requestedDate &&
      Number.isFinite(entry.rate) &&
      entry.rate > 0
    )
    .map(([, entry]) => entry)
    .sort((a, b) => b.rateDate.localeCompare(a.rateDate))[0];
}

export async function fetchHistoricalExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  dateStr: string,
  options: { forceRefresh?: boolean } = {}
): Promise<{ rate: number; source: string }> {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();

  if (from === to) {
    return { rate: 1, source: 'Direct (1:1)' };
  }

  const cache = getLocalFxCache();
  const exactCached = cache[cacheKey(dateStr, from, to)];
  if (!options.forceRefresh && exactCached?.rate > 0) {
    return {
      rate: exactCached.rate,
      source: `Frankfurter / ECB cached rate (${exactCached.rateDate})`
    };
  }

  try {
    const url = `https://api.frankfurter.dev/v2/rate/${encodeURIComponent(from)}/${encodeURIComponent(to)}?date=${encodeURIComponent(dateStr)}&providers=ECB`;
    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) throw new Error(`FX provider returned ${response.status}`);

      const data = await response.json() as { date?: string; rate?: number };
      if (!Number.isFinite(data.rate) || !data.rate || data.rate <= 0) {
        throw new Error('FX provider returned an invalid rate');
      }

      const rateDate = data.date || dateStr;
      const entry: CachedRate = {
        rate: data.rate,
        rateDate,
        cachedAt: new Date().toISOString()
      };
      cache[cacheKey(dateStr, from, to)] = entry;
      cache[cacheKey(rateDate, from, to)] = entry;

      const inverseEntry: CachedRate = {
        rate: roundMoney(1 / data.rate, 8),
        rateDate,
        cachedAt: entry.cachedAt
      };
      cache[cacheKey(dateStr, to, from)] = inverseEntry;
      cache[cacheKey(rateDate, to, from)] = inverseEntry;
      saveLocalFxCache(cache);

      return {
        rate: data.rate,
        source: `Frankfurter / ECB (${rateDate})`
      };
    } finally {
      globalThis.clearTimeout(timeoutId);
    }
  } catch (error) {
    if (options.forceRefresh) {
      console.warn(`Fresh FX rate unavailable for ${from}->${to} on ${dateStr}.`, error);
      throw new Error(
        `A fresh ${from} to ${to} exchange rate could not be verified. Check your connection or enter it manually.`
      );
    }

    const verifiedCached = findMostRecentVerifiedRate(cache, dateStr, from, to);
    if (verifiedCached) {
      return {
        rate: verifiedCached.rate,
        source: `Last verified Frankfurter / ECB rate (${verifiedCached.rateDate})`
      };
    }

    console.warn(`Verified FX rate unavailable for ${from}->${to} on ${dateStr}.`, error);
    throw new Error(
      `The ${from} to ${to} exchange rate could not be verified. Check your connection and try again.`
    );
  }
}

export function convertAmount(amount: number, exchangeRate: number): number {
  return roundMoney(mul(amount, exchangeRate), 2);
}

export interface ExchangeRateDisplayParts {
  baseCurrency: string;
  quoteCurrency: string;
  displayedRate: number;
  formattedRate: string;
  isOriginalBase: boolean;
}

export function formatDisplayedRate(rate: number): string {
  if (rate >= 10) return rate.toFixed(2);
  if (rate >= 0.1) return rate.toFixed(4);
  return rate.toFixed(5);
}

/**
 * Breaks down the exchange rate between originalCurrency and mainCurrency such that
 * whichever currency has the bigger unit value is placed first (as the base unit "1"),
 * avoiding 0.00xxx conversions.
 *
 * `rate` represents: 1 originalCurrency = `rate` mainCurrency.
 */
export function getExchangeRateDisplayParts(
  originalCurrency: string,
  mainCurrency: string,
  rate: number
): ExchangeRateDisplayParts {
  const orig = originalCurrency.toUpperCase();
  const main = mainCurrency.toUpperCase();

  if (!Number.isFinite(rate) || rate <= 0 || rate === 1 || orig === main) {
    return {
      baseCurrency: orig,
      quoteCurrency: main,
      displayedRate: 1,
      formattedRate: '1',
      isOriginalBase: true
    };
  }

  // If rate >= 1: 1 originalCurrency = `rate` mainCurrency.
  // Original currency is the stronger unit (e.g. 1 USD = 48.61 TRY).
  if (rate >= 1) {
    return {
      baseCurrency: orig,
      quoteCurrency: main,
      displayedRate: rate,
      formattedRate: formatDisplayedRate(rate),
      isOriginalBase: true
    };
  }

  // If rate < 1: 1 mainCurrency = `1 / rate` originalCurrency.
  // Main currency is the stronger unit (e.g. 1 EUR = 56.23 TRY).
  const inverted = 1 / rate;
  return {
    baseCurrency: main,
    quoteCurrency: orig,
    displayedRate: inverted,
    formattedRate: formatDisplayedRate(inverted),
    isOriginalBase: false
  };
}

/**
 * Formats the stored original-to-main rate showing whichever currency has the
 * bigger unit value first (1 [Bigger] = X [Smaller]) to avoid confusing
 * 0.00xxx conversions.
 */
export function formatHumanExchangeRate(
  originalCurrency: string,
  mainCurrency: string,
  rate: number
): string {
  if (originalCurrency.toUpperCase() === mainCurrency.toUpperCase() || rate === 1) {
    return `1 ${originalCurrency.toUpperCase()} = 1 ${mainCurrency.toUpperCase()}`;
  }

  if (!Number.isFinite(rate) || rate <= 0) return 'Exchange rate unavailable';

  const parts = getExchangeRateDisplayParts(originalCurrency, mainCurrency, rate);
  return `1 ${parts.baseCurrency} = ${parts.formattedRate} ${parts.quoteCurrency}`;
}

