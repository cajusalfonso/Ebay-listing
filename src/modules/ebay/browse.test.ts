import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { createEbayHttpClient } from './httpClient';
import { createBrowseClient } from './browse';

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

function browse() {
  const http = createEbayHttpClient({
    environment: 'sandbox',
    getAccessToken: () => Promise.resolve('mock-token'),
    sleep: () => Promise.resolve(),
  });
  return createBrowseClient(http);
}

describe('BrowseClient.searchItems', () => {
  it('maps an eBay item summary to our BrowseItem shape', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({
        path: (p) =>
          p.startsWith('/buy/browse/v1/item_summary/search') && p.includes('q=4006381333115'),
        method: 'GET',
      })
      .reply(200, {
        total: 1,
        itemSummaries: [
          {
            itemId: 'v1|111|0',
            title: 'Schraubendreher Stabiler Premium',
            price: { value: '14.90', currency: 'EUR' },
            shippingOptions: [{ shippingCost: { value: '4.99', currency: 'EUR' } }],
            seller: { username: 'de-tools-shop', feedbackScore: 3400, feedbackPercentage: '99.7' },
            condition: 'New',
            itemWebUrl: 'https://www.ebay.de/itm/111',
            itemLocation: { country: 'DE' },
          },
        ],
      });

    const result = await browse().searchItems({ q: '4006381333115' });
    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual({
      itemId: 'v1|111|0',
      title: 'Schraubendreher Stabiler Premium',
      priceValue: 14.9,
      priceCurrency: 'EUR',
      shippingCost: 4.99,
      sellerUsername: 'de-tools-shop',
      sellerFeedbackScore: 3400,
      condition: 'New',
      itemWebUrl: 'https://www.ebay.de/itm/111',
      itemLocationCountry: 'DE',
    });
  });

  it('returns empty items when eBay responds with no itemSummaries', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool.intercept({ path: (p) => p.startsWith('/buy/browse/v1/item_summary/search') }).reply(200, {
      total: 0,
    });
    const result = await browse().searchItems({ q: 'obscureXYZ' });
    expect(result.total).toBe(0);
    expect(result.items).toEqual([]);
  });

  it('shippingCost is null when no shippingOptions provided', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool.intercept({ path: (p) => p.startsWith('/buy/browse/v1/item_summary/search') }).reply(200, {
      itemSummaries: [
        {
          itemId: 'v1|222|0',
          title: 'Foo',
          price: { value: '10.00', currency: 'EUR' },
          seller: { username: 'x' },
        },
      ],
    });
    const r = await browse().searchItems({ q: 'foo' });
    expect(r.items[0]?.shippingCost).toBeNull();
  });

  it('forwards filter, sort, and limit as query params', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({
        path: (p) =>
          p.startsWith('/buy/browse/v1/item_summary/search') &&
          p.includes('filter=conditions%3A%7BNEW%7D') &&
          p.includes('sort=price') &&
          p.includes('limit=20'),
        method: 'GET',
      })
      .reply(200, { itemSummaries: [] });

    await browse().searchItems({
      q: 'ean',
      filter: 'conditions:{NEW}',
      sort: 'price',
      limit: 20,
    });
  });

  it('defaults missing seller feedbackScore to 0', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool.intercept({ path: (p) => p.startsWith('/buy/browse/v1/item_summary/search') }).reply(200, {
      itemSummaries: [
        {
          itemId: 'v1|333|0',
          title: 'No-score seller',
          price: { value: '5.00', currency: 'EUR' },
          seller: { username: 'newbie' },
        },
      ],
    });
    const r = await browse().searchItems({ q: 'x' });
    expect(r.items[0]?.sellerFeedbackScore).toBe(0);
  });
});
