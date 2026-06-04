import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";
import { getAuthState } from "@/lib/data/profile";
import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Registrieren" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;

  const state = await getAuthState();
  if (state.isAuthenticated) {
    redirect(state.hasProfile ? "/dashboard" : "/onboarding");
  }

  // Bei Einladung die hinterlegte E-Mail vorbefüllen (falls Admin-Key vorhanden).
  let prefilledEmail: string | undefined;
  if (invite && hasAdminClient()) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("invitations")
      .select("email")
      .eq("token", invite)
      .eq("status", "pending")
      .maybeSingle<{ email: string }>();
    prefilledEmail = data?.email;
  }

  return (
    <AuthCard
      title={invite ? "Team beitreten" : "Konto erstellen"}
      description={
        invite
          ? "Erstelle dein Konto, um der Einladung zu folgen."
          : "Starte mit 14 Tagen kostenlos."
      }
    >
      <RegisterForm inviteToken={invite} prefilledEmail={prefilledEmail} />
    </AuthCard>
  );
}
