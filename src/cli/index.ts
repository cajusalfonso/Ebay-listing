import { defineCommand, runMain } from 'citty';
import { VERSION } from '../lib/version';

/**
 * Root CLI. Sub-commands for the per-module debug helpers (enrich / compliance /
 * market / price / list-product) get registered in later steps. Setup commands
 * (`setup:ebay-auth`, `setup:resolve-categories`) are their own entry points.
 */
const root = defineCommand({
  meta: {
    name: 'ebay-volume-tool',
    version: VERSION,
    description: 'eBay.de volume listing with compliance-first gate',
  },
  subCommands: {
    // Placeholder — sub-commands registered in Schritt 3.6+.
  },
  // eslint-disable-next-line @typescript-eslint/require-await
  async run() {
    // eslint-disable-next-line no-console -- CLI help output
    console.log(
      'No sub-command specified. Available top-level scripts:\n' +
        '  pnpm setup:ebay-auth\n' +
        '  pnpm setup:resolve-categories\n' +
        '  pnpm cli enrich|compliance|market|price|list-product  (coming in Schritt 3.6+)\n'
    );
  },
});

await runMain(root);
