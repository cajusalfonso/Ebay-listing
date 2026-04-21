import type { MarketSnapshot } from '../market-data/types';
import { calculatePricing } from './pricing';
import type { PricingInputs, PricingResult } from './types';

export type PriceDecision = 'list' | 'skip' | 'manual_review';
export type MarketPosition = 'cheapest' | 'mid' | 'premium' | 'no_competition';

export interface StrategyRules {
  readonly vatRate: number;
  readonly shippingCostToMe: number;
  readonly shippingChargedToBuyer: number;
  readonly ebayFixedFeePerOrder: number;
  readonly ebayStoreFeeAllocation: number;
  readonly returnReservePercent: number;
  readonly minAbsoluteProfit: number;
  readonly minMarginPercent: number;
  /** € the candidate price undercuts the current lowest competitor. */
  readonly undercutAmount: number;
  /** Multiplier applied to COGS when there is no competition (sets exploratory price). */
  readonly targetMarginMultiplier: number;
}

export interface PriceSuggestion {
  readonly recommendedPriceGross: number;
  readonly decision: PriceDecision;
  readonly reason: string;
  readonly marketPosition: MarketPosition;
  readonly pricingResult: PricingResult;
  readonly marketData: MarketSnapshot | null;
}

function computeMarketPosition(priceGross: number, market: MarketSnapshot | null): MarketPosition {
  if (market?.lowestPrice == null) return 'no_competition';
  if (priceGross <= market.lowestPrice) return 'cheapest';
  if (market.medianPrice !== null && priceGross <= market.medianPrice) return 'mid';
  return 'premium';
}

function buildInputs(
  rules: StrategyRules,
  cogs: number,
  categoryFeePercent: number,
  sellPriceGross: number
): PricingInputs {
  return {
    cogs,
    cogsIncludesVat: false,
    targetSellPriceGross: sellPriceGross,
    vatRate: rules.vatRate,
    shippingCostToMe: rules.shippingCostToMe,
    shippingChargedToBuyer: rules.shippingChargedToBuyer,
    ebayCategoryFeePercent: categoryFeePercent,
    ebayFixedFeePerOrder: rules.ebayFixedFeePerOrder,
    ebayStoreFeeAllocation: rules.ebayStoreFeeAllocation,
    returnReservePercent: rules.returnReservePercent,
    minAbsoluteProfit: rules.minAbsoluteProfit,
    minMarginPercent: rules.minMarginPercent,
  };
}

/**
 * Decide at what price (if any) to list a product.
 *
 * Algorithm (per Spec §7 Pricing Strategy):
 *   1. If there are competitors: candidate = lowestPrice − undercutAmount.
 *      Otherwise: candidate = cogs × targetMarginMultiplier (exploratory).
 *   2. Evaluate `candidate` via `calculatePricing`.
 *   3. Profitable at candidate → list at candidate.
 *   4. Not profitable → try `suggestedMinPriceGross` (the cheapest price that
 *      would satisfy both rules).
 *      a. If that min-price beats the market lowest: list at min-price,
 *         reason `at_min_profit_threshold`.
 *      b. If it's above the market lowest: skip, reason `not_competitive` —
 *         we can't be profitable AND cheaper than the market.
 *   5. If constraints are mathematically impossible (`suggestedMinPriceGross = ∞`):
 *      skip, reason `mathematically_impossible` (category fee too high, etc.).
 */
export function suggestSellPrice(
  marketData: MarketSnapshot | null,
  cogs: number,
  categoryFeePercent: number,
  rules: StrategyRules
): PriceSuggestion {
  const competitorLowest = marketData?.lowestPrice ?? null;
  const hasCompetition = competitorLowest !== null;
  const initialCandidate = hasCompetition
    ? Math.max(0.01, competitorLowest - rules.undercutAmount)
    : cogs * rules.targetMarginMultiplier;

  const firstAttempt = calculatePricing(
    buildInputs(rules, cogs, categoryFeePercent, initialCandidate)
  );

  if (firstAttempt.isProfitable) {
    return {
      recommendedPriceGross: initialCandidate,
      decision: 'list',
      reason: hasCompetition ? 'undercut_competition' : 'no_competition_target_margin',
      marketPosition: computeMarketPosition(initialCandidate, marketData),
      pricingResult: firstAttempt,
      marketData,
    };
  }

  const minPrice = firstAttempt.suggestedMinPriceGross;

  if (!Number.isFinite(minPrice)) {
    return {
      recommendedPriceGross: initialCandidate,
      decision: 'skip',
      reason: 'mathematically_impossible',
      marketPosition: computeMarketPosition(initialCandidate, marketData),
      pricingResult: firstAttempt,
      marketData,
    };
  }

  if (hasCompetition && competitorLowest < minPrice) {
    return {
      recommendedPriceGross: minPrice,
      decision: 'skip',
      reason: 'not_competitive',
      marketPosition: 'premium',
      pricingResult: firstAttempt,
      marketData,
    };
  }

  const minPriceResult = calculatePricing(buildInputs(rules, cogs, categoryFeePercent, minPrice));

  return {
    recommendedPriceGross: minPrice,
    decision: 'list',
    reason: 'at_min_profit_threshold',
    marketPosition: computeMarketPosition(minPrice, marketData),
    pricingResult: minPriceResult,
    marketData,
  };
}
