/**
 * Helper to run a page loader step and capture the exception as a
 * structured object rather than letting it bubble to Next.js's production
 * error boundary (which strips the message). Pages wrap their async loads
 * with this and render the returned error inline — props don't get stripped.
 */
export type LoadStep<T> =
  | { ok: true; value: T }
  | { ok: false; where: string; message: string; stack?: string | undefined };

export async function safeLoad<T>(where: string, fn: () => Promise<T>): Promise<LoadStep<T>> {
  try {
    const value = await fn();
    return { ok: true, value };
  } catch (error) {
    const e = error as Error;
    return {
      ok: false,
      where,
      message: e.message || String(e),
      stack: e.stack,
    };
  }
}

export function firstError<T extends readonly LoadStep<unknown>[]>(
  steps: T
): Extract<T[number], { ok: false }> | null {
  for (const s of steps) {
    if (!s.ok) return s as Extract<T[number], { ok: false }>;
  }
  return null;
}
