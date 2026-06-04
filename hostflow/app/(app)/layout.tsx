import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/profile";
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

      <main className="container flex-1 py-6">{children}</main>
    </div>
  );
}
