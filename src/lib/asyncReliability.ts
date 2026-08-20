export interface SingleFlightLock {
  current: boolean;
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
  throw lastError instanceof Error ? lastError : new Error('Operation failed.');
}
