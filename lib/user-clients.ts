import { and, eq } from 'drizzle-orm';
import type { EbayEnvironment } from '../src/config/constants';
import { userCredentials, userEbayTokens } from '../src/db/schema';
import { decrypt } from '../src/lib/encryption';
import { createEbayOAuthClient } from '../src/modules/ebay/auth';
import { createBrowseClient } from '../src/modules/ebay/browse';
import { createCatalogClient } from '../src/modules/ebay/catalog';
import {
  createEbayHttpClient,
  type EbayHttpClient,
} from '../src/modules/ebay/httpClient';
import { createTaxonomyClient, type TaxonomyClient } from '../src/modules/ebay/taxonomy';
import { getValidAccessToken } from '../src/modules/ebay/tokenStore';
import { createUserTokenStore } from '../src/modules/ebay/userTokenStore';
import { db } from './db';
import { getEncryptionKey } from './encryption-key';

export interface UserEbayCredentials {
  readonly appId: string;
  readonly certId: string;
  readonly devId: string;
  readonly redirectUriName: string;
  readonly merchantLocationKey: string | null;
}

export interface UserIcecatCredentials {
  readonly user: string;
  readonly password: string;
}

export class MissingCredentialsError extends Error {
  public readonly missing: string[];
  constructor(missing: string[]) {
    super(`Missing credentials: ${missing.join(', ')}. Go to Settings and fill them in.`);
    this.name = 'MissingCredentialsError';
    this.missing = missing;
  }
}

export async function loadUserEbayCredentials(
  userId: number,
  ebayEnv: EbayEnvironment
): Promise<UserEbayCredentials> {
  const rows = await db
    .select()
    .from(userCredentials)
    .where(and(eq(userCredentials.userId, userId), eq(userCredentials.ebayEnv, ebayEnv)))
    .limit(1);
  const row = rows[0];

  const missing: string[] = [];
  if (!row?.ebayAppIdEncrypted) missing.push('eBay App ID');
  if (!row?.ebayCertIdEncrypted) missing.push('eBay Cert ID');
  if (!row?.ebayDevIdEncrypted) missing.push('eBay Dev ID');
  if (!row?.ebayRedirectUriName) missing.push('eBay RuName');
  if (
    !row ||
    !row.ebayAppIdEncrypted ||
    !row.ebayCertIdEncrypted ||
    !row.ebayDevIdEncrypted ||
    !row.ebayRedirectUriName
  ) {
    throw new MissingCredentialsError(missing);
  }

  const key = getEncryptionKey();
  return {
    appId: decrypt(row.ebayAppIdEncrypted, key),
    certId: decrypt(row.ebayCertIdEncrypted, key),
    devId: decrypt(row.ebayDevIdEncrypted, key),
    redirectUriName: row.ebayRedirectUriName,
    merchantLocationKey: row.merchantLocationKey,
  };
}

export async function loadUserIcecatCredentials(
  userId: number,
  ebayEnv: EbayEnvironment
): Promise<UserIcecatCredentials | null> {
  const rows = await db
    .select()
    .from(userCredentials)
    .where(and(eq(userCredentials.userId, userId), eq(userCredentials.ebayEnv, ebayEnv)))
    .limit(1);
  const row = rows[0];
  if (!row?.icecatUserEncrypted || !row.icecatPasswordEncrypted) return null;
  const key = getEncryptionKey();
  return {
    user: decrypt(row.icecatUserEncrypted, key),
    password: decrypt(row.icecatPasswordEncrypted, key),
  };
}

export async function loadUserSerpApiKey(
  userId: number,
  ebayEnv: EbayEnvironment
): Promise<string | null> {
  const rows = await db
    .select()
    .from(userCredentials)
    .where(and(eq(userCredentials.userId, userId), eq(userCredentials.ebayEnv, ebayEnv)))
    .limit(1);
  const row = rows[0];
  if (!row?.serpApiKeyEncrypted) return null;
  const key = getEncryptionKey();
  return decrypt(row.serpApiKeyEncrypted, key);
}

export async function loadUserDiscordWebhook(
  userId: number,
  ebayEnv: EbayEnvironment
): Promise<string | null> {
  const rows = await db
    .select()
    .from(userCredentials)
    .where(and(eq(userCredentials.userId, userId), eq(userCredentials.ebayEnv, ebayEnv)))
    .limit(1);
  const row = rows[0];
  if (!row?.discordWebhookUrlEncrypted) return null;
  const key = getEncryptionKey();
  return decrypt(row.discordWebhookUrlEncrypted, key);
}

