import { LegalLayout } from "@/components/legal/legal-layout";

export const metadata = { title: "Impressum" };

export default function ImpressumPage() {
  return (
    <LegalLayout title="Impressum">
      <h2>Angaben gemäß § 5 TMG</h2>
      <p>
        [Platzhalter: Name / Firma]
        <br />
        [Platzhalter: Straße und Hausnummer]
        <br />
        [Platzhalter: PLZ und Ort]
      </p>

      <h2>Kontakt</h2>
      <p>
        Telefon: [Platzhalter]
        <br />
        E-Mail: [Platzhalter: E-Mail]
      </p>

      <h2>Umsatzsteuer-ID</h2>
      <p>
        Umsatzsteuer-Identifikationsnummer gemäß § 27 a UStG: [Platzhalter].
      </p>

      <h2>Verantwortlich für den Inhalt</h2>
      <p>[Platzhalter: Name, Anschrift wie oben].</p>

      <h2>Streitschlichtung</h2>
      <p>
        Die Europäische Kommission stellt eine Plattform zur
        Online-Streitbeilegung (OS) bereit. Wir sind nicht verpflichtet und
        nicht bereit, an Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle teilzunehmen.
      </p>
    </LegalLayout>
  );
}
