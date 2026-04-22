export const metadata = {
  title: 'Privacy Policy — EcomBot',
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-zinc-100">
      <h1 className="mb-6 text-3xl font-bold">Privacy Policy</h1>
      <p className="mb-4 text-sm text-zinc-400">
        Last updated: 22 April 2026
      </p>
      <section className="space-y-4 text-sm leading-relaxed text-zinc-300">
        <p>
          EcomBot (operated by Cosimo Management UG) processes data only to the
          extent required to provide its listing automation service to the
          authenticated account holder.
        </p>
        <h2 className="mt-6 text-lg font-semibold text-zinc-100">
          Data we store
        </h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>Your account credentials (email, hashed password).</li>
          <li>
            OAuth tokens from connected platforms (eBay, Icecat) — encrypted at
            rest using AES-256-GCM.
          </li>
          <li>Product and listing data you create through the service.</li>
        </ul>
        <h2 className="mt-6 text-lg font-semibold text-zinc-100">
          Data we do not store
        </h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>Your eBay password — OAuth tokens only.</li>
          <li>Payment or buyer information.</li>
        </ul>
        <h2 className="mt-6 text-lg font-semibold text-zinc-100">Contact</h2>
        <p>
          For questions or data deletion requests, contact
          b2b@cajus-handel.com.
        </p>
      </section>
    </main>
  );
}
