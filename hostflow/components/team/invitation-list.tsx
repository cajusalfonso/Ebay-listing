"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, X } from "lucide-react";

import { revokeInvitation } from "@/lib/team/actions";
import type { ActionState } from "@/lib/auth/actions";
import { ROLE_LABELS, type UserRole } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type PendingInvite = {
  id: string;
  email: string;
  role: UserRole;
  token: string;
  expires_at: string;
};

export function InvitationList({
  invitations,
  appUrl,
}: {
  invitations: PendingInvite[];
  appUrl: string;
}) {
  if (invitations.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
        Keine offenen Einladungen.
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {invitations.map((inv) => (
        <InvitationRow key={inv.id} invitation={inv} appUrl={appUrl} />
      ))}
    </ul>
  );
}

function InvitationRow({
  invitation,
  appUrl,
}: {
  invitation: PendingInvite;
  appUrl: string;
}) {
  const [copied, setCopied] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(
    revokeInvitation,
    null,
  );

  const link = `${appUrl}/einladung/${invitation.token}`;

  useEffect(() => {
    if (state?.message) toast.success(state.message);
    else if (state?.error) toast.error(state.error);
  }, [state]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast.success("Einladungslink kopiert");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Kopieren nicht möglich");
    }
  }

  return (
    <li className="flex items-center justify-between gap-3 p-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{invitation.email}</p>
        <p className="text-sm text-muted-foreground">
          Läuft ab am{" "}
          {new Date(invitation.expires_at).toLocaleDateString("de-DE")}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{ROLE_LABELS[invitation.role]}</Badge>
        <Button
          variant="outline"
          size="icon"
          onClick={copyLink}
          aria-label="Einladungslink kopieren"
        >
          {copied ? (
            <Check className="h-4 w-4 text-status-free" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
        <form action={formAction}>
          <input type="hidden" name="invitationId" value={invitation.id} />
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            aria-label="Einladung zurückziehen"
          >
            <X className="h-4 w-4 text-destructive" />
          </Button>
        </form>
      </div>
    </li>
  );
}
