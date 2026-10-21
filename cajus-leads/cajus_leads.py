#!/usr/bin/env python3
"""cajus-leads – Lead-Akquise für Cajus Webdesign (Websites für Friseursalons).

Befehle:
  suche      Friseursalons über OpenStreetMap finden, Vorab-Check + Score
  analyse    Top-Leads genauer prüfen, analyse.md + email.md schreiben
  entwuerfe  E-Mails als Gmail-Entwürfe anlegen (sendet NIE)
  markiere   Status eines Leads setzen
  status     Übersicht nach Status

Nur Python-Standardbibliothek, keine kostenpflichtigen Dienste.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import html
import imaplib
import json
import os
import re
import ssl
import sys
import time
import unicodedata
import urllib.error
import urllib.request
from datetime import date, datetime
from email.message import EmailMessage
from email.utils import formataddr, formatdate, make_msgid
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlencode, urljoin, urlparse

# ---------------------------------------------------------------------------
# Einstellungen
# ---------------------------------------------------------------------------

DATA_DIR = Path(os.environ.get("CAJUS_DATA_DIR") or Path(__file__).resolve().parent)
LEADS_CSV = DATA_DIR / "leads.csv"
OHNE_EMAIL_CSV = DATA_DIR / "ohne_email.csv"
KONTAKTIERT_CSV = DATA_DIR / "kontaktiert.csv"
OUTREACH_DIR = DATA_DIR / "outreach"
ENV_DATEI = DATA_DIR / ".env"

ABSENDER_NAME = "Alfonso Zimmermann"
ABSENDER_FIRMA = "Cajus Webdesign"
ABSENDER_EMAIL = "info@cajus-webdesign.com"
SIGNATUR = f"{ABSENDER_NAME}\n{ABSENDER_FIRMA}\n{ABSENDER_EMAIL}"
ABSCHLUSS_FRAGE = "Hätten Sie Interesse, dass ich Ihnen unverbindlich zeige, wie das aussehen könnte?"

USER_AGENT = f"Mozilla/5.0 (compatible; cajus-leads/1.0; +mailto:{ABSENDER_EMAIL})"
RATE_SEKUNDEN = float(os.environ.get("CAJUS_RATE", "1.0"))  # 1 Request pro Sekunde
TIMEOUT = 10  # Sekunden pro Website-Abruf
OVERPASS_TIMEOUT = 60  # Overpass braucht für große Radien manchmal länger
MAX_BYTES = 3_000_000

OVERPASS_URLS = [u for u in os.environ.get("CAJUS_OVERPASS_URL", "").split(",") if u] or [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]
# Overpass lehnt manche Browser-ähnlichen Kennungen ab (HTTP 406) → eigene, klare Kennung
OVERPASS_HEADERS = {"User-Agent": f"cajus-leads/1.0 ({ABSENDER_EMAIL})", "Accept": "application/json, */*"}
NOMINATIM_URL = os.environ.get("CAJUS_NOMINATIM_URL", "https://nominatim.openstreetmap.org")

# Scoring (0–100) laut Vorgabe
SCORE = {
    "keine_website": 50,
    "baukasten": 25,
    "kein_https": 15,
    "nicht_mobil": 20,
    "keine_buchung": 10,
    "copyright_alt": 10,
    "email_vorhanden": 5,
}

BAUKASTEN = {
    "Jimdo": r"jimdo|jimcdn",
    "Wix": r"wix\.com|wixstatic|wixsite",
    "Webnode": r"webnode",
    "Weebly": r"weebly",
    "Strato": r"cm4all|strato-?(?:website|sitebuilder|homepage|baukasten)",
}

BUCHUNG = {
    "Treatwell": r"treatwell\.",
    "Planity": r"planity\.com",
    "Shore": r"shore\.com|connect\.shore",
    "Calendly": r"calendly\.com",
    "Studiobookr": r"studiobookr",
    "Salonkee": r"salonkee",
    "Booksy": r"booksy\.com",
    "Fresha": r"fresha\.com",
    "Timify": r"timify\.com",
    "eTermin": r"etermin\.net",
    "Phorest": r"phorest",
    "Salonized": r"salonized",
}

STOCK = r"shutterstock|istockphoto|istock|adobestock|stock\.adobe|fotolia|depositphotos|123rf|pexels|unsplash|pixabay|gettyimages|dreamstime"
BEWERTUNG = r"bewertung|rezension|kundenstimmen|trustindex|provenexpert|elfsight|google-reviews|writereview|★★★|sterne"
CORONA = r"\bcorona|covid|2g[- ]regel|3g[- ]regel|maskenpflicht"

STATUS_WERTE = ["entwurf", "gesendet", "antwort", "interesse", "abschluss", "absage"]

LEAD_FELDER = [
    "id", "name", "adresse", "plz", "ort", "stadtteil", "telefon", "email", "email_quelle",
    "website", "instagram", "facebook", "oeffnungszeiten", "lat", "lon",
    "score", "score_details", "https", "mobil", "baukasten", "online_buchung", "copyright_jahr",
    "website_status", "befunde", "positiv", "status", "ordner", "gefunden_am", "analysiert_am",
]
KONTAKT_FELDER = ["id", "name", "email", "status", "datum", "verlauf"]
OHNE_EMAIL_FELDER = ["name", "adresse", "telefon", "website", "instagram", "oeffnungszeiten", "score", "status"]

AUTO_MARKER = "<!-- automatisch erstellt von cajus-leads – wird bei neuem 'analyse' überschrieben. Diese Zeile löschen, um Ihre Änderungen zu schützen. -->"


# ---------------------------------------------------------------------------
# HTTP mit Rate-Limit
# ---------------------------------------------------------------------------

class Antwort:
    def __init__(self, url, status=0, text="", sekunden=0.0, groesse=0, fehler=""):
        self.url, self.status, self.text = url, status, text
        self.sekunden, self.groesse, self.fehler = sekunden, groesse, fehler

    @property
    def ok(self):
        return 200 <= self.status < 400 and not self.fehler


def _ssl_kontext():
    try:
        import certifi  # optional, hilft auf manchen Macs
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()


class Http:
    def __init__(self, rate=RATE_SEKUNDEN, timeout=TIMEOUT):
        self.rate, self.timeout = rate, timeout
        self._letzter = 0.0
        self.ctx = _ssl_kontext()

    def _warte(self):
        rest = self.rate - (time.monotonic() - self._letzter)
        if rest > 0:
            time.sleep(rest)
        self._letzter = time.monotonic()

    def get(self, url, data=None, timeout=None, headers=None) -> Antwort:
        self._warte()
        kopf = {"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
                "Accept-Language": "de-DE,de;q=0.9"}
        kopf.update(headers or {})
        req = urllib.request.Request(url, data=data, headers=kopf)
        t0 = time.monotonic()
        try:
            with urllib.request.urlopen(req, timeout=timeout or self.timeout, context=self.ctx) as r:
                roh = r.read(MAX_BYTES)
                return Antwort(r.geturl(), r.status, _dekodiere(roh, r.headers.get_content_charset()),
                               time.monotonic() - t0, len(roh))
        except urllib.error.HTTPError as e:
            return Antwort(url, e.code, "", time.monotonic() - t0, 0, f"HTTP {e.code}")
        except Exception as e:  # Timeout, DNS, SSL …
            return Antwort(url, 0, "", time.monotonic() - t0, 0, f"{type(e).__name__}: {e}"[:200])


def _dekodiere(roh: bytes, charset: str | None) -> str:
    if not charset:
        m = re.search(rb'<meta[^>]+charset=["\']?([\w-]+)', roh[:4000], re.I)
        charset = m.group(1).decode() if m else "utf-8"
    try:
        return roh.decode(charset, errors="replace")
    except LookupError:
        return roh.decode("utf-8", errors="replace")


# ---------------------------------------------------------------------------
# HTML-Auswertung
# ---------------------------------------------------------------------------

class Seite(HTMLParser):
    """Zieht Titel, Meta-Tags, Links, Bilder, Skripte und sichtbaren Text aus einer Seite."""

    def __init__(self, html_text: str, url: str):
        super().__init__(convert_charrefs=True)
        self.url, self.html = url, html_text
        self.title, self.meta = "", {}
        self.links, self.imgs, self.scripts, self.iframes, self._texte = [], [], [], [], []
        self._skip, self._in_title, self._a = 0, False, None
        try:
            self.feed(html_text)
        except Exception:
            pass
        self.text = re.sub(r"\s+", " ", " ".join(self._texte)).strip()

    def handle_starttag(self, tag, attrs):
        a = {k.lower(): (v or "") for k, v in attrs}
        if tag in ("script", "style", "noscript", "template"):
            self._skip += 1
            if tag == "script" and a.get("src"):
                self.scripts.append(a["src"])
        elif tag == "title":
            self._in_title = True
        elif tag == "meta":
            key = (a.get("name") or a.get("property") or "").lower()
            if key:
                self.meta[key] = a.get("content", "")
        elif tag == "a":
            self._a = {"href": a.get("href", "").strip(), "text": a.get("aria-label", "") or a.get("title", "")}
            self.links.append(self._a)
        elif tag == "img":
            self.imgs.append({"src": a.get("src") or a.get("data-src", ""), "alt": a.get("alt", "")})
        elif tag in ("iframe", "frame"):
            self.iframes.append(a.get("src", ""))

    def handle_startendtag(self, tag, attrs):
        if tag not in ("script", "style", "noscript", "template", "a", "title"):
            self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript", "template"):
            self._skip = max(0, self._skip - 1)
        elif tag == "title":
            self._in_title = False
        elif tag == "a":
            self._a = None

    def handle_data(self, data):
        if self._skip:
            return
        if self._in_title:
            self.title += data
            return
        self._texte.append(data)
        if self._a is not None:
            self._a["text"] = (self._a["text"] + " " + data).strip()

    def abs_links(self):
        return [(urljoin(self.url, l["href"]), l["text"]) for l in self.links if l["href"]]

    def finde_link(self, muster: str):
        for ziel, text in self.abs_links():
            if re.search(muster, ziel, re.I) or re.search(muster, text, re.I):
                if not ziel.lower().startswith(("mailto:", "tel:", "javascript:")):
                    return ziel
        return None


EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}")
EMAIL_MUELL = re.compile(r"\.(png|jpe?g|gif|svg|webp)$|example\.|sentry|wixpress|domain\.|@2x|^(name|email|ihre|your|max\.mustermann)@", re.I)


def extrahiere_emails(seite: Seite) -> list[str]:
    funde = []
    for l in seite.links:
        if l["href"].lower().startswith("mailto:"):
            funde.append(l["href"][7:].split("?")[0])
    text = seite.text
    text = re.sub(r"\s*[\[\(\{]\s*(?:at|ät|@)\s*[\]\)\}]\s*", "@", text, flags=re.I)
    text = re.sub(r"\s*[\[\(\{]\s*(?:dot|punkt)\s*[\]\)\}]\s*", ".", text, flags=re.I)
    funde += EMAIL_RE.findall(text)
    sauber = []
    for e in funde:
        e = urllib.request.unquote(e).strip().strip(".").lower()
        if EMAIL_RE.fullmatch(e) and not EMAIL_MUELL.search(e) and e not in sauber:
            sauber.append(e)
    return sauber


def beste_email(emails: list[str], website: str) -> str:
    if not emails:
        return ""
    host = urlparse(website).hostname or ""
    domain = ".".join(host.split(".")[-2:])
    for e in emails:
        if domain and e.endswith("@" + domain) or (domain and e.split("@")[1].endswith(domain)):
            return e
    return emails[0]


def finde_instagram(seite: Seite) -> str:
    for ziel, _ in seite.abs_links():
        m = re.match(r"https?://(?:www\.)?instagram\.com/([A-Za-z0-9_.]+)", ziel)
        if m and m.group(1).lower() not in ("p", "explore", "accounts", "reel"):
            return f"https://www.instagram.com/{m.group(1)}"
    return ""


def norm_url(url: str) -> str:
    url = (url or "").strip().split()[0] if (url or "").strip() else ""
    if url and not re.match(r"https?://", url, re.I):
        url = "https://" + url.lstrip("/")
    return url


def instagram_url(wert: str) -> str:
    wert = (wert or "").strip()
    if not wert:
        return ""
    if wert.startswith("http"):
        return wert
    return "https://www.instagram.com/" + wert.lstrip("@")


# ---------------------------------------------------------------------------
# Datenhaltung (CSV mit ; für deutsches Excel)
# ---------------------------------------------------------------------------

def lese_csv(pfad: Path) -> list[dict]:
    if not pfad.exists():
        return []
    with pfad.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f, delimiter=";"))


def schreibe_csv(pfad: Path, felder: list[str], zeilen: list[dict]):
    pfad.parent.mkdir(parents=True, exist_ok=True)
    tmp = pfad.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=felder, delimiter=";", extrasaction="ignore")
        w.writeheader()
        for z in zeilen:
            w.writerow({k: z.get(k, "") for k in felder})
    tmp.replace(pfad)


def sortiert(leads: list[dict]) -> list[dict]:
    return sorted(leads, key=lambda l: (-int(l.get("score") or 0), l.get("name", "").lower()))


def speichere_leads(leads: list[dict]):
    leads = sortiert(leads)
    schreibe_csv(LEADS_CSV, LEAD_FELDER, leads)
    schreibe_csv(OHNE_EMAIL_CSV, OHNE_EMAIL_FELDER, [l for l in leads if not l.get("email")])


def kontaktiert_index() -> tuple[set, set]:
    ids, mails = set(), set()
    for k in lese_csv(KONTAKTIERT_CSV):
        ids.add(k["id"])
        if k.get("email"):
            mails.add(k["email"].lower())
    return ids, mails


def ist_kontaktiert(lead: dict, ids: set, mails: set) -> bool:
    return lead["id"] in ids or (lead.get("email") and lead["email"].lower() in mails)


def slug(text: str) -> str:
    text = text.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")[:60] or "salon"


def vergib_ordner(leads: list[dict]):
    belegt = {l["ordner"] for l in leads if l.get("ordner")}
    for l in leads:
        if l.get("ordner"):
            continue
        basis = slug(l["name"])
        kandidat = basis
        if kandidat in belegt:
            kandidat = f"{basis}-{slug(l.get('plz') or '')}".strip("-")
        n = 2
        while kandidat in belegt:
            kandidat = f"{basis}-{n}"
            n += 1
        l["ordner"] = kandidat
        belegt.add(kandidat)


# ---------------------------------------------------------------------------
# 1. SUCHE
# ---------------------------------------------------------------------------

def geocode(http: Http, stadt: str) -> tuple[float, float]:
    url = f"{NOMINATIM_URL}/search?" + urlencode({"q": stadt, "format": "jsonv2", "limit": 1})
    a = http.get(url, timeout=20)
    if not a.ok:
        sys.exit(f"Fehler: Stadt '{stadt}' konnte nicht nachgeschlagen werden ({a.fehler}).")
    daten = json.loads(a.text or "[]")
    if not daten:
        sys.exit(f"Fehler: Stadt '{stadt}' nicht gefunden. Schreibweise prüfen.")
    return float(daten[0]["lat"]), float(daten[0]["lon"])


def overpass(http: Http, lat: float, lon: float, radius_m: int) -> list[dict]:
    query = (f'[out:json][timeout:{OVERPASS_TIMEOUT}];'
             f'nwr["shop"="hairdresser"](around:{radius_m},{lat},{lon});out center tags;')
    for url in OVERPASS_URLS:
        a = http.get(url, data=urlencode({"data": query}).encode(), timeout=OVERPASS_TIMEOUT + 10,
                     headers=OVERPASS_HEADERS)
        if not a.ok and 400 <= a.status < 500:  # manche Server wollen GET statt POST
            a = http.get(url + "?" + urlencode({"data": query}), timeout=OVERPASS_TIMEOUT + 10,
                         headers=OVERPASS_HEADERS)
        if a.ok:
            try:
                return json.loads(a.text)["elements"]
            except (ValueError, KeyError):
                pass
        print(f"  Overpass-Server {urlparse(url).hostname} nicht erreichbar ({a.fehler or 'ungültige Antwort'}), versuche nächsten …")
    sys.exit("Fehler: Kein Overpass-Server erreichbar. Bitte in ein paar Minuten erneut versuchen.")


def lead_aus_osm(el: dict) -> dict | None:
    t = el.get("tags", {})
    name = (t.get("name") or "").strip()
    if not name:
        return None
    strasse = " ".join(x for x in (t.get("addr:street", ""), t.get("addr:housenumber", "")) if x)
    plz, ort = t.get("addr:postcode", ""), t.get("addr:city", "")
    lat = el.get("lat") or el.get("center", {}).get("lat", "")
    lon = el.get("lon") or el.get("center", {}).get("lon", "")
    email = (t.get("email") or t.get("contact:email") or "").split(";")[0].strip().lower()
    return {
        "id": f"{el['type'][0]}{el['id']}",
        "name": name,
        "adresse": ", ".join(x for x in (strasse, f"{plz} {ort}".strip()) if x),
        "plz": plz, "ort": ort,
        "stadtteil": t.get("addr:suburb", ""),
        "telefon": (t.get("phone") or t.get("contact:phone") or t.get("contact:mobile") or "").split(";")[0].strip(),
        "email": email, "email_quelle": "OSM" if email else "",
        "website": norm_url((t.get("website") or t.get("contact:website") or t.get("url") or "").split(";")[0]),
        "instagram": instagram_url(t.get("contact:instagram") or t.get("instagram") or ""),
        "facebook": t.get("contact:facebook") or t.get("facebook") or "",
        "oeffnungszeiten": t.get("opening_hours", ""),
        "lat": lat, "lon": lon,
        "_kette": bool(t.get("brand") or t.get("brand:wikidata")),
    }


FREEMAIL = {"gmail.com", "googlemail.com", "gmx.de", "gmx.net", "gmx.at", "web.de", "t-online.de", "yahoo.com",
            "yahoo.de", "hotmail.com", "hotmail.de", "outlook.com", "outlook.de", "live.de", "live.com", "icloud.com",
            "me.com", "aol.com", "aol.de", "freenet.de", "arcor.de", "posteo.de", "mail.de", "online.de", "yandex.com",
            "protonmail.com", "proton.me", "email.de", "kabelmail.de", "vodafone.de", "1und1.de"}


def website_aus_email(email: str) -> str:
    """info@salon-xy.de → https://salon-xy.de (nicht bei Gmail, GMX & Co.)."""
    domain = email.split("@")[-1].lower() if "@" in email else ""
    return f"https://{domain}" if domain and domain not in FREEMAIL else ""


