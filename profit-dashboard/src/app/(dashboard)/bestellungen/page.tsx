import { createClient } from "@/lib/supabase/server";
import { OrdersClient } from "./OrdersClient";
import { DEFAULT_MARGIN_THRESHOLD } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function BestellungenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: orders }, { data: settings }] = await Promise.all([
    supabase
      .from("orders")
      .select("*")
      .order("order_date", { ascending: false }),
    supabase
      .from("settings")
      .select("*")
      .eq("user_id", user!.id)
      .maybeSingle(),
  ]);

  return (
    <OrdersClient
      initialOrders={orders ?? []}
      marginThreshold={
        settings?.margin_threshold_percent ?? DEFAULT_MARGIN_THRESHOLD
      }
      userId={user!.id}
    />
  );
}
