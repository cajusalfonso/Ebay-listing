export interface RetryOptions {
  /** Max total attempts including the first. Default 3. */
  readonly maxAttempts?: number;
  /** Delay before the second attempt, in ms. Default 1000. */
  readonly initialDelayMs?: number;
  /** Multiplier applied to the delay before each subsequent attempt. Default 2. */
  readonly backoffMultiplier?: number;
  /** Decide whether an error should trigger a retry. Default: retry all errors. */
  readonly shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Observer hook called right before sleeping — useful for logging. */
  readonly onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
  /** Injectable sleep — tests can pass a noop to skip real delays. */
  readonly sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run `fn`, retrying on failure with exponential backoff.
 *
 * Delay schedule (defaults): attempt 2 after 1000ms, attempt 3 after 2000ms,
 * attempt 4 after 4000ms, etc. Returns the first successful result, or
 * rethrows the last error once max attempts is reached or `shouldRetry` returns false.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 1_000;
  const backoffMultiplier = options.backoffMultiplier ?? 2;
  const shouldRetry = options.shouldRetry ?? (() => true);
  const sleep = options.sleep ?? defaultSleep;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;
      if (!shouldRetry(error, attempt)) break;
      const delayMs = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);
      options.onRetry?.(error, attempt, delayMs);
      await sleep(delayMs);
    }
  }
  throw lastError;
}
