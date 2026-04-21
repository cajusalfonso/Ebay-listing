import type { GpsrData, ProductData, ProductImage, ProductSourceName } from './types';

/** Result of merging multiple ProductData records into one. */
export interface EnrichedProduct {
  readonly primarySource: ProductSourceName;
  readonly ean: string;
  readonly title: string;
  readonly brand: string | null;
  readonly mpn: string | null;
  readonly description: string | null;
  readonly specs: Readonly<Record<string, string>>;
  readonly images: readonly ProductImage[];
  readonly suggestedCategoryId: string | null;
  readonly qualityScore: number;
  readonly gpsrData: GpsrData | null;
  /**
   * Per-field provenance: `{ title: "ebay_catalog", description: "icecat", ... }`.
   * Persisted into `products.source_metadata` for audit.
   */
  readonly sourceMetadata: Readonly<Record<string, ProductSourceName>>;
}

/** Keys merged scalar-by-scalar. */
type ScalarKey = 'title' | 'brand' | 'mpn' | 'description' | 'suggestedCategoryId';

function sortByQuality(data: readonly ProductData[]): ProductData[] {
  // Stable sort — original array order breaks qualityScore ties (i.e. Catalog
  // before Icecat when they both report equal scores).
  return [...data].sort((a, b) => b.qualityScore - a.qualityScore);
}

function firstWithField<T>(
  sorted: readonly ProductData[],
  pick: (p: ProductData) => T | null
): { value: T; source: ProductSourceName } | null {
  for (const p of sorted) {
    const value = pick(p);
    if (value !== null) return { value, source: p.source };
  }
  return null;
}

function dedupeImagesByUrl(images: readonly ProductImage[]): ProductImage[] {
  const seen = new Set<string>();
  const out: ProductImage[] = [];
  for (const img of images) {
    if (seen.has(img.url)) continue;
    seen.add(img.url);
    out.push(img);
  }
  return out;
}

function mergeSpecs(sorted: readonly ProductData[]): {
  specs: Record<string, string>;
  origin: Record<string, ProductSourceName>;
} {
  const specs: Record<string, string> = {};
  const origin: Record<string, ProductSourceName> = {};
  for (const source of sorted) {
    for (const [key, value] of Object.entries(source.specs)) {
      if (specs[key] !== undefined) continue; // higher-priority source already set it
      specs[key] = value;
      origin[key] = source.source;
    }
  }
  return { specs, origin };
}

function mergeGpsr(sorted: readonly ProductData[]): {
  gpsr: GpsrData | null;
  origin: Record<string, ProductSourceName>;
} {
  const origin: Record<string, ProductSourceName> = {};
  let name: string | null = null;
  let address: string | null = null;
  let email: string | null = null;

  for (const source of sorted) {
    const gpsr = source.gpsrData;
    if (!gpsr) continue;
    if (name === null && gpsr.manufacturerName !== null) {
      name = gpsr.manufacturerName;
      origin['gpsr.manufacturerName'] = source.source;
    }
    if (address === null && gpsr.manufacturerAddress !== null) {
      address = gpsr.manufacturerAddress;
      origin['gpsr.manufacturerAddress'] = source.source;
    }
    if (email === null && gpsr.manufacturerEmail !== null) {
      email = gpsr.manufacturerEmail;
      origin['gpsr.manufacturerEmail'] = source.source;
    }
  }

  if (name === null && address === null && email === null) {
    return { gpsr: null, origin };
  }
  return {
    gpsr: { manufacturerName: name, manufacturerAddress: address, manufacturerEmail: email },
    origin,
  };
}

/**
 * Merge multiple ProductData records (from different sources) into a single
 * EnrichedProduct using "highest quality wins, missing fields fill from below"
 * semantics.
 *
 *   - Scalar fields (title, brand, mpn, description, suggestedCategoryId):
 *     take from the highest-quality source that has a non-null value. If the
 *     primary source has it, lower-quality sources are ignored for that field.
 *   - specs: per-key first-wins. `ebay_catalog` aspects override Icecat's features.
 *   - images: concatenation in quality order, deduped by URL (first occurrence kept).
 *   - gpsrData: per-sub-field first-non-null across ALL sources (so Catalog's
 *     empty GPSR doesn't block Icecat's partial GPSR from contributing).
 *   - qualityScore: the primary's score (equivalently: max of all).
 *   - sourceMetadata: per-scalar-field + spec-key + gpsr-subfield provenance map.
 *
 * Returns `null` when input has zero ProductData records — orchestrator treats
 * that as "no source produced a match".
 *
 * Pure: no I/O, no mutation of inputs. Fully deterministic.
 */
export function mergeProductData(data: readonly ProductData[]): EnrichedProduct | null {
  if (data.length === 0) return null;
  const sorted = sortByQuality(data);
  const primary = sorted[0];
  if (!primary) return null; // satisfies noUncheckedIndexedAccess; unreachable after length check

  const sourceMetadata: Record<string, ProductSourceName> = {
    primary: primary.source,
  };

  const pickers: { key: ScalarKey; pick: (p: ProductData) => string | null }[] = [
    { key: 'title', pick: (p) => p.title },
    { key: 'brand', pick: (p) => p.brand },
    { key: 'mpn', pick: (p) => p.mpn },
    { key: 'description', pick: (p) => p.description },
    { key: 'suggestedCategoryId', pick: (p) => p.suggestedCategoryId },
  ];

  const scalars: Record<ScalarKey, string | null> = {
    title: primary.title, // required on ProductData — always non-null here
    brand: null,
    mpn: null,
    description: null,
    suggestedCategoryId: null,
  };
  for (const { key, pick } of pickers) {
    const hit = firstWithField(sorted, pick);
    if (hit) {
      scalars[key] = hit.value;
      sourceMetadata[key] = hit.source;
    }
  }

  const { specs, origin: specOrigin } = mergeSpecs(sorted);
  for (const [k, v] of Object.entries(specOrigin)) {
    sourceMetadata[`specs.${k}`] = v;
  }

  const allImages = sorted.flatMap((s) => s.images);
  const images = dedupeImagesByUrl(allImages);

  const { gpsr, origin: gpsrOrigin } = mergeGpsr(sorted);
  for (const [k, v] of Object.entries(gpsrOrigin)) {
    sourceMetadata[k] = v;
  }

  return {
    primarySource: primary.source,
    ean: primary.ean,
    title: scalars.title ?? primary.title,
    brand: scalars.brand,
    mpn: scalars.mpn,
    description: scalars.description,
    specs,
    images,
    suggestedCategoryId: scalars.suggestedCategoryId,
    qualityScore: primary.qualityScore,
    gpsrData: gpsr,
    sourceMetadata,
  };
}
