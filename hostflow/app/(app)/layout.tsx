import Link from "next/link";
import { redirect } from "next/navigation";

import { AlertTriangle } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/profile";
import { getAccess } from "@/lib/billing/access";
import { MainNav } from "@/components/layout/main-nav";
import { UserMenu } from "@/components/layout/user-menu";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const current = await getCurrentUser();

  // Kein Profil → Onboarding bzw. ausstehende Einladung.
  if (!current) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");

    const inviteToken = user.user_metadata?.invite_token as string | undefined;
    redirect(inviteToken ? `/einladung/${inviteToken}` : "/onboarding");
  }

  const { profile, organization, email } = current;
  const access = getAccess(organization);
  const isOwner = profile.role === "owner";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <Link href="/dashboard" className="font-bold tracking-tight">
              HostFlow
            </Link>
            <span className="hidden truncate text-sm text-muted-foreground sm:inline">
              · {organization.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MainNav role={profile.role} className="hidden sm:flex" />
            <UserMenu
              fullName={profile.full_name}
              email={email}
              role={profile.role}
            />
          </div>
        </div>
        {/* Mobile-Navigation unter dem Header */}
        <div className="container flex items-center gap-1 overflow-x-auto pb-2 sm:hidden">
          <MainNav role={profile.role} />
        </div>
      </header>

      {access.readOnly && (
        <div className="border-b border-destructive/30 bg-destructive/10">
          <div className="container flex flex-wrap items-center gap-2 py-2 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
            <span className="text-destructive">
              Nur-Lese-Modus: Deine Testphase ist abgelaufen.
            </span>
            {isOwner ? (
              <Link
                href="/abo"
                className="font-medium text-destructive underline underline-offset-2"
              >
                Jetzt Tarif wählen
              </Link>
            ) : (
              <span className="text-muted-foreground">
                Bitte wende dich an den Inhaber.
              </span>
            )}
          </div>
        </div>
      )}

      <main className="container flex-1 py-6">{children}</main>
    </div>
  );
}
