import { eq } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { gpsrManufacturerOverrides } from '../../db/schema';
import type { GpsrData } from './types';

export type GpsrOverrideLookup = (brand: string) => Promise<GpsrData | null>;

/**
 * Build a brand-keyed GPSR lookup backed by the `gpsr_manufacturer_overrides`
 * table. Returns null when the brand isn't in the table OR when the row has
 * no usable fields (all three null).
 *
 * Used as a fallback after merging sources — if neither eBay Catalog nor Icecat
 * provides a complete GPSR record, the orchestrator queries this to fill gaps.
 */
export function createGpsrOverrideLookup(db: Database): GpsrOverrideLookup {
  return async (brand: string) => {
    if (brand.trim() === '') return null;
    const rows = await db
      .select()
      .from(gpsrManufacturerOverrides)
      .where(eq(gpsrManufacturerOverrides.brand, brand))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    if (row.name === null && row.address === null && row.email === null) return null;
    return {
      manufacturerName: row.name,
      manufacturerAddress: row.address,
      manufacturerEmail: row.email,
    };
  };
}
