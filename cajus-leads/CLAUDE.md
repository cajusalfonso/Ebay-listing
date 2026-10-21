# cajus-leads – Regeln für Claude Code

Tool: `cajus_leads.py` (nur Python-Standardbibliothek). Nutzer programmiert nicht: Antworten auf Deutsch, kurz, Befehle zum Kopieren.

## Wenn der Nutzer sagt „überarbeite die E-Mails in outreach/“

Für jeden Ordner `outreach/<salon>/`:
1. `analyse.md` lesen. Wenn möglich die Website selbst abrufen und Startseite + Kontakt/Impressum ansehen.
2. Die 3 Befunde wählen, die dem Salon am meisten Kunden/Termine kosten, + 1 Sache, die wirklich gut ist.
   Selbstcheck: Trifft jeder Punkt auf genau diese Website zu? Wenn unsicher → weglassen.
3. `email.md` neu schreiben und die erste Zeile `<!-- automatisch erstellt … -->` entfernen (sonst überschreibt `analyse` sie wieder).

Format von `email.md` (nicht ändern):
```
An: <empfänger>
Betreff: <max. 50 Zeichen, konkret zum Salon>

<Text>

Viele Grüße
Alfonso Zimmermann
Cajus Webdesign
info@cajus-webdesign.com
```

Regeln für den Text:
- KEIN Preis, kein Angebot, keine Kostenangaben.
- Max. 150 Wörter (ohne Signatur), Sie-Form, keine Floskeln, kein Fachjargon, kein Druck, keine Emojis.
- Aufbau: Anrede · 1 Satz wer ich bin + dass ich mir die Seite angesehen habe · 3 Punkte als „- “-Liste
  (Problem + konkreter Vorschlag + Nutzen, z. B. „Termine nur per Telefon → Buchungsbutton oben → Kunden buchen auch abends“)
  · 1 Satz ehrliches Lob · exakt: „Hätten Sie Interesse, dass ich Ihnen unverbindlich zeige, wie das aussehen könnte?“
- Jede Mail individuell, keine zwei gleichen Formulierungen über alle Mails hinweg.
- Ohne Website: Aufhänger „Kunden suchen ‚Friseur <Stadtteil>‘ bei Google und landen bei Salons mit Website“, gleiche Abschlussfrage.

Danach prüfen: `python3 cajus_leads.py entwuerfe --top 20 --dry-run`

## Nie
- E-Mails senden. Nur IMAP-APPEND in den Entwürfe-Ordner.
- `.env`, `leads.csv`, `kontaktiert.csv`, `outreach/` committen.
