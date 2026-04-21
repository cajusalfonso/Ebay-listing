import type { CatalogClient, CatalogImage, CatalogProduct } from '../../ebay/catalog';
import type { ProductData, ProductImage, ProductSource } from '../types';

/** eBay Catalog is a Tier-1 licensed source — images get `licensed: true`. */
const QUALITY_SCORE = 90;
const PRIORITY = 1;

function toProductImage(img: CatalogImage): ProductImage {
  return {
    url: img.url,
    width: img.width,
    height: img.height,
    licensed: true,
    source: 'ebay_catalog',
  };
}

function collectImages(p: CatalogProduct): ProductImage[] {
  const images: ProductImage[] = [];
  if (p.primaryImage) images.push(toProductImage(p.primaryImage));
  for (const img of p.additionalImages) {
    images.push(toProductImage(img));
  }
  return images;
}

/**
 * Collapse eBay's multi-value aspects into a single-value specs record.
 * When a key has >1 value, join with " / " — good enough for display and
 * substring-based keyword matching. Rare in practice for required aspects.
 */
function aspectsToSpecs(p: CatalogProduct): Record<string, string> {
  const specs: Record<string, string> = {};
  for (const aspect of p.aspects) {
    if (aspect.values.length === 0) continue;
    specs[aspect.name] = aspect.values.join(' / ');
  }
  return specs;
}

/**
 * ProductSource adapter over the eBay Catalog API. Catalog has the richest
 * metadata for a successful GTIN match: title, brand, MPN, native eBay
 * category id, and Taxonomy-aligned aspect names.
 *
 * Returns `null` (not throws) when the EAN is not in the Catalog — the
 * enrichment orchestrator then falls through to Icecat.
 *
 * Caveat: Catalog has NO GPSR data (no manufacturer address / email), so
 * `gpsrData` is always null here. GPSR must come from Icecat or the manual
 * override table, enforced by the Compliance Gate.
 */
export function createEbayCatalogSource(catalog: CatalogClient): ProductSource {
  return {
    name: 'ebay_catalog',
    priority: PRIORITY,

    async fetchByEan(ean) {
      const products = await catalog.searchByGtin(ean);
      const product = products[0];
      if (!product) return null;

      const data: ProductData = {
        source: 'ebay_catalog',
        ean,
        title: product.title,
        brand: product.brand,
        mpn: product.mpn,
        description: product.description,
        specs: aspectsToSpecs(product),
        images: collectImages(product),
        suggestedCategoryId: product.leafCategoryId,
        qualityScore: QUALITY_SCORE,
        gpsrData: null,
      };
      return data;
    },
  };
}
