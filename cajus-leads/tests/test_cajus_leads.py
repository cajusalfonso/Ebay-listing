"""End-to-End-Test mit lokalen Beispiel-Websites, Fake-Overpass/Nominatim und Fake-IMAP.

Start: python -m unittest discover -s tests   (im Ordner cajus-leads)
"""
import importlib
import io
import json
import os
import shutil
import sys
import tempfile
import threading
import unittest
from contextlib import redirect_stdout
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest import mock

HIER = Path(__file__).resolve().parent
sys.path.insert(0, str(HIER.parent))

SEITEN = {
    # Veralteter Jimdo-Salon ohne Mobilansicht, HTTP, Corona-Hinweis, Stockfoto
    "/alt/": """<html><head><title>Salon Alt</title></head><body>
      <h1>Willkommen im Salon Alt</h1><img src="/img/shutterstock_123.jpg" alt="Frau">
      <p>Wir schneiden, färben und föhnen. Bitte beachten Sie die Corona-Regeln im Salon.</p>
      <p>Telefon 069 123456</p><a href="/alt/impressum">Impressum</a> <a href="/alt/datenschutz">Datenschutz</a>
      <a href="/alt/galerie">Galerie</a><p>Erstellt mit Jimdo</p><p>© 2018 Salon Alt</p></body></html>""",
    "/alt/impressum": "<html><body><h1>Impressum</h1><p>Inhaberin Maria Alt, E-Mail: info [at] salon-alt [dot] de</p></body></html>",
    "/alt/datenschutz": "<html><body>Datenschutz</body></html>",
    # Moderner Salon mit Treatwell, Preisen, Zeiten, Team, Bewertungen
    "/modern/": """<html><head><title>Haarwerk Modern | Friseur Frankfurt Bornheim</title>
      <meta name="viewport" content="width=device-width"><meta name="description" content="Ihr Friseur in Bornheim">
      </head><body><a href="https://widget.treatwell.de/salon/haarwerk">Termin buchen</a>
      <p>Öffnungszeiten: Mo–Fr 9:00–18:00</p><p>Damenschnitt 45 € Herrenschnitt 25 € Färben ab 60 €</p>
      <p>Bewertungen unserer Kunden ★★★★★</p><a href="/modern/team">Unser Team</a>
      <a href="mailto:hallo@haarwerk-modern.de">Mail</a><a href="tel:+4969111">Anrufen</a>
      <a href="/modern/impressum">Impressum</a><a href="/modern/datenschutz">Datenschutz</a>
      <p>Schnitt, Farbe, Balayage, Strähnen in Bornheim.</p> © 2026</body></html>""",
    "/modern/team": "<html><body><h1>Team</h1><p>Lisa, Stylistin</p></body></html>",
    "/modern/impressum": "<html><body>Impressum hallo@haarwerk-modern.de</body></html>",
    "/modern/datenschutz": "<html><body>Datenschutz</body></html>",
    # Salon mit Planity erst auf Unterseite, kaputtem Link
    "/termin/": """<html><head><title>Hair by Termin</title><meta name="viewport" content="width=device-width"></head>
      <body><a href="/termin/online-termin">Online-Termin</a><a href="/termin/kaputt">Galerie</a>
      <p>Öffnungszeiten Di-Sa 10:00-19:00. Preise auf Anfrage. Unser Team freut sich.</p>
      <a href="mailto:kontakt@hairbytermin.de">kontakt@hairbytermin.de</a>
      <a href="/termin/impressum">Impressum</a><a href="/termin/datenschutz">Datenschutz</a></body></html>""",
    "/termin/online-termin": '<html><body><iframe src="https://www.planity.com/hair-by-termin"></iframe></body></html>',
    "/termin/impressum": "<html><body>Impressum</body></html>",
    "/termin/datenschutz": "<html><body>Datenschutz</body></html>",
}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _antwort(self, code, body, ctype="text/html; charset=utf-8"):
        daten = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(daten)))
        self.end_headers()
        self.wfile.write(daten)

    def do_GET(self):
        pfad = self.path.split("?")[0]
        if pfad == "/nominatim/search":
            return self._antwort(200, json.dumps([{"lat": "50.11", "lon": "8.68"}]), "application/json")
        if pfad == "/nominatim/reverse":
            return self._antwort(200, json.dumps({"address": {"suburb": "Bornheim"}}), "application/json")
        if pfad in SEITEN:
            return self._antwort(200, SEITEN[pfad])
        self._antwort(404, "nicht gefunden")

    def do_POST(self):
        basis = f"http://127.0.0.1:{self.server.server_port}"
        el = lambda i, tags: {"type": "node", "id": i, "lat": 50.1, "lon": 8.7, "tags": tags}
        daten = {"elements": [
            el(1, {"name": "Salon Alt", "shop": "hairdresser", "website": basis + "/alt/", "phone": "069 123456",
                   "addr:street": "Berger Straße", "addr:housenumber": "1", "addr:postcode": "60316", "addr:city": "Frankfurt am Main"}),
            el(2, {"name": "Haarwerk Modern", "shop": "hairdresser", "website": basis + "/modern/",
                   "addr:postcode": "60385", "addr:city": "Frankfurt am Main"}),
            el(3, {"name": "Hair by Termin", "shop": "hairdresser", "contact:website": basis + "/termin/",
                   "addr:city": "Frankfurt am Main", "phone": "069 999"}),
            el(4, {"name": "Kein Web Salon", "shop": "hairdresser", "email": "keinweb@example-salon.de",
                   "contact:instagram": "keinwebsalon", "addr:city": "Frankfurt am Main"}),
            el(5, {"name": "Klier", "shop": "hairdresser", "brand": "Klier", "website": basis + "/modern/"}),
            el(6, {"name": "Nur Telefon", "shop": "hairdresser", "phone": "069 555"}),
            el(7, {"shop": "hairdresser"}),
        ]}
        self._antwort(200, json.dumps(daten), "application/json")


