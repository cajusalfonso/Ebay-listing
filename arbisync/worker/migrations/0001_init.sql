-- ArbiSync Grundschema (Cloudflare D1 / SQLite)
-- Zeitstempel als ISO-Text in UTC: 'YYYY-MM-DD HH:MM:SS'

-- Einstellungen (JSON), änderbar im Dashboard
CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Ein Amazon-Produkt mit dem zuletzt bekannten Stand
CREATE TABLE products (
  asin               TEXT PRIMARY KEY,
  ean                TEXT,
  title              TEXT,               -- nur zur internen Anzeige, wird NICHT zu eBay übertragen
  amazon_url         TEXT NOT NULL,
  price_gross        REAL,               -- NULL = unbekannt
  available          INTEGER,            -- 1/0, NULL = unbekannt
  prime              INTEGER,
  sold_by_amazon     INTEGER,
  delivery_days      INTEGER,
  price_seen_at      TEXT,
  price_source       TEXT,               -- 'extension' | 'keepa'
  epid               TEXT,               -- eBay-Katalog-ID
  ebay_category_id   TEXT,
  catalog_match      INTEGER,            -- 1 Treffer, 0 kein Treffer, NULL ungeprüft
  status             TEXT NOT NULL DEFAULT 'new',
                     -- new | queued | listed | paused | rejected | error
  status_reason      TEXT,
  expected_profit    REAL,
  queued_at          TEXT,
  tier               TEXT NOT NULL DEFAULT 'B', -- A | B (Keepa-Sync)
  consecutive_errors INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_ean ON products(ean);

-- Preisverlauf (jeder Seitenaufruf / jede Keepa-Antwort)
CREATE TABLE price_snapshots (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  asin           TEXT NOT NULL REFERENCES products(asin) ON DELETE CASCADE,
  price_gross    REAL,
  available      INTEGER,
  prime          INTEGER,
  sold_by_amazon INTEGER,
  delivery_days  INTEGER,
  source         TEXT NOT NULL,
  seen_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_snapshots_asin ON price_snapshots(asin, seen_at);

-- Listing auf einem Kanal (zunächst nur eBay)
CREATE TABLE listings (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  asin            TEXT NOT NULL REFERENCES products(asin) ON DELETE CASCADE,
  channel         TEXT NOT NULL DEFAULT 'ebay',
  sku             TEXT NOT NULL UNIQUE,
  offer_id        TEXT,
  listing_id      TEXT,
  vk_gross        REAL,
  quantity        INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'draft', -- draft | active | paused | ended | error
  pause_reason    TEXT,
  last_pushed_at  TEXT,
  listed_at       TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (asin, channel)
);

-- Bestellungen von eBay
CREATE TABLE orders (
  id                         INTEGER PRIMARY KEY AUTOINCREMENT,
  channel                    TEXT NOT NULL DEFAULT 'ebay',
  channel_order_id           TEXT NOT NULL,
  line_item_id               TEXT,
  sku                        TEXT,
  asin                       TEXT,
  quantity                   INTEGER NOT NULL DEFAULT 1,
  vk_gross                   REAL NOT NULL,
  ebay_fees                  REAL,
  amazon_price_gross_at_order REAL,
  amazon_price_seen_at       TEXT,
  expected_profit            REAL,
  status                     TEXT NOT NULL DEFAULT 'open',
                             -- open | ordered | shipped | undeliverable | cancelled
  amazon_price_paid_gross    REAL,       -- tatsächlicher Einkaufspreis (für Buchhaltung)
  tracking_number            TEXT,
  carrier                    TEXT,
  ordered_at                 TEXT,
  shipped_reported_at        TEXT,
  notified_at                TEXT,
  reminder_sent_at           TEXT,
  created_at                 TEXT NOT NULL,
  imported_at                TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (channel, channel_order_id, line_item_id)
);
CREATE INDEX idx_orders_status ON orders(status);

-- Fehler-Log in Klartext
CREATE TABLE error_log (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  at      TEXT NOT NULL DEFAULT (datetime('now')),
  level   TEXT NOT NULL DEFAULT 'error',
  source  TEXT NOT NULL,
  message TEXT NOT NULL,
  asin    TEXT
);
CREATE INDEX idx_error_log_at ON error_log(at);

-- Kleiner Schlüssel/Wert-Speicher für Laufzeitzustand (eBay-Access-Token, Nachtmodus-Status, Keepa-Tokens)
CREATE TABLE kv_state (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
