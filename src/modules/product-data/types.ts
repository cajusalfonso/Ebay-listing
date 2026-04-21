export type ProductSourceName = 'ebay_catalog' | 'icecat' | 'upcitemdb' | 'manual';

export interface ProductImage {
  readonly url: string;
  /** null when the source does not publish dimensions. */
  readonly width: number | null;
  readonly height: number | null;
  /**
   * `true` only for Tier-1 sources (`ebay_catalog`, `icecat`). Hardcoded upstream
   * so compliance cannot be bypassed by mistake. UPCitemDB / manual are always false
   * until a human reviewer flips the flag.
   */
  readonly licensed: boolean;
  /** Which source produced this image — drives the `product_images.source` column. */
  readonly source: ProductSourceName;
}

export interface GpsrData {
  readonly manufacturerName: string | null;
  readonly manufacturerAddress: string | null;
  readonly manufacturerEmail: string | null;
}

/**
 * Common shape returned by every ProductSource. The enrichment orchestrator
 * (Schritt 3.10) merges multiple ProductData values into one final record.
 */
export interface ProductData {
  readonly source: ProductSourceName;
  readonly ean: string;
  readonly title: string;
  readonly brand: string | null;
  readonly mpn: string | null;
  readonly description: string | null;
  /** Aspect name → value (e.g. { "Marke": "Bosch", "Farbe": "Blau" }). */
  readonly specs: Readonly<Record<string, string>>;
  readonly images: readonly ProductImage[];
  /** eBay category id the source best-guesses. null when not a category-aware source. */
  readonly suggestedCategoryId: string | null;
  /** 0–100 confidence. Set by each source adapter; compared during merge. */
  readonly qualityScore: number;
  readonly gpsrData: GpsrData | null;
}

/**
 * Port interface — each adapter implements this and gets registered with the
 * orchestrator. `priority` breaks ties between sources that report the same
 * quality score for a given EAN (lower = preferred).
 */
export interface ProductSource {
  readonly name: ProductSourceName;
  readonly priority: number;
  /**
   * Returns null (not throws) when the source simply has no match for the EAN.
   * Throws only on genuine infrastructure errors (network, auth, schema breach).
   */
  fetchByEan(ean: string): Promise<ProductData | null>;
}
