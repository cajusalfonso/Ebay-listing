# ArbiSync – Amazon.de → eBay.de Arbitrage

Chrome-Extension + kleiner Cloud-Server auf **Cloudflare (Gratis-Plan, 0 €/Monat)**.

> **Wichtig – eBay-Richtlinie:** Lass Amazon **an dich** liefern und verschicke selbst.
> Direktversand von Amazon an deinen eBay-Käufer ist bei eBay verboten (Kontosperre).
> Die Preislogik rechnet deshalb mit „Eigenversand“ (Standard 5 € netto).

## Stand der Module

| # | Modul | Status |
|---|---|---|
| 1 | Server-Grundgerüst + Preislogik + Tests | ✅ fertig |
| 2 | Chrome-Extension mit Margen-Overlay | ⏳ |
| 3 | eBay-Listing (Sandbox) | ⏳ |
| 4 | Schutzregeln + Nachtmodus | ⏳ |
| 5 | Bestellungen + Telegram | ⏳ |
| 6 | Dashboard | ⏳ |
| 7 | Keepa-Provider (vorbereitet, aus) | ⏳ |
| 8 | Deployment auf Cloudflare | ⏳ |

## Ordner

```
arbisync/
├── README.md              diese Datei
├── docs/setup/            Schritt-für-Schritt-Anleitungen für Laien
└── worker/                der Server (Cloudflare Worker)
    ├── .env.example       Vorlage für deine Geheimnisse – jede Zeile erklärt
    ├── wrangler.toml      Cloudflare-Konfiguration (keine Geheimnisse)
    ├── migrations/        Datenbank-Aufbau
    ├── scripts/           Hilfsskripte (Beispielrechnung)
    ├── src/
    │   ├── pricing/       Preislogik + Unit-Tests mit Beispielrechnungen
    │   ├── settings.ts    alle einstellbaren Werte + Standardwerte
    │   ├── app.ts         Server-Adressen (API)
    │   └── routes/        Test-Rechner im Browser
    └── test/              weitere Tests
```

## Preislogik (Standardwerte, später im Dashboard änderbar)

- **EK netto** = Amazon-Preis brutto / 1,19 (Amazon Business mit Vorsteuerabzug)
- **eBay-Gebühr** = 11 % vom VK brutto + 0,35 € pro Verkauf (je Kategorie änderbar)
- **Retourenpuffer** = 3 % vom VK netto
- **Eigenversand** = 5,00 € netto
- **Regel:** Gewinn netto ≥ 15 € **und** Marge ≥ 10 % vom VK netto
- Der empfohlene eBay-Preis ist der **kleinste** Cent-Betrag, der beide Regeln erfüllt.
- Preis-Update an eBay erst ab Abweichung > 1 % **oder** > 0,50 €.

| Amazon brutto | eBay-VK brutto | Gewinn netto | Marge | Aufschlag |
|---|---|---|---|---|
| 19,99 € | 52,69 € | 15,00 € | 33,9 % | +164 % |
| 49,99 € | 88,44 € | 15,00 € | 20,2 % | +77 % |
| 119,00 € | 170,68 € | 15,00 € | 10,5 % | +43 % |
| 299,00 € | 413,16 € | 34,72 € | 10,0 % | +38 % |
| 595,00 € | 813,65 € | 68,38 € | 10,0 % | +37 % |

Klartext: Unter ca. **+37 % Preisabstand** zwischen Amazon und eBay erfüllt kein Produkt die Regel.

> Ob eBay deine Gebühren mit oder ohne USt berechnet, stellst du später im Dashboard ein
> (`feesIncludeVat`). Standard ist die sichere Annahme „Gebühr = Kosten“.
> Die buchhalterische Behandlung klärst du einmal mit deinem Steuerberater.

---

## Modul 1 testen (ca. 10 Minuten)

**Vorher einmalig:** [docs/setup/00-pc-vorbereiten.md](docs/setup/00-pc-vorbereiten.md)
(Node.js installieren, Code herunterladen, Eingabeaufforderung im Ordner `arbisync\worker` öffnen).

Tippe die Befehle einzeln ein und drücke nach jedem **Enter**.

### 1. Programme installieren (dauert 1–2 Minuten)

```bash
npm install
```

Gelbe „warn“-Zeilen sind normal. Wichtig ist, dass am Ende keine rote `ERR!`-Zeile steht.

### 2. Tests laufen lassen

```bash
npm test
```

✅ Erwartet: grüne Zeile **`Tests  32 passed (32)`**.
Damit sind alle Beispielrechnungen geprüft.

### 3. Beispieltabelle ansehen

```bash
npm run beispiel
```

Eigene Amazon-Preise testen (Komma oder Punkt ist egal):

```bash
npm run beispiel -- 89,90 249 1199
```

### 4. Deine `.env`-Datei anlegen

Windows:

```bash
copy .env.example .env
```

Mac:

```bash
cp .env.example .env
```

Einen sicheren API-Key erzeugen:

```bash
npm run schluessel
```

Es erscheint eine lange Zeichenkette. Markiere sie mit der Maus und kopiere sie
(Windows-cmd: markieren, dann **Rechtsklick** oder **Strg+C**).

Datei zum Bearbeiten öffnen – Windows:

```bash
notepad .env
```

Mac:

```bash
open -e .env
```

Füge die Zeichenkette direkt hinter `API_KEY=` ein (ohne Leerzeichen). Speichern (`Strg+S`), schließen.

### 5. Lokale Test-Datenbank anlegen

```bash
npm run db:lokal
```

Falls gefragt wird „Ok to proceed?“: `y` tippen, Enter.
✅ Erwartet: eine Tabelle mit `0001_init.sql │ ✅`.

### 6. Server auf deinem PC starten

```bash
npm run dev
```

✅ Erwartet: `Ready on http://localhost:8787`.
Beim ersten Mal fragt Wrangler evtl., ob anonyme Nutzungsdaten gesendet werden dürfen – `n` ist okay.

Das Fenster **offen lassen**. Öffne jetzt im Browser: <http://localhost:8787>

- API-Key aus der `.env` einfügen
- Amazon-Preis `119,00` eingeben → **Berechnen**
- ✅ Erwartet: **Grün**, eBay-VK brutto **170,68 €**, Gewinn **15,00 €**, Marge **10,5 %**
- Gib zusätzlich als eigenen eBay-Preis `150` ein → ✅ Erwartet: **Rot**

Server-Status ohne Key: <http://localhost:8787/health> → zeigt `"dryRun":true` (es wird nichts zu eBay gesendet).

### 7. Server stoppen

Im schwarzen Fenster **Strg+C** drücken.

### Wenn etwas nicht klappt

| Meldung | Lösung |
|---|---|
| `'npm' is not recognized` / `Befehl nicht gefunden` | Node.js neu installieren, danach Eingabeaufforderung **neu** öffnen |
| `npm.ps1 cannot be loaded` | Du bist in PowerShell – nimm die Eingabeaufforderung (`cmd`) |
| `ENOENT … package.json` | Du bist im falschen Ordner – Schritt 3 in der PC-Anleitung |
| Rechner zeigt „Falscher oder fehlender API-Key“ | Key in `.env` und im Browser vergleichen, Server mit Strg+C stoppen und `npm run dev` neu starten |
| `Address already in use` | Ein anderer Server läuft noch – Fenster schließen oder PC neu starten |
