# discord

Webhook-Notifier für Publish-Events. Port-Interface `Notifier` für Phase-2 (Slack, Email).

**Kommt in Schritt 3.14:**

- `webhook.ts` — POST an `DISCORD_WEBHOOK_URL` mit Embed-Payload.
- `embed.ts` — Embed-Builder mit Color-Logic (grün: profitable+cheapest, gelb: profitable+nicht-cheapest, rot: failed).
- `types.ts` — `Notifier`, `PublishEvent`.

**Embed-Felder (inline wo sinnvoll):**

- Title: Produkt-Titel (max 256 chars, truncate mit `…`)
- EAN, Kategorie
- COGS, Sell Price
- Profit € / Margin %
- Competitor Count / Lowest Competitor
- Market Position
- Links: eBay-Listing-URL, eBay-Suche-URL für EAN
- Footer: Timestamp, Environment (sandbox/production)

**Dry-Run:** NICHT senden, nur Console-Output.
