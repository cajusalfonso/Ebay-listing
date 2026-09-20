"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (error) {
      setError("Registrierung fehlgeschlagen: " + error.message);
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-lg font-semibold">Fast geschafft</h2>
        <p className="text-sm text-slate-600">
          Wir haben dir eine Bestätigungs-E-Mail geschickt. Bitte E-Mail
          bestätigen, um dich anschließend einzuloggen.
        </p>
        <Link href="/login" className="btn-primary inline-flex">
          Zum Login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold">Registrieren</h2>

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

      <div>
        <label className="label" htmlFor="password">
          Passwort
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={6}
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-loss">{error}</p>}

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? "Registrieren…" : "Registrieren"}
      </button>

      <p className="text-center text-sm text-slate-500">
        Schon registriert?{" "}
        <Link href="/login" className="text-brand hover:underline">
          Anmelden
        </Link>
      </p>
    </form>
  );
}
