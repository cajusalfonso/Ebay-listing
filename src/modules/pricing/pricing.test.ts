import { describe, expect, it } from 'vitest';
import { PricingError } from './errors';
import { calculatePricing } from './pricing';
import type { PricingInputs } from './types';

/**
 * Base fixture for a comfortably profitable listing.
 * Expected at this baseline:
 *   grossRevenue  = 25.00 + 4.90                              = 29.90
 *   vatOwed       = 29.90 * 0.19 / 1.19                       = 4.7739495798…
 *   netRevenue    = 29.90 - 4.7739…                           = 25.1260504201…
 *   ebayFeeGross  = 29.90 * 0.12                              = 3.588
 *   returnReserve = 0.03 * 5                                  = 0.15
 *   totalCosts    = 5 + 3.588 + 2 + 4.7739… + 0.15 + 0.35 + 0 = 15.8619…
 *   absoluteProfit= 29.90 - 15.8619…                          = 14.0380…
 *   marginPercent = 14.0380… / 25.1260…                       = 0.5587…
 */
function baseInputs(overrides: Partial<PricingInputs> = {}): PricingInputs {
  return {
    cogs: 5,
    cogsIncludesVat: false,
    targetSellPriceGross: 25,
    vatRate: 0.19,
    shippingCostToMe: 2,
    shippingChargedToBuyer: 4.9,
    ebayCategoryFeePercent: 0.12,
    ebayFixedFeePerOrder: 0.35,
    ebayStoreFeeAllocation: 0,
    returnReservePercent: 0.03,
    minAbsoluteProfit: 10,
    minMarginPercent: 0.08,
    ...overrides,
  };
}

describe('calculatePricing — happy path', () => {
  it('is profitable and returns no violated rules for the baseline fixture', () => {
    const r = calculatePricing(baseInputs());
    expect(r.isProfitable).toBe(true);
    expect(r.violatedRules).toEqual([]);
    expect(r.grossRevenue).toBeCloseTo(29.9, 4);
    expect(r.breakdown.vatOwed).toBeCloseTo(4.7739, 3);
    expect(r.netRevenue).toBeCloseTo(25.1261, 3);
    expect(r.breakdown.ebayFeeGross).toBeCloseTo(3.588, 3);
    expect(r.absoluteProfit).toBeCloseTo(14.0381, 3);
    expect(r.marginPercent).toBeCloseTo(0.5587, 3);
  });

  it('breakdown components plus vatOwed sum to totalCosts', () => {
    const r = calculatePricing(baseInputs());
    const sum =
      r.breakdown.cogsNet +
      r.breakdown.ebayFeeGross +
      r.breakdown.shippingCostNet +
      r.breakdown.vatOwed +
      r.breakdown.returnReserve +
      r.breakdown.ebayFixedFee +
      r.breakdown.ebayStoreFeeAllocation;
    expect(sum).toBeCloseTo(r.totalCosts, 4);
  });
});

