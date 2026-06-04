import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/profile";
import { getActivityFeed } from "@/lib/data/activity";
import { isStaffRole } from "@/lib/types";
import { publicEnv } from "@/lib/env";
import { ActivityFeed } from "@/components/activity/activity-feed";
import { InviteMemberDialog } from "@/components/team/invite-member-dialog";
import { MemberList, type Member } from "@/components/team/member-list";
import {
  InvitationList,
  type PendingInvite,
} from "@/components/team/invitation-list";

export const metadata = { title: "Team" };

export default async function TeamPage() {
  const current = await getCurrentUser();
  if (!current) return null;

  // Team-Verwaltung nur für owner/manager.
  if (!isStaffRole(current.profile.role)) {
    redirect("/dashboard");
  }

  const supabase = await createClient();

  const { data: members } = await supabase
    .from("profiles")
    .select("id, full_name, role, hourly_rate")
    .eq("organization_id", current.organization.id)
    .order("created_at", { ascending: true });

  const { data: invitations } = await supabase
    .from("invitations")
    .select("id, email, role, token, expires_at")
    .eq("organization_id", current.organization.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  const activity = await getActivityFeed(15);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team</h1>
          <p className="text-muted-foreground">
            Mitglieder, Rollen und Stundensätze verwalten.
          </p>
        </div>
        <InviteMemberDialog />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Mitglieder ({members?.length ?? 0})
        </h2>
        <MemberList
          members={(members ?? []) as Member[]}
          currentUserId={current.profile.id}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Offene Einladungen ({invitations?.length ?? 0})
        </h2>
        <InvitationList
          invitations={(invitations ?? []) as PendingInvite[]}
          appUrl={publicEnv.NEXT_PUBLIC_APP_URL}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Aktivität
        </h2>
        <ActivityFeed entries={activity} />
      </section>
    </div>
  );
}
