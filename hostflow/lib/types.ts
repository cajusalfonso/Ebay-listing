// Gemeinsame Domänen-Typen (spiegeln das DB-Schema). Englisch benannt.

export type UserRole = "owner" | "manager" | "cleaner" | "maintenance";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled";

export type Plan = "s" | "m" | "l";

export type InvitationStatus = "pending" | "accepted" | "revoked";

export interface Organization {
  id: string;
  name: string;
  stripe_customer_id: string | null;
  subscription_status: SubscriptionStatus;
  plan: Plan | null;
  trial_ends_at: string;
  created_at: string;
}

export interface Profile {
  id: string;
  organization_id: string;
  full_name: string;
  role: UserRole;
  hourly_rate: number | null;
  created_at: string;
}

export interface Invitation {
  id: string;
  organization_id: string;
  email: string;
  role: UserRole;
  hourly_rate: number | null;
  token: string;
  status: InvitationStatus;
  invited_by: string | null;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
}

/** Angemeldeter Nutzer inkl. Profil und Organization. */
export interface CurrentUser {
  userId: string;
  email: string | null;
  profile: Profile;
  organization: Organization;
}

/** Rollen mit Verwaltungsrechten (owner/manager). */
export const STAFF_ROLES: UserRole[] = ["owner", "manager"];

export function isStaffRole(role: UserRole): boolean {
  return STAFF_ROLES.includes(role);
}

/** Deutsche Beschriftung der Rollen für die UI. */
export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Inhaber",
  manager: "Manager",
  cleaner: "Reinigung",
  maintenance: "Wartung",
};
