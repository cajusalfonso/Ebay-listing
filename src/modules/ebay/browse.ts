import { z } from 'zod';
import type { EbayHttpClient } from './httpClient';

const priceSchema = z.object({
  value: z.string(),
  currency: z.string(),
});

const shippingOptionSchema = z.object({
  shippingCost: priceSchema.optional(),
  shippingCostType: z.string().optional(),
});

const sellerSchema = z.object({
  username: z.string(),
  feedbackScore: z.number().optional(),
  feedbackPercentage: z.string().optional(),
});

const itemLocationSchema = z.object({
  country: z.string().optional(),
});

const itemSummarySchema = z.object({
  itemId: z.string(),
  title: z.string(),
  price: priceSchema,
  shippingOptions: z.array(shippingOptionSchema).optional(),
  seller: sellerSchema.optional(),
  condition: z.string().optional(),
  conditionId: z.string().optional(),
  buyingOptions: z.array(z.string()).optional(),
  itemWebUrl: z.string().optional(),
  itemLocation: itemLocationSchema.optional(),
});

const searchResponseSchema = z.object({
  itemSummaries: z.array(itemSummarySchema).optional(),
  total: z.number().int().nonnegative().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
  href: z.string().optional(),
});

export interface BrowseSearchParams {
  readonly q: string;
  /** Filter expression — comma-separated key:{value} pairs per eBay Browse docs. */
  readonly filter?: string;
  /** `price` for ascending, `-price` for descending, etc. */
  readonly sort?: string;
  readonly limit?: number;
  readonly marketplaceId?: string;
}

export interface BrowseItem {
  readonly itemId: string;
  readonly title: string;
  readonly priceValue: number;
  readonly priceCurrency: string;
  /** Null when the item ships for free OR shipping cost is not published. */
  readonly shippingCost: number | null;
  readonly sellerUsername: string;
  /** 0 when the seller hides feedback score or for brand-new sellers. */
  readonly sellerFeedbackScore: number;
  /** Human label like 'New', 'New other (see details)', 'Used' — or '' if absent. */
  readonly condition: string;
  readonly itemWebUrl: string | null;
  readonly itemLocationCountry: string | null;
}

export interface BrowseSearchResult {
  readonly total: number;
  readonly items: readonly BrowseItem[];
}

export interface BrowseClient {
  searchItems(params: BrowseSearchParams): Promise<BrowseSearchResult>;
}

function firstShippingCost(
  shippingOptions:
    | readonly { shippingCost?: { value: string; currency: string } | undefined }[]
    | undefined
): number | null {
  if (!shippingOptions) return null;
  const first = shippingOptions.find((o) => o.shippingCost !== undefined);
  if (!first?.shippingCost) return null;
  const parsed = Number.parseFloat(first.shippingCost.value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function createBrowseClient(http: EbayHttpClient): BrowseClient {
  return {
    async searchItems(params) {
      const response = await http.get('/buy/browse/v1/item_summary/search', searchResponseSchema, {
        query: {
          q: params.q,
          filter: params.filter,
          sort: params.sort,
          limit: params.limit,
        },
        ...(params.marketplaceId === undefined ? {} : { marketplaceId: params.marketplaceId }),
      });

      const items: BrowseItem[] = (response.itemSummaries ?? []).map((s) => ({
        itemId: s.itemId,
        title: s.title,
        priceValue: Number.parseFloat(s.price.value),
        priceCurrency: s.price.currency,
        shippingCost: firstShippingCost(s.shippingOptions),
        sellerUsername: s.seller?.username ?? 'unknown',
        sellerFeedbackScore: s.seller?.feedbackScore ?? 0,
        condition: s.condition ?? '',
        itemWebUrl: s.itemWebUrl ?? null,
        itemLocationCountry: s.itemLocation?.country ?? null,
      }));

      return {
        total: response.total ?? items.length,
        items,
      };
    },
  };
}
