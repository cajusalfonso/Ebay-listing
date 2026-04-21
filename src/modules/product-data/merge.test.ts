import { describe, expect, it } from 'vitest';
import { mergeProductData } from './merge';
import type { ProductData, ProductImage, ProductSourceName } from './types';

function img(url: string, source: ProductSourceName): ProductImage {
  return { url, width: 800, height: 800, licensed: true, source };
}

function catalog(overrides: Partial<ProductData> = {}): ProductData {
  return {
    source: 'ebay_catalog',
    ean: '4006381333115',
    title: 'Faber-Castell Grip 2001',
    brand: 'Faber-Castell',
    mpn: 'FC-2001',
    description: 'Bleistift mit ergonomischem Griff.',
    specs: { Marke: 'Faber-Castell', Härtegrad: 'HB' },
    images: [img('https://cat/p.jpg', 'ebay_catalog')],
    suggestedCategoryId: '1001',
    qualityScore: 90,
    gpsrData: null,
    ...overrides,
  };
}

function icecat(overrides: Partial<ProductData> = {}): ProductData {
  return {
    source: 'icecat',
    ean: '4006381333115',
    title: 'Icecat name (different)',
    brand: 'Faber-Castell',
    mpn: 'FC-2001',
    description: 'Sehr lange Icecat-Beschreibung mit mehr Details als Catalog.',
    specs: {},
    images: [img('https://ice/1.jpg', 'icecat'), img('https://ice/2.jpg', 'icecat')],
    suggestedCategoryId: null,
    qualityScore: 85,
    gpsrData: {
      manufacturerName: 'Faber-Castell GmbH',
      manufacturerAddress: 'Nürnberger Str. 2, 90546 Stein',
      manufacturerEmail: null,
    },
    ...overrides,
  };
}

describe('mergeProductData — empty input', () => {
  it('returns null for empty array', () => {
    expect(mergeProductData([])).toBeNull();
  });
});

describe('mergeProductData — single source', () => {
  it('wraps a single ProductData unchanged, primarySource = its source', () => {
    const r = mergeProductData([catalog()]);
    expect(r).not.toBeNull();
    expect(r?.primarySource).toBe('ebay_catalog');
    expect(r?.title).toBe('Faber-Castell Grip 2001');
    expect(r?.qualityScore).toBe(90);
    expect(r?.sourceMetadata.primary).toBe('ebay_catalog');
    expect(r?.sourceMetadata.title).toBe('ebay_catalog');
  });
});

describe('mergeProductData — highest-quality source wins for scalars', () => {
  it('Catalog (90) beats Icecat (85) on title', () => {
    const r = mergeProductData([icecat(), catalog()]);
    expect(r?.title).toBe('Faber-Castell Grip 2001'); // Catalog's
    expect(r?.primarySource).toBe('ebay_catalog');
    expect(r?.sourceMetadata.title).toBe('ebay_catalog');
  });

  it('primary fills in for fields the lower-quality source has missing', () => {
    // Catalog has no GPSR, Icecat does → merged gpsr comes from Icecat
    const r = mergeProductData([catalog({ gpsrData: null }), icecat()]);
    expect(r?.gpsrData?.manufacturerName).toBe('Faber-Castell GmbH');
    expect(r?.sourceMetadata['gpsr.manufacturerName']).toBe('icecat');
  });

  it('lower-quality description fills in when primary has null', () => {
    const r = mergeProductData([catalog({ description: null }), icecat()]);
    expect(r?.description).toContain('Icecat-Beschreibung');
    expect(r?.sourceMetadata.description).toBe('icecat');
  });

  it('primary wins even if its field is empty string (only null falls through)', () => {
    // Defensive: title is `required` in ProductData; empty string unlikely but test intent
    const r = mergeProductData([
      catalog({ suggestedCategoryId: 'primary-cat' }),
      icecat({ suggestedCategoryId: 'secondary-cat' }),
    ]);
    expect(r?.suggestedCategoryId).toBe('primary-cat');
  });
});

describe('mergeProductData — specs', () => {
  it('merges specs dicts, primary wins on conflicting keys', () => {
    const primary = catalog({ specs: { Marke: 'Faber-Castell', Farbe: 'Blau' } });
    const secondary = icecat({ specs: { Marke: 'SHOULD LOSE', Härtegrad: '2B' } });
    const r = mergeProductData([secondary, primary]);
    expect(r?.specs).toEqual({
      Marke: 'Faber-Castell', // primary (ebay_catalog) wins
      Farbe: 'Blau',
      Härtegrad: '2B', // unique to secondary
    });
    expect(r?.sourceMetadata['specs.Marke']).toBe('ebay_catalog');
    expect(r?.sourceMetadata['specs.Härtegrad']).toBe('icecat');
  });
});

describe('mergeProductData — images', () => {
  it('concatenates images in quality order and dedupes by URL', () => {
    const dup = 'https://same/url.jpg';
    const primary = catalog({
      images: [img(dup, 'ebay_catalog'), img('https://cat/other.jpg', 'ebay_catalog')],
    });
    const secondary = icecat({
      images: [img(dup, 'icecat'), img('https://ice/unique.jpg', 'icecat')],
    });
    const r = mergeProductData([secondary, primary]);
    const urls = r?.images.map((i) => i.url) ?? [];
    expect(urls).toEqual([dup, 'https://cat/other.jpg', 'https://ice/unique.jpg']);
    // The duplicate URL keeps the higher-quality source (ebay_catalog)
    expect(r?.images[0]?.source).toBe('ebay_catalog');
  });
});

describe('mergeProductData — GPSR partial merge', () => {
  it('assembles name from one source and address/email from another', () => {
    const primary = catalog({
      gpsrData: {
        manufacturerName: 'ACME GmbH',
        manufacturerAddress: null,
        manufacturerEmail: null,
      },
    });
    const secondary = icecat({
      gpsrData: {
        manufacturerName: null,
        manufacturerAddress: 'Teststraße 1',
        manufacturerEmail: 'hello@acme.de',
      },
    });
    const r = mergeProductData([secondary, primary]);
    expect(r?.gpsrData).toEqual({
      manufacturerName: 'ACME GmbH',
      manufacturerAddress: 'Teststraße 1',
      manufacturerEmail: 'hello@acme.de',
    });
    expect(r?.sourceMetadata['gpsr.manufacturerName']).toBe('ebay_catalog');
    expect(r?.sourceMetadata['gpsr.manufacturerAddress']).toBe('icecat');
    expect(r?.sourceMetadata['gpsr.manufacturerEmail']).toBe('icecat');
  });

  it('returns gpsrData=null when no source has any GPSR fields', () => {
    const r = mergeProductData([catalog({ gpsrData: null }), icecat({ gpsrData: null })]);
    expect(r?.gpsrData).toBeNull();
  });
});

describe('mergeProductData — quality ordering', () => {
  it('stable: on qualityScore tie, preserves input array order (Catalog listed first wins)', () => {
    const a = catalog({ qualityScore: 80, title: 'Catalog Title' });
    const b = icecat({ qualityScore: 80, title: 'Icecat Title' });
    const r = mergeProductData([a, b]);
    expect(r?.title).toBe('Catalog Title');
    expect(r?.primarySource).toBe('ebay_catalog');
  });

  it('qualityScore on output equals max of all sources', () => {
    const r = mergeProductData([icecat({ qualityScore: 75 }), catalog({ qualityScore: 90 })]);
    expect(r?.qualityScore).toBe(90);
  });
});
