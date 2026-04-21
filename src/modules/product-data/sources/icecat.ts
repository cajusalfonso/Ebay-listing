import type { GpsrData, ProductData, ProductImage, ProductSource } from '../types';
import type { IcecatClient, IcecatImage, IcecatProduct } from './icecatClient';

const PRIORITY = 2;

function toProductImage(img: IcecatImage): ProductImage {
  return {
    url: img.url,
    width: img.width,
    height: img.height,
    licensed: true,
    source: 'icecat',
  };
}

/**
 * Quality score 70–85, rising with completeness:
 *   base 70, + brand (3), + long-desc (5), + ≥2 images (3), + manufacturer-address (4).
 * Capped at 85 — Catalog (90) always wins when both hit.
 */
function computeQualityScore(product: IcecatProduct): number {
  let score = 70;
  if (product.brand) score += 3;
  if (product.longDescription && product.longDescription.length >= 100) score += 5;
  if (product.images.length >= 2) score += 3;
  if (product.supplier.address) score += 4;
  return Math.min(85, score);
}

function buildGpsr(product: IcecatProduct): GpsrData | null {
  const s = product.supplier;
  if (!s.name && !s.address && !s.email) return null;
  return {
    manufacturerName: s.name,
    manufacturerAddress: s.address,
    manufacturerEmail: s.email,
  };
}

function preferLongOverShortDescription(product: IcecatProduct): string | null {
  return product.longDescription ?? product.shortDescription;
}

/**
 * ProductSource adapter over the Icecat Open Catalog. Strengths:
 *   - Often has manufacturer name → partial GPSR data (address/email rare).
 *   - Rich product photography.
 *   - Long descriptions useful for eBay listing body.
 * Weaknesses vs. eBay Catalog:
 *   - No eBay-native category id, so `suggestedCategoryId` is always null.
 *   - No eBay-aligned aspect names, so `specs` is empty (for MVP — Phase 2
 *     could harvest Icecat features with a name-mapping table).
 */
export function createIcecatSource(client: IcecatClient): ProductSource {
  return {
    name: 'icecat',
    priority: PRIORITY,

    async fetchByEan(ean) {
      const product = await client.fetchByEan(ean);
      if (!product) return null;
      if (product.title === null) {
        // Icecat sometimes returns a stub row for GTIN-only records with no data.
        // Treat that as "no useful match" rather than publish with empty title.
        return null;
      }

      const data: ProductData = {
        source: 'icecat',
        ean,
        title: product.title,
        brand: product.brand,
        mpn: product.mpn,
        description: preferLongOverShortDescription(product),
        specs: {},
        images: product.images.map(toProductImage),
        suggestedCategoryId: null,
        qualityScore: computeQualityScore(product),
        gpsrData: buildGpsr(product),
      };
      return data;
    },
  };
}
