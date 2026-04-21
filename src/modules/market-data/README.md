# market-data

MVP: nur eBay Browse API. Port-Interface `MarketDataProvider` für Phase-2 (Kaufland, Otto, …).

**Kommt in Schritt 3.7:**

- `ebay-browse-provider.ts` — implementiert `MarketDataProvider`, wrappt `modules/ebay/browse.ts`.
- `types.ts` — `MarketDataProvider`, `MarketSnapshot`, `Competitor`.
- `errors.ts` — `MarketDataError`.

**Browse-Query:**

- `GET /buy/browse/v1/item_summary/search`
- `q={ean}`, `filter=conditions:{NEW}|buyingOptions:{FIXED_PRICE}|itemLocationCountry:DE|priceCurrency:EUR`
- Header: `X-EBAY-C-MARKETPLACE-ID: EBAY_DE`
- Sort: `price`
- Limit: 20

**Edge Cases:**

- 0 Competitors → `lowestPrice: null`, Pricing nutzt nur Mindest-Margin-Logik.
- 1 Competitor → Warning in Output, Listing erlaubt.
- Alle Competitors selber Seller-Username → Warning (möglicherweise eigenes Listing).
