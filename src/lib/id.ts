/**
 * Creates an unguessable identifier suitable for share links and local records.
 * `crypto.randomUUID` is available in modern browsers; the fallback keeps older
 * installed PWAs working while retaining cryptographically secure randomness.
 */
export function createId(prefix: string): string {
  const uuid = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');

  return `${prefix}_${uuid}`;
}
