import Decimal from 'decimal.js';

// Configure Decimal.js for financial precision
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export function toDecimal(val: number | string | Decimal): Decimal {
  try {
    return new Decimal(val || 0);
  } catch {
    return new Decimal(0);
  }
}

export function add(a: number | string, b: number | string): number {
  return toDecimal(a).plus(toDecimal(b)).toNumber();
}

export function sub(a: number | string, b: number | string): number {
  return toDecimal(a).minus(toDecimal(b)).toNumber();
}

export function mul(a: number | string, b: number | string): number {
  return toDecimal(a).times(toDecimal(b)).toNumber();
}

export function div(a: number | string, b: number | string): number {
  const bDec = toDecimal(b);
  if (bDec.isZero()) return 0;
  return toDecimal(a).dividedBy(bDec).toNumber();
}

export function roundMoney(val: number | string, decimals = 2): number {
  return toDecimal(val).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toNumber();
}

export function formatMoney(amount: number, currency: string = 'EUR', showSign: boolean = false): string {
  const rounded = roundMoney(amount, 2);
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(rounded));

  if (showSign) {
    if (rounded > 0.005) return `+${formatted}`;
    if (rounded < -0.005) return `−${formatted}`;
  }
  return rounded < -0.005 ? `−${formatted}` : formatted;
}

export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    EUR: '€',
    USD: '$',
    GBP: '£',
    TRY: '₺',
    JPY: '¥',
    CHF: 'CHF',
    CAD: 'CA$',
    AUD: 'A$',
    SEK: 'kr',
    NOK: 'kr',
    DKK: 'kr',
    PLN: 'zł',
    CZK: 'Kč',
    HUF: 'Ft',
    RON: 'lei',
    BGN: 'лв',
    ILS: '₪',
    BRL: 'R$',
    MXN: 'Mex$',
    SGD: 'S$',
    HKD: 'HK$',
    NZD: 'NZ$',
    THB: '฿',
    IDR: 'Rp',
    MYR: 'RM',
    PHP: '₱',
    KRW: '₩',
    INR: '₹',
    ZAR: 'R'
  };
  return symbols[currency] || currency;
}
