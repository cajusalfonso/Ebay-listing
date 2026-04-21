import { PricingError } from './errors';
import type { PricingBreakdown, PricingInputs, PricingResult, ViolatedRule } from './types';

/**
 * Epsilon used to absorb IEEE-754 float drift at the threshold boundary
 * (e.g. when profit is computed to be 9.999999999999998 but is truly 10.00).
 */
const FLOAT_EPSILON = 1e-9;

/** Round value UP to whole cents (0.01 EUR), pre-correcting for tiny float overhead. */
function ceilToCent(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Math.ceil((value - FLOAT_EPSILON) * 100) / 100;
}

/** Round to 4 decimals for result outputs (money-adjacent precision without UI rounding). */
function round4(value: number): number {
  if (!Number.isFinite(value)) return value;
  return Math.round(value * 10_000) / 10_000;
}

function assertFiniteNumber(name: string, value: number): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new PricingError(`${name} must be a finite number`, { reason: 'invalid_input', name });
  }
}

function assertNonNegative(name: string, value: number): void {
  assertFiniteNumber(name, value);
  if (value < 0) {
    throw new PricingError(`${name} must be >= 0`, { reason: 'negative_input', name, value });
  }
}

function assertInPercentRange(name: string, value: number): void {
  assertFiniteNumber(name, value);
  if (value < 0 || value > 1) {
    throw new PricingError(`${name} must be in [0, 1] (fraction, not percent points)`, {
      reason: 'percent_out_of_range',
      name,
      value,
    });
  }
}

function validateInputs(inputs: PricingInputs): void {
  assertFiniteNumber('cogs', inputs.cogs);
  if (inputs.cogs <= 0) {
    throw new PricingError('cogs must be > 0', {
      reason: 'zero_or_negative_cogs',
      value: inputs.cogs,
    });
  }
  assertNonNegative('targetSellPriceGross', inputs.targetSellPriceGross);
  assertInPercentRange('vatRate', inputs.vatRate);
  assertNonNegative('shippingCostToMe', inputs.shippingCostToMe);
  assertNonNegative('shippingChargedToBuyer', inputs.shippingChargedToBuyer);
  assertInPercentRange('ebayCategoryFeePercent', inputs.ebayCategoryFeePercent);
  assertNonNegative('ebayFixedFeePerOrder', inputs.ebayFixedFeePerOrder);
  assertNonNegative('ebayStoreFeeAllocation', inputs.ebayStoreFeeAllocation);
  assertInPercentRange('returnReservePercent', inputs.returnReservePercent);
  assertNonNegative('minAbsoluteProfit', inputs.minAbsoluteProfit);
  assertInPercentRange('minMarginPercent', inputs.minMarginPercent);
}

interface MinPriceParams {
  readonly fixedCostsSum: number; // K in the derivation
  readonly ebayCategoryFeePercent: number;
  readonly vatRate: number;
  readonly shippingChargedToBuyer: number;
  readonly minAbsoluteProfit: number;
  readonly minMarginPercent: number;
}

/**
 * Solve for the minimum `targetSellPriceGross` that satisfies both the
 * absolute-profit and margin-percent constraints simultaneously.
 *
 * Let G = grossRevenue (sell price + buyer shipping), r = vatRate, F = feePercent,
 * K = sum of fixed costs, m = minMarginPercent, P* = minAbsoluteProfit.
 *
 *   profit π  =  G * (1/(1+r) - F)  -  K
 *   netRev N  =  G / (1+r)
 *
 * Profit constraint  π ≥ P*  ⇒  G ≥ (P* + K) / (1/(1+r) - F)
 * Margin constraint  π/N ≥ m ⇒  G ≥ K * (1+r) / (1 - F*(1+r) - m)
 *
 * Return the larger G, minus shipping-charged-to-buyer, rounded UP to the next cent.
 * Returns Infinity when either denominator is ≤ 0 (no finite price works).
 */
