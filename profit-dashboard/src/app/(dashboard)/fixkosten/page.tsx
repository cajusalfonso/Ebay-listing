import { createClient } from "@/lib/supabase/server";
import { FixedCostsClient } from "./FixedCostsClient";

export const dynamic = "force-dynamic";

export default async function FixkostenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: fixedCosts } = await supabase
    .from("fixed_costs")
    .select("*")
    .order("start_date", { ascending: false });

  return (
    <FixedCostsClient initialFixedCosts={fixedCosts ?? []} userId={user!.id} />
  );
}
