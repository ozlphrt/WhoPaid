import { roundMoney, mul } from './decimal';

const FX_CACHE_KEY = 'whopaid_fx_cache_v2';

interface CachedRate {
  rate: number;
  rateDate: string;
  cachedAt: string;
}

interface CachedRates {
  [dateAndCurrencies: string]: CachedRate;
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
  dateStr: string
): Promise<{ rate: number; source: string }> {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();

  if (from === to) {
    return { rate: 1, source: 'Direct (1:1)' };
  }

  const cache = getLocalFxCache();
  const exactCached = cache[cacheKey(dateStr, from, to)];
  if (exactCached?.rate > 0) {
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

function formatDisplayedRate(rate: number): string {
  if (rate >= 10) return rate.toFixed(2);
  if (rate >= 0.1) return rate.toFixed(4);
  return rate.toFixed(5);
}

/**
 * Formats the stored original-to-main rate in the same direction used by the
 * expense form: one unit of the trip's main currency in the expense currency.
 */
export function formatHumanExchangeRate(
  originalCurrency: string,
  mainCurrency: string,
  rate: number
): string {
  if (originalCurrency === mainCurrency || rate === 1) {
    return `1 ${originalCurrency} = 1 ${mainCurrency}`;
  }

  if (!Number.isFinite(rate) || rate <= 0) return 'Exchange rate unavailable';
  return `1 ${mainCurrency} = ${formatDisplayedRate(1 / rate)} ${originalCurrency}`;
}
