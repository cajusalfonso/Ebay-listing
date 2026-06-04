import { LegalLayout } from "@/components/legal/legal-layout";

export const metadata = { title: "Datenschutzerklärung" };

export default function DatenschutzPage() {
  return (
    <LegalLayout title="Datenschutzerklärung">
      <h2>1. Verantwortlicher</h2>
      <p>
        Verantwortlich für die Datenverarbeitung ist [Platzhalter: Name /
        Firma], [Platzhalter: Anschrift], E-Mail: [Platzhalter: E-Mail].
      </p>

      <h2>2. Hosting & Auftragsverarbeiter</h2>
      <p>
        HostFlow wird bei Vercel (Frontend) betrieben; Datenbank,
        Authentifizierung und Datei-Speicher laufen über Supabase in einer
        Rechenzentrumsregion innerhalb der EU. Mit beiden Anbietern sind Verträge
        zur Auftragsverarbeitung (Art. 28 DSGVO) abzuschließen.
      </p>

      <h2>3. Welche Daten wir verarbeiten</h2>
      <ul>
        <li>Konto- und Profildaten (Name, E-Mail-Adresse, Rolle, Stundensatz)</li>
        <li>Objekt- und Belegungsdaten (Ferienwohnungen, Buchungszeiträume)</li>
        <li>Aufgaben, Zeiteinträge, Ausgaben und Aktivitätsprotokolle</li>
        <li>Optionale Foto-Nachweise zu Aufgaben</li>
      </ul>
      <p>
        Datensparsamkeit: Gästenamen sind optional; HostFlow speichert keine
        sensiblen Gästedaten. Aus importierten Kalendern werden lediglich
        Belegungszeiträume übernommen.
      </p>

      <h2>4. Zwecke und Rechtsgrundlagen</h2>
      <p>
        Die Verarbeitung erfolgt zur Bereitstellung des Dienstes und zur
        Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO) sowie auf Grundlage
        berechtigter Interessen am sicheren Betrieb (Art. 6 Abs. 1 lit. f DSGVO).
      </p>

      <h2>5. Speicherdauer</h2>
      <p>
        Daten werden gespeichert, solange das Konto besteht. Bei Löschung des
        Kontos werden alle zugehörigen Daten unwiderruflich entfernt.
      </p>

      <h2>6. Zahlungsabwicklung</h2>
      <p>
        Für Abonnements nutzen wir Stripe. Zahlungsdaten werden direkt bei Stripe
        verarbeitet; HostFlow speichert keine Kreditkartendaten.
      </p>

      <h2>7. Deine Rechte</h2>
      <ul>
        <li>Auskunft, Berichtigung, Löschung und Einschränkung</li>
        <li>Datenübertragbarkeit und Widerspruch</li>
        <li>Beschwerde bei einer Aufsichtsbehörde</li>
      </ul>
      <p>
        Inhaber:innen können ihr Konto inklusive aller Daten jederzeit selbst
        unter „Einstellungen&ldquo; löschen.
      </p>

      <h2>8. Kontakt</h2>
      <p>Bei Fragen zum Datenschutz: [Platzhalter: Kontakt-E-Mail].</p>
    </LegalLayout>
  );
}
