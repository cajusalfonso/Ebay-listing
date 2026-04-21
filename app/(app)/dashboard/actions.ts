'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { loadKeywordBlacklist } from '../../../src/config/categories';
import { EBAY_MARKETPLACE_ID } from '../../../src/config/constants';
import { auth } from '../../../lib/auth';
import { db } from '../../../lib/db';
import {
  buildUserHttpClient,
  loadUserDiscordWebhook,
  loadUserIcecatCredentials,
  MissingCredentialsError,
} from '../../../lib/user-clients';
import { listings, needsReview, products } from '../../../src/db/schema';
import { checkCompliance } from '../../../src/modules/compliance/check';
import { compileKeywordPatterns } from '../../../src/modules/compliance/keywords';
import { createDiscordNotifier } from '../../../src/modules/discord/webhook';
import type { PublishEvent } from '../../../src/modules/discord/types';
import { createAccountClient } from '../../../src/modules/ebay/account';
import { EbayApiError } from '../../../src/modules/ebay/errors';
import { createInventoryClient } from '../../../src/modules/ebay/inventory';
import { createEbayBrowseProvider } from '../../../src/modules/market-data/ebayBrowseProvider';
import { createGpsrOverrideLookup } from '../../../src/modules/product-data/gpsrOverride';
import { enrichProductByEan } from '../../../src/modules/product-data/orchestrator';
import { createEbayCatalogSource } from '../../../src/modules/product-data/sources/ebayCatalogSource';
import { createIcecatSource } from '../../../src/modules/product-data/sources/icecat';
import { createIcecatClient } from '../../../src/modules/product-data/sources/icecatClient';
import { suggestSellPrice } from '../../../src/modules/pricing/strategy';

const inputSchema = z.object({
  ean: z
    .string()
    .trim()
    .regex(/^\d{8,14}$/, 'EAN must be 8–14 digits'),
  cogs: z.coerce.number().positive('COGS must be > 0'),
  publish: z
    .union([z.literal('on'), z.literal('true'), z.boolean(), z.undefined(), z.null()])
    .transform((v) => v === 'on' || v === 'true' || v === true),
});

export interface PreviewData {
  title: string;
  brand: string | null;
  primarySource: string;
  qualityScore: number;
  suggestedCategoryId: string | null;
  imageCount: number;
  compliance: {
    passed: boolean;
    blockers: readonly string[];
    warnings: readonly string[];
  };
  market: {
    competitorCount: number;
    lowestPriceEur: number | null;
    medianPriceEur: number | null;
    searchUrl: string;
  };
  pricing: {
    decision: 'list' | 'skip' | 'manual_review';
    reason: string;
    recommendedPriceGross: number;
    marketPosition: string;
    profitEur: number;
    marginPercent: number;
  };
}

export interface PublishOutcome {
  published: boolean;
  listingId: string | null;
  listingUrl: string | null;
  sku: string | null;
  failureReason: string | null;
}

export interface ListingActionResult {
  ok: boolean;
  error?: string;
  preview?: PreviewData;
  publish?: PublishOutcome;
}

function listingUrl(env: 'sandbox' | 'production', id: string): string {
  return env === 'production'
    ? `https://www.ebay.de/itm/${id}`
    : `https://www.sandbox.ebay.de/itm/${id}`;
}

function uniqueSku(ean: string, env: 'sandbox' | 'production', userId: number): string {
  return `${env.slice(0, 3)}-u${userId}-${ean}-${Date.now().toString(36)}`;
}

