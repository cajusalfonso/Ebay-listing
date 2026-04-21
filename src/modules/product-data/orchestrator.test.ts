import { describe, expect, it, vi } from 'vitest';
import type { GpsrOverrideLookup } from './gpsrOverride';
import { enrichProductByEan } from './orchestrator';
import type { ProductData, ProductSource, ProductSourceName } from './types';

function sourceStub(
  name: ProductSourceName,
  priority: number,
  impl: () => Promise<ProductData | null>
): ProductSource {
  return { name, priority, fetchByEan: impl };
}

function data(overrides: Partial<ProductData> = {}): ProductData {
  return {
    source: 'ebay_catalog',
    ean: '4006381333115',
    title: 'Sample',
    brand: 'ACME',
    mpn: 'X',
    description: 'd',
    specs: {},
    images: [],
    suggestedCategoryId: null,
    qualityScore: 90,
    gpsrData: null,
    ...overrides,
  };
}

describe('enrichProductByEan — no sources or no matches', () => {
  it('empty source list → data: null, no errors', async () => {
    const r = await enrichProductByEan({ ean: 'x', sources: [] });
    expect(r.data).toBeNull();
    expect(r.sourcesAttempted).toEqual([]);
    expect(r.sourceErrors).toEqual([]);
  });

  it('all sources return null → data: null, tracked as attempted', async () => {
    const r = await enrichProductByEan({
      ean: 'x',
      sources: [
        sourceStub('ebay_catalog', 1, () => Promise.resolve(null)),
        sourceStub('icecat', 2, () => Promise.resolve(null)),
      ],
    });
    expect(r.data).toBeNull();
    expect(r.sourcesAttempted).toEqual(['ebay_catalog', 'icecat']);
    expect(r.sourcesWithData).toEqual([]);
  });
});

describe('enrichProductByEan — source errors isolated', () => {
  it('one source throws, the other succeeds → data from successful, error tracked', async () => {
    const r = await enrichProductByEan({
      ean: 'x',
      sources: [
        sourceStub('ebay_catalog', 1, () => Promise.reject(new Error('catalog down'))),
        sourceStub('icecat', 2, () =>
          Promise.resolve(data({ source: 'icecat', title: 'from-icecat', qualityScore: 80 }))
        ),
      ],
    });
    expect(r.data?.title).toBe('from-icecat');
    expect(r.sourceErrors).toHaveLength(1);
    expect(r.sourceErrors[0]?.source).toBe('ebay_catalog');
    expect((r.sourceErrors[0]?.error as Error).message).toBe('catalog down');
    expect(r.sourcesWithData).toEqual(['icecat']);
  });

  it('all sources throw → data: null, all errors tracked', async () => {
    const r = await enrichProductByEan({
      ean: 'x',
      sources: [
        sourceStub('ebay_catalog', 1, () => Promise.reject(new Error('a'))),
        sourceStub('icecat', 2, () => Promise.reject(new Error('b'))),
      ],
    });
    expect(r.data).toBeNull();
    expect(r.sourceErrors.map((e) => e.source)).toEqual(['ebay_catalog', 'icecat']);
  });
});

