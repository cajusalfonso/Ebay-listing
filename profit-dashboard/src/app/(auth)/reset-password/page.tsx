"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-lg font-semibold">E-Mail verschickt</h2>
        <p className="text-sm text-slate-600">
          Falls ein Konto mit dieser Adresse existiert, wurde ein Link zum
          Zurücksetzen des Passworts geschickt.
        </p>
        <Link href="/login" className="btn-primary inline-flex">
          Zum Login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold">Passwort zurücksetzen</h2>
      <div>
        <label className="label" htmlFor="email">
          E-Mail
        </label>
        <input
          id="email"
          type="email"
          required
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-loss">{error}</p>}

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? "Senden…" : "Link senden"}
      </button>

      <p className="text-center text-sm text-slate-500">
        <Link href="/login" className="text-brand hover:underline">
          Zurück zum Login
        </Link>
      </p>
    </form>
  );
}
