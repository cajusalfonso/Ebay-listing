import { describe, expect, it, vi } from 'vitest';
import type { EbayEnvironment } from '../../config/constants';
import { EbayAuthError } from './errors';
import { getValidAccessToken, type StoredTokens, type TokenStore } from './tokenStore';
import type { EbayOAuthClient } from './auth';

function inMemoryStore(initial: StoredTokens | null = null): {
  store: TokenStore;
  current: () => StoredTokens | null;
} {
  let state = initial;
  return {
    store: {
      // eslint-disable-next-line @typescript-eslint/require-await -- in-memory stub, async to match interface
      async load(_env: EbayEnvironment) {
        return state;
      },
      // eslint-disable-next-line @typescript-eslint/require-await
      async save(_env, tokens) {
        state = {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          accessExpiresAt: tokens.accessTokenExpiresAt,
          refreshExpiresAt: tokens.refreshTokenExpiresAt,
        };
      },
    },
    current: () => state,
  };
}

function stubOAuth(refreshImpl?: EbayOAuthClient['refreshAccessToken']): EbayOAuthClient {
  return {
    buildAuthorizeUrl: () => 'unused',
    exchangeCodeForTokens: () => Promise.reject(new Error('not used')),
    refreshAccessToken:
      refreshImpl ??
      (() =>
        Promise.resolve({
          accessToken: 'refreshed-access',
          accessTokenExpiresAt: new Date(Date.now() + 7_200_000),
        })),
    getApplicationAccessToken: () => Promise.reject(new Error('not used')),
  };
}

describe('getValidAccessToken', () => {
  it('throws EbayAuthError(no_tokens) when nothing is stored', async () => {
    const { store } = inMemoryStore(null);
    try {
      await getValidAccessToken({ store, oauthClient: stubOAuth(), environment: 'sandbox' });
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EbayAuthError);
      expect((err as EbayAuthError).context.reason).toBe('no_tokens');
    }
  });

  it('returns the stored access token when it still has long life remaining', async () => {
    const { store } = inMemoryStore({
      accessToken: 'fresh-access',
      refreshToken: 'some-refresh',
      accessExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h left
      refreshExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    });
    const oauth = stubOAuth(vi.fn().mockRejectedValue(new Error('should not refresh')));
    const token = await getValidAccessToken({ store, oauthClient: oauth, environment: 'sandbox' });
    expect(token).toBe('fresh-access');
  });

  it('refreshes when access token expires within threshold', async () => {
    const { store, current } = inMemoryStore({
      accessToken: 'stale-access',
      refreshToken: 'my-refresh',
      accessExpiresAt: new Date(Date.now() + 60 * 1000), // 1 minute → within 5-min threshold
      refreshExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    });
    const refreshSpy = vi.fn().mockResolvedValue({
      accessToken: 'new-access',
      accessTokenExpiresAt: new Date(Date.now() + 7_200_000),
    });
    const token = await getValidAccessToken({
      store,
      oauthClient: stubOAuth(refreshSpy),
      environment: 'sandbox',
    });
    expect(token).toBe('new-access');
    expect(refreshSpy).toHaveBeenCalledWith('my-refresh');
    // Store got updated
    expect(current()?.accessToken).toBe('new-access');
    // Refresh token was preserved (eBay doesn't rotate it on refresh)
    expect(current()?.refreshToken).toBe('my-refresh');
  });

  it('throws EbayAuthError(refresh_expired) when refresh token itself is expired', async () => {
    const { store } = inMemoryStore({
      accessToken: 'stale',
      refreshToken: 'also-stale',
      accessExpiresAt: new Date(Date.now() - 10_000),
      refreshExpiresAt: new Date(Date.now() - 10_000),
    });
    try {
      await getValidAccessToken({ store, oauthClient: stubOAuth(), environment: 'sandbox' });
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EbayAuthError);
      expect((err as EbayAuthError).context.reason).toBe('refresh_expired');
    }
  });

  it('respects custom refreshThresholdMs override', async () => {
    const { store } = inMemoryStore({
      accessToken: 'stored',
      refreshToken: 'r',
      accessExpiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
      refreshExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    });
    // With a 30-min threshold, 10-min remaining counts as "expiring soon" → refresh
    const refreshSpy = vi.fn().mockResolvedValue({
      accessToken: 'rotated',
      accessTokenExpiresAt: new Date(Date.now() + 7_200_000),
    });
    const token = await getValidAccessToken({
      store,
      oauthClient: stubOAuth(refreshSpy),
      environment: 'sandbox',
      refreshThresholdMs: 30 * 60 * 1000,
    });
    expect(token).toBe('rotated');
    expect(refreshSpy).toHaveBeenCalledOnce();
  });
});
