import { roundMoney, div, mul } from './decimal';

// In-memory & localStorage cached rates key
const FX_CACHE_KEY = 'whopaid_fx_cache_v1';

interface CachedRates {
  [dateAndCurrencies: string]: number; // key: 'YYYY-MM-DD:FROM:TO', val: rate
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
  } catch (e) {
    console.warn('Failed to save FX cache to localStorage', e);
  }
}

// Fallback baseline rates relative to EUR in case device is completely offline and not in cache
const BASE_FALLBACK_RATES_EUR: Record<string, number> = {
  EUR: 1.0,
  USD: 1.08,
  GBP: 0.85,
  TRY: 37.5,
  JPY: 165.0,
  CHF: 0.94,
  CAD: 1.48,
  AUD: 1.66,
  SEK: 11.35,
  NOK: 11.7,
  DKK: 7.46,
  PLN: 4.28,
  SGD: 1.45,
  THB: 37.2,
  BRL: 5.95,
  MXN: 21.5
};

export async function fetchHistoricalExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  dateStr: string // YYYY-MM-DD
): Promise<{ rate: number; source: string }> {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();

  if (from === to) {
    return { rate: 1, source: 'Direct (1:1)' };
  }

  const cacheKey = `${dateStr}:${from}:${to}`;
  const cache = getLocalFxCache();
  if (cache[cacheKey]) {
    return { rate: cache[cacheKey], source: 'Frankfurter (Cached)' };
  }

  // Attempt API call to Frankfurter
  try {
    const url = `https://api.frankfurter.app/${dateStr}?from=${from}&to=${to}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const fetchedRate = data.rates?.[to];
      if (typeof fetchedRate === 'number' && fetchedRate > 0) {
        cache[cacheKey] = fetchedRate;
        saveLocalFxCache(cache);
        return { rate: fetchedRate, source: `Frankfurter ECB (${dateStr})` };
      }
    }
  } catch (err) {
    console.info(`Offline or API unavailable for FX (${from}->${to} on ${dateStr}), using fallback calculation.`);
  }

  // Fallback calculation via baseline rates
  const fromEur = BASE_FALLBACK_RATES_EUR[from] || 1;
  const toEur = BASE_FALLBACK_RATES_EUR[to] || 1;
  const estimatedRate = roundMoney(mul(div(1, fromEur), toEur), 6);

  cache[cacheKey] = estimatedRate;
  saveLocalFxCache(cache);
  return { rate: estimatedRate, source: 'Offline FX Fallback Table' };
}

export function convertAmount(
  amount: number,
  exchangeRate: number
): number {
  return roundMoney(mul(amount, exchangeRate), 2);
}

/**
 * Formats exchange rate so that the more valuable currency is always displayed as 1.
 * e.g. If 1 TRY = 0.0208 EUR, displays "1 EUR = 48.08 TRY".
 * If 1 GBP = 1.18 EUR, displays "1 GBP = 1.18 EUR".
 */
export function formatHumanExchangeRate(
  originalCurrency: string,
  mainCurrency: string,
  rate: number
): string {
  if (originalCurrency === mainCurrency || rate === 1) {
    return `1 ${originalCurrency} = 1 ${mainCurrency}`;
  }

  // If 1 originalCurrency = rate mainCurrency
  // If rate < 1 (e.g. TRY to EUR: rate is 0.0208), EUR is more valuable
  if (rate < 1 && rate > 0) {
    const inverseRate = 1 / rate;
    const formatted = inverseRate >= 100 
      ? inverseRate.toFixed(2)
      : inverseRate >= 10 
        ? inverseRate.toFixed(2) 
        : inverseRate.toFixed(4);
    return `1 ${mainCurrency} = ${formatted} ${originalCurrency}`;
  }

  // If rate >= 1 (e.g. GBP to EUR: rate is 1.18), originalCurrency is more valuable
  const formatted = rate >= 100 
    ? rate.toFixed(2) 
    : rate >= 10 
      ? rate.toFixed(2) 
      : rate.toFixed(4);
  return `1 ${originalCurrency} = ${formatted} ${mainCurrency}`;
}