def hole_startseite(http: Http, website: str) -> Antwort:
    a = http.get(website)
    if not a.ok and website.startswith("https://"):
        b = http.get("http://" + website[8:])
        if b.ok:
            return b
    return a


def vorab_check(http: Http, lead: dict) -> None:
    """Startseite (+ ggf. Impressum) abrufen, Merkmale + Score setzen."""
    for k in ("https", "mobil", "baukasten", "online_buchung", "copyright_jahr", "website_status"):
        lead[k] = ""
    # In OSM fehlt oft nur der Website-Eintrag: eigene E-Mail-Domain → Website dort versuchen
    if not lead["website"] and website_aus_email(lead.get("email", "")):
        versuch = website_aus_email(lead["email"])
        if hole_startseite(http, versuch).ok:
            lead["website"] = versuch
    if lead["website"]:
        a = hole_startseite(http, lead["website"])
        if not a.ok:
            lead["website_status"] = f"nicht erreichbar ({a.fehler})"
        else:
            lead["website_status"] = "ok"
            s = Seite(a.text, a.url)
            roh = a.text.lower() + " " + a.url.lower()
            lead["https"] = "ja" if a.url.startswith("https://") else "nein"
            lead["mobil"] = "ja" if "viewport" in s.meta else "nein"
            lead["baukasten"] = next((n for n, m in BAUKASTEN.items() if re.search(m, roh)), "")
            lead["online_buchung"] = next((n for n, m in BUCHUNG.items() if re.search(m, roh)), "")
            lead["copyright_jahr"] = str(copyright_jahr(s.text) or "")
            if not lead["instagram"]:
                lead["instagram"] = finde_instagram(s)
            if not lead["email"]:
                emails = extrahiere_emails(s)
                quelle = "Website"
                if not emails:
                    imp = s.finde_link(r"impressum") or urljoin(a.url, "/impressum")
                    b = http.get(imp)
                    if b.ok:
                        emails = extrahiere_emails(Seite(b.text, b.url))
                        quelle = "Impressum"
                if emails:
                    lead["email"], lead["email_quelle"] = beste_email(emails, a.url), quelle
    berechne_score(lead)