export async function isEbayConnected(
  userId: number,
  ebayEnv: EbayEnvironment
): Promise<{ connected: boolean; accessExpiresAt: Date | null; refreshExpiresAt: Date | null }> {
  const rows = await db
    .select({
      accessExpiresAt: userEbayTokens.accessExpiresAt,
      refreshExpiresAt: userEbayTokens.refreshExpiresAt,
    })
    .from(userEbayTokens)
    .where(and(eq(userEbayTokens.userId, userId), eq(userEbayTokens.ebayEnv, ebayEnv)))
    .limit(1);
  const row = rows[0];
  if (!row) return { connected: false, accessExpiresAt: null, refreshExpiresAt: null };
  const now = Date.now();
  return {
    connected: row.refreshExpiresAt.getTime() > now,
    accessExpiresAt: row.accessExpiresAt,
    refreshExpiresAt: row.refreshExpiresAt,
  };
}

/**
 * Build an eBay HTTP client scoped to a specific user. Looks up their
 * credentials + tokens, wires the existing `getValidAccessToken` refresh
 * logic around a `UserTokenStore`. Throws `MissingCredentialsError` if the
 * user has not completed setup.
 */
// Simple per-process cache of app-level access tokens. Tokens expire after
// ~2h; we refresh 60s before expiry to avoid mid-request invalidation.
const appTokenCache = new Map<string, { token: string; expiresAt: number }>();

function appTokenCacheKey(userId: number, env: EbayEnvironment): string {
  return `${userId}:${env}`;
}

async function getAppAccessToken(
  userId: number,
  env: EbayEnvironment,
  oauthClient: ReturnType<typeof createEbayOAuthClient>
): Promise<string> {
  const cacheKey = appTokenCacheKey(userId, env);
  const cached = appTokenCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt - 60_000 > now) {
    return cached.token;
  }
  const fresh = await oauthClient.getApplicationAccessToken();
  appTokenCache.set(cacheKey, {
    token: fresh.accessToken,
    expiresAt: fresh.accessTokenExpiresAt.getTime(),
  });
  return fresh.accessToken;
}

export async function buildUserHttpClient(
  userId: number,
  ebayEnv: EbayEnvironment
): Promise<{
  http: EbayHttpClient;
  taxonomy: TaxonomyClient;
  catalog: ReturnType<typeof createCatalogClient>;
  browse: ReturnType<typeof createBrowseClient>;
  credentials: UserEbayCredentials;
}> {
  const creds = await loadUserEbayCredentials(userId, ebayEnv);
  const key = getEncryptionKey();
  const store = createUserTokenStore(db, userId, key);
  const oauthClient = createEbayOAuthClient({
    environment: ebayEnv,
    appId: creds.appId,
    certId: creds.certId,
    redirectUriName: creds.redirectUriName,
  });
  const http = createEbayHttpClient({
    environment: ebayEnv,
    getAccessToken: () => getValidAccessToken({ store, oauthClient, environment: ebayEnv }),
  });
  // Browse API uses an application-level token (client_credentials grant)
  // instead of the user-level one because Buy.Browse scopes aren't granted
  // to regular sellers. The default scope works for public search endpoints.
  const browseHttp = createEbayHttpClient({
    environment: ebayEnv,
    getAccessToken: () => getAppAccessToken(userId, ebayEnv, oauthClient),
  });
  return {
    http,
    taxonomy: createTaxonomyClient(http),
    catalog: createCatalogClient(http),
    browse: createBrowseClient(browseHttp),
    credentials: creds,
  };
}

/**
 * Build an OAuth client for the connect/callback flow. Does NOT need tokens
 * yet (that's what the flow creates) but needs app-level credentials.
 */
export async function buildUserOauthClient(
  userId: number,
  ebayEnv: EbayEnvironment
): Promise<ReturnType<typeof createEbayOAuthClient>> {
  const creds = await loadUserEbayCredentials(userId, ebayEnv);
  return createEbayOAuthClient({
    environment: ebayEnv,
    appId: creds.appId,
    certId: creds.certId,
    redirectUriName: creds.redirectUriName,
  });
}
