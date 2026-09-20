import { createClient } from "@/lib/supabase/server";
import { SettingsClient } from "./SettingsClient";
import {
  DEFAULT_MARGIN_THRESHOLD,
  DEFAULT_VAT_RATE,
  DEFAULT_CHANNEL_FEE_PERCENT,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function EinstellungenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: settings } = await supabase
    .from("settings")
    .select("*")
    .eq("user_id", user!.id)
    .maybeSingle();

  return (
    <SettingsClient
      userId={user!.id}
      initialMarginThreshold={
        settings?.margin_threshold_percent ?? DEFAULT_MARGIN_THRESHOLD
      }
      initialVatRate={settings?.vat_rate_percent ?? DEFAULT_VAT_RATE}
      initialChannelFees={
        Object.keys(settings?.channel_fee_defaults ?? {}).length > 0
          ? (settings!.channel_fee_defaults as Record<string, number>)
          : DEFAULT_CHANNEL_FEE_PERCENT
      }
    />
  );
}