export async function createListingAction(formData: FormData): Promise<ListingActionResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: 'Nicht eingeloggt.' };
  const userId = Number.parseInt(session.user.id, 10);

  const parsed = inputSchema.safeParse({
    ean: formData.get('ean'),
    cogs: formData.get('cogs'),
    publish: formData.get('publish'),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe' };
  }

  const ebayEnv: 'sandbox' | 'production' = 'sandbox';
  const { ean, cogs, publish: shouldPublish } = parsed.data;

  // --- 1. Build per-user clients (fails early if creds missing) ---
  let clients;
  try {
    clients = await buildUserHttpClient(userId, ebayEnv);
  } catch (error) {
    if (error instanceof MissingCredentialsError) {
      return {
        ok: false,
        error: `Fehlende Credentials: ${error.missing.join(', ')}. In Settings ausfüllen.`,
      };
    }
    return { ok: false, error: (error as Error).message };
  }

  // --- 2. Enrichment ---
  const catalogSource = createEbayCatalogSource(clients.catalog);
  const icecatCreds = await loadUserIcecatCredentials(userId, ebayEnv);
  const sources = icecatCreds
    ? [
        catalogSource,
        createIcecatSource(
          createIcecatClient({ user: icecatCreds.user, password: icecatCreds.password })
        ),
      ]
    : [catalogSource];

  const enrich = await enrichProductByEan({
    ean,
    sources,
    gpsrOverrideLookup: createGpsrOverrideLookup(db),
  });

  if (!enrich.data) {
    await db.insert(needsReview).values({
      userId,
      ean,
      reason: 'data_missing',
      details: { sourcesAttempted: [...enrich.sourcesAttempted] },
    });
    return {
      ok: false,
      error: `Keine Produktdaten gefunden. Sources: ${enrich.sourcesAttempted.join(', ')}.`,
    };
  }

  const product = enrich.data;

  // --- 3. Compliance ---
  const blacklist = compileKeywordPatterns(loadKeywordBlacklist().patterns);
  const categoryId = product.suggestedCategoryId ?? 'UNRESOLVED';

  const compliance = checkCompliance({
    product: {
      ean: product.ean,
      title: product.title,
      brand: product.brand,
      description: product.description,
      specs: product.specs,
      images: product.images,
      gpsrData: product.gpsrData,
    },
    categoryId,
    requiredAspects: {},
    approvedCategoryIds: new Set([categoryId]),
    keywordBlacklist: blacklist,
  });

  // --- 4. Market ---
  const marketProvider = createEbayBrowseProvider(clients.browse);
  const marketSnapshot = await marketProvider.getLowestPriceByEan(ean);

  // --- 5. Pricing ---
  const suggestion = suggestSellPrice(marketSnapshot, cogs, 0.12, {
    vatRate: 0.19,
    shippingCostToMe: 0,
    shippingChargedToBuyer: 0,
    ebayFixedFeePerOrder: 0.35,
    ebayStoreFeeAllocation: 0,
    returnReservePercent: 0.03,
    minAbsoluteProfit: 10,
    minMarginPercent: 0.08,
    undercutAmount: 0.5,
    targetMarginMultiplier: 1.25,
  });

  const preview: PreviewData = {
    title: product.title,
    brand: product.brand,
    primarySource: product.primarySource,
    qualityScore: product.qualityScore,
    suggestedCategoryId: product.suggestedCategoryId,
    imageCount: product.images.length,
    compliance: {
      passed: compliance.passed,
      blockers: compliance.blockers,
      warnings: compliance.warnings,
    },
    market: {
      competitorCount: marketSnapshot.competitorCount,
      lowestPriceEur: marketSnapshot.lowestPrice,
      medianPriceEur: marketSnapshot.medianPrice,
      searchUrl: marketSnapshot.marketplaceSearchUrl,
    },
    pricing: {
      decision: suggestion.decision,
      reason: suggestion.reason,
      recommendedPriceGross: suggestion.recommendedPriceGross,
      marketPosition: suggestion.marketPosition,
      profitEur: suggestion.pricingResult.absoluteProfit,
      marginPercent: suggestion.pricingResult.marginPercent,
    },
  };

  // --- Dry-run only? Return preview. ---
  if (!shouldPublish) {
    return { ok: true, preview };
  }

  // --- Publish guards ---
  if (!compliance.passed) {
    await db.insert(needsReview).values({
      userId,
      ean,
      reason: 'compliance_failed',
      details: { blockers: [...compliance.blockers], warnings: [...compliance.warnings] },
    });
    return {
      ok: false,
      preview,
      error: `Compliance blockiert Publish: ${compliance.blockers.join(', ')}`,
    };
  }
  if (suggestion.decision !== 'list') {
    await db.insert(needsReview).values({
      userId,
      ean,
      reason: suggestion.reason,
      details: {
        decision: suggestion.decision,
        recommendedPriceGross: suggestion.recommendedPriceGross,
      },
    });
    return {
      ok: false,
      preview,
      error: `Pricing-Entscheidung = ${suggestion.decision} (${suggestion.reason}). Nicht veröffentlicht.`,
    };
  }
  if (!product.suggestedCategoryId) {
    await db.insert(needsReview).values({
      userId,
      ean,
      reason: 'category_unresolved',
      details: { primarySource: product.primarySource },
    });
    return {
      ok: false,
      preview,
      error: 'eBay-Kategorie konnte nicht automatisch ermittelt werden.',
    };
  }

  // --- 6. Publish via Inventory API ---
  const merchantLocationKey = clients.credentials.merchantLocationKey ?? 'main';
  const accountClient = createAccountClient(clients.http);
  const inventoryClient = createInventoryClient(clients.http);

  let policies;
  try {
    policies = await accountClient.getBusinessPolicies(EBAY_MARKETPLACE_ID);
  } catch (error) {
    const reason = error instanceof EbayApiError ? error.message : 'business_policies_missing';
    await db.insert(needsReview).values({
      userId,
      ean,
      reason: 'policies_missing',
      details: { error: String(reason) },
    });
    return {
      ok: false,
      preview,
      error: `Business Policies fehlen im eBay Seller Hub: ${reason}`,
    };
  }

  const sku = uniqueSku(ean, ebayEnv, userId);
  const inventoryAspects = Object.fromEntries(
    Object.entries(product.specs).map(([k, v]) => [k, [v]])
  );

  // Shared product cache across tenants (eBay Catalog data is marketplace-level).
  await db
    .insert(products)
    .values({
      ean: product.ean,
      title: product.title,
      brand: product.brand,
      mpn: product.mpn,
      description: product.description,
      specs: product.specs,
      ebayCategoryId: product.suggestedCategoryId,
      dataSource: product.primarySource,
      sourceMetadata: product.sourceMetadata,
      qualityScore: product.qualityScore,
    })
    .onConflictDoUpdate({
      target: products.ean,
      set: {
        title: product.title,
        brand: product.brand,
        description: product.description,
        specs: product.specs,
        ebayCategoryId: product.suggestedCategoryId,
        sourceMetadata: product.sourceMetadata,
        qualityScore: product.qualityScore,
      },
    });

  try {
    await inventoryClient.createOrUpdateInventoryItem({
      sku,
      title: product.title.slice(0, 80),
      description: product.description ?? product.title,
      condition: 'NEW',
      aspects: inventoryAspects,
      imageUrls: product.images.map((i) => i.url),
      ...(product.brand ? { brand: product.brand } : {}),
      ...(product.mpn ? { mpn: product.mpn } : {}),
      ean: product.ean,
      quantity: 1,
    });

    const { offerId } = await inventoryClient.createOffer({
      sku,
      categoryId: product.suggestedCategoryId,
      priceValueEur: suggestion.recommendedPriceGross,
      listingDescription: product.description ?? product.title,
      fulfillmentPolicyId: policies.fulfillmentPolicyId,
      paymentPolicyId: policies.paymentPolicyId,
      returnPolicyId: policies.returnPolicyId,
      merchantLocationKey,
    });

    const { listingId } = await inventoryClient.publishOffer(offerId);

    await db.insert(listings).values({
      userId,
      ean: product.ean,
      ebayEnvironment: ebayEnv,
      ebaySku: sku,
      ebayOfferId: offerId,
      ebayListingId: listingId,
      sellPriceGross: suggestion.recommendedPriceGross.toFixed(2),
      cogs: cogs.toFixed(2),
      calculatedProfit: suggestion.pricingResult.absoluteProfit.toFixed(2),
      calculatedMargin: suggestion.pricingResult.marginPercent.toFixed(4),
      status: 'published',
      compliancePassed: true,
      complianceBlockers: null,
      publishedAt: new Date(),
    });

    const webhook = await loadUserDiscordWebhook(userId, ebayEnv);
    if (webhook) {
      const notifier = createDiscordNotifier({ webhookUrl: webhook });
      const event: PublishEvent = {
        status: 'published',
        title: product.title,
        ean: product.ean,
        categoryName: product.suggestedCategoryId,
        categoryId: product.suggestedCategoryId,
        cogsEur: cogs,
        sellPriceGrossEur: suggestion.recommendedPriceGross,
        profitEur: suggestion.pricingResult.absoluteProfit,
        marginPercent: suggestion.pricingResult.marginPercent,
        competitorCount: marketSnapshot.competitorCount,
        lowestCompetitorEur: marketSnapshot.lowestPrice,
        marketPosition: suggestion.marketPosition,
        ebayListingUrl: listingUrl(ebayEnv, listingId),
        ebaySearchUrl: marketSnapshot.marketplaceSearchUrl,
        environment: ebayEnv,
        failureReason: null,
      };
      await notifier.publishEvent(event).catch(() => {
        /* swallow — listing is already live, Discord failure shouldn't block */
      });
    }

    revalidatePath('/dashboard');
    revalidatePath('/listings');

    return {
      ok: true,
      preview,
      publish: {
        published: true,
        listingId,
        listingUrl: listingUrl(ebayEnv, listingId),
        sku,
        failureReason: null,
      },
    };
  } catch (error) {
    const reason = error instanceof EbayApiError ? error.message : 'unknown_publish_error';
    await db.insert(listings).values({
      userId,
      ean: product.ean,
      ebayEnvironment: ebayEnv,
      ebaySku: sku,
      sellPriceGross: suggestion.recommendedPriceGross.toFixed(2),
      cogs: cogs.toFixed(2),
      status: 'failed',
      compliancePassed: true,
      complianceBlockers: null,
    });
    revalidatePath('/listings');
    return {
      ok: false,
      preview,
      publish: {
        published: false,
        listingId: null,
        listingUrl: null,
        sku,
        failureReason: reason,
      },
      error: `Publish failed: ${reason}`,
    };
  }
}

// Back-compat alias for the form that imports `runDryRunAction`.
export const runDryRunAction = createListingAction;
export type DryRunResult = ListingActionResult;
