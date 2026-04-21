# api

Fastify-Stub für Phase 2. Im MVP nicht aktiv genutzt, nur Gerüst damit kein Refactoring nötig wird.

**Kommt dünn in Schritt 2 (Scaffold) — voll ausgebaut in Phase 2:**

- `index.ts` — Fastify-Instanz-Factory mit Pino-Logger-Integration + Correlation-ID-Middleware.
- `routes/health.ts` — `/health` und `/ready` Endpoints für K8s-Probes.
- `routes/README.md` — kommende Endpoints: Bulk-Upload (EAN+COGS CSV), Listing-Status-Query, Needs-Review-Queue.

**Phase-2-Design:** Endpoints queuen Jobs (BullMQ) statt synchron zu verarbeiten. Worker-Modul separat.
