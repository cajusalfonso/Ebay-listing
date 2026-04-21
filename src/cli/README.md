# cli

citty-basierte Commands. Jeder Command ist dünn — ruft Module auf, formatiert Output, bestätigt User-Interaktionen.

**Kommt in Schritten 3.5, 3.6, 3.15:**

- `index.ts` — Root-Command mit Subcommands.
- `setup-ebay-auth.ts` — einmaliger OAuth-Flow: lokaler HTTP-Listener für Redirect, öffnet Browser, speichert Tokens encrypted.
- `setup-resolve-categories.ts` — Taxonomy-API-Calls für alle Whitelist-Kategorien, schreibt `config-files/ebay-category-ids.json`.
- `commands/enrich.ts` — Dry-Run-Debug für Product-Data-Enrichment.
- `commands/compliance.ts` — Dry-Run-Debug fürs Compliance-Gate.
- `commands/market.ts` — Market-Snapshot fetchen.
- `commands/price.ts` — Pricing-Calc + Strategy ausgeben.
- `commands/list-product.ts` — Full Flow End-to-End (`--dry-run` oder `--publish --env=…`).

**Production-Safety:** `list-product --publish --env=production` wirft zusätzlich ein Prompt („Confirm with `yes-really`") + erfordert CLI-Flag `--yes-really`. Ohne beides: Abbruch.
