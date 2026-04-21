# eBay Volume Listing Tool — Phase 1 MVP

Automatisiertes Volumen-Listing für eBay.de mit Compliance-First-Gate. Ein EAN → ein echtes Sandbox-Listing end-to-end. Architektur ist Phase-2-ready (Bulk, Queues, Multi-Channel) ohne Refactoring.

**Scope-NICHT:** Smartphone-Verkauf läuft separat und ist hier nicht Teil.

---

## Quickstart (frischer Rechner → erstes Sandbox-Listing)

```bash
# 1. Dependencies
corepack enable                 # or: brew install pnpm
pnpm install

# 2. Infrastruktur (Postgres in Docker)
docker compose up -d            # or: colima start && docker compose up -d

# 3. Interaktiver Setup-Wizard — kein manuelles .env-Editing nötig
pnpm setup
#    → fragt alle Creds ab (Discord Webhook Live-Test inklusive)
#    → generiert TOKEN_ENCRYPTION_KEY via node:crypto
#    → schreibt .env mit 0600-Permissions

# 4. DB-Schema migrieren
pnpm db:migrate

# 5. eBay OAuth (einmalig pro Environment)
pnpm setup:ebay-auth
#    → Browser öffnet sich, Login auf eBay Sandbox
#    → Tokens AES-256-GCM encrypted in DB gespeichert

# 6. Whitelist-Kategorien auflösen (einmalig pro Environment)
pnpm setup:resolve-categories
#    → Taxonomy-API-Abfrage pro Whitelist-Entry
#    → Interaktiver Picker pro Kategorie (Top-5-Vorschläge)
#    → schreibt config-files/ebay-category-ids.json

# 7. Erstes End-to-End-Listing (Sandbox, Dry-Run default)
pnpm cli:list-product --ean=5061014884654 --cogs=5.50
# Zeigt Enrichment + Compliance + Market + Price — NICHT veröffentlicht

# 8. Tatsächlich veröffentlichen (Sandbox)
pnpm cli:list-product --ean=5061014884654 --cogs=5.50 --publish
```

## Prerequisites

| Tool                | Zweck                                                      |
| ------------------- | ---------------------------------------------------------- |
| Node.js ≥ 20.11     | `node --version`                                           |
| pnpm ≥ 10           | `brew install pnpm`                                        |
| Docker / Colima     | Postgres 16 via compose (Colima ist gratis, auch business) |
| eBay Developer Acct | Sandbox App-Keys: https://developer.ebay.com/my/keys       |
| Sandbox-User        | https://developer.ebay.com/sandbox/register                |
| Icecat Open Catalog | https://icecat.biz (kostenlose Registrierung)              |
| Discord Webhook URL | Server → Channel → Integrations → Webhooks                 |

### eBay Business Policies (vor dem ersten `--publish`)

In Seller Hub → Account Settings → Business Policies folgende anlegen:

- **Fulfillment Policy** (Versand)
- **Payment Policy** (Zahlung)
- **Return Policy** (Rücknahme)

Die erste Policy jedes Typs wird automatisch verwendet.

### Inventory Location

Einmalig in Seller Hub eine Inventory Location anlegen (z.B. Key `main`). Der Key wird beim Listing-Create benötigt (`--merchant-location-key=main`, Default `main`).

## CLI-Commands

### Setup (einmalig)

| Command                         | Zweck                                                          |
| ------------------------------- | -------------------------------------------------------------- |
| `pnpm setup`                    | Interaktiver Wizard, schreibt `.env` + macht Live-Tests        |
| `pnpm db:migrate`               | Drizzle-Migrationen anwenden                                   |
| `pnpm setup:ebay-auth`          | OAuth 2.0 Flow, Browser-Redirect, Tokens AES-256-GCM encrypted |
| `pnpm setup:resolve-categories` | Whitelist → eBay-Category-IDs (interaktiver Picker)            |

### Daily Use

| Command                                                                                  | Zweck                                    |
| ---------------------------------------------------------------------------------------- | ---------------------------------------- |
| `pnpm cli:enrich --ean=<EAN>`                                                            | Debug: Product-Data-Enrichment           |
| `pnpm cli:market --ean=<EAN>`                                                            | Debug: Market-Snapshot                   |
| `pnpm cli:price --ean=<EAN> --cogs=<EUR>`                                                | Debug: Pricing-Calc + Strategy           |
| `pnpm cli:list-product --ean=<EAN> --cogs=<EUR>`                                         | Full flow **dry-run** (default)          |
| `pnpm cli:list-product --ean=<EAN> --cogs=<EUR> --publish`                               | Sandbox-Listing erstellen                |
| `pnpm cli:list-product --ean=<EAN> --cogs=<EUR> --publish --env=production --yes-really` | LIVE — mit doppelter Safety-Confirmation |

### Development

