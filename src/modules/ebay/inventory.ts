import { z } from 'zod';
import type { EbayHttpClient } from './httpClient';

/**
 * eBay condition enum — values recognized by Inventory API. Phase 1 MVP only
 * ever lists NEW; others listed here for completeness and to help lint catch
 * typos if we ever extend to used goods.
 */
export type EbayCondition =
  | 'NEW'
  | 'NEW_OTHER'
  | 'NEW_WITH_DEFECTS'
  | 'MANUFACTURER_REFURBISHED'
  | 'SELLER_REFURBISHED'
  | 'USED_EXCELLENT'
  | 'USED_VERY_GOOD'
  | 'USED_GOOD'
  | 'USED_ACCEPTABLE';

export interface CreateInventoryItemInput {
  readonly sku: string;
  readonly title: string;
  readonly description: string;
  readonly condition: EbayCondition;
  /**
   * Aspects in eBay's flat-array format. Values MUST be arrays even when single
   * (e.g. `{ Marke: ['Bosch'] }`). Use `Taxonomy.getItemAspectsForCategory` to
   * know which keys are required.
   */
  readonly aspects: Readonly<Record<string, readonly string[]>>;
  readonly imageUrls: readonly string[];
  readonly brand?: string;
  readonly mpn?: string;
  /** GTIN (EAN/UPC/ISBN) — passed as `ean`/`upc` per eBay's API. */
  readonly ean?: string;
  readonly quantity: number;
}

export interface CreateOfferInput {
  readonly sku: string;
  readonly categoryId: string;
  readonly priceValueEur: number;
  readonly listingDescription: string;
  readonly marketplaceId?: string;
  readonly fulfillmentPolicyId: string;
  readonly paymentPolicyId: string;
  readonly returnPolicyId: string;
  /** Seller-defined inventory location key. See Account API — must already exist. */
  readonly merchantLocationKey: string;
  /** Cap per-buyer quantity; optional. */
  readonly quantityLimitPerBuyer?: number;
}

const createOfferResponseSchema = z.object({
  offerId: z.string().min(1),
});

const publishOfferResponseSchema = z.object({
  listingId: z.string().min(1),
  warnings: z.array(z.unknown()).optional(),
});

const inventoryItemPutResponseSchema = z.unknown();

export interface InventoryClient {
  /**
   * Idempotent create-or-update. Uses `PUT /sell/inventory/v1/inventory_item/{sku}`
   * which returns 204 on success. Throws EbayApiError on any 4xx/5xx (wrapping
   * eBay's Error payload for debugging).
   */
  createOrUpdateInventoryItem(input: CreateInventoryItemInput): Promise<void>;
  /** Returns the newly-minted offerId. */
  createOffer(input: CreateOfferInput): Promise<{ offerId: string }>;
  /** Publishes a draft offer → returns the live eBay listingId. */
  publishOffer(offerId: string): Promise<{ listingId: string }>;
}

function formatEurPrice(value: number): string {
  // eBay expects "19.90" style with 2 decimals, no currency symbol.
  return value.toFixed(2);
}

function buildInventoryItemBody(input: CreateInventoryItemInput): unknown {
  const aspects: Record<string, readonly string[]> = { ...input.aspects };
  const product: Record<string, unknown> = {
    title: input.title,
    description: input.description,
    aspects,
    imageUrls: input.imageUrls,
  };
  if (input.brand) product.brand = input.brand;
  if (input.mpn) product.mpn = input.mpn;
  if (input.ean) product.ean = [input.ean];

  return {
    condition: input.condition,
    product,
    availability: { shipToLocationAvailability: { quantity: input.quantity } },
  };
}

function buildOfferBody(input: CreateOfferInput): unknown {
  const body: Record<string, unknown> = {
    sku: input.sku,
    marketplaceId: input.marketplaceId ?? 'EBAY_DE',
    format: 'FIXED_PRICE',
    availableQuantity: 1,
    categoryId: input.categoryId,
    listingDescription: input.listingDescription,
    merchantLocationKey: input.merchantLocationKey,
    pricingSummary: {
      price: { value: formatEurPrice(input.priceValueEur), currency: 'EUR' },
    },
    listingPolicies: {
      fulfillmentPolicyId: input.fulfillmentPolicyId,
      paymentPolicyId: input.paymentPolicyId,
      returnPolicyId: input.returnPolicyId,
    },
  };
  if (input.quantityLimitPerBuyer !== undefined) {
    body.quantityLimitPerBuyer = input.quantityLimitPerBuyer;
  }
  return body;
}

export function createInventoryClient(http: EbayHttpClient): InventoryClient {
  return {
    async createOrUpdateInventoryItem(input) {
      await http.put(
        `/sell/inventory/v1/inventory_item/${encodeURIComponent(input.sku)}`,
        buildInventoryItemBody(input),
        inventoryItemPutResponseSchema,
        { extraHeaders: { 'content-language': 'de-DE' } }
      );
    },

    async createOffer(input) {
      const response = await http.post(
        '/sell/inventory/v1/offer',
        buildOfferBody(input),
        createOfferResponseSchema,
        { extraHeaders: { 'content-language': 'de-DE' } }
      );
      return { offerId: response.offerId };
    },

    async publishOffer(offerId) {
      const response = await http.post(
        `/sell/inventory/v1/offer/${encodeURIComponent(offerId)}/publish`,
        {},
        publishOfferResponseSchema
      );
      return { listingId: response.listingId };
    },
  };
}
