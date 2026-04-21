import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { createCatalogClient } from './catalog';
import { createEbayHttpClient } from './httpClient';

const SANDBOX_API = 'https://api.sandbox.ebay.com';

let mockAgent: MockAgent;

beforeEach(() => {
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  setGlobalDispatcher(mockAgent);
});

afterEach(async () => {
  await mockAgent.close();
});

function catalog() {
  const http = createEbayHttpClient({
    environment: 'sandbox',
    getAccessToken: () => Promise.resolve('mock-token'),
    sleep: () => Promise.resolve(),
  });
  return createCatalogClient(http);
}

describe('CatalogClient.searchByGtin', () => {
  it('maps eBay productSummary to normalized CatalogProduct', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({
        path: (p) =>
          p.startsWith('/commerce/catalog/v1_beta/product_summary/search') &&
          p.includes('gtin=4006381333115'),
        method: 'GET',
      })
      .reply(200, {
        total: 1,
        productSummaries: [
          {
            epid: '123456',
            title: 'Faber-Castell Bleistift Grip 2001',
            brand: 'Faber-Castell',
            mpn: 'FC-2001',
            gtin: ['4006381333115'],
            image: { imageUrl: 'https://img.ebay.com/primary.jpg', width: 800, height: 800 },
            additionalImages: [{ imageUrl: 'https://img.ebay.com/alt1.jpg' }],
            aspects: [
              { localizedName: 'Marke', localizedValues: ['Faber-Castell'] },
              { localizedName: 'Härtegrad', localizedValues: ['HB'] },
            ],
            productWebUrl: 'https://www.ebay.com/p/123456',
            categoryAncestors: [
              { categoryId: '11700', categoryName: 'Büro & Schreibwaren' },
              { categoryId: '631', categoryName: 'Schreibgeräte' },
              { categoryId: '1001', categoryName: 'Bleistifte' },
            ],
          },
        ],
      });

    const products = await catalog().searchByGtin('4006381333115');
    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      epid: '123456',
      title: 'Faber-Castell Bleistift Grip 2001',
      brand: 'Faber-Castell',
      mpn: 'FC-2001',
      gtins: ['4006381333115'],
      primaryImage: { url: 'https://img.ebay.com/primary.jpg', width: 800, height: 800 },
      description: null,
      leafCategoryId: '1001',
      leafCategoryName: 'Bleistifte',
    });
    expect(products[0]?.aspects).toEqual([
      { name: 'Marke', values: ['Faber-Castell'] },
      { name: 'Härtegrad', values: ['HB'] },
    ]);
  });

  it('returns empty array when eBay has no match for the GTIN', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({ path: (p) => p.startsWith('/commerce/catalog/v1_beta/product_summary/search') })
      .reply(200, { total: 0 });
    const r = await catalog().searchByGtin('0000000000000');
    expect(r).toEqual([]);
  });

  it('derives leafCategoryId from the LAST ancestor in the chain', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({ path: (p) => p.startsWith('/commerce/catalog/v1_beta/product_summary/search') })
      .reply(200, {
        productSummaries: [
          {
            epid: '1',
            title: 't',
            categoryAncestors: [
              { categoryId: 'root', categoryName: 'Root' },
              { categoryId: 'leaf', categoryName: 'Leaf' },
            ],
          },
        ],
      });
    const r = await catalog().searchByGtin('x');
    expect(r[0]?.leafCategoryId).toBe('leaf');
  });

  it('handles missing image/additionalImages/aspects gracefully', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({ path: (p) => p.startsWith('/commerce/catalog/v1_beta/product_summary/search') })
      .reply(200, {
        productSummaries: [{ epid: '1', title: 'bare minimum' }],
      });
    const r = await catalog().searchByGtin('x');
    expect(r[0]?.primaryImage).toBeNull();
    expect(r[0]?.additionalImages).toEqual([]);
    expect(r[0]?.aspects).toEqual([]);
    expect(r[0]?.leafCategoryId).toBeNull();
    expect(r[0]?.gtins).toEqual([]);
  });

  it('image without dimensions has null width and height', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({ path: (p) => p.startsWith('/commerce/catalog/v1_beta/product_summary/search') })
      .reply(200, {
        productSummaries: [{ epid: '1', title: 't', image: { imageUrl: 'https://x.jpg' } }],
      });
    const r = await catalog().searchByGtin('x');
    expect(r[0]?.primaryImage).toEqual({
      url: 'https://x.jpg',
      width: null,
      height: null,
    });
  });
});

describe('CatalogClient.getProduct', () => {
  it('fetches a product by EPID and returns normalized shape', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({
        path: '/commerce/catalog/v1_beta/product/123456',
        method: 'GET',
      })
      .reply(200, {
        epid: '123456',
        title: 'Detailed Title',
        brand: 'Bosch',
        description: 'Full product description text.',
        image: { imageUrl: 'https://img/main.jpg' },
        aspects: [{ localizedName: 'Color', localizedValues: ['Blue'] }],
      });

    const p = await catalog().getProduct('123456');
    expect(p.epid).toBe('123456');
    expect(p.description).toBe('Full product description text.');
    expect(p.brand).toBe('Bosch');
  });

  it('URL-encodes EPIDs containing slashes or special chars', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({
        path: '/commerce/catalog/v1_beta/product/special%2Fepid',
        method: 'GET',
      })
      .reply(200, { epid: 'special/epid', title: 'Edge Case' });
    const p = await catalog().getProduct('special/epid');
    expect(p.title).toBe('Edge Case');
  });
});
