import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

interface CorrelationContext {
  readonly correlationId: string;
}

const storage = new AsyncLocalStorage<CorrelationContext>();

/** Generate a fresh correlation ID (UUID v4). */
export function newCorrelationId(): string {
  return randomUUID();
}

/**
 * Run `fn` inside a correlation-id context. All logger calls made from within
 * (including in awaited async callees) will see this id via `getCorrelationId`.
 */
export function withCorrelation<T>(correlationId: string, fn: () => T): T {
  return storage.run({ correlationId }, fn);
}

/** Return the current correlation id, or undefined if not inside a context. */
export function getCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}
