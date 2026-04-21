import { defineCommand, runMain } from 'citty';
import { loadResolvedCategoryIds } from '../config/categories';
import { EBAY_MARKETPLACE_ID } from '../config/constants';
import { loadEnv } from '../config/env';
import { listings, needsReview, products } from '../db/schema';
import { newCorrelationId, withCorrelation } from '../lib/correlation';
import { createLogger } from '../lib/logger';
import { checkCompliance } from '../modules/compliance/check';
import { compileKeywordPatterns } from '../modules/compliance/keywords';
import { loadKeywordBlacklist } from '../config/categories';
import { createDiscordNotifier } from '../modules/discord/webhook';
import type { PublishEvent } from '../modules/discord/types';
import { EbayApiError } from '../modules/ebay/errors';
import { createAccountClient } from '../modules/ebay/account';
import { createInventoryClient } from '../modules/ebay/inventory';
import { createEbayBrowseProvider } from '../modules/market-data/ebayBrowseProvider';
import { createGpsrOverrideLookup } from '../modules/product-data/gpsrOverride';
import { enrichProductByEan } from '../modules/product-data/orchestrator';
import { createEbayCatalogSource } from '../modules/product-data/sources/ebayCatalogSource';
import { createIcecatSource } from '../modules/product-data/sources/icecat';
import { createIcecatClient } from '../modules/product-data/sources/icecatClient';
import { suggestSellPrice } from '../modules/pricing/strategy';
import { buildCliClients } from './lib/clients';

const log = createLogger({ pretty: true });

function ensureProductionSafety(args: { env: string | undefined; yesReally: boolean }): void {
  if (args.env === 'production' && !args.yesReally) {
    throw new Error('Production publish requires both --env=production AND --yes-really.');
  }
}

function uniqueSku(ean: string, environment: string): string {
  return `${environment.slice(0, 3)}-${ean}-${Date.now().toString(36)}`;
}

