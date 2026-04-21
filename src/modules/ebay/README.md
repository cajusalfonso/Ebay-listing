# ebay

Alle eBay-API-Integrationen. Ports & Adapters — jeder API eigener Wrapper mit Zod-Validierung der Responses, pro-API Rate-Limiter, und Retry-Logik.

**Kommt in Schritten 3.5–3.13:**

- `auth.ts` — OAuth 2.0 User-Token-Flow, AES-256-GCM Token-Storage, auto-refresh wenn <5min Restlaufzeit.
- `taxonomy.ts` — Category-Suggestions + Required Aspects (`/commerce/taxonomy/v1`).
- `catalog.ts` — Produkt-Lookup per `gtin=` (`/commerce/catalog/v1_beta`).
- `browse.ts` — Konkurrenz-Preise auf eBay.de (`/buy/browse/v1`), MARKET_ID=`EBAY_DE`.
- `inventory.ts` — Create Inventory Item → Create Offer → Publish (`/sell/inventory/v1`).
- `account.ts` — Business Policies lesen (`/sell/account/v1`, readonly).
- `eps.ts` — Picture Service Upload, EPS-URLs persistieren in `product_images.ebay_eps_url`.
- `client.ts` — gemeinsamer HTTP-Client (undici) mit Correlation-ID-Logging, Rate-Limiter-Pool, Retry (3× exp backoff 1s/2s/4s bei 429/5xx).
- `errors.ts` — `EbayApiError` mit `errorId`, `domain`, `category`, `status`.

**Scopes (MVP):**

```
sell.inventory
sell.account.readonly
sell.fulfillment.readonly
commerce.catalog.readonly
buy.item.feed
```

**Environment-Safety:**

- Default: `EBAY_ENV=sandbox`.
- Production braucht `EBAY_ENV=production` **UND** `--env=production --yes-really` CLI-Flag — sonst Abbruch.

**Base URLs:**

- Sandbox: `https://api.sandbox.ebay.com`
- Production: `https://api.ebay.com`