describe('calculatePricing — threshold behaviour', () => {
  it('marks listing profitable when profit is exactly €10.00', () => {
    // Derived: setting sell price = 19.40 yields profit ≈ 10.00 (see manual
    // calc in suggestedMinPriceGross test). Use baseInputs otherwise.
    const r = calculatePricing(baseInputs({ targetSellPriceGross: 19.4 }));
    expect(r.absoluteProfit).toBeGreaterThanOrEqual(10 - 1e-6);
    expect(r.violatedRules).not.toContain('absolute_profit_below_threshold');
  });

  it('marks listing unprofitable when profit is just below €10.00', () => {
    const r = calculatePricing(baseInputs({ targetSellPriceGross: 19.3 }));
    expect(r.absoluteProfit).toBeLessThan(10);
    expect(r.violatedRules).toContain('absolute_profit_below_threshold');
    expect(r.isProfitable).toBe(false);
  });

  it('margin-dominated failure: profit clears threshold but margin falls below 8%', () => {
    // High COGS + moderate sell price compresses margin while keeping profit > minProfit.
    //   cogs=60, sell=92, ship=4.90 → gross=96.90, vat=15.47, net=81.43
    //   fee=11.628, reserve=1.80, totalCosts=91.25, profit≈5.65, margin≈6.94% (<8%)
    const r = calculatePricing(
      baseInputs({ cogs: 60, targetSellPriceGross: 92, minAbsoluteProfit: 5 })
    );
    expect(r.absoluteProfit).toBeGreaterThan(5);
    expect(r.marginPercent).toBeLessThan(0.08);
    expect(r.violatedRules).toContain('margin_below_threshold');
    expect(r.violatedRules).not.toContain('absolute_profit_below_threshold');
    expect(r.isProfitable).toBe(false);
  });

  it('collects BOTH rule violations when both fail', () => {
    const r = calculatePricing(baseInputs({ cogs: 20, targetSellPriceGross: 22 }));
    expect(r.violatedRules).toContain('absolute_profit_below_threshold');
    expect(r.violatedRules).toContain('margin_below_threshold');
    expect(r.isProfitable).toBe(false);
  });
});

describe('calculatePricing — cogsIncludesVat handling', () => {
  it('with cogsIncludesVat=false, cogsNet equals cogs', () => {
    const r = calculatePricing(baseInputs({ cogs: 5, cogsIncludesVat: false }));
    expect(r.breakdown.cogsNet).toBeCloseTo(5, 6);
  });

  it('with cogsIncludesVat=true, cogsNet is gross divided by (1+vatRate)', () => {
    // 5.95 gross with 19% VAT → 5.00 net.
    const r = calculatePricing(baseInputs({ cogs: 5.95, cogsIncludesVat: true, vatRate: 0.19 }));
    expect(r.breakdown.cogsNet).toBeCloseTo(5, 4);
  });

  it('cogsIncludesVat=true lowers the booked cost and therefore raises profit', () => {
    const gross = calculatePricing(baseInputs({ cogs: 5.95, cogsIncludesVat: true }));
    const net = calculatePricing(baseInputs({ cogs: 5.95, cogsIncludesVat: false }));
    expect(gross.absoluteProfit).toBeGreaterThan(net.absoluteProfit);
  });
});

describe('calculatePricing — shipping variations', () => {
  it('free shipping with absorbed courier cost reduces profit by the cost', () => {
    const paid = calculatePricing(baseInputs({ shippingChargedToBuyer: 4.9, shippingCostToMe: 2 }));
    const free = calculatePricing(baseInputs({ shippingChargedToBuyer: 0, shippingCostToMe: 2 }));
    // Free shipping removes 4.90 from gross revenue → profit drops by (4.90 - VAT on it - fee on it).
    expect(paid.absoluteProfit).toBeGreaterThan(free.absoluteProfit);
  });

  it('expensive shipping surcharge (ship_to_buyer > ship_to_me) increases profit', () => {
    const balanced = calculatePricing(
      baseInputs({ shippingChargedToBuyer: 4.9, shippingCostToMe: 4.9 })
    );
    const surcharge = calculatePricing(
      baseInputs({ shippingChargedToBuyer: 7.9, shippingCostToMe: 4.9 })
    );
    expect(surcharge.absoluteProfit).toBeGreaterThan(balanced.absoluteProfit);
  });
});

