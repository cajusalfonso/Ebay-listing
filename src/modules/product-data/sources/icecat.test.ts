import { describe, expect, it } from 'vitest';
import { createIcecatSource } from './icecat';
import type { IcecatClient, IcecatProduct } from './icecatClient';

function stub(product: IcecatProduct | null): IcecatClient {
  return {
    fetchByEan: () => Promise.resolve(product),
  };
}

function product(overrides: Partial<IcecatProduct> = {}): IcecatProduct {
  return {
    ean: '4006381333115',
    title: 'Faber-Castell Bleistift Grip 2001',
    brand: 'Faber-Castell',
    mpn: 'FC-2001',
    shortDescription: 'kurz',
    longDescription:
      'Ein hochwertiger Bleistift mit ergonomischem Griff, ideal für ermüdungsfreies Schreiben und präzise Linien im täglichen Gebrauch.',
    categoryName: 'Bleistifte',
    supplier: {
      name: 'Faber-Castell',
      address: 'Nürnberger Str. 2, 90546 Stein, Germany',
      email: 'info@faber-castell.de',
    },
    images: [
      { url: 'https://img/primary.jpg', width: 800, height: 800, isMain: true },
      { url: 'https://img/alt1.jpg', width: 1200, height: 900, isMain: false },
    ],
    ...overrides,
  };
}

describe('createIcecatSource — identity', () => {
  it('exposes name=icecat and priority=2', () => {
    const src = createIcecatSource(stub(null));
    expect(src.name).toBe('icecat');
    expect(src.priority).toBe(2);
  });
});

describe('createIcecatSource — null handling', () => {
  it('passes through null match from the client', async () => {
    expect(await createIcecatSource(stub(null)).fetchByEan('x')).toBeNull();
  });

  it('treats title=null as no-match (stub record)', async () => {
    expect(await createIcecatSource(stub(product({ title: null }))).fetchByEan('x')).toBeNull();
  });
});

describe('createIcecatSource — ProductData mapping', () => {
  it('maps a full IcecatProduct to ProductData with licensed images', async () => {
    const data = await createIcecatSource(stub(product())).fetchByEan('4006381333115');
    expect(data).not.toBeNull();
    expect(data?.source).toBe('icecat');
    expect(data?.title).toBe('Faber-Castell Bleistift Grip 2001');
    expect(data?.brand).toBe('Faber-Castell');
    expect(data?.mpn).toBe('FC-2001');
    expect(data?.images).toHaveLength(2);
    expect(data?.images.every((i) => i.licensed)).toBe(true);
    expect(data?.description).toContain('ergonomischem Griff');
  });

  it('prefers longDescription over shortDescription', async () => {
    const data = await createIcecatSource(
      stub(
        product({
          shortDescription: 'short version',
          longDescription: 'long detailed version',
        })
      )
    ).fetchByEan('x');
    expect(data?.description).toBe('long detailed version');
  });

  it('falls back to shortDescription when longDescription is null', async () => {
    const data = await createIcecatSource(
      stub(product({ shortDescription: 'just short', longDescription: null }))
    ).fetchByEan('x');
    expect(data?.description).toBe('just short');
  });

  it('specs is always empty {} for MVP (Icecat features not mapped)', async () => {
    const data = await createIcecatSource(stub(product())).fetchByEan('x');
    expect(data?.specs).toEqual({});
  });

  it('suggestedCategoryId is always null (Icecat has no eBay category)', async () => {
    const data = await createIcecatSource(stub(product())).fetchByEan('x');
    expect(data?.suggestedCategoryId).toBeNull();
  });
});

describe('createIcecatSource — GPSR extraction', () => {
  it('builds full GpsrData when supplier has name+address+email', async () => {
    const data = await createIcecatSource(stub(product())).fetchByEan('x');
    expect(data?.gpsrData).toEqual({
      manufacturerName: 'Faber-Castell',
      manufacturerAddress: 'Nürnberger Str. 2, 90546 Stein, Germany',
      manufacturerEmail: 'info@faber-castell.de',
    });
  });

  it('returns partial GPSR when only name is known (common case)', async () => {
    const data = await createIcecatSource(
      stub(product({ supplier: { name: 'Bosch', address: null, email: null } }))
    ).fetchByEan('x');
    expect(data?.gpsrData).toEqual({
      manufacturerName: 'Bosch',
      manufacturerAddress: null,
      manufacturerEmail: null,
    });
  });

  it('returns gpsrData=null when supplier is completely empty', async () => {
    const data = await createIcecatSource(
      stub(product({ supplier: { name: null, address: null, email: null } }))
    ).fetchByEan('x');
    expect(data?.gpsrData).toBeNull();
  });
});

describe('createIcecatSource — qualityScore heuristic', () => {
  it('complete profile (brand + long desc + 2+ imgs + address) reaches 85', async () => {
    const data = await createIcecatSource(stub(product())).fetchByEan('x');
    expect(data?.qualityScore).toBe(85);
  });

  it('only title drops to base 70', async () => {
    const data = await createIcecatSource(
      stub(
        product({
          brand: null,
          longDescription: null,
          shortDescription: null,
          images: [],
          supplier: { name: null, address: null, email: null },
        })
      )
    ).fetchByEan('x');
    expect(data?.qualityScore).toBe(70);
  });

  it('brand-only adds 3 over baseline', async () => {
    const data = await createIcecatSource(
      stub(
        product({
          longDescription: null,
          shortDescription: null,
          images: [],
          supplier: { name: 'B', address: null, email: null },
        })
      )
    ).fetchByEan('x');
    expect(data?.qualityScore).toBe(73);
  });

  it('score stays <= 85 (never exceeds Catalog at 90)', async () => {
    const data = await createIcecatSource(stub(product())).fetchByEan('x');
    expect(data?.qualityScore).toBeLessThanOrEqual(85);
  });
});
