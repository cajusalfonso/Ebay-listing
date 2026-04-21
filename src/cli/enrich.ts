import { defineCommand, runMain } from 'citty';
import { loadEnv } from '../config/env';
import { newCorrelationId, withCorrelation } from '../lib/correlation';
import { createLogger } from '../lib/logger';
import { createGpsrOverrideLookup } from '../modules/product-data/gpsrOverride';
import { enrichProductByEan } from '../modules/product-data/orchestrator';
import { createEbayCatalogSource } from '../modules/product-data/sources/ebayCatalogSource';
import { createIcecatSource } from '../modules/product-data/sources/icecat';
import { createIcecatClient } from '../modules/product-data/sources/icecatClient';
import { buildCliClients } from './lib/clients';

const log = createLogger({ pretty: true });

const command = defineCommand({
  meta: {
    name: 'enrich',
    description: 'Debug: run product-data enrichment for an EAN and print the merged result',
  },
  args: {
    ean: { type: 'string', required: true },
  },
  async run({ args }) {
    await withCorrelation(newCorrelationId(), async () => {
      const env = loadEnv();
      const clients = buildCliClients(env);
      try {
        const catalogSource = createEbayCatalogSource(clients.catalog);
        const icecatClient = createIcecatClient({
          user: env.ICECAT_USER,
          password: env.ICECAT_PASSWORD,
        });
        const result = await enrichProductByEan({
          ean: args.ean,
          sources: [catalogSource, createIcecatSource(icecatClient)],
          gpsrOverrideLookup: createGpsrOverrideLookup(clients.db.db),
        });
        log.info({ summary: result }, 'Enrichment result');
        // eslint-disable-next-line no-console -- debug output formatted for operator
        console.log(JSON.stringify(result, null, 2));
      } finally {
        await clients.close();
      }
    });
  },
});

await runMain(command);
