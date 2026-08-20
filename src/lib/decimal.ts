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

export function formatMoney(amount: number, currency: string = 'EUR', showSign: boolean = false, includeDecimals: boolean = false): string {
  const rounded = includeDecimals ? roundMoney(amount, 2) : Math.round(amount);
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0,
  }).format(Math.abs(rounded));

  if (showSign) {
    if (rounded > 0.005) return `+${formatted}`;
    if (rounded < -0.005) return `-${formatted}`;
  }
  return rounded < -0.005 ? `-${formatted}` : formatted;
}

export function formatAmount(amount: number, currency?: string): string {
  const isWhole = Math.abs(amount % 1) < 0.005;
  const numStr = isWhole
    ? Math.round(amount).toLocaleString('en-US')
    : amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (currency) {
    return `${getCurrencySymbol(currency)}${numStr}`;
  }
  return numStr;
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

export function resolveMemberName(
  userId: string | undefined | null,
  members: Array<{ id?: string; userId?: string; name?: string; email?: string }>,
  currentUser?: { id?: string; name?: string; email?: string },
  allUsers: Array<{ id?: string; name?: string; email?: string }> = []
): string {
  if (!userId) return currentUser?.name || 'Member';

  // 1. Match current logged-in user
  if (currentUser) {
    const isSelf = 
      (currentUser.id && userId === currentUser.id) ||
      (currentUser.email && userId.toLowerCase() === currentUser.email.toLowerCase()) ||
      (currentUser.name && userId.toLowerCase() === currentUser.name.toLowerCase()) ||
      (currentUser.name && userId.toLowerCase().includes(currentUser.name.toLowerCase())) ||
      (currentUser.email && userId.toLowerCase().includes(currentUser.email.split('@')[0].toLowerCase()));
    if (isSelf) {
      return currentUser.name || 'You';
    }
  }

  // 2. Direct match by userId or member id
  const byId = members.find(m => 
    m.userId === userId || 
    m.id === userId || 
    (m.id && m.id.includes(userId)) || 
    (m.userId && m.userId.includes(userId))
  );
  if (byId?.name && byId.name !== 'User') return byId.name;

  // 3. Match by email
  const byEmail = members.find(m => m.email && m.email.toLowerCase() === userId.toLowerCase());
  if (byEmail?.name && byEmail.name !== 'User') return byEmail.name;

  // 4. Match by name
  const byName = members.find(m => m.name && m.name.toLowerCase() === userId.toLowerCase());
  if (byName?.name) return byName.name;

  // 5. Look up in allUsers
  if (allUsers && allUsers.length > 0) {
    const byUserList = allUsers.find(u => u.id === userId || (u.email && u.email.toLowerCase() === userId.toLowerCase()));
    if (byUserList?.name) return byUserList.name;
  }

  // 6. If it looks like an email (e.g. ozalph@gmail.com)
  if (userId.includes('@')) {
    const raw = userId.split('@')[0];
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  // 7. If it's a slug (e.g. user_ozalp or member_abc)
  if (userId.startsWith('user_') || userId.startsWith('member_')) {
    const raw = userId.replace(/^(user_|member_)/, '').split('_')[0];
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  }

  // 8. If it's a raw long alphanumeric hash / UID (length > 15 without spaces)
  if (userId.length > 15 && !userId.includes(' ')) {
    // Check if member has a matching UID or return Member
    return currentUser?.name || 'Member';
  }

  return userId.charAt(0).toUpperCase() + userId.slice(1);
}

