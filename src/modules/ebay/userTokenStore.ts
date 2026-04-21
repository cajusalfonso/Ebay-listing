import { and, eq } from 'drizzle-orm';
import type { EbayEnvironment } from '../../config/constants';
import type { Database } from '../../db/client';
import { userEbayTokens } from '../../db/schema';
import { decrypt, encrypt } from '../../lib/encryption';
import type { TokenStore } from './tokenStore';
import type { EbayTokenPair } from './types';

/**
 * Multi-tenant TokenStore backed by `user_ebay_tokens`. Scope every read+write
 * to `userId` so tenants can never observe each other's tokens, even if they
 * accidentally share environment.
 */
export function createUserTokenStore(
  db: Database,
  userId: number,
  key: Buffer
): TokenStore {
  return {
    async load(environment: EbayEnvironment) {
      const rows = await db
        .select()
        .from(userEbayTokens)
        .where(
          and(eq(userEbayTokens.userId, userId), eq(userEbayTokens.ebayEnv, environment))
        )
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

    async save(environment: EbayEnvironment, tokens: EbayTokenPair) {
      const accessTokenEncrypted = encrypt(tokens.accessToken, key);
      const refreshTokenEncrypted = encrypt(tokens.refreshToken, key);
      await db
        .insert(userEbayTokens)
        .values({
          userId,
          ebayEnv: environment,
          accessTokenEncrypted,
          refreshTokenEncrypted,
          accessExpiresAt: tokens.accessTokenExpiresAt,
          refreshExpiresAt: tokens.refreshTokenExpiresAt,
        })
        .onConflictDoUpdate({
          target: [userEbayTokens.userId, userEbayTokens.ebayEnv],
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
