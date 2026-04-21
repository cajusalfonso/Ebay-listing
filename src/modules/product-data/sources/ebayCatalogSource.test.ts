import { describe, expect, it } from 'vitest';
import type { CatalogClient, CatalogProduct } from '../../ebay/catalog';
import { createEbayCatalogSource } from './ebayCatalogSource';

function catalogStub(products: CatalogProduct[]): CatalogClient {
  return {
    searchByGtin: () => Promise.resolve(products),
    getProduct: () => Promise.reject(new Error('not used in these tests')),
  };
}

function product(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    epid: '123',
    title: 'Faber-Castell Bleistift Grip 2001',
    brand: 'Faber-Castell',
    mpn: 'FC-2001',
    gtins: ['4006381333115'],
    primaryImage: { url: 'https://img/p.jpg', width: 800, height: 800 },
    additionalImages: [{ url: 'https://img/a1.jpg', width: null, height: null }],
    aspects: [
      { name: 'Marke', values: ['Faber-Castell'] },
      { name: 'Härtegrad', values: ['HB'] },
    ],
    description: 'Hochwertiger Bleistift mit Grip-Zone.',
    leafCategoryId: '1001',
    leafCategoryName: 'Bleistifte',
    productWebUrl: 'https://ebay.com/p/123',
    ...overrides,
  };
}

describe('createEbayCatalogSource', () => {
  it('exposes the correct source name and priority', () => {
    const src = createEbayCatalogSource(catalogStub([]));
    expect(src.name).toBe('ebay_catalog');
    expect(src.priority).toBe(1);
  });

  it('returns null when Catalog has no match', async () => {
    const src = createEbayCatalogSource(catalogStub([]));
    expect(await src.fetchByEan('0000000000000')).toBeNull();
  });

  it('maps a Catalog hit into a ProductData with qualityScore=90 and licensed images', async () => {
    const src = createEbayCatalogSource(catalogStub([product()]));
    const data = await src.fetchByEan('4006381333115');
    expect(data).not.toBeNull();
    expect(data?.source).toBe('ebay_catalog');
    expect(data?.ean).toBe('4006381333115');
    expect(data?.title).toBe('Faber-Castell Bleistift Grip 2001');
    expect(data?.brand).toBe('Faber-Castell');
    expect(data?.mpn).toBe('FC-2001');
    expect(data?.qualityScore).toBe(90);
    expect(data?.suggestedCategoryId).toBe('1001');
    expect(data?.images).toHaveLength(2);
    expect(data?.images.every((i) => i.licensed)).toBe(true);
  });

  it('collapses multi-value aspects with " / " separator', async () => {
    const src = createEbayCatalogSource(
      catalogStub([
        product({
          aspects: [
            { name: 'Marke', values: ['Bosch'] },
            { name: 'Farbe', values: ['Blau', 'Rot', 'Grün'] },
          ],
        }),
      ])
    );
    const data = await src.fetchByEan('x');
    expect(data?.specs).toEqual({
      Marke: 'Bosch',
      Farbe: 'Blau / Rot / Grün',
    });
  });

  it('skips aspects with empty value arrays', async () => {
    const src = createEbayCatalogSource(
      catalogStub([
        product({
          aspects: [
            { name: 'Marke', values: ['Bosch'] },
            { name: 'Leerwert', values: [] },
          ],
        }),
      ])
    );
    const data = await src.fetchByEan('x');
    expect(data?.specs).toEqual({ Marke: 'Bosch' });
  });

  it('always returns gpsrData=null (Catalog has no GPSR fields)', async () => {
    const src = createEbayCatalogSource(catalogStub([product()]));
    const data = await src.fetchByEan('x');
    expect(data?.gpsrData).toBeNull();
  });

  it('picks the FIRST result when Catalog returns multiple candidates', async () => {
    const first = product({ epid: '1', title: 'First Hit' });
    const second = product({ epid: '2', title: 'Second Hit' });
    const src = createEbayCatalogSource(catalogStub([first, second]));
    const data = await src.fetchByEan('x');
    expect(data?.title).toBe('First Hit');
  });

  it('omits primary image when missing but keeps additionalImages', async () => {
    const src = createEbayCatalogSource(
      catalogStub([
        product({
          primaryImage: null,
          additionalImages: [
            { url: 'https://img/a.jpg', width: null, height: null },
            { url: 'https://img/b.jpg', width: 1200, height: 900 },
          ],
        }),
      ])
    );
    const data = await src.fetchByEan('x');
    expect(data?.images).toHaveLength(2);
    expect(data?.images[0]?.url).toBe('https://img/a.jpg');
    expect(data?.images[1]?.width).toBe(1200);
  });

  it('passes through nullable fields unchanged', async () => {
    const src = createEbayCatalogSource(
      catalogStub([
        product({
          brand: null,
          mpn: null,
          description: null,
          leafCategoryId: null,
          leafCategoryName: null,
        }),
      ])
    );
    const data = await src.fetchByEan('x');
    expect(data?.brand).toBeNull();
    expect(data?.mpn).toBeNull();
    expect(data?.description).toBeNull();
    expect(data?.suggestedCategoryId).toBeNull();
  });
});
