# 00 – Deinen PC vorbereiten (einmalig, ca. 10 Minuten)

Du brauchst zwei Dinge: **Node.js** (das Programm, das ArbiSync ausführt) und den **Code**.

---

## Schritt 1: Node.js installieren

1. Öffne <https://nodejs.org/de>
2. Klicke auf den großen Button **„LTS“** (das ist die stabile Version).
3. Öffne die heruntergeladene Datei und klicke immer auf **Weiter** → **Installieren** → **Fertig**.
   Häkchen so lassen, wie sie sind.

### Prüfen, ob es geklappt hat

**Windows:**
1. Drücke die **Windows-Taste**, tippe `cmd` und drücke **Enter**.
   Ein schwarzes Fenster öffnet sich – das ist die **Eingabeaufforderung**.
2. Tippe Folgendes ein und drücke Enter:

```bash
node --version
```

Es erscheint z. B. `v22.11.0`. Jede Zahl ab 20 ist gut.

> Benutze bitte die **Eingabeaufforderung (cmd)**, nicht PowerShell.
> PowerShell blockiert `npm` manchmal mit einer roten Fehlermeldung.

**Mac:** Drücke `Cmd + Leertaste`, tippe `Terminal`, Enter. Dann derselbe Befehl.

---

## Schritt 2: Code herunterladen

1. Öffne dein Repository auf GitHub: <https://github.com/cajusalfonso/Ebay-listing>
2. Oben links auf den Button mit dem Branch-Namen (meist `main`) klicken
   → `claude/intelligent-clarke-baamyf` auswählen.
3. Grüner Button **„Code“** → **„Download ZIP“**.
4. ZIP-Datei mit Rechtsklick → **„Alle extrahieren…“** → als Ziel z. B. `C:\ArbiSync` → **Extrahieren**.

> Bei jedem neuen Modul lädst du die ZIP-Datei neu herunter und entpackst sie in einen **neuen** Ordner.
> Deine `.env`-Datei kopierst du dann aus dem alten Ordner in den neuen.

---

## Schritt 3: Eingabeaufforderung im richtigen Ordner öffnen

Der Trick, der dir das Tippen von langen Pfaden erspart:

**Windows:**
1. Öffne im Explorer den entpackten Ordner und gehe hinein bis zu **`arbisync` → `worker`**.
   (Du siehst dort Dateien wie `package.json` und `wrangler.toml`.)
2. Klicke oben in die **Adresszeile** (wo der Pfad steht), lösche den Text, tippe `cmd` und drücke **Enter**.
3. Die Eingabeaufforderung öffnet sich – direkt in diesem Ordner.

**Mac:** Im Finder Rechtsklick auf den Ordner `worker` → **Dienste** → **Neues Terminal beim Ordner**.

Fertig. Weiter mit „Modul 1 testen“ in der [README](../../README.md).
