import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MockAgent, setGlobalDispatcher } from 'undici';
import {
  createInventoryClient,
  type CreateInventoryItemInput,
  type CreateOfferInput,
} from './inventory';
import { createEbayHttpClient } from './httpClient';
import { EbayApiError } from './errors';

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

function inventory() {
  const http = createEbayHttpClient({
    environment: 'sandbox',
    getAccessToken: () => Promise.resolve('token'),
    sleep: () => Promise.resolve(),
  });
  return createInventoryClient(http);
}

function itemInput(overrides: Partial<CreateInventoryItemInput> = {}): CreateInventoryItemInput {
  return {
    sku: 'SKU-TEST-001',
    title: 'Faber-Castell Bleistift Grip 2001',
    description: 'Hochwertiger Bleistift.',
    condition: 'NEW',
    aspects: { Marke: ['Faber-Castell'], Härtegrad: ['HB'] },
    imageUrls: ['https://i.ebayimg.com/00/s/.../img.jpg'],
    brand: 'Faber-Castell',
    mpn: 'FC-2001',
    ean: '4006381333115',
    quantity: 5,
    ...overrides,
  };
}

function offerInput(overrides: Partial<CreateOfferInput> = {}): CreateOfferInput {
  return {
    sku: 'SKU-TEST-001',
    categoryId: '11700',
    priceValueEur: 9.9,
    listingDescription: 'Listing description.',
    fulfillmentPolicyId: 'FP-1',
    paymentPolicyId: 'PP-1',
    returnPolicyId: 'RP-1',
    merchantLocationKey: 'main-warehouse',
    ...overrides,
  };
}

describe('InventoryClient.createOrUpdateInventoryItem', () => {
  it('PUTs to /sell/inventory/v1/inventory_item/{sku} with aspects+imageUrls+condition', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({
        path: '/sell/inventory/v1/inventory_item/SKU-TEST-001',
        method: 'PUT',
        headers: (h) => h['content-language'] === 'de-DE',
        body: (b) => {
          const parsed = JSON.parse(b);
          return (
            parsed.condition === 'NEW' &&
            Array.isArray(parsed.product.aspects.Marke) &&
            parsed.product.aspects.Marke[0] === 'Faber-Castell' &&
            parsed.product.imageUrls[0] === 'https://i.ebayimg.com/00/s/.../img.jpg' &&
            parsed.availability.shipToLocationAvailability.quantity === 5
          );
        },
      })
      .reply(204, '');

    await inventory().createOrUpdateInventoryItem(itemInput());
  });

  it('omits brand/mpn/ean when not provided', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({
        path: '/sell/inventory/v1/inventory_item/SKU-TEST-002',
        method: 'PUT',
        body: (b) => {
          const parsed = JSON.parse(b);
          return (
            parsed.product.brand === undefined &&
            parsed.product.mpn === undefined &&
            parsed.product.ean === undefined
          );
        },
      })
      .reply(204, '');
    const minimal: CreateInventoryItemInput = {
      sku: 'SKU-TEST-002',
      title: 'Minimal Listing',
      description: 'No brand/MPN/EAN supplied.',
      condition: 'NEW',
      aspects: { Marke: ['n/a'] },
      imageUrls: ['https://example.com/x.jpg'],
      quantity: 1,
    };
    await inventory().createOrUpdateInventoryItem(minimal);
  });

  it('throws EbayApiError with eBay error details on 400', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({
        path: '/sell/inventory/v1/inventory_item/SKU-TEST-001',
        method: 'PUT',
      })
      .reply(400, { errors: [{ errorId: 2004, message: 'Aspect Marke is missing.' }] });

    try {
      await inventory().createOrUpdateInventoryItem(itemInput());
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EbayApiError);
      expect((err as EbayApiError).context.statusCode).toBe(400);
    }
  });
});

describe('InventoryClient.createOffer', () => {
  it('POSTs price formatted to 2 decimals with EUR currency, returns offerId', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({
        path: '/sell/inventory/v1/offer',
        method: 'POST',
        body: (b) => {
          const parsed = JSON.parse(b);
          return (
            parsed.pricingSummary.price.value === '9.90' &&
            parsed.pricingSummary.price.currency === 'EUR' &&
            parsed.marketplaceId === 'EBAY_DE' &&
            parsed.format === 'FIXED_PRICE' &&
            parsed.categoryId === '11700' &&
            parsed.listingPolicies.fulfillmentPolicyId === 'FP-1'
          );
        },
      })
      .reply(201, { offerId: 'OFFER-99' });

    const r = await inventory().createOffer(offerInput());
    expect(r.offerId).toBe('OFFER-99');
  });

  it('formats prices with exactly 2 decimals even when already precise', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({
        path: '/sell/inventory/v1/offer',
        method: 'POST',
        body: (b) => {
          const parsed = JSON.parse(b);
          return parsed.pricingSummary.price.value === '15.00';
        },
      })
      .reply(201, { offerId: 'O2' });
    await inventory().createOffer(offerInput({ priceValueEur: 15 }));
  });

  it('propagates EbayApiError on 422 validation failure', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({ path: '/sell/inventory/v1/offer', method: 'POST' })
      .reply(422, { errors: [{ errorId: 25713 }] });
    await expect(inventory().createOffer(offerInput())).rejects.toBeInstanceOf(EbayApiError);
  });
});

describe('InventoryClient.publishOffer', () => {
  it('POSTs to /offer/{id}/publish and returns listingId', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({
        path: '/sell/inventory/v1/offer/OFFER-99/publish',
        method: 'POST',
      })
      .reply(200, { listingId: '225891234567' });

    const r = await inventory().publishOffer('OFFER-99');
    expect(r.listingId).toBe('225891234567');
  });

  it('URL-encodes offerIds containing special chars', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({
        path: '/sell/inventory/v1/offer/OFFER%2F42/publish',
        method: 'POST',
      })
      .reply(200, { listingId: 'L1' });

    await inventory().publishOffer('OFFER/42');
  });

  it('throws on 400 (e.g., offer not in publishable state)', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({ path: '/sell/inventory/v1/offer/BAD/publish', method: 'POST' })
      .reply(400, { errors: [{ errorId: 25002 }] });
    await expect(inventory().publishOffer('BAD')).rejects.toBeInstanceOf(EbayApiError);
  });
});
