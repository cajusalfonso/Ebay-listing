# lib

Shared-Utilities. Keine Business-Logik — nur Infrastruktur.

**Kommt schrittweise in Schritten 3.3+:**

- `logger.ts` — Pino-Factory mit Correlation-ID-Binding, pro-Modul-Child-Logger.
- `correlation.ts` — AsyncLocalStorage für Correlation-IDs durch den Request-Flow.
- `encryption.ts` — AES-256-GCM Wrapper für Token-Storage: `encrypt(plain, key): string`, `decrypt(enc, key): string`. Key aus env `TOKEN_ENCRYPTION_KEY` (32-byte hex).
- `retry.ts` — exponential-backoff Retry-Wrapper mit jitter, max 3× default, konfigurierbares Retry-on-Predicate (429/5xx/Netzwerk).
- `rate-limiter.ts` — pro-Provider Token-Bucket, hartes Limit-Enforcement.
- `zod-fetch.ts` — undici-Wrapper der Response-JSON via Zod-Schema validiert, wirft `SchemaValidationError` bei Mismatch.
- `errors.ts` — Basis-Error-Class mit `code`, `cause`, `context`-Fields für strukturiertes Logging.

**Konvention:** Kein silent fail. Jeder Error hat einen typed Subclass. Kein `catch (e) {}` erlaubt (ESLint-Rule).
