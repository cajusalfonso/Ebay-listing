# compliance

Compliance-Gate. **Pure Funktionen.** Sammelt alle Blocker (stoppt **nicht** beim ersten), damit der User alle Probleme auf einmal sieht.

**Kommt in Schritt 3.4 (≥15 Unit Tests):**

- `check.ts` — `checkCompliance(product, categoryId, requiredAspects): ComplianceResult`
- `category.ts` — Whitelist-Lookup auf aufgelöste eBay Category IDs.
- `keywords.ts` — kompilierte Regex-Array aus `config-files/keyword-blacklist.json`, case-insensitive.
- `gpsr.ts` — Prüfung von `manufacturerName`, `manufacturerAddress`, `manufacturerEmail` — alle non-empty required.
- `types.ts` — `ComplianceResult { passed, blockers[], warnings[] }`.
- `errors.ts` — `ComplianceError`.

**Prüf-Reihenfolge (alle laufen immer, Blocker werden gesammelt):**

1. Kategorie-Whitelist
2. Keyword-Blacklist gegen Title+Description+Brand
3. Required Aspects (Kategorie-spezifisch, von Taxonomy API geliefert)
4. GPSR-Daten vollständig
5. Mindestens 1 Bild aus `ebay_catalog` oder `icecat` (nicht `upcitemdb`/`manual`)
