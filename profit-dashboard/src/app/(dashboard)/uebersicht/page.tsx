import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "./DashboardClient";
import { DEFAULT_MARGIN_THRESHOLD, DEFAULT_VAT_RATE } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function UebersichtPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: orders }, { data: fixedCosts }, { data: bankTx }, { data: settings }] =
    await Promise.all([
      supabase.from("orders").select("*").order("order_date"),
      supabase.from("fixed_costs").select("*"),
      supabase.from("bank_transactions").select("*").order("tx_date"),
      supabase
        .from("settings")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle(),
    ]);

  return (
    <DashboardClient
      orders={orders ?? []}
      fixedCosts={fixedCosts ?? []}
      bankTransactions={bankTx ?? []}
      vatRate={settings?.vat_rate_percent ?? DEFAULT_VAT_RATE}
      marginThreshold={
        settings?.margin_threshold_percent ?? DEFAULT_MARGIN_THRESHOLD
      }
    />
  );
}
