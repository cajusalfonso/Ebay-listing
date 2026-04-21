import type { BrowseClient, BrowseItem } from '../ebay/browse';
import type { Competitor, MarketDataProvider, MarketSnapshot, MarketWarningCode } from './types';

const MAX_COMPETITORS = 20;

/**
 * Narrow the search to EBAY_DE, EUR, Germany-located, NEW condition, fixed-price listings.
 * Syntax is `key:{value}` with multiple filters comma-separated (per eBay Browse docs).
 */
const BROWSE_FILTER =
  'conditions:{NEW},buyingOptions:{FIXED_PRICE},itemLocationCountry:DE,priceCurrency:EUR';

const MARKETPLACE_SEARCH_URL_BASE = 'https://www.ebay.de/sch/i.html';

function totalOf(item: BrowseItem): number {
  return item.priceValue + (item.shippingCost ?? 0);
}

function toCompetitor(item: BrowseItem): Competitor {
  return {
    itemId: item.itemId,
    title: item.title,
    price: item.priceValue,
    shippingCost: item.shippingCost,
    totalPrice: totalOf(item),
    sellerUsername: item.sellerUsername,
    sellerFeedbackScore: item.sellerFeedbackScore,
    condition: item.condition,
  };
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid] ?? null;
  }
  const left = sorted[mid - 1];
  const right = sorted[mid];
  return left !== undefined && right !== undefined ? (left + right) / 2 : null;
}

function detectWarnings(competitors: readonly Competitor[]): MarketWarningCode[] {
  const warnings: MarketWarningCode[] = [];
  if (competitors.length === 0) {
    warnings.push('no_competitors');
    return warnings;
  }
  if (competitors.length === 1) {
    warnings.push('only_one_competitor');
  }
  const uniqueSellers = new Set(competitors.map((c) => c.sellerUsername));
  if (competitors.length >= 2 && uniqueSellers.size === 1) {
    warnings.push('all_same_seller');
  }
  return warnings;
}

function buildMarketplaceSearchUrl(ean: string): string {
  const params = new URLSearchParams({ _nkw: ean, LH_BIN: '1', _sop: '15' });
  return `${MARKETPLACE_SEARCH_URL_BASE}?${params.toString()}`;
}

export interface EbayBrowseProviderOptions {
  /** Override for tests — defaults to Date.now(). */
  readonly now?: () => Date;
}

/**
 * MarketDataProvider backed by the eBay Browse API. Filters for DE marketplace,
 * NEW condition, fixed-price listings only. Returns a snapshot with up to 20
 * competitors sorted by total price ascending.
 */
export function createEbayBrowseProvider(
  browse: BrowseClient,
  options: EbayBrowseProviderOptions = {}
): MarketDataProvider {
  const now = options.now ?? (() => new Date());

  return {
    name: 'ebay_browse_de',

    async getLowestPriceByEan(ean) {
      const result = await browse.searchItems({
        q: ean,
        filter: BROWSE_FILTER,
        sort: 'price',
        limit: MAX_COMPETITORS,
        marketplaceId: 'EBAY_DE',
      });

      // Keep only EUR quotes — defensive: marketplace filter pins currency, but
      // occasional promotional items slip through with other currencies.
      const eurItems = result.items.filter((i) => i.priceCurrency === 'EUR');

      // Sort by total (price + shipping) so "lowest" reflects buyer-visible total,
      // not just the raw item price that may hide a big shipping surcharge.
      const competitors = eurItems.map(toCompetitor).sort((a, b) => a.totalPrice - b.totalPrice);

      const snapshot: MarketSnapshot = {
        ean,
        fetchedAt: now(),
        marketplace: 'EBAY_DE',
        competitorCount: competitors.length,
        lowestPrice: competitors[0]?.totalPrice ?? null,
        medianPrice: median(competitors.map((c) => c.totalPrice)),
        currency: 'EUR',
        marketplaceSearchUrl: buildMarketplaceSearchUrl(ean),
        competitors,
        warnings: detectWarnings(competitors),
      };
      return snapshot;
    },
  };
}
