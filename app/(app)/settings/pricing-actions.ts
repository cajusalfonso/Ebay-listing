'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { auth } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { loadUserPricingSettings, type PricingSettings } from '../../../lib/pricing-settings';
import { userPricingSettings } from '../../../src/db/schema';

// All fields are optional in the form — empty input means "keep existing".
const pricingSchema = z.object({
  minProfitEur: z.coerce.number().min(0).max(10_000).optional().or(z.literal('')),
  minMarginPercent: z.coerce.number().min(0).max(100).optional().or(z.literal('')),
  minRoiPercent: z.coerce.number().min(0).max(1_000).optional().or(z.literal('')),
  targetMarginMultiplier: z.coerce.number().min(1).max(10).optional().or(z.literal('')),
  undercutAmountEur: z.coerce.number().min(0).max(100).optional().or(z.literal('')),
  categoryFeePercent: z.coerce.number().min(0).max(100).optional().or(z.literal('')),
  vatRate: z.coerce.number().min(0).max(100).optional().or(z.literal('')),
  returnReservePercent: z.coerce.number().min(0).max(100).optional().or(z.literal('')),
});

export interface PricingSaveResult {
  ok: boolean;
  error?: string;
  message?: string;
}

/**
 * Coerce a percentage input. The form accepts user-friendly values: 8 means
 * 8 %, 19 means 19 %. Internally we store fractions (0.08, 0.19). Multiplier
 * fields (target margin, fee) accept the raw value.
 */
function asFraction(input: number | '' | undefined): number | undefined {
  if (input === '' || input === undefined) return undefined;
  return input / 100;
}
function asNumber(input: number | '' | undefined): number | undefined {
  if (input === '' || input === undefined) return undefined;
  return input;
}

export async function savePricingSettingsAction(
  formData: FormData
): Promise<PricingSaveResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'Nicht eingeloggt.' };
  const userId = Number.parseInt(session.user.id, 10);

  const parsed = pricingSchema.safeParse({
    minProfitEur: formData.get('minProfitEur') ?? '',
    minMarginPercent: formData.get('minMarginPercent') ?? '',
    minRoiPercent: formData.get('minRoiPercent') ?? '',
    targetMarginMultiplier: formData.get('targetMarginMultiplier') ?? '',
    undercutAmountEur: formData.get('undercutAmountEur') ?? '',
    categoryFeePercent: formData.get('categoryFeePercent') ?? '',
    vatRate: formData.get('vatRate') ?? '',
    returnReservePercent: formData.get('returnReservePercent') ?? '',
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe' };
  }

  // Build the row payload: load current values, override only what the user
  // typed. Empty inputs preserve existing values (matches how credentials
  // saving works elsewhere in the app).
  const current = await loadUserPricingSettings(userId);
  const minProfit = asNumber(parsed.data.minProfitEur) ?? current.minProfitEur;
  const minMargin = asFraction(parsed.data.minMarginPercent) ?? current.minMarginPercent;
  const minRoi = asFraction(parsed.data.minRoiPercent) ?? current.minRoiPercent;
  const targetMul =
    asNumber(parsed.data.targetMarginMultiplier) ?? current.targetMarginMultiplier;
  const undercut = asNumber(parsed.data.undercutAmountEur) ?? current.undercutAmountEur;
  const categoryFee =
    asFraction(parsed.data.categoryFeePercent) ?? current.categoryFeePercent;
  const vatRate = asFraction(parsed.data.vatRate) ?? current.vatRate;
  const returnReserve =
    asFraction(parsed.data.returnReservePercent) ?? current.returnReservePercent;

  await db
    .insert(userPricingSettings)
    .values({
      userId,
      minProfitEur: minProfit.toFixed(2),
      minMarginPercent: minMargin.toFixed(4),
      minRoiPercent: minRoi.toFixed(4),
      targetMarginMultiplier: targetMul.toFixed(4),
      undercutAmountEur: undercut.toFixed(2),
      categoryFeePercent: categoryFee.toFixed(4),
      vatRate: vatRate.toFixed(4),
      returnReservePercent: returnReserve.toFixed(4),
    })
    .onConflictDoUpdate({
      target: userPricingSettings.userId,
      set: {
        minProfitEur: minProfit.toFixed(2),
        minMarginPercent: minMargin.toFixed(4),
        minRoiPercent: minRoi.toFixed(4),
        targetMarginMultiplier: targetMul.toFixed(4),
        undercutAmountEur: undercut.toFixed(2),
        categoryFeePercent: categoryFee.toFixed(4),
        vatRate: vatRate.toFixed(4),
        returnReservePercent: returnReserve.toFixed(4),
      },
    });

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { ok: true, message: 'Profitability Thresholds gespeichert.' };
}

export async function loadCurrentPricingSettings(): Promise<PricingSettings | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = Number.parseInt(session.user.id, 10);
  return loadUserPricingSettings(userId);
}
