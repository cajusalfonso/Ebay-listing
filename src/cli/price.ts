import { defineCommand, runMain } from 'citty';
import { loadEnv } from '../config/env';
import { newCorrelationId, withCorrelation } from '../lib/correlation';
import { createLogger } from '../lib/logger';
import { createEbayBrowseProvider } from '../modules/market-data/ebayBrowseProvider';
import { suggestSellPrice } from '../modules/pricing/strategy';
import { buildCliClients } from './lib/clients';

const log = createLogger({ pretty: true });

const command = defineCommand({
  meta: {
    name: 'price',
    description: 'Debug: fetch market + run pricing strategy for an EAN+COGS',
  },
  args: {
    ean: { type: 'string', required: true },
    cogs: { type: 'string', required: true },
  },
  async run({ args }) {
    await withCorrelation(newCorrelationId(), async () => {
      const env = loadEnv();
      const cogs = Number.parseFloat(args.cogs);
      if (!Number.isFinite(cogs) || cogs <= 0) {
        throw new Error(`Invalid --cogs: ${args.cogs}`);
      }
      const clients = buildCliClients(env);
      try {
        const provider = createEbayBrowseProvider(clients.browse);
        const snapshot = await provider.getLowestPriceByEan(args.ean);

        const suggestion = suggestSellPrice(snapshot, cogs, env.DEFAULT_EBAY_FEE_PERCENT, {
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
        });
        log.info({ decision: suggestion.decision }, 'Pricing suggestion');
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(suggestion, null, 2));
      } finally {
        await clients.close();
      }
    });
  },
});

await runMain(command);
