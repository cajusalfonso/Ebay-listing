import { z } from 'zod';
import type { EbayHttpClient } from './httpClient';

const imageSchema = z.object({
  imageUrl: z.string().url(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

const aspectSchema = z.object({
  localizedName: z.string().min(1),
  localizedValues: z.array(z.string()).min(1),
});

const categoryAncestorSchema = z.object({
  categoryId: z.string().optional(),
  categoryName: z.string().optional(),
});

const productSummarySchema = z.object({
  epid: z.string().min(1),
  title: z.string().min(1),
  brand: z.string().optional(),
  mpn: z.string().optional(),
  gtin: z.array(z.string()).optional(),
  image: imageSchema.optional(),
  additionalImages: z.array(imageSchema).optional(),
  aspects: z.array(aspectSchema).optional(),
  productWebUrl: z.string().optional(),
  categoryAncestors: z.array(categoryAncestorSchema).optional(),
  description: z.string().optional(),
});

const searchResponseSchema = z.object({
  productSummaries: z.array(productSummarySchema).optional(),
  total: z.number().int().nonnegative().optional(),
});

/** Same body returned by GET /product/{epid} — superset of summary with richer description. */
const productDetailsResponseSchema = productSummarySchema;

export interface CatalogImage {
  readonly url: string;
  readonly width: number | null;
  readonly height: number | null;
}

export interface CatalogAspect {
  readonly name: string;
  readonly values: readonly string[];
}

export interface CatalogProduct {
  readonly epid: string;
  readonly title: string;
  readonly brand: string | null;
  readonly mpn: string | null;
  readonly gtins: readonly string[];
  readonly primaryImage: CatalogImage | null;
  readonly additionalImages: readonly CatalogImage[];
  readonly aspects: readonly CatalogAspect[];
  readonly description: string | null;
  /** The MOST SPECIFIC (leaf) eBay category for this product, derived from the ancestor chain. */
  readonly leafCategoryId: string | null;
  readonly leafCategoryName: string | null;
  readonly productWebUrl: string | null;
}

export interface CatalogClient {
  searchByGtin(gtin: string): Promise<CatalogProduct[]>;
  getProduct(epid: string): Promise<CatalogProduct>;
}

function toImage(raw: {
  imageUrl: string;
  width?: number | undefined;
  height?: number | undefined;
}): CatalogImage {
  return {
    url: raw.imageUrl,
    width: raw.width ?? null,
    height: raw.height ?? null,
  };
}

function normalize(summary: z.infer<typeof productSummarySchema>): CatalogProduct {
  const ancestors = summary.categoryAncestors ?? [];
  // eBay returns ancestors root-first, so the LAST entry is the most specific.
  const leaf = ancestors.length > 0 ? ancestors[ancestors.length - 1] : undefined;
  return {
    epid: summary.epid,
    title: summary.title,
    brand: summary.brand ?? null,
    mpn: summary.mpn ?? null,
    gtins: summary.gtin ?? [],
    primaryImage: summary.image ? toImage(summary.image) : null,
    additionalImages: (summary.additionalImages ?? []).map(toImage),
    aspects: (summary.aspects ?? []).map((a) => ({
      name: a.localizedName,
      values: a.localizedValues,
    })),
    description: summary.description ?? null,
    leafCategoryId: leaf?.categoryId ?? null,
    leafCategoryName: leaf?.categoryName ?? null,
    productWebUrl: summary.productWebUrl ?? null,
  };
}

export function createCatalogClient(http: EbayHttpClient): CatalogClient {
  return {
    async searchByGtin(gtin) {
      const response = await http.get(
        '/commerce/catalog/v1_beta/product_summary/search',
        searchResponseSchema,
        { query: { gtin, limit: 5 } }
      );
      return (response.productSummaries ?? []).map(normalize);
    },

    async getProduct(epid) {
      const response = await http.get(
        `/commerce/catalog/v1_beta/product/${encodeURIComponent(epid)}`,
        productDetailsResponseSchema
      );
      return normalize(response);
    },
  };
}
