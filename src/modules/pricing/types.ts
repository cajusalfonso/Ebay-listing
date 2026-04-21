/**
 * All money values are EUR. Inputs are not rounded — callers may pass full
 * precision. Outputs are rounded to 4 decimal places internally to minimize
 * float drift, but the display layer should format to 2 decimals for UI.
 */
export interface PricingInputs {
  /** Einkaufspreis. Must be > 0 — zero/negative throws PricingError. */
  readonly cogs: number;
  /**
   * `true` = COGS is gross (includes input VAT, reclaimable by business seller).
   * The engine subtracts input VAT so the net economic cost is used.
   */
  readonly cogsIncludesVat: boolean;
  /** Item price the buyer sees on eBay (brutto, inkl. USt). Must be >= 0. */
  readonly targetSellPriceGross: number;
  /** VAT rate as fraction, e.g. 0.19 for 19%. Must be in [0, 1]. */
  readonly vatRate: number;
  /** Shipping cost I pay to courier, NET (Vorsteuer already deducted). Must be >= 0. */
  readonly shippingCostToMe: number;
  /** Shipping fee charged to buyer, BRUTTO. 0 = free shipping. Must be >= 0. */
  readonly shippingChargedToBuyer: number;
  /** eBay Final Value Fee percent as fraction (e.g. 0.12 for 12%). In [0, 1]. */
  readonly ebayCategoryFeePercent: number;
  /** eBay fixed per-order fee in EUR (eBay.de default: 0.35). Must be >= 0. */
  readonly ebayFixedFeePerOrder: number;
  /** Allocation of monthly eBay Store subscription across expected orders. >= 0. */
  readonly ebayStoreFeeAllocation: number;
  /** Reserve for returns as fraction of COGS (e.g. 0.03 for 3%). In [0, 1]. */
  readonly returnReservePercent: number;
  /** Minimum absolute profit in EUR a listing must yield. Must be >= 0. */
  readonly minAbsoluteProfit: number;
  /** Minimum margin as fraction of NET revenue (e.g. 0.08 for 8%). In [0, 1]. */
  readonly minMarginPercent: number;
}

export interface PricingBreakdown {
  /** COGS after input-VAT deduction (if applicable). */
  readonly cogsNet: number;
  /** eBay Final Value Fee — computed on gross revenue incl. shipping-from-buyer. */
  readonly ebayFeeGross: number;
  /** Courier cost (net). */
  readonly shippingCostNet: number;
  /** VAT owed to the tax office (reverse-calculated from gross revenue). */
  readonly vatOwed: number;
  /** Fixed return reserve: `returnReservePercent * cogs`. */
  readonly returnReserve: number;
  /** Fixed eBay per-order fee. */
  readonly ebayFixedFee: number;
  /** Apportioned store-subscription cost. */
  readonly ebayStoreFeeAllocation: number;
}

export type ViolatedRule = 'absolute_profit_below_threshold' | 'margin_below_threshold';

export interface PricingResult {
  /** True iff every minimum-threshold rule is satisfied. */
  readonly isProfitable: boolean;
  /** Item price + shipping charged to buyer. */
  readonly grossRevenue: number;
  /** Gross revenue minus VAT owed. */
  readonly netRevenue: number;
  /** Sum of all cost components in the breakdown. */
  readonly totalCosts: number;
  /** grossRevenue − totalCosts. May be negative. */
  readonly absoluteProfit: number;
  /** absoluteProfit / netRevenue. 0 if netRevenue is 0. */
  readonly marginPercent: number;
  readonly breakdown: PricingBreakdown;
  /** Stable identifiers of each failed threshold rule (empty when isProfitable). */
  readonly violatedRules: readonly ViolatedRule[];
  /**
   * Smallest `targetSellPriceGross` that simultaneously satisfies both the
   * absolute-profit and margin-percent rules, rounded UP to the next cent.
   * Returns `Number.POSITIVE_INFINITY` when no finite price can satisfy the
   * rules (e.g. when category fee + VAT + margin requirement together exceed 100%).
   */
  readonly suggestedMinPriceGross: number;
}
