import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { createAccountClient } from './account';
import { EbayApiError } from './errors';
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

function account() {
  const http = createEbayHttpClient({
    environment: 'sandbox',
    getAccessToken: () => Promise.resolve('token'),
    sleep: () => Promise.resolve(),
  });
  return createAccountClient(http);
}

describe('AccountClient.getBusinessPolicies', () => {
  it('returns first policy ID of each type when all three exist', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({ path: (p) => p.startsWith('/sell/account/v1/fulfillment_policy') })
      .reply(200, {
        fulfillmentPolicies: [
          { fulfillmentPolicyId: 'FP-123', name: 'DHL Standard', marketplaceId: 'EBAY_DE' },
          { fulfillmentPolicyId: 'FP-999', name: 'DHL Express', marketplaceId: 'EBAY_DE' },
        ],
      });
    pool.intercept({ path: (p) => p.startsWith('/sell/account/v1/payment_policy') }).reply(200, {
      paymentPolicies: [
        { paymentPolicyId: 'PP-1', name: 'PayPal+Kauf auf Rechnung', marketplaceId: 'EBAY_DE' },
      ],
    });
    pool.intercept({ path: (p) => p.startsWith('/sell/account/v1/return_policy') }).reply(200, {
      returnPolicies: [{ returnPolicyId: 'RP-1', name: '14 Tage', marketplaceId: 'EBAY_DE' }],
    });

    const policies = await account().getBusinessPolicies('EBAY_DE');
    expect(policies.fulfillmentPolicyId).toBe('FP-123');
    expect(policies.paymentPolicyId).toBe('PP-1');
    expect(policies.returnPolicyId).toBe('RP-1');
    expect(policies.names.fulfillment).toBe('DHL Standard');
  });

  it('throws EbayApiError listing all missing policy types when any is empty', async () => {
    const pool = mockAgent.get(SANDBOX_API);
    pool
      .intercept({ path: (p) => p.startsWith('/sell/account/v1/fulfillment_policy') })
      .reply(200, {
        fulfillmentPolicies: [],
      });
    pool.intercept({ path: (p) => p.startsWith('/sell/account/v1/payment_policy') }).reply(200, {
      paymentPolicies: [{ paymentPolicyId: 'x', name: 'x', marketplaceId: 'EBAY_DE' }],
    });
    pool.intercept({ path: (p) => p.startsWith('/sell/account/v1/return_policy') }).reply(200, {});

    try {
      await account().getBusinessPolicies('EBAY_DE');
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EbayApiError);
      expect((err as EbayApiError).message).toContain('fulfillment_policy');
      expect((err as EbayApiError).message).toContain('return_policy');
      expect((err as EbayApiError).message).not.toContain('payment_policy');
    }
  });
});
