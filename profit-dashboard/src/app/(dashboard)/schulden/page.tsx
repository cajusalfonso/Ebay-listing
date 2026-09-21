import { createClient } from "@/lib/supabase/server";
import { DebtsClient } from "./DebtsClient";

export const dynamic = "force-dynamic";

export default async function SchuldenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: debts }, { data: payments }] = await Promise.all([
    supabase.from("debts").select("*").order("created_at", { ascending: false }),
    supabase
      .from("debt_payments")
      .select("*")
      .order("payment_date", { ascending: false }),
  ]);

  return (
    <DebtsClient
      initialDebts={debts ?? []}
      initialPayments={payments ?? []}
      userId={user!.id}
    />
  );
}
