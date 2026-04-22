export const metadata = {
  title: 'Terms of Service — EcomBot',
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-zinc-100">
      <h1 className="mb-6 text-3xl font-bold">Terms of Service</h1>
      <p className="mb-4 text-sm text-zinc-400">
        Last updated: 22 April 2026
      </p>
      <section className="space-y-4 text-sm leading-relaxed text-zinc-300">
        <p>
          EcomBot is provided by Cosimo Management UG. By using the service you
          agree to the terms below.
        </p>
        <h2 className="mt-6 text-lg font-semibold text-zinc-100">Service</h2>
        <p>
          EcomBot automates eBay listing creation using the eBay API on your
          behalf. You are responsible for compliance with eBay&apos;s policies
          and all applicable laws.
        </p>
        <h2 className="mt-6 text-lg font-semibold text-zinc-100">Account</h2>
        <p>
          You must keep your credentials secure and are responsible for all
          actions taken through your account.
        </p>
        <h2 className="mt-6 text-lg font-semibold text-zinc-100">
          Liability
        </h2>
        <p>
          The service is provided as-is. Cosimo Management UG is not liable for
          lost profits, account suspensions, or damages resulting from use of
          the service.
        </p>
        <h2 className="mt-6 text-lg font-semibold text-zinc-100">Contact</h2>
        <p>For questions contact b2b@cajus-handel.com.</p>
      </section>
    </main>
  );
}
