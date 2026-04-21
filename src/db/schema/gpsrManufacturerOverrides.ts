import { pgTable, text } from 'drizzle-orm/pg-core';

/**
 * Fallback GPSR data keyed by Brand when the primary ProductSource
 * (Icecat, eBay Catalog) does not supply a complete set.
 *
 * Populated manually or via admin import. If neither source nor override
 * yields `name + address + email`, the Compliance Gate blocks the listing —
 * never silent-fail (GPSR is legally required in EU).
 */
export const gpsrManufacturerOverrides = pgTable('gpsr_manufacturer_overrides', {
  brand: text('brand').primaryKey(),
  name: text('name'),
  address: text('address'),
  email: text('email'),
  euResponsiblePerson: text('eu_responsible_person'),
});

export type GpsrManufacturerOverride = typeof gpsrManufacturerOverrides.$inferSelect;
export type NewGpsrManufacturerOverride = typeof gpsrManufacturerOverrides.$inferInsert;
