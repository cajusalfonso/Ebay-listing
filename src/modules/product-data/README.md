# product-data

Multi-Source-Enrichment-Orchestrator. Port-Interface `ProductSource` — Adapter in `sources/`.

**Kommt in Schritt 3.10:**

- `orchestrator.ts` — iteriert Sources in Priority-Order, merged Ergebnisse.
- `merge.ts` — Feld-Level-Merging-Regeln (Titel nie überschreiben, Bilder zusammenlegen, Specs mergen, Source-Herkunft pro Feld in `source_metadata`).
- `types.ts` — `ProductData`, `ProductSource`, `GpsrData`.
- `gpsr-override.ts` — DB-Lookup in `gpsr_manufacturer_overrides` per Brand-Key, wenn Source keine vollständigen GPSR-Daten liefert.
- `errors.ts` — `ProductDataError`.

**Source-Hierarchie (aktiviert im MVP):**

1. **eBay Catalog** — Priority 1, qualityScore 90. Liefert eBay-native Kategorie + Aspects.
2. **Icecat Open** — Priority 2, qualityScore 70–85 je nach Feld-Vollständigkeit. Basic Auth.
3. **UPCitemDB** — als Stub vorhanden, `enabled: false` im Config. Phase-2.

**Merging-Regel:** Haupt-Source = höchster qualityScore mit Match. Fehlende Felder aus nächster Source. qualityScore final = max der beteiligten Sources.

**GPSR-Fallback:** Wenn Source + Override-Tabelle zusammen nicht reichen → Compliance-Blocker. Kein silent fail.