describe('enrichProductByEan — GPSR override fallback', () => {
  it('does not consult override when merged GPSR is complete', async () => {
    const completeGpsr = {
      manufacturerName: 'ACME GmbH',
      manufacturerAddress: 'Street 1',
      manufacturerEmail: 'a@b.c',
    };
    const lookup = vi.fn<GpsrOverrideLookup>();
    const r = await enrichProductByEan({
      ean: 'x',
      sources: [
        sourceStub('ebay_catalog', 1, () =>
          Promise.resolve(data({ brand: 'ACME', gpsrData: completeGpsr }))
        ),
      ],
      gpsrOverrideLookup: lookup,
    });
    expect(lookup).not.toHaveBeenCalled();
    expect(r.gpsrOverrideApplied).toBe(false);
    expect(r.data?.gpsrData).toEqual(completeGpsr);
  });

  it('fills only the missing GPSR fields from the override table', async () => {
    const partialFromSources = {
      manufacturerName: 'ACME GmbH', // already known
      manufacturerAddress: null, // missing
      manufacturerEmail: null, // missing
    };
    const lookup = vi.fn<GpsrOverrideLookup>().mockResolvedValue({
      manufacturerName: 'OVERRIDE NAME', // should NOT overwrite
      manufacturerAddress: 'Override Street 2',
      manufacturerEmail: 'override@x.de',
    });
    const r = await enrichProductByEan({
      ean: 'x',
      sources: [
        sourceStub('ebay_catalog', 1, () =>
          Promise.resolve(data({ brand: 'ACME', gpsrData: partialFromSources }))
        ),
      ],
      gpsrOverrideLookup: lookup,
    });
    expect(lookup).toHaveBeenCalledWith('ACME');
    expect(r.gpsrOverrideApplied).toBe(true);
    expect(r.data?.gpsrData).toEqual({
      manufacturerName: 'ACME GmbH', // preserved from source
      manufacturerAddress: 'Override Street 2',
      manufacturerEmail: 'override@x.de',
    });
    expect(r.data?.sourceMetadata['gpsr.manufacturerAddress']).toBe('manual');
    expect(r.data?.sourceMetadata['gpsr.manufacturerEmail']).toBe('manual');
  });

  it('uses override entirely when sources provided no GPSR at all', async () => {
    const lookup = vi.fn<GpsrOverrideLookup>().mockResolvedValue({
      manufacturerName: 'OV',
      manufacturerAddress: 'OV Addr',
      manufacturerEmail: 'ov@x.de',
    });
    const r = await enrichProductByEan({
      ean: 'x',
      sources: [
        sourceStub('ebay_catalog', 1, () =>
          Promise.resolve(data({ brand: 'ACME', gpsrData: null }))
        ),
      ],
      gpsrOverrideLookup: lookup,
    });
    expect(r.gpsrOverrideApplied).toBe(true);
    expect(r.data?.gpsrData).toEqual({
      manufacturerName: 'OV',
      manufacturerAddress: 'OV Addr',
      manufacturerEmail: 'ov@x.de',
    });
  });

  it('skips override when brand is null (no key to look up)', async () => {
    const lookup = vi.fn<GpsrOverrideLookup>();
    await enrichProductByEan({
      ean: 'x',
      sources: [
        sourceStub('ebay_catalog', 1, () => Promise.resolve(data({ brand: null, gpsrData: null }))),
      ],
      gpsrOverrideLookup: lookup,
    });
    expect(lookup).not.toHaveBeenCalled();
  });

  it('skips override when not provided in options', async () => {
    const r = await enrichProductByEan({
      ean: 'x',
      sources: [
        sourceStub('ebay_catalog', 1, () =>
          Promise.resolve(data({ brand: 'ACME', gpsrData: null }))
        ),
      ],
    });
    expect(r.gpsrOverrideApplied).toBe(false);
    expect(r.data?.gpsrData).toBeNull();
  });

  it('override returns null → GPSR stays as merged from sources', async () => {
    const lookup = vi.fn<GpsrOverrideLookup>().mockResolvedValue(null);
    const r = await enrichProductByEan({
      ean: 'x',
      sources: [
        sourceStub('ebay_catalog', 1, () =>
          Promise.resolve(data({ brand: 'Unknown', gpsrData: null }))
        ),
      ],
      gpsrOverrideLookup: lookup,
    });
    expect(lookup).toHaveBeenCalledWith('Unknown');
    expect(r.gpsrOverrideApplied).toBe(false);
    expect(r.data?.gpsrData).toBeNull();
  });
});

describe('enrichProductByEan — multi-source merge', () => {
  it('calls all sources in parallel (not serially)', async () => {
    const delays: number[] = [];
    const makeSource = (name: ProductSourceName, delay: number): ProductSource => ({
      name,
      priority: 1,
      fetchByEan: async () => {
        delays.push(Date.now());
        await new Promise((resolve) => setTimeout(resolve, delay));
        return null;
      },
    });
    const start = Date.now();
    await enrichProductByEan({
      ean: 'x',
      sources: [makeSource('ebay_catalog', 50), makeSource('icecat', 50)],
    });
    const elapsed = Date.now() - start;
    // If serial, total would be ~100ms. Parallel should be closer to 50ms.
    expect(elapsed).toBeLessThan(90);
  });

  it('sources attempted order preserved in report', async () => {
    const r = await enrichProductByEan({
      ean: 'x',
      sources: [
        sourceStub('icecat', 2, () => Promise.resolve(null)),
        sourceStub('ebay_catalog', 1, () => Promise.resolve(null)),
      ],
    });
    expect(r.sourcesAttempted).toEqual(['icecat', 'ebay_catalog']);
  });
});