def copyright_jahr(text: str) -> int | None:
    jahre = [int(j) for j in re.findall(r"(?:©|\(c\)|copyright)\s*(?:\d{4}\s*[-–]\s*)?((?:19|20)\d{2})", text, re.I)]
    return max(jahre) if jahre else None


def berechne_score(lead: dict) -> None:
    punkte, gruende = 0, []

    def plus(key, text):
        nonlocal punkte
        punkte += SCORE[key]
        gruende.append(f"{text} +{SCORE[key]}")

    if not lead["website"]:
        plus("keine_website", "keine Website")
    elif lead.get("website_status") == "ok":
        if lead["baukasten"]:
            plus("baukasten", f"Baukasten {lead['baukasten']}")
        if lead["https"] == "nein":
            plus("kein_https", "kein HTTPS")
        if lead["mobil"] == "nein":
            plus("nicht_mobil", "nicht mobil")
        if not lead["online_buchung"]:
            plus("keine_buchung", "keine Online-Buchung")
        if lead["copyright_jahr"] and int(lead["copyright_jahr"]) < date.today().year - 3:
            plus("copyright_alt", f"Copyright {lead['copyright_jahr']}")
    else:
        gruende.append("Website nicht erreichbar – manuell prüfen")
    if lead.get("email"):
        plus("email_vorhanden", "E-Mail vorhanden")
    lead["score"] = str(min(punkte, 100))
    lead["score_details"] = ", ".join(gruende)


def cmd_suche(args):
    http = Http()
    print(f"Suche Friseursalons im Umkreis von {args.radius_km} km um {args.stadt} …")
    lat, lon = geocode(http, args.stadt)
    elemente = overpass(http, lat, lon, int(args.radius_km * 1000))
    print(f"  {len(elemente)} Einträge in OpenStreetMap gefunden.")

    alt = {l["id"]: l for l in lese_csv(LEADS_CSV)}
    neu, ketten = [], 0
    for el in elemente:
        lead = lead_aus_osm(el)
        if not lead:
            continue
        if lead.pop("_kette") and not args.mit_ketten:
            ketten += 1
            continue
        neu.append(lead)
    if args.limit:
        neu = neu[: args.limit]
    print(f"  {len(neu)} Salons mit Namen ({ketten} Ketten ausgelassen). Prüfe Websites (1 Abruf/Sek.) …")

    heute = date.today().isoformat()
    for i, lead in enumerate(neu, 1):
        vorher = alt.get(lead["id"], {})
        # Bereits gefundene E-Mail/Instagram nicht wieder verlieren
        for k in ("email", "email_quelle", "instagram", "stadtteil"):
            if not lead.get(k) and vorher.get(k):
                lead[k] = vorher[k]
        vorab_check(http, lead)
        for k in ("befunde", "positiv", "status", "ordner", "analysiert_am"):
            lead[k] = vorher.get(k, "")
        lead["status"] = lead["status"] or "neu"
        lead["gefunden_am"] = vorher.get("gefunden_am") or heute
        alt[lead["id"]] = lead
        print(f"  [{i}/{len(neu)}] {lead['name'][:40]:40} Score {lead['score']:>3}  {lead['email'] or '-'}")

    leads = list(alt.values())
    vergib_ordner(leads)
    speichere_leads(leads)
    mit_mail = sum(1 for l in leads if l.get("email"))
    print(f"\nFertig: {len(leads)} Leads in leads.csv ({mit_mail} mit E-Mail, {len(leads) - mit_mail} in ohne_email.csv).")
    print("Top 10:")
    for l in sortiert(leads)[:10]:
        print(f"  {l['score']:>3}  {l['name'][:40]:40} {l['email'] or '(keine E-Mail)'}")


# ---------------------------------------------------------------------------
# 3. ANALYSE
# ---------------------------------------------------------------------------

def reverse_stadtteil(http: Http, lead: dict) -> str:
    if not (lead.get("lat") and lead.get("lon")):
        return ""
    url = f"{NOMINATIM_URL}/reverse?" + urlencode({"lat": lead["lat"], "lon": lead["lon"], "format": "jsonv2", "zoom": 16})
    a = http.get(url)
    if not a.ok:
        return ""
    try:
        adr = json.loads(a.text).get("address", {})
    except ValueError:
        return ""
    return adr.get("suburb") or adr.get("city_district") or adr.get("quarter") or ""


def befund(key, kategorie, gewicht, text, beleg, sicher=True, **werte):
    return {"key": key, "kategorie": kategorie, "gewicht": gewicht, "text": text,
            "beleg": beleg, "sicher": sicher, "werte": werte}


