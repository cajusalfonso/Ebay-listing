# db

Drizzle-ORM-Layer: Schema-Definitionen, Migrationen, Client-Factory.

**Kommt in Schritt 3.2:**

- `schema/index.ts` — Re-Export aller Tabellen.
- `schema/products.ts`, `listings.ts`, `ebay_tokens.ts`, `gpsr_manufacturer_overrides.ts`, `market_snapshots.ts`, `price_history.ts`, `needs_review.ts`, `product_images.ts` — pro Tabelle eine Datei.
- `migrations/` — auto-generiert via `pnpm db:generate`.
- `client.ts` — Drizzle-Client-Factory mit Postgres-JS, Lifecycle-Hook zum Schließen der Connection.

**Konvention:** Alle Money-Felder als `numeric(10,2)`, nie als `real`/`double`. Alle Timestamps als `timestamp with time zone`.
