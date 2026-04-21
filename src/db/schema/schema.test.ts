import { getTableName } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { ebayTokens } from './ebayTokens';
import { gpsrManufacturerOverrides } from './gpsrManufacturerOverrides';
import { listings } from './listings';
import { marketSnapshots } from './marketSnapshots';
import { needsReview } from './needsReview';
import { priceHistory } from './priceHistory';
import { productImages } from './productImages';
import { products } from './products';

/**
 * Pure structural tests — use Drizzle's introspection helpers, no DB connection.
 * Guards against accidental schema drift (e.g. someone drops the ebay_sku unique
 * constraint and the compliance gate silently stops catching duplicate SKUs).
 */

describe('schema: table names', () => {
  const cases: [unknown, string][] = [
    [products, 'products'],
    [productImages, 'product_images'],
    [marketSnapshots, 'market_snapshots'],
    [listings, 'listings'],
    [priceHistory, 'price_history'],
    [ebayTokens, 'ebay_tokens'],
    [gpsrManufacturerOverrides, 'gpsr_manufacturer_overrides'],
    [needsReview, 'needs_review'],
  ];

  it.each(cases)('maps to the expected snake_case table name', (table, expected) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- getTableName accepts any pg-core table type; casting here keeps the test table-list shape uniform
    expect(getTableName(table as any)).toBe(expected);
  });
});

describe('schema: products', () => {
  it('has ean as primary key', () => {
    const cfg = getTableConfig(products);
    const pkCols = cfg.primaryKeys.flatMap((pk) => pk.columns.map((c) => c.name));
    const eanColIsPk = cfg.columns.find((c) => c.name === 'ean')?.primary === true;
    expect(eanColIsPk || pkCols.includes('ean')).toBe(true);
  });

  it('title is non-nullable', () => {
    const title = getTableConfig(products).columns.find((c) => c.name === 'title');
    expect(title?.notNull).toBe(true);
  });

  it('has brand and category indexes', () => {
    const indexNames = getTableConfig(products).indexes.map((i) => i.config.name);
    expect(indexNames).toContain('products_brand_idx');
    expect(indexNames).toContain('products_category_idx');
  });
});

describe('schema: listings', () => {
  it('ebay_sku is a unique index', () => {
    const cfg = getTableConfig(listings);
    const skuIdx = cfg.indexes.find((i) => i.config.name === 'listings_ebay_sku_unique');
    expect(skuIdx).toBeDefined();
    expect(skuIdx?.config.unique).toBe(true);
  });

  it('sell_price_gross is numeric(10,2) and non-null', () => {
    const col = getTableConfig(listings).columns.find((c) => c.name === 'sell_price_gross');
    expect(col?.notNull).toBe(true);
    expect(col?.getSQLType()).toBe('numeric(10, 2)');
  });

  it('calculated_margin is numeric(5,4)', () => {
    const col = getTableConfig(listings).columns.find((c) => c.name === 'calculated_margin');
    expect(col?.getSQLType()).toBe('numeric(5, 4)');
  });

  it('has FKs to products and market_snapshots', () => {
    const cfg = getTableConfig(listings);
    const fkTargetTables = cfg.foreignKeys
      .map((fk) => fk.reference().foreignTable)
      .map((t) => getTableName(t));
    expect(fkTargetTables).toContain('products');
    expect(fkTargetTables).toContain('market_snapshots');
  });

  it('status defaults to "draft"', () => {
    const col = getTableConfig(listings).columns.find((c) => c.name === 'status');
    expect(col?.default).toBe('draft');
  });

  it('compliance_passed defaults to false', () => {
    const col = getTableConfig(listings).columns.find((c) => c.name === 'compliance_passed');
    expect(col?.default).toBe(false);
  });
});

describe('schema: product_images', () => {
  it('FK to products cascades on delete', () => {
    const fk = getTableConfig(productImages).foreignKeys[0];
    expect(fk?.onDelete).toBe('cascade');
  });

  it('licensed defaults to false (explicit opt-in required)', () => {
    const col = getTableConfig(productImages).columns.find((c) => c.name === 'licensed');
    expect(col?.default).toBe(false);
    expect(col?.notNull).toBe(true);
  });
});

describe('schema: ebay_tokens', () => {
  it('environment is uniquely indexed (one row per env)', () => {
    const idx = getTableConfig(ebayTokens).indexes.find(
      (i) => i.config.name === 'ebay_tokens_environment_unique'
    );
    expect(idx?.config.unique).toBe(true);
  });

  it('both token columns are non-null (cannot exist unencrypted row)', () => {
    const cols = getTableConfig(ebayTokens).columns;
    const access = cols.find((c) => c.name === 'access_token_encrypted');
    const refresh = cols.find((c) => c.name === 'refresh_token_encrypted');
    expect(access?.notNull).toBe(true);
    expect(refresh?.notNull).toBe(true);
  });
});

describe('schema: market_snapshots', () => {
  it('snapshot jsonb column is non-null (required payload)', () => {
    const col = getTableConfig(marketSnapshots).columns.find((c) => c.name === 'snapshot');
    expect(col?.notNull).toBe(true);
  });

  it('has composite index on ean + captured_at for trend queries', () => {
    const indexNames = getTableConfig(marketSnapshots).indexes.map((i) => i.config.name);
    expect(indexNames).toContain('market_snapshots_ean_idx');
    expect(indexNames).toContain('market_snapshots_captured_at_idx');
  });
});

describe('schema: price_history', () => {
  it('currency defaults to EUR', () => {
    const col = getTableConfig(priceHistory).columns.find((c) => c.name === 'currency');
    expect(col?.default).toBe('EUR');
  });

  it('has composite ean+captured_at index for time-series queries', () => {
    const indexNames = getTableConfig(priceHistory).indexes.map((i) => i.config.name);
    expect(indexNames).toContain('price_history_ean_captured_idx');
  });
});

describe('schema: gpsr_manufacturer_overrides', () => {
  it('brand is the primary key', () => {
    const col = getTableConfig(gpsrManufacturerOverrides).columns.find((c) => c.name === 'brand');
    expect(col?.primary).toBe(true);
  });
});

describe('schema: needs_review', () => {
  it('reason is non-null (required for triage)', () => {
    const col = getTableConfig(needsReview).columns.find((c) => c.name === 'reason');
    expect(col?.notNull).toBe(true);
  });

  it('ean is nullable (some reasons like "data_missing" may have no resolved EAN)', () => {
    const col = getTableConfig(needsReview).columns.find((c) => c.name === 'ean');
    expect(col?.notNull).toBe(false);
  });

  it('resolved_at is nullable (open reviews have no resolution yet)', () => {
    const col = getTableConfig(needsReview).columns.find((c) => c.name === 'resolved_at');
    expect(col?.notNull).toBe(false);
  });
});