def analysiere_website(http: Http, lead: dict) -> dict:
    """Ruft Startseite + wichtige Unterseiten ab und sammelt Befunde mit Beleg."""
    erg = {"seiten": [], "befunde": [], "positiv": [], "checks": {}}
    a = hole_startseite(http, lead["website"])
    if not a.ok:
        erg["fehler"] = a.fehler
        return erg
    home = Seite(a.text, a.url)
    erg["seiten"].append(("Startseite", a.url))
    roh_home = a.text.lower()
    host = urlparse(a.url).hostname

    unterseiten = {}
    for name, muster in (("Impressum", r"impressum"), ("Datenschutz", r"datenschutz|privacy"),
                         ("Kontakt", r"kontakt|contact"), ("Preise", r"preis|price|leistung"),
                         ("Team", r"\bteam\b|ueber-uns|über uns|about")):
        ziel = home.finde_link(muster)
        if ziel and urlparse(ziel).hostname == host and ziel.split("#")[0] != a.url.split("#")[0]:
            if ziel in [u for u, _ in unterseiten.values()]:
                continue
            b = http.get(ziel)
            if b.ok:
                unterseiten[name] = (b.url, Seite(b.text, b.url))
                erg["seiten"].append((name, b.url))

    alle = [home] + [s for _, s in unterseiten.values()]
    gesamt_text = " ".join(s.text for s in alle)
    gesamt_links = " ".join(f"{u} {t}" for s in alle for u, t in s.abs_links())
    wenig_text = len(home.text) < 300  # Seite wird per JavaScript aufgebaut → Inhalte unsicher
    c = erg["checks"]
    ort = lead.get("ort") or ""
    stadtteil = lead.get("stadtteil") or ""

    # --- Mobil
    c["Viewport-Meta"] = "ja" if "viewport" in home.meta else "nein"
    feste_breite = re.findall(r'width\s*[=:]\s*["\']?(\d{3,4})(?:px)?', a.text, re.I)
    feste_breite = [int(w) for w in feste_breite if int(w) >= 900]
    kleine_schrift = re.findall(r"font-size\s*:\s*(?:[5-9]|1[01])px", a.text, re.I)
    c["Feste Breiten ≥900px"] = str(len(feste_breite))
    c["Schrift <12px"] = str(len(kleine_schrift))
    if "viewport" not in home.meta:
        erg["befunde"].append(befund("nicht_mobil", "Mobil", 95,
            "Kein viewport-Meta-Tag: Auf dem Handy wird die Desktop-Ansicht verkleinert angezeigt, Text ist ohne Zoomen kaum lesbar.",
            "<meta name=\"viewport\"> fehlt im Quelltext der Startseite"))
    elif len(feste_breite) >= 2 or len(kleine_schrift) >= 3:
        erg["befunde"].append(befund("feste_breite", "Mobil", 70,
            "Feste Breiten bzw. sehr kleine Schrift: Auf dem Handy muss man vermutlich seitlich scrollen oder zoomen.",
            f"{len(feste_breite)} feste Breiten ≥900px, {len(kleine_schrift)}× Schrift unter 12px", sicher=False))
    tel_link = any(l["href"].lower().startswith("tel:") for s in alle for l in s.links)
    c["Telefon antippbar (tel:)"] = "ja" if tel_link else "nein"
    if not tel_link and lead.get("telefon"):
        erg["befunde"].append(befund("kein_tel_link", "Mobil", 40,
            "Telefonnummer ist kein tel:-Link – am Handy nicht antippbar.", "kein href=\"tel:…\" auf den geprüften Seiten"))

    # --- Buchung
    anbieter_home = next((n for n, m in BUCHUNG.items() if re.search(m, roh_home)), "")
    anbieter, klicks = anbieter_home, (1 if anbieter_home else 0)
    if not anbieter:
        termin = home.finde_link(r"termin|buchen|booking|reserv")
        if termin:
            b = http.get(termin)
            if b.ok:
                gefunden = next((n for n, m in BUCHUNG.items() if re.search(m, b.text.lower() + b.url.lower())), "")
                if gefunden:
                    anbieter, klicks = gefunden, 2
                erg["seiten"].append(("Termin", b.url))
    generisch = re.search(r"online[- ]?termin|termin online|online buchen|jetzt buchen", gesamt_text + gesamt_links, re.I)
    c["Online-Buchung"] = f"{anbieter} ({klicks} Klick{'s' if klicks > 1 else ''} bis zum Buchungstool)" if anbieter else (
        "Hinweis auf Online-Buchung, Anbieter unklar" if generisch else "nein – nur Telefon/E-Mail")
    if anbieter:
        if klicks >= 2:
            erg["befunde"].append(befund("buchung_versteckt", "Buchung", 65,
                f"Online-Buchung über {anbieter} gibt es, aber erst nach {klicks} Klicks – nicht direkt auf der Startseite.",
                f"{anbieter} nicht auf der Startseite, erst auf der Termin-Unterseite", anbieter=anbieter, klicks=klicks))
        erg["positiv"].append(befund("buchung_da", "Buchung", 90, f"Online-Buchung über {anbieter} ist eingebunden.",
                                     f"{anbieter} im Quelltext", anbieter=anbieter))
    elif not generisch:
        erg["befunde"].append(befund("keine_buchung", "Buchung", 100,
            "Keine Online-Terminbuchung – Termine nur per Telefon. Außerhalb der Öffnungszeiten geht niemand ran.",
            "kein Buchungsanbieter und kein Buchungslink auf den geprüften Seiten", sicher=not wenig_text))

    # --- Inhalte
    euro = len(re.findall(r"\d+(?:[.,]\d{2})?\s?(?:€|eur\b)|€\s?\d+", gesamt_text, re.I))
    preis_pdf = re.search(r"preis[^\"' ]*\.pdf", gesamt_links, re.I)
    c["Preisangaben (€-Beträge)"] = str(euro) + (" + Preis-PDF" if preis_pdf else "")
    if euro >= 3 or preis_pdf:
        erg["positiv"].append(befund("preise_da", "Inhalte", 70, "Preise stehen offen auf der Seite.", f"{euro} €-Beträge"))
    elif not re.search(r"preis", gesamt_text + gesamt_links, re.I):
        erg["befunde"].append(befund("keine_preise", "Inhalte", 75,
            "Keine Preisliste – Interessenten müssen anrufen, um zu erfahren, was ein Schnitt kostet.",
            "weder €-Beträge noch das Wort „Preis“ auf den geprüften Seiten", sicher=not wenig_text))
    leistungen = re.findall(r"schnitt|färb|farbe|strähn|balayage|föhn|dauerwelle|hochsteck|bart|glätt|extension|kerat", gesamt_text, re.I)
    c["Leistungs-Begriffe"] = str(len(set(w.lower() for w in leistungen)))
    zeiten = re.search(r"öffnungszeit|(?:mo|di|mi|do|fr|sa)[a-z]*\.?\s*(?:[-–]\s*(?:mo|di|mi|do|fr|sa)[a-z]*\.?)?\s*:?\s*\d{1,2}[:.]\d{2}", gesamt_text, re.I)
    c["Öffnungszeiten"] = "ja" if zeiten else "nein"
    if zeiten:
        erg["positiv"].append(befund("zeiten_da", "Inhalte", 50, "Öffnungszeiten sind angegeben.", zeiten.group(0)[:40]))
    else:
        erg["befunde"].append(befund("keine_zeiten", "Inhalte", 80,
            "Keine Öffnungszeiten auf der Seite gefunden.", "kein Treffer für „Öffnungszeiten“ oder Tag + Uhrzeit",
            sicher=not wenig_text))
    team = re.search(r"\bteam\b|mitarbeiter|stylist", gesamt_text + gesamt_links, re.I)
    c["Team vorgestellt"] = "ja" if team else "nein"
    if team and "Team" in unterseiten:
        erg["positiv"].append(befund("team_da", "Inhalte", 40, "Das Team wird vorgestellt.", unterseiten["Team"][0]))
    elif not team:
        erg["befunde"].append(befund("kein_team", "Inhalte", 30, "Team/Stylisten werden nicht vorgestellt.",
                                     "kein „Team“/„Mitarbeiter“ auf den geprüften Seiten", sicher=not wenig_text))
    jahr = copyright_jahr(gesamt_text)
    c["Copyright-Jahr"] = str(jahr or "–")
    corona = re.search(CORONA, gesamt_text, re.I)
    c["Corona-Hinweis"] = "ja" if corona else "nein"
    if corona:
        erg["befunde"].append(befund("veraltet", "Inhalte", 55,
            "Auf der Seite steht noch ein Corona-Hinweis – wirkt nicht gepflegt.", f"Textstelle: „{corona.group(0)}“",
            hinweis="ein Corona-Hinweis"))
    elif jahr and jahr < date.today().year - 3:
        erg["befunde"].append(befund("veraltet", "Inhalte", 45,
            f"Copyright {jahr} im Fußbereich – Seite wirkt seit Jahren nicht aktualisiert.", f"© {jahr}",
            hinweis=f"ein Copyright von {jahr}"))

    # --- Vertrauen
    stock = [i["src"] for s in alle for i in s.imgs if re.search(STOCK, i["src"] + " " + i["alt"], re.I)]
    c["Bilder (Startseite)"] = str(len(home.imgs))
    c["Stockfoto-Hinweise"] = str(len(stock))
    if stock:
        erg["befunde"].append(befund("stockfotos", "Vertrauen", 50, "Bilder aus Bilddatenbanken statt eigener Salonfotos.",
                                     f"z. B. {stock[0][:80]}"))
    elif len(home.imgs) >= 5:
        erg["positiv"].append(befund("eigene_fotos", "Vertrauen", 30, "Viele Bilder, keine Stock-Hinweise – vermutlich eigene Fotos.",
                                     f"{len(home.imgs)} Bilder", sicher=False))
    bew = re.search(BEWERTUNG, a.text, re.I) or re.search(BEWERTUNG, gesamt_text, re.I)
    c["Bewertungen eingebunden"] = "ja" if bew else "nein"
    if bew:
        erg["positiv"].append(befund("bewertungen_da", "Vertrauen", 60, "Kundenbewertungen sind eingebunden.", bew.group(0)))
    else:
        erg["befunde"].append(befund("keine_bewertungen", "Vertrauen", 55, "Keine Kundenbewertungen auf der Seite.",
                                     "kein Bewertungs-Widget und kein Bewertungstext gefunden", sicher=not wenig_text))

    # --- Technik
    c["HTTPS"] = "ja" if a.url.startswith("https://") else "nein"
    c["Ladezeit Startseite"] = f"{a.sekunden:.1f} s ({a.groesse // 1024} KB HTML)"
    if not a.url.startswith("https://"):
        erg["befunde"].append(befund("kein_https", "Technik", 60,
            "Kein HTTPS – Browser zeigen „Nicht sicher“ neben der Adresse.", f"Seite läuft unter {a.url}"))
    if a.sekunden > 5:
        erg["befunde"].append(befund("langsam", "Technik", 70, f"Startseite lädt langsam (ca. {a.sekunden:.0f} s nur für das HTML).",
                                     f"gemessen: {a.sekunden:.1f} s", sekunden=f"{a.sekunden:.0f}"))
    elif a.sekunden < 1.5 and a.url.startswith("https://") and "viewport" in home.meta:
        erg["positiv"].append(befund("technik_gut", "Technik", 35, "Seite ist verschlüsselt, mobil angepasst und lädt schnell.",
                                     f"{a.sekunden:.1f} s, HTTPS, viewport"))
    werbung = re.search(r"(erstellt|gemacht|powered|created)\s+(mit|by|with)\s+(jimdo|wix|webnode|weebly|strato)"
                        r"|diese (?:seite|website) wurde mit (?:wix|jimdo)|kostenlos erstellt", home.text + " " + a.text, re.I)
    baukasten = next((n for n, m in BAUKASTEN.items() if re.search(m, roh_home + a.url.lower())), "")
    c["Baukasten"] = baukasten or "nein"
    c["Baukasten-Werbung"] = werbung.group(0) if werbung else "nein"
    if werbung:
        erg["befunde"].append(befund("baukasten_werbung", "Technik", 50, f"Sichtbare Werbung des Baukastens: „{werbung.group(0)}“.",
                                     werbung.group(0), baukasten=baukasten or (werbung.group(3) or "Baukasten").capitalize()))
    kaputt = []
    intern = []
    for ziel, text in home.abs_links():
        z = ziel.split("#")[0]
        if urlparse(z).hostname == host and z != a.url and z not in [u for u, _ in intern] and \
                not re.search(r"\.(jpg|jpeg|png|pdf|gif|webp)$", z, re.I):
            intern.append((z, text))
    geprueft = {u for u, _ in unterseiten.values()}
    for z, text in intern[:6]:
        if z in geprueft:
            continue
        b = http.get(z)
        if b.status >= 400 or (b.status == 0 and "Timeout" not in b.fehler):
            kaputt.append((z, text or z))
    c["Kaputte Links (von max. 6 geprüften)"] = str(len(kaputt))
    if kaputt:
        erg["befunde"].append(befund("kaputte_links", "Technik", 45, f"{len(kaputt)} interne(r) Link(s) führen ins Leere.",
                                     ", ".join(z for z, _ in kaputt[:3]), anzahl=len(kaputt), beispiel=kaputt[0][1][:40],
                                     links_text=(f"Der Link „{(kaputt[0][1] or 'Menü')[:40]}“ führt ins Leere" if len(kaputt) == 1
                                                 else f"{len(kaputt)} Links führen ins Leere, z. B. „{kaputt[0][1][:40]}“")))

    # --- Auffindbarkeit
    title = re.sub(r"\s+", " ", home.title).strip()
    desc = home.meta.get("description", "").strip()
    c["Title"] = title or "(leer)"
    c["Meta-Description"] = desc[:120] or "(fehlt)"
    ortsnamen = [o for o in (ort, stadtteil) if o]
    if not title or (ortsnamen and not any(o.lower() in title.lower() for o in ortsnamen)):
        erg["befunde"].append(befund("title_schwach", "Auffindbarkeit", 40,
            f"Seitentitel „{title or '(leer)'}“ enthält weder Stadt noch Stadtteil.", f"<title>{title}</title>",
            title=title or lead["name"], ort=stadtteil or ort or "Ihrer Stadt"))
    if not desc:
        erg["befunde"].append(befund("keine_description", "Auffindbarkeit", 35,
            "Keine Meta-Description – Google zeigt einen zufälligen Textausschnitt.", "<meta name=\"description\"> fehlt"))
    if stadtteil:
        c[f"Stadtteil „{stadtteil}“ im Text"] = "ja" if stadtteil.lower() in gesamt_text.lower() else "nein"
        if stadtteil.lower() not in gesamt_text.lower() and stadtteil.lower() not in title.lower():
            erg["befunde"].append(befund("stadtteil_fehlt", "Auffindbarkeit", 38,
                f"Der Stadtteil „{stadtteil}“ kommt auf der Seite nicht vor.", "Textsuche auf allen geprüften Seiten",
                sicher=not wenig_text, stadtteil=stadtteil))

    # --- Recht
    imp = "Impressum" in unterseiten or re.search(r"impressum", gesamt_links, re.I)
    ds = "Datenschutz" in unterseiten or re.search(r"datenschutz|privacy", gesamt_links, re.I)
    c["Impressum"] = "ja" if imp else "nein"
    c["Datenschutzerklärung"] = "ja" if ds else "nein"
    if not imp or not ds:
        fehlt = " und ".join(x for x, da in (("ein Impressum", imp), ("eine Datenschutzerklärung", ds)) if not da)
        erg["befunde"].append(befund("recht", "Recht", 58, f"Nicht gefunden: {fehlt}.", "kein entsprechender Link",
                                     sicher=not wenig_text, fehlt=fehlt))

    if lead.get("instagram"):
        erg["positiv"].append(befund("instagram_da", "Vertrauen", 20, "Instagram ist verlinkt/bekannt.", lead["instagram"]))
    c["Seite per JavaScript aufgebaut (Inhalte unsicher)"] = "ja" if wenig_text else "nein"
    return erg


