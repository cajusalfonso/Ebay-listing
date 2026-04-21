export type Marketplace = 'EBAY_DE';

export interface Competitor {
  readonly itemId: string;
  readonly title: string;
  /** Item price alone, in EUR. */
  readonly price: number;
  /** null when shipping is free OR undisclosed by the seller. */
  readonly shippingCost: number | null;
  /** price + (shippingCost ?? 0). */
  readonly totalPrice: number;
  readonly sellerUsername: string;
  readonly sellerFeedbackScore: number;
  /** eBay condition label like "New", "New other", "Used". */
  readonly condition: string;
}

export type MarketWarningCode = 'only_one_competitor' | 'all_same_seller' | 'no_competitors';

export interface MarketSnapshot {
  readonly ean: string;
  readonly fetchedAt: Date;
  readonly marketplace: Marketplace;
  readonly competitorCount: number;
  /** null when there are no competitors or all quotes are unparseable. */
  readonly lowestPrice: number | null;
  /** Median of `totalPrice`s. null when there are no competitors. */
  readonly medianPrice: number | null;
  readonly currency: 'EUR';
  /** Public URL an operator can open to review the current market. */
  readonly marketplaceSearchUrl: string;
  readonly competitors: readonly Competitor[];
  /** Soft signals — non-blocking. */
  readonly warnings: readonly MarketWarningCode[];
}

/**
 * Pluggable source of competitor pricing. MVP has one implementation
 * (eBay Browse API, EBAY_DE marketplace). Phase 2 will add Kaufland/Otto/etc.
 */
export interface MarketDataProvider {
  readonly name: string;
  getLowestPriceByEan(ean: string): Promise<MarketSnapshot>;
}
