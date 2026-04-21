import { request } from 'undici';
import { z } from 'zod';
import { EBAY_BASE_URLS, EBAY_OAUTH_SCOPES, type EbayEnvironment } from '../../config/constants';
import { EbayAuthError } from './errors';
import type { EbayAccessTokenRefreshed, EbayTokenPair } from './types';

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  refresh_token: z.string().min(1),
  refresh_token_expires_in: z.number().int().positive(),
  token_type: z.string(),
});

const refreshResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  token_type: z.string(),
});

export interface EbayOAuthConfig {
  readonly environment: EbayEnvironment;
  /** eBay `App ID (Client ID)` from the dev dashboard. */
  readonly appId: string;
  /** eBay `Cert ID (Client Secret)`. */
  readonly certId: string;
  /** eBay `RuName` — the pre-registered redirect URI identifier, not the URL. */
  readonly redirectUriName: string;
  /** Defaults to the MVP scope list. Override if you need a narrower/wider set. */
  readonly scopes?: readonly string[];
}

export interface EbayOAuthClient {
  /**
   * Build the authorize URL the user opens in a browser to grant consent.
   * `state` is opaque to eBay — useful for CSRF protection on the callback.
   */
  buildAuthorizeUrl(state?: string): string;
  /** Exchange a one-shot authorization code (from the callback) for token pair. */
  exchangeCodeForTokens(code: string): Promise<EbayTokenPair>;
  /** Exchange a long-lived refresh token for a fresh access token. */
  refreshAccessToken(refreshToken: string): Promise<EbayAccessTokenRefreshed>;
}

function buildBasicAuthHeader(appId: string, certId: string): string {
  return `Basic ${Buffer.from(`${appId}:${certId}`).toString('base64')}`;
}

export function createEbayOAuthClient(config: EbayOAuthConfig): EbayOAuthClient {
  const envUrls = EBAY_BASE_URLS[config.environment];
  const scopes = config.scopes ?? EBAY_OAUTH_SCOPES;
  const basicAuth = buildBasicAuthHeader(config.appId, config.certId);
  const tokenEndpoint = `${envUrls.api}/identity/v1/oauth2/token`;

  async function postTokenRequest(bodyParams: URLSearchParams): Promise<unknown> {
    const { statusCode, body } = await request(tokenEndpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: basicAuth,
      },
      body: bodyParams.toString(),
    });
    const json: unknown = await body.json();
    if (statusCode !== 200) {
      throw new EbayAuthError(`eBay token endpoint returned ${statusCode}`, {
        statusCode,
        response: json,
      });
    }
    return json;
  }

  return {
    buildAuthorizeUrl(state?: string): string {
      const params = new URLSearchParams({
        client_id: config.appId,
        response_type: 'code',
        redirect_uri: config.redirectUriName,
        scope: scopes.join(' '),
      });
      if (state) params.set('state', state);
      return `${envUrls.auth}/oauth2/authorize?${params.toString()}`;
    },

    async exchangeCodeForTokens(code: string): Promise<EbayTokenPair> {
      const json = await postTokenRequest(
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: config.redirectUriName,
        })
      );
      const parsed = tokenResponseSchema.safeParse(json);
      if (!parsed.success) {
        throw new EbayAuthError('Token response schema mismatch', {
          issues: parsed.error.issues,
          response: json,
        });
      }
      const now = Date.now();
      return {
        accessToken: parsed.data.access_token,
        accessTokenExpiresAt: new Date(now + parsed.data.expires_in * 1_000),
        refreshToken: parsed.data.refresh_token,
        refreshTokenExpiresAt: new Date(now + parsed.data.refresh_token_expires_in * 1_000),
      };
    },

    async refreshAccessToken(refreshToken: string): Promise<EbayAccessTokenRefreshed> {
      const json = await postTokenRequest(
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          scope: scopes.join(' '),
        })
      );
      const parsed = refreshResponseSchema.safeParse(json);
      if (!parsed.success) {
        throw new EbayAuthError('Refresh response schema mismatch', {
          issues: parsed.error.issues,
          response: json,
        });
      }
      const now = Date.now();
      return {
        accessToken: parsed.data.access_token,
        accessTokenExpiresAt: new Date(now + parsed.data.expires_in * 1_000),
      };
    },
  };
}