const command = defineCommand({
  meta: {
    name: 'list-product',
    description:
      'Full-flow orchestrator: enrich → compliance → market → price → (optional) publish to eBay + Discord notify.',
  },
  args: {
    ean: { type: 'string', required: true, description: 'EAN/GTIN of the product' },
    cogs: { type: 'string', required: true, description: 'Cost of goods sold in EUR (net)' },
    categoryId: {
      type: 'string',
      description: 'Override auto-resolved category id',
    },
    merchantLocationKey: {
      type: 'string',
      description: 'Inventory location key registered in eBay Seller Hub',
      default: 'main',
    },
    publish: {
      type: 'boolean',
      description: 'Actually create + publish the listing on eBay',
      default: false,
    },
    env: { type: 'string', description: 'Override EBAY_ENV (sandbox | production)' },
    yesReally: {
      type: 'boolean',
      description: 'Required alongside --env=production to prevent accidents',
      default: false,
    },
    dryRun: {
      type: 'boolean',
      description: 'Compute everything, do not publish, do not send Discord',
      default: true,
    },
  },
  async run({ args }) {
    await withCorrelation(newCorrelationId(), async () => {
      ensureProductionSafety({ env: args.env, yesReally: args.yesReally });

      const env = loadEnv();
      const effectiveEnv = (args.env as 'sandbox' | 'production' | undefined) ?? env.EBAY_ENV;
      const cogs = Number.parseFloat(args.cogs);
      if (!Number.isFinite(cogs) || cogs <= 0) {
        throw new Error(`Invalid --cogs: ${args.cogs}`);
      }

      const clients = buildCliClients(env);

      try {
        log.info({ ean: args.ean, env: effectiveEnv }, 'Enriching product data');
        const catalogSource = createEbayCatalogSource(clients.catalog);
        const icecatClient = createIcecatClient({
          user: env.ICECAT_USER,
          password: env.ICECAT_PASSWORD,
        });
        const icecatSource = createIcecatSource(icecatClient);

        const enrich = await enrichProductByEan({
          ean: args.ean,
          sources: [catalogSource, icecatSource],
          gpsrOverrideLookup: createGpsrOverrideLookup(clients.db.db),
        });

        if (!enrich.data) {
          log.error(
            {
              ean: args.ean,
              sourcesAttempted: enrich.sourcesAttempted,
              errors: enrich.sourceErrors,
            },
            'No product data found in any source'
          );
          await clients.db.db.insert(needsReview).values({
            ean: args.ean,
            reason: 'data_missing',
            details: {
              sourcesAttempted: enrich.sourcesAttempted,
              errors: String(enrich.sourceErrors),
            },
          });
          return;
        }

        const product = enrich.data;
        log.info(
          {
            title: product.title,
            brand: product.brand,
            primary: product.primarySource,
            quality: product.qualityScore,
          },
          'Enrichment complete'
        );

        const overrideCategoryId = args.categoryId as string | undefined;
        const categoryId =
          overrideCategoryId !== undefined && overrideCategoryId.length > 0
            ? overrideCategoryId
            : product.suggestedCategoryId;
        if (!categoryId) {
          log.error(
            'No category resolved for product — pass --category-id or fix taxonomy lookup.'
          );
          return;
        }

        const approvedCategoryIds = (() => {
          try {
            return new Set(Object.values(loadResolvedCategoryIds()));
          } catch {
            log.warn(
              'config-files/ebay-category-ids.json missing — skipping whitelist check (WHITELIST-BYPASS).'
            );
            return new Set<string>([categoryId]);
          }
        })();

        const aspects = await clients.taxonomy.getItemAspectsForCategory(
          await clients.taxonomy.getDefaultCategoryTreeId(EBAY_MARKETPLACE_ID),
          categoryId
        );
        const requiredAspects = Object.fromEntries(
          aspects.filter((a) => a.required).map((a) => [a.name, a.allowedValues])
        );
        const blacklist = compileKeywordPatterns(loadKeywordBlacklist().patterns);

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
          requiredAspects,
          approvedCategoryIds,
          keywordBlacklist: blacklist,
        });

        if (!compliance.passed) {
          log.error({ blockers: compliance.blockers }, 'Compliance check failed');
          await clients.db.db.insert(needsReview).values({
            ean: args.ean,
            reason: 'compliance_failed',
            details: { blockers: compliance.blockers, warnings: compliance.warnings, categoryId },
          });
          return;
        }
        if (compliance.warnings.length > 0) {
          log.warn({ warnings: compliance.warnings }, 'Compliance warnings (non-blocking)');
        }

        const marketProvider = createEbayBrowseProvider(clients.browse);
        const marketSnapshot = await marketProvider.getLowestPriceByEan(args.ean);

        const pricingRules = {
          vatRate: env.DEFAULT_VAT_RATE,
          shippingCostToMe: 0,
          shippingChargedToBuyer: 0,
          ebayFixedFeePerOrder: env.DEFAULT_EBAY_FIXED_FEE_EUR,
          ebayStoreFeeAllocation: 0,
          returnReservePercent: env.DEFAULT_RETURN_RESERVE_PERCENT,
          minAbsoluteProfit: env.MIN_ABSOLUTE_PROFIT_EUR,
          minMarginPercent: env.MIN_MARGIN_PERCENT,
          undercutAmount: env.UNDERCUT_AMOUNT_EUR,
          targetMarginMultiplier: env.TARGET_MARGIN_MULTIPLIER,
        };
        const suggestion = suggestSellPrice(
          marketSnapshot,
          cogs,
          env.DEFAULT_EBAY_FEE_PERCENT,
          pricingRules
        );

        log.info(
          {
            decision: suggestion.decision,
            price: suggestion.recommendedPriceGross,
            reason: suggestion.reason,
            marketPosition: suggestion.marketPosition,
            profit: suggestion.pricingResult.absoluteProfit,
            margin: suggestion.pricingResult.marginPercent,
          },
          'Price suggestion'
        );

        if (suggestion.decision === 'skip') {
          await clients.db.db.insert(needsReview).values({
            ean: args.ean,
            reason: suggestion.reason,
            details: {
              suggestion: {
                price: suggestion.recommendedPriceGross,
                marketPosition: suggestion.marketPosition,
              },
            },
          });
          return;
        }

        await clients.db.db
          .insert(products)
          .values({
            ean: product.ean,
            title: product.title,
            brand: product.brand,
            mpn: product.mpn,
            description: product.description,
            specs: product.specs,
            ebayCategoryId: categoryId,
            dataSource: product.primarySource,
            sourceMetadata: product.sourceMetadata,
            qualityScore: product.qualityScore,
          })
          .onConflictDoUpdate({
            target: products.ean,
            set: {
              title: product.title,
              brand: product.brand,
              mpn: product.mpn,
              description: product.description,
              specs: product.specs,
              ebayCategoryId: categoryId,
              dataSource: product.primarySource,
              sourceMetadata: product.sourceMetadata,
              qualityScore: product.qualityScore,
            },
          });

        const discordNotifier = createDiscordNotifier({
          webhookUrl: env.DISCORD_WEBHOOK_URL,
          dryRun: args.dryRun && !args.publish,
        });

        if (!args.publish) {
          log.info('--publish NOT set — dry run. Not creating eBay listing.');
          const event: PublishEvent = {
            status: 'would_publish_dry_run',
            title: product.title,
            ean: product.ean,
            categoryName: categoryId,
            categoryId,
            cogsEur: cogs,
            sellPriceGrossEur: suggestion.recommendedPriceGross,
            profitEur: suggestion.pricingResult.absoluteProfit,
            marginPercent: suggestion.pricingResult.marginPercent,
            competitorCount: marketSnapshot.competitorCount,
            lowestCompetitorEur: marketSnapshot.lowestPrice,
            marketPosition: suggestion.marketPosition,
            ebayListingUrl: null,
            ebaySearchUrl: marketSnapshot.marketplaceSearchUrl,
            environment: effectiveEnv,
            failureReason: null,
          };
          await discordNotifier.publishEvent(event);
          return;
        }

        // ---------- PUBLISH PATH ----------
        log.info({ environment: effectiveEnv }, 'Publishing to eBay Inventory API');
        const sku = uniqueSku(args.ean, effectiveEnv);
        const accountClient = createAccountClient(clients.http);
        const policies = await accountClient.getBusinessPolicies(EBAY_MARKETPLACE_ID);

        const inventoryClient = createInventoryClient(clients.http);
        const inventoryAspects = Object.fromEntries(
          Object.entries(product.specs).map(([k, v]) => [k, [v]])
        );

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
            categoryId,
            priceValueEur: suggestion.recommendedPriceGross,
            listingDescription: product.description ?? product.title,
            fulfillmentPolicyId: policies.fulfillmentPolicyId,
            paymentPolicyId: policies.paymentPolicyId,
            returnPolicyId: policies.returnPolicyId,
            merchantLocationKey: args.merchantLocationKey,
          });

          const { listingId } = await inventoryClient.publishOffer(offerId);

          const listingUrl =
            effectiveEnv === 'production'
              ? `https://www.ebay.de/itm/${listingId}`
              : `https://www.sandbox.ebay.de/itm/${listingId}`;

          await clients.db.db.insert(listings).values({
            ean: product.ean,
            ebayEnvironment: effectiveEnv,
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

          log.info({ listingId, listingUrl, sku, offerId }, '✓ Listing published');

          const event: PublishEvent = {
            status: 'published',
            title: product.title,
            ean: product.ean,
            categoryName: categoryId,
            categoryId,
            cogsEur: cogs,
            sellPriceGrossEur: suggestion.recommendedPriceGross,
            profitEur: suggestion.pricingResult.absoluteProfit,
            marginPercent: suggestion.pricingResult.marginPercent,
            competitorCount: marketSnapshot.competitorCount,
            lowestCompetitorEur: marketSnapshot.lowestPrice,
            marketPosition: suggestion.marketPosition,
            ebayListingUrl: listingUrl,
            ebaySearchUrl: marketSnapshot.marketplaceSearchUrl,
            environment: effectiveEnv,
            failureReason: null,
          };
          await discordNotifier.publishEvent(event);
        } catch (error) {
          const statusCode =
            error instanceof EbayApiError && typeof error.context.statusCode === 'number'
              ? error.context.statusCode
              : null;
          const reason =
            error instanceof EbayApiError
              ? `ebay_api_error:${statusCode === null ? 'unknown' : String(statusCode)}`
              : 'unknown_error';
          log.error({ error }, 'Publish failed');
          await clients.db.db.insert(listings).values({
            ean: product.ean,
            ebayEnvironment: effectiveEnv,
            ebaySku: sku,
            sellPriceGross: suggestion.recommendedPriceGross.toFixed(2),
            cogs: cogs.toFixed(2),
            status: 'failed',
            compliancePassed: true,
            complianceBlockers: null,
          });
          const event: PublishEvent = {
            status: 'failed',
            title: product.title,
            ean: product.ean,
            categoryName: categoryId,
            categoryId,
            cogsEur: cogs,
            sellPriceGrossEur: suggestion.recommendedPriceGross,
            profitEur: suggestion.pricingResult.absoluteProfit,
            marginPercent: suggestion.pricingResult.marginPercent,
            competitorCount: marketSnapshot.competitorCount,
            lowestCompetitorEur: marketSnapshot.lowestPrice,
            marketPosition: suggestion.marketPosition,
            ebayListingUrl: null,
            ebaySearchUrl: marketSnapshot.marketplaceSearchUrl,
            environment: effectiveEnv,
            failureReason: reason,
          };
          await discordNotifier.publishEvent(event);
          throw error;
        }
      } finally {
        await clients.close();
      }
    });
  },
});

await runMain(command);