class FakeIMAP:
    instanzen = []

    def __init__(self, host, port, ssl_context=None):
        self.appends = []
        FakeIMAP.instanzen.append(self)

    def login(self, u, p):
        assert u == "cajus.webdesign@gmail.com" and p == "abcdefghijklmnop"
        return "OK", [b""]

    def list(self):
        return "OK", [b'(\\HasNoChildren) "/" "INBOX"', b'(\\HasNoChildren \\Drafts) "/" "[Gmail]/Entw&APw-rfe"',
                      b'(\\HasNoChildren \\Sent) "/" "[Gmail]/Gesendet"']

    def append(self, ordner, flags, datum, msg):
        self.appends.append((ordner, flags, msg))
        return "OK", [b""]

    def logout(self):
        pass

    def send(self, *a):  # darf nie benutzt werden
        raise AssertionError("send aufgerufen")


class EndToEnd(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        basis = f"http://127.0.0.1:{cls.server.server_port}"
        cls.tmp = tempfile.TemporaryDirectory()
        os.environ.update(CAJUS_DATA_DIR=cls.tmp.name, CAJUS_RATE="0", CAJUS_OVERPASS_URL=basis + "/overpass",
                          CAJUS_NOMINATIM_URL=basis + "/nominatim")
        import cajus_leads
        cls.cl = importlib.reload(cajus_leads)
        Path(cls.tmp.name, ".env").write_text("GMAIL_USER=cajus.webdesign@gmail.com\nGMAIL_APP_PASSWORD=abcd efgh ijkl mnop\n")

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        if os.environ.get("CAJUS_KEEP"):  # Ergebnisse zum Ansehen kopieren
            shutil.copytree(cls.tmp.name, os.environ["CAJUS_KEEP"], dirs_exist_ok=True)
        cls.tmp.cleanup()

    def run_cli(self, *args):
        out = io.StringIO()
        with redirect_stdout(out):
            self.cl.main(list(args))
        return out.getvalue()

    def leads(self):
        return {l["name"]: l for l in self.cl.lese_csv(self.cl.LEADS_CSV)}

    def test_website_aus_email(self):
        self.assertEqual(self.cl.website_aus_email("info@divinecut.de"), "https://divinecut.de")
        self.assertEqual(self.cl.website_aus_email("salon@gmx.de"), "")
        self.assertEqual(self.cl.website_aus_email(""), "")

    def test_ort_kurz(self):
        self.assertEqual(self.cl.ort_kurz("Frankfurt am Main"), "Frankfurt")
        self.assertEqual(self.cl.ort_kurz("Offenbach a. M."), "Offenbach")
        self.assertEqual(self.cl.ort_kurz("Hanau"), "Hanau")

    def test_ablauf(self):
        out = self.run_cli("suche", "--radius-km", "5")
        self.assertIn("1 Ketten ausgelassen", out)
        L = self.leads()
        self.assertEqual(set(L), {"Salon Alt", "Haarwerk Modern", "Hair by Termin", "Kein Web Salon", "Nur Telefon"})
        alt = L["Salon Alt"]
        self.assertEqual(alt["email"], "info@salon-alt.de")
        self.assertEqual(alt["email_quelle"], "Impressum")
        self.assertEqual(alt["baukasten"], "Jimdo")
        # 25 Baukasten + 15 HTTPS + 20 mobil + 10 Buchung + 10 Copyright + 5 E-Mail
        self.assertEqual(alt["score"], "85")
        self.assertEqual(L["Haarwerk Modern"]["online_buchung"], "Treatwell")
        self.assertEqual(L["Haarwerk Modern"]["score"], "20")  # kein HTTPS (lokal) + E-Mail
        self.assertEqual(L["Kein Web Salon"]["score"], "55")
        self.assertEqual(L["Nur Telefon"]["score"], "50")
        self.assertEqual(L["Kein Web Salon"]["instagram"], "https://www.instagram.com/keinwebsalon")
        ohne = {l["name"] for l in self.cl.lese_csv(self.cl.OHNE_EMAIL_CSV)}
        self.assertEqual(ohne, {"Nur Telefon"})

        out = self.run_cli("analyse", "--top", "20")
        o = Path(self.tmp.name, "outreach")
        a_alt = (o / "salon-alt" / "analyse.md").read_text()
        for erwartet in ("Kein viewport-Meta-Tag", "Keine Online-Terminbuchung", "Selbstcheck"):
            self.assertIn(erwartet, a_alt)
        a_term = (o / "hair-by-termin" / "analyse.md").read_text()
        self.assertIn("Planity (2 Klicks", a_term)
        self.assertIn("1 interne(r) Link(s) führen ins Leere", a_term)
        self.assertIn("Der Link „Galerie“ führt ins Leere", (o / "hair-by-termin" / "email.md").read_text())
        self.assertNotIn("Planity ist ein echtes Plus", (o / "hair-by-termin" / "email.md").read_text())

        mails = {}
        for d in o.iterdir():
            an, betr, body = self.cl.lies_email_md(d / "email.md")
            mails[d.name] = (an, betr, body)
            self.assertLessEqual(len(betr), 50, betr)
            text = body.split("\nViele Grüße")[0]
            self.assertLessEqual(self.cl.woerter(text), 150, d.name)
            self.assertIn(self.cl.ABSCHLUSS_FRAGE, body)
            self.assertTrue(body.endswith(self.cl.SIGNATUR))
            self.assertNotRegex(body, r"€|Preis(?!e|liste|übersicht)|kostet mich|Angebot")
            self.assertEqual(body.count("\n- "), 1 if d.name == "haarwerk-modern" else 3, d.name)
        self.assertIn("Friseur Bornheim", mails["kein-web-salon"][2])
        self.assertIn("Instagram", mails["kein-web-salon"][2])
        self.assertIn("Treatwell", mails["haarwerk-modern"][2])
        self.assertTrue(mails["haarwerk-modern"][1].startswith("Eine Idee"))
        # Keine zwei Mails mit identischem Einstieg
        intros = [b.split("\n\n")[1] for _, _, b in mails.values()]
        self.assertEqual(len(intros), len(set(intros)))

        # Handbearbeitete Mail wird nicht überschrieben
        p = o / "salon-alt" / "email.md"
        p.write_text(p.read_text().replace(self.cl.AUTO_MARKER + "\n", ""))
        self.run_cli("analyse", "--top", "20")
        self.assertNotIn(self.cl.AUTO_MARKER, p.read_text())

        out = self.run_cli("entwuerfe", "--top", "20", "--dry-run")
        self.assertIn("Testlauf", out)
        self.assertIn("Alfonso Zimmermann | Cajus Webdesign", out)
        self.assertFalse(self.cl.KONTAKTIERT_CSV.exists())

        with mock.patch.object(self.cl.imaplib, "IMAP4_SSL", FakeIMAP):
            out = self.run_cli("entwuerfe", "--top", "2")
        imap = FakeIMAP.instanzen[-1]
        self.assertEqual(len(imap.appends), 2)
        ordner, flags, roh = imap.appends[0]
        self.assertEqual(ordner, '"[Gmail]/Entw&APw-rfe"')
        self.assertEqual(flags, "(\\Draft)")
        self.assertIn(b"multipart/alternative", roh)
        self.assertIn(b"text/html", roh)
        self.assertIn(b"info@cajus-webdesign.com", roh)

        # Zweiter Lauf: keine Duplikate, nur die restlichen
        with mock.patch.object(self.cl.imaplib, "IMAP4_SSL", FakeIMAP):
            self.run_cli("entwuerfe", "--top", "20")
        empf = [m[2] for m in FakeIMAP.instanzen[-1].appends]
        self.assertEqual(len(empf), 2)
        with mock.patch.object(self.cl.imaplib, "IMAP4_SSL", FakeIMAP):
            out = self.run_cli("entwuerfe", "--top", "20")
        self.assertIn("Keine neuen Entwürfe", out)

        self.run_cli("markiere", "haarwerk", "interesse")
        out = self.run_cli("status")
        self.assertIn("INTERESSE", out)
        self.assertEqual(self.leads()["Haarwerk Modern"]["status"], "interesse")
        k = {r["name"]: r for r in self.cl.lese_csv(self.cl.KONTAKTIERT_CSV)}
        self.assertIn("entwurf", k["Haarwerk Modern"]["verlauf"])
        self.assertIn("interesse", k["Haarwerk Modern"]["verlauf"])

        # Neue Suche behält Status
        self.run_cli("suche")
        self.assertEqual(self.leads()["Haarwerk Modern"]["status"], "interesse")


if __name__ == "__main__":
    unittest.main()
