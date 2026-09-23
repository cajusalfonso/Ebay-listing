import { createClient } from "@/lib/supabase/server";
import { SupplierClient } from "./SupplierClient";
import { DEFAULT_PAYMENT_FEE_PERCENT } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function SupplierPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: suppliers }, { data: models }, { data: settings }] =
    await Promise.all([
      supabase.from("suppliers").select("*").order("company_name"),
      supabase.from("product_models").select("*").order("created_at", { ascending: false }),
      supabase
        .from("settings")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle(),
    ]);

  return (
    <SupplierClient
      initialSuppliers={suppliers ?? []}
      initialModels={models ?? []}
      paymentFeePercent={
        settings?.default_payment_fee_percent ?? DEFAULT_PAYMENT_FEE_PERCENT
      }
      userId={user!.id}
    />
  );
}
