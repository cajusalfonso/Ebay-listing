"use client";

import { useActionState } from "react";

import { acceptInvitation } from "@/lib/auth/onboarding";
import type { ActionState } from "@/lib/auth/actions";
import { SubmitButton } from "@/components/forms/submit-button";

export function AcceptInviteButton({ token }: { token: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    acceptInvitation,
    null,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      {state?.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <SubmitButton className="w-full" pendingText="Trete bei …">
        Einladung annehmen
      </SubmitButton>
    </form>
  );
}
