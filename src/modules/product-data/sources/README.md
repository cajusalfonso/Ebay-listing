# product-data/sources

Konkrete `ProductSource`-Adapter. Jeder Adapter implementiert `fetchByEan(ean): Promise<ProductData | null>` und liefert `null` bei Nicht-Match (kein throw).

**Kommt in Schritten 3.8–3.9:**

- `ebay-catalog.ts` — nutzt `modules/ebay/catalog.ts`, qualityScore 90.
- `icecat.ts` — XML-Client, Basic Auth via `ICECAT_USER`/`ICECAT_PASSWORD`. Endpoint: `https://data.icecat.biz/xml_s3/xml_server3.cgi?ean_upc={ean};lang=de;output=productxml`. qualityScore 70–85.
- `upcitemdb.ts` — Stub, `enabled: false`. Phase-2.

**Lizenz-Flag pro Image:** `licensed: true` nur für `ebay_catalog` + `icecat`. Alles andere (manual, upcitemdb) muss erst reviewed werden und ist compliance-blockiert.
