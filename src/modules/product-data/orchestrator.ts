import type { GpsrOverrideLookup } from './gpsrOverride';
import { mergeProductData, type EnrichedProduct } from './merge';
import type { ProductData, ProductSource, ProductSourceName } from './types';

export interface SourceError {
  readonly source: ProductSourceName;
  readonly error: unknown;
}

export interface EnrichResult {
  readonly data: EnrichedProduct | null;
  readonly sourcesAttempted: readonly ProductSourceName[];
  readonly sourcesWithData: readonly ProductSourceName[];
  readonly sourceErrors: readonly SourceError[];
  readonly gpsrOverrideApplied: boolean;
}

export interface EnrichOptions {
  readonly ean: string;
  readonly sources: readonly ProductSource[];
  /** Optional GPSR-fallback: consulted when merged GPSR is incomplete. */
  readonly gpsrOverrideLookup?: GpsrOverrideLookup;
}

interface SourceResult {
  readonly source: ProductSourceName;
  readonly data: ProductData | null;
  readonly error: unknown;
}

async function callSource(source: ProductSource, ean: string): Promise<SourceResult> {
  try {
    const data = await source.fetchByEan(ean);
    return { source: source.name, data, error: null };
  } catch (error) {
    return { source: source.name, data: null, error };
  }
}

function hasIncompleteGpsr(merged: EnrichedProduct): boolean {
  if (merged.gpsrData === null) return true;
  return (
    merged.gpsrData.manufacturerName === null ||
    merged.gpsrData.manufacturerAddress === null ||
    merged.gpsrData.manufacturerEmail === null
  );
}

function applyGpsrOverride(
  merged: EnrichedProduct,
  override: NonNullable<EnrichedProduct['gpsrData']>
): EnrichedProduct {
  const current = merged.gpsrData ?? {
    manufacturerName: null,
    manufacturerAddress: null,
    manufacturerEmail: null,
  };
  const sourceMetadata: Record<string, ProductSourceName> = { ...merged.sourceMetadata };
  const filled = { ...current };

  if (filled.manufacturerName === null && override.manufacturerName !== null) {
    filled.manufacturerName = override.manufacturerName;
    sourceMetadata['gpsr.manufacturerName'] = 'manual';
  }
  if (filled.manufacturerAddress === null && override.manufacturerAddress !== null) {
    filled.manufacturerAddress = override.manufacturerAddress;
    sourceMetadata['gpsr.manufacturerAddress'] = 'manual';
  }
  if (filled.manufacturerEmail === null && override.manufacturerEmail !== null) {
    filled.manufacturerEmail = override.manufacturerEmail;
    sourceMetadata['gpsr.manufacturerEmail'] = 'manual';
  }

  return { ...merged, gpsrData: filled, sourceMetadata };
}

/**
 * Multi-source product-data enrichment.
 *
 * 1. Calls every registered source in parallel. Each source is isolated — a
 *    throw or timeout from one does not abort the others.
 * 2. Merges successful results via `mergeProductData` (highest quality wins).
 * 3. If the merged GPSR record is incomplete AND we know the brand AND a
 *    `gpsrOverrideLookup` was provided, fills remaining null fields from the
 *    DB-backed override table. `source` for filled fields becomes `manual`.
 *
 * Returns a structured report — not just the merged data — so callers can
 * log which sources errored and whether the override table was consulted.
 */
export async function enrichProductByEan(options: EnrichOptions): Promise<EnrichResult> {
  const results = await Promise.all(options.sources.map((s) => callSource(s, options.ean)));

  const sourcesAttempted = results.map((r) => r.source);
  const sourceErrors: SourceError[] = results
    .filter((r) => r.error !== null)
    .map((r) => ({ source: r.source, error: r.error }));
  const successfulData = results.map((r) => r.data).filter((d): d is ProductData => d !== null);
  const sourcesWithData = successfulData.map((d) => d.source);

  const merged = mergeProductData(successfulData);
  let final = merged;
  let gpsrOverrideApplied = false;

  if (final?.brand != null && hasIncompleteGpsr(final) && options.gpsrOverrideLookup) {
    const override = await options.gpsrOverrideLookup(final.brand);
    if (override !== null) {
      final = applyGpsrOverride(final, override);
      gpsrOverrideApplied = true;
    }
  }

  return {
    data: final,
    sourcesAttempted,
    sourcesWithData,
    sourceErrors,
    gpsrOverrideApplied,
  };
}