def waehle(erg: dict) -> tuple[list, dict | None]:
    """Selbstcheck: nur Befunde mit Beleg und sicher=True; die 3 schwersten + 1 echtes Plus."""
    gesehen, top = set(), []
    for b in sorted(erg["befunde"], key=lambda b: -b["gewicht"]):
        if b["sicher"] and b["beleg"] and b["key"] not in gesehen:
            top.append(b)
            gesehen.add(b["key"])
    # Kein Lob für etwas, das gleichzeitig als Problem genannt wird (z. B. Buchung da, aber versteckt)
    themen = {b["kategorie"] for b in top[:3]}
    plus = [p for p in sorted(erg["positiv"], key=lambda p: -p["gewicht"]) if p["sicher"]]
    plus = [p for p in plus if p["kategorie"] not in themen] or plus
    return top[:3], (plus[0] if plus else None)


# ---------------------------------------------------------------------------
# 4. E-MAIL-TEXTE (Variantenpool, je Lauf möglichst keine Wiederholung)
# ---------------------------------------------------------------------------

ANREDE = ["Guten Tag,", "Hallo Team von {salon},", "Guten Tag an das Team von {salon},", "Hallo zusammen,"]

INTRO = [
    "mein Name ist Alfonso Zimmermann, ich gestalte Websites für Friseursalons und habe mir die Seite von {salon} genauer angesehen.",
    "ich bin Alfonso Zimmermann von Cajus Webdesign und habe mir in den letzten Tagen die Website von {salon} angeschaut.",
    "ich heiße Alfonso Zimmermann, baue Websites für Salons und habe mir {domain} in Ruhe angesehen.",
    "als Webdesigner für Friseure im Raum {stadt} habe ich mir Ihre Website angesehen – mein Name ist Alfonso Zimmermann.",
    "Alfonso Zimmermann hier, ich mache Websites für Friseursalons und war gerade auf {domain} unterwegs.",
]
INTRO_OHNE = [
    "mein Name ist Alfonso Zimmermann, ich baue Websites für Friseursalons und habe online nach {salon} gesucht, aber keine eigene Website gefunden.",
    "ich bin Alfonso Zimmermann von Cajus Webdesign und wollte mir die Website von {salon} ansehen – dabei habe ich gemerkt, dass es keine gibt.",
    "als Webdesigner für Friseure in {stadt} habe ich nach {salon} gesucht und keine eigene Website gefunden – ich heiße Alfonso Zimmermann.",
]
UEBERLEITUNG = ["Drei Dinge sind mir aufgefallen:", "Dabei habe ich drei Ideen notiert:",
                "Drei Punkte würde ich mir zuerst vornehmen:", "Mir sind drei Stellen aufgefallen:"]

