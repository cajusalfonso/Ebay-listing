import { z } from 'zod';
import type { EbayHttpClient } from './httpClient';
import { EbayApiError } from './errors';

const fulfillmentPolicySchema = z.object({
  fulfillmentPolicyId: z.string(),
  name: z.string(),
  marketplaceId: z.string(),
});

const paymentPolicySchema = z.object({
  paymentPolicyId: z.string(),
  name: z.string(),
  marketplaceId: z.string(),
});

const returnPolicySchema = z.object({
  returnPolicyId: z.string(),
  name: z.string(),
  marketplaceId: z.string(),
});

const fulfillmentListSchema = z.object({
  fulfillmentPolicies: z.array(fulfillmentPolicySchema).optional(),
});
const paymentListSchema = z.object({
  paymentPolicies: z.array(paymentPolicySchema).optional(),
});
const returnListSchema = z.object({
  returnPolicies: z.array(returnPolicySchema).optional(),
});

export interface BusinessPolicies {
  readonly fulfillmentPolicyId: string;
  readonly paymentPolicyId: string;
  readonly returnPolicyId: string;
  readonly names: {
    readonly fulfillment: string;
    readonly payment: string;
    readonly return: string;
  };
}

export interface AccountClient {
  /**
   * Fetch the first policy of each required type for the given marketplace.
   * Throws `EbayApiError` if any of the three policy types has no entry —
   * the operator must create them in Seller Hub before publishing.
   */
  getBusinessPolicies(marketplaceId: string): Promise<BusinessPolicies>;
}

export function createAccountClient(http: EbayHttpClient): AccountClient {
  return {
    async getBusinessPolicies(marketplaceId) {
      const [fulfillment, payment, returns] = await Promise.all([
        http.get('/sell/account/v1/fulfillment_policy', fulfillmentListSchema, {
          query: { marketplace_id: marketplaceId },
        }),
        http.get('/sell/account/v1/payment_policy', paymentListSchema, {
          query: { marketplace_id: marketplaceId },
        }),
        http.get('/sell/account/v1/return_policy', returnListSchema, {
          query: { marketplace_id: marketplaceId },
        }),
      ]);

      const fp = fulfillment.fulfillmentPolicies?.[0];
      const pp = payment.paymentPolicies?.[0];
      const rp = returns.returnPolicies?.[0];

      const missing: string[] = [];
      if (!fp) missing.push('fulfillment_policy');
      if (!pp) missing.push('payment_policy');
      if (!rp) missing.push('return_policy');
      if (!fp || !pp || !rp) {
        throw new EbayApiError(
          `Missing business policies for ${marketplaceId}: ${missing.join(', ')}. Create them in eBay Seller Hub.`,
          { marketplaceId, missing }
        );
      }

      return {
        fulfillmentPolicyId: fp.fulfillmentPolicyId,
        paymentPolicyId: pp.paymentPolicyId,
        returnPolicyId: rp.returnPolicyId,
        names: { fulfillment: fp.name, payment: pp.name, return: rp.name },
      };
    },
  };
}
