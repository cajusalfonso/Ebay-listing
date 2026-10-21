# cajus-leads – Kunden finden für Cajus Webdesign

Findet Friseursalons, prüft ihre Websites, schreibt persönliche E-Mails und legt sie als **Entwürfe** in Gmail an. Gesendet wird nie automatisch – Sie lesen jede Mail und klicken selbst auf „Senden“.

Kosten: 0 €. Daten von OpenStreetMap, keine kostenpflichtigen Dienste.

---

## Einmalig einrichten (ca. 10 Minuten)

**1. Python prüfen.** Terminal öffnen (Mac: „Terminal“, Windows: „Eingabeaufforderung“) und eingeben:

```
python3 --version
```

Es muss `Python 3.10` oder höher erscheinen. Falls nicht: https://www.python.org/downloads/ installieren.
Windows: Überall `python` statt `python3` schreiben.

**2. In den Ordner wechseln:**

```
cd Pfad/zum/Ordner/cajus-leads
```

**3. Gmail-App-Passwort erstellen** (nur nötig für Schritt 4 im Ablauf):

1. Mit `cajus.webdesign@gmail.com` anmelden.
2. https://myaccount.google.com/security öffnen → **2-Schritt-Bestätigung** einschalten.
3. https://myaccount.google.com/apppasswords öffnen → Name `cajus-leads` → **Erstellen**.
4. Das 16-stellige Passwort kopieren.

**4. Datei `.env` anlegen:**

```
cp .env.example .env
```

(Windows: `copy .env.example .env`)
Dann `.env` mit einem Texteditor öffnen und hinter `GMAIL_APP_PASSWORD=` das Passwort einfügen. Speichern.

**5. Absender-Adresse in Gmail freischalten.** Die Entwürfe haben als Absender `info@cajus-webdesign.com`. Damit Gmail beim Senden diese Adresse nutzt:
Gmail → Zahnrad → **Alle Einstellungen** → **Konten und Import** → **Senden als** → **Weitere E-Mail-Adresse hinzufügen** → `info@cajus-webdesign.com` (SMTP-Daten von Ihrem Mail-Anbieter).
Ohne diesen Schritt sendet Gmail von `cajus.webdesign@gmail.com`.

---

## Ablauf

```
python3 cajus_leads.py suche --stadt "Frankfurt am Main" --radius-km 10
python3 cajus_leads.py analyse --top 20
python3 cajus_leads.py entwuerfe --top 20 --dry-run
python3 cajus_leads.py entwuerfe --top 20
```

1. **suche** – findet alle Friseursalons im Umkreis, prüft jede Website kurz und vergibt einen Score. Dauert bei 10 km ca. 5–10 Minuten (1 Abruf pro Sekunde, damit niemand belastet wird). Ketten wie Klier oder Super Cut werden ausgelassen.
2. **analyse** – sieht sich die 20 besten Leads mit E-Mail genau an und schreibt pro Salon `outreach/<salon>/analyse.md` und `outreach/<salon>/email.md`. **Lesen Sie jede email.md, bevor Sie weitermachen.**
3. **entwuerfe --dry-run** – zeigt alle Mails im Terminal. Nichts wird angelegt.
4. **entwuerfe** – legt die Mails als Entwürfe in Gmail an. Öffnen Sie Gmail → Entwürfe, prüfen und senden Sie selbst.

Danach den Status pflegen:

```
python3 cajus_leads.py markiere "Salon Alt" gesendet
python3 cajus_leads.py status
```

Mögliche Status: `entwurf`, `gesendet`, `antwort`, `interesse`, `abschluss`, `absage`.
Ein Teil des Namens reicht („alt“), solange er eindeutig ist.

---

## Die Dateien

| Datei | Inhalt |
|---|---|
| `leads.csv` | Alle Salons mit Kontaktdaten, Score, Befunden und Status. Öffnet in Excel. |
| `ohne_email.csv` | Salons ohne E-Mail – zum Anrufen oder Vorbeigehen. |
| `kontaktiert.csv` | Wer schon einen Entwurf bekommen hat, mit Verlauf. Diese Salons werden nie doppelt angeschrieben. |
| `outreach/<salon>/analyse.md` | Alle Prüfpunkte, die 3 wichtigsten Befunde, das Positive, Selbstcheck. |
| `outreach/<salon>/email.md` | Betreff und Text der E-Mail. |

**E-Mail selbst ändern:** In `email.md` die erste Zeile (`<!-- automatisch erstellt … -->`) löschen und den Text anpassen. Dann wird die Datei bei einem neuen `analyse` nicht mehr überschrieben.

**Neue Suche:** `suche` kann jederzeit erneut laufen. Status und Notizen bleiben erhalten.

---

## So wird bewertet (Score 0–100)

| Merkmal | Punkte |
|---|---|
| keine Website | +50 |
| Baukasten (Jimdo, Wix, Webnode, Weebly, Strato) | +25 |
| kein HTTPS | +15 |
| nicht mobil (kein viewport) | +20 |
| keine Online-Buchung (Treatwell, Planity, Shore, Calendly …) | +10 |
| Copyright älter als 3 Jahre | +10 |
| E-Mail vorhanden | +5 |

Die Analyse prüft zusätzlich: Mobil-Darstellung, Klicks bis zur Buchung, Preise, Leistungen, Team, Öffnungszeiten, Stockfotos, Bewertungen, Ladezeit, Baukasten-Werbung, kaputte Links, Google-Titel und -Beschreibung, Stadtteil im Text, Impressum und Datenschutz.
Ein Befund kommt nur in die E-Mail, wenn er eindeutig belegt ist. Unsichere Punkte stehen nur in `analyse.md` (als „unsicher → nicht verwendet“).

---

## E-Mails von Claude verfeinern lassen (empfohlen)

Die Texte werden aus einem Baukasten von Formulierungen zusammengesetzt. Sie sind korrekt, aber bei vielen Mails wiederholen sich Sätze. Für wirklich individuelle Mails:

1. Claude Code im Ordner `cajus-leads` öffnen.
2. Schreiben: **„Lies CLAUDE.md und überarbeite alle E-Mails in outreach/ nach den Regeln.“**
3. Danach wie gewohnt `entwuerfe --dry-run` und `entwuerfe`.

---

## Wichtig: Recht

Werbe-E-Mails ohne vorherige Einwilligung sind in Deutschland auch an Firmen grundsätzlich unzulässig (§ 7 Abs. 2 Nr. 3 UWG) und können abgemahnt werden. Rechtlich sicherer: Salon zuerst anrufen oder besuchen, Interesse erfragen, dann die Mail schicken. Im Zweifel anwaltlich prüfen lassen.

---

## Probleme?

| Meldung | Lösung |
|---|---|
| `Kein Overpass-Server erreichbar` | Server ausgelastet. 5 Minuten warten, erneut starten. |
| `CERTIFICATE_VERIFY_FAILED` (Mac) | Im Finder: Programme → Python 3.x → `Install Certificates.command` doppelklicken. |
| `Gmail-Login fehlgeschlagen` | App-Passwort neu erstellen und in `.env` eintragen. Nicht das normale Gmail-Passwort verwenden. |
| `noch keine email.md` | Erst `analyse` ausführen. |
| `Mehrere Treffer` bei markiere | Den vollständigen Namen wie in leads.csv angeben, z. B. `"Salon Alt"`, oder die E-Mail-Adresse. |

Test (für Entwickler): `python3 -m unittest discover -s tests`
