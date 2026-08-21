export interface SingleFlightLock {
  current: boolean;
}

function normalizeOperationError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (error && typeof error === 'object') {
    const value = error as Record<string, unknown>;
    const message = [value.message, value.details, value.hint]
      .filter((part): part is string => typeof part === 'string' && part.length > 0)
      .join(' ');
    const code = typeof value.code === 'string' ? ` [${value.code}]` : '';
    if (message) return new Error(`${message}${code}`);
  }
  return new Error('Operation failed.');
}

export function acquireSingleFlight(lock: SingleFlightLock): boolean {
  if (lock.current) return false;
  lock.current = true;
  return true;
}

export function releaseSingleFlight(lock: SingleFlightLock): void {
  lock.current = false;
}

export async function retryOperation<T>(
  operation: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 300
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts && baseDelayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, attempt * baseDelayMs));
      }
    }
  }
  throw normalizeOperationError(lastError);
}
