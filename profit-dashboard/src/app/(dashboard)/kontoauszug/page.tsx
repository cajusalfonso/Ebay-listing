import { createClient } from "@/lib/supabase/server";
import { BankStatementClient } from "./BankStatementClient";

export const dynamic = "force-dynamic";

export default async function KontoauszugPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: transactions } = await supabase
    .from("bank_transactions")
    .select("*")
    .order("tx_date", { ascending: false });

  return (
    <BankStatementClient
      initialTransactions={transactions ?? []}
      userId={user!.id}
    />
  );
}
