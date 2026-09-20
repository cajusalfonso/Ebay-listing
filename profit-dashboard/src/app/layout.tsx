import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lumox Gewinn-Übersicht",
  description: "Gewinn-Übersicht für Lumox.store",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