PUNKTE = {
    "keine_buchung": [
        "Termine gibt es nur per Telefon. Ein Button „Termin buchen“ oben auf der Startseite – dann buchen Kundinnen auch abends, wenn der Salon zu ist.",
        "Wer einen Termin will, muss anrufen. Mit Online-Buchung auf der Startseite geht keine Anfrage verloren, während Sie gerade schneiden.",
        "Eine Online-Terminbuchung fehlt. Oben gut sichtbar eingebaut, bucht man in einer Minute – auch sonntags, ohne dass Ihr Telefon klingelt.",
    ],
    "buchung_versteckt": [
        "Die Buchung über {anbieter} ist erst nach {klicks} Klicks zu finden. Ein Buchungsbutton direkt oben auf der Startseite – so bricht niemand unterwegs ab.",
        "Ihr {anbieter}-Termin ist gut versteckt. Ein Button „Jetzt buchen“, der beim Scrollen sichtbar bleibt, macht aus Besuchern schneller Kunden.",
    ],
    "nicht_mobil": [
        "Auf dem Handy passt sich die Seite nicht an, man muss zoomen und schieben. Eine mobile Version hilft – die meisten suchen ihren Friseur heute am Smartphone.",
        "Die Seite ist nicht fürs Smartphone gebaut, Text und Buttons werden winzig. Mobil optimiert finden Kunden Telefonnummer und Termin mit einem Daumen.",
        "Am Handy erscheint die Desktop-Ansicht im Miniformat. Eine Handy-Version mit großen Schaltflächen sorgt dafür, dass Besucher nicht gleich wegklicken.",
    ],
    "feste_breite": [
        "Auf dem Handy ist die Seite teils breiter als der Bildschirm. Ein flexibles Layout macht alles ohne Zoomen lesbar – dort sucht die Mehrheit nach einem Friseur.",
    ],
    "keine_preise": [
        "Eine Preisliste habe ich nicht gefunden. Schon eine einfache Übersicht nimmt Neukunden die Unsicherheit und spart Ihnen Anrufe mit „Was kostet …?“.",
        "Preise fehlen auf der Seite. Bereits „Damenschnitt ab …“ reicht, damit sich neue Kundinnen trauen, einen Termin zu machen.",
        "Was ein Schnitt oder eine Farbe kostet, steht nirgends. Eine kurze Preisliste ist für viele der Grund, genau diesen Salon zu wählen.",
    ],
    "keine_zeiten": [
        "Öffnungszeiten habe ich nicht gefunden. Gut sichtbar oben oder ganz unten – dann steht niemand vor verschlossener Tür.",
        "Die Öffnungszeiten fehlen. Direkt auf der Startseite wissen Besucher sofort, ob sie heute noch vorbeikommen können.",
    ],
    "langsam": [
        "Die Startseite brauchte bei mir rund {sekunden} Sekunden. Mit verkleinerten Bildern lädt sie deutlich schneller – am Handy wartet kaum jemand so lange.",
        "Das Laden dauert etwa {sekunden} Sekunden. Eine schnellere Seite hält Besucher, und Google zeigt sie lieber an.",
    ],
    "kein_https": [
        "Die Seite läuft ohne Verschlüsselung, der Browser zeigt „Nicht sicher“. Ein kostenloses Zertifikat entfernt diese Warnung, die viele abschreckt.",
        "Neben Ihrer Adresse steht im Browser „Nicht sicher“. Mit HTTPS verschwindet der Hinweis – das wirkt sofort vertrauenswürdiger.",
    ],
    "baukasten_werbung": [
        "Auf der Seite steht Werbung von {baukasten}. Ohne diesen Hinweis wirkt der Auftritt so professionell wie Ihr Salon.",
        "Der {baukasten}-Hinweis fällt auf. Ein Auftritt ohne fremde Werbung lenkt den Blick auf Ihre Arbeit statt auf den Baukasten.",
    ],
    "keine_bewertungen": [
        "Kundenbewertungen sieht man auf der Seite nicht. Ein paar echte Google-Bewertungen auf der Startseite überzeugen Neukunden schneller als jeder Text.",
        "Was Ihre Stammkunden über Sie sagen, steht nirgends. Eingebundene Bewertungen geben Neuen den letzten Schubs, bei Ihnen zu buchen.",
    ],
    "stockfotos": [
        "Einige Bilder stammen aus Bilddatenbanken. Echte Fotos aus Ihrem Salon zeigen, was Kunden bei Ihnen wirklich erwartet.",
        "Manche Fotos sind Stockbilder. Eigene Bilder von Team und Frisuren schaffen mehr Vertrauen als austauschbare Models.",
    ],
    "kaputte_links": [
        "{links_text}. Repariert springt niemand mehr genervt ab.",
        "Der Link „{beispiel}“ zeigt eine Fehlerseite. Funktionierende Menüpunkte halten Besucher auf der Seite.",
    ],
    "veraltet": [
        "Auf der Seite steht noch {hinweis}. Ein kurzes Update zeigt, dass der Salon aktiv ist – sonst fragen sich Besucher, ob die Angaben noch stimmen.",
        "Mir ist {hinweis} aufgefallen. Aktuelle Inhalte wirken gepflegt und schaffen Vertrauen, bevor jemand anruft.",
    ],
    "title_schwach": [
        "In Google erscheint als Titel nur „{title}“. Mit „Friseur {ort}“ im Titel finden Sie mehr Menschen, die genau das suchen.",
        "Ihr Seitentitel „{title}“ verrät Google nicht, wo Sie sind. Ergänzt um „Friseur {ort}“ tauchen Sie bei lokalen Suchen weiter oben auf.",
    ],
    "keine_description": [
        "Für Google fehlt eine Kurzbeschreibung der Seite. Zwei gute Sätze dort bringen mehr Klicks aus den Suchergebnissen.",
    ],
    "stadtteil_fehlt": [
        "„{stadtteil}“ kommt auf der Seite nicht vor. Wer „Friseur {stadtteil}“ googelt, findet Sie leichter, wenn der Stadtteil im Text steht.",
        "Der Stadtteil {stadtteil} wird nirgends genannt. Ein Satz dazu hilft Google, Sie Menschen aus der Nachbarschaft zu zeigen.",
    ],
    "kein_tel_link": [
        "Die Telefonnummer lässt sich am Handy nicht antippen. Als Anruf-Button erreicht man Sie mit einem Tipp, statt die Nummer abzuschreiben.",
    ],
    "recht": [
        "Ich habe {fehlt} nicht gefunden. Das gehört auf jede Seite und schafft zusätzlich Vertrauen.",
    ],
    "kein_team": [
        "Ihr Team stellt sich nicht vor. Fotos und Namen machen den ersten Besuch persönlicher – viele buchen gezielt bei einer Person.",
    ],
}
PUNKTE_OHNE = {
    "google": [
        "Wer „Friseur {stadtteil}“ bei Google sucht, landet bei Salons mit Website. Mit einer eigenen Seite tauchen Sie dort ebenfalls auf.",
        "Neue Kunden suchen „Friseur {stadtteil}“ und klicken auf die Salons mit Website. Eine eigene Seite holt diese Suchenden zu Ihnen.",
    ],
    "buchung": [
        "Ohne Website gibt es keinen Platz für einen Buchungsbutton. Eine eigene Seite nimmt Termine auch an, wenn der Salon geschlossen ist.",
        "Termine laufen derzeit vermutlich nur übers Telefon. Mit Online-Buchung auf einer eigenen Seite buchen Kunden auch abends.",
    ],
    "instagram": [
        "Ihre Arbeiten auf Instagram können auf der Website als Galerie erscheinen – mit Preisen und Termin-Button direkt daneben.",
    ],
    "infos": [
        "Preise, Leistungen und Öffnungszeiten auf einer Seite beantworten die häufigsten Fragen, bevor jemand anrufen muss.",
    ],
}
LOB = {
    "buchung_da": ["Gut gefällt mir, dass man bei Ihnen schon online über {anbieter} buchen kann.",
                   "Die Online-Buchung über {anbieter} ist ein echtes Plus – das haben viele Salons noch nicht."],
    "preise_da": ["Gut finde ich, dass Ihre Preise offen auf der Seite stehen.",
                  "Stark, dass Sie Ihre Preise offen zeigen – das machen längst nicht alle."],
    "bewertungen_da": ["Schön, dass Sie Kundenbewertungen direkt auf der Seite zeigen."],
    "zeiten_da": ["Ihre Öffnungszeiten findet man schnell, das ist gut gelöst.",
                  "Positiv: Die Öffnungszeiten stehen klar auf der Seite."],
    "team_da": ["Dass sich Ihr Team auf der Seite vorstellt, macht den Salon sympathisch."],
    "technik_gut": ["Technisch ist die Seite solide: verschlüsselt, handytauglich und schnell."],
    "instagram_da": ["Gut, dass Ihr Instagram-Kanal direkt verlinkt ist."],
    "fallback": ["Gut, dass Sie eine eigene Website haben – das ist längst nicht bei allen Salons so."],
    "ohne_instagram": ["Dass Sie auf Instagram vertreten sind, ist schon ein guter Anfang."],
    "ohne_telefon": ["Gut, dass man Sie telefonisch direkt erreicht."],
    "ohne_fallback": ["Ihr Salon ist bereits auf Karten online eingetragen – darauf lässt sich gut aufbauen."],
}


class Varianten:
    """Wählt pro Lead eine Formulierung; innerhalb eines Laufs werden Wiederholungen vermieden."""

    def __init__(self):
        self.benutzt: dict[str, set] = {}

    def nimm(self, key: str, liste: list[str], seed: str) -> str:
        start = int(hashlib.md5(seed.encode()).hexdigest(), 16) % len(liste)
        benutzt = self.benutzt.setdefault(key, set())
        if len(benutzt) >= len(liste):
            benutzt.clear()
        for i in range(len(liste)):
            idx = (start + i) % len(liste)
            if idx not in benutzt:
                benutzt.add(idx)
                return liste[idx]
        return liste[start]


def kurz_salon(name: str, max_len: int) -> str:
    return name if len(name) <= max_len else name[: max_len - 1].rstrip() + "…"


def betreff(lead: dict, ohne_website: bool, v: Varianten, anzahl: int = 3) -> str:
    if ohne_website:
        vorlagen = ["Website-Idee für {salon}", "{salon} bei Google finden", "Eine Idee für {salon}"]
    elif anzahl == 1:
        vorlagen = ["Eine Idee für die Website von {salon}", "Ihre Website: eine Idee für {salon}"]
    else:
        n = {2: "2", 3: "3"}.get(anzahl, "Ein paar")
        vorlagen = [f"{n} Ideen für die Website von {{salon}}", f"{n} Ideen für {{salon}}", f"Ihre Website: {n} Ideen für {{salon}}"]
    vorlage = v.nimm(f"betreff{ohne_website}{anzahl}", vorlagen, lead["id"])
    platz = 50 - len(vorlage.replace("{salon}", ""))
    return vorlage.format(salon=kurz_salon(lead["name"], platz))


def woerter(text: str) -> int:
    return len(re.findall(r"\S+", text))


