"use client";

import { useActionState } from "react";

import { createOrganization } from "@/lib/auth/onboarding";
import type { ActionState } from "@/lib/auth/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/forms/submit-button";

export function OnboardingForm({
  defaultOrgName,
  defaultFullName,
}: {
  defaultOrgName?: string;
  defaultFullName?: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    createOrganization,
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="fullName" value={defaultFullName ?? ""} />

      <div className="space-y-2">
        <Label htmlFor="organizationName">Name der Organisation</Label>
        <Input
          id="organizationName"
          name="organizationName"
          defaultValue={defaultOrgName}
          placeholder="z. B. Meine Ferienwohnungen"
          required
          autoFocus
        />
        <p className="text-xs text-muted-foreground">
          Das ist dein Arbeitsbereich. Objekte und Team kommen als Nächstes.
        </p>
      </div>

      {state?.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      <SubmitButton className="w-full" pendingText="Wird eingerichtet …">
        Los geht&apos;s
      </SubmitButton>
    </form>
  );
}
