# config

Zentrale Env-Validierung (Zod) + globale Konstanten.

**Kommt in Schritt 3.1:**

- `env.ts` — Zod-Schema für alle `process.env`-Werte. Wirft `EnvValidationError` mit klarer Meldung welche Var fehlt/falsch ist.
- `constants.ts` — fixe Konstanten (eBay-Scopes, Content-Types, Default-Timeouts).
- `categories.ts` — Loader für `config-files/category-whitelist.json` und `ebay-category-ids.json`.

**Konvention:** Nie `process.env.*` direkt irgendwo — immer über `env` aus diesem Modul.