function solveMinPriceGross(p: MinPriceParams): number {
  const vatFactor = 1 + p.vatRate;
  const profitDenom = 1 / vatFactor - p.ebayCategoryFeePercent;
  const marginDenom = 1 - p.ebayCategoryFeePercent * vatFactor - p.minMarginPercent;

  if (profitDenom <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  const gForProfit = (p.minAbsoluteProfit + p.fixedCostsSum) / profitDenom;
  const gForMargin =
    marginDenom > 0 ? (p.fixedCostsSum * vatFactor) / marginDenom : Number.POSITIVE_INFINITY;

  const gMin = Math.max(gForProfit, gForMargin);
  if (!Number.isFinite(gMin)) return Number.POSITIVE_INFINITY;

  const priceGross = gMin - p.shippingChargedToBuyer;
  if (priceGross <= 0) {
    // If shipping alone already covers the minimum gross revenue, seller can
    // in principle list at €0 item price. Clamp to 0 rather than return negative.
    return 0;
  }
  return ceilToCent(priceGross);
}

/**
 * Pure profitability engine. Decides whether a candidate sell price clears
 * both minimum-profit and minimum-margin rules, and exposes the smallest
 * price that would.
 *
 * Assumes B2B-seller accounting: COGS is economic cost (input VAT reclaimable),
 * eBay FVF is the gross charge deducted from payout, VAT on sale is owed to
 * the tax office (reverse-calculated from gross).
 */
export function calculatePricing(inputs: PricingInputs): PricingResult {
  validateInputs(inputs);

  const cogsNet = inputs.cogsIncludesVat ? inputs.cogs / (1 + inputs.vatRate) : inputs.cogs;

  const grossRevenue = inputs.targetSellPriceGross + inputs.shippingChargedToBuyer;
  const vatOwed = (grossRevenue * inputs.vatRate) / (1 + inputs.vatRate);
  const netRevenue = grossRevenue - vatOwed;

  const ebayFeeGross = grossRevenue * inputs.ebayCategoryFeePercent;
  const ebayFixedFee = inputs.ebayFixedFeePerOrder;
  const shippingCostNet = inputs.shippingCostToMe;
  const returnReserve = inputs.returnReservePercent * inputs.cogs;

  const totalCosts =
    cogsNet +
    ebayFeeGross +
    shippingCostNet +
    vatOwed +
    returnReserve +
    ebayFixedFee +
    inputs.ebayStoreFeeAllocation;

  const absoluteProfit = grossRevenue - totalCosts;
  const marginPercent = netRevenue > 0 ? absoluteProfit / netRevenue : 0;

  const violatedRules: ViolatedRule[] = [];
  if (absoluteProfit < inputs.minAbsoluteProfit - FLOAT_EPSILON) {
    violatedRules.push('absolute_profit_below_threshold');
  }
  if (marginPercent < inputs.minMarginPercent - FLOAT_EPSILON) {
    violatedRules.push('margin_below_threshold');
  }

  const fixedCostsSum =
    cogsNet + shippingCostNet + returnReserve + ebayFixedFee + inputs.ebayStoreFeeAllocation;

  const suggestedMinPriceGross = solveMinPriceGross({
    fixedCostsSum,
    ebayCategoryFeePercent: inputs.ebayCategoryFeePercent,
    vatRate: inputs.vatRate,
    shippingChargedToBuyer: inputs.shippingChargedToBuyer,
    minAbsoluteProfit: inputs.minAbsoluteProfit,
    minMarginPercent: inputs.minMarginPercent,
  });

  const breakdown: PricingBreakdown = {
    cogsNet: round4(cogsNet),
    ebayFeeGross: round4(ebayFeeGross),
    shippingCostNet: round4(shippingCostNet),
    vatOwed: round4(vatOwed),
    returnReserve: round4(returnReserve),
    ebayFixedFee: round4(ebayFixedFee),
    ebayStoreFeeAllocation: round4(inputs.ebayStoreFeeAllocation),
  };

  return {
    isProfitable: violatedRules.length === 0,
    grossRevenue: round4(grossRevenue),
    netRevenue: round4(netRevenue),
    totalCosts: round4(totalCosts),
    absoluteProfit: round4(absoluteProfit),
    marginPercent: round4(marginPercent),
    breakdown,
    violatedRules,
    suggestedMinPriceGross,
  };
}