describe('calculatePricing — fee-rate variations (10/11/12/14%, and 0% for auto parts)', () => {
  it.each([
    [0.1, 'ten'],
    [0.11, 'eleven'],
    [0.12, 'twelve'],
    [0.14, 'fourteen'],
    [0, 'zero (auto parts)'],
  ])('ebayCategoryFeePercent=%s (%s) produces fee = gross * rate', (rate) => {
    const r = calculatePricing(baseInputs({ ebayCategoryFeePercent: rate }));
    expect(r.breakdown.ebayFeeGross).toBeCloseTo(r.grossRevenue * rate, 4);
  });

  it('lower fee rate produces higher profit, monotonic', () => {
    const low = calculatePricing(baseInputs({ ebayCategoryFeePercent: 0.1 }));
    const high = calculatePricing(baseInputs({ ebayCategoryFeePercent: 0.14 }));
    expect(low.absoluteProfit).toBeGreaterThan(high.absoluteProfit);
  });
});

describe('calculatePricing — VAT-rate variations (0/7/19%)', () => {
  it.each([
    [0, 0],
    [0.07, 0.07],
    [0.19, 0.19],
  ])('vatRate=%s → vatOwed = gross * rate / (1+rate)', (rate) => {
    const r = calculatePricing(baseInputs({ vatRate: rate }));
    const expectedVat = (r.grossRevenue * rate) / (1 + rate);
    expect(r.breakdown.vatOwed).toBeCloseTo(expectedVat, 4);
  });

  it('vatRate=0 means netRevenue === grossRevenue', () => {
    const r = calculatePricing(baseInputs({ vatRate: 0 }));
    expect(r.netRevenue).toBeCloseTo(r.grossRevenue, 6);
    expect(r.breakdown.vatOwed).toBeCloseTo(0, 6);
  });
});

