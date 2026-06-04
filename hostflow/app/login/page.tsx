import { redirect } from "next/navigation";

import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { getAuthState } from "@/lib/data/profile";

export const metadata = { title: "Anmelden" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect: redirectTo } = await searchParams;

  // Bereits angemeldet → weiter in die App.
  const state = await getAuthState();
  if (state.isAuthenticated) {
    redirect(state.hasProfile ? "/dashboard" : "/onboarding");
  }

  return (
    <AuthCard
      title="Willkommen zurück"
      description="Melde dich bei HostFlow an."
    >
      <LoginForm redirectTo={redirectTo} />
    </AuthCard>
  );
}
