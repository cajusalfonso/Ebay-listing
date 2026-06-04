"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { register, type ActionState } from "@/lib/auth/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/forms/submit-button";

export function RegisterForm({
  inviteToken,
  prefilledEmail,
}: {
  inviteToken?: string;
  prefilledEmail?: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    register,
    null,
  );
  const isInvite = Boolean(inviteToken);

  if (state?.message) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2 className="h-10 w-10 text-status-free" />
        <p className="text-sm text-muted-foreground">{state.message}</p>
        <Link href="/login" className="text-sm font-medium text-primary hover:underline">
          Zur Anmeldung
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {inviteToken && (
        <input type="hidden" name="inviteToken" value={inviteToken} />
      )}

      <div className="space-y-2">
        <Label htmlFor="fullName">Dein Name</Label>
        <Input id="fullName" name="fullName" autoComplete="name" required />
      </div>

      {!isInvite && (
        <div className="space-y-2">
          <Label htmlFor="organizationName">Name der Organisation</Label>
          <Input
            id="organizationName"
            name="organizationName"
            placeholder="z. B. Meine Ferienwohnungen"
            required
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">E-Mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={prefilledEmail}
          readOnly={Boolean(prefilledEmail)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Passwort</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <p className="text-xs text-muted-foreground">Mindestens 8 Zeichen.</p>
      </div>

      {state?.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <SubmitButton className="w-full" pendingText="Konto wird erstellt …">
        {isInvite ? "Konto erstellen & beitreten" : "Kostenlos starten"}
      </SubmitButton>

      {!isInvite && (
        <p className="text-center text-sm text-muted-foreground">
          Schon ein Konto?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Anmelden
          </Link>
        </p>
      )}
    </form>
  );
}
