import { eq } from 'drizzle-orm';
import { ACCESS_TOKEN_REFRESH_THRESHOLD_MS, type EbayEnvironment } from '../../config/constants';
import type { Database } from '../../db/client';
import { ebayTokens } from '../../db/schema';
import { decrypt, encrypt } from '../../lib/encryption';
import type { EbayOAuthClient } from './auth';
import { EbayAuthError } from './errors';
import type { EbayTokenPair } from './types';

export interface StoredTokens {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly accessExpiresAt: Date;
  readonly refreshExpiresAt: Date;
}

/**
 * Abstracts persistence of the encrypted token pair. Having it as a DI'd
 * interface lets `getValidAccessToken` be tested without a real database —
 * the in-memory stub is ~10 lines in tests.
 */
export interface TokenStore {
  load(environment: EbayEnvironment): Promise<StoredTokens | null>;
  save(environment: EbayEnvironment, tokens: EbayTokenPair): Promise<void>;
}

/**
 * Build a TokenStore backed by the `ebay_tokens` Postgres table. Both tokens
 * are AES-256-GCM encrypted at rest; `key` must be the 32-byte Buffer from
 * `parseEncryptionKey(env.TOKEN_ENCRYPTION_KEY)`.
 */
export function createDbTokenStore(db: Database, key: Buffer): TokenStore {
  return {
    async load(environment) {
      const rows = await db
        .select()
        .from(ebayTokens)
        .where(eq(ebayTokens.environment, environment))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      return {
        accessToken: decrypt(row.accessTokenEncrypted, key),
        refreshToken: decrypt(row.refreshTokenEncrypted, key),
        accessExpiresAt: row.accessExpiresAt,
        refreshExpiresAt: row.refreshExpiresAt,
      };
    },

    async save(environment, tokens) {
      const accessTokenEncrypted = encrypt(tokens.accessToken, key);
      const refreshTokenEncrypted = encrypt(tokens.refreshToken, key);
      await db
        .insert(ebayTokens)
        .values({
          environment,
          accessTokenEncrypted,
          refreshTokenEncrypted,
          accessExpiresAt: tokens.accessTokenExpiresAt,
          refreshExpiresAt: tokens.refreshTokenExpiresAt,
        })
        .onConflictDoUpdate({
          target: ebayTokens.environment,
          set: {
            accessTokenEncrypted,
            refreshTokenEncrypted,
            accessExpiresAt: tokens.accessTokenExpiresAt,
            refreshExpiresAt: tokens.refreshTokenExpiresAt,
          },
        });
    },
  };
}

export interface GetValidAccessTokenParams {
  readonly store: TokenStore;
  readonly oauthClient: EbayOAuthClient;
  readonly environment: EbayEnvironment;
  /** Override the default 5-minute refresh threshold (useful for tests). */
  readonly refreshThresholdMs?: number;
  /** Override for testing — defaults to Date.now(). */
  readonly now?: () => number;
}

/**
 * Returns a currently-valid access token, refreshing via refresh_token if the
 * stored access token is already expired or expires within `refreshThresholdMs`.
 *
 * Throws EbayAuthError (code EBAY_AUTH_ERROR) when:
 * - No tokens have ever been stored for the environment (setup not run)
 * - The refresh token itself has expired (full re-auth needed)
 */
export async function getValidAccessToken(params: GetValidAccessTokenParams): Promise<string> {
  const { store, oauthClient, environment } = params;
  const threshold = params.refreshThresholdMs ?? ACCESS_TOKEN_REFRESH_THRESHOLD_MS;
  const now = params.now ?? (() => Date.now());

  const stored = await store.load(environment);
  if (!stored) {
    throw new EbayAuthError(
      `No eBay tokens stored for environment=${environment}. Run \`pnpm setup:ebay-auth\` first.`,
      { environment, reason: 'no_tokens' }
    );
  }

  const nowMs = now();
  if (stored.refreshExpiresAt.getTime() <= nowMs) {
    throw new EbayAuthError(
      `Refresh token expired for environment=${environment}. Re-run \`pnpm setup:ebay-auth\`.`,
      { environment, reason: 'refresh_expired' }
    );
  }

  const remainingMs = stored.accessExpiresAt.getTime() - nowMs;
  if (remainingMs > threshold) {
    return stored.accessToken;
  }

  const refreshed = await oauthClient.refreshAccessToken(stored.refreshToken);
  await store.save(environment, {
    accessToken: refreshed.accessToken,
    accessTokenExpiresAt: refreshed.accessTokenExpiresAt,
    refreshToken: stored.refreshToken,
    refreshTokenExpiresAt: stored.refreshExpiresAt,
  });
  return refreshed.accessToken;
}
