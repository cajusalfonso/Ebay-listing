import { eq } from 'drizzle-orm';
import { userPricingSettings } from '../src/db/schema';
import { db } from './db';

export interface PricingSettings {
  readonly minProfitEur: number;
  readonly minMarginPercent: number;
  readonly minRoiPercent: number;
  readonly targetMarginMultiplier: number;
  readonly undercutAmountEur: number;
  readonly categoryFeePercent: number;
  readonly vatRate: number;
  readonly returnReservePercent: number;
}

export const PRICING_SETTINGS_DEFAULTS: PricingSettings = {
  minProfitEur: 10,
  minMarginPercent: 0.08,
  minRoiPercent: 0.08,
  targetMarginMultiplier: 1.25,
  undercutAmountEur: 0.5,
  categoryFeePercent: 0.12,
  vatRate: 0.19,
  returnReservePercent: 0.03,
};

function toNumber(value: string | number, fallback: number): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Load pricing settings for a user, falling back to defaults for any field
 * that's missing (or for users who haven't saved settings yet). Always
 * returns a complete object — callers don't need to handle null.
 */
export async function loadUserPricingSettings(userId: number): Promise<PricingSettings> {
  const rows = await db
    .select()
    .from(userPricingSettings)
    .where(eq(userPricingSettings.userId, userId))
    .limit(1);
  const row = rows[0];
  if (!row) return PRICING_SETTINGS_DEFAULTS;
  return {
    minProfitEur: toNumber(row.minProfitEur, PRICING_SETTINGS_DEFAULTS.minProfitEur),
    minMarginPercent: toNumber(
      row.minMarginPercent,
      PRICING_SETTINGS_DEFAULTS.minMarginPercent
    ),
    minRoiPercent: toNumber(row.minRoiPercent, PRICING_SETTINGS_DEFAULTS.minRoiPercent),
    targetMarginMultiplier: toNumber(
      row.targetMarginMultiplier,
      PRICING_SETTINGS_DEFAULTS.targetMarginMultiplier
    ),
    undercutAmountEur: toNumber(
      row.undercutAmountEur,
      PRICING_SETTINGS_DEFAULTS.undercutAmountEur
    ),
    categoryFeePercent: toNumber(
      row.categoryFeePercent,
      PRICING_SETTINGS_DEFAULTS.categoryFeePercent
    ),
    vatRate: toNumber(row.vatRate, PRICING_SETTINGS_DEFAULTS.vatRate),
    returnReservePercent: toNumber(
      row.returnReservePercent,
      PRICING_SETTINGS_DEFAULTS.returnReservePercent
    ),
  };
}
