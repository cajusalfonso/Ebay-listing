import type { Env } from '../../config/env';
import type { DbClient } from '../../db/client';
import { createDbClient } from '../../db/client';
import { parseEncryptionKey } from '../../lib/encryption';
import { createEbayOAuthClient } from '../../modules/ebay/auth';
import { createBrowseClient } from '../../modules/ebay/browse';
import { createCatalogClient } from '../../modules/ebay/catalog';
import { createEbayHttpClient, type EbayHttpClient } from '../../modules/ebay/httpClient';
import { createTaxonomyClient, type TaxonomyClient } from '../../modules/ebay/taxonomy';
import { createDbTokenStore, getValidAccessToken } from '../../modules/ebay/tokenStore';

export interface CliClients {
  readonly db: DbClient;
  readonly http: EbayHttpClient;
  readonly taxonomy: TaxonomyClient;
  readonly catalog: ReturnType<typeof createCatalogClient>;
  readonly browse: ReturnType<typeof createBrowseClient>;
  readonly encryptionKey: Buffer;
  /** Call on CLI exit to close the DB pool cleanly. */
  close: () => Promise<void>;
}

/**
 * Wire up every eBay-API-adjacent client from env. CLI commands call this at
 * the top of `run()` and defer `.close()` to a `finally` block. Tokens come
 * from the encrypted DB store; access tokens auto-refresh when close to expiry.
 */
export function buildCliClients(env: Env): CliClients {
  const db = createDbClient(env.DATABASE_URL);
  const encryptionKey = parseEncryptionKey(env.TOKEN_ENCRYPTION_KEY);
  const store = createDbTokenStore(db.db, encryptionKey);
  const oauthClient = createEbayOAuthClient({
    environment: env.EBAY_ENV,
    appId: env.EBAY_APP_ID,
    certId: env.EBAY_CERT_ID,
    redirectUriName: env.EBAY_REDIRECT_URI_NAME,
  });
  const http = createEbayHttpClient({
    environment: env.EBAY_ENV,
    getAccessToken: () => getValidAccessToken({ store, oauthClient, environment: env.EBAY_ENV }),
  });
  return {
    db,
    http,
    taxonomy: createTaxonomyClient(http),
    catalog: createCatalogClient(http),
    browse: createBrowseClient(http),
    encryptionKey,
    close: () => db.close(),
  };
}
