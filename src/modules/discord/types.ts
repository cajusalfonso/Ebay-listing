export type MarketPosition = 'cheapest' | 'mid' | 'premium' | 'no_competition';

export type PublishStatus = 'published' | 'would_publish_dry_run' | 'failed';

export interface PublishEvent {
  readonly status: PublishStatus;
  readonly title: string;
  readonly ean: string;
  readonly categoryName: string;
  readonly categoryId: string;
  readonly cogsEur: number;
  readonly sellPriceGrossEur: number;
  readonly profitEur: number;
  readonly marginPercent: number;
  readonly competitorCount: number;
  readonly lowestCompetitorEur: number | null;
  readonly marketPosition: MarketPosition;
  /** eBay-hosted item URL post-publish; null on dry-run or failed publish. */
  readonly ebayListingUrl: string | null;
  /** Public eBay.de search link for the EAN — always present. */
  readonly ebaySearchUrl: string;
  readonly environment: 'sandbox' | 'production';
  /** Failure-only: human-readable reason. */
  readonly failureReason: string | null;
}

export interface Notifier {
  readonly name: string;
  publishEvent(event: PublishEvent): Promise<void>;
}
