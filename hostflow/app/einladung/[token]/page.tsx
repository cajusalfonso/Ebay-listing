import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { AcceptInviteButton } from "@/components/invite/accept-invite-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getAuthState } from "@/lib/data/profile";
import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";
import { ROLE_LABELS, type UserRole } from "@/lib/types";

export const metadata = { title: "Einladung" };

type InviteInfo = {
  email: string;
  role: UserRole;
  status: string;
  expires_at: string;
  organization: { name: string } | null;
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const state = await getAuthState();

  // Einladungsdetails laden (nur möglich mit Service-Role-Key).
  let invite: InviteInfo | null = null;
  if (hasAdminClient()) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("invitations")
      .select("email, role, status, expires_at, organization:organizations(name)")
      .eq("token", token)
      .maybeSingle();
    invite = (data as InviteInfo | null) ?? null;
  }

  const orgName = invite?.organization?.name;
  const roleLabel = invite ? ROLE_LABELS[invite.role] : undefined;
  const isExpiredOrUsed =
    invite && (invite.status !== "pending" || new Date(invite.expires_at) < new Date());

  // Bereits Mitglied einer Organisation.
  if (state.isAuthenticated && state.hasProfile) {
    return (
      <AuthCard title="Einladung">
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Du gehörst bereits zu einem Arbeitsbereich. Ein Konto kann nur Teil
            einer Organisation sein.
          </p>
          <Button asChild className="w-full">
            <Link href="/dashboard">Zum Dashboard</Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={orgName ? `Beitritt zu ${orgName}` : "Team-Einladung"}
      description={
        roleLabel ? `Du wurdest als „${roleLabel}" eingeladen.` : undefined
      }
    >
      <div className="space-y-4">
        {invite && (
          <div className="flex items-center justify-center gap-2 text-sm">
            <span className="text-muted-foreground">{invite.email}</span>
            {roleLabel && <Badge variant="secondary">{roleLabel}</Badge>}
          </div>
        )}

        {isExpiredOrUsed ? (
          <p className="text-center text-sm text-destructive">
            Diese Einladung ist nicht mehr gültig oder bereits angenommen.
          </p>
        ) : state.isAuthenticated ? (
          <AcceptInviteButton token={token} />
        ) : (
          <div className="space-y-2">
            <Button asChild className="w-full">
              <Link href={`/register?invite=${token}`}>
                Konto erstellen & beitreten
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href={`/login?redirect=/einladung/${token}`}>
                Ich habe schon ein Konto
              </Link>
            </Button>
          </div>
        )}
      </div>
    </AuthCard>
  );
}
