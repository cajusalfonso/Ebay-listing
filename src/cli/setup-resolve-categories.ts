import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { defineCommand, runMain } from 'citty';
import { loadCategoryWhitelist } from '../config/categories';
import { EBAY_MARKETPLACE_ID } from '../config/constants';
import { loadEnv } from '../config/env';
import { createDbClient } from '../db/client';
import { newCorrelationId, withCorrelation } from '../lib/correlation';
import { parseEncryptionKey } from '../lib/encryption';
import { createLogger } from '../lib/logger';
import { createEbayOAuthClient } from '../modules/ebay/auth';
import { createEbayHttpClient } from '../modules/ebay/httpClient';
import {
  createTaxonomyClient,
  type CategorySuggestion,
  type TaxonomyClient,
} from '../modules/ebay/taxonomy';
import { createDbTokenStore, getValidAccessToken } from '../modules/ebay/tokenStore';

const log = createLogger({ pretty: true });

type Resolution = { status: 'resolved'; categoryId: string } | { status: 'skipped' };

async function promptForChoice(
  rl: ReturnType<typeof createInterface>,
  suggestions: readonly CategorySuggestion[]
): Promise<Resolution> {
  if (suggestions.length === 0) {
    // eslint-disable-next-line no-console
    console.log('  (no suggestions from eBay)');
    const custom = (await rl.question('  Enter categoryId manually, or blank to skip: ')).trim();
    return custom.length > 0 ? { status: 'resolved', categoryId: custom } : { status: 'skipped' };
  }

  suggestions.slice(0, 5).forEach((s, idx) => {
    const ancestors = s.ancestorPath.map((a) => a.categoryName).join(' > ');
    // eslint-disable-next-line no-console
    console.log(
      `  [${idx + 1}] ${s.categoryId.padEnd(8)} ${s.categoryName}` +
        (ancestors ? `  (${ancestors})` : '') +
        (s.relevancy ? `  relevancy=${s.relevancy}` : '')
    );
  });
  // eslint-disable-next-line no-console
  console.log('  [c] Enter custom categoryId');
  // eslint-disable-next-line no-console
  console.log('  [s] Skip this whitelist entry');

  const answer = (await rl.question('  Choose: ')).trim().toLowerCase();
  if (answer === 's' || answer === '') return { status: 'skipped' };
  if (answer === 'c') {
    const custom = (await rl.question('  categoryId: ')).trim();
    return custom.length > 0 ? { status: 'resolved', categoryId: custom } : { status: 'skipped' };
  }
  const idx = Number.parseInt(answer, 10) - 1;
  const picked = suggestions[idx];
  if (!picked) {
    // eslint-disable-next-line no-console
    console.log('  Invalid choice, skipping.');
    return { status: 'skipped' };
  }
  return { status: 'resolved', categoryId: picked.categoryId };
}

async function resolveAllCategories(
  taxonomy: TaxonomyClient,
  treeId: string
): Promise<Record<string, string>> {
  const whitelist = loadCategoryWhitelist();
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const result: Record<string, string> = {};

  try {
    for (const entry of whitelist) {
      const query = entry.ebay_category_path.at(-1) ?? entry.name;
      // eslint-disable-next-line no-console
      console.log(`\n→ Resolving "${entry.name}" (search: "${query}")`);
      if (entry.notes) {
        // eslint-disable-next-line no-console
        console.log(`  Notes: ${entry.notes}`);
      }
      const suggestions = await taxonomy.getCategorySuggestions(treeId, query);
      const resolution = await promptForChoice(rl, suggestions);
      if (resolution.status === 'resolved') {
        result[entry.name] = resolution.categoryId;
        // eslint-disable-next-line no-console
        console.log(`  ✓ "${entry.name}" → ${resolution.categoryId}`);
      } else {
        // eslint-disable-next-line no-console
        console.log(`  — skipped`);
      }
    }
  } finally {
    rl.close();
  }
  return result;
}

const command = defineCommand({
  meta: {
    name: 'setup:resolve-categories',
    description:
      'Resolve whitelist category names to eBay category IDs via Taxonomy API, interactive choice per entry. Writes config-files/ebay-category-ids.json.',
  },
  args: {
    outputPath: {
      type: 'string',
      description: 'Override output JSON file path',
      default: 'config-files/ebay-category-ids.json',
    },
  },
  async run({ args }) {
    await withCorrelation(newCorrelationId(), async () => {
      const env = loadEnv();
      const dbClient = createDbClient(env.DATABASE_URL);
      try {
        const store = createDbTokenStore(dbClient.db, parseEncryptionKey(env.TOKEN_ENCRYPTION_KEY));
        const oauthClient = createEbayOAuthClient({
          environment: env.EBAY_ENV,
          appId: env.EBAY_APP_ID,
          certId: env.EBAY_CERT_ID,
          redirectUriName: env.EBAY_REDIRECT_URI_NAME,
        });
        const http = createEbayHttpClient({
          environment: env.EBAY_ENV,
          getAccessToken: () =>
            getValidAccessToken({ store, oauthClient, environment: env.EBAY_ENV }),
        });
        const taxonomy = createTaxonomyClient(http);

        log.info({ environment: env.EBAY_ENV }, 'Fetching default category tree for EBAY_DE');
        const treeId = await taxonomy.getDefaultCategoryTreeId(EBAY_MARKETPLACE_ID);
        log.info({ treeId }, 'Tree id resolved');

        const resolved = await resolveAllCategories(taxonomy, treeId);

        const outPath = resolve(process.cwd(), args.outputPath);
        writeFileSync(outPath, `${JSON.stringify(resolved, null, 2)}\n`, 'utf8');
        log.info(
          { outPath, entries: Object.keys(resolved).length },
          '✓ Wrote resolved category IDs'
        );
      } finally {
        await dbClient.close();
      }
    });
  },
});

await runMain(command);
