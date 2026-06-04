import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/profile";
import { isStaffRole } from "@/lib/types";
import {
  PropertiesManager,
} from "@/components/properties/properties-manager";
import type { PropertyFormValues } from "@/components/properties/property-form-dialog";

export const metadata = { title: "Objekte" };

export default async function ObjektePage() {
  const current = await getCurrentUser();
  if (!current) return null;
  if (!isStaffRole(current.profile.role)) redirect("/dashboard");

  const supabase = await createClient();
  const { data: properties } = await supabase
    .from("properties")
    .select("id, name, address, ical_url, default_cleaning_fee, notes, color")
    .eq("organization_id", current.organization.id)
    .order("name", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Objekte</h1>
        <p className="text-muted-foreground">
          Deine Ferienwohnungen verwalten und Kalender verbinden.
        </p>
      </div>

      <PropertiesManager
        properties={(properties ?? []) as PropertyFormValues[]}
      />
    </div>
  );
}
