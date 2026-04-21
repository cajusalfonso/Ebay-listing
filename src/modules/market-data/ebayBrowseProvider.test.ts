import { describe, expect, it, vi } from 'vitest';
import type { BrowseClient, BrowseItem, BrowseSearchParams } from '../ebay/browse';
import { createEbayBrowseProvider } from './ebayBrowseProvider';

function browseStub(items: BrowseItem[], spy?: (p: BrowseSearchParams) => void): BrowseClient {
  return {
    searchItems(params: BrowseSearchParams) {
      spy?.(params);
      return Promise.resolve({ total: items.length, items });
    },
  };
}

function item(overrides: Partial<BrowseItem> & { priceValue: number }): BrowseItem {
  const defaults: Omit<BrowseItem, 'priceValue'> = {
    itemId: `v1|${Math.random().toString(36).slice(2, 10)}|0`,
    title: 'generic item',
    priceCurrency: 'EUR',
    shippingCost: null,
    sellerUsername: 'someone',
    sellerFeedbackScore: 100,
    condition: 'New',
    itemWebUrl: null,
    itemLocationCountry: 'DE',
  };
  return { ...defaults, ...overrides };
}

describe('createEbayBrowseProvider — query construction', () => {
  it('passes ean as q, EUR/DE/NEW/FIXED_PRICE filter, sort=price, limit=20', async () => {
    const spy = vi.fn();
    const provider = createEbayBrowseProvider(browseStub([], spy));
    await provider.getLowestPriceByEan('4006381333115');
    expect(spy).toHaveBeenCalledOnce();
    const params = spy.mock.calls[0]?.[0] as BrowseSearchParams;
    expect(params.q).toBe('4006381333115');
    expect(params.sort).toBe('price');
    expect(params.limit).toBe(20);
    expect(params.marketplaceId).toBe('EBAY_DE');
    expect(params.filter).toContain('conditions:{NEW}');
    expect(params.filter).toContain('buyingOptions:{FIXED_PRICE}');
    expect(params.filter).toContain('itemLocationCountry:DE');
    expect(params.filter).toContain('priceCurrency:EUR');
  });
});

describe('createEbayBrowseProvider — snapshot shape', () => {
  it('returns no_competitors warning and null prices when Browse returns nothing', async () => {
    const provider = createEbayBrowseProvider(browseStub([]));
    const snap = await provider.getLowestPriceByEan('ean-empty');
    expect(snap.competitorCount).toBe(0);
    expect(snap.lowestPrice).toBeNull();
    expect(snap.medianPrice).toBeNull();
    expect(snap.warnings).toContain('no_competitors');
    expect(snap.marketplace).toBe('EBAY_DE');
    expect(snap.currency).toBe('EUR');
  });

  it('lowestPrice uses total (price + shipping), not just item price', async () => {
    // Item A: price 9.90 + shipping 4.99 = 14.89 total
    // Item B: price 12.00 + shipping 0     = 12.00 total ← lower buyer total
    const items = [
      item({ priceValue: 9.9, shippingCost: 4.99, sellerUsername: 's1' }),
      item({ priceValue: 12.0, shippingCost: 0, sellerUsername: 's2' }),
    ];
    const snap = await createEbayBrowseProvider(browseStub(items)).getLowestPriceByEan('x');
    expect(snap.lowestPrice).toBe(12.0);
    expect(snap.competitors[0]?.totalPrice).toBe(12.0);
  });

  it('treats null shippingCost as 0 in totalPrice', async () => {
    const snap = await createEbayBrowseProvider(
      browseStub([item({ priceValue: 10, shippingCost: null })])
    ).getLowestPriceByEan('x');
    expect(snap.competitors[0]?.totalPrice).toBe(10);
  });

  it('filters out non-EUR quotes', async () => {
    const items = [
      item({ priceValue: 5, priceCurrency: 'USD', sellerUsername: 'us-shop' }),
      item({ priceValue: 10, priceCurrency: 'EUR', sellerUsername: 'de-shop' }),
    ];
    const snap = await createEbayBrowseProvider(browseStub(items)).getLowestPriceByEan('x');
    expect(snap.competitorCount).toBe(1);
    expect(snap.competitors[0]?.sellerUsername).toBe('de-shop');
  });

  it('medianPrice for odd count picks the middle element', async () => {
    const items = [
      item({ priceValue: 1, sellerUsername: 'a' }),
      item({ priceValue: 5, sellerUsername: 'b' }),
      item({ priceValue: 9, sellerUsername: 'c' }),
    ];
    const snap = await createEbayBrowseProvider(browseStub(items)).getLowestPriceByEan('x');
    expect(snap.medianPrice).toBe(5);
  });

  it('medianPrice for even count averages the two middle values', async () => {
    const items = [
      item({ priceValue: 1, sellerUsername: 'a' }),
      item({ priceValue: 3, sellerUsername: 'b' }),
      item({ priceValue: 5, sellerUsername: 'c' }),
      item({ priceValue: 9, sellerUsername: 'd' }),
    ];
    const snap = await createEbayBrowseProvider(browseStub(items)).getLowestPriceByEan('x');
    expect(snap.medianPrice).toBe(4); // (3 + 5) / 2
  });
});

describe('createEbayBrowseProvider — warnings', () => {
  it('only_one_competitor when exactly 1 item', async () => {
    const snap = await createEbayBrowseProvider(
      browseStub([item({ priceValue: 10, sellerUsername: 'solo' })])
    ).getLowestPriceByEan('x');
    expect(snap.warnings).toContain('only_one_competitor');
  });

  it('all_same_seller when ≥2 items share the same sellerUsername', async () => {
    const items = [
      item({ priceValue: 10, sellerUsername: 'mega-shop' }),
      item({ priceValue: 12, sellerUsername: 'mega-shop' }),
      item({ priceValue: 15, sellerUsername: 'mega-shop' }),
    ];
    const snap = await createEbayBrowseProvider(browseStub(items)).getLowestPriceByEan('x');
    expect(snap.warnings).toContain('all_same_seller');
  });

  it('no all_same_seller warning when sellers differ', async () => {
    const items = [
      item({ priceValue: 10, sellerUsername: 'shop-a' }),
      item({ priceValue: 12, sellerUsername: 'shop-b' }),
    ];
    const snap = await createEbayBrowseProvider(browseStub(items)).getLowestPriceByEan('x');
    expect(snap.warnings).not.toContain('all_same_seller');
    expect(snap.warnings).not.toContain('only_one_competitor');
    expect(snap.warnings).not.toContain('no_competitors');
  });
});

describe('createEbayBrowseProvider — marketplaceSearchUrl', () => {
  it('contains the EAN as _nkw, BIN filter, and price-sort param', async () => {
    const snap = await createEbayBrowseProvider(browseStub([])).getLowestPriceByEan(
      '4006381333115'
    );
    expect(snap.marketplaceSearchUrl).toContain('ebay.de');
    expect(snap.marketplaceSearchUrl).toContain('_nkw=4006381333115');
    expect(snap.marketplaceSearchUrl).toContain('LH_BIN=1');
  });
});

describe('createEbayBrowseProvider — timestamp injection', () => {
  it('fetchedAt uses the injected `now` provider', async () => {
    const fixed = new Date('2026-04-18T12:00:00Z');
    const snap = await createEbayBrowseProvider(browseStub([]), {
      now: () => fixed,
    }).getLowestPriceByEan('x');
    expect(snap.fetchedAt).toEqual(fixed);
  });
});