describe('calculatePricing — suggestedMinPriceGross (manually derived)', () => {
  it('profit-dominated case: baseline fixture yields exactly 19.40', () => {
    // Manual derivation:
    //   K = 5 + 2 + 0.15 + 0.35 + 0 = 7.50
    //   profitDenom = 1/1.19 - 0.12 = 0.72033613…
    //   marginDenom = 1 - 0.12·1.19 - 0.08 = 0.7772
    //   gForProfit  = (10 + 7.5) / 0.72033613 = 24.2935… ← dominates
    //   gForMargin  = 7.5 · 1.19 / 0.7772      = 11.4838…
    //   priceGross  = 24.2935… - 4.90 = 19.3935… → ceil to cent = 19.40
    const r = calculatePricing(baseInputs());
    expect(r.suggestedMinPriceGross).toBe(19.4);
  });

  it('relisting at the suggested min-price yields a listing that passes both rules', () => {
    const r = calculatePricing(baseInputs());
    const replay = calculatePricing(baseInputs({ targetSellPriceGross: r.suggestedMinPriceGross }));
    expect(replay.isProfitable).toBe(true);
    expect(replay.absoluteProfit).toBeGreaterThanOrEqual(10 - 1e-6);
    expect(replay.marginPercent).toBeGreaterThanOrEqual(0.08 - 1e-6);
  });

  it('margin-dominated case: high margin requirement forces bigger suggested price', () => {
    // Manual: minProfit=0.50, minMargin=0.40, cogs=1, rest same.
    //   K = 1 + 2 + 0.03 + 0.35 + 0 = 3.38
    //   profitDenom = 0.72033613… , gForProfit = 3.88 / 0.72033613 = 5.3864…
    //   marginDenom = 1 - 0.1428 - 0.40 = 0.4572
    //   gForMargin  = 3.38 · 1.19 / 0.4572 = 8.7973… ← dominates
    //   priceGross  = 8.7973… - 4.90 = 3.8973… → 3.90
    const r = calculatePricing(
      baseInputs({ cogs: 1, minAbsoluteProfit: 0.5, minMarginPercent: 0.4 })
    );
    expect(r.suggestedMinPriceGross).toBe(3.9);
  });

  it('both rules equal: construct inputs so both gForProfit and gForMargin give 10.00', () => {
    // With VAT=0, F=0: gForProfit = P* + K, gForMargin = K / (1 - m).
    // Pick K=9, m=0.10 → gForMargin = 10. Pick P*=1 → gForProfit = 10. Both equal.
    // Build K=9 from: cogs=5, shipToMe=1, fixedFee=3, storeAlloc=0, returnPct=0 → 5+1+0+3+0 = 9.
    // Set shipToBuyer=0 so priceGross = gMin exactly.
    const inputs = baseInputs({
      cogs: 5,
      cogsIncludesVat: false,
      vatRate: 0,
      ebayCategoryFeePercent: 0,
      shippingCostToMe: 1,
      shippingChargedToBuyer: 0,
      ebayFixedFeePerOrder: 3,
      ebayStoreFeeAllocation: 0,
      returnReservePercent: 0,
      minAbsoluteProfit: 1,
      minMarginPercent: 0.1,
    });
    const r = calculatePricing(inputs);
    expect(r.suggestedMinPriceGross).toBe(10);
  });

  it('returns POSITIVE_INFINITY when constraints are mathematically unsatisfiable', () => {
    // Push fee + required margin above 100% so marginDenom ≤ 0.
    const r = calculatePricing(
      baseInputs({
        ebayCategoryFeePercent: 0.9,
        minMarginPercent: 0.5,
      })
    );
    expect(r.suggestedMinPriceGross).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('calculatePricing — input validation (throws PricingError)', () => {
  it('zero cogs throws', () => {
    expect(() => calculatePricing(baseInputs({ cogs: 0 }))).toThrow(PricingError);
    expect(() => calculatePricing(baseInputs({ cogs: 0 }))).toThrow(/> 0/);
  });

  it('negative cogs throws', () => {
    expect(() => calculatePricing(baseInputs({ cogs: -5 }))).toThrow(PricingError);
  });

  it('negative shipping throws', () => {
    expect(() => calculatePricing(baseInputs({ shippingCostToMe: -1 }))).toThrow(PricingError);
    expect(() => calculatePricing(baseInputs({ shippingChargedToBuyer: -1 }))).toThrow(
      PricingError
    );
  });

  it('negative targetSellPriceGross throws', () => {
    expect(() => calculatePricing(baseInputs({ targetSellPriceGross: -5 }))).toThrow(PricingError);
  });

  it('vatRate > 1 throws (must be fraction, not percent points)', () => {
    expect(() => calculatePricing(baseInputs({ vatRate: 19 }))).toThrow(/\[0, 1\]/);
  });

  it('ebayCategoryFeePercent > 1 throws', () => {
    expect(() => calculatePricing(baseInputs({ ebayCategoryFeePercent: 12 }))).toThrow(
      PricingError
    );
  });

  it('NaN cogs throws', () => {
    expect(() => calculatePricing(baseInputs({ cogs: Number.NaN }))).toThrow(PricingError);
  });

  it('Infinity in sell price throws', () => {
    expect(() => calculatePricing(baseInputs({ targetSellPriceGross: Infinity }))).toThrow(
      PricingError
    );
  });
});

describe('calculatePricing — return reserve uses full (gross) COGS', () => {
  it('returnReserve = returnReservePercent × cogs (not cogsNet)', () => {
    // Gross cogs 11.90 @ 19% VAT = 10.00 net. returnReserve should be 0.05 × 11.90 = 0.595.
    const r = calculatePricing(
      baseInputs({ cogs: 11.9, cogsIncludesVat: true, returnReservePercent: 0.05 })
    );
    expect(r.breakdown.returnReserve).toBeCloseTo(0.595, 4);
  });
});

describe('calculatePricing — netRevenue edge cases', () => {
  it('zero revenue → marginPercent defaults to 0 (no divide-by-zero)', () => {
    const r = calculatePricing(baseInputs({ targetSellPriceGross: 0, shippingChargedToBuyer: 0 }));
    expect(r.marginPercent).toBe(0);
    expect(r.grossRevenue).toBe(0);
    expect(r.netRevenue).toBe(0);
    expect(r.isProfitable).toBe(false);
  });
});
