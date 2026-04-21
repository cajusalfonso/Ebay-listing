import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'eBay Volume Tool',
  description: 'Compliance-first eBay.de volume listing for non-regulated categories',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