def schreibe_email(lead: dict, top: list, plus: dict | None, v: Varianten, ohne_website=False) -> tuple[str, str]:
    seed = lead["id"]
    domain = urlparse(lead.get("website", "")).hostname or ""
    felder = {"salon": lead["name"], "domain": domain.removeprefix("www."), "stadt": lead.get("ort") or "Ihrer Stadt",
              "stadtteil": lead.get("stadtteil") or lead.get("ort") or "in der Nähe"}
    anrede = v.nimm("anrede", ANREDE, seed).format(**felder)
    if ohne_website:
        intro = v.nimm("intro_ohne", INTRO_OHNE, seed).format(**felder)
        keys = ["google", "buchung", "instagram" if lead.get("instagram") else "infos"]
        punkte = [v.nimm("o_" + k, PUNKTE_OHNE[k], seed + k).format(**felder) for k in keys]
        lob_key = "ohne_instagram" if lead.get("instagram") else ("ohne_telefon" if lead.get("telefon") else "ohne_fallback")
        lob = v.nimm(lob_key, LOB[lob_key], seed).format(**felder)
    else:
        intro = v.nimm("intro", INTRO, seed).format(**felder)
        punkte = [v.nimm(b["key"], PUNKTE[b["key"]], seed + b["key"]).format(**{**felder, **b["werte"]}) for b in top]
        lob_key = plus["key"] if plus and plus["key"] in LOB else "fallback"
        lob = v.nimm(lob_key, LOB[lob_key], seed).format(**{**felder, **(plus["werte"] if plus else {})})
    ueberleitung = v.nimm("ueberleitung", UEBERLEITUNG, seed)
    if len(punkte) < 3:
        ueberleitung = {1: "Ein Punkt ist mir aufgefallen:", 2: "Zwei Punkte sind mir aufgefallen:"}.get(len(punkte), "")
    teile = [anrede, "", intro, ""]
    if punkte:
        teile += [ueberleitung, ""] + [f"- {p}" for p in punkte] + [""]
    teile += [lob, "", ABSCHLUSS_FRAGE]
    text = "\n".join(teile)
    # Notbremse für die 150-Wörter-Grenze: notfalls Überleitung streichen
    if woerter(text) > 150 and ueberleitung:
        text = text.replace(ueberleitung + "\n\n", "")
    return betreff(lead, ohne_website, v, len(punkte)), text + "\n\nViele Grüße\n" + SIGNATUR


def schreibe_analyse_md(lead, erg, top, plus, ohne_website) -> str:
    z = [f"# Analyse: {lead['name']}", "",
         f"- Adresse: {lead.get('adresse') or '–'}", f"- Stadtteil: {lead.get('stadtteil') or '–'}",
         f"- Telefon: {lead.get('telefon') or '–'}", f"- E-Mail: {lead.get('email') or '–'} ({lead.get('email_quelle') or '–'})",
         f"- Website: {lead.get('website') or 'keine'}", f"- Instagram: {lead.get('instagram') or '–'}",
         f"- Score: {lead.get('score')} ({lead.get('score_details')})", f"- Analysiert: {datetime.now():%d.%m.%Y %H:%M}", ""]
    if ohne_website:
        such = urlencode({"q": f"{lead['name']} {lead.get('adresse', '')}"})
        z += ["## Online-Präsenz ohne Website", "",
              f"- Google Maps (bitte kurz selbst ansehen): https://www.google.com/maps/search/?api=1&{such}",
              f"- Instagram: {lead.get('instagram') or 'nicht bekannt'}",
              f"- Facebook: {lead.get('facebook') or 'nicht bekannt'}",
              f"- Öffnungszeiten laut OpenStreetMap: {lead.get('oeffnungszeiten') or 'nicht eingetragen'}", "",
              "## Aufhänger", "",
              f"Kunden suchen „Friseur {lead.get('stadtteil') or lead.get('ort')}“ bei Google und landen bei Salons mit Website.", ""]
        return "\n".join(z)
    if erg.get("fehler"):
        return "\n".join(z + [f"**Website nicht erreichbar:** {erg['fehler']}", ""])
    z += ["## Geprüfte Seiten", ""] + [f"- {n}: {u}" for n, u in erg["seiten"]] + ["", "## Prüfpunkte", "",
          "| Prüfpunkt | Ergebnis |", "|---|---|"]
    z += [f"| {k} | {str(v).replace('|', '/')} |" for k, v in erg["checks"].items()]
    z += ["", "## Alle Befunde", ""]
    for b in sorted(erg["befunde"], key=lambda b: -b["gewicht"]):
        z.append(f"- [{b['kategorie']}] {b['text']} _(Beleg: {b['beleg']}; {'sicher' if b['sicher'] else 'unsicher → nicht verwendet'})_")
    z += ["", "## Die 3 wichtigsten Befunde (kosten am meisten Kunden/Termine)", ""]
    z += [f"{i}. **{b['kategorie']}:** {b['text']}" for i, b in enumerate(top, 1)] or ["(keine sicheren Befunde)"]
    z += ["", "## Das ist wirklich gut", "", plus["text"] if plus else "(nichts eindeutig Positives belegt – allgemeines Lob verwendet)",
          "", "## Selbstcheck", ""]
    z += [f"- {b['kategorie']}: trifft zu, weil {b['beleg']} ✔" for b in top]
    if plus:
        z.append(f"- Lob: trifft zu, weil {plus['beleg']} ✔")
    weg = [b for b in erg["befunde"] if not b["sicher"]]
    if weg:
        z.append(f"- Weggelassen (unsicher): {', '.join(b['kategorie'] + '/' + b['key'] for b in weg)}")
    return "\n".join(z) + "\n"


def ist_auto(pfad: Path) -> bool:
    return not pfad.exists() or AUTO_MARKER in pfad.read_text(encoding="utf-8")


def cmd_analyse(args):
    leads = lese_csv(LEADS_CSV)
    if not leads:
        sys.exit("Noch keine Leads. Zuerst: python cajus_leads.py suche")
    ids, mails = kontaktiert_index()
    kandidaten = [l for l in sortiert(leads) if not ist_kontaktiert(l, ids, mails) and (args.alle or l.get("email"))]
    auswahl = kandidaten[: args.top]
    print(f"Analysiere {len(auswahl)} Leads (1 Abruf/Sek., ca. 10–15 Sek. pro Website) …")
    http, v = Http(), Varianten()
    vergib_ordner(leads)
    index = {l["id"]: l for l in leads}
    for i, lead in enumerate(auswahl, 1):
        lead = index[lead["id"]]
        ordner = OUTREACH_DIR / lead["ordner"]
        ordner.mkdir(parents=True, exist_ok=True)
        if not lead.get("stadtteil"):
            lead["stadtteil"] = reverse_stadtteil(http, lead)
        ohne_website = not lead.get("website")
        erg = {"befunde": [], "positiv": [], "checks": {}, "seiten": []} if ohne_website else analysiere_website(http, lead)
        top, plus = waehle(erg)
        (ordner / "analyse.md").write_text(schreibe_analyse_md(lead, erg, top, plus, ohne_website), encoding="utf-8")
        lead["befunde"] = " | ".join(b["text"] for b in top)
        lead["positiv"] = plus["text"] if plus else ""
        lead["analysiert_am"] = date.today().isoformat()
        email_pfad = ordner / "email.md"
        if erg.get("fehler"):
            info = "Website nicht erreichbar – keine E-Mail erstellt"
        elif not ist_auto(email_pfad):
            info = "email.md von Hand bearbeitet – nicht überschrieben"
        else:
            sub, body = schreibe_email(lead, top, plus, v, ohne_website)
            email_pfad.write_text(f"{AUTO_MARKER}\nAn: {lead.get('email', '')}\nBetreff: {sub}\n\n{body}\n", encoding="utf-8")
            info = f"{woerter(body.split(chr(10) + 'Viele Grüße')[0])} Wörter"
            if ohne_website:
                info += " – KEINE Website laut OpenStreetMap: vor dem Senden kurz googeln!"
        print(f"  [{i}/{len(auswahl)}] {lead['name'][:40]:40} → outreach/{lead['ordner']}/  ({info})")
    speichere_leads(list(index.values()))
    print("\nFertig. Bitte jede email.md kurz lesen, bevor Sie Entwürfe anlegen.")


# ---------------------------------------------------------------------------
# 5. GMAIL-ENTWÜRFE
# ---------------------------------------------------------------------------

def lade_env() -> dict:
    werte = {}
    if ENV_DATEI.exists():
        for zeile in ENV_DATEI.read_text(encoding="utf-8").splitlines():
            zeile = zeile.strip()
            if zeile and not zeile.startswith("#") and "=" in zeile:
                k, w = zeile.split("=", 1)
                werte[k.strip()] = w.strip().strip('"').strip("'")
    return {**werte, **{k: os.environ[k] for k in ("GMAIL_USER", "GMAIL_APP_PASSWORD") if os.environ.get(k)}}


def lies_email_md(pfad: Path) -> tuple[str, str, str]:
    kopf, _, body = pfad.read_text(encoding="utf-8").partition("\n\n")
    an = betr = ""
    for zeile in kopf.splitlines():
        if zeile.lower().startswith("an:"):
            an = zeile[3:].strip()
        elif zeile.lower().startswith("betreff:"):
            betr = zeile[8:].strip()
    return an, betr, body.strip()


