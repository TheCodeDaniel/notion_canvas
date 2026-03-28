// src/utils/retry.ts

/**
 * Retries an async function with exponential backoff.
 * @param fn - The function to retry
 * @param maxAttempts - Maximum number of attempts (default 3)
 * @param baseDelayMs - Initial delay in ms, doubles each attempt (default 500)
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 500,
): Promise<T> {
  let lastError: Error = new Error('Unknown error');

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === maxAttempts) break;
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.error(`[NotionCanvas] Attempt ${attempt} failed: ${lastError.message}. Retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }

  throw lastError;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
