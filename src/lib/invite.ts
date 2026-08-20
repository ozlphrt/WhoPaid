export const PENDING_INVITE_KEY = 'whopaid_pending_join';

export function readInviteToken(urlValue: string): string | null {
  try {
    const url = new URL(urlValue);
    const hashQuery = url.hash.includes('?') ? url.hash.split('?')[1] : '';
    const hashParams = new URLSearchParams(hashQuery);
    const token = url.searchParams.get('join') ||
      url.searchParams.get('tripId') ||
      hashParams.get('join') ||
      hashParams.get('tripId');
    return token?.trim() || null;
  } catch {
    return null;
  }
}

export function buildInviteUrl(origin: string, basePath: string, inviteToken: string): string {
  const url = new URL(basePath, origin);
  url.searchParams.set('join', inviteToken);
  return url.toString();
}

export function capturePendingInviteFromBrowser(): string | null {
  const token = readInviteToken(window.location.href);
  if (!token) return null;

  localStorage.setItem(PENDING_INVITE_KEY, token);
  sessionStorage.setItem(PENDING_INVITE_KEY, token);

  const cleanUrl = new URL(window.location.href);
  cleanUrl.searchParams.delete('join');
  cleanUrl.searchParams.delete('tripId');

  if (cleanUrl.hash.includes('?')) {
    const [hashPath, hashQuery = ''] = cleanUrl.hash.split('?');
    const hashParams = new URLSearchParams(hashQuery);
    hashParams.delete('join');
    hashParams.delete('tripId');
    const remainingHashQuery = hashParams.toString();
    cleanUrl.hash = remainingHashQuery ? `${hashPath}?${remainingHashQuery}` : hashPath;
  }

  window.history.replaceState({}, '', `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
  return token;
}
