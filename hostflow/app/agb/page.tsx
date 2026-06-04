import { LegalLayout } from "@/components/legal/legal-layout";

export const metadata = { title: "AGB" };

export default function AgbPage() {
  return (
    <LegalLayout title="Allgemeine Geschäftsbedingungen">
      <h2>1. Geltungsbereich</h2>
      <p>
        Diese AGB gelten für die Nutzung der HostFlow-Software (im Folgenden
        „Dienst&ldquo;) durch Vermieter:innen und deren Teammitglieder.
      </p>

      <h2>2. Leistungsbeschreibung</h2>
      <p>
        HostFlow stellt Funktionen zur Verwaltung von Ferienwohnungen bereit:
        Objekte, Belegungen (inkl. iCal-Import), Aufgaben, Team, Zeiterfassung
        und Kostenübersicht.
      </p>

      <h2>3. Testphase und Vergütung</h2>
      <p>
        Neue Konten beginnen mit einer 14-tägigen kostenlosen Testphase. Danach
        ist ein kostenpflichtiges Abo erforderlich. Die Preise richten sich nach
        der Anzahl der Objekte. Beim ersten Kauf kann eine einmalige
        Einrichtungsgebühr anfallen.
      </p>

      <h2>4. Laufzeit und Kündigung</h2>
      <p>
        Das Abo verlängert sich monatlich und ist jederzeit zum Ende des
        Abrechnungszeitraums über das Kundenportal kündbar.
      </p>

      <h2>5. Pflichten der Nutzer:innen</h2>
      <ul>
        <li>Zugangsdaten sind vertraulich zu behandeln.</li>
        <li>Es dürfen keine rechtswidrigen Inhalte hochgeladen werden.</li>
      </ul>

      <h2>6. Haftung</h2>
      <p>
        Der Dienst wird mit größtmöglicher Sorgfalt bereitgestellt. Eine Haftung
        für mittelbare Schäden oder Datenverluste ist im gesetzlich zulässigen
        Rahmen ausgeschlossen. [Platzhalter: Haftungsregelungen rechtlich prüfen.]
      </p>

      <h2>7. Schlussbestimmungen</h2>
      <p>
        Es gilt das Recht der Bundesrepublik Deutschland. Sollten einzelne
        Bestimmungen unwirksam sein, bleibt der übrige Vertrag wirksam.
      </p>
    </LegalLayout>
  );
}
