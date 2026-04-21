# tests

**Unit-Tests liegen als Co-Located-Files im `src/`-Tree** (`*.test.ts` neben dem zu testenden File).

Dieser Ordner enthält nur:

- **Integration-Fixtures** — realistische Mock-Responses für eBay-APIs, Icecat-XML-Fixtures, Image-Samples.
- **End-to-End-Testhelfer** — Helper für `list-product`-Full-Flow-Tests mit gemockten Adaptern.

**CI-Regel:** Keine echten API-Calls in Tests — alles gemockt via `undici` MockAgent oder Source-Interface-Stubs. Tests müssen offline laufen, ohne `.env`, ohne Postgres.

**Beispiele für kommende Fixtures (Schritt 3.7+):**

- `tests/fixtures/ebay-browse-response.json`
- `tests/fixtures/ebay-catalog-response.json`
- `tests/fixtures/icecat-product.xml`
- `tests/fixtures/ebay-taxonomy-aspects.json`
- `tests/fixtures/images/` — Sample-PNGs für sharp-Tests.