| Command              | Zweck                             |
| -------------------- | --------------------------------- |
| `pnpm typecheck`     | `tsc --noEmit`                    |
| `pnpm lint`          | `eslint .`                        |
| `pnpm format`        | Prettier                          |
| `pnpm test`          | Vitest (335+ unit tests, offline) |
| `pnpm test:coverage` | Vitest mit v8-Coverage            |
| `pnpm test:watch`    | TDD-Loop                          |
| `pnpm db:generate`   | Neue Migration aus Schema         |
| `pnpm db:studio`     | Drizzle Studio (DB-Web-UI)        |

## Compliance Gate — fünf Prüfungen

Ein Listing wird **niemals** veröffentlicht ohne:

1. **Kategorie** in Whitelist (7 nicht-regulierte Kategorien, aufgelöste eBay-Category-IDs)
2. **Keywords** triggern keine Blacklist-Regex (Batterie, Akku, Creme, Medizin, Textil, …)
3. **Required Aspects** der Kategorie alle gefüllt (von eBay Taxonomy API)
4. **GPSR-Daten** vollständig: Hersteller-Name + Adresse + Email
5. **Mindestens 1 lizenziertes Bild** aus `ebay_catalog` oder `icecat`

**PLUS Margin-Regeln:**

- Profit ≥ €10 **UND** Margin ≥ 8% (konfigurierbar)

Bei Fehler → Eintrag in `needs_review`, **keine** API-Publish.

## Projekt-Struktur

```
src/
  config/         Env-Schema (Zod), Konstanten, Category-Loader
  db/             Drizzle Schema (8 Tabellen) + Migrations + Client
  modules/
    pricing/      Profitability Engine (pure, 46 Tests) + Strategy
    compliance/   Compliance Gate (pure, 28 Tests) — 5 Check-Funktionen + Warnings
    ebay/         OAuth, Catalog, Taxonomy, Browse, Inventory, EPS, Account, HttpClient
    product-data/ Multi-Source Enrichment-Orchestrator + Merge + GPSR-Override
      sources/    ebay-catalog, icecat (xml-parser), upcitemdb-stub
    images/       Download + sharp-Processing + Storage
    market-data/  eBay Browse Provider (Port-Interface für Phase-2)
    discord/      Webhook Notifier + Embed Builder
  cli/            Alle Commands + lib/clients.ts (shared client factory)
  api/            Fastify-Stub für Phase 2
  lib/            encryption (AES-256-GCM), retry (exp backoff), logger (pino), correlation (AsyncLocalStorage)

tests/            Integration-Fixtures
storage/images/   Produktbilder (gitignored)
config-files/
  category-whitelist.json    7 Whitelist-Kategorien (DE)
  keyword-blacklist.json     Regex-Patterns für Compliance-Gate
  ebay-category-ids.json     Auto-generiert via setup:resolve-categories
```

## Production-Safety

Default-Env ist `sandbox`. Production-Publish erfordert **BEIDE**:

1. `EBAY_ENV=production` in `.env`
2. `--env=production --yes-really` CLI-Flag

Ohne beides: Abbruch mit klarer Fehlermeldung, kein API-Call gegen Production.

## Tech Stack (fixed)

| Layer            | Tool                             |
| ---------------- | -------------------------------- |
| Language         | TypeScript strict mode           |
| Runtime          | Node.js 20+                      |
| API Framework    | Fastify (Phase-2 stub)           |
| CLI              | citty                            |
| Database         | PostgreSQL 16 + Drizzle ORM      |
| Validation       | Zod (überall auf externen Daten) |
| HTTP Client      | undici                           |
| Logging          | Pino mit Correlation-IDs         |
| Testing          | Vitest                           |
| Image Processing | sharp                            |
| XML Parser       | fast-xml-parser (Icecat, EPS)    |
| Encryption       | node:crypto AES-256-GCM          |
| Package Manager  | pnpm 10+                         |

## Troubleshooting

### Docker nicht installiert

Colima ist eine gratis Alternative (auch für Business-Use):

```bash
brew install colima docker docker-compose
colima start
docker compose up -d
```

### `pnpm cli:list-product` hängt bei OAuth

Der OAuth-Token ist abgelaufen — Refresh-Token meist 18 Monate gültig. Re-Auth:

```bash
pnpm setup:ebay-auth
```

### eBay Inventory API gibt 400 "Aspect X is missing"

Die Kategorie hat Required Aspects, die Catalog/Icecat nicht geliefert haben. Entweder:

- `pnpm cli:enrich --ean=<EAN>` prüfen, was in `specs` drin ist
- Manueller Override in DB-Tabelle `products.specs`
- GPSR-Override für häufige Brands in `gpsr_manufacturer_overrides` anlegen

### Discord-Webhook: "Invalid Webhook Token"

Webhook-URL falsch oder gelöscht. Server-Einstellungen → Integrations → Webhooks neu erstellen, `pnpm setup` erneut laufen lassen (überschreibt nur betroffene Variable wenn du bestätigst).

## License / Support

Internes Tool — Cosimo Management UG. Bei Fragen: Issue eröffnen oder Entwicklerteam kontaktieren.
