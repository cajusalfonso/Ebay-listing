import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Einrichtung" };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Schon ein Profil? Dann ist das Onboarding erledigt.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (profile) redirect("/dashboard");

  // Wurde der Nutzer eingeladen, gehört er hierher nicht — weiter zur Einladung.
  const inviteToken = user.user_metadata?.invite_token as string | undefined;
  if (inviteToken) redirect(`/einladung/${inviteToken}`);

  const defaultOrgName = user.user_metadata?.organization_name as
    | string
    | undefined;
  const defaultFullName = user.user_metadata?.full_name as string | undefined;

  return (
    <AuthCard
      title="Willkommen bei HostFlow"
      description="Richte deinen Arbeitsbereich ein."
    >
      <OnboardingForm
        defaultOrgName={defaultOrgName}
        defaultFullName={defaultFullName}
      />
    </AuthCard>
  );
}
