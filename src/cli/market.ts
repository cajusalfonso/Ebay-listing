import { defineCommand, runMain } from 'citty';
import { loadEnv } from '../config/env';
import { newCorrelationId, withCorrelation } from '../lib/correlation';
import { createLogger } from '../lib/logger';
import { createEbayBrowseProvider } from '../modules/market-data/ebayBrowseProvider';
import { buildCliClients } from './lib/clients';

const log = createLogger({ pretty: true });

const command = defineCommand({
  meta: { name: 'market', description: 'Debug: fetch eBay.de Browse market snapshot for an EAN' },
  args: {
    ean: { type: 'string', required: true },
  },
  async run({ args }) {
    await withCorrelation(newCorrelationId(), async () => {
      const env = loadEnv();
      const clients = buildCliClients(env);
      try {
        const provider = createEbayBrowseProvider(clients.browse);
        const snapshot = await provider.getLowestPriceByEan(args.ean);
        log.info('Market snapshot fetched');
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(snapshot, null, 2));
      } finally {
        await clients.close();
      }
    });
  },
});

await runMain(command);
