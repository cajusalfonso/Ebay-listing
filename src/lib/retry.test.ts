import { describe, expect, it, vi } from 'vitest';
import { withRetry } from './retry';

const noopSleep = (): Promise<void> => Promise.resolve();

describe('withRetry', () => {
  it('returns the value on first success without invoking sleep', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const sleep = vi.fn(noopSleep);
    const result = await withRetry(fn, { sleep });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries until success', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail1'))
      .mockRejectedValueOnce(new Error('fail2'))
      .mockResolvedValue('ok');
    const result = await withRetry(fn, { sleep: noopSleep });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('gives up after maxAttempts and rethrows the last error', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('try1'))
      .mockRejectedValueOnce(new Error('try2'))
      .mockRejectedValueOnce(new Error('try3 (final)'));
    await expect(withRetry(fn, { maxAttempts: 3, sleep: noopSleep })).rejects.toThrow(
      'try3 (final)'
    );
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('stops immediately when shouldRetry returns false', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('not retryable'));
    const shouldRetry = vi.fn().mockReturnValue(false);
    await expect(withRetry(fn, { maxAttempts: 5, sleep: noopSleep, shouldRetry })).rejects.toThrow(
      'not retryable'
    );
    expect(fn).toHaveBeenCalledTimes(1);
    expect(shouldRetry).toHaveBeenCalledOnce();
  });

  it('follows exponential backoff schedule by default', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('x'))
      .mockRejectedValueOnce(new Error('y'))
      .mockResolvedValue('ok');
    const delays: number[] = [];
    const sleep = (ms: number): Promise<void> => {
      delays.push(ms);
      return Promise.resolve();
    };
    await withRetry(fn, { sleep, initialDelayMs: 1000, backoffMultiplier: 2 });
    expect(delays).toEqual([1000, 2000]);
  });

  it('onRetry is called with error, attempt number, and delay', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue('ok');
    const onRetry = vi.fn();
    await withRetry(fn, { sleep: noopSleep, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    expect(onRetry.mock.calls[0]?.[1]).toBe(1);
    expect(onRetry.mock.calls[0]?.[2]).toBe(1000);
  });

  it('attempt counter passed to shouldRetry starts at 1', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('e'));
    const shouldRetry = vi.fn().mockReturnValue(true);
    await expect(
      withRetry(fn, { maxAttempts: 3, sleep: noopSleep, shouldRetry })
    ).rejects.toThrow();
    // shouldRetry called after attempts 1, 2 (not called after final attempt 3 since maxAttempts reached)
    const attemptNumbers = shouldRetry.mock.calls.map((c: unknown[]) => c[1]);
    expect(attemptNumbers).toEqual([1, 2]);
  });
});
