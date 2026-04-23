export interface PriceComparisonOffer {
  /** Shop name, e.g. "Amazon.de", "Rakuten", "MediaMarkt". */
  readonly seller: string;
  /** Product title as listed on that shop — sometimes differs from the EAN owner. */
  readonly title: string;
  /** Price value in EUR. */
  readonly priceEur: number;
  /** Direct link to the offer on the seller's site (Google out-link). */
  readonly link: string;
  /** Thumbnail URL if the source supplied one. */
  readonly thumbnail: string | null;
  /** Country the offer was sourced from: "DE" or "FR". */
  readonly country: 'DE' | 'FR';
}

export interface PriceComparisonSnapshot {
  readonly ean: string;
  /** All offers from DE + FR combined, sorted ascending by price. */
  readonly offers: readonly PriceComparisonOffer[];
  /** Cheapest DE offer (null if none found). */
  readonly cheapestDe: PriceComparisonOffer | null;
  /** Cheapest FR offer (null if none found). */
  readonly cheapestFr: PriceComparisonOffer | null;
  /** `cache` if served from DB cache (within 24h), `live` if fresh fetch. */
  readonly source: 'cache' | 'live';
  readonly fetchedAt: Date;
}
