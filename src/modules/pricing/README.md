# pricing

Profitability-Engine. **Pure Funktionen** — keine DB, keine APIs, keine Side-Effects. Deshalb triviale Testbarkeit.

**Kommt in Schritt 3.3 (≥20 Unit Tests):**

- `pricing.ts` — exportiert `calculatePricing(inputs: PricingInputs): PricingResult`.
- `strategy.ts` — exportiert `suggestSellPrice(market, cogs, feePct, rules): PriceSuggestion`.
- `types.ts` — `PricingInputs`, `PricingResult`, `PriceSuggestion`, `MarketPosition`.
- `errors.ts` — `PricingError`-Subklasse mit semantischen Error-Codes.

**Formeln (siehe Spec-Dokument für Details):**

- FVF auf **Brutto inkl. Versand-vom-Käufer**.
- USt wird vom Brutto (Item + Versand) rückgerechnet und als Kosten verbucht.
- `cogsIncludesVat=true` → Vorsteuer `(cogs * vatRate / (1+vatRate))` von COGS abziehen.
- Margin auf Netto-Umsatz.
- `suggestedMinPriceGross` löst die Gleichung rückwärts, Preis der beide Regeln (Profit ≥ €10 UND Margin ≥ 8%) gerade so erfüllt.
- Return-Reserve: `returnReservePercent * cogs`, konservativ vom Profit abgezogen.

**Test-Matrix:** Happy path, Schwellen-Grenze, unprofitabel-durch-COGS, unprofitabel-durch-Margin, Gratisversand vs. teurer Versand, `cogsIncludesVat` true/false, Fee-Sätze {10%, 11%, 12%, 14%}, VAT-Sätze {0%, 7%, 19%}, Kategorien-Fee 0% (Auto-Teile), Zero-COGS-Error, Negative-Input-Error, Margin-dominiert, Profit-dominiert, beide Regeln gleich hart.
