# images

Bild-Pipeline: Download → sharp-Processing → lokale Persistierung → EPS-Upload.

**Kommt in Schritten 3.11–3.12:**

- `downloader.ts` — HTTP-Fetch via undici mit Timeout, MIME-Type-Check.
- `processor.ts` — sharp-Operationen: Resize longest side 1600px (kleiner bleibt kleiner, aber min 500px Check vorher), Pad zu 1600×1600 weiß wenn nicht quadratisch, EXIF strip, Output `01.jpg` (q=85) + `01.webp` (q=80).
- `storage.ts` — Dateisystem-Layout: `./storage/images/{ean}/original/{idx}.{ext}` + `./storage/images/{ean}/processed/{idx}.{jpg|webp}`.
- `eps-upload.ts` — eBay Picture Service Upload via `modules/ebay/eps.ts`, EPS-URL in `product_images.ebay_eps_url` für Reuse (kostenpflichtig bei Volume).
- `errors.ts` — `ImageError`.

**Policy (hartcodiert):** NIEMALS Amazon-, Hersteller-Website- oder Google-Bilder. Nur `ebay_catalog` + `icecat` sind lizenziert. UPCitemDB-Bilder nur mit manual review.

**Limits:** Min 500×500 (kleiner → skip mit Warning), max 12 Bilder/Listing (eBay-Hardlimit), max 5 MB nach Processing.