def als_html(text: str) -> str:
    bloecke, out = text.split("\n\n"), []
    for b in bloecke:
        zeilen = b.splitlines()
        if zeilen and all(z.startswith("- ") for z in zeilen):
            out.append("<ul>" + "".join(f"<li>{html.escape(z[2:])}</li>" for z in zeilen) + "</ul>")
        else:
            out.append("<p>" + "<br>".join(html.escape(z) for z in zeilen) + "</p>")
    return ('<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">'
            + "".join(out) + "</div>")


def baue_mail(an: str, betr: str, body: str) -> EmailMessage:
    msg = EmailMessage()
    msg["From"] = formataddr((f"{ABSENDER_NAME} | {ABSENDER_FIRMA}", ABSENDER_EMAIL))
    msg["To"] = an
    msg["Subject"] = betr
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="cajus-webdesign.com")
    msg.set_content(body)
    msg.add_alternative(als_html(body), subtype="html")
    return msg


def finde_entwurfsordner(imap) -> str:
    _, daten = imap.list()
    namen = []
    for roh in daten or []:
        zeile = roh.decode("utf-8", "replace") if isinstance(roh, bytes) else str(roh)
        m = re.match(r'\((?P<flags>[^)]*)\)\s+(?:"[^"]*"|NIL)\s+(?P<name>.+)$', zeile)
        if not m:
            continue
        name = m["name"].strip()
        if name.startswith('"') and name.endswith('"'):
            name = name[1:-1]
        if "\\drafts" in m["flags"].lower():
            return name
        namen.append(name)
    for kandidat in ("[Gmail]/Drafts", "[Gmail]/Entw&APw-rfe", "[Google Mail]/Entw&APw-rfe", "[Google Mail]/Drafts"):
        if kandidat in namen:
            return kandidat
    raise RuntimeError(f"Entwürfe-Ordner nicht gefunden. Vorhandene Ordner: {namen}")


def cmd_entwuerfe(args):
    leads = lese_csv(LEADS_CSV)
    ids, mails = kontaktiert_index()
    plan = []
    for l in sortiert(leads):
        if len(plan) >= args.top:
            break
        if not l.get("email") or ist_kontaktiert(l, ids, mails):
            continue
        pfad = OUTREACH_DIR / (l.get("ordner") or "-") / "email.md"
        if not pfad.exists():
            print(f"  übersprungen: {l['name']} – noch keine email.md (erst 'analyse' ausführen)")
            continue
        an, betr, body = lies_email_md(pfad)
        if not an or not betr or not body:
            print(f"  übersprungen: {l['name']} – email.md unvollständig (An/Betreff/Text)")
            continue
        if an.lower() in mails:
            continue
        mails.add(an.lower())
        plan.append((l, baue_mail(an, betr, body)))

    if not plan:
        print("Keine neuen Entwürfe anzulegen.")
        return
    if args.dry_run:
        for l, msg in plan:
            print("=" * 70)
            print(f"Von:     {msg['From']}\nAn:      {msg['To']}\nBetreff: {msg['Subject']}\n")
            print(msg.get_body(("plain",)).get_content().rstrip())
        print("=" * 70)
        print(f"\n{len(plan)} Entwürfe (Testlauf – nichts angelegt, nichts gesendet).")
        return

    env = lade_env()
    user, pw = env.get("GMAIL_USER"), (env.get("GMAIL_APP_PASSWORD") or "").replace(" ", "")
    if not user or not pw:
        sys.exit("Fehler: GMAIL_USER und GMAIL_APP_PASSWORD fehlen in der Datei .env (siehe README).")
    imap = imaplib.IMAP4_SSL("imap.gmail.com", 993, ssl_context=_ssl_kontext())
    try:
        imap.login(user, pw)
    except imaplib.IMAP4.error as e:
        sys.exit(f"Gmail-Login fehlgeschlagen ({e}). App-Passwort prüfen (siehe README).")
    try:
        ordner = finde_entwurfsordner(imap)
        kontakte = lese_csv(KONTAKTIERT_CSV)
        jetzt = datetime.now().strftime("%Y-%m-%d %H:%M")
        for l, msg in plan:
            # Nur APPEND in den Entwürfe-Ordner – es wird NICHTS gesendet.
            typ, _ = imap.append(f'"{ordner}"', "(\\Draft)", imaplib.Time2Internaldate(time.time()), msg.as_bytes())
            if typ != "OK":
                print(f"  Fehler bei {l['name']}: {typ}")
                continue
            kontakte.append({"id": l["id"], "name": l["name"], "email": msg["To"], "status": "entwurf",
                             "datum": jetzt, "verlauf": f"{jetzt} entwurf"})
            l["status"] = "entwurf"
            print(f"  Entwurf angelegt: {l['name']} <{msg['To']}>")
            schreibe_csv(KONTAKTIERT_CSV, KONTAKT_FELDER, kontakte)
        speichere_leads(leads)
    finally:
        try:
            imap.logout()
        except Exception:
            pass
    print(f"\nFertig. Entwürfe liegen in Gmail unter „Entwürfe“. Gesendet wurde nichts.")


# ---------------------------------------------------------------------------
# 6. TRACKING
# ---------------------------------------------------------------------------

def cmd_markiere(args):
    leads = lese_csv(LEADS_CSV)
    such = args.name.lower().strip()
    treffer = [l for l in leads if l["name"].lower() == such] or \
              [l for l in leads if such in l["name"].lower() or such == (l.get("email") or "").lower()]
    if not treffer:
        sys.exit(f"Kein Lead gefunden für „{args.name}“.")
    if len(treffer) > 1:
        print(f"Mehrere Treffer für „{args.name}“ – bitte genauer angeben:")
        for l in treffer:
            print(f"  {l['name']}  ({l.get('adresse')})")
        sys.exit(1)
    lead = treffer[0]
    jetzt = datetime.now().strftime("%Y-%m-%d %H:%M")
    kontakte = lese_csv(KONTAKTIERT_CSV)
    k = next((k for k in kontakte if k["id"] == lead["id"]), None)
    if not k:
        k = {"id": lead["id"], "name": lead["name"], "email": lead.get("email", ""), "verlauf": ""}
        kontakte.append(k)
    k["status"], k["datum"] = args.status, jetzt
    k["verlauf"] = (k.get("verlauf", "") + f"; {jetzt} {args.status}").strip("; ")
    lead["status"] = args.status
    schreibe_csv(KONTAKTIERT_CSV, KONTAKT_FELDER, kontakte)
    speichere_leads(leads)
    print(f"{lead['name']} → {args.status}")


def cmd_status(args):
    leads = lese_csv(LEADS_CSV)
    if not leads:
        sys.exit("Noch keine Leads. Zuerst: python cajus_leads.py suche")
    reihenfolge = ["neu"] + STATUS_WERTE
    gruppen: dict[str, list] = {}
    for l in leads:
        gruppen.setdefault(l.get("status") or "neu", []).append(l)
    mit_mail = sum(1 for l in leads if l.get("email"))
    print(f"Leads gesamt: {len(leads)}  (mit E-Mail: {mit_mail}, ohne: {len(leads) - mit_mail})\n")
    for s in reihenfolge + [s for s in gruppen if s not in reihenfolge]:
        print(f"  {s:10} {len(gruppen.get(s, [])):>4}")
    for s in STATUS_WERTE[::-1]:
        if gruppen.get(s):
            print(f"\n{s.upper()}:")
            for l in sortiert(gruppen[s]):
                print(f"  {l['name'][:40]:40} {l.get('email') or l.get('telefon') or ''}")


# ---------------------------------------------------------------------------

def main(argv=None):
    p = argparse.ArgumentParser(prog="cajus_leads.py", description="Lead-Akquise für Cajus Webdesign (Friseursalons)")
    sub = p.add_subparsers(dest="befehl", required=True)

    s = sub.add_parser("suche", help="Friseursalons finden und vorab bewerten")
    s.add_argument("--stadt", default="Frankfurt am Main")
    s.add_argument("--radius-km", type=float, default=10)
    s.add_argument("--limit", type=int, default=0, help="nur die ersten N Salons prüfen (zum Testen)")
    s.add_argument("--mit-ketten", action="store_true", help="auch Ketten (Klier, Super Cut …) aufnehmen")
    s.set_defaults(func=cmd_suche)

    a = sub.add_parser("analyse", help="Top-Leads analysieren, analyse.md + email.md schreiben")
    a.add_argument("--top", type=int, default=20)
    a.add_argument("--alle", action="store_true", help="auch Leads ohne E-Mail analysieren")
    a.set_defaults(func=cmd_analyse)

    e = sub.add_parser("entwuerfe", help="Gmail-Entwürfe anlegen (sendet nie)")
    e.add_argument("--top", type=int, default=20)
    e.add_argument("--dry-run", action="store_true", help="nur im Terminal anzeigen")
    e.set_defaults(func=cmd_entwuerfe)

    m = sub.add_parser("markiere", help="Status setzen")
    m.add_argument("name")
    m.add_argument("status", choices=STATUS_WERTE)
    m.set_defaults(func=cmd_markiere)

    st = sub.add_parser("status", help="Übersicht nach Status")
    st.set_defaults(func=cmd_status)

    args = p.parse_args(argv)
    if sys.stdout.encoding and sys.stdout.encoding.lower() not in ("utf-8", "utf8"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    args.func(args)


if __name__ == "__main__":
    main()
